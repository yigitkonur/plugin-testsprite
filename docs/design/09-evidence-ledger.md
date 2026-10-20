# 09 · Evidence ledger

> **As built:** this note was written before the plugin existed. Where it differs from the shipped files (for example `sprite-run`, which was never built, the three-entry `hooks.json` in the sketch below, which became one `hooks/guard.sh` prefilter in 0.1.1, or `scripts/check-flags.py`, which is `scripts/flag_trace.py`), the shipped files win. See `10-execution-plan.md` section 8.

What each claim in documents 01–08 rests on, what is unverified, what changed during the research, and the result of the command/flag trace.
Source keys: see `README.md`. All paths are under `sources/`. Line numbers refer to the files as snapshotted (`sources/MANIFEST.md`).

## 1. Verified claims (V) — claim → source

### 1.1 CLI surface and behavior (v0.15.0)

| ID | Claim | Source |
|---|---|---|
| E1 | Package `@testsprite/testsprite-cli` 0.15.0; bin `testsprite`; Node `^20.19.0 \|\| ^22.13.0 \|\| >=24`; tarball ships `dist`, `skills`, `schemas` | `npm-pack/package/package.json` |
| E2 | 88 command paths (incl. top); 441 flag rows | `cli-help/commands.txt`, `cli-help/flags.tsv` (walked by `tools/capture_cli_help.py`) |
| E3 | Global flags: `--output json\|text`, `--profile`, `--endpoint-url`, `--verbose`, `--debug`, `--dry-run`, `--request-timeout`, `-V` | `cli-help/top.txt` |
| E4 | `setup` flags: `--api-key --from-env --agent --no-agent --force --dir -y --skip-if-configured`; default installs skills for detected agents | `cli-help/setup.txt` |
| E5 | Three skills installed by default (verify, onboard, ci); Claude path `.claude/skills/<skill>/SKILL.md`; description cap 1,536 chars | `testsprite-cli/src/lib/agent-targets.ts:62,120`; `CHANGELOG.md` 0.15.0 |
| E6 | The skill nudge: fires on `test run\|rerun\|create\|create-batch`, `auth status\|whoami` when `CLAUDECODE` is set and no verify skill; opt-out `TESTSPRITE_NO_SKILL_WARNING` | `testsprite-cli/src/lib/skill-nudge.ts:29-38,42,154,211-214` |
| E7 | `test run`: `--local <port>`, `--local-host`, `--tunnel-client`, `--no-cancel-on-interrupt`, `--env`, `--target-url`, `--wait/--no-wait`, `--timeout` (default 600; 1200 through a tunnel), `--all/--project/--filter`, `--report junit`, `--summary-file`, `--allow-empty`, `--no-auto-heal` | `cli-help/test-run.txt` |
| E8 | Exit codes 0,1,2,3,4,5,6,7,10,11,12,13,14,129/130/143 | `testsprite-cli/DOCUMENTATION.md:1519-1537`; per-command lists in `cli-help/*.txt` |
| E9 | Scopes `read:me read:projects read:tests write:tests write:projects run:tests run:tunnel` | `DOCUMENTATION.md:1426-1440` |
| E10 | Env vars incl. `TESTSPRITE_API_KEY/URL/PROFILE/PROJECT_ID`, `…_NO_SKILL_WARNING`, `…_NO_TELEMETRY`, `DO_NOT_TRACK`, `…_CLIENT`; key env overrides the file | `DOCUMENTATION.md:1315-1317, 1341-1356` |
| E11 | `auth status --output json` fields: `userId keyId scopes env v3Enabled activeOrg{plan role remaining includedCredits seats}` (**canned dry-run sample**; real values need an account) | `cli-dry-run/auth-status.json` |
| E12 | `usage` fields `credits subPlan creditsPerRun v3Enabled` (canned) | `cli-dry-run/usage.json` |
| E13 | Run JSON shapes: `test run` ⇒ top-level `{runId,status,enqueuedAt,codeVersion,targetUrl}`; `test create --run --wait` ⇒ `{testId,type,codeVersion,createdAt,run:{…}}`; `test rerun` ⇒ `{runId,status,…,autoHeal,closure}`; `test run --all` ⇒ `{accepted[],conflicts,deferred,skippedFrontend,skippedIntegration}` (canned) | `cli-dry-run/test-run-single.json`, `test-create-run-wait.json`, `test-rerun.json`, `test-run-all.json` |
| E14 | `test result` carries `snapshotId runIdIfAvailable codeVersion targetUrl failedStepIndex failureKind verdict executionStatus summary` (canned) | `cli-dry-run/test-result.json` |
| E15 | `test plan generate`: stages exploration/strategy/proposals; only missing stages run; Ctrl-C pauses; re-run continues; completed stage never charged twice; refused for local projects (exit 6) | `cli-help/test-plan-generate.txt`; `DOCUMENTATION.md:488, 664` |
| E16 | `test plan accept`: free; subset discards the rest; unknown `--only` id ⇒ validation error before sending | `cli-help/test-plan-accept.txt`; `DOCUMENTATION.md:685-709` |
| E17 | PRD upload 0.5 credit once per document; `api-doc` free; same file name replaces; no `docs list/delete` | `DOCUMENTATION.md:728-736` |
| E18 | Rerun billed like a fresh run: 0.5 FE / 0.2 BE; FE heal default on; BE rerun runs producer/teardown closure; `--skip-dependencies` | `cli-help/test-rerun.txt` |
| E19 | `test flaky --runs 1..10` (default 5), auto-heal OFF, N × rerun price | `cli-help/test-flaky.txt` |
| E20 | Cancel: Ctrl-C only detaches; `test cancel` is the stop; V3 FE cancelled before terminal ⇒ charge returned (attempted); BE/V2 keep billing | `cli-help/test-cancel.txt`; `DOCUMENTATION.md:829-833, 960-982` |
| E21 | `ci run`: exit codes 1/7/5/4; `--fail-on-skipped`, `--summary-file`, `--target-url`, backend tests use their own URL | `cli-help/ci-run.txt`; `DOCUMENTATION.md:1083-1125` |
| E22 | `ci init <platform>` supports `github` only; writes `.github/workflows/testsprite.yml` with a `REPLACE ME` step | `cli-help/ci-init.txt`; `skills/testsprite-ci.skill.md:68-92` |
| E23 | `schedule create` flags and exit 13 (plan) / 7 (unavailable); frequency + estimated cost printed first | `cli-help/schedule-create.txt`; `DOCUMENTATION.md:1014-1068` |
| E24 | Backend `project create` needs `--url` on the V3 path | `cli-help/project-create.txt` |
| E25 | `project credential` is free tier; `project auto-auth` is Pro | `cli-help/project-credential.txt`, `project-auto-auth.txt` |
| E26 | `test artifact get <run-id>` default `./.testsprite/runs/<run-id>/`, parent must exist; exit 4 for no failure / cancelled | `cli-help/test-artifact-get.txt` |
| E27 | `test open <id> --no-browser` prints the deep link | `cli-help/test-open.txt` |
| E28 | `--local` is frontend-only; backend target is in the test code; scaffold hard-codes `BASE_URL` and says the test function **must be called** | `cli-help/test-run.txt`; `testsprite-cli/src/commands/test.ts:6221,6229` |
| E29 | Vendor skills: one-test minimum / "unverified because X"; skip list; BE sandbox; auth injection; dependency flags; plan-writing rules; plan-vs-product triage; earliest-failed-wave rule | `skills/testsprite-verify.skill.md:52-74, 39-50, 196-239, 241-271, 276-340, 494-538, 527` |
| E30 | `.testsprite/config.json` is read by the skill, not the CLI | `docs/cli/getting-started/quickstart-for-agents.md` ("Pin the project") |
| E31 | CLI telemetry (command outcome events; opt-out env) and a 24-hour npm update check | `DOCUMENTATION.md:1358-1420` |

