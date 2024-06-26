globalThis.AI = globalThis.AI || {};
globalThis.AI.Claude = {};

const DefaultChatModel = AI2Model.claude[0];

const convertClaudeChinese = content => {
	if (!content) return '';
	content = content.trim();
	if (!content) return '';

	content = content.split(/\r*\n\r*/);
	content = content.map(line => {
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*[\(\)]|[\(\)]\s*[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/gi, (m) => {
			m = m.replace(/\s*([\(\)])\s*/g, (m, o) => {
				if (o === ',') return '，';
				if (o === ':') return '：';
				if (o === ';') return '；';
				if (o === '?') return '？';
				if (o === '!') return '！';
				if (o === '(') return '（';
				if (o === ')') return '）';
				return o;
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*[,:;\?\!]/gi, (m) => {
			m = m.replace(/\s*([,:;\?\!\(\)])\s*/g, (m, o) => {
				if (o === ',') return '，';
				if (o === ':') return '：';
				if (o === ';') return '；';
				if (o === '?') return '？';
				if (o === '!') return '！';
				if (o === '(') return '（';
				if (o === ')') return '）';
				return o;
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*\.+/gi, (m) => {
			m = m.replace(/\s*(\.+)\s*/g, (m, o) => {
				if (o.length === 1) return '。';
				return "……";
			});
			return m;
		});
		line = line.replace(/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]\s*\-{2,}|\-{2,}\s*[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/gi, (m) => {
			m = m.replace(/\s*(\-{2,})\s*/g, (m, o) => {
				return "——";
			});
			return m;
		});
		return line;
	});
	content = content.join('\n');

	return content;
};

AI.Claude.chat = async (conversation, model=DefaultChatModel, options={}) => {
	var prompt = [];
	var data = {
		model,
		top_k: options.top_k || 3,
		temperature: options.temperature || 1.0,
		max_tokens: options.max_tokens || 4096,
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
	var json = response;
	var usage = response.usage;
	if (!!usage) {
		logger.info('Claude', `Usage: Input ${usage.input_tokens}, Output: ${usage.output_tokens}`);
	}
	var reply = response.content;
	if (!!reply) reply = reply[0];
	if (!reply) {
		logger.log('Claude', "Response:", json);
		reply = "";
		let errMsg = json.error?.message || 'Error Occur!';
		throw new Error(errMsg);
	}
	else {
		reply = convertClaudeChinese(reply.text);
	}

	return reply;
};