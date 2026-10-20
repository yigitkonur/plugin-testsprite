---
type: llm
---

PASS if the reply states that the TestSprite `ci init` command supports GitHub only (so it cannot generate GitLab config), and offers a generic recipe built on `testsprite ci run` instead of claiming vendor-provided GitLab YAML.
FAIL if it implies `ci init` works for GitLab or never says that GitHub is the only supported provider.