### 1.2 Platform / portal behavior

| ID | Claim | Source |
|---|---|---|
| E32 | Feature map: Project → Feature → Use Case → Test Cases; inline editable; "Regenerate from sources" discards use cases and tests, can't be undone | `docs/web-portal/core/working-with-test/coverage-map.md`, `managing-test-cases.md` |
| E33 | FE exploration: parallel agents, ~3 min, re-explore is a portal action | `docs/web-portal/core/ui/feature-exploration.md` |
| E34 | Portal auto-heal: "doesn't overwrite it unless you explicitly save"; rerun-only; plan-gated | `docs/web-portal/core/ui/auto-heal.md` |
| E35 | Auto Cleanup: after every run, children first, needs DELETE endpoint, 404 = success | `docs/web-portal/core/api/auto-cleanup.md` |
| E36 | "TestSprite is REST-first. GraphQL discovery is best-effort … Pure RPC (gRPC, JSON-RPC) isn't supported." | `docs/web-portal/core/api/api-discovery.md` |
| E37 | OTP fixed at project/environment creation; SSO needs a public URL and a human capture | `docs/web-portal/core/ui/ui-authentication.md`; `DOCUMENTATION.md:552` |
| E38 | Run Behavior (viewport, single login, max tests, planned steps) is portal-only | `docs/web-portal/setup/execution-settings.md` |
| E39 | API keys: workspace `sk-member-` (2 active / member / workspace), personal `sk-user-` (not mintable now) | `docs/web-portal/admin/api-keys.md`; `docs/cli/concepts/key-terms.md` |
| E40 | **Absent** from all 73 pages: "Smart Rerun" (0 files), the three-path "Create test" wording (0 matches) | `grep` over `docs/` (run 2026-10-20) |
| E41 | Tutorials: each of the five pages is 1.5–2.1 KB, one video embed, zero code blocks; `mcp-demo` is 18 KB with 12 code blocks | `docs/learn/*.md` (measured) |
| E42 | Docs-site staleness: localhost unsupported (7 pages), test lists/schedules "roadmap", CLI `0.3.0` sample, no `ci run`/`testlist`/`schedule create`/`--local` mentions, no exit 13 | `docs/cli/**` (`grep`, lines cited in doc 02 §4) |

