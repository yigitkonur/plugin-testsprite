---
name: init
description: Set up TestSprite for this repo.
disable-model-invocation: true
argument-hint: "[path or unit]"
allowed-tools: Bash(sprite-state *) Bash(sprite-detect *) Bash(sprite-ref *)
---

# /testsprite:init

State collected before you read this (if a block is empty, run the command yourself):

- State: !`sprite-state --json`
- Detection: !`sprite-detect --json`

Scope: $ARGUMENTS (a path or unit; empty means every unit `sprite-detect` found). Read the `testsprite` skill's rules once. **No cloud state is created before step 7.** Stop at the first blocker and print the exact next action.

## 1. Fit gate, per unit

Use the verdicts in the detection JSON and [project-fit](../testsprite/references/project-fit.md).

- **none:** print the `TestSprite fit: none` block with the reason and the "Do instead" list, **create nothing in the cloud**, and stop for that unit. This is the right answer for a stdio-only MCP server, a CLI tool or a library.
- **partial (GraphQL, MCP over HTTP, an API that needs a public URL):** state the limit and ask whether to continue on the hand-authored path.
- **mixed:** one verdict per kind; continue only on the testable kinds.
- **full:** continue.

Warn if official `testsprite-*` skills are already installed (duplicate guidance). Do not delete them.

## 2. CLI

Missing? State `npm install -g @testsprite/testsprite-cli` (Node ^20.19 or ^22.13 or >=24; `npx @testsprite/testsprite-cli` needs no install) and **ask** before running a global install. Outside the verified range: a notice only.

## 3. Credentials (the key never enters chat)

The user creates a workspace key in the portal (Settings, API Keys) and runs `! testsprite setup --no-agent` (a masked prompt). Or they export `TESTSPRITE_API_KEY` and you run `testsprite setup --from-env --no-agent`. Never run `setup` without `--no-agent`: it installs the official skills this plugin replaces.

## 4. Verify identity and platform

`testsprite auth status --output json` for scopes (`write:projects`, `write:tests`, `run:tests`; `run:tunnel` for local), `v3Enabled`, remaining credits; `testsprite usage` for the balance and per-run price. **V2** accounts have no `--local` and no `plan generate`: hand-authored tests only. If `TESTSPRITE_API_URL` is set, warn that it overrides profiles.

## 5. Target

A deployed URL, or a local dev port (frontend, V3), or none. For a local frontend advise a **built** server (`build` plus `preview`) over a dev server through the tunnel. A backend needs a public URL: a local-only API stops here with the options in [project-fit](../testsprite/references/project-fit.md). Never start public exposure yourself.

## 6. Sign-in for the app under test

`public`; `account` (the user gives a **file path** for the password); `otp` (chosen at environment creation, cannot be switched later); SSO: hand off to the portal ([portal-handoffs](../testsprite/references/portal-handoffs.md)). Backend: a project credential by `--credential-file`, or public.

## 7. Create the project (confirm the exact command once)

Show the command, get a yes, then run it. Exact syntax: `sprite-ref help project create`. Frontend: type, name (the repo), URL or `--local`, optional account via `--password-file`. Backend: type, name, public URL. Extra environments: `sprite-ref help project env create`. Free, but it writes cloud state.

## 8. Record the link

Write `{"projectId": "<id>"}` to `<unit>/.testsprite/config.json`. Add `.testsprite/failure/`, `.testsprite/runs/` and `.testsprite/tmp/` to `.gitignore`. If the app tags elements with a custom attribute, set it with `testsprite project update <project-id> --test-id-attributes <attr>,data-testid`.

## 9. Sources

An API spec found by detection: `testsprite project docs upload <file> --project <id> --role api-doc` (free). A PRD: ask first (0.5 credit), then `--role prd`. A same-named file replaces the earlier one.

## 10. Tests

- **Generate** (V3, deployed frontend, or any backend with a spec): run `testsprite test plan generate --project <id>` in the background after the user's yes (it bills per stage and frontend exploration takes minutes; a project with no stored test account explores public pages only and still bills). Read the printed table against the source; drop proposals for flows that do not exist, duplicates and vague ones; propose an `--only` list; on the user's yes make **one** call: `testsprite test plan accept --project <id> --only prop_1 prop_2 ...` (a subset discards the rest). Editing a proposal is portal-only.
- **Hand-author** (local projects, V2, or no inputs): frontend per [authoring-frontend](../testsprite/references/authoring-frontend.md), backend per [authoring-backend](../testsprite/references/authoring-backend.md). Validate with `testsprite test lint`. Show every plan or code file once before creating it.

## 11. Smoke-run two or three, not all

`testsprite test run <id> <id> --wait --timeout 600 --output json` in the background (local frontend: add `--local <port>`). About 0.5 credit each (frontend). Keep run ids. Pass red runs to `failure-triager`.

## 12. Report

Tests created and what they cover; the runs, verdicts and links; the cost of running the rest (from `testsprite usage` and the test count); what stays in the portal (review the feature map, SSO or OTP setup, integrations); and `/testsprite:verify` and `/testsprite:ci` as next steps. Do not say the project is verified unless a run returned a verdict.
