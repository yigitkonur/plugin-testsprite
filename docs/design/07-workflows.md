# 07 · The four workflows, step by step, with the primitive that does each step

Source keys and evidence tags: see `README.md`. Every `testsprite …` line below is traced by the flag-trace check (doc 08) against the packaged 0.15.0 help.
Primitive legend: **S** skill body · **PX** skill pre-execution (`` !`…` ``, user-invoked skills only) · **H** hook · **A** subagent · **B** `bin/` helper · **CLI** `testsprite` · **U** you.
"BG" = run with `run_in_background` (long or fan-out commands; the harness re-invokes the model when the command exits). [V SPEC:tools-reference.md:Background commands]

Cross-cutting rules (every workflow):
- **Cost gate:** class-B commands pass through the guard (`ask`); class-A single runs do not (doc 06 §3.2).
- **Capture:** anything that can print > 10 KB on a non-zero exit goes to a file (`sprite-run` or `> file`), and stderr receipts (`Run <runId>`, `Dashboard: <url>`) are kept. [V SPEC:tools-reference.md:166-176; VERIFY:436]
- **Exit codes → action**, never retried blindly: 1 failed/blocked/cancelled → triage; 7 timeout → `test wait <run-id>` (never re-trigger); 11 rate-limited → back off; **12 out of credits and 13 feature-gated → stop, show the server's message and link**; 14 upgrade the CLI. [V DOC:1519-1537; VERIFY:455]
- **Honest end states only:** a verdict, or `Unverified because <X>`.

---

## 1. `/testsprite:init` — set a repo up

