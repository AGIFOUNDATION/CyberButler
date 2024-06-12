git diff >> diff.diff

if [ -z "$1" ]
then
	node ../AIVerse/tools/autoCommit.js -f diff.diff
else
	node ../AIVerse/tools/autoCommit.js -f diff.diff -e $1
fi

rm diff.diff

read -n 1 -s -r -p "按键继续"