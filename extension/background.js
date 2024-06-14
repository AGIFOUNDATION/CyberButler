import "./script/common.js";
import "./script/lrucache.js";
import "./script/cachedDB.js";
import "./script/ai.js";
import "./script/prompts.js";

const i18nList = ['en', 'zh'];
const DefaultLang = "zh";
const TabInfoPrefix = 'page_activity:';

globalThis.LangName = {
	'zh': "Chinese",
	'en': "English",
};
globalThis.Hints = {
	zh: {
		talkHint: "机灵说：",
		noAPIKey: "抱歉，您还没有设置 Gemini APIKey 哦！",
	},
	en: {
		talkHint: "Cyprite say:",
		noAPIKey: "Sorry, you haven't set the Gemini API key yet!",
	},
};
globalThis.myInfo = {
	useLocalKV: true,
	apiKey: '',
	lang: DefaultLang,
	name: '主人',
	info: '(Not set yet)',
};

const waitUntil = fun => new Promise(res => {
	var untiler = setInterval(() => {
		logger.log('Ext', 'Reactive and waiting...');
	}, 10 * 1000);
	fun().finally(() => {
		clearInterval(untiler);
		res();
	});
});

/* DB */

const DBs = {};
const initDB = async () => {
	var db = new CachedDB("PageInfos", 1);
	db.onUpdate(() => {
		db.open('tabInfo', 'tid', 10);
		db.open('pageInfo', 'url', 10);
		logger.info('DB', 'Updated');
	});
	db.onConnect(() => {
		logger.info('DB', 'Connected');
	});
	await db.connect();
	DBs.pageInfos = db;
};

/* Management */

const configureCyberButler = async () => {
	var url = chrome.runtime.getURL(`pages/${myInfo.lang}/config.html`);
	var tab = await chrome.tabs.query({url});
	if (!!tab && tab.length > 0) {
		tab = tab[0];
		chrome.tabs.highlight({
			windowId: tab.windowId,
			tabs: tab.index
		});
	}
	else {
		chrome.tabs.create({url});
	}
};
chrome.runtime.onInstalled.addListener(async () => {
	chrome.storage.local.set({installed: true});
	var wsHost = await getWSConfig();
	if (!!wsHost) return;
	configureCyberButler();
});
const showSystemNotification = (message) => {
	console.log(message);
	chrome.notifications.create({
		title: Hints[myInfo.lang].talkHint,
		message,
		type: "basic",
		iconUrl: "/images/cyprite.png",
	});
};

/* Page Manager */

const isPageForbidden = (url) => {
	if (!url) return true;
	if (url.indexOf('chrome://') === 0) return true;
	return false;
};
const onPageActivityChanged = async (tid, state) => {
	if (!tid) return;

	var info = await getTabInfo(tid);
	if (info.active) {
		if (state === 'show') return;
	}
	else {
		if (state === 'hide') return;
	}
	console.log('>>>>>>>>>>>>>>>>>>>>', tid, state);

	var tab;
	try {
		tab = await chrome.tabs.get(tid);
	}
	catch {
		tab = null;
	}
	if (!tab) {
		await delTabInfo(tid);
		if (state === 'close') {
			tab = {};
		}
		else {
			return;
		}
	}
	var { title, url, active } = tab;

	var now = Date.now();
	if (['open', 'show', 'active', 'update', 'loaded'].includes(state)) {
		if (!active) {
			await inactivePage(info, now);
		}
		else if (isPageForbidden(url)) {
			await inactivePage(info, now, true);
			info.duration = 0;
		}
		else {
			let shouldRequest = state === 'open';

			if (url !== info.url) {
				shouldRequest = true;
				await inactivePage(info, now, true);
				info.duration = 0;
			}

			if (!info.active || state === 'open') info.open = now;
			if (!info.title) info.title = title;
			info.active = true;
			info.url = url;

			console.log(':::::::::::::::::::', shouldRequest, info.isArticle);
			if ((shouldRequest || !info.requested) && info.isArticle) {
				info.requested = true;
				dispatchEvent({
					event: "requestCypriteNotify",
					target: "FrontEnd",
					tid
				});
			}
			await setTabInfo(tid, info);
		}
	}
	else if (['hide', 'idle'].includes(state)) {
		await inactivePage(info, now);
	}
	else if (state === 'close') {
		await inactivePage(info, now, true);
		info.duration = 0;
		await delTabInfo(tid);
	}
};
const inactivePage = async (info, now, needCall=false) => {
	var shouldCall = !!info.url;
	if (info.open > 0) info.duration += now - info.open;
	else shouldCall = false;
	info.open = -1;
	info.active = false;
	if (!shouldCall) return;
	await onPageDurationUpdated(needCall, info.url, info.duration, info.title);
};
const onPageDurationUpdated = async (closed, url, duration, title) => {
	logger.log('PageActivity', 'Save Data: ' + url);

	// save info locally
	await savePageActivities(url, duration, title, closed);

	// save into to server
	sendMessage("SavePageActivity", {url, duration, title, closed}, "BackEnd");
};
const savePageActivities = async (url, duration, title, closed) => {
	var info = await getPageInfo(url);

	info.reading = !closed;
	info.title = title;
	info.viewed ++;
	info.totalDuration += duration;
	info.currentDuration = duration;
	info.timestamp = timestmp2str("YYYY/MM/DD hh:mm:ss :WDE:");

	await setPageInfo(url, info);
};

