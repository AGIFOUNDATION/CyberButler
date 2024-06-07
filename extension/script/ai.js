import "./gemini.js";

const ResMap = new Map();

globalThis.callAI = (action, data) => new Promise((res, rej) => {
	myInfo.useLocalKV = true;

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
			console.log('[AI] ' + errMsg);
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

const EdgedAI = {};
EdgedAI.sayHello = async (tid) => {
	var prompt = PromptLib.assemble(PromptLib.sayHello, {
		lang: LangName[myInfo.lang],
		name: myInfo.name,
		info: myInfo.info,
		time: timestmp2str(Date.now(), "hh:mm"),
	});
	var reply, errMsg;
	try {
		reply = await callGemini([['human', prompt]]);
	}
	catch (err) {
		console.error(err);
		errMsg = err.message || err.msg || err.data || (!!err.toString ? err.toString() : err || 'Gemini Error');
	}

	var res = ResMap.get(tid);
	if (!res) return;
	ResMap.delete(tid);
	if (!!errMsg) res[1](errMsg);
	else res[0](reply);
};