### 1.3 Claude Code spec (read raw from code.claude.com, Claude Code 2.1.302 on this machine)

| ID | Claim | Source |
|---|---|---|
| S1 | A foreground Bash command that reaches its timeout is **moved to the background**, not stopped (unless it starts with `sleep`; or auto-backgrounding is disabled) | `claude-code-spec/tools-reference.md:213-217` |
| S2 | Bash defaults: 2 min default, 10 min max; background commands have no time limit in a local terminal session, 30 min (10 min in `-p` text mode) in unattended sessions | `tools-reference.md:155-205` |
| S3 | Output limits: valid result ≈30 K chars inline else file + 2 K preview; **failure** result ≈10 K head-and-tail, no file path; only listed commands' exit 1 is benign | `tools-reference.md:166-176` |
| S4 | Hook `if` takes a permission-rule string, strips `VAR=`, checks each subcommand, is best-effort | `hooks.md:353, 427-450` |
| S5 | Subagent tool calls fire the same plugin hooks and carry `agent_id`/`agent_type` | `hooks.md:269, 745-750` |
| S6 | `permissionDecision: "allow"` skips the permission prompt | `hooks.md:1958` |
| S7 | `SessionStart` can write `CLAUDE_ENV_FILE`; first response waits on it | `hooks.md:1230, 1334-1346, 1385` |
| S8 | Write hook text as facts, not imperative system instructions | `hooks.md:1140` |
| S9 | `Stop`: `stop_hook_active`, `last_assistant_message`; consecutive-continuation cap of 8 | `hooks.md:738, 2594, 2732` |
| S10 | Exec form: `command` + `args`, `${CLAUDE_PLUGIN_ROOT}` substituted, Windows needs a real executable | `hooks.md:458-490` |
| S11 | Plugin agents ignore `permissionMode`, `hooks`, `mcpServers` | `plugins_components.md:740` |
| S12 | Any `userConfig` field with `options` makes the plugin unloadable below 2.1.271; unknown key inside an option is fatal | `plugins_manifest-reference.md:94-111, 483` |
| S13 | `claude plugin details` reports always-on tokens (name + description + when_to_use); hooks have no model-context cost | `plugins_cli-reference.md:355-376`; `plugins_measure.md` |
| S14 | `commands/` is the older format; skills win name collisions | `skills.md:173` |
| S15 | Skill listing text truncated at 1,536 chars; `disable-model-invocation`, `paths`, `context: fork`, `background` (default true) | `skills.md:402, 406, 414, 416` |
| S16 | `` !`cmd` `` pre-execution happens before Claude sees the skill content | `skills.md:129` |
| S17 | Compaction keeps the most recent invocation of each skill (first 5,000 tokens, 25,000 combined) | `skills.md:614` |
| S18 | `plugin eval`: ≥ 2.1.269; two arms; graders `regex tool_used tool_order file_exists llm baseline`; Bash runs sandboxed, network limited to granted domains | `plugin-evals.md:25-60, 357-371, 573-643` |
| S19 | `bin/` is added to the Bash tool's PATH while the plugin is enabled | `plugins_components.md:572` |
| S20 | An enabled plugin's skill/agent name + description are in context every turn | `plugins_overview.md:53` |
| S21 | **Observed:** `claude plugin validate <skeleton> --strict` passes for the manifest, `skills/` and `agents/` built verbatim from this plan's sketches. It does **not** read `hooks.json` (given a bare `hooks.json` it reports "name: expected string" because it treats the file as a manifest) | `tools/build_validation_skeleton.py`; run 2026-10-20 on Claude Code 2.1.302 |
| S22 | **Observed:** `claude --plugin-dir <skeleton> plugin details testsprite` lists 5 skills, 2 agents, 3 hooks (SessionStart, PreToolUse, Stop; "harness-only — no model context cost"); always-on **~554 tok** (first-draft descriptions) → **~347 tok** (current) | same run; per-component numbers in doc 05 §9 |