/* Infos */

const getPageInfo = async url => {
	var info = TabInfo[url];
	if (!info) {
		info = await DBs.pageInfos.get('pageInfo', url);
		logger.log('DB', 'Get Page Info: ' + url);
		if (!info) {
			info = {
				totalDuration: 0,
				viewed: 0,
			};
		}
	}
	return info;
};
const setPageInfo = async (url, info) => {
	if (!!DBs.tmrPageInfos) {
		clearTimeout(DBs.tmrPageInfos);
	}
	DBs.tmrPageInfos = setTimeout(async () => {
		await DBs.pageInfos.set('pageInfo', url, info);
		logger.log('DB', 'Set Page Info: ' + url);
	}, 200);
};
const delPageInfo = async (url) => {
	if (!!DBs.tmrPageInfos) {
		clearTimeout(DBs.tmrPageInfos);
	}
	DBs.tmrPageInfos = setTimeout(async () => {
		await DBs.pageInfos.del('pageInfo', url);
		logger.log('DB', 'Del Page Info: ' + url);
	}, 200);
};
const getTabInfo = async tid => {
	var info = TabInfo[tid];
	if (!info) {
		info = await DBs.pageInfos.get('tabInfo', tid);
		logger.log('DB', 'Get TabInfo: ' + tid);
		if (!info) {
			info = {
				active: false,
				duration: 0,
				open: -1,
			};
		}
	}
	return info;
};
const setTabInfo = async (tid, info) => {
	TabInfo[tid] = info;
	if (!!DBs.tmrTabInfos) {
		clearTimeout(DBs.tmrTabInfos);
	}
	DBs.tmrTabInfos = setTimeout(async () => {
		await DBs.pageInfos.set('tabInfo', tid, info);
		logger.log('DB', 'Set TabInfo: ' + tid);
	}, 200);
};
const delTabInfo = async (tid) => {
	delete TabInfo[tid];
	if (!!DBs.tmrTabInfos) {
		clearTimeout(DBs.tmrTabInfos);
	}
	DBs.tmrTabInfos = setTimeout(async () => {
		await DBs.pageInfos.del('tabInfo', tid);
		logger.log('DB', 'Del TabInfo: ' + tid);
	}, 200);
};
const TabInfo = {};

/* Tabs */

var LastActiveTab = null;
const TabPorts = new Map();
chrome.tabs.onActivated.addListener(tab => {
	LastActiveTab = tab.tabId;
	chrome.tabs.connect(LastActiveTab);
});
chrome.tabs.onRemoved.addListener(tabId => {
	if (LastActiveTab === tabId) LastActiveTab = null;
	onPageActivityChanged(tabId, "close");
});
chrome.idle.onStateChanged.addListener((state) => {
	logger.info('Ext', 'Idle State Changed: ' + state);
	if (!LastActiveTab) return;
	if (state === 'idle') {
		onPageActivityChanged(LastActiveTab, "idle");
	}
	else {
		onPageActivityChanged(LastActiveTab, "active");
		chrome.tabs.connect(LastActiveTab);
	}
});
chrome.runtime.onMessage.addListener((msg, sender) => {
	if (msg.sender !== "PopupEnd") {
		let tid = sender.tab?.id;
		msg.sid = tid;
		if (msg.tid === 'me') msg.tid = tid;
	}
	dispatchEvent(msg);
});
chrome.runtime.onConnect.addListener(port => {
	if (port.name !== "cyberbutler_contentscript") return;
	var tid = port.sender?.tab?.id;
	if (!tid) return;
	logger.info('PORT', 'Connect: ' + tid);
	TabPorts.set(tid, port);
	port.onMessage.addListener(msg => {
		if (msg.sender !== "PopupEnd") {
			msg.sid = tid;
			if (msg.tid === 'me') msg.tid = tid;
		}
		dispatchEvent(msg);
	});
	port.onDisconnect.addListener(() => {
		logger.info('PORT', 'Disconnect: ' + tid);
		TabPorts.delete(tid);
	});
});
const callPopup = (event, data) => {
	chrome.runtime.sendMessage({
		event, data,
		target: "PopupEnd",
		sender: "BackEnd"
	});
};

