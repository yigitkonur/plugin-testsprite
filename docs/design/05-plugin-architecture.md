# 05 · Plugin architecture

Source keys and evidence tags: see `README.md`. Hooks are specified in `06-hooks.md`; workflows in `07-workflows.md`.
Spec facts cite `SPEC:` pages in `sources/claude-code-spec/` (read raw, 2026-10-20, Claude Code 2.1.302).

## 1. Design principles (each one is a consequence of something verified)

1. **The plugin is the judgment-and-steering layer; it never restates the CLI's flag surface.** 11 CLI releases in the 3 months since 0.4.0 (the version the earlier skills pin); those skills are already stale. Stable knowledge (model, rules, triage, fit) lives in the plugin; exact flags come from the
   installed CLI at the moment of use (`sprite-ref`, `testsprite <cmd> --help`). [V CHG; package `files` includes `skills/`, `schemas/`]
2. **Pay for context only when it is needed.** Always-on text is two model-invocable skill descriptions, two agent descriptions, and three very short user-only
   descriptions; everything else loads on demand. **Measured**, not estimated: ~347 tokens on a skeleton built from these sketches (§9). Skill listing text is truncated at 1,536 characters per skill
   and is in context every turn. [V SPEC:skills.md:402; SPEC:plugins_overview.md:53]
3. **Deterministic work goes in scripts, judgment goes in the model.** Project-type detection, state summary, and reference lookup are
   Node scripts on the Bash PATH. [V SPEC:plugins_components.md:572 `bin/` is added to PATH]
4. **A hook must carry a concrete payload or enforce something a skill cannot.** Three hooks; each justified in doc 06; eight hook ideas rejected.
5. **Keep the human on money, deletions, and secrets.** The CLI already confirms some of these with `--confirm`; a model satisfies
   that flag blindly, so the plugin adds a real checkpoint where credits or data are at stake.
6. **Say "not a fit" out loud.** `init`/`audit` can end in "TestSprite fit: none" with an alternative path (doc 04).
7. **Everything the plugin teaches must be checkable.** A flag-trace script fails the build if any `testsprite …` command or flag in the
   plugin's Markdown is absent from the pinned CLI's help (doc 08).

## 2. File tree (the future plugin; nothing is built yet)

```
testsprite/                                   plugin root (name: testsprite, unofficial)
├── .claude-plugin/
│   ├── plugin.json                           manifest (§3)
│   └── marketplace.json                      self-hosted marketplace entry (Phase 6)
├── skills/
│   ├── testsprite/                           MODEL-INVOCABLE: knowledge + router
│   │   ├── SKILL.md                          ≤ 1,500 words
│   │   └── references/
│   │       ├── concepts.md                   doc 01, condensed
│   │       ├── agent-loop.md                 create/rerun → read → fix; feedback vs proof
│   │       ├── costs-and-limits.md           spend classes, rate/concurrency/tunnel limits
│   │       ├── exit-codes.md                 exit code → action table (not flags)
│   │       ├── project-fit.md                doc 04, condensed (+ "Do instead" blocks)
│   │       ├── authoring-frontend.md         plan-writing rules (from VERIFY:276-340, trimmed)
│   │       ├── authoring-backend.md          sandbox rules, auth, deps, BASE_URL
│   │       ├── triage.md                     plan vs product vs env vs flake; starvation
│   │       ├── portal-handoffs.md            doc 02 table, condensed
│   │       ├── ci-shapes.md                  A/B preview shapes, non-GitHub CI, nightly
│   │       └── cli-surface.md                how to read live help (sprite-ref); NO flag tables
│   │   └── templates/                        rest.py, graphql.py, mcp-http.py (experimental), teardown.py
│   ├── verify/SKILL.md                       MODEL + USER: after a change, get a verdict
│   ├── init/SKILL.md                         USER-ONLY: set up a repo
│   ├── audit/SKILL.md                        USER-ONLY: assess + run + classify
│   └── ci/SKILL.md                           USER-ONLY: PR gate / nightly
├── agents/
│   ├── failure-triager.md                    read-only; big evidence in, small verdict out
│   └── coverage-auditor.md                   read-only; repo surfaces vs tests
├── hooks/
│   ├── hooks.json                            3 hooks (doc 06)
│   ├── session-start.sh  → session-start.mjs
│   ├── guard.mjs                             PreToolUse
│   └── stop-gate.sh      → stop-gate.mjs
├── bin/                                      on the Bash PATH while enabled
│   ├── sprite-state                          offline state summary
│   ├── sprite-detect                         project-type signals → JSON
│   ├── sprite-ref                            version-matched official guidance / schema / help
│   └── sprite-run                            (Phase 2, gated) capture output to file + digest
├── evals/                                    `claude plugin eval` suite + fixture repos (doc 08)
├── scripts/check-flags.py                    flag-trace; run in CI (doc 08)
└── README.md
```
Not present, deliberately (§8): `commands/`, `.mcp.json`, `output-styles/`, `.lsp.json`, `monitors/`, `settings.json`.

