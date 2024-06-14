rm diff.diff

printf "[CHANGES]\n\n" >> diff.diff
git status >> diff.diff
printf "\n[DIFF]\n\n" >> diff.diff
git diff >> diff.diff

if [ -z "$1" ]
then
	node ../AIVerse/tools/autoCommit.js -f diff.diff
else
	node ../AIVerse/tools/autoCommit.js -f diff.diff -e $1
fi