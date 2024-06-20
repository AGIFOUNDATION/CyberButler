import "./gemini.js";

const ResMap = new Map();
const EmbeddingLimit = 2024;

var chatToAIModel = AI.Gemini.chat; // For the integration of various different AI models.
var embedAIModel = AI.Gemini.embed;

globalThis.callAIandWait = (action, data) => new Promise((res, rej) => {
	var taskId = newID();

	// Call AI from Extension
	if (myInfo.useLocalKV) {
		if (!myInfo.apiKey) {
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
		if (!myInfo.apiKey) {
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

const EdgedAI = {};
EdgedAI.sayHello = async (tid) => {
	var prompt = PromptLib.assemble(PromptLib.sayHello, {
		lang: LangName[myInfo.lang],
		name: myInfo.name,
		info: myInfo.info,
		time: timestmp2str(Date.now(), "YY年MM月DD日 :WDE: hh:mm"),
	});
	var reply, errMsg;
	try {
		reply = await chatToAIModel([['human', prompt]]);
	}
	catch (err) {
		console.error(err);
		errMsg = err.message || err.msg || err.data || (!!err.toString ? err.toString() : err || 'Gemini Error');
	}

	replyRequest(tid, reply, errMsg);
};
EdgedAI.summarizeArticle = async (tid, article) => {
	var prompt = PromptLib.assemble(PromptLib.summarizeArticle, { article, lang: LangName[myInfo.lang] });
	var reply, errMsg;
	try {
		reply = await chatToAIModel([['human', prompt]]);
	}
	catch (err) {
		console.error(err);
		errMsg = err.message || err.msg || err.data || (!!err.toString ? err.toString() : err || 'Gemini Error');
	}

	replyRequest(tid, reply, errMsg);
};
EdgedAI.embeddingArticle = async (tid, data) => {
	var reply, errMsg;
	var content = data.article;
	if (!!content) {
		if (content.length > EmbeddingLimit) {
			content = data.summary;
		}
	}
	else {
		content = data.summary;
	}
	if (content.length > EmbeddingLimit) content = content.substring(0, EmbeddingLimit); // Model Embedding Content Limit

	try {
		reply = await embedAIModel(data.title, content);
	}
	catch (err) {
		console.error(err);
		errMsg = err.message || err.msg || err.data || (!!err.toString ? err.toString() : err || 'Gemini Error');
	}

	replyRequest(tid, reply, errMsg);
};
EdgedAI.askArticle = async (tid, conversation) => {
	var reply, errMsg;
	try {
		reply = await chatToAIModel(conversation, 'gemini-1.5-pro');
	}
	catch (err) {
		console.error(err);
		errMsg = err.message || err.msg || err.data || (!!err.toString ? err.toString() : err || 'Gemini Error');
	}

	replyRequest(tid, reply, errMsg);
};