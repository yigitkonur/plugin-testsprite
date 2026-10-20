#!/usr/bin/env bash
# Seeds the empty run workspace with a web app linked to a (fake) TestSprite project. Local files only.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$HERE/../../tests/fixtures/repos/web-vite/." .
mkdir -p .testsprite
printf '{"projectId": "proj_demo123"}\n' > .testsprite/config.json
