# 01 · How TestSprite actually works

Written for someone who has not used it yet. Evidence tags and source keys are defined in `README.md`.
Everything here is from the v0.15.0 CLI (2026-10-17) and its repo, not from the docs site alone, because the docs site
lags the CLI (see `02-portal-vs-cli.md`).

## 1. The model in one paragraph

TestSprite is a **hosted testing service with a thin command-line client**. You (or your coding agent) *describe* a
test. TestSprite's cloud *runs* it against your *live, reachable* app, and hands back a *structured verdict*. The
client never drives a browser or executes your tests; it uploads descriptions, triggers runs, waits, and downloads
results. [V DOC:1572 "Design principles"; `sources/testsprite-cli/VISION.md` "A thin, well-behaved client"]

Two kinds of test:

- **Frontend (FE)** — you write *plain-language steps* ("Click Add to cart", "Verify the cart badge shows 1"). A cloud
  AI agent drives a real browser through them. TestSprite turns what it did into a saved Playwright (Python) script
  that later reruns replay. [V DOC:162-205 plan format; `sources/docs/cli/core/creating-tests.md`]
- **Backend (BE)** — you write *Python* (`requests` + assertions). The cloud executes the file top to bottom in a
  sandbox against your API's URL. There is no AI in the loop on the test body; the AI part is generating proposals
  and analysing failures. [V VERIFY:196-206]

## 2. Glossary

| Term | Meaning | Source |
|---|---|---|
| Workspace | Container for projects, tests, keys, and a credit balance. Personal or shared. Your API key decides which workspace you act in; the CLI has no "switch workspace". | [V CLID:concepts/key-terms] |
| API key | `sk-member-…` (workspace key, the only kind you can mint now) or legacy `sk-user-…`. Carries *scopes*. | [V WEB:admin/api-keys; CLID:concepts/key-terms] |
| Scopes | `read:me`, `read:projects`, `read:tests`, `write:tests`, `write:projects`, `run:tests`, `run:tunnel`. A missing scope is named in `details.requiredScope`. | [V DOC:1426-1440] |
| Project | One application under test. Typed `frontend` or `backend` — never mixed. Holds environments, tests, history. | [V CLID:concepts/key-terms; CLID:core/running-tests] |
| Environment | A named bundle of **URL + sign-in + variables** a run opens (e.g. `staging`). `--env <name>` selects it. | [V HELP:project-env-create] |
| Test | FE: ordered `planSteps[]` (action / assertion). BE: Python code with optional `--produces`/`--needs`/`--category teardown`. | [V HELP:test-create] |
| Run | One execution of a test, identified by `runId`. Verdicts: `passed`, `failed`, `blocked`, `cancelled`. | [V CLID:concepts/key-terms] |
| Test status | 9 values: draft, ready, queued, running, passed, failed, blocked, cancelled, unknown. | [V same] |
| Blocked | Run rejected or starved before a real verdict (e.g. a dependency failed, or login could not complete). **Not** the same as failed. | [V WEB:core/api/dependency-chains] |
| Failure bundle | One self-consistent package for a failing run: failing step ±1, DOM snapshots as text, test source, root-cause hypothesis, recommended fix target. Every item shares one `snapshotId`; the CLI refuses to mix runs. | [V CLID:concepts/the-agent-loop] |
| `codeVersion` | Version token of a test's stored code; guards `test code put` against overwrites. | [V HELP:test-code-put] |
| Credit | The unit that cloud execution consumes. Separate from LLM tokens. | [V CLID:concepts/key-terms] |
| V2 / V3 | Two generations of the platform. `auth status --output json` exposes `v3Enabled`. Local tunnels, `plan generate`, and several features are V3-only. | [V DRY:auth-status; DOC:488] |
| Tunnel | A client-side process that proxies the cloud runner's traffic to `localhost:<port>` for the lifetime of the command. FE only. | [V DOC:797-870] |
| Wave | Execution order for BE tests: producers → consumers → `teardown` last. `test run --all` is wave-ordered. | [V VERIFY:479-488] |
| Feature map | TestSprite's structured list of your product's features and use cases, built from PRD + exploration/discovery; plans are scoped to it. Editable in the portal. | [V WEB:concepts/key-terms; WEB:core/working-with-test/coverage-map] |
| Proposals | Staged AI-suggested test cases from `test plan generate`, held server-side until you `accept`. | [V DOC:609-710] |

