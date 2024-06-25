globalThis.AI = globalThis.AI || {};
globalThis.AI.OpenAI = {};
globalThis.AI.MoonShot = {};
globalThis.AI.DeepSeek = {};

const DefaultOpenAIChatModel = AI2Model.openai[0];
const DefaultOpenAIDrawModel = 'dall-e-3';
const DefaultMoonShotChatModel = AI2Model.moonshot[0];
const DefaultDeepSeekChatModel = AI2Model.deepseek[0];

const assembleMessages = (conversation, full=true) => {
	var messages = [];
	conversation.forEach(item => {
		var role;
		if (item[0] === 'system') role = 'system';
		else if (item[0] === 'human') role = 'user';
		else if (item[0] === 'ai') role = 'assistant';
		var content = full ? [{
			type: "text",
			text: item[1]
		}] : item[1];
		messages.push({
			role,
			content
		});
	});
	return messages;
};
const assembleDataPack = (model, messages, options) => {
	var data = {
		model,
		temperature: options.temperature || 1.0,
		max_tokens: options.max_tokens || 4095,
		top_p: options.top_p || 1,
		frequency_penalty: options.frequency_penalty || 0,
		presence_penalty: options.presence_penalty || 0,
		messages
	};
	return data;
};
const scoreContent = content => {
	var score = 0;
	content = content.replace(/[a-zA-Z]+/g, () => {
		score += 2.5;
		return ' ';
	});
	content = content.replace(/[\d\.]+/g, () => {
		score += 1;
		return ' ';
	});
	content = content.replace(/[\u4e00-\u9fa5]/g, () => {
		score += 1;
		return ' ';
	});
	return Math.floor(score);
};

AI.OpenAI.list = async () => {
	var request = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.openai
		},
	};
	var url = 'https://api.openai.com/v1/models';

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('OpenAI', 'List: ' + (time / 1000) + 's');

	response = await response.json();
	response = response.data || response;
	return response;
};
AI.OpenAI.chat = async (conversation, model=DefaultOpenAIChatModel, options={}) => {
	var messages = assembleMessages(conversation);
	var data = assembleDataPack(model, messages, options);

	var request = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.openai
		},
		body: JSON.stringify(data),
	};
	var url = "https://api.openai.com/v1/chat/completions";

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('OpenAI', 'Chat: ' + (time / 1000) + 's');

	response = await response.json();
	var usage = response.usage;
	if (!!usage) {
		logger.info('OpenAI', `Usage: Input ${usage.prompt_tokens}, Output: ${usage.completion_tokens}`);
	}
	var reply = response.choices;
	if (!!reply) reply = reply[0];
	if (!reply) {
		reply = "";
	}
	else {
		reply = (reply.message?.content || '').trim();
	}

	return reply;
};
AI.OpenAI.draw = async (prompt, model=DefaultOpenAIDrawModel, options={}) => {
	var data = {
		model,
		prompt,
		n: options.n || 1,
		quality: options.quality || 'standard', // standard or hd
		size: options.size || "1024x1024",
		style: options.style || 'vivid', // vivid or natural
	};
	var request = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.openai
		},
		body: JSON.stringify(data),
	};
	var url = "https://api.openai.com/v1/images/generations";

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('OpenAI', 'Chat: ' + (time / 1000) + 's');

	response = await response.json();
	var reply = response.data;
	if (!reply) return [];
	reply = reply.map(item => item.url);
	return reply;
};

AI.MoonShot.list = async () => {
	var request = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.moonshot
		},
	};
	var url = 'https://api.moonshot.cn/v1/models';

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('MoonShot', 'List: ' + (time / 1000) + 's');

	response = await response.json();
	response = response.data || response;
	return response;
};
AI.MoonShot.chat = async (conversation, model=DefaultMoonShotChatModel, options={}) => {
	var messages = assembleMessages(conversation, false);
	var data = assembleDataPack(model, messages, options);

	var request = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.moonshot
		},
		body: JSON.stringify(data),
	};
	var url = "https://api.moonshot.cn/v1/chat/completions";

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('MoonShot', 'Chat: ' + (time / 1000) + 's');

	response = await response.json();
	var usage = response.usage;
	if (!!usage) {
		logger.info('MoonShot', `Usage: Input ${usage.prompt_tokens}, Output: ${usage.completion_tokens}`);
	}
	var reply = response.choices;
	if (!!reply) reply = reply[0];
	if (!reply) {
		reply = "";
	}
	else {
		reply = (reply.message?.content || '').trim();
	}

	return reply;
};

AI.DeepSeek.list = async () => {
	var request = {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.deepseek,
		},
	};
	var url = 'https://api.deepseek.com/models';

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('DeepSeek', 'List: ' + (time / 1000) + 's');

	response = await response.json();
	response = response.data || response;
	return response;
};
AI.DeepSeek.chat = async (conversation, model=DefaultDeepSeekChatModel, options={}) => {
	var messages = assembleMessages(conversation, false);
	var data = assembleDataPack(model, messages, options);

	var request = {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json",
			"Authorization": 'Bearer ' + myInfo.apiKey.deepseek
		},
		body: JSON.stringify(data),
	};
	var url = "https://api.deepseek.com/chat/completions";

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('DeepSeek', 'Chat: ' + (time / 1000) + 's');

	response = await response.json();
	var usage = response.usage;
	if (!!usage) {
		logger.info('DeepSeek', `Usage: Input ${usage.prompt_tokens}, Output: ${usage.completion_tokens}`);
	}
	var reply = response.choices;
	if (!!reply) reply = reply[0];
	if (!reply) {
		reply = "";
	}
	else {
		reply = (reply.message?.content || '').trim();
	}

	return reply;
};