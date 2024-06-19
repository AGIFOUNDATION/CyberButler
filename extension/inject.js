const CypriteEventHandler = {};

const sendMessageToCyprite = (event, data, target, tid) => {
	window.postMessage({
		extension: "CypriteTheCyberButler",
		type: "P2F",
		data: {event, data, target, tid, sender: "PageEnd"}
	});
};
window.addEventListener('message', ({data}) => {
	var extension = data.extension, type = data.type;
	if (extension !== 'CypriteTheCyberButler') return;
	if (type !== 'F2P') return;

	var msg = data.data;
	var handler = CypriteEventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, msg.sender || 'FrontEnd', msg.sid);
});