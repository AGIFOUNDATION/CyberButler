const sendMessage = (event, data, target="BackEnd", tid) => {
	chrome.runtime.sendMessage({
		event, data, target, tid,
		sender: "PopupEnd"
	});
};

const displayMessage = (message) => {
	const messageContainer = document.querySelector('div.message-container');
	const newMessage = document.createElement('p');
	newMessage.textContent = message;
	messageContainer.appendChild(newMessage);
};

const EventHandler = {};
EventHandler.ClosePopup = () => {
	displayMessage('Close Window');
	window.close();
};

chrome.runtime.onMessage.addListener(msg => {
	displayMessage(JSON.stringify(msg));
	if (msg.target !== "PopupEnd") return;
	if (!msg.event) return;

	var handler = EventHandler[msg.event];
	if (!!handler) {
		handler(msg.data, msg.sender, msg.sid);
	}
	else {
		displayMessage(JSON.stringify(msg));
	}
});

sendMessage("OpenPopup");