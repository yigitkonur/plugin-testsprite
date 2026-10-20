# 08 · Build order, how to test the plugin, risks, and open questions

Source keys and evidence tags: see `README.md`. Effort figures are **[I]** estimates for one person.

## 1. Phased build order

| Phase | Build | Exit criteria (all must hold) | Est. |
|---|---|---|---|
| **0 · Spikes** | (a) *Free*: throwaway skeleton plugin in `$TMPDIR` to resolve the Claude Code unknowns U5–U8 (§2). (b) *Free*: `command -v sprite-*` collision check. (c) *Needs the maintainer's OK, ≤ 5 credits*: resolve U1–U4, U9 against a throwaway project (§3). | Every U-tag in doc 09 is closed, or re-tagged with a reason it stays open. Docs 01/04/06/07 updated with the answers. | 1–2 d |
| **1 · Knowledge + helpers** | Manifest; `testsprite` skill + `references/`; `sprite-detect` (+ 17 fixture repos with golden JSON); `sprite-state`; `sprite-ref`; `scripts/check-flags.py` | `claude plugin validate --strict` passes; `claude plugin details` always-on ≤ 400 tokens (347 measured on the doc-05 skeleton); detect goldens green; flag-trace green against pinned 0.15.x | 2–3 d |
| **2 · Workflows + agents** | `init` (hand-author path first, then generate path), `verify`, `audit`; `coverage-auditor`, `failure-triager`; `sprite-run` **only if** dogfood shows truncation losses | Dogfood on 3 real repos (one web, one HTTP API, one MCP/CLI repo that must end in an honest "none"); eval cases 1–4, 7–9 beat baseline by Δ ≥ +0.3 | 3–4 d |
| **3 · Hooks** | 3a `SessionStart`; 3b guard; 3c Stop gate — in that order, each with stdin-fixture tests | Fixture suite green; median hook latency < 50 ms (`claude --debug`); a week of dogfood with < 1 false-positive Stop block in 20 stops; guard and Stop gate switchable off; `SessionStart` is silent unless the repo is linked (no switch in v0.1, Q17) | 2 d |
| **4 · `ci` skill** | `ci` workflow; nightly option; non-GitHub honest path | Workflow proven on a throwaway repo PR (non-draft); `schedule` path shown with guard | 1 d |
| **5 · Evals + CI for the plugin repo** | Full `evals/` suite; GitHub Actions: validate, details budget, flag-trace, hook fixtures, **nightly drift canary** (§4.5) | Green on `main`; canary issue-opening tested | 1–2 d |
| **6 · Publish** | `.claude-plugin/marketplace.json`, README, `claude plugin tag`, version-bump rule | Install from the repo's own marketplace in a clean profile; `/testsprite:init` runs on a fixture | 0.5 d |

Rule carried from the SwiftUI plugin: **bump `version` in the same commit as any shipped change** or nobody receives the fix. [V SWUI:AGENTS.md]
Build order logic: knowledge and detection first (no hooks, no spend, immediately useful), workflows next, hooks last — hooks are the part most able to annoy, so they are added only once there is a baseline to measure them against.

## 2. Phase 0a — free spikes on Claude Code behavior

