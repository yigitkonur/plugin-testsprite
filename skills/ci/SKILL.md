---
name: ci
description: Gate pull requests (and nightly runs) with TestSprite.
disable-model-invocation: true
argument-hint: "[github | other]"
allowed-tools: Bash(sprite-state *) Bash(sprite-detect *) Bash(sprite-ref *)
---

# /testsprite:ci

State collected before you read this (if empty, run it yourself): !`sprite-state --json`

Mode: $ARGUMENTS (empty means GitHub Actions). Read [ci-shapes](../testsprite/references/ci-shapes.md) first; it holds the detail this skill only sequences. The vendor's own copy of this guidance is `sprite-ref skill ci`.

## 0. Preconditions

The project must already have tests; if not, run `/testsprite:init` first. For a stdio MCP server or a CLI tool, CI applies only to a deployed web or HTTP surface; otherwise stop at the fit message ([project-fit](../testsprite/references/project-fit.md)).

## 1. Shape

Decide A (the platform deploys every PR) or B (the workflow deploys) from `.github/workflows/`, `vercel.json`, `netlify.toml` and the platform's git integration. Deployment history is evidence only. Unclear: ask who deploys previews.

## 2. Existing gate?

Ask whether the TestSprite GitHub App already gates this project (a portal setting). If yes, stop unless the user wants both.

## 3. Environment

`testsprite project env list <project-id>`: choose the environment whose account the gate signs in with.

## 4. Generate and finish

`testsprite ci init github --project <project-id> --env <name>`, then replace the `REPLACE ME` step per shape, keeping everything the template fixes (see ci-shapes). Show the diff. Never re-judge pass/fail in YAML.

## 5. Secret

The user runs `gh secret set TESTSPRITE_API_KEY` and pastes the key when prompted. `ci init github --set-secret` overwrites an existing secret: confirm first. Never put the key in argv, YAML or logs.

## 6. Preflight and proof

`gh auth status`, `gh secret list`, `actionlint` if installed. Proving it means pushing a branch and opening a non-draft PR, which is outward-facing: **ask first**. Then watch the check. A workflow that has not run on a real PR is not onboarded; say so if the user declines.

## 7. Make it required, optionally nightly

Suggest branch protection on the check. A nightly regression is either a `schedule:` workflow running `testsprite ci run` or a cloud schedule via `testsprite schedule create` (bills per firing; plan-gated; the guard asks).

## 8. Not GitHub

`ci init` supports GitHub only. Give the generic recipe in ci-shapes and say that provider-specific YAML is your work, not the vendor's.
