import "./gemini.js";

const ResMap = new Map();
var callAIModel = callGemini; // For the integration of various different AI models.

globalThis.callAIandWait = (action, data) => new Promise((res, rej) => {
	var taskId = newID();

	// 前端处理
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
	// 从后端获取数据
	else {
		ResMap.set(taskId, [res, rej]);
	}
});
globalThis.callAI = (action, data) => {
	// 前端处理
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
	// 从后端获取数据
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
		reply = await callAIModel([['human', prompt]]);
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
		reply = await callAIModel([['human', prompt]]);
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
		reply = await callAIModel(conversation, 'gemini-1.5-pro');
	}
	catch (err) {
		console.error(err);
		errMsg = err.message || err.msg || err.data || (!!err.toString ? err.toString() : err || 'Gemini Error');
	}

	replyRequest(tid, reply, errMsg);
};