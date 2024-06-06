const displayMessage = (message) => {
	const messageContainer = document.getElementById('message-container');
	const newMessage = document.createElement('p');
	newMessage.textContent = message;
	messageContainer.appendChild(newMessage);
};

const port = chrome.runtime.connect({ name: 'popup' });
port.onMessage.addListener(message => {
	if (message.type === 'connected') {
		// WebSocket 连接成功
		console.log('Connected to WebSocket server!');
	}
	else if (message.type === 'message') {
		// 收到来自 WebSocket 的信息
		displayMessage(message.data);
	}
	else if (message.type === 'error') {
		// WebSocket 连接错误
		console.error('WebSocket connection error:', message.data);
	}
	else if (message.type === 'closed') {
		// WebSocket 连接关闭
		console.log('WebSocket connection closed!');
	}
});
port.postMessage({ type: 'connect' });