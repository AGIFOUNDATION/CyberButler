/* Communiation */

const postMessage = (event, data, target, tid) => {
	chrome.runtime.sendMessage({
		event, data, target, tid,
		sender: "PageEnd",
	});
};

chrome.runtime.onMessage.addListener((msg, sender) => {
	if (msg.target !== 'PageEnd') return;
	let handler = InsideEventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, 'ServerEnd');
});

/* EventHandler */

const InsideEventHandler = {};

InsideEventHandler.notify = (data, source) => {
	var sourceName = 'Server';
	if (source === "BackEnd") sourceName = 'Background';
	else if (source === "FrontEnd") sourceName = 'Content';
	else if (source === "PageEnd") sourceName = 'Injection';
	if (!isString(data) && !isNumber(data) && !isBoolean(data)) data = JSON.stringify(data);
	console.log(`[notify | ${sourceName}] ` + data);
};

postMessage('notify', "Aloha Kosmos!", "BackEnd");