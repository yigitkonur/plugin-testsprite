---
name: verify
description: Use after a code change in a repo linked to a TestSprite project, before reporting done: run or create the covering test and report the verdict, or say why it is unverified.
allowed-tools: Bash(sprite-state *) Bash(sprite-detect *) Bash(sprite-ref *)
---

# Verify a change with TestSprite

Goal: before you tell the user a change is done, get **at least one terminal verdict** from TestSprite for it, or say plainly why you could not. Unit tests, typechecks and lint do not count; neither does drafting a plan without running it.

Read the `testsprite` skill's rules first if you have not this session. Arguments: $ARGUMENTS (what changed, optional).

## 0. Decide whether to run

Skip, and say so, for docs-only edits (`*.md`, `docs/**`, comments), pure build or config edits (lockfile bumps, lint and compiler config, `.github/**`), and edits to test files themselves. Otherwise run. This skill does not rely on pre-executed shell blocks, so collect state yourself, one command per call with no pipes or `;` (a lone read needs no approval; a compound command asks the user):

1. `sprite-state --json`: the CLI present and in range, an API key source (never the key), the linked project, `bgTasksDisabled`.
2. `sprite-detect --json`: the unit the change belongs to and its fit verdict.

Stop with **`Unverified because <reason>`** when: the CLI is missing (give the install command, do not install it); there are no credentials (the user runs `! testsprite setup --no-agent`); the unit's fit is `none` ([project-fit](../testsprite/references/project-fit.md)); there is no reachable target (a backend change on a machine without a public URL: offer a preview deploy); or the repo is not linked and the user does not want `/testsprite:init` now.

## 1. Find the project

Nearest ancestor `.testsprite/config.json` to the changed file, then `$TESTSPRITE_PROJECT_ID`, then a name match in `testsprite project list --output json`, then ask one short question. A wrong project wastes a run.

## 2. Map the change to a test

`git diff --stat`, then the changed files, to name the user-visible behavior. List the project's tests (`testsprite test list --project <id> --output json`, and `--status failed` for what is already red). Match by name and description; a change to a checkout component is more likely covered by "Checkout happy path" than "Login".

- **An existing test covers it:** reuse it.
- **No test covers it:** write one (frontend plan: [authoring-frontend](../testsprite/references/authoring-frontend.md); backend code: [authoring-backend](../testsprite/references/authoring-backend.md)). **Show the drafted plan or code once** and get a yes before creating; one short confirmation, let the user edit the file first.

## 3. Reachability

Deployed change: wait until it is live; a run before then verifies the previous build. Local backend change: cannot run; deploy a preview or report unverified.

Local frontend change (V3): the test reaches the app through TestSprite's own tunnel ([local-and-tunnels](../testsprite/references/local-and-tunnels.md)); never a third-party tunnel. **The port is the one saved on the project** (`targetUrl` in `.testsprite/config.json`, or `testsprite project get <id>` shows `targetUrl … (Local)`). First `curl` that URL: if the app answers, test the copy already running there and do not start a second one on another port. Only if nothing answers, start it on that port: take the start command from `devServer` in `sprite-detect --json` (or `package.json`), and prefer a built server (build, then the framework's preview or start command) over a dev server, which can take about a minute per page through the tunnel. Start it with `run_in_background`, wait until the port answers (a short curl loop with a cap, not a blind sleep), and stop only a server you started, after the run command exits. If detection gives no command or port, ask which port the app is on.

## 4. Run, in the background

Pick the cheapest honest check (exact flags: `sprite-ref help test run`, `sprite-ref help test rerun`):

- Existing frontend test: a **fresh** `test run <id> --wait`. That is an agent run: the AI judges the plan's assertions against the changed app. Do not use `test rerun` to verify a frontend change: a replay runs the stored script, whose assertions can be just "the page loaded" (in the field test a strict replay passed a deployed bug that a fresh run caught). On a local project the saved loopback URL opens the tunnel; never add `--no-auto-heal` there (`blocked`: "Deterministic replay cannot run through a tunnel").
- New frontend test on a deployed target: `test create --plan-from <file> --run --wait`. On a **local** app, `test create` has no `--local`: create it without `--run` (free), then `test run <id> --local <port> --wait` (a built server beats a dev server; the tunnel lives only while that command runs).
- New backend test: `test create --type backend ... --code-file <file> --run --wait`. With dependencies, run the whole project (`test run --all --project <id> --wait`) so the wave engine orders producers, consumers and teardown.
- Use `--output json` and `run_in_background`. When output can be large run `mkdir -p .testsprite/tmp` once, then redirect to `> .testsprite/tmp/<name>.json 2>&1` (no other shell syntax in the command) and read the file. Keep the run id from the early stderr receipt.

A command that costs more than the user expects (several tests, `--all`) gets the count and an estimate first; the guard will ask as well. Never reset, seed or clean the app's data yourself to make a test pass (not even with a token found in the code): tests bring their own data.

## 5. If it is red

Do not edit app code yet. Pass the run ids to the `failure-triager` agent (or read [triage](../testsprite/references/triage.md)). A **plan defect**: tighten the plan with `test plan put` and rerun **once**, then stop. An **app bug**: confirm the cause in source, never from the bundle's recommended fix target alone. If it sits in the code you just changed, it is your regression: fix it and rerun **once**. If it sits outside your change, report it with the evidence and do not fix it. **Inconclusive**: say so and ask.

## 6. Report

One line per test: `id · name · verdict`, the dashboard link, and on red the class plus one line of evidence. Or: `Unverified because <reason>`. A replay or healed pass is feedback; for release confidence a fresh `test run` against the deployed revision is still needed. If heal engaged, `codeVersion` went up: say that too.
