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

`testsprite auth status --output json`, `testsprite usage`, `testsprite doctor` (network: connectivity and key validity).

## 2. Coverage assessment (free, isolated)

Delegate to the `coverage-auditor` agent with the detection JSON and the project id. It returns: surfaces mapped to tests, gaps ranked by user-visible risk, stale tests, suite health counts, hygiene flags (inlined credentials, drafts never run), and a fit verdict per unit. It runs nothing that costs credits.

## 3. Propose a run plan (the decision point)

Counts times price: frontend 0.5 credit, backend 0.2. Offer, with costs:

- (a) failing and blocked only: `testsprite test rerun --all --project <id> --status failed,blocked --wait`
- (b) everything fresh: `testsprite test run --all --project <id> --wait`
- (c) named tests
- (d) no runs

A rerun needs a prior replayable run; never-run tests need `test run`. **Wait for the user's choice.** Silence is not consent.

## 4. Run, in the background

The chosen command with `--timeout 900` and `--summary-file .testsprite/tmp/summary.json`; optionally `--report junit --report-file .testsprite/tmp/junit.xml`. Frontend reruns auto-heal by default; add `--no-auto-heal` for a strict regression pass. Capture output to files.

## 5. Account for every member

Read `accepted[]`, `conflicts[]`, `deferred[]`, `skippedFrontend` from the summary. Anything not terminal is **not green**; exit 0 alone proves nothing. Never drop a failed member from the set.

## 6. Classify failures

Pass failing run ids to `failure-triager` (at most five per call; several calls in parallel for more). Classes: app-bug, plan-defect, test-code-defect, environment, auth, flaky, starvation, inconclusive ([triage](../testsprite/references/triage.md)). For a starvation case start from the earliest failed producer.

## 7. Heal check

For each **passed** frontend rerun compare `codeVersion` before and after (`testsprite test get <id>`). A changed version on a healed pass: flag "heal modified stored code" (whether heal overwrites stored code is unverified). Do not count a healed pass as release proof.

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
