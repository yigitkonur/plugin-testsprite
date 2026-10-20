---
name: verify
description: Use after a code change in a repo linked to a TestSprite project, before reporting done: run or create the covering test and report the verdict, or say why it is unverified.
allowed-tools: Bash(sprite-state *) Bash(sprite-detect *) Bash(sprite-ref *)
---

# Verify a change with TestSprite

Goal: before you tell the user a change is done, get **at least one terminal verdict** from TestSprite for it, or say plainly why you could not. Unit tests, typechecks and lint do not count; neither does drafting a plan without running it.

Read the `testsprite` skill's rules first if you have not this session. Arguments: $ARGUMENTS (what changed, optional).

## 0. Decide whether to run

Skip, and say so, for docs-only edits (`*.md`, `docs/**`, comments), pure build or config edits (lockfile bumps, lint and compiler config, `.github/**`), and edits to test files themselves. Otherwise run. This skill does not rely on pre-executed shell blocks, so collect state yourself:

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

Deployed change: wait until it is live; a run before then verifies the previous build. Local frontend change: the test runs with `--local <port>` (V3). Local backend change: cannot run; deploy a preview or report unverified.

## 4. Run, in the background

Pick the cheapest honest check (exact flags: `sprite-ref help test run`, `sprite-ref help test rerun`):

- Existing test, small change: a rerun replays saved code with auto-heal on, which is lenient. For a **new** change prefer a fresh `test run`.
- New frontend test: `test create --plan-from <file> --run --wait`.
- New backend test: `test create --type backend ... --code-file <file> --run --wait`. With dependencies, run the whole project (`test run --all --project <id> --wait`) so the wave engine orders producers, consumers and teardown.
- Use `--output json`, `run_in_background`, and write output to `.testsprite/tmp/` when it can be large. Keep the run id from the early stderr receipt.

A command that costs more than the user expects (several tests, `--all`) gets the count and an estimate first; the guard will ask as well.

## 5. If it is red

Do not edit app code yet. Pass the run ids to the `failure-triager` agent (or read [triage](../testsprite/references/triage.md)). A **plan defect**: tighten the plan with `test plan put` and rerun **once**, then stop. An **app bug**: report it with the evidence; do not auto-fix on the recommendation alone. **Inconclusive**: say so and ask.

## 6. Report

One line per test: `id · name · verdict`, the dashboard link, and on red the class plus one line of evidence. Or: `Unverified because <reason>`. A rerun or healed pass is feedback; for release confidence say a fresh run against the deployed revision is still needed.
