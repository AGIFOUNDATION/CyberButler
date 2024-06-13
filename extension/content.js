var myLang = "en";
const CypriteNotify = {};

/* Communiation */

var port;
var sendMessage = (event, data, target, tid) => {
	if (!port) {
		port = chrome.runtime.connect({name: "cyberbutler_contentscript"});
		port.onDisconnect.addListener(onPortDisconnect);
		port.onMessage.addListener(onPortMessage);
	}

	port.postMessage({
		event, data, target, tid,
		sender: "FrontEnd",
	});
};
const onPortDisconnect = () => {
	port = null;
	console.log('[PORT] Disconnected and Reconnecting');
};
const onPortMessage = msg => {
	if (msg.target !== 'FrontEnd') return;
	let handler = EventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, msg.source || 'ServerEnd');
};

/* Utils */

var pageInfo = null, notificationMounted = false, notificationMountingRes = [];
const findContainer = () => {
	console.log('vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv');
	var candidates = document.body.querySelectorAll('article, section, div, main, container, app, post, content, entry');
	var maxWeight = 0, target = document.body;
	for (let ele of candidates) {
		let size = ele.textContent.match(/[\u4e00-\u9fa5]|[\w-]+|[\d\.]+/g);
		size = !!size ? size.length : 0;
		let density = ele.innerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>').match(/[\u4e00-\u9fa5]|[\w-]+|[\d\.]+/g);
		density = !!density ? density.length : 0;
		density = density > 0 ? size / density : 0;
		let weight = size * (density ** 1.5);
		if (weight > maxWeight) {
			maxWeight = weight;
			target = ele;
		}
	}
	console.log(maxWeight);
	console.log(target);
	return target;
};
const removeChildren = (container, tag) => {
	var list = container.querySelectorAll(tag);
	for (let ele of list) {
		let upper = ele.parentNode;
		upper.removeChild(ele);
	}
};
const getCleanContainer = container => {
	var frame = document.createDocumentFragment(), shadow = document.createElement('container');
	shadow.innerHTML = container.innerHTML;
	frame.appendChild(shadow);
	removeChildren(frame, 'noscript');
	removeChildren(frame, 'script');
	removeChildren(frame, 'style');
	removeChildren(frame, 'form');
	removeChildren(frame, 'select');
	removeChildren(frame, 'input');
	removeChildren(frame, 'textarea');
	removeChildren(frame, 'ol');
	removeChildren(frame, 'ul');
	removeChildren(frame, 'button');
	removeChildren(frame, 'img');
	removeChildren(frame, 'image');
	removeChildren(frame, 'picture');
	removeChildren(frame, 'audio');
	removeChildren(frame, 'video');
	removeChildren(frame, 'object');
	removeChildren(frame, 'aside');
	removeChildren(frame, 'footer');

	return shadow;
};
const getPageTitle = (isBody, container) => {
	var ele, title;
	if (isBody) {
		ele = document.head.querySelector('[property*="title"]');
		if (!!ele) {
			title = ele.content.trim();
			if (!!title) return title;
		}
		ele = container.querySelector('[id*="title"]');
		if (!!ele) {
			title = ele.textContent.trim();
			if (!!title) return title;
		}
		ele = container.querySelector('[name*="title"]');
		if (!!ele) {
			title = ele.textContent.trim();
			if (!!title) return title;
		}
	}
	else {
		ele = container.querySelector('header[class*="title"]');
		if (!!ele) {
			title = ele.textContent.trim();
			if (!!title) return title;
		}
		ele = container.querySelector('h1');
		if (!!ele) {
			title = ele.textContent.trim();
			if (!!title) return title;
		}
		ele = container.querySelector('h2');
		if (!!ele) {
			title = ele.textContent.trim();
			if (!!title) return title;
		}
		ele = container.querySelector('[id*="title"]');
		if (!!ele) {
			title = ele.textContent.trim();
			if (!!title) return title;
		}
		ele = container.querySelector('[name*="title"]');
		if (!!ele) {
			title = ele.textContent.trim();
			if (!!title) return title;
		}
		ele = document.head.querySelector('[property*="title"]');
		if (!!ele) {
			title = ele.content.trim();
			if (!!title) return title;
		}
	}
	return document.title.trim();
};
const getPageDescription = (isBody, content) => {
	var desc;

	if (isBody) {
		let ele = document.head.querySelector('[name*="description"]');
		if (!!ele) {
			desc = ele.content.trim();
			if (!!desc) return desc;
		}
		ele = document.head.querySelector('[property*="description"]');
		if (!!ele) {
			desc = ele.content.trim();
			if (!!desc) return desc;
		}
	}

	if (content.length === 1) {
		desc = content[0];
		if (desc.length >= 302) {
			let bra = desc.substr(0, 150), ket = desc.substr(desc.length - 150);
			desc = bra + '...' + ket;
		}
	}
	else {
		desc = content.map(line => {
			if (line.length < 52) return line;
			var bra = line.substr(0, 25), ket = line.substr(line.length - 25);
			return bra + '...' + ket;
		}).join('\n');
	}

	return desc;
};
const getPageShotContent = container => {
	var desc = container.innerText, list = [], count = 0;
	desc = desc.replace(/(\r*\n\r*)/g, '\n');
	desc = desc.replace(/\n\n+/g, '\n');
	desc = desc.replace(/  +/g, ' ');
	desc = desc.split(/\n+/);
	desc.forEach(line => {
		line = line.replace(/\s+/g, ' ');
		line = line.trim();
		if (line.match(/^[\w\.]+$/)) return;
		var match = line.match(/[\u4e00-\u9fa5]|[\w-]+/g);
		if (!match) return;
		if (match.length < 10) return;
		count += match.length;
		list.push(line);
	});

	return [list, count];
};
const getPageContent = async container => {
	var content = container.innerHTML, time1 = Date.now(), time2;

	var temp;
	while (content !== temp) {
		temp = content;
		content = content.replace(/(\w+)>[\s\n\r]+<(\/?\w+)/gi, (m, a, b) => a + '><' + b);
		content = content.trim();
		await wait();
	}
	time2 = Date.now();
	console.log('[Page] Parse Page Content Stage 1: ' + (time2 - time1) + 'ms');
	time1 = time2;

	content = content.replace(/<form[\w\W]*?>[\w\W]*?<\/form>/gi, '');
	content = content.replace(/<select[\w\W]*?>[\w\W]*?<\/select>/gi, '');
	content = content.replace(/<object[\w\W]*?>[\w\W]*?<\/object>/gi, '');
	content = content.replace(/<script[\w\W]*?>[\w\W]*?<\/script>/gi, '');
	content = content.replace(/<style[\w\W]*?>[\w\W]*?<\/style>/gi, '');
	content = content.replace(/<nostyle[\w\W]*?>[\w\W]*?<\/nostyle>/gi, '');
	content = content.replace(/<textarea[\w\W]*?>[\w\W]*?<\/textarea>/gi, '');
	content = content.replace(/<button[\w\W]*?>[\w\W]*?<\/button>/gi, '');
	content = content.replace(/<input[\w\W]*?>/gi, '');
	content = content.replace(/<link[\w\W]*?>/gi, '');

	content = content.replace(/<\/?(article|header|section|aside|footer|div|p|ul|ol|tr)[\w\W]*?>/gi, '<br><br>');
	content = content.replace(/<\/?(option|span|font)[\w\W]*?>/gi, '');
	content = content.replace(/<\/(td|th)><\1[\w\W]*?>/gi, ' | ');
	content = content.replace(/<(td|th)[\w\W]*?>/gi, '| ');
	content = content.replace(/<\/(td|th)>/gi, ' |');
	content = content.replace(/<hr[\w\W]*?>/gi, '<br>----<br>');
	content = content.replace(/<li[\w\W]*?>/gi, '-\t');
	content = content.replace(/<\/li>/gi, '\n');
	content = content.replace(/<(h\d)[\w\W]*?>([\w\W]*?)<\/\1>/gi, (m, tag, inner) => {
		var lev = tag.match(/h(\d)/i);
		lev = lev[1] * 1;
		if (lev === 1) return '\n\n#\t' + inner + '\n\n';
		if (lev === 2) return '\n\n##\t' + inner + '\n\n';
		if (lev === 3) return '\n\n###\t' + inner + '\n\n';
		if (lev === 4) return '\n\n####\t' + inner + '\n\n';
		if (lev === 5) return '\n\n#####\t' + inner + '\n\n';
		return inner;
	});
	time2 = Date.now();
	console.log('[Page] Parse Page Content Stage 2: ' + (time2 - time1) + 'ms');
	time1 = time2;

	temp = '';
	while (content !== temp) {
		temp = content;
		content = content.replace(/<(b|strong)[\w\W]*?>([\w\W]*?)<\/\1>/gi, (m, tag, inner) => {
			return '**' + inner + '**';
		});
		content = content.replace(/<(i|em)[\w\W]*?>([\w\W]*?)<\/\1>/gi, (m, tag, inner) => {
			return '*' + inner + '*';
		});
		content = content.replace(/<a\s+([\w\W]*?)>([\w\W]*?)<\/a>/gi, (m, prop, inner) => {
			var match = prop.match(/href=('|")([\w\W]*?)\1/);
			if (!match) return inner;
			match = match[2];
			return '[' + inner + '](' + match + ')';
		});
		await wait();
	}
	time2 = Date.now();
	console.log('[Page] Parse Page Content Stage 3: ' + (time2 - time1) + 'ms');
	time1 = time2;

	content = content.replace(/\s*<br>\s*/gi, '\n');
	content = content.replace(/<\/?([\w\-\_]+)[\w\W]*?>/gi, '');
	content = content.replace(/\r/g, '');
	content = content.replace(/\n\n+/g, '\n\n');
	content = content.trim();
	time2 = Date.now();
	console.log('[Page] Parse Page Content Stage 4: ' + (time2 - time1) + 'ms');

	return content;
};
const getPageInfo = () => {
	var info = {};
	var container = findContainer();
	var isBody = container === document.body;
	container = getCleanContainer(container);

	info.title = getPageTitle(isBody, container);
	var [content, size] = getPageShotContent(container);
	info.description = getPageDescription(isBody, content);
	info.isArticle = !isBody && size > 50;

	pageInfo = info;
};
const waitForMountNotification = () => new Promise(res => {
	if (notificationMounted) return res();
	notificationMountingRes.push(res);
	sendMessage("MountNotification", null, 'BackEnd');
});
const summarizePage = async () => {
	var article = await getPageContent(findContainer());
	var messages = I18NMessages[myLang] || I18NMessages.len;
	CypriteNotify.summary = Notification.show(messages.cypriteName, messages.summarizingPage, 'rightTop', 'message', 24 * 3600 * 1000);
	sendMessage("SummarizePage", article, "BackEnd");
};
const translatePage = async () => {
	var article = await getPageContent(findContainer());
	console.log(article);
};

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
EventHandler.getPageInfo = (data, source) => {
	if (source !== 'BackEnd') return;

	console.log('[Page] Analyze Page Info: ' + document.readyState);
	if (!pageInfo) {
		getPageInfo();
	}

	sendMessage('GotPageInfo', pageInfo, 'BackEnd');
};
EventHandler.notificationMounted = () => {
	if (!notificationMountingRes) return;
	notificationMounted = true;
	var list = notificationMountingRes;
	notificationMountingRes = null;
	list.forEach(res => res());
};
EventHandler.requestCypriteNotify = async (data, source, sid) => {
	var [lang] = await Promise.all([
		chrome.storage.sync.get('lang'),
		waitForMountNotification()
	]);
	lang = lang.lang || myLang;
	myLang = lang;

	var messages = I18NMessages[lang] || I18NMessages.len;
	if (!!CypriteNotify.RequestOperation) CypriteNotify.RequestOperation._hide();
	var notify = Notification.show(messages.cypriteName, messages.newArticleMentionMessage, 'rightTop', 'message', 20 * 1000);
	notify.addEventListener('click', async evt => {
		if (evt.target.tagName !== 'BUTTON') return;
		var name = evt.target.name;
		if (name === 'summarize') {
			await summarizePage();
		}
		else if (name === 'translate') {
			await translatePage();
		}
		notify._hide();
	});
	CypriteNotify.RequestOperation = notify;
};
EventHandler.pageSummarized = async (data) => {
	if (!!CypriteNotify.summary) CypriteNotify.summary._hide();
	CypriteNotify.summary = null;

	var messages = I18NMessages[myLang] || I18NMessages.len;
	if (!!data) {
		let notify = Notification.show(messages.cypriteName, messages.summarizeSuccess, 'rightTop', 'success', 10 * 1000);
		notify.addEventListener('click', evt => {
			if (evt.target.tagName !== 'BUTTON') return;
			var name = evt.target.name;
			if (name === 'viewnow') {
				console.log(data);
			}
			notify._hide();
		});
	}
	else {
		Notification.show(messages.cypriteName, messages.summarizeFailed, 'rightTop', 'fail', 5 * 1000);
	}
};

/* Tab */

document.onreadystatechange = () => {
	pageInfo = null;
	getPageInfo();
	if (document.readyState === 'complete') {
		sendMessage("PageStateChanged", {
			state: 'loaded',
			url: location.href,
			pageInfo
		}, "BackEnd");
	}
};
document.addEventListener('visibilitychange', function() {
	if (document.hidden) {
		sendMessage("VisibilityChanged", 'hide', "BackEnd");
	}
	else {
		sendMessage("VisibilityChanged", 'show', "BackEnd");
	}
});
window.addEventListener('unload', function() {
	sendMessage("VisibilityChanged", 'close', "BackEnd");
});
window.addEventListener('idle', function() {
	sendMessage("VisibilityChanged", 'idle', "BackEnd");
});

var timerMutationObserver;
const observer = new MutationObserver(() => {
	if (!!timerMutationObserver) {
		clearTimeout(timerMutationObserver);
	}
	timerMutationObserver = setTimeout(() => {
		pageInfo = null;
		getPageInfo();
		sendMessage("PageStateChanged", {
			state: 'update',
			url: location.href,
			pageInfo
		}, "BackEnd");
	}, 1000);
});
observer.observe(document.body, {
	childList: true,
	subtree: true
});

/* Init */

sendMessage("PageStateChanged", {
	state: 'open',
	url: location.href
}, "BackEnd");