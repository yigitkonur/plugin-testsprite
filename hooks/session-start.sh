#!/bin/sh
# SessionStart prefilter. Always silences the CLI's "run testsprite setup" nag (it would install duplicate skills),
# then continues to Node only when the repo is linked to a TestSprite project. Unlinked repos get no output.
if [ -n "$CLAUDE_ENV_FILE" ] && ! grep -qs 'TESTSPRITE_NO_SKILL_WARNING' "$CLAUDE_ENV_FILE" 2>/dev/null; then
  echo 'export TESTSPRITE_NO_SKILL_WARNING=1' >> "$CLAUDE_ENV_FILE"
fi
found=
d=$PWD
while :; do
  [ -f "$d/.testsprite/config.json" ] && { found=1; break; }
  [ "$d" = / ] && break
  d=$(dirname "$d")
done
if [ -z "$found" ]; then
  top=$(git rev-parse --show-toplevel 2>/dev/null) &&
    [ -n "$(git -C "$top" ls-files -- '*.testsprite/config.json' 2>/dev/null | head -n 1)" ] && found=1
fi
[ -n "$found" ] || exit 0
exec node "$(dirname "$0")/session-start.mjs" "$@"
