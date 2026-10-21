# TestSprite concepts

Verified against CLI 0.15.0 and its repository. Items marked **unverified** are listed with ids in `docs/design/09-evidence-ledger.md`.

## The model

Hosted service plus thin client. The CLI uploads descriptions, triggers runs, waits, and downloads results; it never drives a browser or executes your tests. Everything runs in TestSprite's cloud and must be able to reach the target.

- **Frontend (FE) test:** ordered plain-language steps (`action` / `assertion`). A cloud agent drives a real browser; TestSprite turns what it did into a saved Playwright script that reruns replay.
- **Backend (BE) test:** Python you write (`requests` and asserts). The cloud runs the file top to bottom in a sandbox against a public HTTP URL. No AI runs the test body; AI is used for proposals and failure analysis.

## Terms

| Term | Meaning |
|---|---|
| Workspace | Container for projects, tests, keys and a credit balance. The API key decides the workspace; the CLI cannot switch. |
| API key / scopes | Workspace keys carry scopes (`read:me`, `read:projects`, `read:tests`, `write:tests`, `write:projects`, `run:tests`, `run:tunnel`). A missing scope is named in the error. |
| Project | One application under test, typed `frontend` or `backend`, never mixed. Holds environments, tests, history. |
| Environment | Named bundle of URL, sign-in, and variables a run opens; selected with `--env`. |
| Run / verdict | One execution. Verdicts: `passed`, `failed`, `blocked`, `cancelled`. **Blocked** means no real verdict (a dependency failed, login could not complete); it is not the same as failed. |
| Failure bundle | One self-consistent package for a failing run: failing step with neighbors, DOM text, test source, root-cause hypothesis, recommended fix target, all sharing one snapshot id. |
| `codeVersion` | Token guarding `test code put` against overwriting newer code. |
| Credit | The unit cloud execution consumes; separate from LLM tokens. |
| V2 / V3 | Two platform generations. `testsprite auth status --output json` exposes `v3Enabled`. Local tunnels and `plan generate` are V3 only. |
| Tunnel | Client-side process proxying the cloud runner to `localhost:<port>` while a command runs. Frontend only. |
| Wave | BE execution order: producers, then consumers, then `teardown` last. |
| Feature map | TestSprite's tree of features and use cases built from a PRD plus live exploration. Editing it is portal-only. |
| Proposals | Staged AI-suggested tests from `test plan generate`, held server-side until accepted. |

## What runs where

| Thing | Where |
|---|---|
| The CLI, plan and code files, `.testsprite/` directory, `--dry-run`, `test lint`, `test scaffold` | The user's machine |
| Browser sessions, the Python sandbox, exploration, plan generation, code generation, auto-heal, failure analysis | TestSprite's cloud |
| Traffic to `localhost` during an FE `--local` run | Cloud, through the tunnel, to the user's machine, only while the command runs |
| Credentials for the app under test | Stored encrypted per environment in TestSprite (distinct from the CLI API key) |
| The CLI API key | `~/.testsprite/credentials` or `TESTSPRITE_API_KEY` (the env var wins) |

## Frontend vs backend

| | Frontend | Backend |
|---|---|---|
| Target | Public URL, or `localhost` through a tunnel (V3) | Public HTTP URL written into the test; `--local` is refused |
| You author | Plan JSON, or accept generated proposals | Python file, or accept proposals generated from an uploaded API spec |
| Who writes executable code | TestSprite | You (no server-side code generation on the CLI) |
| App auth | Environment sign-in: public, account, otp, manual (SSO captured once in the portal) | Project credential injected as `__AUTH_HEADERS__`, or auto-auth (Pro) |
| Ordering | Independent tests | Dependency graph with `--produces` / `--needs`; teardown last |
| Rerun | Replays the saved script; auto-heal on by default | Reruns the producer/consumer/teardown closure; auto-heal ignored |
| Sandbox | Real browser | Standard library, `requests`, `pytest`, `numpy`, `scipy` only; you cannot import the app's code |

## Pipeline

PRD (optional) and API spec feed, with live exploration (FE), a feature map, then a strategy, then staged proposals. `test plan generate` runs only the stages still missing and bills per stage that runs. `test plan accept` creates tests from proposals; naming a subset discards the rest, so give all wanted ids in one call. Proposals cannot be edited from the CLI. Local (tunnel) projects skip generation: author plans by hand.

## Named features, decoded

| Feature | What it is | Status |
|---|---|---|
| Exploration | Parallel cloud agents walk the live FE app and record real selectors and copy | verified |
| Auto-heal | On an FE rerun, if the page drifted but the feature works, the agent re-authors the script; real bugs stay failed. On by default for CLI reruns; `--no-auto-heal` opts out | field-verified: **the healed code replaces the stored version** (`codeVersion` went up) |
| Rerun | Replays what is saved; billed like a fresh run. A frontend replay runs stored code whose assertions can be just "page loaded": a fresh `test run` (agent + AI judge) is the verdict on a change | field-verified |
| Flaky check | Replays N times with auto-heal off | verified |
| Dynamic variables | A value one BE test captures for later tests; declared with `--produces` / `--needs`. The runner records the producer's HTTP responses and the consumer reads `__VARS__["<name>"]` | field-verified |
| Dependency chains | A failed producer leaves consumers blocked, not failed | verified |
| Auto cleanup | Deletes records created by generated tests after a run | portal-documented; **does not clean up after CLI-authored tests** (field-verified), so write an explicit teardown |
| Integration tests (auto-assembled) | Generated from a produces/needs chain on the first backend `--all`; run after each batch at 0.2 | field-verified; can pass vacuously, read once |
| Data Flow view, Auto-Auth | Portal inspection panel; token refresh before each BE run (Pro) via `project auto-auth` | portal / verified |
| "Smart Rerun" | Appears in no documentation | treat as marketing; do not design around it |
