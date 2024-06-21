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
const isRuntimeAvailable = () => {
	try {
		chrome.runtime;
		return !!chrome.runtime && !!chrome.runtime.connect && !!chrome.runtime.id;
	}
	catch {
		return false;
	}
};

/* Communiation */

var port, runtimeID = chrome.runtime.id;
var sendMessage = (event, data, target, tid, sender="FrontEnd") => {
	if (!port) {
		if (!isRuntimeAvailable()) {
			logger.error('Runtime', 'Runtime cannot connect');
			return;
		}

		logger.info('Runtime', 'Runtime Reconnect: ' + runtimeID);
		if (!chrome.runtime?.id && !!globalThis.Notification) {
			Notification.show(messages.cypriteName, messages.refreshHint, 'rightTop', 'fetal', 10 * 1000);
		}
		port = chrome.runtime.connect(runtimeID, {name: "cyberbutler_contentscript"});
		port.onDisconnect.addListener(onPortDisconnect);
		port.onMessage.addListener(onPortMessage);
	}

	port.postMessage({event, data, target, tid, sender});
};
const sendMessageToCyprite = (event, data, sender, sid) => {
	window.postMessage({
		extension: "CypriteTheCyberButler",
		type: "F2P",
		data: {event, data, sender, sid}
	});
};
const onPortDisconnect = () => {
	logger.info('PORT', 'Disconnected');
	port = null;
};
const onPortMessage = msg => {
	if (msg.target === 'FrontEnd') {
		let handler = EventHandler[msg.event];
		if (!handler) return;
		handler(msg.data, msg.sender || 'BackEnd', msg.sid);
	}
	else if (msg.target === 'PageEnd') {
		sendMessageToCyprite(msg.event, msg.data, msg.sender, msg.sid);
	}
};
chrome.runtime.onConnect.addListener(() => {
	logger.info('Runtime', 'HeartBeated');
});

/* Utils */

