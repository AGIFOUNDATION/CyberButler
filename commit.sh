git diff >> diff.diff

node ../AIVerse/tools/autoCommit.js -f diff.diff -e $1

rm diff.diff

read -n 1 -s -r -p "按键继续"