| # | Prim. | Step | Command / action | Spend · gate |
|---|---|---|---|---|
| 0 | PX | Load state | `sprite-state --json`, `sprite-detect --json` (if pre-execution is disabled by policy, the body tells the model to run them) | 0 |
| 1 | S | **Fit gate** per unit (doc 04 §10) | `none` ⇒ print "Do instead", **stop, create nothing in the cloud**. `partial` ⇒ ask. `mixed` ⇒ pick testable units | 0 · user decision |
| 2 | S/U | CLI present and in range? | If missing: state `npm install -g @testsprite/testsprite-cli` (Node ^20.19 ‖ ^22.13 ‖ ≥24) and **ask** before running a global install; `npx @testsprite/testsprite-cli` is the zero-install form. Out of verified range ⇒ notice only [V package.json engines; DOC:34-45] | system change · ask |
| 3 | U | **Auth** (the key never enters chat) | You create a workspace key in the portal (Settings → API Keys), then run `! testsprite setup --no-agent` (masked prompt) — or export `TESTSPRITE_API_KEY` and the model runs `testsprite setup --from-env --no-agent`. Guard class E asks if `--no-agent` is missing | 0 |
| 4 | CLI | Verify identity, scopes, platform | `testsprite auth status --output json` ⇒ `scopes` (needs `write:projects`, `write:tests`, `run:tests`; `run:tunnel` for local), `v3Enabled`, `activeOrg.remaining`; `testsprite usage` ⇒ `credits`, `creditsPerRun`. **V2** ⇒ no `--local`, no `plan generate`: only hand-authored tests. `TESTSPRITE_API_URL` set ⇒ warn (it overrides profiles) [V DRY:auth-status, DRY:usage; DOC:1315-1317, 1345-1346] | 0 |
| 5 | S/U | **Target** | Deployed URL, or local dev port (FE, V3), or none. FE local ⇒ advise a *built* server (`npm run build` + preview) over a dev server through the tunnel. BE ⇒ must be a public URL; local-only API ⇒ stop with the §4 options of doc 04 [V HELP:test-run; DOC:797-870] | 0 |
| 6 | S/U | **Sign-in** | none ⇒ `public`; account ⇒ you provide a *file path* for the password; OTP ⇒ say "chosen at environment creation, cannot be switched later, TestSprite-managed inbox/phone"; SSO ⇒ **hand off to portal** (manual capture; feature-flagged, exit 13 if off) [V DOC:537-552] | 0 |
| 7 | CLI | **Create the project** (confirm the exact command once) | `testsprite project create --type frontend --name "<repo>" --url <url> --username <user> --password-file <path>` · local: `… --local <port>` · backend: `testsprite project create --type backend --name "<repo>" --url <public-url>` (on V3 the URL is required for backend too) [V HELP:project-create]. Extra environments: `testsprite project env create <project-id> --name <env> --url <url> --sign-in <mode>` | free · writes cloud state |
| 8 | S | Record linkage | Write `{"projectId": "<id>"}` to `<unit>/.testsprite/config.json`; add `.testsprite/failure/`, `.testsprite/runs/`, `.testsprite/tmp/` to `.gitignore`. If the repo tags elements with a custom attribute: `testsprite project update <project-id> --test-id-attributes data-element,data-testid` [V ONBOARD §2b] | local edit |
| 9 | CLI | BE credential | `testsprite project credential <project-id> --type "Bearer token" --credential-file <path>` (free) or `--type public`; recurring tokens: `testsprite project auto-auth <project-id> --method password …` (Pro) [V HELP] | free / Pro |
| 10 | CLI/H | **Sources** | API spec found by `sprite-detect` ⇒ `testsprite project docs upload <spec> --project <id> --role api-doc` (free). PRD present ⇒ ask, then `… --role prd` (0.5 credit; guard class B asks). A same-named file **replaces** the earlier one [V DOC:728, 730] | 0 / 0.5 |
| 11A | CLI·BG/H | **Generate** (V3, deployed FE or any BE with a spec) | `testsprite test plan generate --project <id>` (BG; guard asks; FE exploration takes minutes; no stored test account ⇒ public pages only, still billed [V DOC:683]). Ctrl-C/timeout ⇒ re-run to continue; a completed stage is never charged twice [V HELP:test-plan-generate] | credits per stage |
| 11A′ | S/U | **Review, then accept** | The model reads the printed table against the source, drops nonexistent flows/duplicates/vague ones, proposes an `--only` list; you confirm; **one call**: `testsprite test plan accept --project <id> --only prop_1 prop_2 prop_4`. A subset discards the rest; an unknown id aborts before sending. Editing a proposal ⇒ **portal** [V DOC:685-709] | free |
| 11B | S/CLI | **Hand-author** (local projects, V2, or no inputs) | FE: `testsprite test scaffold > first.plan.json` or `testsprite test create --plan-template`; write plans per `authoring-frontend.md`; `testsprite test lint --plan-from-dir ./plans`; `testsprite test create-batch --plan-from-dir ./plans` (≤ 50). BE: `testsprite test scaffold --type backend --out tests/health.py`, write per `authoring-backend.md`, then `testsprite test create --type backend --project <id> --name "<behavior>" --code-file tests/health.py` (+ `--produces/--needs/--category teardown`). `--dry-run` validates a plan with no network [V DOC:162-205, 370-380] | free |
| 12 | CLI·BG | **Smoke-run 2–3, not all** | `testsprite test run <id> <id> --wait --timeout 600 --output json` (local FE: add `--local <port>`; several ids share one tunnel, 5 at a time). Keep receipts. [V ONBOARD §5; VERIFY:429-433] | 0.5 each (FE) |
| 13 | A | Triage any red | `failure-triager` with the run IDs ⇒ class table | 0 |
| 14 | S | **Report** | "N tests cover <flows>; ran M, results + links; running the rest ≈ X credits (`testsprite usage`); portal items still open: review the feature map, SSO/OTP, integrations." Mentions `/testsprite:verify` and `/testsprite:ci` | — |

Stops: fit none · no credentials · no reachable target · exit 12/13 · user declines a gate. Each stop prints the exact next action. No cloud state is created before step 7.

---

## 2. `/testsprite:audit` — assess an existing setup, run it, separate app bugs from test problems

