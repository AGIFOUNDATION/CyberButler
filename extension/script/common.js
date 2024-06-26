globalThis.DefaultLang = 'en';
globalThis.LangName = {
	'zh': "中文",
	'en': "English",
};

globalThis.ModelList = [];
globalThis.Model2AI = {
	"gemini-1.5-flash": "Gemini",
	"gemini-1.5-pro": "Gemini",
	"claude-3-5-sonnet-20240620": "Claude",
	"claude-3-opus-20240229": "Claude",
	"claude-3-haiku-20240307": "Claude",
	"gpt-4o": "OpenAI",
	"gpt-4-turbo": "OpenAI",
	"moonshot-v1-128k": "MoonShot",
	"deepseek-chat": "DeepSeek",
	"deepseek-coder": "DeepSeek",
	"glm-4": "GLM",
	"glm-4-airx": "GLM",
	"glm-4-flash": "GLM",
};
globalThis.AI2Model = {
	"gemini": [
		"gemini-1.5-flash",
		"gemini-1.5-pro",
	],
	"claude": [
		"claude-3-5-sonnet-20240620",
		"claude-3-opus-20240229",
		"claude-3-haiku-20240307",
	],
	"openai": [
		"gpt-4o",
		"gpt-4-turbo",
	],
	"moonshot": ["moonshot-v1-128k"],
	"deepseek": [
		"deepseek-chat",
		"deepseek-coder"
	],
	"glm": [
		"glm-4",
		"glm-4-airx",
		"glm-4-flash",
	],
};
globalThis.FastAI = {
	"Gemini": "gemini-1.5-flash",
	"Claude": "claude-3-5-sonnet-20240620",
	"OpenAI": "gpt-4o",
	"GLM": "glm-4-airx",
};
globalThis.DeepAI = {
	"Gemini": "gemini-1.5-pro",
	"Claude": "claude-3-opus-20240229",
	"Openai": "gpt-4-turbo",
	"GLM": "glm-4",
};
globalThis.ModelOrder = [
	"gemini",
	"claude",
	"openai",
	"moonshot",
	"deepseek",
	"glm",
];

globalThis.wait = delay => new Promise(res => setTimeout(res, delay));
globalThis.waitUntil = fun => new Promise((res, rej) => {
	const untiler = setInterval(() => {
		logger.log('Ext', 'Reactive and waiting...');
	}, 10 * 1000);

	if (isFunction(fun)) {
		if (isAsyncFunction(fun)) {
			fun()
			.then(result => res(result))
			.catch(err => rej(err))
			.finally(() => {
				clearInterval(untiler);
			});
		}
		else {
			clearInterval(untiler);
			try {
				let result = fun();
				res(result);
			}
			catch (err) {
				rej(err);
			}
		}
	}
	else {
		fun
		.then(result => res(result))
		.catch(err => rej(err))
		.finally(() => {
			clearInterval(untiler);
		});
	}
});

globalThis.newID = (len=16) => {
	var id = [];
	for (let i = 0; i < len; i ++) {
		let d = Math.floor(Math.random() * 36).toString(36);
		id.push(d);
	}
	return id.join('');
};

