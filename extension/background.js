import "./script/common.js";

/* WebSocket */

const wsUrl = 'ws://localhost:8123';

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

const socket = new WebSocket(wsUrl);

socket.onopen = () => {
	console.log('[WS] Opened');
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
};
socket.sendMessage = (event, data, sender, sid) => {
	data = {event, data, sender, sid};
	data = JSON.stringify(data);
	socket.send(data);
};

/* Tabs */

var LastActiveTab = null;
chrome.tabs.onActivated.addListener(tab => {
	LastActiveTab = tab.tabId;
});
chrome.runtime.onMessage.addListener((msg, sender) => {
	var tid = sender.tab.id;
	msg.sid = tid;
	if (msg.inside) {
		msg.sender = 'PageEnd';
	}
	else {
		msg.sender = 'FrontEnd';
	}
	if (msg.tid === 'me') msg.tid = tid;
	dispatchEvent(msg);
});

/* EventHandler */

const EventHandler = {};
const dispatchEvent = async (msg) => {
	console.log('[SW] Got Event', msg);
	// 服务器端事件
	if (msg.target === 'ServerEnd') {
		socket.sendMessage(msg.event, msg.data, msg.sender, msg.sid);
	}
	// 页面端事件
	else if (msg.target === "PageEnd" || msg.target === "FrontEnd") {
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
		if (!handler) return;
		handler(msg.data, msg.sender, msg.sid, msg.target, msg.tid);
	}
};

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