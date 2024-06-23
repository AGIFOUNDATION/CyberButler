const { join } = require('path');
const { writeFile, readFile } = require('node:fs/promises');

const Manifest = "backend/package.json";
const Targets = {
	"README.md": "markdown",
	"extension/manifest.json": "json",
	"backend/package.json": "json",
	"backend/package-lock.json": "json",
};

const fromFile = async (filepath, type='markdown') => {
	try {
		let data = await readFile(filepath, 'utf-8');
		if (!data) {
			if (type === 'json') return {};
			return "";
		}
		if (type === 'json') {
			data = JSON.parse(data);
			return data;
		}
		return data;
	}
	catch {
		if (type === 'json') return {};
		return "";
	}
};

const parseVersion = version => {
	version = version.split('.');
	var result = {
		major: 0,
		minor: 0,
		code: 0,
		mark: ''
	};
	version.some((num, i) => {
		if (i === 3) {
			result.mark = num;
		}
		else if (i > 3) {
			return true;
		}
		else {
			let value = num * 1;
			if (isNaN(value)) {
				result.mark = num;
				return true;
			}
			else {
				if (i === 0) result.major = value;
				else if (i === 1) result.minor = value;
				else if (i === 2) result.code = value;
			}
		}
	});
	return result;
};
const fromVersion = version => {
	var str = version.major + '.' + version.minor + '.' + version.code;
	if (!!version.mark) str = str + '.' + version.mark;
	return str;
};

const versionUp = async (up, mark) => {
	// Get Version
	var version = join(__dirname, Manifest);
	version = await fromFile(version, 'json');
	version = version.version;
	var oldV = version;

	version = parseVersion(version);
	version.mark = (mark || '').trim();
	if (up === 1) version.code ++;
	else if (up === -1) version.code = Math.max(version.code - 1, 0);
	else if (up === 2) {
		version.code = 0;
		version.minor ++;
	}
	else if (up === -2) {
		version.code = 0;
		version.minor = Math.max(version.minor - 1, 0);
	}
	else if (up === 3) {
		version.code = 0;
		version.minor = 0;
		version.major ++;
	}
	else if (up === -3) {
		version.code = 0;
		version.minor = 0;
		version.major = Math.max(version.major - 1, 0);
	}
	var newV = fromVersion(version);

	await Promise.all(Object.keys(Targets).map(async filename => {
		var type = Targets[filename];
		filename = join(__dirname, filename);
		var data = await fromFile(filename, type);
		if (type === 'json') {
			data.version = newV;
			data = JSON.stringify(data, true, '\t');
		}
		else {
			data = data.replace(/(\n[>\-\+\*\s]*version:\s*)(\d+(\.\d+)*(\.[\w\d\-_ ]+)?)(\s*\n)/gi, (m, bra, version, unuse1, unuse2, ket) => {
				return bra + newV + ket;
			});
		}
		await writeFile(filename, data, 'utf-8');
	}));

	return [oldV, newV];
};

const start = async (up, mark) => {
	if (up < -3 || up > 3 || isNaN(up)) up = 0;

	var result = await versionUp(up, mark);
	if (!result) {
		console.error('Version Info Update Failed!');
	}
	else {
		let [o, n] = result;
		console.log('All Version Info Updated: ' + o + ' -=> ' + n);
	}
};

start(process.argv[2] * 1, process.argv[3]);