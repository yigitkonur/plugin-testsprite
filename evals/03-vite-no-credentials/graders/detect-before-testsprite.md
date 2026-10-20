---
type: tool_order
weight: 0.5
before:
  tool: Bash
  input_match: 'sprite-(state|detect)'
after:
  tool: Bash
  input_match: '[\s"''&|;]testsprite(-cli)?\s+\S'
---