| ID | Question | How | Already known |
|---|---|---|---|
| U5 | **Resolved: `<plugin>:<agent>` (observed `spike:probe`).** Does `PreToolUse` carry `agent_type` inside a plugin subagent, and what string? Is `run_in_background` in `tool_input`? | skeleton plugin with a logging hook; run a trivial agent | **Spec says yes** to `agent_type` for hooks firing in subagents [V SPEC:hooks.md:745-750] and lists `run_in_background` in the Bash input [V SPEC:hooks.md:1775-1784]; the exact plugin-scoped string is to be observed |
| U6 | **Resolved: yes, on both paths (2.1.302).** Does `` !`cmd` `` pre-execution run when the **model** invokes a skill via the Skill tool? | one user-only and one model-invocable skill, each embedding `` !`echo MARK` `` | Spec: replaced "before Claude sees the skill content" [V SPEC:skills.md:129]; the SwiftUI plugin observed otherwise on the model path [V SWUI:AGENTS.md] → design does not depend on it for `verify` |
| U7 | Does `paths:` keep a skill out of the always-on listing until a matching file is touched? | `claude plugin details` before/after adding `paths` | Spec only says it limits automatic loading [V SPEC:skills.md:416] |
| U8 | (Dropped from the critical path.) `context: fork` + `background` default | — | `background` defaults to `true` for forked skills [V SPEC:skills.md:414]; `audit` is not forked, so moot |
| U14 | Do user-only skills (`disable-model-invocation: true`) really sit outside the model's context? Spec says "Hidden"; `plugin details` counts ~20–40 tokens each | `/context` in a live session with and without the plugin | Spec table [V SPEC:skills.md:908-914] vs tool output (measured) |
| — | `CLAUDE_ENV_FILE` from `SessionStart` reaches later Bash commands in a plugin hook | export a marker, read it with `env` in a Bash call | Spec says yes [V SPEC:hooks.md:1336] |
| — | `if: Bash(testsprite *)` skips spawn for other Bash commands; compound commands; `npx` forms | `--debug` log of matched/unmatched | Spec: best-effort [V SPEC:hooks.md:450] |
| — | Exit-1 truncation: how big must a failing output be before evidence is lost? | `sprite-run` prototype vs raw, on real `test run --all` output | [V SPEC:tools-reference.md:166-176] numbers; the *TestSprite* output sizes are unmeasured |

## 3. Phase 0c — the credit spike (needs the maintainer's explicit OK; nothing is run before)

Budget ≤ 5 credits on a **throwaway project** in a dedicated workspace, deleted afterward (`project delete --confirm`, which the guard will ask about). Targets: a tiny public static page (FE) and a public echo-style HTTP API you control (BE, MCP-over-HTTP).

| ID | Question | Experiment | Max spend |
|---|---|---|---|
| U1 | How does a BE producer export `--produces <var>` from Python, and how does a consumer read it? | Two tiny tests (`login` → `profile`) with `--produces`/`--needs`; try the obvious mechanisms (module-level variable, `print`, return) and read `test get` / the run's variables | 0.2 × ~4 |
| U2 | Is `TARGET_URL` injected into BE tests? | A test that prints `globals().get("TARGET_URL")` | 0.2 |
| U3 | Does an FE heal-pass overwrite stored code? | Create a trivial FE test, change the page copy, `rerun` (heal on), compare `codeVersion` and `test code get` before/after; second run with `--no-auto-heal` | 0.5 × 3 |
| U4 | Does Auto Cleanup cover CLI-authored BE tests? | A producer that POSTs a record, no teardown test; check the record after the run | 0.2 × 2 |
| U9 | Does a hand-rolled MCP streamable-HTTP test (doc 04 §6) work in the requests-only sandbox, including SSE responses? | The template against a small hosted MCP server | 0.2 × 2 |
| — | Real output sizes for `test run --all --output json` (exit 0 and exit 1) | A 10-test BE project | 0.2 × 10 (reuse U1/U4 tests) |

Everything resolved here is written back into docs 01, 04, 06, 07 and the `authoring-backend` reference before Phase 2 relies on it.

## 4. How to test the plugin itself

Layers, cheapest first. None of the automated layers can spend credits: eval `Bash` runs in an OS sandbox with network limited to granted domains and a temporary `HOME` with no credentials, and
every other layer uses `--dry-run` (documented as "Skip the network and credentials; emit a canned sample") or fixtures. [V SPEC:plugin-evals.md "Grant tools"; HELP:top `--dry-run`]

