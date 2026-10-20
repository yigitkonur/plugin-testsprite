#!/bin/sh
# PreToolUse prefilter: only a Bash command that mentions testsprite reaches Node, so unrelated commands cost a shell and a grep.
# This replaces `if: Bash(testsprite *)` filters, which match a literal command prefix and miss `npx -y @testsprite/...`,
# `./node_modules/.bin/testsprite`, `env X=1 testsprite` and `time testsprite`, all of which guard.mjs understands.
input=$(cat)
case $input in
  *testsprite*) ;;
  *) exit 0 ;;
esac
printf %s "$input" | exec node "$(dirname "$0")/guard.mjs"
