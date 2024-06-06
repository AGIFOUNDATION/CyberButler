const Notifications = {
	en: {
		title: "Cyprite Memory",
		saved: "Configuration has been saved.",
	},
	zh: {
		title: "机灵记忆",
		saved: "配置已保存",
	},
};

const sendMessage = (event, data, target="BackEnd", tid) => {
	chrome.runtime.sendMessage({
		event, data, target, tid,
		sender: "ConfigPage"
	});
};

window.onload = async () => {
	var submitter = document.querySelector('.confirm button');
	var iptName = document.querySelector('input.myName');
	var iptInfo = document.querySelector('textarea.myInfo');
	var iptLang = document.querySelector('select.myLang');
	var iptVault = document.querySelector('input.myVault');

	// Read config
	var [localInfo, remoteInfo] = await Promise.all([
		chrome.storage.local.get(['host']),
		chrome.storage.sync.get(['name', 'info', 'lang'])
	]);
	var myName = remoteInfo.name || '';
	var myInfo = remoteInfo.info || '';
	var myLang = remoteInfo.lang || 'en';
	var wsHost = localInfo.host || '';

	iptName.value = myName;
	iptInfo.value = myInfo;
	iptLang.value = myLang;
	iptVault.value = wsHost;

	submitter.addEventListener('click', async () => {
		myName = iptName.value || myName;
		myInfo = iptInfo.value || myInfo;
		myLang = iptLang.value || myLang;
		wsHost = iptVault.value || wsHost;

		// Save config
		chrome.storage.sync.set({
			name: myName,
			info: myInfo,
			lang: myLang,
		});

		// Notify
		chrome.notifications.create({
			title: Notifications[myLang].title,
			message: Notifications[myLang].saved,
			type: "basic",
			iconUrl: "/images/icon1024.png"
		});

		// Call BackEnd to Test and Set wsHost
		sendMessage('setWSHost', wsHost);
	});
};

const EventHandler = {};
EventHandler.connectWSHost = (data, source) => {
	console.log(`[WS] ` + data);
};

chrome.runtime.onMessage.addListener((msg, sender) => {
	if (msg.target !== 'ConfigPage') return;
	let handler = EventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, 'ServerEnd');
});
