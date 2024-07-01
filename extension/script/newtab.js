const PageName = 'HomeScreen';
const i18nList = ['en', 'zh'];
const TabList = [];
const myInfo = {};
const EventHandler = {};
const CallbackHandlers = {};
var AIModelList = null;
var currentMode = '';
var currentTabId = 0;
var running = false;

/* Communication */

const sendMessage = (event, data, target='BackEnd', tid) => {
	chrome.runtime.sendMessage({
		event,
		data,
		target,
		tid,
		sender: PageName,
		sid: currentTabId
	});
};
chrome.runtime.onMessage.addListener(msg => {
	if (!msg || msg.target !== PageName) return;

	var handler = EventHandler[msg.event];
	if (!handler) return;

	handler(msg.data, msg.sender, msg.sid);
});
// replyAskAndWait
const askSWandWait = (action, data) => new Promise(res => {
	var id = newID();
	while (!!CallbackHandlers[id]) {
		id = newID();
	}
	CallbackHandlers[id] = res;

	sendMessage('AskSWAndWait', {id, action, data});
});
const askAIandWait = (action, data) => new Promise(res => {
	var id = newID();
	while (!!CallbackHandlers[id]) {
		id = newID();
	}
	CallbackHandlers[id] = res;

	sendMessage('AskAIAndWait', {id, action, data});
});

/* UI */

const generateModelList = async () => {
	var localInfo = await chrome.storage.local.get(['apiKey', 'AImodel']);
	var model = localInfo.AImodel || '';
	var apiKey = localInfo.apiKey || {};

	ModelList.splice(0);
	ModelOrder.forEach(ai => {
		var key = apiKey[ai];
		if (!key) return;
		if (!!AI2Model[ai]) ModelList.push(...AI2Model[ai]);
	});

	AIModelList.innerHTML = '';
	ModelList.forEach(mdl => {
		var item = newEle('div', 'panel_model_item');
		item.innerText = mdl;
		item.setAttribute('name', mdl);
		if (mdl === model) {
			item.classList.add('current');
		}
		AIModelList.appendChild(item);
	});
};

/* Event */

const onChooseModel = async ({target}) => {
	if (!target.classList.contains("panel_model_item")) return;
	var model = target.getAttribute('name');
	chrome.storage.local.set({'AImodel': model});
	updateModelList(model);

	var messages = I18NMessages[myInfo.lang] || I18NMessages.en;
	Notification.show(messages.cypriteName, messages.mentions.changeModelSuccess, 'middleTop', 'success', 2 * 1000);
};
const onInputFinish = (inputter, sender, frame, container) => {
	var box = inputter.getBoundingClientRect();
	var height = box.height;
	sender.style.height = height + 'px';
	box = container.getBoundingClientRect();
	frame.style.height = (box.height - height - 10) + 'px';
	resizer = null;
};
EventHandler.replyAskAndWait = (data) => {
	var res = CallbackHandlers[data.id];
	if (!res) return;
	delete CallbackHandlers[data.id];
	res(data.result);
};

/* Utils */

