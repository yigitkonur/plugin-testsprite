# 10 · Execution plan: from this design to the public plugin

Docs 01–09 say **what** to build and why. This one says **how we build it, in what order, and how each step is proven**. Evidence tags and source keys: see `README.md`.
Target: **github.com/yigitkonur/plugin-testsprite** (public), built in a sibling checkout of the other `plugin-*` repos (sibling naming like `plugin-trigger-dev`, `plugin-sentry`).
Conventions copied from those repos, checked on disk: plugin `name` ≠ repo name, marketplace `name` = repo name, one plugin entry with `"source": "."`, `AGENTS.md`, `CHANGELOG.md`, `tests/`, `evals/`, `scripts/`, `.github/workflows/{ci,freshness}.yml`.

Install line users will get:
```
claude plugin marketplace add yigitkonur/plugin-testsprite
claude plugin install testsprite@plugin-testsprite
```

## 0. Guardrails for the whole build

| Rule | How it is enforced while building |
|---|---|
| **No TestSprite credits, no cloud state, no API key** (a standing constraint of this project) | Every shell that can reach `testsprite` or start a `claude` session sets `HOME=$(mktemp -d)`, unsets `TESTSPRITE_API_KEY`, sets `TESTSPRITE_API_URL=http://127.0.0.1:9` (nothing listens there, so a stray call cannot reach the cloud), `TESTSPRITE_NO_TELEMETRY=1`. Hook and helper tests use stdin fixtures. The CLI is touched only for `--help` / `--dry-run`. |
| The ≤ 5-credit spike (Q3) | **Not run.** It stays a post-release ask. Consequence below (D5). |
| Model usage is not TestSprite spend, but it is money | Live sessions and evals are Claude calls on the maintainer's account. Cap: `--max-cost-usd` per eval run, ≤ 10 USD list-price for all of step 10. Reported at the end. |
| Third-party material is data | `sources/` stays read-only; nothing from it is executed except the packaged CLI's `--help`. |
| Shipped text keeps the V / I / U honesty | Anything unresolved ships as "unverified" in the reference that uses it, not as fact. |
| Runs before tests | Working rule: build the thing, run it live on a fixture, watch the output, then **record goldens from what it did** after comparing against the doc-04 verdict table by hand. No golden is written ahead of the code. |

## 1. Defaults adopted so we can start (each reversible; one deviates from the design docs)