## 3. What runs where

| Thing | Where | Notes |
|---|---|---|
| The `testsprite` CLI, plan/code files, `.testsprite/` dir, `--dry-run`, `test lint`, `test scaffold` | **Your machine** | `lint`, `scaffold`, `create --plan-template`, `agent install` are pure-local (no network, no key). [V DOC:356-380] |
| Browser sessions (FE), Python sandbox (BE), exploration, plan generation, test code generation, auto-heal, failure analysis | **TestSprite cloud** | The cloud must be able to *reach your target*. [V CLID:concepts/the-agent-loop "cloud is a black box"] |
| Traffic to your `localhost` during an FE `--local` run | **Cloud → tunnel → your machine** | Lives only while that command runs. Dev servers can take ~a minute per page through it; the CLI recommends a built server. [V HELP:test-run; DOC:797-870] |
| Credentials for *your app* | Stored encrypted per environment in TestSprite | Separate from the API key that authenticates the CLI. [V WEB:concepts/key-terms] |
| API key | `~/.testsprite/credentials` (INI, 0600) or `TESTSPRITE_API_KEY` | Env var overrides the file. [V DOC:1315-1317] |

## 4. The agent loop, and why it is cheap in tokens

```
agent changes code
   └─ behavior already covered by the suite?
        ├─ no  → testsprite test create … --run --wait     (new test, banked on pass)
        └─ yes → testsprite test rerun  … --wait            (replay existing)
              cloud runs it against the real app           ← agent is idle here
              ├─ pass → suite grows, move on
              └─ fail → testsprite test artifact get <run-id>  (one bundle)
                          agent reads bundle → fixes code → rerun
```
[V CLID:concepts/the-agent-loop]

