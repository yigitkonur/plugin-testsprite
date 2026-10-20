---
type: regex
pattern: '(^|\n)[^#\n]*TARGET_URL'
target:
  source: file
  path: test_mcp_server.py
match: not_contains
---
