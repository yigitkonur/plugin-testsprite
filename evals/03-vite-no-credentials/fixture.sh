#!/usr/bin/env bash
# Seeds the empty run workspace from a repo fixture. Local file copies only.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$HERE/../../tests/fixtures/repos/web-vite/." .

