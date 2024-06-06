const { WebSocket, WebSocketServer } = require('ws');
const { newID, isString } = require('./utils/common.js');

const PORT = 8123;

WebSocket.prototype._send = WebSocket.prototype.send;
WebSocket.prototype.send = function (event, target, tid, data, options, cb) {
	target = target || 'BackEnd';
	data = { event, target, tid, data };
	if (!isString(data)) {
		if (data === null || data === undefined) data = "";
		else data = JSON.stringify(data);
	}
	this._send(data, options, cb);
};

const server = new WebSocketServer({
	port: PORT,
	perMessageDeflate: {
		zlibDeflateOptions: {
			chunkSize: 1024,
			memLevel: 7,
			level: 3
		},
		zlibInflateOptions: {
			chunkSize: 10 * 1024
		},
		// Other options settable:
		clientNoContextTakeover: true, // Defaults to negotiated value.
		serverNoContextTakeover: true, // Defaults to negotiated value.
		serverMaxWindowBits: 10, // Defaults to negotiated value.
		// Below options specified as default values.
		concurrencyLimit: 10, // Limits zlib concurrency for perf.
		threshold: 1024 // Size (in bytes) below which messages
	}
});
const sockets = new Map();

server.on('connection', socket => {
	const wid = newID();
	console.log('[WS] Client Connected: ' + wid);
	sockets.set(wid, socket);

	socket.on('message', (msg) => {
		msg = msg.toString();
		msg = JSON.parse(msg);
		if (!msg.event) return;
		console.log('[WS] Got Event: ' + msg.event);

		var handler = EventHandler[msg.event];
		if (!handler) return;
		handler(msg.data, msg.sender, msg.sid, wid);
	});
	socket.on('close', () => {
		console.log('[WS] Client disconnected: ' + wid);
		sockets.delete(wid);
	});
	socket.on('error', console.error);

	socket.send('initial', "BackEnd", null, wid);
});

console.log(`[WS] WebSocket running at http://localhost:${PORT}`);

const sendToFront = (wid, event, data, target, tid) => {
	var socket = sockets.get(wid);
	if (!socket) return;
	socket.send(event, target, tid, data);
};

/* Event Handler */

global.EventHandler = {};

EventHandler.Notify = (msg, sender, sid, wid) => {
	console.log(`[MSG | ${sender}:${sid}] ${msg}`);
	sendToFront(wid, 'notify', 'Got Your Message!', sender, sid);
};