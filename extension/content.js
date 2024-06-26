const PageName = 'FrontEnd';
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
var sendMessage = (event, data, target, tid, sender=PageName) => {
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
	if (msg.target === PageName) {
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
		if (!!ele.classList && ele.classList.contains('cyprite')) continue;
		let tag = ele.tagName;
		let info = tagInfo[tag] || {
			total: 0,
			value: 0,
		};
		let total = clearHTML(ele.innerHTML, false).match(RegChar);
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
		if (!!ele.classList && ele.classList.contains('cyprite')) continue;
		var size = ele.textContent.match(RegChar);
		size = !!size ? size.length : 0;
		var total = clearHTML(ele.innerHTML, false).match(RegChar);
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
		if (!!ele.classList && ele.classList.contains('cyprite')) return;

		var size = ele.textContent.match(RegChar);
		size = !!size ? size.length : 0;
		var total = clearHTML(ele.innerHTML, false).match(RegChar);
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

	var weight = contentDensity * 1.5 + pageDensity * 0.35 + (innerDensity / pageDensity / 0.9) * 1.15;
	weight *= content / (400 + content);
	logger.log('DOC', 'Article Density Weights:', (Math.round(contentDensity * 10000) / 100) + '%', (Math.round(pageDensity * 10000) / 100) + '%', (Math.round(innerDensity * 10000) / 100) + '%', (Math.round(weight / 1.4 * 10000) / 100) + '%');
	return weight > 1.4;
};
const getPageTitle = (container) => {
	// Locate the content container position
	var html = clearHTML(document.querySelector('html').innerHTML);
	var content = clearHTML(container.outerHTML);
	var poses = [], tagLen = (container.tagName || '').length + 2;
	html.replace(content, (m, pos) => {
		poses.push([pos, pos + content.length]);
	});

	// Find out all title candidates
	var candidates = document.querySelectorAll('header, h1, h2, [id*="title"], [name*="title"], [property*="title"], [id*="Title"], [name*="Title"], [property*="Title"], [id*="TITLE"], [name*="TITLE"], [property*="TITLE"]');
	candidates = [...candidates];

	// Calculate the distance between title candidate container and the content container
	candidates = candidates.map(ele => {
		if (!ele.outerHTML) return;
		var content = ele.textContent || ele.content || ele.getAttribute('content') || ele.value || ele.getAttribute('value') || '';
		content = content.trim();
		if (!content) return;

		var ctx = clearHTML(ele.outerHTML);
		var delta = [];
		html.replace(ctx, (m, p) => {
			// Calculate the distance
			poses.forEach(block => {
				if (p < block[0]) {
					delta.push(block[0] - p - ctx.length);
				}
				else if (p < block[1]) {
					delta.push(p - block[0] - tagLen);
				}
			});
		});
		delta = delta.filter(d => d >= 0);
		if (delta.length === 0) return;

		// The final distance
		delta.sort((a, b) => a - b);
		return [ele, delta[0], content];
	}).filter(ele => !!ele);

	// Return page title if no suitable title container
	if (candidates.length === 0) return document.title.trim();

	candidates.sort((a, b) => a[1] - b[1]);
	var titleContainer = candidates[0][0];
	var containerTitle = candidates[0][2];
	logger.strong('DOC', titleContainer);

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
	else return containerTitle;
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
const getPageInfo = async () => {
	var info = {};
	var container = findContainer();
	logger.strong('DOC', container);
	info.isArticle = checkIsArticle(container);
	if (info.isArticle) {
		info.title = getPageTitle(container);
		info.content = getPageContent(container, true);
	}
	else {
		info.title = document.title.trim();
		info.content = getPageContent(document.body, false);
	}
	info.hash = await askSWandWait("CalculateHash", info.content);
	info.description = getPageDescription(info.isArticle, container);
	logger.em('DOC', info);

	return info;
};
const chooseTargetLanguage = (lang) => {
	if (!lang || lang.toLowerCase() === myLang || LangName[myLang].toLowerCase() === lang.toLowerCase()) {
		for (let key in LangName) {
			if (key === myLang) continue;
			lang = LangName[key];
			break;
		}
		return lang;
	}
	return LangName[lang] || lang;
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
const summarizePage = async (isRefresh=false) => {
	runningAI = true;

	if (!!AIContainer) AIContainer.querySelector('.content_container').innerHTML = '';

	pageInfo = await getPageInfo();
	var article = pageInfo.content, hash = pageInfo.hash;
	article = 'TITLE: ' + pageInfo.title + '\n\n' + article;

	if (!isRefresh && !!pageSummary && !!pageHash && hash === pageHash) {
		showPageSummary(pageSummary);
		runningAI = false;
		return;
	}

	var messages = I18NMessages[myLang] || I18NMessages.en;
	var notify = Notification.show(messages.cypriteName, messages.summarizeArticle.running, isRefresh ? "middleTop" : 'rightTop', 'message', 24 * 3600 * 1000);

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
		sendMessage("SavePageSummary", {title: pageInfo.title, summary, hash, embedding, content: pageInfo.content}, 'BackEnd');
		showPageSummary(summary);
	}
	else {
		Notification.show(messages.cypriteName, messages.summarizeArticle.failed, 'rightTop', 'fail', 5 * 1000);
		showPageSummary('');
	}

	runningAI = false;
};

var translationInfo = {
	lang: '',
	content: '',
	translation: '',
};
const translatePage = async (isRefresh=false, lang, content, requirement) => {
	runningAI = true;

	if (!!AIContainer) AIContainer.querySelector('.content_container').innerHTML = '';

	if (!content) {
		if (!pageInfo) pageInfo = await getPageInfo();
		content = pageInfo.content;
	}

	var messages = I18NMessages[myLang] || I18NMessages.en;
	var notify = Notification.show(messages.cypriteName, messages.translation.translatingArticle, isRefresh ? "middleTop" : 'rightTop', 'message', 24 * 3600 * 1000);

	if (!lang) lang = myLang;
	lang = LangName[lang] || lang;

	var translation = await askAIandWait('translateContent', {lang, content, requirement});
	translationInfo.lang = lang;
	translationInfo.content = content;
	translationInfo.translation = translation;

	await showTranslationResult(translation);
	notify._hide();

	runningAI = false;
};
const translateSelection = async (selection) => {
	runningAI = true;

	if (!!AIContainer) AIContainer.querySelector('.content_container').innerHTML = '';

	var messages = I18NMessages[myLang] || I18NMessages.en;
	var notify = Notification.show(messages.cypriteName, messages.translation.translatingSelection, 'rightTop', 'message', 24 * 3600 * 1000);

	var lang;
	if (!!inputerTranslationLanguage) {
		lang = inputerTranslationLanguage.value;
	}
	lang = chooseTargetLanguage(lang);

	// Get Selection Content
	var sel = document.getSelection(), content;
	if (sel.isCollapsed) {
		content = selection;
	}
	else {
		let range = sel.getRangeAt(0);
		content = range.cloneContents();
		let container = newEle('div'), nodes = [...content.childNodes];
		nodes.forEach(node => container.appendChild(node));
		content = getPageContent(container, false);
	}

	var translation = await askAIandWait('translateSentence', { lang, content });

	// Show UI
	await showTranslationResult('', [['human', content], ['ai', translation]]);
	if (!showChatter) await onChatTrigger();
	notify._hide();

	runningAI = false;
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
	logger.info('Page', 'Util Loaded: ' + util);
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

	if (!!forceShow && !!pageSummary && !!pageHash && !!pageInfo) {
		let info = await getPageInfo();
		if (info.hash === pageHash) {
			showPageSummary(pageSummary);
			return;
		}
	}

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
EventHandler.onContextMenuAction = async (data) => {
	await waitForMountUtil('notification');
	if (data.action === 'launchCyprite') {
		if (!pageSummary) {
			pageSummary = await askSWandWait('LoadPageSummary');
			if (!!pageSummary) {
				pageVector = pageSummary.embedding;
				pageHash = pageSummary.hash;
				pageSummary = pageSummary.description;
			}
		}
		await summarizePage();
	}
	else if (data.action === 'translateSelection') {
		await translateSelection(data.text);
	}
};
EventHandler.foundRelativeArticles = (data) => {
	if (!data || !data.length) return;

	var hashes = [];
	relativeArticles = [...data].filter(item => {
		if (hashes.includes(item.hash)) return false;
		hashes.push(item.hash);
		return true;
	});

	var list = AIPanel.querySelector('.related_articles_list');
	if (!list) return;
	list.innerHTML = '';
	relativeArticles.forEach(item => {
		var frame = newEle('li', 'cyprite', 'related_articles_item');
		var link = newEle('a', 'cyprite', 'related_articles_link');
		link.innerText = item.title;
		link.href = item.url;
		link.target = '_blank';
		frame.appendChild(link);
		list.appendChild(frame);
	});
};

/* Tab */

document.onreadystatechange = async () => {
	logger.log('Page', 'Ready State Changed: ' + document.readyState);
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
	if (data.target === PageName && (data.tid === null || data.tid === undefined)) {
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
		logger.log('Page', 'Mutation Observered');
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