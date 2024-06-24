globalThis.AI = globalThis.AI || {};
globalThis.AI.Gemini = {};

const DefaultChatModel = AI2Model.gemini[0];
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
	var url = 'https://generativelanguage.googleapis.com/v1beta/models?key=' + myInfo.apiKey.gemini;
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

	var url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ':generateContent?key=' + myInfo.apiKey.gemini;
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
AI.Gemini.embed = async (contents, model=DefaultEmbeddingModel, options={}) => {
	model = 'models/' + model;

	var requests = [], weights = [];
	contents.forEach(item => {
		weights.push(item.content.length);
		requests.push({
			model,
			taskType: options.taskType || "RETRIEVAL_DOCUMENT",
			title: item.title,
			content: {
				parts: [{text: item.content}]
			},
			// outputDimensionality: 16,
		});
	});
	requests = {requests};
	requests = {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(requests),
	};
	var url = "https://generativelanguage.googleapis.com/v1beta/" + model + ':batchEmbedContents?key=' + myInfo.apiKey.gemini;

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, requests));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('Gemini', 'Embed: ' + (time / 1000) + 's');

	response = await response.json();
	if (!response.embeddings?.map) {
		logger.error('Gemini', "Abnormal Response:", response);
		return null;
	}
	response = response.embeddings.map((embed, i) => {
		return {
			weight: weights[i],
			vector: embed.values
		};
	});
	return response;
};