var pageInfo = null, pageHash = null, pageVector;
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

	var weight = contentDensity * 1.2 + pageDensity * 0.8 + (innerDensity / pageDensity / 0.9);
	weight *= content / (400 + content);
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
	var content = isString(container) ? container : container.innerHTML || container.toString();

	var temp;
	while (content !== temp) {
		temp = content;
		content = content.replace(/(\w+)>[\s\n\r]+<(\/?\w+)/gi, (m, a, b) => a + '><' + b);
		content = content.trim();
	}

	content = content.replace(/\s+data\-mathml="<math(\s+[\w\W]*?)?>[\w\W]*?<\/math>"\s*/gi, ' ');
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
				var match = (prop || '').match(/href=('|")([\w\W]*?)\1/);
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

	var parser = new DOMParser();
	var dom = parser.parseFromString(content, "text/html");
	content = dom.body.textContent;

	return content;
};
const getPageInfo = async () => {
	var info = {};
	var container = findContainer();
	logger.strong('Ext', container);
	info.isArticle = checkIsArticle(container);
	if (info.isArticle) {
		info.title = getPageTitle(container);
		info.content = getPageContent(container, true);
		info.hash = await askSWandWait("CalculateHash", info.content);
	}
	else {
		info.title = document.title.trim();
		info.content = '';
		info.hash = '';
	}
	info.description = getPageDescription(info.isArticle, container);
	logger.em('Ext', info);

	return info;
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

var pageSummary = null, conversationVector = null;
var showChatter = false, chatTrigger = null;
var AIContainer = null, AIPanel = null, AIAsker = null, AIHistory = null, AIRelated = null;
const ChatHistory = [];
const summarizePage = async () => {
	pageInfo = await getPageInfo();
	var article = pageInfo.content, hash = pageInfo.hash;
	if (!article) {
		article = getPageContent(document.body, true);
		hash = await askSWandWait("CalculateHash", article);
	}
	article = 'TITLE: ' + pageInfo.title + '\n\n' + article;

	if (hash === pageHash && !!pageHash && !!pageSummary) {
		afterPageSummary(pageSummary);
		return;
	}

	var messages = I18NMessages[myLang] || I18NMessages.en;
	var notify = Notification.show(messages.cypriteName, messages.summarizingPage, 'rightTop', 'message', 24 * 3600 * 1000);

	var embedding, summary = await askAIandWait('summarizeArticle', {title: pageInfo.title, article});
	if (!!summary) {
		embedding = summary.embedding;
		summary = summary.summary;
	}
	notify._hide();

	if (!!summary) {
		pageSummary = summary;
		pageHash = hash;
		pageVector = embedding;
		sendMessage("SavePageSummary", {title: pageInfo.title, summary, hash, embedding}, 'BackEnd');
		notify = Notification.show(messages.cypriteName, messages.summarizeSuccess, 'rightTop', 'success', 10 * 1000);
		let onClick = evt => {
			if (evt.target.tagName !== 'BUTTON') return;
			var name = evt.target.name;
			if (name === 'viewnow') {
				showPageSummary(summary);
			}
			notify._hide();
		};
		notify.onclose = () => {
			notify.removeEventListener('click', onClick);
		};
		notify.addEventListener('click', onClick);
	}
	else {
		Notification.show(messages.cypriteName, messages.summarizeFailed, 'rightTop', 'fail', 5 * 1000);
	}
};
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
	var [relatives, conversation] = await Promise.all([
		findSimilarArticle(pageVector),
		restoreConversation(),
	]);
	var messages = I18NMessages[myLang] || I18NMessages.en;

	showChatter = false;
	if (!!AIContainer) {
		AIRelated.innerHTML = '';
		if (!relatives || !relatives.length) {
			AIRelated.innerHTML = '<li>' + messages.noRelatedArticle + '</li>';
		}
		else {
			relatives.forEach(item => {
				var frame = newEle('li', 'cyprite', 'related_articles_item');
				var link = newEle('a', 'cyprite', 'related_articles_link');
				link.innerText = item.title;
				link.href = item.url;
				link.target = '_blank';
				frame.appendChild(link);
				AIRelated.appendChild(frame);
			});
		}

		AIContainer.style.display = 'block';
		return;
	}

	await waitForMountUtil('panel');

	var background = newEle('div', 'cyprite', 'panel_mask');
	var frame = newEle('div', 'cyprite', "panel_frame");
	var panel = newEle('div', 'cyprite', "panel_container");
	panel.setAttribute('chat', 'false');
	chatTrigger = newEle('div', 'cyprite', 'panel_chat_switch');
	chatTrigger.addEventListener('click', onChatterTrigger);
	chatTrigger.innerText = messages.showChatPanel;
	var leftPanel = newEle('div', 'cyprite', "panel_left");
	var rightPanel = newEle('div', 'cyprite', "panel_right");
	var container = newEle('div', 'cyprite', 'content_container', 'scrollable');
	container.innerHTML = marked.parse(summary);
	var related = newEle('h2', 'cyprite', 'related_articles_area');
	related.innerText = messages.relatedArticles;
	AIRelated = newEle('ul', 'cyprite', 'related_articles_list');
	if (!relatives || !relatives.length) {
		AIRelated.innerHTML = '<li>' + messages.noRelatedArticle + '</li>';
	}
	else {
		relatives.forEach(item => {
			var frame = newEle('li', 'cyprite', 'related_articles_item');
			var link = newEle('a', 'cyprite', 'related_articles_link');
			link.innerText = item.title;
			link.href = item.url;
			link.target = '_blank';
			frame.appendChild(link);
			AIRelated.appendChild(frame);
		});
	}

	var inputContainer = newEle('div', 'cyprite', 'input_container');
	var inputArea = newEle('div', 'cyprite', 'input_area', 'cyprite_sender', 'scrollable');
	inputArea.setAttribute('contentEditable', 'true');
	inputArea.addEventListener('paste', onContentPaste);
	inputArea.addEventListener('keyup', onAfterInput);
	var sender = newEle('div', 'cyprite', 'input_sender');
	sender.innerText = messages.sendMessageToCyprite;
	sender.addEventListener('click', onSendToCyprite);
	var historyList = newEle('div', 'cyprite', "chat_history_area", "scrollable");
	historyList.__inner = newEle('div', 'cyprite', "chat_history_list");
	historyList.__inner.addEventListener('mouseup', onClickChatItem);
	var closeMe = newEle('div', 'cyprite', 'panel_closer');
	closeMe.innerHTML = '<img src="' + chrome.runtime.getURL('/images/circle-xmark.svg') + '">';
	closeMe.addEventListener('click', onCloseMe);

	historyList.appendChild(historyList.__inner);
	rightPanel.appendChild(historyList);
	inputContainer.appendChild(inputArea);
	rightPanel.appendChild(inputContainer);
	rightPanel.appendChild(sender);
	leftPanel.appendChild(container);
	container.appendChild(related);
	container.appendChild(AIRelated);
	panel.appendChild(chatTrigger);
	panel.appendChild(leftPanel);
	panel.appendChild(rightPanel);
	panel.appendChild(closeMe);
	frame.appendChild(panel);
	background.appendChild(frame);
	document.body.appendChild(background);

	AIContainer = background;
	AIPanel = panel;
	AIAsker = inputArea;
	AIHistory = historyList;

	restoreHistory(conversation);

	resizeHistoryArea(true);
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
			resizeHistoryArea(true);
		});
	}
	else {
		chatTrigger.innerText = messages.showChatPanel;
		AIPanel.setAttribute('chat', 'false');
	}
};
const onSendToCyprite = async () => {
	var messages = I18NMessages[myLang] || I18NMessages.en;
	var question = getPageContent(AIAsker, true);
	addChatItem(question, 'human');
	AIAsker.innerText = messages.waitForAI;
	AIAsker.setAttribute('contentEditable', 'false');

	var vector;
	try {
		vector = await askAIandWait('embeddingContent', {title: "Request", article: question});
	}
	catch {
		vector = null;
	}
	var related = null;
	if (!!vector) {
		if (!conversationVector) {
			if (!!pageVector) {
				conversationVector = [];
				pageVector.forEach(item => {
					conversationVector.push({
						weight: Math.floor(item.weight ** 0.3),
						vector: item.vector
					});
				});
			}
		}
		if (!!conversationVector) {
			conversationVector.push(...vector);
			related = await askSWandWait('FindSimilarArticle', {url: location.href, vector: conversationVector});
			related = filterSimilarArticle(related, 5);
		}
	}

	var {title, content} = pageInfo;
	if (!content) content = getPageContent(document.body, true);
	var result = await askAIandWait('askArticle', { url: location.href, title, content, question, related });
	if (!result) result = messages.AIFailed;
	addChatItem(result, 'cyprite');

	AIAsker.innerText = '';
	AIAsker.setAttribute('contentEditable', 'true');
	await wait();
	AIAsker.focus();
};
const restoreHistory = conversation => {
	if (!conversation) return;
	conversation.forEach(item => {
		if (item[0] === 'human') {
			addChatItem(item[1], 'human');
		}
		else if (item[0] === 'ai') {
			addChatItem(item[1], 'cyprite');
		}
	});
};
const onContentPaste = evt => {
	evt.preventDefault();

	var html = evt.clipboardData.getData('text/html');
	var text = evt.clipboardData.getData('text/plain') || evt.clipboardData.getData('text');

	var content;
	if (!!html) {
		content = getPageContent(html, true);
	}
	else {
		content = text;
	}
	if (!content) return;

	document.execCommand('insertText', false, content);
};
const onAfterInput = evt => {
	resizeHistoryArea();
	if (!evt.ctrlKey || evt.key !== 'Enter') return;
	evt.preventDefault();
	onSendToCyprite();
};
const onClickChatItem = ({target}) => {
	while (target.getAttribute('button') !== 'true') {
		target = target.parentNode;
		if (target === document.body) return;
	}

	var action = target.getAttribute('action');
	if (!action) return;
	if (action === 'copyContent') {
		onCopyContent(target);
	}
};
const onCopyContent = async target => {
	while (!target.classList.contains('chat_item')) {
		target = target.parentElement;
		if (target === document.body) return;
	}
	target = target.querySelector('.chat_content');

	var content = getPageContent(target, true);
	await navigator.clipboard.writeText(content);
	var messages = I18NMessages[myLang] || I18NMessages.en;
	Notification.show(messages.cypriteName, messages.contentCopied, 'middleTop', 'success', 2 * 1000);
};
const onCloseMe = () => {
	AIContainer.style.display = 'none';
};
const resizeHistoryArea = (immediately=false) => {
	if (!!resizeHistoryArea.timer) clearTimeout(resizeHistoryArea.timer);

	resizeHistoryArea.timer = setTimeout(() => {
		resizeHistoryArea.timer = null;

		var inputerBox = AIAsker.parentNode.getBoundingClientRect();
		var containerBox = AIHistory.parentNode.getBoundingClientRect();
		var height = containerBox.height - 20 - inputerBox.height - 30 - 10;
		AIHistory.style.height = height + 'px';
	}, immediately ? 0 : 250);
};
const addChatItem = (content, type) => {
	var messages = I18NMessages[myLang] || I18NMessages.en;
	var item = newEle('div', 'cyprite', 'chat_item'), isOther = false;

	var titleBar = newEle('div', 'cyprite', "chat_title");
	if (type === 'human') {
		titleBar.innerText = messages.yourTalkPrompt + ':';
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
		let contentPad = newEle('div', 'cyprite', "chat_content");
		contentPad.innerHTML = marked.parse(content);
		item.appendChild(contentPad);
	}
	else {
		if (!isOther) return;
	}

	var operatorBar = newEle('div', 'cyprite', 'operator_bar');
	operatorBar.innerHTML = '<img button="true" action="copyContent" src="' + chrome.runtime.getURL('/images/copy.svg') + '">';
	item.appendChild(operatorBar);

	AIHistory.__inner.appendChild(item);
	wait(60).then(() => {
		AIHistory.scrollTop = AIHistory.scrollHeight - AIHistory.clientHeight;
	});
};

