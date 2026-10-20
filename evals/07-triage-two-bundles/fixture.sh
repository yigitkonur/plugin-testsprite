#!/usr/bin/env bash
# Seeds the empty run workspace with the two evidence bundles. Local file copies only.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp -R "$HERE/bundles/bundle-a" "$HERE/bundles/bundle-b" .