| # | Prim. | Step | Command / action | Spend · gate |
|---|---|---|---|---|
| 0 | PX | Load state | `sprite-state --json`, `sprite-detect --json`. Not linked ⇒ offer `/testsprite:init` and stop | 0 |
| 1 | CLI | Preflight | `testsprite auth status --output json`; `testsprite usage`; `testsprite doctor` (network; reports connectivity and key validity) [V DOC:1289-1311] | 0 |
| 2 | **A** | **Coverage assessment** (free, read-only) | `coverage-auditor` gets the detect JSON + project ID. It reads routes/pages/endpoints/MCP tools and `testsprite test list --project <id> --output json`, `testsprite test list --project <id> --status failed,blocked`, drafts, `testsprite test result <id> --history --source cli --since 30d` for a sample. Returns: surfaces↔tests table, gaps by user-visible risk, stale tests, health counts, hygiene flags, fit verdict | 0 |
| 3 | S/U | **Proposed run plan** (the decision point) | Options with costs from counts × 0.5 FE / 0.2 BE: (a) failing+blocked only: `testsprite test rerun --all --project <id> --status failed,blocked --wait` ; (b) everything fresh: `testsprite test run --all --project <id> --wait` ; (c) named ids ; (d) no runs. A rerun needs a prior replayable run; never-run (draft/ready) tests need `test run`. You choose | gate · ask |
| 4 | CLI·BG | **Run** | The chosen command with `--timeout 900 --summary-file .testsprite/tmp/summary.json` and optionally `--report junit --report-file .testsprite/tmp/junit.xml`. FE reruns auto-heal by default; add `--no-auto-heal` for a strict regression pass [V HELP:test-rerun] | credits |
| 5 | S | **Account for every member** | `accepted[]`, `conflicts[]`, `deferred[]`, `skippedFrontend`/`skippedIntegration`; anything not terminal ⇒ **not green**; exit 0 alone proves nothing [V VERIFY:479-488; MINE-BE step 13] | 0 |
| 6 | **A** | **Classify failures** | `failure-triager` (≤ 5 runs per call; parallel for more). Classes: `app-bug · plan-defect · test-code-defect · environment · auth · flaky · starvation · inconclusive` | 0 |
| 7 | S | **Heal check** | For each *passed* FE rerun, compare `codeVersion` before/after (`testsprite test get <id>` / `test code get <id>`); a changed version on a healed pass ⇒ flag "heal modified stored code" **[U3]** | 0 |
| 8 | S/U | **Act per class** (each write shown first) | app-bug ⇒ report with evidence, no auto-fix [V VERIFY:560-562]. plan-defect ⇒ `testsprite test plan put <id> --steps fixed.json`, then **one** rerun. test-code-defect ⇒ `testsprite test code get <id> --out cur.py`, edit, `testsprite test code put <id> --code-file cur.py --expected-version <v>`. flaky ⇒ `testsprite test flaky <id> --runs 5` (≈ 2.5 credits FE; guard asks). environment/auth ⇒ `project env update`, `project sign-in set`, `project credential`; no test edits. starvation ⇒ fix the earliest failed producer first | per action |
| 9 | S | **Report** | Coverage %, gaps, health, per-class counts, what was spent (`usage` before/after), what changed, what is open, **portal hand-offs** (coverage map editing, insights, integrations) | — |

Never: widen a pass by editing assertions after a failure; drop a failed member from the set; treat a healed pass or rerun as release proof. [V MINE-BE rules 7–8, 10; MINE-FE rule 7]

---

## 3. `verify` — after a change (self-triggering, also `/testsprite:verify`)