| # | Default | From | Consequence |
|---|---|---|---|
| D1 | Plugin **supersedes** the three official skills; detects and flags duplicates; never deletes files it did not write | Q1 | SessionStart env export, guard class E |
| D2 | Plugin name `testsprite` (`/testsprite:init`), marketplace `plugin-testsprite`, `displayName` "TestSprite (unofficial)", MIT, author yigitkonur | Q2, Q16 | permanent once published (renames break installs) |
| D3 | **`stop_gate` ships default `false` in 0.1.0** (docs 06/08 said "on after a dogfood check"). There is no week of dogfood before publishing, and an unmeasured gate is the likeliest thing to annoy. Flip to `true` in 0.2.0 after measurement | Q6 | manifest default; README says so |
| D4 | `sprite-run` is **not built** (Q8: only if measured), so the `Bash(sprite-run *)` handler is omitted from `hooks.json` | Q8 | 3 helpers, not 4 |
| D5 | U1–U4 and U9 stay **unverified**: backend guidance is conservative (explicit `BASE_URL`, explicit teardown, no reliance on injected `TARGET_URL` or Auto Cleanup, no assumption about how `--produces` values are exported); the MCP-over-HTTP template ships tagged **experimental** | Q3, Q13 | `authoring-backend.md`; README "known unknowns" |
| D6 | Public repo ships the design docs as `docs/design/` (reworded from "you/your" to neutral), **not** `sources/` (47 MB, third-party). A `SOURCES.md` with the pins replaces it; `tools/` becomes `scripts/` | — | the plan's evidence stays checkable via pins |
| D7 | Claude Code only; macOS/Linux; Node ≥ 20.19 (the CLI's own floor) | Q4, Q5 | no Windows shims |
| D8 | `userConfig`: `guard` (true), `stop_gate` (false), `confirm_runs_over` (3) | Q7, Q9 | as doc 05 §3 except D3 |
| D9 | Vendor text is paraphrased, not copied; `THIRD_PARTY_NOTICES.md` credits the Apache-2.0 TestSprite CLI repo; README states the plugin is unofficial and not affiliated | — | licence hygiene |
| D10 | Marketplace/tag: `claude plugin tag --push` after CI is green; version `0.1.0` | doc 05 §3 | |

## 2. Target repo layout

```
plugin-testsprite/
├── .claude-plugin/{plugin.json, marketplace.json}
├── skills/{testsprite/(SKILL.md, references/×11, templates/×4), verify/, init/, audit/, ci/}
├── agents/{failure-triager.md, coverage-auditor.md}
├── hooks/{hooks.json, session-start.sh, session-start.mjs, guard.mjs, stop-gate.sh, stop-gate.mjs}
├── bin/{sprite-state, sprite-detect, sprite-ref}   3-line CJS launchers that dynamic-import ../lib/*.mjs
├── lib/{detect.mjs, state.mjs, ref.mjs, guard-rules.mjs, shell-split.mjs}   zero dependencies
├── tests/{fixtures/(17 repos + hook payloads), *.test.mjs}                   node --test
├── evals/                                  claude plugin eval cases (doc 08 §4.4)
├── scripts/{capture_cli_help.py, flag_trace.py, check_budget.sh, secret_scan.sh}
├── ci/pinned/0.15.0/{commands.txt, flags.tsv}   the CLI surface flag-trace checks against
├── docs/design/{README.md, 01–10, SOURCES.md}
├── .github/workflows/{ci.yml, freshness.yml}    ci = static+unit+validate; freshness = nightly drift canary
├── AGENTS.md  CHANGELOG.md  README.md  LICENSE  THIRD_PARTY_NOTICES.md  .gitignore
```
`lib/` is added (the docs said helpers live in `bin/`): launchers keep `bin/` PATH-friendly on every supported Node without relying on module-type detection, and `guard.mjs` / `session-start.mjs` share the shell-splitting and state code with the helpers (second caller exists, so the shared module is earned).

## 3. Order, waves, and who does what

```
S0 preflight ─► S1 scaffold ─► S2 pinned surface + flag-trace          (me, sequential: everything after is traced as it is written)
                                   │
        ┌──────────────────────────┼───────────────────────────┐
   S3a detect + 17 fixtures   S3b state + ref            S4 knowledge skill ─► S5 workflow skills ─► S6 agents
   (sonnet-high subagent)     (sonnet-medium subagent)   (me: judgment-heavy prose)
        └──────────────────────────┼───────────────────────────┘
                                   ▼
                  S7 hooks (me)  ║  S8 evals + CI workflows (sonnet-medium / haiku-high)
                                   ▼
        S9 static + unit pass ─► S10 live sessions + evals ─► S11 public docs ─► S12 publish + final ledger
```
Delegation rule: subagents only for independent pieces whose answer is smaller than the reading (S3a, S3b, S8). Each gets the project facts it needs in its prompt (helper contract from doc 05 §6, the doc-04 verdict table, Node floor, zero-dependency rule, the safety env above) and returns raw output plus paths; I spot-check by running their tests myself. Prose that carries judgment (skills, references, agents, hooks) stays with me.

## 4. Steps

### S0 · Preflight (small)
- **Done already:** `gh` authenticated as yigitkonur with `repo` + `delete_repo` scopes; `yigitkonur/plugin-testsprite` does not exist; Node 26.5.0, Claude Code 2.1.302, git 2.54.
- **Do:** install the packaged CLI to a throwaway prefix (`npm install --prefix <tmp> --ignore-scripts @testsprite/testsprite-cli@0.15.0`, registry only, no TestSprite call) so `testsprite --version` and `--help` work in tests; `command -v sprite-state sprite-detect sprite-ref` (collision check).
- **Done when:** `testsprite --version` prints 0.15.0 from the throwaway prefix under the guardrail env, and the three names are free.

### S1 · Scaffold the repo (small)
- **Do:** `git init`; layout above; `plugin.json` from doc 05 §3 with D3/D8 and `homepage`; `marketplace.json` in the convention above; MIT `LICENSE`; `.gitignore` (`.testsprite/tmp/`, `node_modules/`, `*.local.*`); empty component stubs only where validation needs them.
- **Done when (row 1, partial):** `claude plugin validate --strict .` passes on the manifest; `claude plugin validate .claude-plugin/marketplace.json` passes.

### S2 · Pinned CLI surface + flag-trace in the repo (small)
- **Do:** run `capture_cli_help.py` against the throwaway-prefix CLI; commit only `commands.txt` and `flags.tsv` under `ci/pinned/0.15.0/` (derived facts, small); adapt `flag_trace.py` to scan `skills/ agents/ hooks/ lib/ README.md docs/design/`; add `check_budget.sh` (`plugin details` ≤ 400) and `secret_scan.sh`.
- **Done when (row 7 infra):** flag-trace exits 0 on the copied design docs (same 80 mentions as doc 09 §3) and exits 1 on a deliberately planted bad flag (proof it can fail).

### S3a · `sprite-detect` + 17 fixtures (medium) — subagent, sonnet-high
- **Spec:** doc 04 §3 signal families, §10 verdicts, the JSON sketch; output additive; depth-limited; honors `.gitignore`; prints evidence; reports ambiguity instead of guessing; `.mcp.json` is a client config, never a server signal.
- **Fixtures:** the 17 in doc 04 §11, each a handful of real manifest files (no `node_modules`, no installs).
- **Verification (row 2):** I run it on all 17 and read each output against the doc-04 table (kind, transport, fit); the two required "none" repos (`mcp-ts-stdio`, `cli-go-cobra`) plus `mcp-py-fastmcp-stdio`, `cli-node-bin`, `cli-rust-clap`, `lib-ts` must say so; `mcp-plus-landing-site` must split into two kinds. **Only then** are goldens recorded.

### S3b · `sprite-state` + `sprite-ref` (small–medium) — subagent, sonnet-medium
- **Spec:** doc 05 §6 contracts. `sprite-state` never spawns the CLI, never prints a key (a test greps every output for key-shaped strings), < 100 ms. `sprite-ref` resolves the package from `realpath $(command -v testsprite)`, falls back to `npm root -g`, and offers `skill|schema|help|version`.
- **Verification (rows 3-part, 4):** CLI present / absent / out of range; key absent / env / file; `TESTSPRITE_API_URL` set; official skills present. `sprite-ref help test run` against the 0.15.0 prefix matches `testsprite test run --help`; with the CLI off PATH it prints the install hint and exits non-zero without a stack trace.

### S4 · The knowledge skill (medium) — me
- **Do:** `skills/testsprite/SKILL.md` (≤ 1,500 words: 5-line model, ten rules from doc 05 §4.1, router table) and 11 `references/` condensed from docs 01, 02, 04, 05, 07 (concepts, agent-loop, costs-and-limits, exit-codes, project-fit, authoring-frontend, authoring-backend, triage, portal-handoffs, ci-shapes, cli-surface), plus 4 `templates/` (REST, GraphQL, MCP-over-HTTP **experimental**, teardown).
- **Rules while writing:** no flag tables (point to `sprite-ref`); every `testsprite …` line is traced as soon as it is written; unresolved items worded as "unverified" (D5); citations point to `docs/design/09-evidence-ledger.md` ids, not to the unshipped `sources/`.
- **Done when:** flag-trace green; the SKILL.md word count ≤ 1,500; `plugin details` still ≤ 400 tokens.

### S5 · Workflow skills (medium) — me
- **Do:** `verify` (model + user), `init`, `audit`, `ci` (user-only) from doc 07 step tables and doc 05 frontmatter; `` !`sprite-state --json` `` / `` !`sprite-detect --json` `` pre-execution only in the user-only skills; `verify` does not rely on it (U6); the `ci` skill is the weakest slot (doc 05 §11) so it ships last in this step and is cut first if it reads as filler.
- **Done when:** flag-trace green; each skill's stop conditions (fit none, no credentials, no reachable target, exit 12/13, declined gate) are present and each prints its next action.

### S6 · Agents (small) — me
- **Do:** `failure-triager`, `coverage-auditor` per doc 05 §5 (read-only `tools:`, `model: sonnet`, `maxTurns` 20/30, output contracts; first action reads `${CLAUDE_PLUGIN_ROOT}/skills/testsprite/references/triage.md`).
- **Done when:** `claude plugin validate agents --strict` passes.

### S7 · Hooks (medium) — me, in this order
1. **7a SessionStart:** `session-start.sh` prefilter (writes the env line, exits if no tracked `.testsprite/config.json`) → `session-start.mjs` (baseline file, facts-style `additionalContext`). Fail open.
2. **7b Guard:** `guard.mjs` + `lib/shell-split.mjs` + `lib/guard-rules.mjs`: classes R/A/B/C/D/E/F/G from doc 06 §3.2, compound commands, `VAR=x` prefixes, `npx @testsprite/…`, read-only enforcement by `agent_type`. Returns `ask`/`deny` only, **never `allow`**; anything unparseable → silent.
3. **7c Stop gate:** `stop-gate.sh` → `stop-gate.mjs` per doc 06 §4; default off (D3).
- **Done when (rows 3, 5, 6):** ~40 guard payloads, SessionStart fixtures and 8 Stop fixtures produce the expected stdout/exit; a test asserts no output contains `"allow"`; `claude --debug` shows each hook registered and its latency (doc 06 §8).

### S8 · Evals and repo CI (small–medium) — subagent for evals, haiku-high for workflows
- **Do:** `evals/` with the 10 cases of doc 08 §4.4 (graders as specified); `ci.yml` (node tests, flag-trace, secret scan, `sh -n`, `claude plugin validate --strict`, budget gate); `freshness.yml` (nightly: install latest CLI, regenerate surface, diff against `ci/pinned/`, open an issue).
- **Done when:** the YAML parses locally (`actionlint` if installed, else a YAML load); the eval directory validates with `claude plugin eval --help`-documented shape. Real execution happens in S10 and S12.

### S9 · Static + unit verification pass (rows 1–7)
Run everything cheap, all at once, paste raw output:
`claude plugin validate --strict` on the root, `skills/`, `agents/`; `claude --plugin-dir . plugin details testsprite` (5 skills, 2 agents, SessionStart/PreToolUse/Stop, ≤ 400 tokens); `node --test`; flag-trace; `secret_scan.sh`; `sh -n hooks/*.sh`; a grep that `/Users/mac`, `sources/`, and key-shaped strings appear nowhere in tracked files. Any red row → one plain rerun, then up to three fixes each with a new hypothesis (the stuck-row rule).

### S10 · Live verification (row 8) and the free spikes
- **Sessions** (guardrail env, fixtures copied to temp dirs): `claude --plugin-dir . -p "/testsprite:init"` in `mcp-ts-stdio` → expect "fit: none" with the "Do instead" block and **no** `testsprite project|test` command in the tool calls (read from `--output-format stream-json`); in `web-vite` → expect state/detect first, stop at the auth step, no cloud command; `cli-go-cobra` → none. A linked fixture with a deliberate `testsprite test run --all` → guard `ask` appears.
- **Evals:** run the 10 cases with `--max-cost-usd`; record Δ per case. If `plugin eval` cannot run here, the row stays UNVERIFIED for the eval half, with the reason.
- **Free spikes folded in:** U5 (`agent_type` string inside a plugin subagent), U6 (`` !`…` `` on the model path), U7 (`paths:` effect), U14 (user-only skills in `/context`) — outcomes written back into docs 06/08/09 and the affected skills.
- **Done when:** transcripts and tool-call lists are pasted; any divergence from the spec is fixed in the plugin or recorded as a correction (C16+).

### S11 · Public docs (small–medium)
- **Do:** `README.md` (what it is, install, the five skills with one example each, **the honest-fit table**, safety model: what the guard asks about and what it never does, `userConfig`, requirements, known unknowns U1–U4/U9, unofficial notice); `docs/design/` = docs 01–10 reworded to neutral voice with "decisions needed from the maintainer" turned into a resolved-defaults table; `SOURCES.md` from `sources/MANIFEST.md`; `AGENTS.md` (release rule: bump `version` in the same commit as any shipped change; how to refresh `ci/pinned/`); `CHANGELOG.md`; `THIRD_PARTY_NOTICES.md`. README token cost is the number `plugin details` reported, not an estimate.
- **Done when:** every README command is run or flag-traced; flag-trace and the grep checks from S9 are green on the final text.

### S12 · Publish and final ledger (row 9)
1. **Pre-publish checklist** (printed, not assumed): clean `git status`; S9 checks green; no `sources/`, no personal paths, no keys; `version` 0.1.0 identical in `plugin.json` and `marketplace.json`.
2. `gh repo create yigitkonur/plugin-testsprite --public --source . --description "…" --push`; topics via `gh repo edit`.
3. Watch `ci.yml` on the pushed commit (`gh run watch`); fix forward until green.
4. `claude plugin tag --push` (creates `testsprite--v0.1.0`).
5. **Fresh-clone install test:** `git clone` to a temp dir; with `CLAUDE_CONFIG_DIR=$(mktemp -d)` run `claude plugin marketplace add yigitkonur/plugin-testsprite`, `claude plugin install testsprite@plugin-testsprite`, `claude plugin details testsprite`; confirm the same 5/2/3 inventory and token figure as S9.
6. **Rerun the whole ledger once** (rows 1–8 against the published commit). A row that fails here is a failed row again.
7. Final report: ledger with pasted `saw` values, what changed vs the docs, what is OPEN or UNVERIFIED.

## 5. Step → ledger row map

| Row | Proven in | Command family |
|---|---|---|
| 1 plugin loads | S1, S9, S12.5 | `claude plugin validate --strict`, `plugin details` |
| 2 detect | S3a, S9 | `bin/sprite-detect` on 17 fixtures |
| 3 SessionStart / state | S3b, S7a | stdin-fixture pipes |
| 4 sprite-ref | S3b, S9 | against the throwaway-prefix CLI, and with it off PATH |
| 5 guard | S7b | ~40 payloads |
| 6 Stop gate | S7c | 8 payloads |
| 7 flag-trace | S2, S4–S6, S11 | `scripts/flag_trace.py` |
| 8 live sessions | S10 | `claude --plugin-dir . -p` under the guardrail env |
| 9 published | S12 | `gh`, `claude plugin tag`, fresh-clone install |

## 6. What can go wrong in the build, and the fallback

| Risk | Fallback |
|---|---|
| `agent_type` absent in plugin-subagent hooks (U5) | Read-only for the two agents rests on `tools:` alone; guard keeps the rest; docs 05/06 corrected |
| `` !`…` `` pre-execution does not run on some paths (U6) | User-only skills already carry a body fallback ("if the block above is empty, run `sprite-state --json`") |
| `claude plugin eval` unavailable or too costly | Ship the cases, run the static + integration layers, mark the eval half UNVERIFIED in the ledger |
| Live sessions non-deterministic | Judge rows on recorded tool calls, not on prose; one plain rerun allowed, flaky noted |
| `ci.yml` cannot install Claude Code on the runner | Split the Claude-dependent jobs out so the rest still gates; say so in AGENTS.md |
| A subagent returns code that passes its own tests but misses a doc-04 signal | I run every fixture myself and compare to the verdict table before any golden is recorded |
| Scope creep (`sprite-run`, per-project settings, Windows) | Out by D4/D7 and Q8/Q9; recorded under "not in 0.1.0" in `CHANGELOG.md` |

## 7. What the build will not do without a new yes from the maintainer

Run any TestSprite command that needs a key or reaches its cloud (including the Q3 spike); install the official skills or run `testsprite setup`; touch the maintainer's `~/.claude` settings or install the plugin into their real profile (install tests use a throwaway `CLAUDE_CONFIG_DIR`); publish to npm or submit to Anthropic's directory; spend past the step-10 model-usage cap.