const translatePage = async () => {
	if (!pageInfo) pageInfo = await getPageInfo();
	var article = pageInfo.content;
	article = 'TITLE: ' + pageInfo.title + '\n\n' + article;
	console.log(article);
};

const findSimilarArticle = async (vector) => {
	if (!vector) return;

	var result = await askSWandWait('FindSimilarArticle', {url: location.href, vector});

	// Remove same article
	if (!!pageHash) {
		result = result.filter(item => item.hash !== pageHash);
	}

	// Filter
	result = filterSimilarArticle(result, 10);
	return result;
};
const filterSimilarArticle = (articles, count) => {
	// Filter
	const Limit = 1 / (3 ** 0.5);
	articles = articles.filter(item => item.similar >= Limit);
	if (articles.length > count) articles.splice(count);

	var log = [];
	articles = articles.map(item => {
		log.push({
			title: item.title,
			similar: item.similar,
		});
		return {
			url: item.url,
			title: item.title,
			similar: item.similar,
			hash: item.hash,
		};
	});
	logger.info('Content', 'Similar Articles:');
	console.table(log);
	return articles;
};
const restoreConversation = async () => {
	if (!pageInfo) return;
	if (!pageInfo.title) return;
	return await askSWandWait('GetConversation', location.href);
};
const checkPageNeedAI = async (page, path, host) => {
	page = page.replace(/^[\w\-\d_]*?:\/\//i, '');
	var data = await askSWandWait('CheckPageNeedAI', {page, path, host});
	var pageNeed = (data.page.need + 1) / (data.page.visited + 1);
	var pathNeed = (data.path.need + 1) / (data.path.visited + 1);
	var hostNeed = (data.host.need + 1) / (data.host.visited + 1);
	var needed = (pageNeed + pathNeed + hostNeed) > 1.0;
	logger.info('Page', pageNeed, pathNeed, hostNeed, needed);
	return needed;
};
const updatePageNeedAIInfo = async (page, path, host, need) => {
	page = page.replace(/^[\w\-\d_]*?:\/\//i, '');
	await askSWandWait('UpdatePageNeedAIInfo', {page, path, host, need});
};


const NeedAIChecker = {};
const askSWandWait = (action, data) => new Promise(res => {
	var id = newID();
	while (!!NeedAIChecker[id]) {
		id = newID();
	}
	NeedAIChecker[id] = res;

	sendMessage('AskSWAndWait', {id, action, data}, 'BackEnd');
});
const askAIandWait = (action, data) => new Promise(res => {
	var id = newID();
	while (!!NeedAIChecker[id]) {
		id = newID();
	}
	NeedAIChecker[id] = res;

	sendMessage('AskAIAndWait', {id, action, data}, 'BackEnd');
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
EventHandler.getPageInfo = async (data, source) => {
	if (source !== 'BackEnd') return;

	logger.log('Page', 'Analyze Page Info: ' + document.readyState);
	if (!pageInfo) {
		pageInfo = await getPageInfo();
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
EventHandler.requestCypriteNotify = async (data) => {
	var forceShow = !!data && !!data.forceShow;
	if (!forceShow) {
		// Determine whether to display the AI component: Check the situation of this page, this URL, and this HOST
		let needAI = await checkPageNeedAI(location.href, location.host + location.pathname, location.hostname);
		logger.log('Page', "Need AI: " + needAI);
		if (!needAI) return;
	}

	// Mount Notification
	await waitForMountUtil('notification');

	var messages = I18NMessages[myLang] || I18NMessages.en;
	if (!!CypriteNotify.RequestOperation) return;
	var notify = Notification.show(messages.cypriteName, messages.newArticleMentionMessage, 'rightTop', 'message', 20 * 1000);
	var userAction = false;
	const onClick = async evt => {
		if (evt.target.tagName !== 'BUTTON') return;
		var name = evt.target.name;
		if (name === 'summarize') {
			userAction = true;

			if (!pageSummary) {
				pageSummary = await askSWandWait('LoadPageSummary');
				if (!!pageSummary) {
					pageVector = pageSummary.embedding;
					pageHash = pageSummary.hash;
					pageSummary = pageSummary.description;
				}
			}
			notify._hide();
			await summarizePage();
		}
		else if (name === 'translate') {
			userAction = true;
			notify._hide();
			await translatePage();
		}
		else {
			notify._hide();
		}
	};
	notify.addEventListener('click', onClick);
	notify.onclose = async () => {
		if (!forceShow) await updatePageNeedAIInfo(location.href, location.host + location.pathname, location.hostname, userAction);
		notify.removeEventListener('click', onClick);
		notify.onclose = null;
		CypriteNotify.RequestOperation = null;
	};
	CypriteNotify.RequestOperation = notify;
};
EventHandler.replyAskAndWait = (data) => {
	var res = NeedAIChecker[data.id];
	if (!res) return;
	delete NeedAIChecker[data.id];
	res(data.result);
};

/* Tab */

document.onreadystatechange = async () => {
	logger.log('DOC', 'Ready State Changed: ' + document.readyState);
	pageInfo = null;
	pageInfo = await getPageInfo();
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
window.addEventListener('beforeunload', () => {
	pageInfo = null;
	pageSummary = '';
	pageHash = '';
	pageVector = null;
	sendMessage("VisibilityChanged", 'close', "BackEnd");
});
window.addEventListener('idle', () => {
	sendMessage("VisibilityChanged", 'idle', "BackEnd");
});
window.addEventListener('load', () => {
	logger.log('WIN', 'Loaded');
	initArticleInfo();
});
window.addEventListener('message', ({data}) => {
	var extension = data.extension, type = data.type;
	if (extension !== 'CypriteTheCyberButler') return;
	if (type !== 'P2F') return;

	data = data.data;
	// If the target is current page
	if (data.target === 'FrontEnd' && (data.tid === null || data.tid === undefined)) {
		onPortMessage(data);
	}
	// Send to backend
	else {
		sendMessage(data.event, data.data, data.target, data.tid, data.sender);
	}
});

var timerMutationObserver;
const observer = new MutationObserver((list) => {
	var available = false;
	for (let evt of list) {
		let target = evt.target, isCyprite = false;
		while (!isCyprite) {
			target = target.parentElement;
			if (!target || target === document.body) break;
			isCyprite = target.className.indexOf('cyprite') >= 0;
		}
		if (isCyprite) {
			continue;
		}

		let items = [...evt.addedNodes, ...evt.removedNodes];
		items.some(item => {
			if (!item.className && item.className !== '') return false;
			if (item.classList.contains('panel_mask')) {
				return false;
			}
			if (!!item.className.indexOf && item.className.indexOf('notification') >= 0) {
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
	timerMutationObserver = setTimeout(async () => {
		var info = await getPageInfo();
		if (!pageInfo) {
			pageInfo = info;
		}
		else {
			if (pageInfo.hash === info.hash && !!pageInfo.hash) {
				return;
			}
			pageInfo = info;
		}
		logger.log('DOC', 'Mutation Observered');
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

const initArticleInfo = async () => {
	var data = await askSWandWait('LoadPageSummary');
	if (!data) return;
	pageSummary = data.description || pageSummary;
	pageHash = data.hash || pageHash;
	pageVector = data.embedding || pageVector;
};

sendMessage("PageStateChanged", {
	state: 'open',
	url: location.href
}, "BackEnd");