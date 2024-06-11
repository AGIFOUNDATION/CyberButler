/* Communiation */

var sendMessage = (event, data, target, tid) => {
	chrome.runtime.sendMessage({
		event, data, target, tid,
		sender: "FrontEnd",
	});
};

chrome.runtime.onMessage.addListener((msg, sender) => {
	if (msg.target !== 'FrontEnd') return;
	let handler = EventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, 'ServerEnd');
});
chrome.runtime.connect().onDisconnect.addListener(() => {
	sendMessage = () => {};
});

/* EventHandler */

const EventHandler = {};

EventHandler.notify = (data, source) => {
	var sourceName = 'Server';
	if (source === "BackEnd") sourceName = 'Background';
	else if (source === "FrontEnd") sourceName = 'Content';
	else if (source === "PageEnd") sourceName = 'Injection';
	if (!isString(data) && !isNumber(data) && !isBoolean(data)) data = JSON.stringify(data);
	console.log(`[Notify | ${sourceName}] ` + data);
};

/* Tab */

document.addEventListener('visibilitychange', function() {
	if (document.hidden) {
		sendMessage("VisibilityChanged", 'hide', "BackEnd");
	}
	else {
		sendMessage("VisibilityChanged", 'show', "BackEnd");
	}
});
window.addEventListener('focus', function() {
	sendMessage("VisibilityChanged", 'show', "BackEnd");
});
window.addEventListener('blur', function() {
	sendMessage("VisibilityChanged", 'hide', "BackEnd");
});
window.addEventListener('beforeunload', function() {
	sendMessage("VisibilityChanged", 'close', "BackEnd");
});
window.addEventListener('unload', function() {
	sendMessage("VisibilityChanged", 'close', "BackEnd");
});
window.addEventListener('idle', function() {
	sendMessage("VisibilityChanged", 'idle', "BackEnd");
});

/* Init */

sendMessage("ContentScriptLoaded", null, "BackEnd");