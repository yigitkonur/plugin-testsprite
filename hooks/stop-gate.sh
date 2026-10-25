#!/bin/sh
# Stop prefilter: exits at once unless the stop gate is on and this session was recorded as linked by SessionStart.
input=$(cat)
case "${CLAUDE_PLUGIN_OPTION_STOP_GATE:-$TESTSPRITE_STOP_GATE}" in false|0|no|off|"") exit 0 ;; esac
sid=$(printf %s "$input" | sed -n 's/.*"session_id" *: *"\([^"]*\)".*/\1/p' | tr -c 'A-Za-z0-9_\n-' '_')
dir=${CLAUDE_PLUGIN_DATA:-${PLUGIN_DATA:-${TMPDIR:-/tmp}/testsprite-plugin-data}}
[ -n "$sid" ] && [ -f "$dir/sessions/$sid.json" ] || exit 0
printf %s "$input" | exec node "$(dirname "$0")/stop-gate.mjs" "$@"