Why this spends so few LLM tokens: `--wait` **long-polls inside the CLI with its own backoff**, so the agent makes one
tool call and gets back one result; it never polls or reads a browser transcript. [V VERIFY:428-429 "`--wait`
long-polls … don't wrap it in a retry loop"] What the agent *does* read is small and structured: JSON with stable
shapes and a documented exit-code contract (0 passed, 1 failed/blocked/cancelled, 7 timeout/unsupported, 12 out of
credits, …). [V DOC:1519-1537] The expensive thing is the **credits**, not the tokens.

Caveat found while verifying (not in TestSprite's docs): in Claude Code a command that exits non-zero counts as a
"failure" tool result and its output is truncated to about 10,000 characters head-and-tail with **no file path**,
whereas a successful result over about 30,000 characters is saved to a file with a 2,000-character preview. TestSprite
exits **1** for an ordinary failed test, so large failing outputs (`test run --all --wait --output json`) can lose their
middle. [V SPEC:tools-reference.md:166-185] The plugin design handles this (doc 05, `sprite-run`).

## 5. Frontend vs backend, side by side

| | Frontend | Backend |
|---|---|---|
| Target | Public URL, or `localhost` through a tunnel (V3). | **Public HTTP URL** hard-coded in your test (`BASE_URL`). `--local` is refused for BE. [V VERIFY:26-34; HELP:test-run] |
| You author | `planSteps[]` JSON → `test create --plan-from`; or accept generated proposals. | Python file → `test create --code-file`; or accept generated proposals (needs an API spec). |
| Who writes the executable code | TestSprite (generated Playwright, saved). | You. "There is no server-side codegen on the CLI." [V VERIFY:175-176] |
| Auth to your app | Environment sign-in: `public` / `account` (user+password) / `otp` (TestSprite-managed inbox/phone) / `manual` (SSO captured once in the portal). | Project credential (`public` / Bearer / API key / basic) injected as `__AUTH_HEADERS__`; or `auto-auth` (Pro) that fetches a fresh token each run. [V VERIFY:208-239; HELP:project-credential, project-auto-auth] |
| Ordering | Independent; each test self-contained. | Dependency graph via `--produces` / `--needs`; teardown last. |
| Rerun | Replays saved script; **auto-heal on by default**. | Re-runs producer/consumer/teardown **closure** (0.2 credit); `--skip-dependencies` for one. Auto-heal ignored. |
| Sandbox | Real browser. | Stdlib + `requests`, `pytest`, `numpy`, `scipy` only; no importing your own code. File is executed top to bottom — **you must call your `test_*` functions** or it passes vacuously. [V VERIFY:183-206; `sources/npm-pack/package/dist` scaffold template] |
| Generation | Live exploration of the running app. | From an uploaded OpenAPI/Postman/doc file; REST-first. [V WEB:core/api/api-discovery] |

## 6. The pipeline: sources → feature map → tests

```
 PRD (optional, 0.5 credit)  ┐
 API spec (FE: n/a, BE: needed, free)  ├─► [exploration (FE only, minutes)] ─► feature map ─► strategy ─► proposals ─► accept ─► tests ─► run/rerun
 live app exploration (FE)   ┘                                                    (portal-editable)                (staged,    (free)
                                                                                                                    server-side)
```
[V DOC:609-710 `test plan generate` stages "exploration, strategy, proposals"; CLID:"exploration, then the feature map,
then the proposals"; WEB:core/ui/feature-exploration; WEB:core/working-with-test/coverage-map]

What this means in practice:

- `testsprite test plan generate --project <id>` runs **only the stages still missing** and stops with proposals staged.
  Ctrl-C *pauses*: the running stage finishes, later stages wait, re-running continues. Credits are charged per stage that
  actually runs. [V HELP:test-plan-generate]
- Nothing is written to your disk; you review a printed table (or the portal) and `test plan accept`. Accepting a
  **subset discards the rest**, and an unknown `--only` id aborts before sending. [V DOC:685-709]
- You **cannot edit a proposal** from the CLI, and you cannot edit the feature map or re-run exploration — those are portal
  actions. [V DOC:708; WEB:core/ui/feature-exploration "Re-explore"]
- A FE project whose login is not stored explores **public pages only** and still bills; store the test account first
  (`project update --username … --password-file …`). [V DOC:683]
- Local (tunnel) projects skip all of this: `plan generate` is refused before charge (exit 6). Author plans by hand.
  [V DOC:488]

## 7. The named features, decoded

| Feature | What it really is | Where you touch it | Status |
|---|---|---|---|
| **Feature map** | Features → use cases → test cases tree built from PRD + exploration. Plans are scoped to it. Inline-editable; "Regenerate from sources" discards all use cases and their tests, irreversibly. | Portal "Test Coverage" | [V WEB:working-with-test/coverage-map, managing-test-cases] |
| **Exploration** | Parallel cloud agents walk the live FE app feature by feature (~3 min for an average app), recording real selectors/copy. | `plan generate` (stage 1); re-explore = portal | [V WEB:ui/feature-exploration] |
| **Auto-heal** | On an FE **rerun**, if the page drifted but the feature works, the agent re-binds the script and the test passes; a real bug stays failed. Default on for CLI reruns; `--no-auto-heal` opts out. | `test rerun`, `test run` | [V HELP:test-rerun] |
| Auto-heal **persistence** | CLI help: "the agent re-authors the test and the new code **replaces the stored version**." Portal: "Auto-Heal doesn't overwrite it unless you explicitly save." These disagree. | — | **[U3]** |
| **Rerun** | Replay what's saved; no new plan/code generation. Billed like a fresh run. | `test rerun` | [V CLID:core/rerun-and-auto-heal] |
| **Flaky check** | Replay N times with auto-heal **off**, report stability. N × rerun price. | `test flaky --runs 1..10` | [V HELP:test-flaky] |
| **Dynamic variables** | A value one BE test captures (token, created id) and later tests consume; drives wave ordering. | `--produces` / `--needs` | CLI flags [V]; **how Python exports the value is undocumented [U1]** |
| **Dependency chains / Blocked** | Consumers wait for producers; if a producer fails, consumers are *Blocked*, not Failed. | automatic | [V WEB:api/dependency-chains] |
| **Auto cleanup** | After every run, TestSprite deletes records your tests created (children first); needs a matching DELETE endpoint; 404 counts as success. Portal docs describe generated tests; **whether it covers CLI-authored code is unknown [U4]**. CLI-side equivalent you control: a `--category teardown` test. | portal / `--category` | [V WEB:api/auto-cleanup] |
| **Data Flow view** | Per-test "captures / consumes" panel and per-run Dynamic Variables tab. | Portal only | [V WEB:api/dynamic-variables] |
| **Auto-Auth** | Configure a login/refresh flow once; fresh token before every BE run. Pro. | `project auto-auth` | [V HELP:project-auto-auth] |
| **Smart Rerun** | Not found in any doc. Closest real things: producer→consumer cascade on rerun, and `schedule`. | — | **[V absent]** |

## 8. Credits vs tokens

| Spend | Unit | Source |
|---|---|---|
| FE run / rerun (V3) | 0.5 credit each; local tunnel runs too | [V HELP:test-rerun; ONBOARD §5] |
| BE rerun; BE integration tests inside `run --all` | 0.2 credit each | [V HELP:test-rerun; CHG 0.15.0] |
| BE fresh run per test | not stated; "check `testsprite usage`" | [V CLID:concepts/key-terms] → treat as **[U]** |
| `test flaky --runs N` | N × rerun price | [V HELP:test-flaky] |
| `project docs upload --role prd` | 0.5 (once per document); `api-doc` free | [V DOC:710-735] |
| `test plan generate` | per stage that runs; amount not published | [V HELP:test-plan-generate] |
| `test plan accept`, `project credential`, `test create` (no `--run`), reads | free | [V HELP:test-plan-accept, project-credential] |
| `project auto-auth`, schedules | plan-gated (Pro); each schedule firing bills like a run | [V HELP:project-auto-auth; DOC:1014-1068] |
| Cancelling an FE V3 run before terminal | charge returned (attempted; check `refund.status`); BE and V2 keep billing | [V HELP:test-cancel] — the docs site still says "no refund" |
| Balance | `testsprite usage` → `credits`, `subPlan`, `creditsPerRun`, `v3Enabled` | [V DRY:usage] |

Tokens are spent only by your coding agent reading and writing: plan JSON, results, bundles. Rough shape: a green
single-test loop is a few hundred tokens of tool output; a failure bundle is the large item, which is why the plugin
reads bundles in a subagent (doc 05).

## 9. Two end-to-end examples

### A. Frontend: a deployed storefront

| # | Who | What | Credits |
|---|---|---|---|
| 1 | you, once | `npm install -g @testsprite/testsprite-cli`; `testsprite setup --no-agent` (paste API key) | 0 |
| 2 | agent | `testsprite project create --type frontend --name "Shop" --url https://shop-preview.example.com --username qa@example.com --password-file ./.secrets/qa-pass` | 0 |
| 3 | agent | `testsprite project docs upload ./docs/prd.md --project <id> --role prd` | 0.5 |
| 4 | agent, background | `testsprite test plan generate --project <id>` — cloud explores the app (minutes) → feature map → ~12 proposals staged | per stage |
| 5 | agent + you | reads the table, drops two vague ones, `testsprite test plan accept --project <id> --only prop_1 prop_2 prop_4 …` (all wanted ids in one call) | 0 |
| 6 | agent | smoke-runs 2–3: `testsprite test run <test-id> --wait --timeout 600 --output json` | 0.5 each |
| 7 | cloud | real browser, pass/fail, video, DOM snapshots, root-cause hypothesis | — |
| 8 | agent | on exit 1: `testsprite test artifact get <run-id> --out ./.testsprite/runs/<run-id>` (parent dir must exist), reads the bundle, decides *plan problem vs product bug*, fixes code | 0 |
| 9 | agent | `testsprite test rerun <test-id> --wait` after the fix is deployed | 0.5 |

### B. Backend: an orders API with a dependency chain

| # | Who | What |
|---|---|---|
| 1 | agent | `testsprite project create --type backend --name "Orders API" --url https://api-staging.example.com` (on V3 the URL is required for backend too) [V HELP:project-create] |
| 2 | you | `testsprite project credential <id> --type "Bearer token" --credential-file ./.secrets/api-token` (free; value never in argv) |
| 3 | agent | writes `login.py`, `create_order.py`, `cleanup.py` — each calls its own `test_*()` at the bottom and reads `__AUTH_HEADERS__` |
| 4 | agent | `testsprite test create --type backend --project <id> --name "login issues token" --code-file login.py --produces auth_token`, then `… create_order.py --needs auth_token --produces order_id`, then `… cleanup.py --needs order_id --category teardown` |
| 5 | agent, background | `testsprite test run --all --project <id> --wait --output json` → producers, consumers, then teardown; output enumerates `accepted`, `conflicts`, `deferred`, `skippedFrontend` |
| 6 | agent | if `create_order` is red, read the **earliest failed wave** first: a failed producer starves every consumer ("failed-downstream") [V VERIFY:527-533] |

Honest gap: step 3 does not say *how `login.py` hands `auth_token` to the next test*. The CLI declares the dependency;
the Python-side mechanism is not in any document I could read **[U1]**. The first spike in doc 08 resolves it.

## 10. Pre-research claims, checked

| Claim | Verdict |
|---|---|
| 3.0: PRD/spec → editable feature map that drives everything | **Partly.** PRD is optional ("strongly recommended"); map is built from PRD *plus* exploration/discovery; editable in the portal only; "doesn't override exploration". [V WEB:getting-started/overview, concepts/key-terms] |
| FE: fleet of parallel agents, tests from findings, auto-heal | **Mostly.** Parallel exploration ✓; heal is rerun-only, plan-gated on the portal, and its persistence is unresolved. "Fleet" is not a doc term. |
| BE: integration tests, Dynamic Variables, Auto Cleanup, Data Flow, Auto-Auth | **True** as portal features. **"Smart Rerun" appears nowhere.** |
| `npm install -g …` | **Confirmed:** `@testsprite/testsprite-cli`, Node ^20.19 ‖ ^22.13 ‖ ≥24. [V `sources/npm-pack/package/package.json`] |
| `setup` asks for a key and installs project skills (`testsprite-onboard`, `testsprite-verify`) | **Confirmed, and now three skills** (`testsprite-ci` added in 0.15.0), landing at `.claude/skills/<name>/SKILL.md`. [V CHG 0.15.0; HELP:setup] |
| `project list`, `test list --project <id>` | ✓ |
| Runs execute in the cloud; the agent waits; few tokens | ✓ (see §4); the cost is credits. |
| Agent asks for URL and which tests; can propose new scenarios | ✓ as skill behavior (onboard/verify), not a CLI feature. |
| Portal "Create test" offers three paths: live web test, local IDE via MCP, agent/CLI | **Not found** in any portal or CLI doc. The CLI overview does describe three *surfaces* (Portal, MCP, CLI). |
