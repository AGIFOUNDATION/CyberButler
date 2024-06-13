@echo off
echo [CHANGES] >> diff.diff
echo. >> diff.diff
git status >> diff.diff
echo. >> diff.diff
echo [DIFF] >> diff.diff
echo. >> diff.diff
git diff >> diff.diff

IF "%1"=="" (
    node ..\AIVerse\tools\autoCommit.js -f diff.diff
) ELSE (
    node ..\AIVerse\tools\autoCommit.js -f diff.diff -e %1
)

del diff.diff