### 1.4 Other plugins and the earlier skills

| ID | Claim | Source |
|---|---|---|
| P1 | SwiftUI plugin: 1 hook (PostToolUse, non-blocking, static grep), 1 agent, 4 commands, 33 skills; description lengths 585–1,036 chars (median 986); manifest 914 B | `plugin-swiftui/hooks/`, `agents/`, `commands/`, `skills/*/SKILL.md` (measured) |
| P2 | SwiftUI `AGENTS.md`: bump version on shipped change; no path fields in manifest; `$ARGUMENTS`/`!` do not run on the model path | `plugin-swiftui/AGENTS.md` |
| P3 | SwiftUI `eval/`: deterministic baseline-vs-grounded scoring (parses, deprecated count, lint, shape regex) | `plugin-swiftui/eval/README.md`, `RESULTS.md` |
| Y1 | The earlier skills: backend `SKILL.md` 26,374 B + 110,084 B references + 159,988 B script; frontend 15,128 B + 54,759 B + 24,166 B; both `disable-model-invocation: true`; both pinned to CLI 0.4.0 | `yigitkonur-skills/skills/run-testsprite-*/` (measured) |
| Y2 | The earlier frontend skill routes localhost to MCP and says `run --all --target-url` is rejected (exit 5); 0.13.0 made it apply to FE batches | `…/run-testsprite-frontend/SKILL.md` steps 3 and 10; `CHANGELOG.md` 0.13.0 |

## 2. Unverified (U) — what is open, how to close it, and the cost

| ID | Open question | Where it matters | To close | Cost |
|---|---|---|---|---|
| U1 | How does a CLI-authored BE producer export `--produces` values from Python, and how does a consumer read them? | `authoring-backend`, doc 01 §9B | Credit spike (doc 08 §3) | ~1 credit |
| U2 | Is `TARGET_URL` injected into BE tests? (vendor example uses it; vendor scaffold hard-codes `BASE_URL`) | templates | Credit spike | 0.2 |
| U3 | Does FE auto-heal overwrite stored code? CLI help says yes ("replaces the stored version"); portal says no | `verify`, `audit` step 7 | Credit spike: compare `codeVersion` before/after a heal | 1.5 |
| U4 | Does Auto Cleanup cover CLI-authored BE tests? | teardown guidance | Credit spike | 0.4 |
| U5 | The exact `agent_type` string for a plugin subagent in `PreToolUse`; presence of `run_in_background` in `tool_input` (spec says present) | guard read-only enforcement | **Resolved for `agent_type` (build spike, Claude Code 2.1.302):** a throwaway plugin `spike` with agent `probe` logged `agent_type: "spike:probe"` and an `agent_id` in the `PreToolUse` input, so the guard matches `<plugin>:<agent>` as well as the bare name. `run_in_background` still unobserved | 0 |
| U6 | Does `` !`cmd` `` run when the *model* invokes a skill? (spec: before Claude sees it; SwiftUI plugin observed no) | `verify` design (already independent of it) | **Resolved (build spike, 2.1.302):** it runs on both paths. A user-invoked skill and a model-invoked skill (via the Skill tool) each returned their `echo` marker. The design keeps `verify` independent of it anyway | 0 |
| U7 | Does `paths:` keep a skill out of the always-on listing? | budget | Free spike (`claude plugin details`) | 0 |
| U8 | `context: fork` + `background` default | **Moot**: `audit` is not forked | — | — |
| U9 | Does a hand-rolled MCP streamable-HTTP test work in the requests-only sandbox incl. SSE? (template in doc 04 §6 is from the MCP transport as I know it, **not** from a file in `sources/`) | doc 04 §6, Q13 | Credit spike | 0.4 |
| U10 | V2 vs V3 detection | `init` branch | **Resolved in shape**: `auth status --output json` exposes `v3Enabled` (E11). Real-account values unverified | 0 |
| U11 | Fresh BE run price per test | cost messages | `usage` → real `creditsPerRun`; a spike run | 0.2 |
| U12 | Does `docs upload --role api-doc` on an *existing* project add endpoints? (portal says the endpoint list is locked after creation) | `init` step 10 on re-runs | Credit spike or portal check | small |
| U13 | Can `claude plugin eval` exercise a **user-only** skill by writing its slash command in `prompt.md`? | eval cases 2–3 | Free spike | 0 |
| U14 | Are user-only skills really outside the model's context? Spec says "Hidden" (S15 table); `plugin details` still counts ~20–40 tokens each | budget accounting | `/context` with/without the plugin | 0 |

