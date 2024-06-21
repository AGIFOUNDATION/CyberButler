import "./script/common.js";
import "./script/cachedDB.js";
import "./script/ai.js";
import "./script/prompts.js";

const i18nList = ['en', 'zh'];
const UtilList = {
	notification: {
		js : ["/components/notification.js"],
		css: ["/components/notification.css", "/components/mention.css"],
	},
	panel: {
		js : ['/components/marked.min.js'],
		css: ["/components/panel.css"],
	},
};

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

/* DB */

const DBs = {};
const initDB = async () => {
	const dbPageInfos = new CachedDB("PageInfos", 1);
	dbPageInfos.onUpdate(() => {
		dbPageInfos.open('tabInfo', 'tid');
		dbPageInfos.open('pageInfo', 'url');
		dbPageInfos.open('notifyChecker', 'url');
		dbPageInfos.open('pageConversation', 'url');
		logger.info('DB', 'Updated');
	});
	dbPageInfos.onConnect(() => {
		globalThis.dbPageInfos = dbPageInfos; // test
		logger.info('DB', 'Connected');
	});

	await dbPageInfos.connect();
	DBs.pageInfo = dbPageInfos;
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
	const csList = chrome.runtime.getManifest().content_scripts;
	for (const cs of csList) {
		const tabs = await chrome.tabs.query({url: cs.matches});
		for (const tab of tabs) {
			if (tab.url.match(/^chrome/i)) {
				continue;
			}
			try {
				await chrome.scripting.executeScript({
					files: cs.js,
					target: {
						tabId: tab.id,
						allFrames: cs.all_frames
					},
					injectImmediately: cs.run_at === 'document_start',
					// world: cs.world, // uncomment if you use it in manifest.json in Chrome 111+
				});
			} catch {}
		}
	}

	chrome.storage.local.set({installed: true});
	var wsHost = await getWSConfig();
	if (!!wsHost) return;
	configureCyberButler();
});
const showSystemNotification = (message) => {
	logger.info('MSG', message);
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
		}
		else {
			let shouldRequest = state === 'open';

			if (url !== info.url) {
				shouldRequest = true;
				await inactivePage(info, now, true);
			}

			if (!info.active || state === 'open') info.open = now;
			if (!info.title) info.title = title;
			info.active = true;
			info.url = url;

			info.requested = false; // test
			if (shouldRequest && info.isArticle && !info.requested) {
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
		await delTabInfo(tid);
	}
};
const inactivePage = async (info, now, closed=false) => {
	var shouldCall = !!info.url;
	if (info.open > 0) info.duration += now - info.open;
	else shouldCall = false;
	info.open = -1;
	info.active = false;
	if (!shouldCall) {
		if (closed) info.duration = 0;
		return;
	}
	await onPageDurationUpdated(closed, info.url, info.duration, info.title);
	if (closed) info.duration = 0;
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
	console.log(info);

	// await setPageInfo(url, info);
};

/* Infos */