const getConfig = async () => {
	var [localInfo, remoteInfo] = await Promise.all([
		chrome.storage.local.get(['wsHost', 'apiKey', 'AImodel']),
		chrome.storage.sync.get(['name', 'info', 'lang']),
	]);

	myInfo.name = remoteInfo.name || myInfo.name;
	myInfo.info = remoteInfo.info || myInfo.info;
	myInfo.lang = remoteInfo.lang;
	if (!myInfo.lang) {
		myInfo.lang = DefaultLang;
	}
	else {
		myInfo.lang = myInfo.lang.toLowerCase();
		if (!i18nList.includes(myInfo.lang)) myInfo.lang = DefaultLang;
	}
	myInfo.apiKey = localInfo.apiKey || {};
	myInfo.useLocalKV = !localInfo.wsHost;
	updateAIModelList();
	myInfo.model = localInfo.AImodel || myInfo.model || ModelList[0];
};
const parseParams = () => {
	var params = location.search.replace(/^\?*/, '');
	params = params.split('&');
	var info = {};
	params.forEach(line => {
		line = line.split('=');
		var name = line.shift();
		var value = line.join('=');
		if (!value) {
			value = true;
		}
		else {
			let v = value * 1;
			if (!isNaN(v)) value = v;
		}
		info[name] = value;
	});
	return info;
};
const updateAIModelList = () => {
	var available = false;
	ModelList.splice(0);

	for (let ai in myInfo.apiKey) {
		let key = myInfo.apiKey[ai];
		if (!key) continue;
		available = true;
		if (!!AI2Model[ai]) ModelList.push(...AI2Model[ai]);
	}
	myInfo.edgeAvailable = available;
};
const updateModelList = async (model) => {
	if (!model || !isString(model)) {
		let localInfo = await chrome.storage.local.get(['AImodel']);
		model = localInfo.AImodel || '';
	}

	[...AIModelList.querySelectorAll('.panel_model_item')].forEach(item => {
		var mdl = item.getAttribute('name');
		if (model === mdl) {
			item.classList.add('current');
		}
		else {
			item.classList.remove('current');
		}
	});
};
const changeTab = async (mode) => {
	[...document.body.querySelectorAll('[title], [group]')].forEach(item => item.classList.remove('active'));
	[...document.body.querySelectorAll('[title*="' + mode + '"], [group*="' + mode + '"]')].forEach(item => item.classList.add('active'));

	currentMode = mode;

	if (mode === 'crossPageConversation') {
		let list = await askSWandWait('GetAllPageInfo');
		console.log(list);
		ActionCenter.showArticleChooser();
	}
};
const addChatItem = (target, content, type) => {
	var container = document.body.querySelector('.panel_operation_area[group="' + target + '"] .content_container');

	var messages = I18NMessages[myInfo.lang] || I18NMessages.en;
	var item = newEle('div', 'chat_item'), isOther = false;

	var titleBar = newEle('div', "chat_title");
	if (type === 'human') {
		titleBar.innerText = messages.conversation.yourTalkPrompt;
		item.classList.add('human');
	}
	else if (type === 'cyprite') {
		titleBar.innerText = messages.cypriteName + ':';
		item.classList.add('ai');
	}
	else {
		isOther = true;
		titleBar.innerText = type;
		item.classList.add('other');
	}
	item.appendChild(titleBar);

	if (!!content) {
		let contentPad = newEle('div', "chat_content");
		contentPad.innerHTML = marked.parse(content, {breaks: true}) || messages.conversation.AIFailed;
		contentPad._data = content;
		item.appendChild(contentPad);
	}
	else {
		if (!isOther) return;
	}

	var operatorBar = newEle('div', 'operator_bar');
	operatorBar.innerHTML = '<img button="true" action="copyContent" src="../images/copy.svg">';
	item.appendChild(operatorBar);

	container.appendChild(item);
	wait(60).then(() => {
		container.scrollTop = container.scrollHeight - container.offsetHeight
	});
};
const clearHTML = (html, full=true, markList=false) => {
	var container = document.createElement('container');
	container.innerHTML = html;

	[...container.querySelectorAll('.cyprite, .extension_component')].forEach(item => {
		item.parentNode.removeChild(item);
	});
	if (full) {
		[...container.querySelectorAll('form, select, button, textarea, input, object, script, style, nostyle, noscript, link, video, audio')].forEach(item => {
			item.parentNode.removeChild(item);
		});
	}
	[...container.querySelectorAll('*')].forEach(item => {
		[...item.attributes].forEach(attr => {
			attr = attr.name;
			if (markList) {
				if (attr === 'href') return;
				if (attr === 'src') return;
			}
			item.removeAttribute(attr);
		});
	});

	if (markList) {
		[...container.querySelectorAll('ul > li')].forEach(li => {
			li.setAttribute('mark', '-');
		});
		[...container.querySelectorAll('ol > li')].forEach((li, i) => {
			li.setAttribute('mark', (i + 1) + '.');
		});
	}

	html = container.innerHTML;
	html = html.replace(/<!\-\-[\w\W]*?\-\->/gi, '');
	html = html.split(/\s*\n\s*/);
	html = html.map(line => line.trim()).filter(line => !!line);
	html = html.join('');

	var temp;
	while (html !== temp) {
		temp = html;
		html = html.replace(/([\w\d\-])>\s+<(\/?[\w\d\-])/gi, (m, a, b) => a + '><' + b);
	}

	return html.trim();
};
const getContent = (container, keepLink=false) => {
	var content = isString(container) ? container : container.innerHTML || '';
	if (!content) return;

	content = clearHTML(content, true, true);
	content = content.replace(/<(h\d)(\s+[\w\W]*?)?>([\w\W]*?)<\/\1>/gi, (m, tag, prop, inner) => {
		var lev = tag.match(/h(\d)/i);
		lev = lev[1] * 1;
		if (lev === 1) return '\n\n##\t' + inner + '\n\n';
		if (lev === 2) return '\n\n###\t' + inner + '\n\n';
		if (lev === 3) return '\n\n####\t' + inner + '\n\n';
		if (lev === 4) return '\n\n#####\t' + inner + '\n\n';
		if (lev === 5) return '\n\n######\t' + inner + '\n\n';
		return inner;
	});
	content = content.replace(/<\/?(article|header|section|aside|footer|div|p|center|ul|ol|tr)(\s+[\w\W]*?)?>/gi, '<br><br>');
	content = content.replace(/<\/?(option|span|font)(\s+[\w\W]*?)?>/gi, '');
	content = content.replace(/<\/(td|th)><\1(\s+[\w\W]*?)?>/gi, ' | ');
	content = content.replace(/<(td|th)(\s+[\w\W]*?)?>/gi, '| ');
	content = content.replace(/<\/(td|th)>/gi, ' |');
	content = content.replace(/<hr(\s+[\w\W]*?)?>/gi, '<br>----<br>');
	content = content.replace(/<li mark="([\w\W]+?)">/gi, (m, mark) => mark + '\t');
	content = content.replace(/<li(\s+[\w\W]*?)?>/gi, '-\t');
	content = content.replace(/<\/li>/gi, '\n');
	content = content.replace(/<\/?(b|strong)(\s+[\w\W]*?)?>/gi, '**');
	content = content.replace(/<\/?(i|em)(\s+[\w\W]*?)?>/gi, '*');
	if (!keepLink) {
		content = content.replace(/<\/?a(\s+[\w\W]*?)?>/gi, '');
	}
	else {
		let temp = '';
		while (content !== temp) {
			temp = content;
			content = content.replace(/<a(\s+[\w\W]*?)?>([\w\W]*?)<\/a>/gi, (m, prop, inner) => {
				var match = (prop || '').match(/href=('|")([\w\W]*?)\1/);
				if (!match) return inner;
				match = match[2];
				return '[' + inner + '](' + match + ')';
			});
		}
	}

	content = content.replace(/\s*<br>\s*/gi, '\n');
	content = content.replace(/<\/?([\w\-\_]+)(\s+[\w\W]*?)?>/gi, '');
	content = content.replace(/\r/g, '');
	content = content.replace(/\n\n+/g, '\n\n');
	content = content.trim();

	var parser = new DOMParser();
	var dom = parser.parseFromString(content, "text/html");
	content = dom.body.textContent;

	return content;
};
const onContentPaste = evt => {
	evt.preventDefault();

	var html = evt.clipboardData.getData('text/html');
	var text = evt.clipboardData.getData('text/plain') || evt.clipboardData.getData('text');

	var content;
	if (!!html) {
		content = getContent(html, true);
	}
	else {
		content = text;
	}
	if (!content) return;

	document.execCommand('insertText', false, content);
};

const ActionCenter = {};
ActionCenter.gotoConfig = () => {
	location.href = `./${myInfo.lang}/config.html`;
};
ActionCenter.clearConversation = () => {
	var messages = I18NMessages[myInfo.lang] || I18NMessages.en;
	if (running) {
		Notification.show(messages.cypriteName, messages.mentions.clearConversationWhileRunning, 'middleTop', 'warn', 2 * 1000);
		return;
	}

	var container = document.body.querySelector('.panel_operation_area[group="' + currentMode + '"]');
	var content = container.querySelector('.content_container');
	content.innerHTML = '';

	if (currentMode === 'crossPageConversation') {
		addChatItem('crossPageConversation', messages.newTab.crossPageConversationHint, 'cyprite');
	}
	else if (currentMode === 'instantTranslation') {
		addChatItem('instantTranslation', messages.translation.instantTranslateHint, 'cyprite');
	}
};
ActionCenter.showArticleChooser = () => {
	var container = document.body.querySelector('.panel_container');
	if (!container) return;
	container.setAttribute('showMask', "showArticleList");
	container.setAttribute('showArticleList', "true");
};
ActionCenter.hideFloatWindow = () => {
	var container = document.body.querySelector('.panel_container');
	if (!container) return;
	var target = container.getAttribute('showMask');
	if (!target) return;
	container.removeAttribute('showMask');
	container.removeAttribute(target);
};
ActionCenter.sendMessage = async (button) => {
	running = true;

	var messages = I18NMessages[myInfo.lang] || I18NMessages.en;
	var target = button.getAttribute('target');
	var inputter = button.parentNode.querySelector('.input_container');
	var sender = button.parentNode.querySelector('.input_sender');
	var frame = button.parentNode.querySelector('.content_container');
	var content = getContent(inputter, true);
	if (!content) return;
	addChatItem(target, content, 'human');

	inputter.innerText = messages.conversation.waitForAI;
	inputter.setAttribute('contenteditable', 'false');
	wait(60).then(() => {
		onInputFinish(inputter, sender, frame, button.parentNode);
	});

	var result;
	if (target === 'crossPageConversation') {
		let conversation = await chrome.storage.session.get(currentTabId + ':crosspageConv');
		conversation = (conversation || {})[currentTabId + ':crosspageConv'];
		// New conversation
		if (!conversation || !conversation.length) {

		}
		result = await askAIandWait('translateSentence', { lang, content });
	}
	else if (target === 'instantTranslation') {
		let lang = document.body.querySelector('[name="translation_language"]').value;
		result = await askAIandWait('translateSentence', { lang, content });
	}
	else {
		console.log(target);
		await wait(3000);
		result = '哇哈哈哈哈哈哈';
	}
	addChatItem(target, result, 'cyprite');

	inputter.innerText = '';
	inputter.setAttribute('contenteditable', 'true');

	inputter.focus();

	running = false;
};

const init = async () => {
	await getConfig();
	var messages = I18NMessages[myInfo.lang] || I18NMessages.en;

	AIModelList = document.body.querySelector('.panel_model_chooser');
	await generateModelList('');
	document.body.querySelector('input[name="translation_language"]').value = LangName[myInfo.lang];

	// I18N
	[...document.body.querySelectorAll('[title]')].forEach(item => {
		var title = item.getAttribute('title');
		item.innerText =  messages.newTab[title] || messages.buttons[title] || messages.mentions[title];
	});

	// Events
	AIModelList.addEventListener('click', onChooseModel);

	// Group Control
	[...document.body.querySelectorAll('.panel_tab[title]')].forEach(item => {
		var title = item.getAttribute('title');
		TabList.push(title);

		item.addEventListener('click', () => changeTab(title));
	});

	// Register Action
	[...document.body.querySelectorAll('[action]')].forEach(item => {
		var action = item.getAttribute('action');
		var handler = ActionCenter[action];
		if (!handler) return;
		item.addEventListener('click', () => {
			handler(item);
		});
	});

	// Conversation Area
	[...document.body.querySelectorAll('[type="conversationArea"]')].forEach(item => {
		var frame = item.querySelector('.content_container');
		var inputter = item.querySelector('[contenteditable="true"]');
		var sender = item.querySelector('.input_sender');
		var resizer;

		inputter.addEventListener('keyup', evt => {
			if (evt.ctrlKey && evt.key === 'Enter') {
				ActionCenter.sendMessage(sender);
			}
			if (!!resizer) return;
			resizer = setTimeout(() => {
				onInputFinish(inputter, sender, frame, item);
				resizer = null;
			}, 300);
		});
		inputter.addEventListener('paste', onContentPaste);
		frame.addEventListener('click', async ({target}) => {
			var action = target.getAttribute('action');
			if (action !== 'copyContent') return;
			var content = target.parentNode.parentNode.querySelector('.chat_content')._data;
			if (!content) content = getContent(target, true);
			await navigator.clipboard.writeText(content);
			var messages = I18NMessages[myInfo.lang] || I18NMessages.en;
			Notification.show(messages.cypriteName, messages.mentions.contentCopied, 'middleTop', 'success', 2 * 1000);
			inputter.focus();
		});
	});

	// Init
	addChatItem('crossPageConversation', messages.newTab.crossPageConversationHint, 'cyprite');
	addChatItem('instantTranslation', messages.translation.instantTranslateHint, 'cyprite');
	addChatItem('freelyConversation', 'Page is under construction...', 'cyprite'); // test

	var tab = await chrome.tabs.getCurrent();
	currentTabId = tab.id;
	var mode = await chrome.storage.session.get(currentTabId + ':mode');
	mode = mode[currentTabId + ':mode'];
	if (!TabList.includes(mode)) mode = TabList[0];
	mode = 'crossPageConversation'; // test
	changeTab(mode);
};

window.onload = init;