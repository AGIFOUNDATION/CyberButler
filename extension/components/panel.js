const ChatHistory = [];
const ChatVectorLimit = 20;
const ArticleSimilarRate = 1.0;
const MatchRelevantArticlesBasedOnConversation = true;
const ModelOrder = [
	"gemini",
	"claude",
	"openai",
	"moonshot",
	"deepseek",
	"glm",
];

var currentMode = '';
var showChatter = false, runningAI = false, chatTrigger = null;
var similarArticles = [], relativeArticles = [];
var extraTranslationRequirement = '', inputerTranslationLanguage = null;
var AIContainer = null, AIPanel = null, AIAsker = null, AIHistory = null, AIModelList = null;

/* UI */

const generateAIPanel = async (messages) => {
	await waitForMountUtil('panel');

	var background = newEle('div', 'cyprite', 'panel_mask');
	background.addEventListener('click', onCloseMeByMask);
	var frame = newEle('div', 'cyprite', "panel_frame");
	background.appendChild(frame);
	var panel = newEle('div', 'cyprite', "panel_container");
	panel.setAttribute('chat', 'false');
	frame.appendChild(panel);

	var avatar = newEle('div', 'cyprite', 'panel_logo');
	avatar.innerHTML = '<img src="' + chrome.runtime.getURL('/images/cyprite.png') + '">';
	avatar.addEventListener('mouseenter', updateModelList);
	panel.appendChild(avatar);
	var modelList = newEle('div', 'cyprite', "panel_model_chooser");
	modelList.addEventListener('click', onChooseModel);
	avatar.appendChild(modelList);

	var closeMe = newEle('div', 'cyprite', 'panel_closer');
	closeMe.innerHTML = '<img src="' + chrome.runtime.getURL('/images/circle-xmark.svg') + '">';
	closeMe.addEventListener('click', onCloseMe);
	panel.appendChild(closeMe);

	var tabPanel = generateTabPanel(messages);
	panel.appendChild(tabPanel);
	var leftPanel = newEle('div', 'cyprite', "panel_left");
	panel.appendChild(leftPanel);
	var rightPanel = newEle('div', 'cyprite', "panel_right");
	panel.appendChild(rightPanel);

	var container = newEle('div', 'cyprite', 'content_container', 'scrollable');
	leftPanel.appendChild(container);

	var inputContainer = newEle('div', 'cyprite', 'input_container');
	rightPanel.appendChild(inputContainer);
	var inputArea = newEle('div', 'cyprite', 'input_area', 'cyprite_sender', 'scrollable');
	inputArea.setAttribute('contentEditable', 'true');
	inputArea.addEventListener('paste', onContentPaste);
	inputArea.addEventListener('keyup', onAfterInput);
	inputContainer.appendChild(inputArea);
	var sender = newEle('div', 'cyprite', 'input_sender');
	sender.innerText = messages.buttons.sendMessageToCyprite;
	sender.addEventListener('click', onSendToCyprite);
	rightPanel.appendChild(sender);
	var historyList = newEle('div', 'cyprite', "chat_history_area", "scrollable");
	rightPanel.appendChild(historyList);
	historyList.__inner = newEle('div', 'cyprite', "chat_history_list");
	historyList.__inner.addEventListener('mouseup', onClickChatItem);
	historyList.appendChild(historyList.__inner);

	var extraRequirementPanel = generateTranslationExtraRequirementPanel(messages);
	leftPanel.appendChild(extraRequirementPanel);

	document.body.appendChild(background);

	AIContainer = background;
	AIPanel = panel;
	AIAsker = inputArea;
	AIHistory = historyList;
	AIModelList = modelList;
};
const generateTabPanel = (messages) => {
	var tabPanel = newEle('div', 'cyprite', 'panel_tabs_area');

	/* Category Entry */

	var btnSummary = newEle('div', 'cyprite', 'panel_tab');
	btnSummary.setAttribute('action', 'showSummary');
	btnSummary.innerText = messages.buttons.showSummaryPanel;
	btnSummary.addEventListener('click', () => {
		showPageSummary(pageSummary || '');
	});
	tabPanel.appendChild(btnSummary);

	var btnTranslate = newEle('div', 'cyprite', 'panel_tab');
	btnTranslate.setAttribute('action', 'showTranslate');
	btnTranslate.innerText = messages.buttons.showTranslatePanel;
	btnTranslate.addEventListener('click', () => {
		showTranslationResult(translationInfo.isSelection, translationInfo.content, translationInfo.translation);
	});
	tabPanel.appendChild(btnTranslate);

	var btnComprehensive = newEle('div', 'cyprite', 'panel_tab', 'invalid');
	btnComprehensive.setAttribute('action', 'showComprehensive');
	btnComprehensive.innerText = messages.buttons.showComprehensivePanel;
	btnComprehensive.addEventListener('click', () => {
		sendMessage('GotoConversationPage', null, 'BackEnd');
	});
	tabPanel.appendChild(btnComprehensive);

	/* Summary Buttons */

	chatTrigger = newEle('div', 'cyprite', 'panel_button', "always_show");
	chatTrigger.innerText = messages.buttons.showChatPanel;
	chatTrigger.addEventListener('click', onSummaryChatTrigger);
	tabPanel.appendChild(chatTrigger);

	var btnClearHistory = newEle('div', 'cyprite', 'panel_button');
	btnClearHistory.setAttribute('group', 'summary');
	btnClearHistory.innerText = messages.buttons.btnClearHistory;
	btnClearHistory.addEventListener('click', clearSummaryConversation);
	tabPanel.appendChild(btnClearHistory);

	var btnReSummary = newEle('div', 'cyprite', 'panel_button', 'always');
	btnReSummary.setAttribute('group', 'summary');
	btnReSummary.innerText = messages.buttons.btnReSummary;
	btnReSummary.addEventListener('click', () => summarizePage(true));
	tabPanel.appendChild(btnReSummary);

	/* Translation Buttons */

	var btnChangeLanguage = newEle('div', 'cyprite', 'panel_button', 'always');
	btnChangeLanguage.setAttribute('group', 'translate');
	btnChangeLanguage.innerText = messages.buttons.hintTranslateInto;
	inputerTranslationLanguage = newEle('input', 'cyprite', 'panel_input', 'translate_target_language');
	inputerTranslationLanguage.value = LangName[myLang] || myLang;
	btnChangeLanguage.appendChild(inputerTranslationLanguage);
	tabPanel.appendChild(btnChangeLanguage);

	return tabPanel;
};
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
		var item = newEle('div', 'cyprite', 'panel_model_item');
		item.innerText = mdl;
		item.setAttribute('name', mdl);
		if (mdl === model) {
			item.classList.add('current');
		}
		AIModelList.appendChild(item);
	});
};
const generateTranslationExtraRequirementPanel = (messages) => {
	var inputFrame = newEle('div', 'cyprite', 'panel_extrareq_inputform');
	var inputter = newEle('textarea', 'cyprite');
	inputFrame.appendChild(inputter);

	var submitter = newEle('div', 'cyprite', 'input_sender');
	submitter.innerHTML = '<img button="true" action="editExtraRequirement" src="' + chrome.runtime.getURL('/images/feather.svg') + '">';
	var inner = newEle('div', 'cyprite');
	inner.innerText = messages.buttons.btnTranslateAgain;
	submitter.appendChild(inner);
	submitter.addEventListener('click', () => {
		extraTranslationRequirement = inputter.value;
		var lang = inputerTranslationLanguage.value || translationInfo.lang || myLang;
		translatePage(true, lang, translationInfo.isSelection ? translationInfo.content : '', extraTranslationRequirement);
	});
	inputFrame.appendChild(submitter);

	return inputFrame;
};
const addSummaryAndRelated = (messages, container, summary, relatedList) => {
	container.innerHTML = marked.parse(summary, {breaks: true}) || messages.conversation.AIFailed;

	var related = newEle('h2', 'cyprite', 'related_articles_area');
	related.innerText = messages.summarizeArticle.relatedArticles;
	var list = newEle('ul', 'cyprite', 'related_articles_list');
	if (!relatedList || !relatedList.length) {
		list.innerHTML = '<li>' + messages.summarizeArticle.noRelatedArticle + '</li>';
	}
	else {
		relatedList.forEach(item => {
			var frame = newEle('li', 'cyprite', 'related_articles_item');
			var link = newEle('a', 'cyprite', 'related_articles_link');
			link.innerText = item.title;
			link.href = item.url;
			link.target = '_blank';
			frame.appendChild(link);
			list.appendChild(frame);
		});
	}
	container.appendChild(related);
	container.appendChild(list);
};
const addChatItem = (content, type) => {
	var messages = I18NMessages[myLang] || I18NMessages.en;
	var item = newEle('div', 'cyprite', 'chat_item'), isOther = false;

	var titleBar = newEle('div', 'cyprite', "chat_title");
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
		let contentPad = newEle('div', 'cyprite', "chat_content");
		contentPad.innerHTML = marked.parse(content, {breaks: true}) || messages.conversation.AIFailed;
		contentPad._data = content;
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
const resizeHistoryArea = (immediately) => {
	if (!!resizeHistoryArea.timer) clearTimeout(resizeHistoryArea.timer);

	var duration = isBoolean(immediately) ? (immediately ? 0 : 250) : (isNumber(immediately) ? immediately : 250);
	resizeHistoryArea.timer = setTimeout(() => {
		resizeHistoryArea.timer = null;

		var inputerBox = AIAsker.parentNode.getBoundingClientRect();
		var containerBox = AIHistory.parentNode.getBoundingClientRect();
		var height = containerBox.height - 20 - inputerBox.height - 25;
		AIHistory.style.height = height + 'px';
	}, duration);
};

/* Events */

const showPageSummary = async (summary) => {
	currentMode = 'summary';

	var [relatives, conversation] = await Promise.all([
		findSimilarArticle(pageVector),
		restoreConversation(),
	]);
	var messages = I18NMessages[myLang] || I18NMessages.en;

	if (!AIContainer) await generateAIPanel(messages);

	generateModelList();
	addSummaryAndRelated(messages, AIContainer.querySelector('.content_container'), summary, relatives);
	restoreHistory(conversation);
	resizeHistoryArea(true);
	switchPanel('summary');

	AIContainer.style.display = 'block';

	findRelativeArticles();
};
const showTranslationResult = async (isSelection, content, translation) => {
	currentMode = 'translate';

	var messages = I18NMessages[myLang] || I18NMessages.en;

	if (!AIContainer) await generateAIPanel(messages);

	inputerTranslationLanguage.value = translationInfo.lang || LangName[myLang] || myLang;

	var ctx, conversation = [];
	if (isSelection) {
		if (content.length > 200) {
			ctx = '**' + messages.translation.selectionHint + '**\n\n' + content.substring(0, 200) + '\n\n......\n\n----\n\n' + translation;
		}
		else {
			ctx = '**' + messages.translation.selectionHint + '**\n\n' + content + '\n\n----\n\n' + translation;
		}
	}
	else {
		ctx = '**' + messages.translation.articleHint + '**\n\n----\n\n' + (translation || messages.translation.noTranslatedYet);
	}
	conversation.push(['ai', messages.translation.instantTranslateHint]);

	generateModelList();
	AIContainer.querySelector('.content_container').innerHTML = marked.parse(ctx, {breaks: true}) || messages.conversation.AIFailed;
	restoreHistory(conversation);
	resizeHistoryArea(true);
	switchPanel('translate');

	AIContainer.style.display = 'block';
};
const switchPanel = group => {
	var actionName = 'show' + group[0].toUpperCase() + group.substring(1);

	AIPanel.setAttribute('name', group);

	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_tab')) tab.classList.remove('active');
	AIPanel.querySelector(`.panel_tabs_area .panel_tab[action="${actionName}"]`).classList.add('active');

	for (let tab of AIPanel.querySelectorAll('.panel_container .panel_button')) tab.classList.remove('active');
	for (let tab of AIPanel.querySelectorAll(`.panel_container .panel_button[group="${group}"]`)) tab.classList.add('active');
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
const onCloseMeByMask = ({target}) => {
	if (!target.classList.contains('panel_mask') && !target.classList.contains('panel_frame')) return;
	onCloseMe();
};
const onCloseMe = () => {
	AIContainer.style.display = 'none';
};
const onChooseModel = async ({target}) => {
	if (!target.classList.contains("panel_model_item")) return;
	var model = target.getAttribute('name');
	chrome.storage.local.set({'AImodel': model});
	updateModelList(model);

	var messages = I18NMessages[myLang] || I18NMessages.en;
	Notification.show(messages.cypriteName, messages.mentions.changeModelSuccess, 'middleTop', 'success', 2 * 1000);
};
const onSummaryChatTrigger = async () => {
	if (!chatTrigger) return;

	var messages = I18NMessages[myLang] || I18NMessages.en;
	showChatter = !showChatter;
	if (showChatter) {
		for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button[group="summary"]')) tab.classList.add('show');
		chatTrigger.innerText = messages.buttons.hideChatPanel;
		AIPanel.setAttribute('chat', 'true');
		await wait(100);
		AIAsker.focus();
		resizeHistoryArea(true);
		await wait(60);
		AIHistory.scrollTop = AIHistory.scrollHeight - AIHistory.clientHeight;
	}
	else {
		for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button[group="summary"]')) tab.classList.remove('show');
		chatTrigger.innerText = messages.buttons.showChatPanel;
		AIPanel.setAttribute('chat', 'false');
	}
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
const onCopyContent = async target => {
	while (!target.classList.contains('chat_item')) {
		target = target.parentElement;
		if (target === document.body) return;
	}
	target = target.querySelector('.chat_content');
	var content = target._data;
	if (!content) content = getPageContent(target, true);
	await navigator.clipboard.writeText(content);
	var messages = I18NMessages[myLang] || I18NMessages.en;
	Notification.show(messages.cypriteName, messages.mentions.contentCopied, 'middleTop', 'success', 2 * 1000);
	AIAsker.focus();
};
const onAfterInput = evt => {
	resizeHistoryArea();
	if (!evt.ctrlKey || evt.key !== 'Enter') return;
	evt.preventDefault();
	onSendToCyprite();
};
const onSendToCyprite = async () => {
	runningAI = true;

	var messages = I18NMessages[myLang] || I18NMessages.en;
	var question = getPageContent(AIAsker, true);
	if (!question) return;
	addChatItem(question, 'human');
	AIAsker.innerText = messages.conversation.waitForAI;
	AIAsker.setAttribute('contentEditable', 'false');
	resizeHistoryArea(60);

	var result;

	if (currentMode === 'summary') {
		// Get Embedding Vector for Request
		let vector;
		if (MatchRelevantArticlesBasedOnConversation) {
			try {
				vector = await askAIandWait('embeddingContent', {title: "Request", article: question});
			}
			catch {
				vector = null;
			}
		}

		// Match relevant articles
		let related = null;
		if (!!vector) {
			if (!conversationVector && !!pageVector) {
				conversationVector = [];
				pageVector.forEach(item => {
					conversationVector.push({
						weight: item.weight,
						vector: [...item.vector],
					});
				});
			}
			if (!!conversationVector) {
				conversationVector.push(...vector);
				if (conversationVector.length > ChatVectorLimit) conversationVector = conversationVector.splice(conversationVector.length - ChatVectorLimit, ChatVectorLimit);
				related = await askSWandWait('FindSimilarArticle', {url: location.href, vector: conversationVector});
				findRelativeArticles();
				relativeArticles.forEach(item => {
					var article;
					related.some(art => {
						if (!!art.hash && !!item.hash) {
							if (art.hash === item.hash) {
								article = art;
								return true;
							}
						}
						else if (art.url === item.url) {
							article = art;
							return true;
						}
					});
					if (!!article) {
						if (article.similar < item.similar) {
							article.similar = item.similar
						}
						article.similar *= ArticleSimilarRate;
					}
					else {
						related.push(item);
					}
				});
				related.sort((a, b) => b.similar - a.similar);
			}
		}
		else {
			related = [...relativeArticles];
		}
		related = filterSimilarArticle(related, 10);

		// Call Ai for reply
		let {title, content} = pageInfo;
		if (!content) content = getPageContent(document.body, true);
		result = await askAIandWait('askArticle', { url: location.href, title, content, question, related });
	}
	else if (currentMode === 'translate') {
		let lang = inputerTranslationLanguage.value || translationInfo.lang || myLang;
		result = await askAIandWait('translateSentence', { lang, content: question });
	}

	if (!result) result = messages.conversation.AIFailed;
	addChatItem(result, 'cyprite');

	AIAsker.innerText = '';
	AIAsker.setAttribute('contentEditable', 'true');
	resizeHistoryArea(60);

	await wait();
	AIAsker.focus();

	runningAI = false;

	// Get Embedding Vector for Reply
	if (MatchRelevantArticlesBasedOnConversation && !!conversationVector) {
		askAIandWait('embeddingContent', {title: "Request", article: result}).then(vector => {
			if (!vector) return;
			conversationVector.push(...vector);
			if (conversationVector.length > ChatVectorLimit) conversationVector = conversationVector.splice(conversationVector.length - ChatVectorLimit, ChatVectorLimit);
		});
	}
};
const clearSummaryConversation = async () => {
	if (runningAI) {
		Notification.show(messages.cypriteName, messages.mentions.clearConversationWhileRunning, 'middleTop', 'warn', 2 * 1000);
		return;
	}
	askSWandWait('ClearSummaryConversation', location.href);
	AIHistory.__inner.innerHTML = '';
};
const onClickChatItem = ({target}) => {
	while (target.getAttribute('button') !== 'true') {
		target = target.parentNode;
		if (target === document.body) return;
	}

	var action = target.getAttribute('action');
	if (action === 'copyContent') {
		onCopyContent(target);
	}
};
const restoreHistory = conversation => {
	AIHistory.__inner.innerHTML = '';
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
const restoreConversation = async () => {
	if (!pageInfo) return;
	if (!pageInfo.title) return;
	return await askSWandWait('GetConversation', location.href);
};
const normalVector = vectors => {
	var weight = 0, vector = [], len = 0;
	vectors.forEach(item => {
		len = Math.max(item.vector.length, len);
	});
	for (let i = 0; i < len; i ++) vector.push(0);

	vectors.forEach(item => {
		weight += item.weight;
		item.vector.forEach((v, i) => {
			vector[i] += v * item.weight;
		});
	});
	vector = vector.map(v => v / weight);

	len = 0;
	vector.forEach(v => len += v ** 2);
	len = len ** 0.5;
	vector = vector.map(v => v / len);

	return { weight, vector };
};
const findSimilarArticle = async (vector) => {
	if (!vector) return;

	var result = await askSWandWait('FindSimilarArticle', {url: location.href, vector});

	// Remove same article
	if (!!pageHash) {
		result = result.filter(item => item.hash !== pageHash);
	}
	relativeArticles = [...result];
	similarArticles = [...result];

	// Filter
	result = filterSimilarArticle(result, 10);
	return result;
};
const filterSimilarArticle = (articles, count) => {
	var hashes = [];
	articles = articles.filter(item => {
		if (hashes.includes(item.hash)) return false;
		hashes.push(item.hash);
		return true;
	});
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
const findRelativeArticles = () => {
	if (!pageInfo) return;

	var requests = [];
	[...AIHistory.__inner.querySelectorAll('.chat_item.human .chat_content')].forEach(item => {
		requests.push(item._data);
	});

	sendMessage('FindRelativeArticles', {
		url: location.href,
		hash: pageHash,
		content: [pageInfo.content],
		articles: similarArticles,
		requests
	}, 'BackEnd');
};