| # | Prim. | Step | Command / action | Spend · gate |
|---|---|---|---|---|
| 0 | H | Context already present | SessionStart told the model the project is linked; Stop gate is the backstop | 0 |
| 1 | S | Should this run? | Skip docs-only, pure config/build, no credentials (say so as "unverified because …"). Otherwise run [V VERIFY:39-50] | 0 |
| 2 | B | State | `sprite-state --json` ⇒ CLI, auth, project (nearest `.testsprite/config.json` → `$TESTSPRITE_PROJECT_ID` → `project list` name match → ask) | 0 |
| 3 | S | Map diff → unit → test | `git diff --stat`; units from `sprite-detect`; existing covering test via `testsprite test list --project <id> --output json` (name/description match) | 0 |
| 4 | S | Reachability | Deployed change ⇒ wait until it is live; local FE ⇒ `--local <port>`; local BE ⇒ cannot (deploy a preview or report **unverified**) [V VERIFY:19-34] | 0 |
| 5 | S/U | **Choose the cheapest honest check** | (a) existing test covers it ⇒ `testsprite test rerun <id> --env <name> --wait` (replays the saved script, heal on) or, for strict verification of a *new* change, `testsprite test run <id> --env <name> --wait` [V VERIFY:385-388]. (b) new FE behavior ⇒ draft `plan.json`, **show it once**, `testsprite test lint --plan-from plan.json`, then `testsprite test create --plan-from plan.json --run --wait --env <name> --timeout 600 --output json`. (c) new BE behavior ⇒ code file + `testsprite test create --type backend --project <id> --name "<behavior>" --code-file f.py --run --wait`. BE with dependencies ⇒ `testsprite test run --all --project <id> --wait`; `test rerun` pulls in the whole producer/teardown closure (`--skip-dependencies` only when producers were verified this round) [V VERIFY:385-418] | 0.5 / 0.2 · class A |
| 6 | CLI·BG | Run to a terminal verdict | Via `sprite-run` when large output is likely; keep `Run <runId>` | credits |
| 7 | A | On red | `failure-triager` ⇒ plan-defect ⇒ tighten once (`test plan put`) and rerun **once**, then stop; app-bug ⇒ report, do not auto-fix on the hypothesis alone [V VERIFY:534-538] | 0 |
| 8 | S | **Report** | One line per test `id · name · verdict`, dashboard link, and the triage line on red; or `Unverified because <X>` | — |

Feedback vs proof: a rerun or a healed pass is *feedback*. Before calling a release verified, trigger a **fresh** `test run` against the deployed revision. [V MINE-FE rule 9, MINE-BE step 13]

---

## 4. `/testsprite:ci` — gate pull requests, and nightly regression

Adapted from the vendor's `testsprite-ci` flow; the plugin adds the "don't add a second gate" check and a non-GitHub honest path. [V CI]