### 4.1 Static (every commit)
- `claude plugin validate . --strict` for the manifest, and `claude plugin validate skills` / `agents` for component frontmatter (it does **not** read `hooks.json`; given a bare `hooks.json` it misreads it as a manifest — observed). Exit 1 on warnings with `--strict`. [V SPEC:plugins_cli-reference.md; observed on the skeleton]
- Hooks are checked by *loading*: `claude --plugin-dir . plugin details testsprite` must list `SessionStart, PreToolUse, Stop`, and `claude --debug` shows each registration and run.
- `claude plugin details testsprite` ⇒ always-on ≤ 400 tokens. [V SPEC:plugins_measure.md]
- **Flag-trace** (`scripts/check-flags.py`): extract every `testsprite …` command path and `--flag` from plugin Markdown, helper scripts, and hook messages; fail if any is absent from the pinned CLI's help (the same data this plan's `sources/cli-help/` holds). It has already been run once against this plan's documents (result in doc 09 §3).

### 4.2 Unit
- `sprite-detect` against the 17 fixture repos (doc 04 §11) with golden JSON; includes a mixed repo (MCP server + landing site) and two "none" repos (stdio MCP, Go CLI) that must say so.
- `sprite-state`: CLI absent / present / out of range; key absent / env / file; `TESTSPRITE_API_URL` set; official skills present — golden JSON, and a test asserting **no output ever contains a key-shaped string**.
- Hooks: pipe stdin JSON fixtures (doc 06 §8) through each script and assert stdout/exit; latency measured from `claude --debug` "finished with status N (Nms)" lines. [V SPEC:hooks.md:4228]

### 4.3 Integration
`claude --plugin-dir ./testsprite -p "…"` inside fixture repos with the real CLI present but no credentials and `--dry-run` where a command is needed: asserts the `init` fit gate, the guard's `ask`/`deny` text for each class, and that the Stop gate fires once.

### 4.4 Behavior: `claude plugin eval` (early access; needs Claude Code ≥ 2.1.269)
Each case = a directory under `evals/` with `prompt.md` (+ `case.yaml` for fixtures) and `graders/*.md`; default two arms (with plugin, without) × 3 runs, scored as weighted grader pass rate; Δ = with − without. [V SPEC:plugin-evals.md:54-147, 573-643]
The skill chosen is checked with `tool_used: Skill`; correctness with `regex`/`llm`; process with `tool_order`; created files with `file_exists`.

| # | Case | Graders (sketch) |
|---|---|---|
| 1 | "Can TestSprite test my stdio MCP server?" (fixture: stdio server) | `tool_used: Skill`; `llm`: says not a fit, names native alternatives, does **not** propose creating a project |
| 2 | "Set up TestSprite for this repo" (fixture: Go cobra CLI) | `regex not_contains` `project create`; `llm`: fit = none + "do instead" |
| 3 | "Set up TestSprite for this repo" (fixture: Vite web app, no credentials) | `tool_order`: state/detect before any `testsprite` call; asks for URL/sign-in; no cloud command run |
| 4 | "Verify this change with TestSprite" (changed code, empty `HOME`) | `regex`: `unverified because`; `regex not_contains`: `passed` as a verdict; `tool_used Bash input_match "testsprite test (run\|rerun\|create)"` min 0 |
| 5 | "Set the backend credential to sk_test_123 on proj_x" | `tool_used Bash input_match "--credential-file"`; `regex not_contains` `--credential sk_` |
| 6 | "Edit my feature map" | `llm`: says portal-only; `regex not_contains` an invented `testsprite … feature` command |
| 7 | Two bundles in `add_dirs` (one plan-defect, one app-bug) | `tool_used Agent`; `llm`: classes match the fixtures |
| 8 | "Write a TestSprite backend test for my remote MCP server at https://x/mcp" | `file_exists *.py`; `regex`: `Mcp-Session-Id`, a bare `test_…()` call at file end, `BASE_URL`, no `TARGET_URL` |
| 9 | "Add TestSprite to our GitLab CI" | `regex not_contains` `ci init gitlab`; `regex` `ci run`; `llm`: states `ci init` supports GitHub only |
| 10 | "Run all the TestSprite tests" (fixture: linked project) | guard fixtures in §4.3 cover enforcement; this case checks the model *announces* cost and uses background execution |

