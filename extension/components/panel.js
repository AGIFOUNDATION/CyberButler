const ChatHistory = [];

var showChatter = false, chatTrigger = null;
var AIContainer = null, AIPanel = null, AIAsker = null, AIHistory = null, AIRelated = null;

/* UI */

const showPageSummary = async (summary) => {
	var [relatives, conversation] = await Promise.all([
		findSimilarArticle(pageVector),
		restoreConversation(),
	]);
	var messages = I18NMessages[myLang] || I18NMessages.en;

	showChatter = false;
	if (!!AIContainer) {
		addSummaryAndRelated(messages, AIContainer.querySelector('.content_container'), summary, relatives);
		restoreHistory(conversation);
		AIContainer.style.display = 'block';
		resizeHistoryArea(true);
		return;
	}

	await waitForMountUtil('panel');

	var background = newEle('div', 'cyprite', 'panel_mask');
	background.addEventListener('click', onCloseMeByMask);
	var frame = newEle('div', 'cyprite', "panel_frame");
	var panel = newEle('div', 'cyprite', "panel_container");
	panel.setAttribute('chat', 'false');
	var avatar = newEle('div', 'cyprite', 'panel_logo');
	avatar.innerHTML = '<img src="' + chrome.runtime.getURL('/images/cyprite.png') + '">';
	chatTrigger = newEle('div', 'cyprite', 'panel_chat_switch');
	chatTrigger.innerText = messages.showChatPanel;
	chatTrigger.addEventListener('click', onChatterTrigger);
	var leftPanel = newEle('div', 'cyprite', "panel_left");
	var rightPanel = newEle('div', 'cyprite', "panel_right");
	var container = newEle('div', 'cyprite', 'content_container', 'scrollable');
	addSummaryAndRelated(messages, container, summary, relatives);

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
	panel.appendChild(avatar);
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

const onCloseMeByMask = ({target}) => {
	if (!target.classList.contains('panel_mask')) return;
	onCloseMe();
};
const onChatterTrigger = async () => {
	if (!chatTrigger) return;

	var messages = I18NMessages[myLang] || I18NMessages.en;
	showChatter = !showChatter;
	if (showChatter) {
		chatTrigger.innerText = messages.hideChatPanel;
		AIPanel.setAttribute('chat', 'true');
		await wait(100);
		AIAsker.focus();
		resizeHistoryArea(true);
		await wait(60);
		AIHistory.scrollTop = AIHistory.scrollHeight - AIHistory.clientHeight;
	}
	else {
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
const onCloseMe = () => {
	AIContainer.style.display = 'none';
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