const parseURL = url => {
	// For VUE SPA
	if (url.match(/\/#\//)) {
		url = url.replace(/\/#\//, '/');
		let match = url.match(/[\w\d\-_]+=[\w\d\-_\.\/]+/gi);
		url = url.replace(/[#\?][\w\W]*$/, '');
		if (!!match) {
			match = match.map(item => {
				item = item.split('=');
				return item;
			});
			match.sort((a, b) => a[0] > b[0] ? 1 : (a[0] < b[0] ? -1 : 0));
			match = match.map(item => item.join('/')).join('/');
			url = url + '/' + match;
			url = url.replace(/\/\/+/g, '/');
		}
	}
	else {
		url = url.replace(/[#\?][\w\W]*$/, '');
	}
	return url;
};
const getPageInfo = async url => {
	url = parseURL(url);
	var info = TabInfo[url];
	if (!info) {
		info = await DBs.pageInfo.get('pageInfo', url);
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
	url = parseURL(url);
	if (!!DBs.tmrPageInfos) {
		clearTimeout(DBs.tmrPageInfos);
	}
	DBs.tmrPageInfos = setTimeout(async () => {
		delete DBs.tmrPageInfos;
		await DBs.pageInfo.set('pageInfo', url, info);
		logger.log('DB', 'Set Page Info: ' + url);
	}, 200);
};
const delPageInfo = async (url) => {
	url = parseURL(url);
	if (!!DBs.tmrPageInfos) {
		clearTimeout(DBs.tmrPageInfos);
	}
	DBs.tmrPageInfos = setTimeout(async () => {
		delete DBs.tmrPageInfos;
		await DBs.pageInfo.del('pageInfo', url);
		logger.log('DB', 'Del Page Info: ' + url);
	}, 200);
};
const getTabInfo = async tid => {
	var info = TabInfo[tid];
	if (!info) {
		info = await DBs.pageInfo.get('tabInfo', 'T-' + tid);
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
		delete DBs.tmrTabInfos;
		await DBs.pageInfo.set('tabInfo', 'T-' + tid, info);
		logger.log('DB', 'Set TabInfo: ' + tid);
	}, 200);
};
const delTabInfo = async (tid) => {
	delete TabInfo[tid];
	if (!!DBs.tmrTabInfos) {
		clearTimeout(DBs.tmrTabInfos);
		delete DBs.tmrTabInfos;
	}

	var allTabInfos = await DBs.pageInfo.all('tabInfo');
	for (let name in allTabInfos) {
		let tid = name.replace(/^T\-/, '');
		try {
			await chrome.tabs.get(tid * 1);
		}
		catch {
			await DBs.pageInfo.del('tabInfo', name);
			logger.log('DB', 'Del TabInfo: ' + tid);
		}
	}
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
	removeAIChatHistory(tid);
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
		AIHandler.sayHello();
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

	var socket;
	try {
		socket = new WebSocket(wsUrl);
	}
	catch {
		return;
	}

	socket.onopen = async () => {
		logger.info('WS', 'Opened');

		webSocket = socket;
		sendMessage = async (event, data, sender, sid) => {
			if (!webSocket || !webSocket.send) {
				await prepareWS(wsUrl);
				if (!webSocket.send) {
					logger.warn('WS', "WebSocket is invalid.");
					return;
				}
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
		AIHandler.sayHello();
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
	// To Server via WebSocket
	if (msg.target === 'ServerEnd') {
		sendMessage(msg.event, msg.data, msg.sender || 'BackEnd', msg.sid);
	}
	// To ContentScript and UserScript
	else if (msg.target === "FrontEnd" || msg.target === 'PageEnd') {
		let tid = msg.tid;
		if (!tid) {
			let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
			if (!!tab) tid = tab.id;
		}
		if (!tid) tid = LastActiveTab;
		if (!tid) return;
		let port = TabPorts.get(tid);
		if (!port) return;
		msg.sender = msg.sender || 'BackEnd';
		try {
			await port.postMessage(msg);
		} catch {}
	}
	// To ServiceWorker itself
	else {
		let handler = EventHandler[msg.event];
		if (!handler) return logger.log('SW', 'Got Event', msg);

		handler(msg.data, msg.sender, msg.sid, msg.target, msg.tid);
	}
};

EventHandler.OpenPopup = async (data, source) => {
	if (source !== 'PopupEnd') return;

	var wsHost = await getWSConfig();
	if (!wsHost) {
		callPopup("ClosePopup");
		configureCyberButler();
	}
	else {
		let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
		// Call Popup Cyprite
		if (isPageForbidden(tab.url)) {
			console.log('Call Popup Cyprite');
		}
		// Call Page Cyprite
		else {
			callPopup("ClosePopup");
			let info = await getTabInfo(tab.id);
			info.requested = true;
			dispatchEvent({
				event: "requestCypriteNotify",
				data: {forceShow: true},
				target: "FrontEnd",
				tid: tab.id
			});
			await setTabInfo(tab.id, info);
		}
	}
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
		AIHandler.sayHello();
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
		info.isArticle = isBoolean(data.pageInfo.isArticle) ? data.pageInfo.isArticle : info.isArticle;
		await setTabInfo(sid, info);
	}

	onPageActivityChanged(sid, data.state);
};
EventHandler.VisibilityChanged = (data, source, sid) => {
	if (source !== 'FrontEnd') return;
	onPageActivityChanged(sid, data);
};
EventHandler.MountUtil = async (util, source, sid) => {
	if (source !== 'FrontEnd') return;

	var utilFiles = UtilList[util];
	if (!!utilFiles) {
		let tasks = [];
		if (!!utilFiles.css) {
			tasks.push(chrome.scripting.insertCSS({
				target: { tabId: sid },
				files: utilFiles.css,
			}));
		}
		if (!!utilFiles.js) {
			tasks.push(chrome.scripting.executeScript({
				target: { tabId: sid },
				files: utilFiles.js,
				injectImmediately: true,
			}));
		}
		await Promise.all(tasks);
		logger.log('Page', 'Notification has mounted!');
	}

	dispatchEvent({
		event: "utilMounted",
		data: util,
		target: 'FrontEnd',
		tid: sid
	});
};
EventHandler.AskAIAndWait = async (data, source, sid) => {
	var result = {id: data.id};
	if (!!data.action) {
		let handler = AIHandler[data.action];
		try {
			let msg = await handler(data.data, source, sid);
			result.result = msg;
			logger.log('AI', 'Task ' + data.action + ' Finished');
		}
		catch (err) {
			result.result = '';
			logger.error('AI', 'Task ' + data.action + ' Failed:', err);
		}
	}
	dispatchEvent({
		event: "replyAskAndWait",
		data: result,
		target: source,
		tid: sid
	});
};
EventHandler.AskSWAndWait = async (data, source, sid) => {
	var result = {id: data.id};
	if (!!data.action) {
		let handler = EventHandler[data.action];
		try {
			let msg = await handler(data.data, source, sid);
			result.result = msg;
			logger.log('SW', 'Task ' + data.action + ' Finished');
		}
		catch (err) {
			result.result = '';
			logger.error('SW', 'Task ' + data.action + ' Failed:', err);
		}
	}
	dispatchEvent({
		event: "replyAskAndWait",
		data: result,
		target: source,
		tid: sid
	});
};
EventHandler.SavePageSummary = async (data, source, sid) => {
	var tabInfo = await getTabInfo(sid);
	var pageInfo = await getPageInfo(tabInfo.url);
	pageInfo.title = data.title || pageInfo.title;
	pageInfo.description = data.summary || pageInfo.description;
	pageInfo.hash = data.hash || pageInfo.hash;
	pageInfo.embedding = data.embedding || pageInfo.embedding;

	await Promise.all([
		setTabInfo(sid, tabInfo),
		setPageInfo(tabInfo.url, pageInfo),
	]);
};

EventHandler.CalculateHash = async (data) => {
	// This function is not safe in browser.
	var content = data.content, algorithm;
	if (!content) {
		content = data;
	}
	else {
		algorithm = data.algorithm;
	}
	return calculateHash(content, algorithm);
};
EventHandler.CheckPageNeedAI = async (data) => {
	return await getPageNeedAIInfo(data);
};
EventHandler.UpdatePageNeedAIInfo = async (data) => {
	var info = await getPageNeedAIInfo(data);
	info.page.visited ++;
	info.path.visited ++;
	info.host.visited ++;
	if (data.need) {
		info.page.need ++;
		info.path.need ++;
		info.host.need ++;
	}
	await updatePageNeedAIInfo(data, info);
};
EventHandler.LoadPageSummary = async (data, source, sid) => {
	var tab = await chrome.tabs.get(sid);
	if (!!tab && !isPageForbidden(tab.url)) {
		return await getPageInfo(tab.url);
	}
	else {
		return null;
	}
};
EventHandler.FindSimilarArticle = async (vector) => {
	var all = await DBs.pageInfo.all('pageInfo');
	var list = [];
	for (let url in all) {
		let info = all[url];
		if (!info || !info.embedding) continue;
		let dist = innerProductOfVectors(info.embedding, vector);
		console.log(info.title, dist, manhattanOfVectors(info.embedding, vector));
		if (dist <= 0) continue;
		info.dist = dist;
		info.url = url;
		list.push(info);
	}
	list.sort((a, b) => b.dist - a.dist);
	var titles = [];
	list = list.filter(item => {
		if (titles.includes(item.title)) return false;
		titles.push(item.title);
		return true;
	});
	return list;
};
EventHandler.GetConversation = async (url) => {
	url = parseURL(url);
	var conversation = AIHistory[url];
	if (!!conversation) return conversation;
	conversation = await DBs.pageInfo.get('pageConversation', url);
	if (!conversation) return null;
	return conversation.conversation;
};

/* AI */

const AIHandler = {};
const AIHistory = {};
const CacheLimit = 1000 * 60 * 60 * 24;

const removeAIChatHistory = async (tid) => {
	var list = Tab2Article[tid], tasks = [];
	if (!!list) {
		delete Tab2Article[tid];
		for (let url of list) {
			delete AIHistory[url];
			tasks.push(DBs.pageInfo.del('pageConversation', url));
		}
		await Promise.all(tasks);
	}

	tasks = [];
	const current = Date.now();
	list = await DBs.pageInfo.all('pageConversation');
	for (let url of all) {
		let item = all[url];
		if (current - item.timestamp >= CacheLimit) {
			tasks.push(DBs.pageInfo.del('pageConversation', url));
		}
	}
	await Promise.all(tasks);
};

AIHandler.sayHello = async () => {
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
AIHandler.summarizeArticle = async (data) => {
	myInfo.useLocalKV = true; // test

	var summary, embedding;
	try {
		summary = await callAIandWait('summarizeArticle', data.article);
	}
	catch (err) {
		showSystemNotification(err);
		return null;
	}

	data.summary = summary;
	try {
		embedding = await callAIandWait('embeddingArticle', data);
	}
	catch (err) {
		embedding = null;
		showSystemNotification(err);
	}

	return {summary, embedding};
};
AIHandler.askArticle = async (data, source, sid) => {
	var list = Tab2Article[sid], url = parseURL(data.url);
	if (!list) {
		list = [];
		Tab2Article[sid] = list;
	}
	list.push(url);

	list = AIHistory[url];
	if (!list) {
		list = await DBs.pageInfo.get('pageConversation', url);
		if (!list) {
			list = [];
			let prompt = PromptLib.assemble(PromptLib.askPageSystem, { content: data.content, lang: LangName[myInfo.lang] });
			list.push(['system', prompt]);
		}
		else {
			list = list.conversation;
		}
		AIHistory[url] = list;
	}
	list.push(['human', data.question]);

	try {
		let result = await callAIandWait('askArticle', list);
		list.push(['ai', result]);
		await DBs.pageInfo.set("pageConversation", url, {
			conversation: list,
			timestamp: Date.now()
		});
		return result;
	}
	catch (err) {
		console.error(err);
		return '';
	}
};

/* Utils */

const Tab2Article = {};
const getPageNeedAIInfo = async data => {
	var info = await Promise.all([
		DBs.pageInfo.get('notifyChecker', data.page),
		DBs.pageInfo.get('notifyChecker', data.path),
		DBs.pageInfo.get('notifyChecker', data.host),
	]);
	info = {
		page: info[0],
		path: info[1],
		host: info[2],
	};
	if (!info.page) info.page = {need: 0, visited: 0};
	if (!info.path) info.path = {need: 0, visited: 0};
	if (!info.host) info.host = {need: 0, visited: 0};
	return info;
};
const updatePageNeedAIInfo = async (data, info) => {
	await Promise.all([
		DBs.pageInfo.set('notifyChecker', data.page, info.page),
		DBs.pageInfo.set('notifyChecker', data.path, info.path),
		DBs.pageInfo.set('notifyChecker', data.host, info.host),
	]);
};
const manhattanOfVectors = (v1, v2) => {
	var len = Math.min(v1.length, v2.length);
	var total = 0;
	for (let i = 0; i < len; i ++) {
		total = Math.max(total, Math.abs(v1[i] - v2[i]));
	}
	return total;
};
const innerProductOfVectors = (v1, v2) => {
	var len = Math.min(v1.length, v2.length);
	var total = 0;
	for (let i = 0; i < len; i ++) {
		total += v1[i] * v2[i];
	}
	return total;
};
const initInjectScript = async () => {
	const USID = "CypriteInjection";

	var scripts = await chrome.userScripts.getScripts({ids: [USID]});
	if (scripts.length > 0) return;

	chrome.userScripts.configureWorld({ messaging: true });

	await chrome.userScripts.register([{
		id: USID,
		matches: ['*://*/*'],
		js: [{file: 'inject.js'}],
		world: "MAIN",
	}]);
};

/* Init */

initDB();
initWS();
// initInjectScript();

/* ------------ */

EventHandler.notify = (data, source, sid) => {
	var sourceName = 'Server';
	if (source === "BackEnd") sourceName = 'Background';
	else if (source === "FrontEnd") sourceName = 'Content';
	else if (source === "PageEnd") sourceName = 'Injection';
	if (!isString(data) && !isNumber(data) && !isBoolean(data)) data = JSON.stringify(data);
	logger.log(`Notify | ${sourceName}`, data);
};