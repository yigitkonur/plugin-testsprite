#!/bin/sh
# Fails when the plugin's always-on context cost, as reported by `claude plugin details`, exceeds the budget.
# Usage: scripts/check_budget.sh [max_tokens]   (default 400; 347 measured at 0.1.0)
max=${1:-400}
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(cd /tmp && claude --plugin-dir "$root" plugin details testsprite 2>&1) || { echo "$out"; exit 1; }
echo "$out" | sed -n '/Component inventory/,/On-invoke cost/p'
n=$(echo "$out" | sed -n 's/.*Always-on: *~\{0,1\}\([0-9]*\) *tok.*/\1/p' | head -n1)
[ -n "$n" ] || { echo "could not read the always-on figure"; exit 1; }
echo "always-on: $n tokens (budget $max)"
[ "$n" -le "$max" ] || { echo "over budget"; exit 1; }
for want in "Skills (5)" "Agents (2)" "SessionStart, PreToolUse, Stop"; do
  echo "$out" | grep -qF "$want" || { echo "inventory missing: $want"; exit 1; }
done