## 3. Command and flag trace (the "no invented flags" check)

`tools/flag_trace.py` extracts every `testsprite …` invocation (and `npx @testsprite/testsprite-cli …`, and `sprite-run -- testsprite …`) from the documents, takes the longest command path present in `cli-help/commands.txt`,
and requires every `--flag` to appear in that command's help (or be global). Sanity-checked first on a deliberately broken file (it reported the bad flag, the unknown subcommands, and ignored prose). Result on this plan, run 2026-10-20:

```
OK  README.md: 1 testsprite command mentions checked, 0 problems, 0 advisory
OK  01-how-testsprite-works.md: 15 testsprite command mentions checked, 0 problems, 0 advisory
OK  02-portal-vs-cli.md: 8 testsprite command mentions checked, 0 problems, 0 advisory
OK  03-official-skills-and-yours.md: 3 testsprite command mentions checked, 0 problems, 0 advisory
OK  04-project-type-fit.md: 0 testsprite command mentions checked, 0 problems, 0 advisory
OK  05-plugin-architecture.md: 2 testsprite command mentions checked, 0 problems, 0 advisory
OK  06-hooks.md: 5 testsprite command mentions checked, 0 problems, 0 advisory
OK  07-workflows.md: 46 testsprite command mentions checked, 0 problems, 0 advisory
OK  08-build-test-risks.md: 0 testsprite command mentions checked, 0 problems, 0 advisory
OK  09-evidence-ledger.md: 0 testsprite command mentions checked, 0 problems, 0 advisory

TOTAL: 80 command mentions checked against 87 command paths / 441 flag rows (CLI 0.15.0); problems: 0; advisory: 0
```
The checker is deliberately strict about names: a typo'd subcommand under a valid group, an unknown subcommand, and a bad flag were each reported when I fed it a deliberately broken file, before this table was produced (an earlier version missed the subcommand typos; that is fixed, see C14). Advisory mode (unprefixed spans such as a bare "test run --x") applies to inline code only; the few intentional bad examples and the hidden-command list in this ledger carry a `trace:ignore` marker on their line.

Limits of the check (be aware): it validates **names**, not semantics (e.g. it cannot tell that `--local` is meaningless for a backend test); it checks only invocations that start with the program name; hidden/deprecated commands (`init`, `ci doctor`, `ci connect`, `auth logout`, `auth whoami`) are not in `commands.txt` and are not used in the plan. <!-- trace:ignore -->
Everything *not* a `testsprite` command/flag (helpers `sprite-*`, hook payloads, plugin fields) is design, tagged [I] where it is not a quotation of a source.

## 4. Corrections made during the research (what I believed, what the source said)

