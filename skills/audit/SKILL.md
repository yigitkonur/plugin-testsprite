---
name: audit
description: Assess coverage of the linked TestSprite project, run it, classify failures.
disable-model-invocation: true
argument-hint: "[unit]"
allowed-tools: Bash(sprite-state *) Bash(sprite-detect *) Bash(sprite-ref *)
---

# /testsprite:audit

State collected before you read this (if a block is empty, run the command yourself):

- State: !`sprite-state --json`
- Detection: !`sprite-detect --json`

Scope: $ARGUMENTS (a unit path; empty means every linked unit). Read the `testsprite` skill's rules once. If no unit is linked, offer `/testsprite:init` and stop. If a unit's fit is `none`, print the fit message ([project-fit](../testsprite/references/project-fit.md)) and skip it.

## 1. Preflight (free)

`testsprite auth status --output json`, `testsprite usage`, `testsprite doctor` (network: connectivity and key validity), each as its own call with no pipes, `export` or `;` (a lone read needs no approval). Doctor always warns "Verify skill: not installed here; run `testsprite setup`" (the nag opt-out does not cover it): ignore that line and never run `setup` because of it.

## 2. Coverage assessment (free, isolated)

Delegate to the `coverage-auditor` agent with the detection JSON and the project id. It returns: surfaces mapped to tests, gaps ranked by user-visible risk, stale tests, suite health counts, hygiene flags (inlined credentials, drafts never run), and a fit verdict per unit. It runs nothing that costs credits.

## 3. Propose a run plan (the decision point)

Counts times price: frontend 0.5 credit, backend 0.2. Offer, with costs:

- (a) failing and blocked only, replayed: `testsprite test rerun --all --project <id> --status failed,blocked --wait` (cheap signal; a frontend replay pass is not proof, see [agent-loop](../testsprite/references/agent-loop.md))
- (b) everything fresh: `testsprite test run --all --project <id> --wait`
- (c) named tests
- (d) no runs

A rerun needs a prior replayable run; never-run tests need `test run`. **Wait for the user's choice.** Silence is not consent.

## 4. Run, in the background

The chosen command with `--timeout 900` and `--summary-file .testsprite/tmp/summary.json`; optionally `--report junit --report-file .testsprite/tmp/junit.xml`. Frontend reruns are replays of stored code with auto-heal on; a replay pass is a weak signal (thin stored assertions). Option (b) (fresh runs) is the one that re-judges every plan. Never add `--no-auto-heal` to a local tunnel run (`blocked`). Run `mkdir -p .testsprite/tmp`, then send stdout (`--output json`) and stderr to files there (`> .testsprite/tmp/<name>.json 2>&1`).

## 5. Account for every member

Read `accepted[]`, `conflicts[]`, `deferred[]`, `skippedFrontend` and `skippedIntegration` (assembled integration tests, run from the portal) from the command's own JSON output; a rerun adds `notFound[]` (no replayable run) and its dependency `closure`. The `--summary-file` JSON holds only totals and per-run rows (`total`, `passed`, `failed`, `skipped`, `timedOut`, `runs[]`). Anything not terminal is **not green**; exit 0 alone proves nothing, because skipped and deferred members do not change it. Never drop a failed member from the set.

## 6. Classify failures

Pass failing run ids to `failure-triager` (at most five per call; several calls in parallel for more). Classes: app-bug, plan-defect, test-code-defect, environment, auth, flaky, starvation, inconclusive ([triage](../testsprite/references/triage.md)). For a starvation case start from the earliest failed producer.

## 7. Heal check

For each **passed** frontend rerun on a public target compare `codeVersion` before and after (`testsprite test code get <id> --output json`; a local tunnel run never stores code). A higher version means heal re-authored and replaced the stored script: flag "heal modified stored code". Do not count a healed or replayed pass as release proof.

## 8. Act per class (show each write first)

- app-bug: report with evidence; no auto-fix.
- plan-defect: `testsprite test plan put <id> --steps <file>`, then **one** rerun.
- test-code-defect: `testsprite test code get <id> --out <file>`, edit, `testsprite test code put <id> --code-file <file> --expected-version <v>`.
- flaky: `testsprite test flaky <id> --runs 5` (about 2.5 credits frontend; the guard asks).
- environment or auth: `project env update`, `project sign-in set`, `project credential`; no test edits.
- starvation: fix the earliest failed producer first.

Never widen a pass by editing assertions after a failure.

## 9. Report

Coverage and gaps; health counts; per-class counts; credits spent (`usage` before and after); what changed; what is open; portal hand-offs (coverage-map editing, insights, integrations). Print only; do not write a report file unless asked.
