globalThis.AI = globalThis.AI || {};
globalThis.AI.Claude = {};

const DefaultChatModel = AI2Model.claude[0];

AI.Claude.list = async () => {
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
	logger.info('Claude', 'List: ' + (time / 1000) + 's');

	response = await response.json();
	return response;
};
AI.Claude.chat = async (conversation, model=DefaultChatModel, options={}) => {
	var prompt = [];
	var data = {
		model,
		top_k: options.top_k || 3,
		temperature: 1.0,
		max_tokens: 4096,
		messages: prompt,
	};
	var request = {
		method: "POST",
		headers: {
			Accept: "application/json",
			"content-type": "application/json",
			// Client: this.clientID,
			"x-api-key": myInfo.apiKey.claude,
			"anthropic-version": "2023-06-01",
			"anthropic-beta": "messages-2023-12-15",
		},
	};
	var url = "https://api.anthropic.com/v1/messages";

	conversation.forEach(item => {
		if (item[0] === 'system') {
			data.system = item[1];
		}
		else if (item[0] === 'human') {
			prompt.push({
				role: 'user',
				content: item[1]
			});
		}
		else if (item[0] === 'ai') {
			prompt.push({
				role: "assistant",
				content: item[1]
			});
		}
	});
	if (prompt[prompt.length - 1].role !== 'assistant') {
		prompt.push({
			role: 'assistant',
			content: ''
		});
	}
	request.body = JSON.stringify(data);

	var response, time = Date.now();
	try {
		response = await waitUntil(fetch(url, request));
	}
	catch (err) {
		throw err;
	}
	time = Date.now() - time;
	logger.info('Claude', 'Chat: ' + (time / 1000) + 's');

	response = await response.json();
	var reply = response.content;
	if (!!reply) reply = reply[0];
	if (!reply) {
		reply = "";
	}
	else {
		reply = reply.text;
	}

	return reply;
};