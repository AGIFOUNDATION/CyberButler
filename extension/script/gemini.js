globalThis.AI = globalThis.AI || {};
globalThis.AI.Gemini = {};

const DefaultChatModel = 'gemini-1.5-flash';
const DefaultEmbeddingModel = 'text-embedding-004';

const assembleConversation = conversation => {
	var sp = '';
	var prompt = [];
	conversation.forEach(item => {
		if (item[0] === 'system') {
			sp = {
				parts: {
					text: item[1]
				}
			};
		}
		else if (item[0] === 'human') {
			prompt.push({
				role: "user",
				parts: [
					{
						text: item[1]
					}
				]
			});
		}
		else if (item[0] === 'ai') {
			prompt.push({
				role: "model",
				parts: [
					{
						text: item[1]
					}
				]
			});
		}
	});
	prompt = {
		contents: prompt
	};
	if (!!sp) {
		prompt.system_instruction = sp;
	}
	return prompt;
};

AI.Gemini.list = async () => {
	var url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + myInfo.apiKey;
	var request = {
		method: "GET",
		headers: {
			"content-type": "application/json",
		},
	};

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('Gemini', 'List: ' + (time / 1000) + 's');

	response = await response.json();
	return response;
};
AI.Gemini.chat = async (conversation, model=DefaultChatModel, options={}) => {
	var prompt = assembleConversation(conversation);
	prompt.generationConfig = {
		temperature: options.temperature || 1.0,
		topP: options.topP || 1,
		topK: options.topK || 3,
		candidateCount: options.candidateCount || 1,
		maxOutputTokens: options.maxOutputTokens || 8192,
		stopSequences: options.stopSequences || [],
	};
	prompt.safetySettings = options.safetySettings || [
		{
			"category": "HARM_CATEGORY_HARASSMENT",
			"threshold": "BLOCK_NONE"
		},
		{
			"category": "HARM_CATEGORY_HATE_SPEECH",
			"threshold": "BLOCK_NONE"
		},
		{
			"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
			"threshold": "BLOCK_NONE"
		},
		{
			"category": "HARM_CATEGORY_DANGEROUS_CONTENT",
			"threshold": "BLOCK_NONE"
		}
	];

	var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ':generateContent?key=' + myInfo.apiKey;
	var request = {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(prompt),
	};

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('Gemini', 'Chat: ' + (time / 1000) + 's');

	response = await response.json();
	var reply = response.candidates;
	if (!!reply) reply = reply[0];
	if (!reply) {
		reply = "";
	}
	else {
		reply = reply.content?.parts;
		if (!!reply) reply = reply[0];
		if (!reply) {
			reply = "";
		}
		else {
			reply = reply.text || "";
			reply = reply.trim();
		}
	}

	return reply;
};
AI.Gemini.embed = async (title, content, model=DefaultEmbeddingModel, options={}) => {
	var request = {
		title,
		content: {
			parts: [
				{
					text: content
				}
			]
		},
		taskType: options.taskType || "RETRIEVAL_DOCUMENT",
		// outputDimensionality: 16,
	};

	var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ':embedContent?key=' + myInfo.apiKey;
	request = {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(request),
	};

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('Gemini', 'Embed: ' + (time / 1000) + 's');

	response = await response.json();
	return response.embedding?.values;
};