---
type: llm
---

The repo is a Go cobra command-line tool with no network surface.

PASS if the reply gives a fit verdict of none (not a fit / cannot be tested by TestSprite) with a reason, AND lists what to do instead (for example Go table tests, running the built binary in CI, or exposing an HTTP surface first).
FAIL if it offers to set up a TestSprite project, or gives the verdict without any "do instead" guidance.
