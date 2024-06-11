import "./script/common.js";
import "./script/ai.js";
import "./script/prompts.js";

const i18nList = ['en', 'zh'];
const DefaultLang = "zh";

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

	var info = TabInfo[tid] || {
		active: false,
		duration: 0,
		open: -1,
	};
	if (info.active) {
		if (state === 'show') return;
	}
	else {
		if (state !== 'show') return;
	}
	TabInfo[tid] = info;

	var tab;
	try {
		tab = await chrome.tabs.get(tid);
	}
	catch {
		tab = null;
	}
	if (!tab) {
		delete TabInfo[tid];
		if (state === 'close') {
			tab = {};
		}
		else {
			return;
		}
	}
	var { title, url, active } = tab;

	var now = Date.now();
	if (state === 'show' || state === 'update' || state === 'active') {
		if (!active) {
			inactivePage(info, now);
		}
		else if (isPageForbidden(url)) {
			inactivePage(info, now, true);
		}
		else {
			if (url !== info.url) {
				inactivePage(info, now, true);
			}

			info.active = true;
			info.open = now;
			info.url = url;
			info.title = title;
		}
	}
	else if (state === 'hide' || state === 'idle') {
		inactivePage(info, now);
	}
	else if (state === 'close') {
		inactivePage(info, now, true);
	}
};
const inactivePage = (info, now, needCall=false) => {
	var shouldCall = !!info.url;
	if (info.open > 0) info.duration += now - info.open;
	else shouldCall = false;
	info.open = -1;
	info.active = false;
	if (!shouldCall) return;
	onPageDurationUpdated(needCall, info.url, info.duration, info.title);
};
const onPageDurationUpdated = (closed, url, duration, title) => {
	// return;
	console.log('>>>>>>>>>>>>>>>>', url, duration, closed);
	console.log(JSON.stringify(TabInfo, true, '\t'));
};
const TabInfo = {};

/* Tabs */

var LastActiveTab = null;
chrome.tabs.onActivated.addListener(tab => {
	if (!!LastActiveTab) onPageActivityChanged(LastActiveTab, "hide");
	LastActiveTab = tab.tabId;
	if (!!LastActiveTab) onPageActivityChanged(LastActiveTab, "show");
});
chrome.tabs.onUpdated.addListener(tabId => {
	if (!!LastActiveTab) onPageActivityChanged(tabId, "update");
});
chrome.tabs.onRemoved.addListener(async tabId => {
	if (LastActiveTab === tabId) LastActiveTab = null;
	await onPageActivityChanged(tabId, "close");
	delete TabInfo[tabId];
});
chrome.idle.onStateChanged.addListener((state) => {
	if (!LastActiveTab) return;
	if (state === 'idle') {
		onPageActivityChanged(LastActiveTab, "idle");
	}
	else {
		onPageActivityChanged(LastActiveTab, "active");
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
		console.log('[WS] Use Edged Knowledge Vault');

		let installed = await chrome.storage.local.get('installed');
		installed = installed.installed || false;
		if (!installed) return;
		myInfo.useLocalKV = !wsHost;
		sayHello();
	}
	else {
		console.log('[WS] Host: ' + wsHost);
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
		console.log('[WS] Opened');

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
			console.log('[WS] Initialized: ' + msg.data);
			return;
		}

		msg.sender = 'ServerEnd';
		dispatchEvent(msg);
	};
	socket.onerror = err => {
		console.error("[WS] Error:", err);
	};
	socket.onclose = () => {
		console.log("[WS] Close");
		if (socket === webSocket) webSocket = null;
		res(false);
	};
});

initWS();

/* EventHandler */

const EventHandler = {};
const dispatchEvent = async (msg) => {
	// 服务器端事件
	if (msg.target === 'ServerEnd') {
		console.log('[SW | Server] Got Event', msg);
		sendMessage(msg.event, msg.data, msg.sender, msg.sid);
	}
	// 页面端事件
	else if (msg.target === "PageEnd" || msg.target === "FrontEnd") {
		console.log('[SW | Front] Got Event', msg);
		// 发送给指定页面
		if (!!msg.tid) {
			chrome.tabs.sendMessage(msg.tid, msg);
		}
		// 发送给当前页面
		else if (!!LastActiveTab) {
			let tid = LastActiveTab;
			let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
			if (!!tab) {
				tid = tab.id;
			}
			if (!tid) return;
			chrome.tabs.sendMessage(tid, msg);
		}
	}
	// Background事件
	else {
		let handler = EventHandler[msg.event];
		if (!handler) return console.log('[SW | Service] Got Event', msg);

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
EventHandler.setConfig = async (data, source, sid) => {
	if (source !== 'ConfigPage') return;
	console.log('[WS] Set Host: ' + data.wsHost);

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
EventHandler.ContentScriptLoaded = (data, source, sid, target, tid) => {
	if (source !== 'FrontEnd') return;
	onPageActivityChanged(sid, "show");
	return;

	chrome.scripting.executeScript({
		target: { tabId: sid },
		files: [ "insider.js" ],
		injectImmediately: true,
	});
};
EventHandler.VisibilityChanged = (data, source, sid) => {
	if (source !== 'FrontEnd') return;
	onPageActivityChanged(sid, data);
};

/* ------------ */

EventHandler.notify = (data, source) => {
	var sourceName = 'Server';
	if (source === "BackEnd") sourceName = 'Background';
	else if (source === "FrontEnd") sourceName = 'Content';
	else if (source === "PageEnd") sourceName = 'Injection';
	if (!isString(data) && !isNumber(data) && !isBoolean(data)) data = JSON.stringify(data);
	console.log(`[Notify | ${sourceName}] ` + data);
};

/* AI */

const sayHello = async () => {
	var currentDate = timestmp2str('YYYY/MM/DD');
	console.log('Requred to say hello: ' + currentDate);

	var lastHello = await chrome.storage.session.get('lastHello');
	lastHello = lastHello.lastHello;
	if (!!lastHello && lastHello === currentDate) return;
	chrome.storage.session.set({lastHello: currentDate});

	myInfo.useLocalKV = true;

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