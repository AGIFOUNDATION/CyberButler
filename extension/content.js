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
var myLang = DefaultLang;
chrome.storage.sync.onChanged.addListener(evt => {
	var lang = evt.lang;
	if (!lang) return;
	myLang = lang.newValue;
});
chrome.storage.sync.get('lang', (item) => {
	myLang = item.lang || myLang;
});

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

var pageInfo = null;
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
		let total = ele.innerHTML.replace(/<([\w\-]+)(\s+[\w\W]*?)?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
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
		var total = ele.innerHTML.replace(/<([\w\-]+)(\s+[\w\W]*?)?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
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
		var total = ele.innerHTML.replace(/<([\w\-]+)(\s+[\w\W]*?)?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
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

	candidates.sort((a, b) => b._value - a._value);
	target = candidates[0];
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

	var html = document.body.innerHTML.replace(/<([\w\-]+)(\s+[\w\W]*?)?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
	html = !!html ? html.length : 0;
	var pageDensity = html === 0 ? 0 : total / html;

	html = 0;
	if (!!container && !!container.innerHTML) html = container.innerHTML.replace(/<([\w\-]+)(\s+[\w\W]*?)?>/g, (m, tag) => '<' + tag + '>').match(RegChar);
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
	var html = document.querySelector('html').innerHTML.replace(/<([\w\-]+)(\s+[\w\W]*?)?>/g, (m, tag) => '<' + tag + '>');
	var content = container.outerHTML.replace(/<([\w\-]+)(\s+[\w\W]*?)?>/g, (m, tag) => '<' + tag + '>');
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

		var ctx = ele.outerHTML.replace(/<([\w\-]+)(\s+[\w\W]*?)?>/g, (m, tag) => '<' + tag + '>');
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
	logger.strong('Ext', titleContainer);

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
const getPageDescription = (isArticle, container) => {
	var candidates;

	if (!isArticle) {
		candidates = document.head.querySelectorAll('[name*="description"], [property*="description"]');
		candidates = [...candidates].map(ele => (ele.content || '').trim()).filter(ctx => !!ctx);
		candidates.sort((a, b) => b.length - a.length);
		return candidates[0];
	}

	var content = getPageContent(container);
	content = content.split(/\n+/);

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
const getPageContent = (container, keepLink=false) => {
	var content = container.innerHTML;

	var temp;
	while (content !== temp) {
		temp = content;
		content = content.replace(/(\w+)>[\s\n\r]+<(\/?\w+)/gi, (m, a, b) => a + '><' + b);
		content = content.trim();
	}

	content = content.replace(/<form(\s+[\w\W]*?)?>[\w\W]*?<\/form>/gi, '');
	content = content.replace(/<select(\s+[\w\W]*?)?>[\w\W]*?<\/select>/gi, '');
	content = content.replace(/<object(\s+[\w\W]*?)?>[\w\W]*?<\/object>/gi, '');
	content = content.replace(/<script(\s+[\w\W]*?)?>[\w\W]*?<\/script>/gi, '');
	content = content.replace(/<style(\s+[\w\W]*?)?>[\w\W]*?<\/style>/gi, '');
	content = content.replace(/<nostyle(\s+[\w\W]*?)?>[\w\W]*?<\/nostyle>/gi, '');
	content = content.replace(/<textarea(\s+[\w\W]*?)?>[\w\W]*?<\/textarea>/gi, '');
	content = content.replace(/<button(\s+[\w\W]*?)?>[\w\W]*?<\/button>/gi, '');
	content = content.replace(/<input(\s+[\w\W]*?)?>/gi, '');
	content = content.replace(/<link(\s+[\w\W]*?)?>/gi, '');

	content = content.replace(/<\/?(article|header|section|aside|footer|div|p|center|ul|ol|tr)(\s+[\w\W]*?)?>/gi, '<br><br>');
	content = content.replace(/<\/?(option|span|font)(\s+[\w\W]*?)?>/gi, '');
	content = content.replace(/<\/(td|th)><\1(\s+[\w\W]*?)?>/gi, ' | ');
	content = content.replace(/<(td|th)(\s+[\w\W]*?)?>/gi, '| ');
	content = content.replace(/<\/(td|th)>/gi, ' |');
	content = content.replace(/<hr(\s+[\w\W]*?)?>/gi, '<br>----<br>');
	content = content.replace(/<li(\s+[\w\W]*?)?>/gi, '-\t');
	content = content.replace(/<\/li>/gi, '\n');
	content = content.replace(/<\/?(b|strong)(\s+[\w\W]*?)?>/gi, '**');
	content = content.replace(/<\/?(i|em)(\s+[\w\W]*?)?>/gi, '*');
	if (!keepLink) content = content.replace(/<\/?a(\s+[\w\W]*?)?>/gi, '');

	temp = '';
	while (content !== temp) {
		temp = content;
		if (keepLink) {
			content = content.replace(/<a(\s+[\w\W]*?)?>([\w\W]*?)<\/a>/gi, (m, prop, inner) => {
				var match = prop.match(/href=('|")([\w\W]*?)\1/);
				if (!match) return inner;
				match = match[2];
				return '[' + inner + '](' + match + ')';
			});
		}
		content = content.replace(/<(h\d)(\s+[\w\W]*?)?>([\w\W]*?)<\/\1>/gi, (m, tag, prop, inner) => {
			var lev = tag.match(/h(\d)/i);
			lev = lev[1] * 1;
			if (lev === 1) return '\n\n#\t' + inner + '\n\n';
			if (lev === 2) return '\n\n##\t' + inner + '\n\n';
			if (lev === 3) return '\n\n###\t' + inner + '\n\n';
			if (lev === 4) return '\n\n####\t' + inner + '\n\n';
			if (lev === 5) return '\n\n#####\t' + inner + '\n\n';
			return inner;
		});
	}

	content = content.replace(/\s*<br>\s*/gi, '\n');
	content = content.replace(/<\/?([\w\-\_]+)(\s+[\w\W]*?)?>/gi, '');
	content = content.replace(/\r/g, '');
	content = content.replace(/\n\n+/g, '\n\n');
	content = content.trim();

	content = content.replace(/&lt;|&#60;/g, '<');
	content = content.replace(/&gt;|&#62;/g, '>');
	content = content.replace(/&amp;|&#38;/g, '&');
	content = content.replace(/&nbsp;|&#160;/g, ' ');
	content = content.replace(/&quot;|&#34;/g, '"');

	return content;
};
const getPageInfo = () => {
	var info = {};
	var container = findContainer();
	logger.strong('Ext', container);
	info.isArticle = checkIsArticle(container);
	if (info.isArticle) {
		info.title = getPageTitle(container);
		info.content = getPageContent(container);
	}
	else {
		info.title = document.title.trim();
	}
	info.description = getPageDescription(info.isArticle, container);
	logger.em('Ext', info);

	pageInfo = info;
};

var notificationMounted = false, notificationMountingRes = [];
const UtilsState = {};
const waitForMountUtil = (util) => new Promise(res => {
	var state = UtilsState[util];
	if (!state) {
		state = {
			loaded: false,
			reses: []
		};
		UtilsState[util] = state;
	}

	if (state.loaded) return res();
	state.reses.push(res);
	sendMessage("MountUtil", util, 'BackEnd');
});

var pageSummary = null, showChatter = false, chatTrigger = null, AIPanel = null, AIAsker = null;
const summarizePage = async () => {
	if (!pageInfo) getPageInfo();
	var article = pageInfo.content;
	article = 'TITLE: ' + pageInfo.title + '\n\n' + article;

	var messages = I18NMessages[myLang] || I18NMessages.en;
	CypriteNotify.summary = Notification.show(messages.cypriteName, messages.summarizingPage, 'rightTop', 'message', 24 * 3600 * 1000);
	sendMessage("SummarizePage", article, "BackEnd");
};
const loadPageSummary = () => new Promise(res => {
	var cid = newID();
	while (!!NeedAIChecker[cid]) {
		cid = newID();
	}
	NeedAIChecker[cid] = res;

	sendMessage("LoadPageSummary", {cid}, 'BackEnd');
});
const afterPageSummary = (summary) => {
	var messages = I18NMessages[myLang] || I18NMessages.en;
	var notify = Notification.show(messages.cypriteName, messages.summarizeSuccess, 'rightTop', 'success', 10 * 1000);
	notify.addEventListener('click', evt => {
		if (evt.target.tagName !== 'BUTTON') return;
		var name = evt.target.name;
		if (name === 'viewnow') {
			showPageSummary(summary);
		}
		notify._hide();
	});
};
const showPageSummary = async (summary) => {
	var messages = I18NMessages[myLang] || I18NMessages.en;
	showChatter = false;

	await waitForMountUtil('panel');

	var background = newEle('div', 'panel_mask');
	var frame = newEle('div', "panel_frame");
	var panel = newEle('div', "panel_container");
	panel.setAttribute('chat', 'false');
	chatTrigger = newEle('div', 'panel_chat_switch');
	chatTrigger.addEventListener('click', onChatterTrigger);
	chatTrigger.innerText = messages.showChatPanel;
	var leftPanel = newEle('div', "panel_left");
	var rightPanel = newEle('div', "panel_right");
	var container = newEle('div', 'content_container', 'scrollable');
	var inputContainer = newEle('div', 'input_container');
	var inputArea = newEle('span', 'input_area', 'cyprite_sender', 'scrollable');
	inputArea.setAttribute('contentEditable', 'true');
	var sender = newEle('span', 'input_sender');
	sender.innerText = messages.sendMessageToCyprite;
	sender.addEventListener('click', onSendToCyprite);

	container.innerHTML = marked.parse(summary);

	inputContainer.appendChild(inputArea);
	rightPanel.appendChild(inputContainer);
	rightPanel.appendChild(sender);
	leftPanel.appendChild(container);
	panel.appendChild(chatTrigger);
	panel.appendChild(leftPanel);
	panel.appendChild(rightPanel);
	frame.appendChild(panel);
	background.appendChild(frame);
	document.body.appendChild(background);

	AIPanel = panel;
	AIAsker = inputArea;
};
const onChatterTrigger = () => {
	if (!chatTrigger) return;

	var messages = I18NMessages[myLang] || I18NMessages.en;
	showChatter = !showChatter;
	if (showChatter) {
		chatTrigger.innerText = messages.hideChatPanel;
		AIPanel.setAttribute('chat', 'true');
		wait(100).then(() => {
			AIAsker.focus();
		});
	}
	else {
		chatTrigger.innerText = messages.showChatPanel;
		AIPanel.setAttribute('chat', 'false');
	}
};
const onSendToCyprite = () => {
	var content = getPageContent(AIAsker, true);
	console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxx');
	console.log(content);
};

const translatePage = async () => {
	if (!pageInfo) getPageInfo();
	var article = pageInfo.content;
	article = 'TITLE: ' + pageInfo.title + '\n\n' + article;
	console.log(article);
};

const NeedAIChecker = {};
const checkPageNeedAI = (page, path, host) => new Promise(res => {
	var cid = newID();
	while (!!NeedAIChecker[cid]) {
		cid = newID();
	}
	NeedAIChecker[cid] = res;

	page = page.replace(/^[\w\-\d_]*?:\/\//i, '');
	sendMessage("CheckPageNeedAI", {cid, page, path, host}, 'BackEnd');
});
const updatePageNeedAIInfo = (page, path, host, need) => new Promise(res => {
	var cid = newID();
	while (!!NeedAIChecker[cid]) {
		cid = newID();
	}
	NeedAIChecker[cid] = res;

	page = page.replace(/^[\w\-\d_]*?:\/\//i, '');
	sendMessage("UpdatePageNeedAIInfo", {cid, page, path, host, need}, 'BackEnd');
});

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
EventHandler.utilMounted = (util) => {
	var state = UtilsState[util];
	if (!state) return;
	state.loaded = true;
	logger.info('Page', 'Utile Loaded: ' + util);
	var list = state.reses;
	delete state.reses;
	list.forEach(res => res());
};
EventHandler.requestCypriteNotify = async (data, source, sid) => {
	if (!data || !data.forceShow) {
		// Determine whether to display the AI component: Check the situation of this page, this URL, and this HOST
		let needAI = await checkPageNeedAI(location.href, location.pathname, location.hostname);
		logger.em('Page', "Need AI: " + needAI);
		if (!needAI) return;
	}

	// Mount Notification
	await waitForMountUtil('notification');

	var messages = I18NMessages[myLang] || I18NMessages.en;
	if (!!CypriteNotify.RequestOperation) return;
	// if (!!CypriteNotify.RequestOperation) CypriteNotify.RequestOperation._hide();
	var notify = Notification.show(messages.cypriteName, messages.newArticleMentionMessage, 'rightTop', 'message', 20 * 1000);
	var userAction = false;
	const onClick = async evt => {
		if (evt.target.tagName !== 'BUTTON') return;
		var name = evt.target.name;
		if (name === 'summarize') {
			if (!pageSummary) {
				pageSummary = await loadPageSummary();
			}
			if (!!pageSummary && (!data || !data.forceSummary)) {
				afterPageSummary(pageSummary);
			}
			else {
				await summarizePage();
			}
			userAction = true;
		}
		else if (name === 'translate') {
			await translatePage();
			userAction = true;
		}
		notify._hide();
	};
	notify.addEventListener('click', onClick);
	notify.onclose = async () => {
		await updatePageNeedAIInfo(location.href, location.pathname, location.hostname, userAction);
		notify.removeEventListener('click', onClick);
		notify.onclose = null;
		CypriteNotify.RequestOperation = null;
	};
	CypriteNotify.RequestOperation = notify;
};
EventHandler.pageSummarized = (data) => {
	if (!!CypriteNotify.summary) CypriteNotify.summary._hide();
	CypriteNotify.summary = null;

	if (!!data) {
		pageSummary = data;
		sendMessage("SavePageSummary", data, 'BackEnd');
		afterPageSummary(data);
	}
	else {
		let messages = I18NMessages[myLang] || I18NMessages.en;
		Notification.show(messages.cypriteName, messages.summarizeFailed, 'rightTop', 'fail', 5 * 1000);
	}
};
EventHandler.pageSummaryLoaded = (data) => {
	var res = NeedAIChecker[data.cid];
	if (!res) return;
	res(data.description);
};
EventHandler.pageNeedAIChecked = (data) => {
	var res = NeedAIChecker[data.cid];
	if (!res) return;
	var pageNeed = (data.page.need + 1) / (data.page.visited + 1);
	var pathNeed = (data.path.need + 1) / (data.path.visited + 1);
	var hostNeed = (data.host.need + 1) / (data.host.visited + 1);
	var needed = (pageNeed + pathNeed + hostNeed) > 1.0;
	res(needed);
};
EventHandler.pageNeedAIUpdated = (data) => {
	var res = NeedAIChecker[data.cid];
	if (!res) return;
	res();
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
const observer = new MutationObserver((list) => {
	var available = false;
	for (let evt of list) {
		if (evt.target.className.indexOf('cyprite_sender') >= 0) {
			continue;
		}

		let items = [...evt.addedNodes, ...evt.removedNodes];
		items.some(item => {
			if (!item.className && item.className !== '') return false;
			if (item.classList.contains('panel_mask')) {
				return false;
			}
			if (item.className.indexOf('notification') >= 0) {
				if (evt.target === document.body) {
					return false;
				}
				else {
					available = true;
					return true;
				}
			}
			available = true;
			return true;
		});
	}
	if (!available) return;

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
loadPageSummary();