Cost per case ≈ $0.4 (6 runs; list-price estimate [V SPEC:plugin-evals.md first-suite example]). Use `--max-cost-usd` in CI. The headline metric is **mean Δ**: where Δ ≈ 0 and the Skill grader fails, shorten or sharpen the skill description. [V SPEC:plugins_measure.md]
Open uncertainty: whether a user-only skill can be exercised in an eval by writing its slash command in `prompt.md` (the model cannot invoke it) — resolved in Phase 0.

### 4.5 Drift canary (nightly)
A scheduled workflow installs `@testsprite/testsprite-cli@latest`, reruns `tools/capture_cli_help.py`, and diffs its command/flag set against the pinned set. Any removal or rename that the plugin's Markdown still cites opens an issue; additions open an "info" issue.
This directly addresses the main risk (§5, R1).

### 4.6 Dogfood
Three real repos for two weeks on a small credit budget; record: guard asks (right/wrong), Stop blocks (right/wrong), triager accuracy vs the maintainer's own judgment, token cost (`claude plugin details` + `/skill-doctor`). `/skill-doctor` flags skills that are in the listing but never invoked. [V SPEC:plugins_measure.md]

## 5. Risks

| # | Risk | Likelihood · impact | Mitigation |
|---|---|---|---|
| R1 | **CLI velocity**: 11 releases in 3 months since the 0.4.0 the earlier skills pin; flags and shapes change; those 0.4.0 skills are the cautionary tale | high · high | Never restate flags; `sprite-ref` reads the installed CLI's own guidance; flag-trace in CI; nightly canary; version banner; JSON contract is "additive only" so shape-probing helpers stay safe [V CLID:reference/whats-included] |
| R2 | Unresolved platform unknowns (U1–U4) make backend guidance wrong | medium · high | Phase 0c before Phase 2; until closed, backend guidance is tagged and conservative (explicit `BASE_URL`, explicit teardown, no reliance on cleanup or injected URL) |
| R3 | Hooks annoy or slow sessions | medium · medium | Silent when unlinked; `if` filter ⇒ zero spawns elsewhere; never `allow`; one block per change set; switches for the guard and the Stop gate in `userConfig` (SessionStart emits nothing unless linked); measured latency budget |
| R4 | Vendor overlap/obsolescence: the CLI now ships three skills and keeps adding; could ship a plugin | medium · medium | The plugin's durable value is what prose files cannot do: detection + fit honesty, audit, enforcement hooks, subagents. Content defers to the installed CLI. Coexistence is supported (flag duplicates; don't delete) |
| R5 | Claude Code spec drift (`plugin eval` is early access; `if` best-effort; `userConfig` rules strict) | medium · medium | `validate --strict` in CI; documented minimums; hooks fail open |
| R6 | Credits burned during development | low · medium | Evals are network-sandboxed with no credentials; hooks/helpers tested on fixtures; one explicit, capped spike; throwaway project |
| R7 | Honest-fit verdict feels unhelpful on stdio MCP / CLI repos (most MCP-server and CLI-tool repos) | high · low | It is the correct answer. The value delivered is the "do instead" path and the HTTP-transport route; the plugin never blocks anything, it just refuses to create cloud state for a repo that cannot use it |
| R8 | Misdetection by `sprite-detect` | medium · low | Prints evidence; reports ambiguity rather than guessing; 17 goldens; user can override with an argument |
| R9 | Listing-cost creep as skills are added | medium · low | Budget gate in CI (≤ 400 tokens; 347 measured); user-only skills still show ~20–40 tokens each in `plugin details`, so keep them short |
| R10 | Exit-1 output truncation hides evidence | medium · medium | Capture-to-file rule; `sprite-run` if measured; bundles already write to disk via `--out` |
| R11 | Teammates without the plugin lose the guardrails | medium · low | `.testsprite/config.json` is the vendor convention and still works with the official skills; the plugin adds, it does not replace shared files |
| R12 | Privacy: the CLI sends command-outcome telemetry to TestSprite unless disabled | low · low | Plugin changes no telemetry defaults and does not set `TESTSPRITE_CLIENT`; docs mention `TESTSPRITE_NO_TELEMETRY` / `DO_NOT_TRACK` [V DOC:1358-1401] |
| R13 | Hook scripts run with full user permissions | low · high | No network, no key reads, no writes outside `${CLAUDE_PLUGIN_DATA}`; review checklist per Claude Code's plugin security page [V SPEC:plugins_security.md] |
| R14 | Windows | n/a · medium | v0.1 targets macOS/Linux; exec-form hooks already avoid shell quoting; `bin/` shims and `sh` prefilters are the Windows gap [V SPEC:hooks.md:458-490] |
| R15 | Subagent model cost | low · low | `model: sonnet` for both agents; bounded `maxTurns` (20/30) |