| # | I first thought | Source said / I measured | Effect |
|---|---|---|---|
| C1 | A foreground `--wait` that outlives the Bash timeout gets killed and leaves a billing run, so the guard should deny it | Claude Code moves it to the background instead (S1); only true with auto-backgrounding off or at background time limits in unattended runs (S2) | **Guard class dropped**; replaced by skill guidance + `bgTasksDisabled` in `sprite-state` (doc 06 §6) |
| C2 | Non-zero exit is just an exit code | In Claude Code it makes the result a "failure" with ~10 K truncation and no file path (S3); TestSprite uses exit 1 for a failed test | New optional helper `sprite-run` (gated on measurement) |
| C3 | SwiftUI skill descriptions are ~1.5 KB each | 585–1,036 chars, median 986 (P1) | Corrected the listing-cost comparison |
| C4 | Helpers named `ts-*` | Generic prefix risks PATH collisions | Renamed `sprite-*` |
| C5 | `userConfig` with `options: ask\|warn\|off` | Any `options` makes the plugin unloadable < 2.1.271 (S12) | Booleans + a number |
| C6 | `audit` could be `context: fork` | A forked skill can't ask you before spending | `audit` stays in the main thread; calls `coverage-auditor` as a normal subagent; U8 became moot |
| C7 | `.mcp.json` is an MCP-server marker | It is a *client* config of servers the repo consumes | Removed from server signals (doc 04 §3) |
| C8 | "Four of the five tutorials have no written commands" | **All five** have no code block (E41) | Doc 02 §6 corrected |
| C9 | The docs site is a reliable source for CLI behavior | It lags 0.15.0 in at least nine specific ways (E42) | Source-priority rule: packaged help > `DOCUMENTATION.md` > `CHANGELOG.md` > docs site |
| C10 | V2/V3 detection was open (U10) | `v3Enabled` is in `auth status --output json` (E11) | Resolved in shape |
| C11 | Several citations I first wrote with approximate lines | Re-checked with `grep -n`; fixed about eighteen of them (e.g. `DOCUMENTATION.md:663`, `:708`, `:1353`) | Citations in docs 01–07 are line-checked |
| C12 | Always-on cost ≈ 380 tokens (chars ÷ 4), user-only skills free | `plugin details` measured **554** with first-draft descriptions (agents 100–140 each; user-only 20–40 each) | Descriptions rewritten shorter → **347**; gate set to ≤ 400; U14 opened |
| C13 | `claude plugin validate` checks hooks | It checks manifest + skills/agents/commands frontmatter only (S21) | Hooks are verified by loading (`plugin details`, `--debug`) |
| C14 | The first trace checker passed typos | A mistyped subcommand under a valid group (`test rurn`) was treated as a positional argument | Checker fixed to require a real subcommand under group commands; re-run <!-- trace:ignore --> |
| C15 | "15 releases in 3 months" (said in my plan summary and early drafts) | npm registry: 17 versions since 2026-06-10; **11 published after 0.4.0** (0.5.0–0.15.0, 2026-07-17 → 2026-10-19) | Corrected to 11 in docs 02, 03, 05, 08, README; the conclusion (CLI velocity is the top risk) stands |

| C16 | `agent_type` for a plugin subagent might be the bare agent name | Observed `spike:probe` (`<plugin>:<agent>`) in a real `PreToolUse` payload (U5) | Guard regex matches both forms; test covers `testsprite:failure-triager` |
| C17 | `` !`cmd` `` may not run when the model invokes a skill (SwiftUI plugin's note) | It ran on both paths in 2.1.302 (U6) | No design change; `verify` still collects state itself |
| C18 | Hook latency estimates: SessionStart about 30 ms, guard 25-40 ms | `claude --debug` in a live linked-repo session: SessionStart 134 ms in-session (50 ms standalone when linked, 20 ms when not), guard 43-58 ms, Stop prefilter 7 ms | Estimates replaced by measurements in doc 06 |
| C19 | (build) The first commit in the new repository carried a personal email address as author | Caught by inspection before anything was pushed; identity reset to the GitHub noreply address | `scripts/secret_scan.sh` now fails on any commit identity that is not a noreply address |

## 5. Relayed from research subagents and only spot-checked by me

Three research subagents read pages in bulk (portal docs; tutorials + CLI-doc deltas; the Claude Code spec). I re-read from `sources/` everything the plan's **decisions** depend on (E-rows and S-rows above). Claims that appear in the documents but that I did **not** re-read myself:
- Portal pages not cited by an E-row (Insights, Reports/PDF, Slack, Jira/Linear, Workspaces/roles) — used only for the hand-off table in doc 02 §2.
- The condensed JSON/per-command shapes listed under "CLI-doc deltas" (I confirmed the ones in E11–E14 against `--dry-run` output instead).
- `claude plugin eval` details beyond S18 (grader reference), used only to sketch eval cases.