globalThis.calculateHash = async (content, algorithm='SHA-256') => {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);

	var buffer = await crypto.subtle.digest(algorithm, data);

	const hashArray = Array.from(new Uint8Array(buffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
};

/* Log Utils */

globalThis.logger = {};
logger.log = (tag, ...logs) => {
	console.log(`%c[${tag}]`, "color: blue; font-weight: bolder; padding: 2px 5px; border-radius: 5px; background-color: rgb(250, 250, 250);", ...logs);
};
logger.info = (tag, ...logs) => {
	console.info(`%c[${tag}]`, "color: green; font-weight: bolder; padding: 2px 5px; border-radius: 5px; background-color: rgb(250, 250, 250);", ...logs);
};
logger.warn = (tag, ...logs) => {
	console.warn(`%c[${tag}]`, "color: magenta; font-weight: bolder; padding: 2px 5px; border-radius: 5px; background-color: rgb(250, 250, 250);", ...logs);
};
logger.error = (tag, ...logs) => {
	console.error(`%c[${tag}]`, "color: red; font-weight: bolder; padding: 2px 5px; border-radius: 5px; background-color: rgb(250, 250, 250);", ...logs);
};
logger.em = (tag, ...logs) => {
	console.log(`%c[${tag}]`, "background-color: blue; color: white; font-weight: bolder; padding: 2px 5px; border-radius: 5px; border: 1px solid white;", ...logs);
};
logger.strong = (tag, ...logs) => {
	console.log(`%c[${tag}]`, "background-color: red; color: white; font-weight: bolder; padding: 2px 5px; border-radius: 5px; border: 1px solid white;", ...logs);
};
logger.blank = (tag, ...logs) => {
	console.log(`%c[${tag}]`, "background-color: black; color: white; font-weight: bolder; padding: 2px 5px; border-radius: 5px; border: 1px solid white;", ...logs);
};

/* Type Tools */

globalThis.AsyncFunction = (async function() {}).__proto__;
globalThis.isArray = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Array;
globalThis.isString = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === String;
globalThis.isNumber = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Number;
globalThis.isBoolean = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Boolean;
globalThis.isObject = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Object;
globalThis.isFunction = obj => obj !== null && obj !== undefined && !!obj.__proto__ && (obj.__proto__.constructor === Function || obj.__proto__.constructor === AsyncFunction);
globalThis.isAsyncFunction = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === AsyncFunction;

/* Auxillary Utils and Extends for DateTime */

const WeekDayNames = {
	enS: ['Sun', "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
	enL: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
	zhM: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
	zhT: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
};

const getLongString = (short, len=2, isLeft=true) => {
	var long = short + '';
	while (long.length < len) {
		if (isLeft) long = '0' + long;
		else long = long + '0';
	}
	return long;
};
const getInfoStrings = (info, type) => {
	var short, long;

	if (type === 'Y') {
		long = info + '';
		short = long.substring(2);
	}
	else if (type === 'ms') {
		short = info + '';
		long = getLongString(info, 3, false);
	}
	else {
		short = info + '';
		long = getLongString(info);
	}

	return [short, long];
};
globalThis.timestmp2str = (time, format) => {
	if (isString(time) && !isString(format)) {
		format = time;
		time = null;
	}
	if (!isString(format)) format = "YYYY/MM/DD hh:mm:ss";

	time = time || new Date();
	if (isNumber(time)) time = new Date(time);

	var [shortYear       , longYear       ] = getInfoStrings(time.getYear() + 1900, 'Y');
	var [shortMonth      , longMonth      ] = getInfoStrings(time.getMonth() + 1, 'M');
	var [shortDay        , longDay        ] = getInfoStrings(time.getDate(), 'D');
	var [shortHour       , longHour       ] = getInfoStrings(time.getHours(), 'h');
	var [shortMinute     , longMinute     ] = getInfoStrings(time.getMinutes(), 'm');
	var [shortSecond     , longSecond     ] = getInfoStrings(time.getSeconds(), 's');
	var [shortMilliSecond, longMilliSecond] = getInfoStrings(time.getMilliseconds(), 'ms');
	var weekdayES = WeekDayNames.enS[time.getDay()];
	var weekdayEL = WeekDayNames.enL[time.getDay()];
	var weekdayZM = WeekDayNames.zhM[time.getDay()];
	var weekdayZT = WeekDayNames.zhT[time.getDay()];

	format = format.replace(/:wde:/g, weekdayES);
	format = format.replace(/:WDE:/g, weekdayEL);
	format = format.replace(/:wdz:/g, weekdayZM);
	format = format.replace(/:WDZ:/g, weekdayZT);

	if (!!format.match(/YYYY+/)) {
		format = format.replace(/YYYY+/g, longYear);
	}
	else if (!!format.match(/Y+/)) {
		format = format.replace(/Y+/g, shortYear);
	}
	if (!!format.match(/MM+/)) {
		format = format.replace(/MM+/g, longMonth);
	}
	else if (!!format.match(/M+/)) {
		format = format.replace(/M+/g, shortMonth);
	}
	if (!!format.match(/DD+/)) {
		format = format.replace(/DD+/g, longDay);
	}
	else if (!!format.match(/D+/)) {
		format = format.replace(/D+/g, shortDay);
	}
	if (!!format.match(/hh+/)) {
		format = format.replace(/hh+/g, longHour);
	}
	else if (!!format.match(/h+/)) {
		format = format.replace(/h+/g, shortHour);
	}
	if (!!format.match(/mm+/)) {
		format = format.replace(/mm+/g, longMinute);
	}
	else if (!!format.match(/m+/)) {
		format = format.replace(/m+/g, shortMinute);
	}
	if (!!format.match(/ss+/)) {
		format = format.replace(/ss+/g, longSecond);
	}
	else if (!!format.match(/s+/)) {
		format = format.replace(/s+/g, shortSecond);
	}
	if (!!format.match(/xxx+/)) {
		format = format.replace(/xxx+/g, longMilliSecond);
	}
	else if (!!format.match(/x+/)) {
		format = format.replace(/x+/g, shortMilliSecond);
	}

	return format;
};