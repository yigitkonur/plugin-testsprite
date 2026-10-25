#!/bin/sh
# Fails when a tracked file contains a key-shaped string, a personal path, or a personal address.
# Run before every publish. Test fixtures plant fake secrets with the prefix ts_PLANTED_ which none of these patterns match.
cd "$(dirname "$0")/.." || exit 1
status=0
check() {
  hits=$(git ls-files -z | xargs -0 grep -InE "$2" 2>/dev/null | grep -v "^scripts/secret_scan.sh:")
  if [ -n "$hits" ]; then echo "FOUND $1:"; echo "$hits" | head -20; status=1; fi
}
check "TestSprite or GitHub key" 'sk-(member|user)-[A-Za-z0-9]{16,}|tsp_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}'
check "private key block" '-----BEGIN [A-Z ]*PRIVATE KEY-----'
check "assigned API key" 'TESTSPRITE_API_KEY=[A-Za-z0-9_-]{12,}'
check "personal home path" '/Users/[a-z]+/'
check "personal email" '[A-Za-z0-9._-]+@gmail\.com'
authors=$(git log --format='%ae %ce' 2>/dev/null | tr ' ' '\n' | sort -u | grep -v 'users.noreply.github.com' | grep -vx 'noreply@github.com' | grep -v '^$')
[ -n "$authors" ] && { echo "FOUND non-noreply commit identity:"; echo "$authors"; status=1; }
[ "$status" = 0 ] && echo "secret scan: clean"
exit $status