## 6. Open questions that affect the design (each with a recommended default)

| # | Question | Recommended default | Changes what |
|---|---|---|---|
| Q1 | Should the plugin **supersede** the three official skills (credentials via `setup --no-agent`, nudge silenced) or **coexist** with them? | **Supersede**; detect and flag duplicates, never delete files the plugin did not write | SessionStart env export, guard class E, `ts-ref` |
| Q2 | Plugin name | `testsprite` (gives `/testsprite:init`), described as unofficial; alternative `testsprite-agent` | namespace of every slash command |
| Q3 | Spend ≤ 5 credits on a throwaway project to close U1–U4/U9 before Phase 2? | **Yes, once, capped**; nothing is run without the maintainer's go-ahead | whether backend guidance is final or provisional |
| Q4 | Claude Code only, or also a Codex package like the SwiftUI plugin? | **Claude Code only** | packaging, `agents/openai.yaml` |
| Q5 | Windows in v0.1? | **No** | hook shell choice, `bin/` shims |
| Q6 | Stop gate on by default in linked repos? | **On, soft**, after the dogfood false-positive check | `userConfig.stop_gate` default |
| Q7 | Guard threshold for "fan-out" (runs per command) | **3**, configurable | `userConfig.confirm_runs_over` |
| Q8 | `sprite-run` (capture + digest): build now, or only if measured? | **Only if measured** (principle: no abstraction before the second caller *and* evidence of need) | helper count |
| Q9 | Per-project plugin settings file for monorepos | **No** in v0.1; `userConfig` is per-user | settings surface |
| Q10 | Should `verify` auto-create tests, or only rerun existing ones? | **Create after showing the plan once**, as the vendor skill does | `verify` step 5 |
| Q11 | Should the plugin ever start a public tunnel for a local backend? | **Never**; explain options, user does it | doc 04 §4 |
| Q12 | `audit`: persist a report file? | **Print only**; offer `--write` later | audit output |
| Q13 | Ship the MCP-over-HTTP template before U9 passes? | **Ship as "experimental"**, clearly tagged | `authoring-backend` reference |
| Q14 | Non-GitHub CI | **Generic recipe only** (no provider YAML promises) | `ci` skill scope |
| Q15 | Agent models | **`sonnet`** for both | agent frontmatter |
| Q16 | Marketplace/host and license | The maintainer's GitHub, **MIT** (as the maintainer's other plugins) | `plugin.json`, marketplace |
| Q17 | Should `SessionStart` context have its own `userConfig` switch? | **No** in v0.1: it is silent in unlinked repos, and in linked repos its ~100 tokens are the point; disabling the plugin removes it. Revisit if dogfood finds it noisy | `userConfig` surface |
