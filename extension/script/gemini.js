/*
"urls": {
	"chatComplete": "https://generativelanguage.googleapis.com/v1beta/models/"
},
"temperature": 1,
"top_p": 1,
"top_k": 3,
"max_token": 8192,
"stopSequences": [],
"safetySettings": [
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
],
"interval": 300,
"rate_limit": 1000,
"n": 1,
*/

const PromptHintHuman = "input: ";
const PromptHintAI = "output: ";

const assembleConversationOld = conversation => {
	var prompt = conversation.map(item => {
		if (item[0] === 'system') {
			return {
				text: item[1]
			};
		}
		else if (item[0] === 'human') {
			return {
				text: PromptHintHuman + item[1]
			};
		}
		else if (item[0] === 'ai') {
			return {
				text: PromptHintAI + item[1]
			};
		}
		else return null;
	});
	if (prompt[prompt.length - 1].text.indexOf(PromptHintAI) < 0) prompt.push({
		text: PromptHintAI
	});
	prompt = {
		contents: [{
			parts: prompt
		}]
	};
	return prompt;
};
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

globalThis.callGemini = async (conversation, model='gemini-1.5-flash') => {
	var prompt = assembleConversation(conversation);
	prompt.generationConfig = {
		temperature: 1.0,
		topP: 1,
		topK: 3,
		candidateCount: 1,
		maxOutputTokens: 8192,
		stopSequences: [],
	};
	prompt.safetySettings = [
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

	var response;
	try {
		response = await fetch(url, request);
	}
	catch (err) {
		throw err;
	}
	response = await response.json();

	var reply = response.candidates[0];
	if (!reply) {
		reply = "";
	}
	else {
		reply = reply.content.parts[0];
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