/* WebSocket */

const DefaultSendMessage = (event, data, sender, sid) => {};
var webSocket;
var sendMessage = DefaultSendMessage;

const getWSConfig = async () => {
	var [localInfo, remoteInfo] = await Promise.all([
		chrome.storage.local.get(['wsHost', 'apiKey']),
		chrome.storage.sync.get(['name', 'info', 'lang']),
	]);

	myInfo.name = remoteInfo.name || myInfo.name;
	myInfo.info = remoteInfo.info || myInfo.info;
	myInfo.lang = remoteInfo.lang;
	if (!myInfo.lang) {
		myInfo.lang = DefaultLang;
	}
	else {
		myInfo.lang = myInfo.lang.toLowerCase();
		if (!i18nList.includes(myInfo.lang)) myInfo.lang = DefaultLang;
	}
	if (myInfo.lang !== remoteInfo) {
		chrome.storage.sync.set({lang: myInfo.lang});
	}

	myInfo.apiKey = localInfo.apiKey || '';
	return localInfo.wsHost;
};
const initWS = async () => {
	var wsHost = await getWSConfig();
	if (!wsHost) {
		logger.info('WS', 'Use Edged Knowledge Vault');

		let installed = await chrome.storage.local.get('installed');
		installed = installed.installed || false;
		if (!installed) return;
		myInfo.useLocalKV = !wsHost;
		sayHello();
	}
	else {
		logger.info('WS', 'Host: ' + wsHost);
		prepareWS(wsHost);
	}
};
const parseMsg = evt => {
	var msg = evt.data;
	if (!isString(msg)) return null;
	try {
		msg = JSON.parse(msg);
	}
	catch {
		return null;
	}
	msg.target = msg.target || "BackEnd";
	return msg;
};
const prepareWS = (wsUrl) => new Promise((res, rej) => {
	// Close last socket
	if (!!webSocket) webSocket.close();

	var socket = new WebSocket(wsUrl);

	socket.onopen = async () => {
		logger.info('WS', 'Opened');

		webSocket = socket;
		sendMessage = async (event, data, sender, sid) => {
			if (!webSocket) {
				await prepareWS(wsUrl);
			}

			data = {event, data, sender, sid};
			data = JSON.stringify(data);
			webSocket.send(data);
		};

		res(true);

		var installed = await chrome.storage.local.get('installed');
		installed = installed.installed || false;
		if (!installed) return;
		myInfo.useLocalKV = false;
		sayHello();
	};
	socket.onmessage = evt => {
		var msg = parseMsg(evt);
		if (msg.event === 'initial') {
			logger.info('WS', 'Initialized: ' + msg.data);
			return;
		}

		msg.sender = 'ServerEnd';
		dispatchEvent(msg);
	};
	socket.onerror = err => {
		logger.error("WS", "Error:", err);
	};
	socket.onclose = () => {
		logger.info("WS", "Close");
		if (socket === webSocket) webSocket = null;
		res(false);
	};
});

/* EventHandler */

const EventHandler = {};
const dispatchEvent = async (msg) => {
	// 服务器端事件
	if (msg.target === 'ServerEnd') {
		sendMessage(msg.event, msg.data, msg.sender, msg.sid);
	}
	// 页面端事件
	else if (msg.target === "PageEnd") {
		// 发送给指定页面
		if (!!msg.tid) {
			let tab = await chrome.tabs.get(msg.tid);
			if (!!tab) {
				try {
					await chrome.tabs.sendMessage(msg.tid, msg);
				} catch {}
			}
			else {
				logger.error("Sys", `Tab ${msg.tid} does not exist.`);
			}
		}
		// 发送给当前页面
		else if (!!LastActiveTab) {
			let tid = LastActiveTab;
			let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
			if (!!tab) {
				tid = tab.id;
			}
			if (!tid) return;
			try {
				await chrome.tabs.sendMessage(tid, msg);
			} catch {}
		}
	}
	// Content端事件
	else if (msg.target === "FrontEnd") {
		let tid = msg.tid;
		if (!tid) {
			let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
			if (!!tab) tid = tab.id;
		}
		if (!tid) tid = LastActiveTab;
		if (!tid) return;
		let port = TabPorts.get(tid);
		if (!port) return;
		try {
			await port.postMessage(msg);
		} catch {}
	}
	// Background事件
	else {
		let handler = EventHandler[msg.event];
		if (!handler) return logger.log('SW', 'Got Event', msg);

		handler(msg.data, msg.sender, msg.sid, msg.target, msg.tid);
	}
};

