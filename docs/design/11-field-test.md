# 11 · Field test: a real app, the real TestSprite cloud (2026-10-21)

The first time this plugin met the live service. It was a one-month trial account (Starter plan, V3-routed, `run:tunnel` scope), CLI 0.15.0, and a small full-stack app built for the purpose: **Seatbook**, an event-RSVP page plus a JSON API, Node with zero dependencies and an in-memory store. Expectations were written before every run. The full log, with commands and verbatim output, lives in the demo repo (`testsprite-demo-seatbook/EXPERIMENT.md`, kept private). This page keeps what changes the plugin.

**Spend:** 25.2 credits of 550, about $3 of model usage for the headless plugin sessions, and cents of Railway for the public phase.

## What was run

| Phase | What | Result |
|---|---|---|
| Local, through TestSprite's tunnel | `project create --type frontend --local 4173`; 3 hand-written plans (reserve a seat and the count drops by one; a full event refuses; a bad email is rejected) | Baseline 3/3 passed in 81 s (1.5 credits). Two deliberate bugs (capacity off-by-one; the UI not re-fetching after a booking): **exactly the two predicted tests failed**. Fix, then rerun: 2/2 passed |
| Triage | The plugin's `failure-triager`, headless, `--permission-mode default` | Two `app-bug` rows, each naming the guilty commit and line. It **rejected TestSprite's own hypothesis** for one of them ("hosting / race condition" for a plain off-by-one). **0 permission prompts** |
| Plugin dogfood | `/testsprite:audit`, and an ordinary change request in the linked repo | Audit stopped at its decision point with 0 credits spent and flagged a real hygiene issue (a guessable default admin token). The change request failed twice; each failure pointed at plugin text, which was fixed and then passed: see "Steering lessons" |
| Public (Railway) | Backend project, 6 Python tests plus teardown; spec-driven and exploration-based generation; heal | All the open unknowns below were answered |

## Unknowns answered (see doc 09)

| Id | Question | Answer |
|---|---|---|
| U1 | How does a `--produces` value reach a `--needs` test? | The runner records the producer's HTTP responses and publishes their fields in **`__VARS__`** under many spellings (`rsvp_id`, `rsvpId`, `RsvpId`, `rsvp-id`, `eventId`, …). The consumer reads `__VARS__["rsvp_id"]`; the producer exports nothing |
| U2 | Is `TARGET_URL` injected? | **No.** Neither an environment variable nor a global. Keep `BASE_URL` in the code |
| U3 | Does heal overwrite stored code? | **Yes.** `codeVersion` v1.0 → v2.0 after a heal rerun over a renamed button and test id; the CLI advisory says "the new code replaces the stored version" |
| U4 | Does Auto Cleanup cover CLI-authored tests? | **No.** Every record the suite created was still there afterwards. Write a teardown test |
| U9 | Does the hand-framed MCP-over-HTTP template work in the sandbox? | **Yes**, against a public streamable-HTTP server (`initialize`, `tools/list` over SSE) |
| U10 | V3 detection on a real account | `auth status --output json` → `v3Enabled: true`, scopes include `run:tunnel` |
| U11 | Fresh backend run price | **0.2 credit** (the same as a rerun). Frontend 0.5, tunnel or not |
| U12 | Does a spec uploaded to an existing project feed generation? | Only once it has **finished processing**. A generate run during processing froze an empty strategy (exit 6, free) that only the portal can rebuild. A fresh project with a processed spec gave 42 proposals for 3 credits |

## Facts the plugin did not have

