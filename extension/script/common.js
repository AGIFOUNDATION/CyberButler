globalThis.wait = delay => new Promise(res => setTimeout(res, delay));

globalThis.newID = (len=16) => {
	var id = [];
	for (let i = 0; i < len; i ++) {
		let d = Math.floor(Math.random() * 36).toString(36);
		id.push(d);
	}
	return id.join('');
};

globalThis.isArray = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Array;
globalThis.isString = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === String;
globalThis.isNumber = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Number;
globalThis.isBoolean = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Boolean;
globalThis.isObject = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Object;
globalThis.isFunction = obj => obj !== null && obj !== undefined && !!obj.__proto__ && (obj.__proto__.constructor === Function || obj.__proto__.constructor === AsyncFunction);
globalThis.isAsyncFunction = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === AsyncFunction;