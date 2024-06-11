const Notifications = {
	en: {
		title: "Cyprite Memory",
		saved: "Configuration has been saved.",
		wsConnectFailed: "Knowledge Vault connection failed, please confirm the knowledge vault address!",
		wsConnected: "Knowledge Vault connected",
		useEdgedVault: "Use Edged Knowledge Vault.",
	},
	zh: {
		title: "机灵记忆",
		saved: "配置已保存",
		wsConnectFailed: "知识库连接失败，请确认知识库地址！",
		wsConnected: "知识库连接成功",
		useEdgedVault: "使用边端知识库",
	},
};

var myName = '';
var myInfo = '';
var myLang = 'en';
var wsHost = '';
var apiKey = '';

const sendMessage = (event, data, target="BackEnd", tid) => {
	chrome.runtime.sendMessage({
		event, data, target, tid,
		sender: "ConfigPage"
	});
};

window.onload = async () => {
	Notification.init(false);

	var submitter = document.querySelector('.confirm button');
	var iptName = document.querySelector('input.myName');
	var iptInfo = document.querySelector('textarea.myInfo');
	var iptLang = document.querySelector('select.myLang');
	var iptVault = document.querySelector('input.myVault');
	var iptKey = document.querySelector('input.myKey');

	// Read config
	var [localInfo, remoteInfo] = await Promise.all([
		chrome.storage.local.get(['wsHost', 'apiKey']),
		chrome.storage.sync.get(['name', 'info', 'lang'])
	]);
	myName = remoteInfo.name || myName;
	myInfo = remoteInfo.info || myInfo;
	myLang = remoteInfo.lang || myLang;
	wsHost = localInfo.wsHost || '';
	apiKey = localInfo.apiKey || '';

	iptName.value = myName;
	iptInfo.value = myInfo;
	iptLang.value = myLang;
	iptVault.value = wsHost;
	iptKey.value = apiKey;

	submitter.addEventListener('click', async () => {
		myName = iptName.value || myName;
		myInfo = iptInfo.value || myInfo;
		myLang = iptLang.value || myLang;
		wsHost = iptVault.value || '';
		apiKey = iptKey.value || '';

		// Save config
		chrome.storage.sync.set({
			name: myName,
			info: myInfo,
			lang: myLang,
		});

		// Notify
		Notification.show(Notifications[myLang].title, Notifications[myLang].saved, 'rightBottom', 'success', 3000);

		// Send to BackEnd
		sendMessage('SetConfig', { myName, myInfo, myLang, wsHost, apiKey });
	});
};

const EventHandler = {};
EventHandler.connectWSHost = async (data) => {
	if (!data || !data.ok) {
		Notification.show(Notifications[myLang].title, Notifications[myLang].wsConnectFailed, 'rightBottom', 'fail', 5000);
	}
	else {
		await chrome.storage.local.set({ wsHost: data.wsHost, apiKey });
		if (!data.wsHost) {
			console.log('[WS] Use Edged Knowledge Vault.');
			Notification.show(Notifications[myLang].title, Notifications[myLang].useEdgedVault, 'rightBottom', 'warn', 5000);
		}
		else {
			console.log('[WS] Connect Knowledge Vault: ' + data.wsHost);
			Notification.show(Notifications[myLang].title, Notifications[myLang].wsConnected, 'rightBottom', 'success', 3000);
		}
	}
};

chrome.runtime.onMessage.addListener((msg, sender) => {
	if (msg.target !== 'ConfigPage') return;
	let handler = EventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, 'ServerEnd');
});