/* Communiation */

var port = chrome.runtime.connect({name: "cyberbutler_contentscript"});
var sendMessage = (event, data, target, tid) => {
	port.postMessage({
		event, data, target, tid,
		sender: "FrontEnd",
	});
};
port.onDisconnect.addListener(() => {
	console.log('[PORT] Disconnected and Reconnecting');
	port = chrome.runtime.connect({name: "cyberbutler_contentscript"});
});
port.onMessage.addListener((msg) => {
	console.log('[PORT] Got Message:', msg);
	if (msg.target !== 'FrontEnd') return;
	let handler = EventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, msg.source || 'ServerEnd');
});

/* Utils */

var pageInfo = null;
const findContainer = () => {
	var container = null, size = 0;

	var ele = document.body.querySelector('article');
	if (!!ele) {
		let s = ele.innerHTML.length;
		if (s > size) {
			container = ele;
			size = s;
		}
	}
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
const getPageTitle = (container) => {
	var pageTitle = document.title;
	var metaTitle1 = document.head.querySelector('[property$="title"]');
	var metaTitle2 = document.head.querySelector('[property^="title"]');
	var headerTitle1 = container.querySelector('h1');
	var headerTitle2 = container.querySelector('h2');
	var bodyTitle1 = container.querySelector('[property$="title"]');
	var bodyTitle2 = container.querySelector('[property^="title"]');
	var titleList = [];

	if (!!headerTitle1) titleList.push(headerTitle1.textContent.trim());
	else if (!!headerTitle2) titleList.push(headerTitle2.textContent.trim());
	if (!!bodyTitle2) titleList.push(bodyTitle2.textContent.trim());
	if (!!bodyTitle1) titleList.push(bodyTitle1.textContent.trim());
	if (!!metaTitle2) titleList.push(metaTitle2.content.trim());
	if (!!metaTitle1) titleList.push(metaTitle1.content.trim());
	if (!!pageTitle) titleList.push(pageTitle.trim());
	titleList = titleList.filter(t => !!t);
	return titleList[0] || '';
};
const getPageDesc = (container) => {
	var ele, desc;

	ele = document.head.querySelector('[name*="description"]');
	if (!!ele) {
		desc = ele.content.trim();
	}
	if (!desc) {
		ele = document.head.querySelector('[property*="description"]');
		if (!!ele) {
			desc = ele.content.trim();
		}
	}
	if (!!desc) return desc;

	desc = container.innerText;
	desc = desc.split(/\r*\n\r*/);
	desc = desc.map(line => {
		line = line.trim();
		if (line.match(/^[\w\.]+$/)) return '';
		return line;
	});
	desc = desc.filter(line => !!line);
	desc = desc.join('\n');

	return desc;
};
const getPageInfo = () => {
	var info = {};
	var container = findContainer();

	info.title = getPageTitle(container);
	info.description = getPageDesc(container);

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

	console.log('[Page] Analyze Page Type: ' + document.readyState);
	if (!pageInfo) {
		getPageInfo();
	}
	console.log(pageInfo);
};

/* Tab */

document.onreadystatechange = () => {
	pageInfo = null;
	getPageInfo();
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

/* Init */

sendMessage("ContentScriptLoaded", null, "BackEnd");