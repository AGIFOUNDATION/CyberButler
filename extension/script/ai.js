import "./ai/gemini.js";
import "./ai/claude.js";
import "./ai/gpt.js";

const ResMap = new Map();
const EmbeddingLimit = 2024;

var embedAIModel = AI.Gemini.embed;

globalThis.callAIandWait = (action, data) => new Promise((res, rej) => {
	var taskId = newID();

	myInfo.useLocalKV = true; // Test
	// Call AI from Extension
	if (myInfo.useLocalKV) {
		if (!myInfo.edgeAvailable) {
			chrome.notifications.create({
				title: "CyberButler: Cyprite",
				message: Hints[myInfo.lang].noAPIKey,
				type: "basic",
				iconUrl: "/images/icon1024.png",
			});
			rej(Hints[myInfo.lang].noAPIKey);
			return;
		}
		let handler = EdgedAI[action];
		if (!handler) {
			let errMsg = 'NO such action: ' + action;
			logger.error('AI', errMsg);
			rej(errMsg);
			return;
		}
		ResMap.set(taskId, [res, rej]);
		handler(taskId, data);
	}
	// Call AI from Server
	else {
		ResMap.set(taskId, [res, rej]);
	}
});
globalThis.callAI = (action, data) => {
	// Call AI from Extension
	if (myInfo.useLocalKV) {
		if (!myInfo.edgeAvailable) {
			chrome.notifications.create({
				title: "CyberButler: Cyprite",
				message: Hints[myInfo.lang].noAPIKey,
				type: "basic",
				iconUrl: "/images/icon1024.png",
			});
			return;
		}
		let handler = EdgedAI[action];
		if (!handler) {
			let errMsg = 'NO such action: ' + action;
			logger.error('AI', errMsg);
			return;
		}
		handler(taskId, data);
	}
	// Call AI from Server
	else {
	}
};
const replyRequest = (tid, reply, error) => {
	var res = ResMap.get(tid);
	if (!res) return;
	ResMap.delete(tid);
	if (!!error) res[1](error);
	else res[0](reply);
};
const splitParagraph = (content, mark) => {
	content = '\n' + content;

	var blocks = [], lastPos = 0;
	content.replace(new RegExp('\\n' + mark + '\\s+', 'gi'), (m, pos) => {
		var block = content.substring(lastPos, pos);
		lastPos = pos;
		block = block.trim();
		blocks.push(block);
	});
	blocks.push(content.substring(lastPos).trim());
	blocks = blocks.filter(block => !!block);
	blocks = blocks.map(block => {
		if (block.length > EmbeddingLimit) {
			return [false, block];
		}
		else {
			return [true, block];
		}
	});
	return blocks;
};
const splitSentence = (content, reg, nextLine=false) => {
	var sentences = [], lastPos = 0;
	content.replace(reg, (m, ...args) => {
		var pos;
		args.some(arg => {
			if (isNumber(arg)) {
				pos = arg;
				return true;
			}
		});
		pos += m.length;
		var sub = content.substring(lastPos, pos);
		lastPos = pos;
		sentences.push(sub);
	});
	sentences.push(content.substring(lastPos));
	sentences = sentences.filter(line => !!line.trim());

	var parts = [], size = 0, temp = '', delta = nextLine ? 1 : 0;
	sentences.forEach(line => {
		var len = line.length;
		if (len > EmbeddingLimit) {
			parts.push([true, temp.trim()]);
			temp = '';
			size = 0;
			parts.push([false, line.trim()]);
		}
		else if (size + len + delta > EmbeddingLimit) {
			parts.push([true, temp.trim()]);
			temp = line;
			size = len;
		}
		else {
			if (nextLine) temp = temp + '\n' + line;
			else temp = temp + line;
			size = temp.length;
		}
	});
	if (!!temp.trim()) parts.push([true, temp.trim()]);
	return parts;
};
const batchize = content => {
	content = splitParagraph(content, '#');
	content = content.map(content => {
		if (content[0]) return content[1];
		content = splitParagraph(content[1], '##');
		content = content.map(content => {
			if (content[0]) return content[1];
			content = splitParagraph(content[1], '###');
			content = content.map(content => {
				if (content[0]) return content[1];
				content = splitParagraph(content[1], '####');
				content = content.map(content => {
					if (content[0]) return content[1];
					content = splitSentence(content[1], /(\r*\n\r*)+/g, true);
					content = content.map(content => {
						if (content[0]) return content[1];
						content = splitSentence(content[1], /[\.\?\!。？！…]['"’”]?/gi);
						content = content.map(content => {
							if (content[0]) return content[1];
							content = splitSentence(content[1], /[,;，；]['"’”]?\s*/gi);
							content = content.map(content => {
								if (content[0]) return content[1];
								content = splitSentence(content[1], /\s+/gi);
								content = content.map(content => {
									if (content[0]) return content[1];
									content = content[1];
									var block = [];
									var count = Math.ceil(content.length / EmbeddingLimit);
									var size = Math.ceil(content.length / count);
									for (let i = 0; i < count; i ++) {
										let j = i * size;
										let line = content.substring(j, j + size);
										block.push(line);
									}
									return block;
								});
								return content;
							});
							return content;
						});
						return content;
					});
					return content;
				});
				return content;
			});
			return content;
		});
		return content;
	});

	content = content.flat(Infinity);
	content = content.filter(block => !!block);
	return content;
};
const callAI = async (tid, prompt, model) => {
	model = model || myInfo.model;
	if (!model) {
		replyRequest(tid, null, 'AI Model not set.');
		return;
	}

	var aiName = Model2AI[model];
	var chatToAI = AI[aiName];
	if (!!chatToAI) chatToAI = chatToAI.chat;
	if (!chatToAI) {
		replyRequest(tid, '', 'No AI for Model ' + model);
		return;
	}

	var reply, errMsg;
	try {
		reply = await chatToAI(prompt, model);
	}
	catch (err) {
		console.error(err);
		errMsg = err.message || err.msg || err.data || (!!err.toString ? err.toString() : err || aiName + ' Error');
	}

	replyRequest(tid, reply, errMsg);
};

const EdgedAI = {};
EdgedAI.sayHello = async (tid) => {
	var prompt = PromptLib.assemble(PromptLib.sayHello, {
		lang: LangName[myInfo.lang],
		name: myInfo.name,
		info: myInfo.info,
		time: timestmp2str(Date.now(), "YY年MM月DD日 :WDE: hh:mm"),
	});

	callAI(tid, [['human', prompt]]);
};
EdgedAI.summarizeArticle = async (tid, article) => {
	var prompt = PromptLib.assemble(PromptLib.summarizeArticle, { article, lang: LangName[myInfo.lang] });

	callAI(tid, [['human', prompt]]);
};
EdgedAI.embeddingArticle = async (tid, data) => {
	var batch = [];
	var content = data.article || data.summary;
	if (content.length > EmbeddingLimit) {
		content = batchize(content);
		content.forEach((ctx, i) => {
			batch.push({
				title: data.title + '-' + (i + 1),
				content: ctx
			});
		});
	}
	else {
		batch.push({
			title: data.title,
			content
		});
	}

	var reply, errMsg;
	try {
		reply = await embedAIModel(batch);
	}
	catch (err) {
		console.error(err);
		errMsg = err.message || err.msg || err.data || (!!err.toString ? err.toString() : err || 'Gemini Error');
	}

	replyRequest(tid, reply, errMsg);
};
EdgedAI.findRelativeArticles = async (tid, data) => {
	var prompt = [];
	prompt.push(['system', PromptLib.assemble(PromptLib.findRelativeArticlesSystem, data)]);
	prompt.push(['human', PromptLib.assemble(PromptLib.findRelativeArticlesRunning, data)]);

	var model = Model2AI[myInfo.model];
	if (!!model) model = FastAI[model];
	if (!model) {
		replyRequest(tid, '', 'No Such AI Model: ' + myInfo.model);
		return;
	}

	callAI(tid, prompt, model);
};
EdgedAI.askArticle = async (tid, conversation) => {
	callAI(tid, conversation, myInfo.model);
};
EdgedAI.translateContent = async (tid, data) => {
	var prompt = [];
	prompt.push(['system', PromptLib.assemble(PromptLib.translationSystem, data)]);
	prompt.push(['human', PromptLib.assemble(PromptLib.translationRunning, data)]);

	callAI(tid, prompt);
};
EdgedAI.translateSentence = async (tid, data) => {
	var prompt = [];
	prompt.push(['system', PromptLib.assemble(PromptLib.instantTranslationSystem, data)]);
	prompt.push(['human', PromptLib.assemble(PromptLib.instantTranslationRunning, data)]);

	callAI(tid, prompt);
};