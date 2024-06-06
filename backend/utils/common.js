const newID = (len=16) => {
	var id = [];
	for (let i = 0; i < len; i ++) {
		let d = Math.floor(Math.random() * 36).toString(36);
		id.push(d);
	}
	return id.join('');
};
const isArray = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Array;
const isString = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === String;
const isNumber = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Number;
const isBoolean = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Boolean;
const isObject = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === Object;
const isFunction = obj => obj !== null && obj !== undefined && !!obj.__proto__ && (obj.__proto__.constructor === Function || obj.__proto__.constructor === AsyncFunction);
const isAsyncFunction = obj => obj !== null && obj !== undefined && !!obj.__proto__ && obj.__proto__.constructor === AsyncFunction;

module.exports = {
	newID,
	isArray, isString, isNumber, isBoolean, isObject, isFunction, isAsyncFunction
};