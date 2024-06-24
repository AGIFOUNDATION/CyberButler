const ChatHistory = [];

var showChatter = false, chatTrigger = null;
var btnClearHistory = null, relativeArticles = [];
var AIContainer = null, AIPanel = null, AIAsker = null, AIHistory = null, AIRelated = null;

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
	panel.appendChild(avatar);
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
	sender.innerText = messages.sendMessageToCyprite;
	sender.addEventListener('click', onSendToCyprite);
	rightPanel.appendChild(sender);
	var historyList = newEle('div', 'cyprite', "chat_history_area", "scrollable");
	rightPanel.appendChild(historyList);
	historyList.__inner = newEle('div', 'cyprite', "chat_history_list");
	historyList.__inner.addEventListener('mouseup', onClickChatItem);
	historyList.appendChild(historyList.__inner);

	document.body.appendChild(background);

	AIContainer = background;
	AIPanel = panel;
	AIAsker = inputArea;
	AIHistory = historyList;
};
const generateTabPanel = (messages) => {
	var tabPanel = newEle('div', 'cyprite', 'panel_tabs_area');

	var btnSummary = newEle('div', 'cyprite', 'panel_tab');
	btnSummary.setAttribute('action', 'showSummary');
	btnSummary.innerText = messages.showSummaryPanel;
	btnSummary.addEventListener('click', showSummaryPanel);
	tabPanel.appendChild(btnSummary);

	var btnTranslate = newEle('div', 'cyprite', 'panel_tab', 'invalid');
	btnTranslate.setAttribute('action', 'showTranslate');
	btnTranslate.innerText = messages.showTranslatePanel;
	btnTranslate.addEventListener('click', showTranslatePanel);
	tabPanel.appendChild(btnTranslate);

	var btnComprehensive = newEle('div', 'cyprite', 'panel_tab', 'invalid');
	btnComprehensive.setAttribute('action', 'showComprehensive');
	btnComprehensive.innerText = messages.showComprehensivePanel;
	btnComprehensive.addEventListener('click', showComprehensivePanel);
	tabPanel.appendChild(btnComprehensive);

	chatTrigger = newEle('div', 'cyprite', 'panel_button', "always_show");
	chatTrigger.innerText = messages.showChatPanel;
	chatTrigger.addEventListener('click', onSummaryChatTrigger);
	tabPanel.appendChild(chatTrigger);

	btnClearHistory = newEle('div', 'cyprite', 'panel_button');
	btnClearHistory.setAttribute('group', 'summary');
	btnClearHistory.innerText = messages.btnClearHistory;
	btnClearHistory.addEventListener('click', onClearSummaryConversation);
	tabPanel.appendChild(btnClearHistory);

	return tabPanel;
};
const addSummaryAndRelated = (messages, container, summary, relatedList) => {
	container.innerHTML = marked.parse(summary);

	var related = newEle('h2', 'cyprite', 'related_articles_area');
	related.innerText = messages.relatedArticles;
	var list = newEle('ul', 'cyprite', 'related_articles_list');
	if (!relatedList || !relatedList.length) {
		list.innerHTML = '<li>' + messages.noRelatedArticle + '</li>';
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

/* Events */

const showPageSummary = async (summary) => {
	var [relatives, conversation] = await Promise.all([
		findSimilarArticle(pageVector),
		restoreConversation(),
	]);
	var messages = I18NMessages[myLang] || I18NMessages.en;

	if (!AIContainer) await generateAIPanel(messages);

	addSummaryAndRelated(messages, AIContainer.querySelector('.content_container'), summary, relatives);
	relativeArticles = relatives;
	showSummaryPanel();

	restoreHistory(conversation);
	resizeHistoryArea(true);
	AIContainer.style.display = 'block';
};
const showSummaryPanel = () => {
	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_tab')) tab.classList.remove('active');
	AIPanel.querySelector('.panel_tabs_area .panel_tab[action="showSummary"]').classList.add('active');

	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button')) tab.classList.remove('active');
	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button[group="summary"]')) tab.classList.add('active');

	console.log('Show Summary');
};
const showTranslatePanel = () => {
	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_tab')) tab.classList.remove('active');
	AIPanel.querySelector('.panel_tabs_area .panel_tab[action="showTranslate"]').classList.add('active');

	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button')) tab.classList.remove('active');
	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button[group="translate"]')) tab.classList.add('active');

	console.log('Show Translate');
};
const showComprehensivePanel = () => {
	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_tab')) tab.classList.remove('active');
	AIPanel.querySelector('.panel_tabs_area .panel_tab[action="showComprehensive"]').classList.add('active');

	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button')) tab.classList.remove('active');
	for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button[group="comprehensive"]')) tab.classList.add('active');

	console.log('Show Comprehensive');
};
const onCloseMeByMask = ({target}) => {
	if (!target.classList.contains('panel_mask') && !target.classList.contains('panel_frame')) return;
	onCloseMe();
};
const onCloseMe = () => {
	AIContainer.style.display = 'none';
};
const onSummaryChatTrigger = async () => {
	if (!chatTrigger) return;

	var messages = I18NMessages[myLang] || I18NMessages.en;
	showChatter = !showChatter;
	if (showChatter) {
		for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button[group="summary"]')) tab.classList.add('show');
		chatTrigger.innerText = messages.hideChatPanel;
		AIPanel.setAttribute('chat', 'true');
		await wait(100);
		AIAsker.focus();
		resizeHistoryArea(true);
		await wait(60);
		AIHistory.scrollTop = AIHistory.scrollHeight - AIHistory.clientHeight;
	}
	else {
		for (let tab of AIPanel.querySelectorAll('.panel_tabs_area .panel_button[group="summary"]')) tab.classList.remove('show');
		chatTrigger.innerText = messages.showChatPanel;
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

	var content = getPageContent(target, true);
	await navigator.clipboard.writeText(content);
	var messages = I18NMessages[myLang] || I18NMessages.en;
	Notification.show(messages.cypriteName, messages.contentCopied, 'middleTop', 'success', 2 * 1000);
};
const onAfterInput = evt => {
	resizeHistoryArea();
	if (!evt.ctrlKey || evt.key !== 'Enter') return;
	evt.preventDefault();
	onSendToCyprite();
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
				conversationVector.push(normalVector(pageVector));
				pageVector.forEach(item => {
					// ArticleVectorCompressionRate
					conversationVector.push({
						weight: Math.floor(item.weight ** ArticleVectorCompressionRate) + 1,
						vector: [...item.vector],
					});
				});
			}
		}
		if (!!conversationVector) {
			conversationVector.push(...vector);
			related = await askSWandWait('FindSimilarArticle', {url: location.href, vector: conversationVector});
			console.log('VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV');
			console.log(related);
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
				}
				else {
					related.push(item);
				}
			});
			related.sort((a, b) => b.similar - a.similar);
			console.log(related);
			related = filterSimilarArticle(related, 5);
			console.log(related);
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
const onClearSummaryConversation = async () => {
	askSWandWait('ClearSummaryConversation', location.href);
	AIHistory.__inner.innerHTML = '';
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

	// ArticleVectorCompressionRate
	weight = Math.floor(weight ** ArticleVectorCompressionRate) + 1;

	return { weight, vector };
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