- **TestSprite's own tunnel is the local path.** A project created with `--local <port>` opens a tunnel by itself on `test run`, `test rerun` and `test create --run`. A long-lived `tunnel start --ttl` can be borrowed with `--tunnel-client`, but in 0.15.0 only `test run` accepts it. A local run is always an agent run: no stored code (`test code get` is exit 4) and no replay (`--no-auto-heal` gives `blocked`, "Deterministic replay cannot run through a tunnel", not charged). `test plan generate` on a local project is refused before charge. → new reference `local-and-tunnels.md`.
- **A frontend replay is not a verdict.** The stored Playwright script's only assertion was `assert current_url` ("final outcome verified by the AI judge during the run"). With the stale-count bug deployed, `test rerun --no-auto-heal` **passed** and a fresh `test run` **failed** on the same test. The plugin had recommended `--no-auto-heal` replays as the strict check; it now says a fresh `test run` is the verdict on a change.
- **Several ids in one `test run` work only through a tunnel;** against a public target it is exit 5 (use `--all --filter` or one id per command).
- **The Starter plan allows one environment,** so a project cannot keep a loopback and a public environment side by side. Use `--local <port>` per run.
- **Auto-assembled integration tests.** The first backend `--all` generated one from the produces/needs chain. It runs after every batch at 0.2 credit, it is a snapshot of the member code, and **it passed vacuously**: an inlined `return` ended it after step 1.
- **Generated backend tests need triage too.** 4 of 14 reviewed and accepted proposals failed on a correct app: a fixed email shared by concurrent tests, a hardcoded `00000000-…` id, a missing producer declaration, and a "full event" test that never filled the event. One proposal asserted auth on a public endpoint (dropped at review).
- **Frontend generation** ran exploration in 41 s and gave 3 proposals for 5 credits, all variations of one flow.
- **The backend runner** is AWS Lambda (`exec(code, env)` after a prelude of about 150 lines). It pre-imports `requests, json, re, time, uuid, …` and injects `__AUTH_HEADERS__`, `__AUTH_CREDENTIAL__` (**the raw secret**), `__VARS__`, `__FIXTURES__` and `__EXTRA_HEADERS__`. Printed output is stored as `apiOutput`. A probe that printed short globals leaked the demo app's admin token into the run output. It was rotated; the plugin now says never print globals or the credential.
- **Output shapes and IDs:**
  - `codeVersion` lives in `test code get --output json`, not `test get`.
  - Test steps list only browser actions, never "note" steps or assertions.
  - Bundles are 100–136 KB: `code.py, failure.json {rootCauseHypothesis, recommendedFixTarget, evidence}, meta.json, result.json, steps/NN-*.json|html, video.webm`, and `recommendedFixTarget.kind` was `unknown` both times.
  - `tunnel stop` on a background owner makes it exit 10, which is normal.

## Steering lessons (the plugin changed because of these)

1. **Read-only agents need prompt-free reads.** In default permission mode the 0.1.1 triager's first Bash call was denied and it returned `inconclusive`. The guard's strict-read `allow` fixed it (0 prompts, real evidence). The agents now run each read alone, because compound commands still ask.
2. **The directive must say where the app runs and that the TestSprite run *is* the live check.** The first two dogfood runs followed the user's own CLAUDE.md, tried to start a second copy of the app on another port, and never invoked `verify`. Adding the saved target (`targetUrl` in `.testsprite/config.json`, shown by SessionStart) plus "test the copy already running there; never start a second copy" fixed it.
3. **One wrong sentence cost a run.** The plugin told the model to add `--no-auto-heal` for regression checks; on a local project that is a guaranteed `blocked` run. The text is fixed, and the replay lesson above replaced the advice entirely.
4. **Models will try to reset app state with a token they find in the source.** The verify skill now forbids resetting or seeding the app's data to make a test pass.
5. **Absolute paths:** agents write `mkdir -p /abs/repo/.testsprite/tmp`, so the guard now treats an absolute path into the session cwd's `.testsprite/` like the relative one.

## Still open

- `ci run`: does it replay or run fresh? Its help does not say, and the replay lesson makes this matter for a gate. Not run.
- Frontend generation with a stored test account (signed-in exploration).
- `sprite-detect` misses a plain `node server.mjs` start script with `PORT || 4173` (no `devServer`); the saved `targetUrl` covers linked repos.