EventHandler.OpenPopup = async (data, source) => {
	if (source !== 'PopupEnd') return;

	var wsHost = await getWSConfig();
	configureCyberButler();
	if (!!wsHost) return;

	callPopup("ClosePopup");
	configureCyberButler();
};
EventHandler.SetConfig = async (data, source, sid) => {
	if (source !== 'ConfigPage') return;
	logger.log('WS', 'Set Host: ' + data.wsHost);

	myInfo.name = data.myName || myInfo.name;
	myInfo.info = data.myInfo || myInfo.info;
	myInfo.lang = data.myLang || myInfo.lang;
	myInfo.apiKey = data.apiKey || myInfo.apiKey;

	if (!data.wsHost) {
		sendMessage = DefaultSendMessage;
		chrome.tabs.sendMessage(sid, {
			event: "connectWSHost",
			data: {
				wsHost: data.wsHost,
				ok: true,
			},
			target: source,
			sender: 'BackEnd',
		});
		myInfo.useLocalKV = true;
		sayHello();
		return;
	}

	var done;
	try {
		done = await prepareWS(data.wsHost);
	}
	catch (err) {
		console.error(err);
		done = false;
	}

	chrome.tabs.sendMessage(sid, {
		event: "connectWSHost",
		data: {
			wsHost: data.wsHost,
			ok: done
		},
		target: source,
		sender: 'BackEnd',
	});
};
EventHandler.PageStateChanged = async (data, source, sid) => {
	if (source !== 'FrontEnd') return;
	logger.log('Page', 'State Changed: ' + data.state);

	var info = await getTabInfo(sid);
	if (!!data && !!data.pageInfo) {
		info.title = data.pageInfo.title || info.title;
		info.description = data.pageInfo.description || info.description;
		info.isArticle = isBoolean(data.pageInfo.isArticle) ? data.pageInfo.isArticle : info.isArticle;
		await setTabInfo(sid, info);
	}
	console.log(info);
	// console.log(data);

	onPageActivityChanged(sid, data.state);
};
EventHandler.VisibilityChanged = (data, source, sid) => {
	if (source !== 'FrontEnd') return;
	onPageActivityChanged(sid, data);
};
EventHandler.MountNotification = async (data, source, sid) => {
	if (source !== 'FrontEnd') return;

	var tasks = [];
	tasks.push(chrome.scripting.insertCSS({
		target: { tabId: sid },
		files: ["/components/notification.css", "/components/mention.css"]
	}));
	tasks.push(chrome.scripting.executeScript({
		target: { tabId: sid },
		files: ["/components/notification.js"],
		injectImmediately: true,
	}));
	await Promise.all(tasks);
	logger.log('Page', 'Notification has mounted!');
	dispatchEvent({
		event: "notificationMounted",
		target: 'FrontEnd',
		tid: sid
	});
};
EventHandler.SummarizePage = async (data, source, sid) => {
	var summary = await summarizeArticle(data);
	logger.log('AI', 'Summary Finished: ' + !!summary);
	dispatchEvent({
		event: "pageSummarized",
		data: summary,
		target: source,
		tid: sid
	});
};

/* ------------ */

EventHandler.ContentScriptLoaded = (data, source, sid, target, tid) => {
	if (source !== 'FrontEnd') return;
	chrome.scripting.executeScript({
		target: { tabId: sid },
		files: [ "insider.js" ],
		injectImmediately: true,
	});
};
EventHandler.notify = (data, source, sid) => {
	var sourceName = 'Server';
	if (source === "BackEnd") sourceName = 'Background';
	else if (source === "FrontEnd") sourceName = 'Content';
	else if (source === "PageEnd") sourceName = 'Injection';
	if (!isString(data) && !isNumber(data) && !isBoolean(data)) data = JSON.stringify(data);
	logger.log(`Notify | ${sourceName}`, data);
};

/* AI */

const sayHello = async () => {
	var currentDate = timestmp2str('YYYY/MM/DD');
	console.log('Required to say hello: ' + currentDate);

	var lastHello = await chrome.storage.session.get('lastHello');
	lastHello = lastHello.lastHello;
	console.log('>>>>>>>', lastHello, currentDate);
	if (!!lastHello && lastHello === currentDate) return;
	chrome.storage.session.set({lastHello: currentDate});

	myInfo.useLocalKV = true; // test

	var reply;
	try {
		reply = "Hello";
		// reply = await callAIandWait('sayHello');
		showSystemNotification(reply);
	}
	catch (err) {
		showSystemNotification(err);
	}
};
const summarizeArticle = async (article) => {
	myInfo.useLocalKV = true; // test

	var reply;
	try {
		// reply = "Hello";
		reply = await callAIandWait('summarizeArticle', article);
	}
	catch (err) {
		reply = null;
		showSystemNotification(err);
	}
	return reply;
};

/* Init */

initDB();
initWS();