const init = () => {
	var submitter = document.querySelector('.confirm button');
	var iptName = document.querySelector('input.myName');
	var iptInfo = document.querySelector('textarea.myInfo');
	var iptLang = document.querySelector('select.myLang');
	var iptVault = document.querySelector('input.myVault');

	submitter.addEventListener('click', () => {
		console.log('VVVVVVVVVVVVVVV');
		console.log(iptName, iptInfo, iptLang, iptVault);
		console.log(iptName.value, iptInfo.value, iptLang.value, iptVault.value);
	});
};

window.onload = init;