| # | Prim. | Step | Command / action | Gate |
|---|---|---|---|---|
| 0 | PX/B | State | `sprite-state`; project must already have tests, else `/testsprite:init` first | — |
| 1 | S/CLI | **Which shape** (from config, not history) | Read `.github/workflows/`, `vercel.json`, `netlify.toml`. A: the platform deploys every PR ⇒ trigger `deployment_status`. B: the workflow deploys ⇒ `pull_request` + a deploy step that writes `url=…` to `$GITHUB_OUTPUT`. Evidence only: `gh api repos/{owner}/{repo}/deployments --jq '.[] | "\(.environment) \(.ref[0:8]) \(.created_at)"'` [V CI §1] | ask if unclear |
| 2 | S/U | **Existing gate?** | Ask whether the TestSprite **GitHub App** already gates this project (portal setting). If yes, stop unless you want both [V CI "Don'ts"] | ask |
| 3 | CLI | Environment whose sign-in the gate uses | `testsprite project env list <project-id>` | — |
| 4 | CLI | Generate | `testsprite ci init github --project <project-id> --env <name>` ⇒ `.github/workflows/testsprite.yml` with one `REPLACE ME` step; regenerate with `--force` (keeps `.bak`). Show the diff | writes a file |
| 5 | S | **Finish the placeholder** | A: change `pull_request:` to `deployment_status:` and delete the placeholder (several Vercel projects ⇒ add the `github.event.deployment.environment` filter). B: replace its `run:` with the deploy commands. **Keep** what the template fixes: `testsprite ci run … --target-url "$PREVIEW_URL" --fail-on-skipped --summary-file`, `npm i -g @testsprite/testsprite-cli@latest` (no pin), skip fork/draft PRs, `if: always()` upload, job-level `concurrency`. **Never** re-judge pass/fail in YAML (`jq` + `exit 1`): `ci run`'s exit code is the gate [V CI §3] | — |
| 6 | U | **Secret** | `gh secret set TESTSPRITE_API_KEY` (paste when prompted) or `ci init github … --set-secret` (**overwrites** an existing secret ⇒ guard asks). Never in argv/YAML/logs | ask |
| 7 | CLI | Preflight | `gh auth status`; `gh secret list \| grep TESTSPRITE_API_KEY`; `actionlint .github/workflows/testsprite.yml` (if installed) [V CI §5] | — |
| 8 | U/S | **Prove on one real PR** | With your OK: commit the workflow on a branch, push, open a **non-draft** PR with no conflicts; watch check `TestSprite / testsprite-tests`; expect `Dispatched N tests.` then `CI run: x/y passed …`; artifact `testsprite-results` holds `testsprite-summary.json`. Draft PRs, conflicted PRs, and disabled Actions each fail silently in a known way [V CI §5] | outward-facing ⇒ ask |
| 9 | S | Read the result | `ci run` exit: 1 a test failed · 7 timeout/unsupported backend · 5 configuration · 4 missing test id · 3/12/13 credentials/credits/plan. Backend tests use the URL **in their code**, not `--target-url` [V CI "Reading the result"; HELP:ci-run] | — |
| 10 | S/U | Make required | Suggest branch protection on the check (your GitHub settings) | U |
| 11 | CLI | **Nightly regression** | Option 1 (cloud-scheduled; plan-gated, bills per firing; the CLI prints frequency and estimated cost first): `testsprite schedule create --name "Nightly" --target-type project --target-id <project-id> --env <name> --cron "0 3 * * *" --timezone <IANA>`. Option 2 (in CI): a `schedule:` workflow running `testsprite ci run --project <id> --env <name>` with no PR context [V DOC:1014-1068; CI "When NOT to use"] | guard asks |
| 12 | S | **Non-GitHub CI** | `ci init` only supports `github` [V HELP:ci-init]. Generic recipe: install the CLI, export `TESTSPRITE_API_KEY` as a masked secret, run `testsprite ci run --project <id> --summary-file testsprite-summary.json`, optional `--report junit --report-file <path>`; archive reports even on failure [V DOC:1468-1490]. Provider-specific YAML is the model's work, tagged **[I]** | — |
| 13 | S | Local sanity | `env \| grep TESTSPRITE_` before testing `ci run` locally: an exported `TESTSPRITE_API_URL`/`TESTSPRITE_API_KEY` overrides `--profile` [V CI "Reading the result"] | — |

For MCP-server and CLI-tool repos, `ci` only applies to a deployed HTTP/web surface (doc 04); otherwise it ends at step 0 with the fit message.

---

## 5. Who does what, at a glance

| Job | Skill | Subagent | Helper | Hook | CLI | You |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Detect project type / fit | ● | | `sprite-detect` | | | confirm |
| Know current state | ● | | `sprite-state` | SessionStart | `auth status`, `usage` | |
| Auth and keys | ● | | | guard (class D/E) | `setup`, `auth status` | **paste key** |
| Create cloud state | ● | | | guard (class F silent) | `project …`, `test create` | approve plans |
| Spend credits | ● | | `sprite-run` | **guard asks** (class B) | `test run/rerun`, `plan generate` | approve |
| Wait for the cloud | | | | | `--wait`, BG | |
| Read big evidence | | `failure-triager` | | guard (read-only) | `artifact get`, `failure get` | |
| Assess coverage | ● | `coverage-auditor` | `sprite-detect` | guard (read-only) | `test list` | |
| Say "done" honestly | ● | | | **Stop gate** | | read the verdict |
| Portal-only actions | hand-off text | | | | `test open --no-browser` | **do it** |
