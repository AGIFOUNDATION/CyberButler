import "./script/common.js";

/* Management */

const i18nList = ['en', 'zh'];
const DefaultLang = "zh";
const configureCyberButler = async () => {
	var lang = await chrome.storage.sync.get('lang');
	if (!!lang) lang = lang.lang;
	if (!lang) {
		lang = DefaultLang;
	}
	else {
		lang = lang.toLowerCase();
		if (!i18nList.includes(lang)) lang = DefaultLang;
	}
	chrome.storage.sync.set({lang});

	var url = chrome.runtime.getURL(`pages/${lang}/config.html`);
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

/* Tabs */

var LastActiveTab = null;
chrome.tabs.onActivated.addListener(tab => {
	LastActiveTab = tab.tabId;
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
	var wsHost = await chrome.storage.local.get(['wsHost']);
	if (!!wsHost) wsHost = wsHost.wsHost;
	return wsHost;
};
const initWS = async () => {
	var wsHost = await getWSConfig();
	if (!wsHost) {
		console.log('[WS] Server address is not configured yet.');
		configureCyberButler();
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

	socket.onopen = () => {
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
		// 发送给当前页面
		if (!msg.tid) {
			let tid = LastActiveTab;
			let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
			if (!!tab) {
				tid = tab.id;
			}
			if (!tid) return;
			chrome.tabs.sendMessage(tid, msg);
		}
		// 发送给指定页面
		else {
			chrome.tabs.sendMessage(msg.tid, msg);
		}
	}
	// Background事件
	else {
		let handler = EventHandler[msg.event];
		if (!handler) return console.log('[SW | Service] Got Event', msg);

		handler(msg.data, msg.sender, msg.sid, msg.target, msg.tid);
	}
};

EventHandler.OpenPopup = async (data, source, sid, target, tid) => {
	if (source !== 'PopupEnd') return;

	var wsHost = await getWSConfig();
	if (!!wsHost) return;

	callPopup("ClosePopup");
	configureCyberButler();
};
EventHandler.setWSHost = async (data, source, sid, target, tid) => {
	if (source !== 'ConfigPage') return;
	console.log('[WS] Set Host: ' + data);

	if (!data) {
		sendMessage = DefaultSendMessage;
		chrome.tabs.sendMessage(sid, {
			event: "connectWSHost",
			data: {
				wsHost: data,
				ok: true,
			},
			target: source,
			sender: 'BackEnd',
		});
		return;
	}

	var done;
	try {
		done = await prepareWS(data);
	}
	catch (err) {
		console.error(err);
	}

	chrome.tabs.sendMessage(sid, {
		event: "connectWSHost",
		data: {
			wsHost: data,
			ok: done
		},
		target: source,
		sender: 'BackEnd',
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

EventHandler.notify = (data, source) => {
	var sourceName = 'Server';
	if (source === "BackEnd") sourceName = 'Background';
	else if (source === "FrontEnd") sourceName = 'Content';
	else if (source === "PageEnd") sourceName = 'Injection';
	if (!isString(data) && !isNumber(data) && !isBoolean(data)) data = JSON.stringify(data);
	console.log(`[Notify | ${sourceName}] ` + data);
};