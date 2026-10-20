#!/usr/bin/env bash
# Seeds the empty run workspace from a repo fixture. Local file copies only.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$HERE/../../tests/fixtures/repos/web-vite/." .
git init -q
git add -A
git -c user.email=eval@example.invalid -c user.name=eval commit -qm "baseline"
printf "\n// changed: show a greeting banner\nexport const banner = \"hello\";\n" >> src/App.tsx
