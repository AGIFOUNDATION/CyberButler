const RegChar = /[\u4e00-\u9fa5]|[\w-]+|[\d\.]+/g;
const CypriteNotify = {};
const TagNameWeight = {
	ARTICLE: 5.0,
	POST: 3.0,
	SECTION: 2.0,
	CONTENT: 1.5,
	CONTAINER: 1.0,
	MAIN: 1.0,
	DIV: 0.1,
};
const TagClassWeight = {
	article: 3.0,
	post: 1.5,
	content: 1.0,
	notion: 0.5,
	page: 0.2,
	container: 0.1,
};
var myLang = "en";

/* Communiation */

var port;
var sendMessage = (event, data, target, tid) => {
	if (!port) {
		if (!chrome.runtime || !chrome.runtime.id) {
			logger.error('Runtime', 'Runtime cannot connect');
			return;
		}
		logger.info('Runtime', 'Runtime Reconnect');
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
	logger.info('PORT', 'Disconnected');
	port = null;
};
const onPortMessage = msg => {
	if (msg.target !== 'FrontEnd') return;
	let handler = EventHandler[msg.event];
	if (!handler) return;
	handler(msg.data, msg.source || 'ServerEnd');
};
chrome.runtime.onConnect.addListener(() => {
	logger.info('Runtime', 'HeartBeated');
});

/* Utils */

var pageInfo = null, notificationMounted = false, notificationMountingRes = [];
const findContainer = () => {
	/* Search for the main tag that records the content of the body text */
	var tagInfo = {}, contentTag, maxWeight = 0;
	var candidates = document.body.querySelectorAll('p, div, span');
	for (let ele of candidates) {
		let tag = ele.tagName;
		let info = tagInfo[tag] || {
			total: 0,
			value: 0,
		};
		let total = ele.innerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
		total = !!total ? total.length : 0;
		if (total > 0) {
			let size = ele.textContent.match(RegChar);
			size = !!size ? size.length : 0;
			info.total ++;
			info.value += size / total;
			tagInfo[tag] = info;
		}
	}
	for (let tag in tagInfo) {
		let info = tagInfo[tag];
		let weight = info.value / info.total;
		if (weight > maxWeight) {
			maxWeight = weight;
			contentTag = tag;
		}
		info.weight = weight;
		info.density = info.value / info.total;
	}

	/* Assign values to the main text node */
	candidates = document.body.querySelectorAll(contentTag);
	for (let ele of candidates) {
		var size = ele.textContent.match(RegChar);
		size = !!size ? size.length : 0;
		var total = ele.innerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
		total = !!total ? total.length : 0;
		ele._density = total > 0 ? size / total : 0;
		ele._tagWeight = calculateTagWeight(ele);
		ele._value = size * ele._tagWeight;
		ele._weight = size * ele._density;
	}

	/* Search for the most likely container that holds the main body content */
	candidates = document.body.querySelectorAll('article, section, div, main, container, app, post, content, entry');
	candidates = [...candidates];
	candidates = candidates.filter(ele => !!ele.textContent.trim().length);
	candidates.sort((a, b) => a.textContent.length - b.textContent.length);
	candidates = candidates.map(ele => {
		if (ele.tagName === contentTag) return;

		var size = ele.textContent.match(RegChar);
		size = !!size ? size.length : 0;
		var total = ele.innerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
		total = !!total ? total.length : 0;
		ele._density = total > 0 ? size / total : 0;

		var childValue = 0, childCount = 0;
		for (let n of ele.children) {
			childCount ++;
			childValue += n._weight || 1;
		}
		var nodeValue = 0, nodeCount = 0;
		for (let n of ele.querySelectorAll(contentTag)) {
			nodeCount ++;
			nodeValue += n._weight;
		}
		childCount ++;
		nodeCount ++;
		ele._tagWeight = calculateTagWeight(ele);
		ele._value = (childValue + nodeValue) * ele._tagWeight;
		ele._weight = (childValue + nodeValue * childCount / nodeCount) / 2 * ele._density;
		return ele;
	});

	// console.log('VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
	candidates.sort((a, b) => b._value - a._value);
	// candidates.splice(Math.min(Math.ceil(candidates.length / 3), 10));
	// candidates.forEach(ele => {
	// 	console.log(ele, ele._value, ele._weight, ele._tagWeight);
	// });
	target = candidates[0];
	// console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
	// console.log(target, target._value, target._weight);
	return target;
};
const calculateTagWeight = ele => {
	var weight = 1, has = false, maxWeight = 0;
	weight += TagNameWeight[ele.tagName] || 0;

	for (let id in TagClassWeight) {
		let name = ele.id;
		if (!name) continue;
		name = name.toLowerCase();
		if (name.indexOf(id) < 0) continue;
		let w = TagClassWeight[id];
		if (w > maxWeight) maxWeight = w;
		has = true;
	}
	weight += maxWeight;

	maxWeight = 0;
	for (let id in TagClassWeight) {
		let name = ele.className;
		if (!name) continue;
		name = name.toLowerCase();
		if (name.indexOf(id) < 0) continue;
		let w = TagClassWeight[id] / 2;
		if (w > maxWeight) maxWeight = w;
	}
	weight += maxWeight;

	return weight;
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
const checkIsArticle = (container) => {
	var total = document.body.textContent.match(RegChar);
	total = !!total ? total.length : 0;
	var content = 0;
	if (!!container && !!container.textContent) content = container.textContent.match(RegChar);
	content = !!content ? content.length : 0;
	var contentDensity = total === 0 ? 0 : content / total;

	var html = document.body.innerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
	html = !!html ? html.length : 0;
	var pageDensity = html === 0 ? 0 : total / html;

	html = 0;
	if (!!container && !!container.innerHTML) html = container.innerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
	html = !!html ? html.length : 0;
	var innerDensity = html === 0 ? 0 : content / html;

	logger.em    ('Article', 'Size   :', content, total, html);
	logger.strong('Article', 'Density:', contentDensity, pageDensity, innerDensity);
	var weight = contentDensity * 1.2 + pageDensity * 0.8 + (innerDensity / pageDensity / 0.9);
	weight *= content / (400 + content);
	logger.blank ('Article', 'Check  :', content > 500, contentDensity > 0.8, pageDensity > 0.3, innerDensity > pageDensity * 0.9, weight);
	return weight > 1.5;
};
const getPageTitle = (container) => {
	// Locate the content container position
	var html = document.body.innerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>');
	var content = container.outerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>');
	var poses = [];
	html.replace(content, (m, pos) => {
		poses.push([pos, pos + content.length]);
	});
	
	// Find out all title candidates
	var candidates = document.querySelectorAll('header, h1, h2, [id*="title"], [name*="title"], [property*="title"]');
	candidates = [...candidates];

	// Calculate the distance between title candidate container and the content container
	candidates = candidates.map(ele => {
		if (!ele.outerHTML) return;
		if (!ele.textContent || !ele.textContent.trim()) return;

		var ctx = ele.outerHTML.replace(/<([\w\-]+)[\w\W]*?>/g, (m, tag) => '<' + tag + '>');
		var delta = [];
		html.replace(ctx, (m, p) => {
			// Calculate the distance
			poses.forEach(block => {
				if (p < block[0]) {
					delta.push(block[0] - p - ctx.length);
				}
				else if (p < block[1]) {
					delta.push(p - block[0]);
				}
			});
		});
		delta = delta.filter(d => d > 0);
		if (delta.length === 0) return;

		// The final distance
		delta.sort((a, b) => a - b);
		return [ele, delta[0]];
	}).filter(ele => !!ele);

	// Return page title if no suitable title container
	if (candidates.length === 0) return document.title.trim();

	candidates.sort((a, b) => a[1] - b[1]);
	var titleContainer = candidates[0][0];

	// Find out the inner container
	candidates = [[], [], []];
	for (let node of titleContainer.childNodes) {
		let t = node.textContent || node.content || '';
		t = t.trim();
		if (!!t) {
			let nodeName = node.nodeName, className = (node.className || '').toLowerCase(), id = (node.id || '').toLowerCase();
			if (['TITLE', "H1"].includes(nodeName)) {
				candidates[0].push(t);
			}
			else if (id.indexOf('title') >= 0) {
				candidates[0].push(t);
			}
			else if (['H2'].includes(nodeName)) {
				candidates[1].push(t);
			}
			else if (className.indexOf('title') >= 0) {
				candidates[1].push(t);
			}
			else if (['DIV', 'P'].includes(nodeName)) {
				candidates[1].push(t);
			}
		}
	}
	if (candidates[0].length > 0) return candidates[0].join(' ');
	else if (candidates[1].length > 0) return candidates[1][0];
	else if (candidates[2].length > 0) return candidates[2][0];
	else return titleContainer.textContent.trim();
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
		var match = line.match(RegChar);
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
	logger.log('Page', 'Parse Page Content Stage 1: ' + (time2 - time1) + 'ms');
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
	logger.log('Page', 'Parse Page Content Stage 2: ' + (time2 - time1) + 'ms');
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
	logger.log('Page', 'Parse Page Content Stage 3: ' + (time2 - time1) + 'ms');
	time1 = time2;

	content = content.replace(/\s*<br>\s*/gi, '\n');
	content = content.replace(/<\/?([\w\-\_]+)[\w\W]*?>/gi, '');
	content = content.replace(/\r/g, '');
	content = content.replace(/\n\n+/g, '\n\n');
	content = content.trim();
	time2 = Date.now();
	logger.log('Page', 'Parse Page Content Stage 4: ' + (time2 - time1) + 'ms');

	return content;
};
const getPageInfo = () => {
	console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
	var info = {};
	var container = findContainer();
	console.log(container);
	info.isArticle = checkIsArticle(container);
	if (info.isArticle) {
		info.title = getPageTitle(container);
	}
	else {
		info.title = document.title.trim();
	}

	var isBody = container === document.body;
	container = getCleanContainer(container);

	var [content, size] = getPageShotContent(container);
	info.description = getPageDescription(isBody, content);
	console.log(info);
	info.isArticle = false;

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
	logger.log(`Notify | ${sourceName}`, data);
};
EventHandler.getPageInfo = (data, source) => {
	if (source !== 'BackEnd') return;

	logger.log('Page', 'Analyze Page Info: ' + document.readyState);
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
	if (!!CypriteNotify.RequestOperation) return;
	// if (!!CypriteNotify.RequestOperation) CypriteNotify.RequestOperation._hide();
	var notify = Notification.show(messages.cypriteName, messages.newArticleMentionMessage, 'rightTop', 'message', 20 * 1000);
	var userAction = false;
	const onClick = async evt => {
		if (evt.target.tagName !== 'BUTTON') return;
		var name = evt.target.name;
		if (name === 'summarize') {
			await summarizePage();
			userAction = true;
		}
		else if (name === 'translate') {
			await translatePage();
			userAction = true;
		}
		notify._hide();
	};
	notify.addEventListener('click', onClick);
	notify.onclose = () => {
		console.log('>>>>>>>>>>>>> User Action: ' + userAction);
		notify.removeEventListener('click', onClick);
		notify.onclose = null;
		CypriteNotify.RequestOperation = null;
	};
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
	logger.log('DOC', 'Ready State Changed: ' + document.readyState);
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
document.addEventListener('visibilitychange', () => {
	if (document.hidden) {
		sendMessage("VisibilityChanged", 'hide', "BackEnd");
	}
	else {
		sendMessage("VisibilityChanged", 'show', "BackEnd");
	}
});
window.addEventListener('unload', () => {
	sendMessage("VisibilityChanged", 'close', "BackEnd");
});
window.addEventListener('idle', () => {
	sendMessage("VisibilityChanged", 'idle', "BackEnd");
});
window.addEventListener('load', () => {
	logger.log('WIN', 'Loaded');
});

var timerMutationObserver;
const observer = new MutationObserver(() => {
	if (!!timerMutationObserver) {
		clearTimeout(timerMutationObserver);
	}
	timerMutationObserver = setTimeout(() => {
		logger.log('DOC', 'Mutation Observered');
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