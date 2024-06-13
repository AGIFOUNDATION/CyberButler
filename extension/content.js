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

var pageInfo = null;
const findContainer = () => {
	var container = null, size = 0;

	var ele = document.body.querySelector('article');
	if (!!ele) return ele;

	ele = document.body.querySelector('[id*="article"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[id*="Article"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	if (!!container) return container;

	ele = document.body.querySelector('[id*="container"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[id*="Container"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[id*="main"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[id*="Main"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[id*="page"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[id*="Page"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[id*="app"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[id*="App"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	if (!!container) return container;

	ele = document.body.querySelector('section');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('main');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="article"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="Article"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="container"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="Container"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="page"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="Page"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="main"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="Main"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="contain"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
	ele = document.body.querySelector('[class*="Contain"]');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}

	if (!container) container = document.body;
	return container;
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
window.addEventListener('focus', function() {
	sendMessage("VisibilityChanged", 'show', "BackEnd");
});
window.addEventListener('blur', function() {
	sendMessage("VisibilityChanged", 'hide', "BackEnd");
});
window.addEventListener('beforeunload', function() {
	sendMessage("VisibilityChanged", 'close', "BackEnd");
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