Name: **`testsprite`** gives `/testsprite:init`, `/testsprite:audit`, `/testsprite:verify`, `/testsprite:ci`. [V SPEC:plugins_components.md plugin namespacing] The
description says "unofficial" so it is not mistaken for a vendor plugin; see open question Q2 in doc 08.

## 3. Manifest sketch

Only `name` is required; components are auto-discovered; unknown top-level keys are stripped, but an unknown key *inside* a `userConfig` option is fatal. [V SPEC:plugins_manifest-reference.md:94-111]
**Do not add path fields** (`"commands": "./commands"`), the same lesson the SwiftUI plugin recorded. [V SWUI:AGENTS.md]

```json
{
  "name": "testsprite",
  "displayName": "TestSprite (unofficial)",
  "version": "0.1.0",
  "description": "Unofficial. Steering layer for the TestSprite CLI: set up a repo, audit coverage, verify changes before 'done', and gate CI. Honest about what TestSprite can and cannot test (web, HTTP APIs, hosted MCP; not stdio MCP or CLI binaries).",
  "author": { "name": "yigitkonur" },
  "repository": "https://github.com/yigitkonur/plugin-testsprite",
  "license": "MIT",
  "keywords": ["testsprite", "testing", "verification", "ci", "mcp", "agent-loop"],
  "userConfig": {
    "guard": {
      "type": "boolean",
      "title": "Confirm spend and destructive commands",
      "description": "Ask before TestSprite commands that fan out billable runs, delete data, overwrite files, or put a secret on the command line.",
      "default": true
    },
    "stop_gate": {
      "type": "boolean",
      "title": "Ask for a verdict before 'done'",
      "description": "In repos linked to a TestSprite project, once per change set, ask for a test verdict or an explicit 'unverified because …'.",
      "default": true
    },
    "confirm_runs_over": {
      "type": "number",
      "title": "Confirm runs over",
      "description": "Ask before one command that can start more than this many billable runs.",
      "default": 3,
      "min": 1
    }
  }
}
```
Notes: booleans, not a `string` with `options`, because **any** `options` field makes the plugin unloadable below Claude Code 2.1.271. [V SPEC:plugins_manifest-reference.md:483] Hook scripts read the values from
`CLAUDE_PLUGIN_OPTION_GUARD`, `…_STOP_GATE`, `…_CONFIRM_RUNS_OVER`. [V same, "Reference a saved value"]
`author.name` and `repository` mirror the maintainer's other plugins.

**Release rule (borrowed from SWUI AGENTS.md):** any shipped change (skills, agents, hooks, bin, references) bumps `version` in the same commit;
installers gate updates on it. Tag with `claude plugin tag` (checks manifest/marketplace agreement). [V SPEC:plugins_cli-reference.md `plugin tag`]

