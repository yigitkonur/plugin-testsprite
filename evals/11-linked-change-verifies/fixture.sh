#!/usr/bin/env bash
# A web app already linked to a TestSprite project (the state right after /testsprite:init), then an ordinary change
# request that never mentions TestSprite. The plugin's SessionStart directive should make the model verify or say why not.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$HERE/../../tests/fixtures/repos/web-vite/." .
mkdir -p .testsprite
printf '{"projectId":"prj_eval","targetUrl":"http://localhost:5173"}\n' > .testsprite/config.json
git init -q
git add -A
git -c user.email=eval@example.invalid -c user.name=eval commit -qm "baseline, linked to TestSprite"
