/* Communiation */

const sendMessage = (event, data, target, tid) => {
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

/* Init */

sendMessage("ContentScriptLoaded", null, "BackEnd");