**Compatibility matrix** (checked at SessionStart, offline, by reading the installed package's `package.json`):

| Plugin | Verified CLI | Claude Code | Notes |
|---|---|---|---|
| 0.1.x | `0.15.x` | ≥ 2.1.269 (`plugin eval`), tested on 2.1.302 | A newer CLI minor shows a one-line "not verified; use `sprite-ref help <cmd>`" notice, never a block |

## 4. Skills

### 4.1 `testsprite` (model-invocable knowledge + router)

```yaml
---
name: testsprite
description: Use for TestSprite CLI work: projects, tests, runs, failures; writing test plans or backend test code; deciding whether TestSprite fits a repo (web, HTTP API, MCP server, CLI tool).
---
```
(≈ 390 characters.) **Body (≤ 1,500 words):** what TestSprite is (5 lines); ten rules of engagement; a router table "task → reference file"; where the helpers are.

Rules of engagement (the always-true, cheap-to-state part):
1. Long commands (`plan generate`, anything with `--local`, `--all`, `ci run`) go in `run_in_background`; the harness re-invokes you when they exit. A foreground command that hits Claude's timeout is moved to the background, not killed, **unless auto-backgrounding is disabled** (bare mode / `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`), where it stops and a billing run is left detached. [V SPEC:tools-reference.md:213-217]
2. Capture output to a file when it can be large: a non-zero exit (including TestSprite's exit 1 for a failed test) is a "failure" result truncated to ~10 K characters with no file path. [V SPEC:tools-reference.md:166-176]
3. Keep stderr receipts (`Run <runId>`, `Dashboard: <url>`). [V VERIFY:436]
4. Never put a secret in argv; use `--password-file`, `--credential-file`, `--client-secret-file`, `--refresh-token-file`. [V HELP]
5. Spend classes: reads free; single run ≈ 0.5 (FE) / 0.2 (BE rerun); fan-out asks first (doc 06 table).
6. At least one terminal verdict, or "unverified because X". [V VERIFY:52-74]
7. Plan problem vs product problem before touching code. [V VERIFY:494-538]
8. A heal-pass or rerun is feedback; proof is a fresh run after the deploy. [V MINE-FE/BE; **[U3]**]
9. Do not install software or configure keys behind the user's back. [V VERIFY:83-86]
10. Check the version banner; if the CLI is newer than verified, read live help before trusting a reference.

### 4.2 `verify` (model-invocable **and** user-invocable)

```yaml
---
name: verify
description: Use after a code change in a repo linked to a TestSprite project, before reporting done: run or create the covering test and report the verdict, or say why it is unverified.
allowed-tools: Bash(sprite-state *) Bash(sprite-detect *) Bash(sprite-ref *)
---
```
- **Trigger:** the model, at "about to say done" (backed by the Stop gate); or `/testsprite:verify [what changed]`.
- **Inputs:** `git diff --stat`, `sprite-state` (project, auth, bg-tasks), the linked project's `test list`.
- **Steps:** preflight → resolve project (nearest `.testsprite/config.json` → env → list match → ask) → map diff to units → choose existing covering test vs new test (FE plan / BE code) → **show the drafted plan once** → create/rerun in background → on red, delegate to `failure-triager` → report.
- **Output:** per test one line `id · name · verdict`, dashboard link, or `Unverified because <X>` (no credentials / no reachable target / no covering test and none created).
- Must not depend on `` !`…` `` pre-execution because the model-invocation path may not run it (**[U6]**).

### 4.3 `init`, `audit`, `ci` (user-only)

```yaml
---
name: init
description: Set up TestSprite for this repo.
disable-model-invocation: true
argument-hint: "[path or unit]"
---
```
`disable-model-invocation: true` hides them from Claude (the spec's "user-only" state is "Hidden" from Claude and shown in the `/` menu [V SPEC:skills.md:908-914]) — though `claude plugin details` still attributes ~20–40 tokens each, so keep their descriptions short (**[U14]**) — and makes `` !`sprite-state --json` `` / `` !`sprite-detect --json` `` pre-execution reliable
because only the user can invoke them. [V SPEC:skills.md:129, 406] They appear in the `/` menu with their descriptions. Full step tables: doc 07.

| Skill | Pre-executed context | Delegates to | Ends with |
|---|---|---|---|
| `init` | `sprite-state`, `sprite-detect` | — | `.testsprite/config.json` written; cost to run the rest stated |
| `audit` | `sprite-state`, `sprite-detect` | `coverage-auditor` (free), then `failure-triager` per failing group | Report: coverage, health, classification, next actions |
| `ci` | `sprite-state` | — | Workflow proven on one real non-draft PR, or a precise list of what is left |

`audit` is **not** `context: fork`: it must ask you before spending, which a forked subagent cannot do. Its first step calls `coverage-auditor` as an ordinary subagent. (This removes the fork/background-default question from the critical path.)

## 5. Agents (two; each earns isolation)

Plugin agents support `name, description, model, effort, maxTurns, tools, disallowedTools, skills, memory, background, isolation, color`; they **cannot** set `permissionMode`, `hooks`, `mcpServers`. [V SPEC:plugins_components.md:740]
So read-only is enforced by `tools:` plus the plugin's `PreToolUse` hook keyed on `agent_type` (present when a hook fires inside a subagent). [V SPEC:hooks.md:745-750, 269]

### 5.1 `failure-triager`
```yaml
---
name: failure-triager
description: Classifies failing TestSprite runs (app bug, plan or test defect, environment, flaky, starvation) from large evidence bundles, with cited evidence. Read-only.
tools: Bash, Read, Grep, Glob
model: sonnet
color: orange
maxTurns: 20
---
```
- **Why an agent:** a bundle (failing step ±1 with DOM-as-text, source, trace) can be tens of KB; the answer is ~15 lines. [V CLID:concepts/key-terms]
- **Input (from the caller):** run IDs and/or test IDs, project ID, what changed (diff summary).
- **First action:** read `${CLAUDE_PLUGIN_ROOT}/skills/testsprite/references/triage.md` (path substitution works in agent bodies [V SPEC:plugins_manifest-reference.md env vars]).
- **Allowed commands:** read-only TestSprite commands (`test artifact get`, `test failure get|summary`, `test steps`, `test result`, `test code get`, `test diff`, `test get`, `test list`); enforced by the guard hook.
- **Output contract:** one table row per run: `runId · testId · class · confidence · evidence (step index / file:line) · nextAction · what would change my mind`. Classes: `app-bug | plan-defect | test-code-defect | environment | auth | flaky | starvation(root=<testId>) | inconclusive`.

### 5.2 `coverage-auditor`
```yaml
---
name: coverage-auditor
description: Maps a repo's pages, endpoints and MCP tools to its TestSprite tests; reports gaps and suite health. Read-only, free.
tools: Bash, Read, Grep, Glob
model: sonnet
color: cyan
maxTurns: 30
---
```
- **Why an agent:** reads dozens of source files plus `test list` output; returns a bounded report.
- **Inputs:** `sprite-detect` JSON, project ID, optional unit path.
- **Output:** (1) surfaces table `surface · kind · location · covered-by (test ids) · confidence`; (2) gaps ranked by user-visible risk; (3) stale tests (names referencing routes that no longer exist); (4) suite health from `test list --status …` counts; (5) fit verdict per unit; (6) hygiene flags (inlined-credential warnings, drafts never run). No runs.

## 6. Helpers in `bin/` (Node ESM, zero dependencies, offline unless stated)

Node is guaranteed wherever the CLI is installed (Node ^20.19 ‖ ^22.13 ‖ ≥24 [V package.json engines]); no `jq`, no Python. Names use `sprite-` to avoid colliding with other `ts-*` tools on PATH; Phase 0 re-checks with `command -v`.

| Helper | Contract | Notes |
|---|---|---|
| `sprite-state [--json]` | `{cli:{present,path,version,verified}, auth:{source:"env"\|"file"\|"none",profile,apiUrlOverride}, project:{id,source,configPath}\|null, officialSkillsPresent, bgTasksDisabled, git:{head,changedSince}}` | **Never** prints a key. Reads files/env only; derives CLI version from the package's `package.json`, does not spawn the CLI. < 100 ms |
| `sprite-detect [path] [--json]` | units, kinds, evidence, dev-server port, deploy signals, TestSprite linkage, per-kind fit (doc 04) | Language-agnostic file/manifest scan, depth-limited, honors `.gitignore` |
| `sprite-ref <topic>` | `skill verify\|onboard\|ci`, `schema plan`, `help <cmd path>`, `version`: prints the **installed CLI's own** guidance/schema/help | Resolves the package dir from `realpath $(command -v testsprite)`; falls back to `npm root -g`. Keeps flags version-matched [V npm tarball contents] |
| `sprite-run [--label X] -- <testsprite …>` | Runs the command, appends `--output json` if absent, writes stdout/stderr to `.testsprite/tmp/<ts>-<label>.{json,err}`, prints a digest (exit, runId(s), status, dashboardUrl, paths) | **Phase 2, gated.** Justified only if dogfooding shows the exit-1 truncation costs evidence; probes both `.runId` and `.run.runId` because the docs show both shapes [V docs agent report; DRY:test-run-single (top-level) vs DRY:test-create-run-wait (nested `run`)] |

## 7. Hooks (summary; full reasoning in doc 06)

| Event | Matcher / `if` | Purpose | Default |
|---|---|---|---|
| `SessionStart` | `startup\|resume\|clear\|compact` | Silent unless the repo is linked; injects ≤ 8 lines of state; exports `TESTSPRITE_NO_SKILL_WARNING=1` via `CLAUDE_ENV_FILE`; records the session baseline | on |
| `PreToolUse` | `Bash`, `if: Bash(testsprite *)` and `if: Bash(npx @testsprite/*)` | Guard: ask on fan-out spend, destructive, overwrite, secret-in-argv; read-only enforcement for the two agents | `guard=true` |
| `Stop` | — | Soft verify gate, state-gated, once per change set | `stop_gate=true` |

## 8. What was left out, and why

| Candidate | Why not |
|---|---|
| `.mcp.json` | MCP is the legacy path; the CLI is already agent-first (`--output json`, stable exit codes). An MCP wrapper adds tool-schema tokens and a process for no capability. The one thing MCP did that the CLI could not — localhost — is now `--local`. |
| `commands/` directory | The older format; "merged into skills", loads identically; skills add `disable-model-invocation`, supporting files, `paths`. [V SPEC:skills.md:173] |
| A `doctor`/`status` skill | `testsprite doctor` exists; plugin checks fold into `sprite-state` and the first lines of `init`/`audit`. |
| A test-author agent | Authored plans must be shown to you in the main thread before creating cloud state. A subagent would hide that. |
| A local run ledger / PreCompact hook | Cloud history (`test result --history`) is the ledger; a second copy goes stale. |
| `Setup` hook that installs the CLI | The vendor skill forbids installing behind the user's back; `init` tells you the command and asks. [V VERIFY:83-86] |
| `TESTSPRITE_CLIENT` env | Would report the plugin's identity in the user's telemetry without being asked. |
| `settings.json` with `agent` | Would make the plugin's agent the main thread — far too invasive. |
| Output styles, LSP, monitors | No use. |
| Codex packaging / `openai.yaml` | Out of scope (Claude Code only, Q4). |
| Per-domain skills à la SwiftUI | 33 skills × ~1 KB descriptions is a listing tax our domain does not justify. |

## 9. Always-on context budget (measured)

Method: `tools/build_validation_skeleton.py` builds a throwaway plugin from the sketches in this document (frontmatter, manifest, hooks verbatim; placeholder bodies), then
`claude --plugin-dir <skeleton> plugin details testsprite` reports the figure, counted from each component's name + `description` + `when_to_use`. [V SPEC:plugins_cli-reference.md:355-376; SPEC:plugins_measure.md]

| Draft | Always-on | Per component (tokens) |
|---|---|---|
| First draft (descriptions of 330–430 chars) | **~554** | testsprite ~120 · verify ~110 · failure-triager ~140 · coverage-auditor ~100 · init ~40 · audit ~30 · ci ~20 |
| **Current (descriptions as written above)** | **~347** | testsprite ~80 · verify ~70 · failure-triager ~70 · coverage-auditor ~50 · audit ~40 · ci ~30 · init < 20 |

My earlier chars÷4 estimate (≈380) was wrong in two ways: agent descriptions cost more than the estimate, and user-only skills are not free in the tool's accounting (audit/ci descriptions in the skeleton are placeholders longer than `init`'s).
Hooks are "harness-only — no model context cost" in the tool's inventory; their `additionalContext` costs tokens only when emitted (doc 06).

**Gate:** fail the build above **400** (current 347 leaves headroom for one more description). After any trimming, re-check triggering with a `tool_used: Skill` eval grader, because a shorter description can stop the skill firing. `/skill-doctor` later shows which skills never run. [V SPEC:plugins_measure.md]

## 10. Provenance map: where each piece of existing logic landed (native vs ported)

The test for "reformatted skill files": for each piece of logic in the official skills and the earlier skills, which primitive now owns it, and what that buys that a paragraph in a `SKILL.md` did not.

| Logic (from) | Now lives in | What the primitive adds |
|---|---|---|
| "Run `testsprite --version`, `auth status`; find the project: env var → `.testsprite/config.json` → `project list` → ask" (VERIFY §1–2) | `sprite-state` helper + SessionStart payload | Deterministic, zero tool calls, per-package in a monorepo (nearest ancestor), survives compaction |
| "Read the source to identify flows / endpoints" (ONBOARD §1) | `sprite-detect` (signals) + `coverage-auditor` (reading) | Language-agnostic detection as a script; bulky reading isolated in a subagent |
| "Every shipped change gets ≥ 1 verdict or says unverified" (VERIFY:52-74) | `verify` skill **and** Stop gate | Advice becomes a deterministic check at the moment of "done" |
| "Don't auto-run the full suite (credit wall)" (ONBOARD Don'ts) | Guard hook (class B) + a rule in `testsprite` | A real human checkpoint; the model cannot satisfy it by itself |
| "Never inline a credential; use `__AUTH_HEADERS__`" (VERIFY:208-239); "no secrets in argv" (MINE-BE) | `authoring-backend` reference + guard class D | Teaching **and** interception |
| "Plan vs product; earliest failed wave" (VERIFY:494-538) | `triage` reference + `failure-triager` agent | Big evidence stays out of the main context; read-only enforced by hook |
| FE plan-writing rules (VERIFY:276-340) | `authoring-frontend` reference | Loaded only when writing plans (the vendor loads all 31 KB every time) |
| BE sandbox, dependencies, teardown (VERIFY:183-271) | `authoring-backend` reference + `templates/` | Same; plus GraphQL and MCP-over-HTTP templates the vendor lacks |
| Tunnels, rate limits, exit codes (VERIFY:429-488) | `costs-and-limits`, `exit-codes` references | Off the always-on path |
| "Seed a suite: generate → review → accept → smoke 2–3" (ONBOARD) | `/testsprite:init` | User-only workflow with pre-executed state and a fit gate |
| "Gate PRs: shape A/B, `ci init`, prove on a real PR" (CI) | `/testsprite:ci` | Adds the no-second-gate check and an honest non-GitHub path |
| "The CLI warns you to run `testsprite setup`" (skill-nudge.ts) | SessionStart env export | Only a hook can set an env var for later commands |
| "Fresh run after deploy; freeze the member set; never drop a failed member" (MINE-FE/BE) | `audit` run phase + `verify` "feedback vs proof" | Becomes the audit's accounting step instead of a 26 KB procedure |
| "Deployed-boundary signal required before spending runs" (MINE-BE) | `project-fit` reference + fit gate in `init`/`audit` | The rule that makes stdio-MCP / CLI repos end honestly |
| "Pin the CLI; `npm exec --package …@0.4.0`" (MINE-*) | **Dropped** | Vendor says don't pin; drift is handled by `sprite-ref` + flag-trace |
| "Authorization record before any write" (MINE-*) | **Dropped** | The CLI's own confirmations + the guard cover what matters |
| 160 KB static auditor script (MINE-BE) | **Dropped** (watch item) | `test lint` covers FE plans only (`--plan-from/--plan-from-dir/--plans/--steps` [V HELP:test-lint]); the CLI has **no offline validator for backend code**. The `authoring-backend` rules replace the script (call every `test_*`, explicit `BASE_URL`, no inlined credential, one assertion per contract); a ~20-line stdlib check for "function defined but never called" is added only if dogfood shows silent passes |

## 11. Slot-filling audit: what breaks without each component

Honest ranking, strongest to weakest. "Weak" means: build it last, measure it, and be ready to delete it.

| Component | What breaks without it | Verdict |
|---|---|---|
| `testsprite` skill (router + references) | No cost model, no fit knowledge, no authoring/triage rules loaded on demand | **Core** |
| Guard hook | Fan-out spend, deletions and secret-in-argv depend on the model remembering; subagents can run billable commands | **Core** (and matches an "ask first only for money" rule) |
| `sprite-detect` + fit gate | The agent pushes a stdio MCP server or Go CLI through a setup that cannot work, and creates cloud state | **Core** (this is the plugin's honesty) |
| `sprite-state` | Extra tool calls to learn auth/project/version; no monorepo resolution | **Core**, tiny |
| `failure-triager` | Failure bundles flood the main context | **Strong** (answer ≪ reading) |
| `coverage-auditor` | `audit` has no cheap, isolated way to map surfaces to tests | **Strong** |
| `init`, `audit`, `verify` | The user's two named entry points and the follow-on loop have no workflow | **Core** |
| SessionStart hook | Compaction drops the rules; the CLI nag steers the model to install duplicate skills | **Moderate**: the env-export half is clearly needed; the context half is the part to measure |
| `sprite-ref` | Flags drift away from the references | **Moderate**; if the skills end up never calling it, delete it |
| Stop gate | "Done" without a verdict goes unchallenged | **Speculative**: ships last, opt-out, measured (< 1 false block per 20 stops) or removed |
| `ci` skill | Users read the vendor's `testsprite-ci` skill or docs instead | **Weak** (Phase 4): adds the second-gate check and non-GitHub honesty, little else; first to cut |
| `sprite-run` | Exit-1 outputs may lose evidence | **Gated** on measurement; absent until proven needed |
| `userConfig` (3 options) | Hooks cannot be tuned | **Small**; delete `confirm_runs_over` if nobody changes it |
| `evals/` | Steering effects are unmeasured | **Core to knowing whether any of this works** |
