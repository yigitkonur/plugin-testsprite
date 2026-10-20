# 03 · The official skills, the author's earlier skills, and the SwiftUI plugin

Source keys and evidence tags: see `README.md`. Sizes are bytes measured from `sources/`.

## 1. What the official skills are and how they reach a repo

`testsprite setup` (or `testsprite agent install`) writes **three** skills into the repo for the calling agent:

| Skill | Bytes | Job | Lands at (Claude) |
|---|---|---|---|
| `testsprite-verify` | 31,129 | After a change, run the covering TestSprite test to a terminal verdict before saying "done" | `.claude/skills/testsprite-verify/SKILL.md` |
| `testsprite-onboard` | 11,329 | Repo with 0–1 tests → seeded suite + 2–3 green smoke runs | `.claude/skills/testsprite-onboard/SKILL.md` |
| `testsprite-ci` | 7,513 | Gate pull requests: pick the preview-deploy shape, `ci init github`, finish the placeholder, prove on one real PR | `.claude/skills/testsprite-ci/SKILL.md` |
| (codex variant of verify) | 6,108 | Compact managed section inside `AGENTS.md` (32 KiB budget) | `AGENTS.md` |

[V `sources/testsprite-cli/skills/`; `src/lib/agent-targets.ts` SKILLS/DEFAULT_SKILLS; CHG 0.15.0 for the third skill]

Mechanics worth knowing:

- Bodies ship **inside the npm package** (`package.json` `files: dist, skills, schemas`), and `agent status` classifies each
  installed file as `ok / stale / modified / unmarked / absent / corrupt` against the installed CLI. [V `sources/npm-pack/package/`; HELP:agent-status]
- **The CLI nags.** When `CLAUDECODE` is set and no verify skill exists in the project, `test run|rerun|create|create-batch`
  and `auth status` print a `[warn]` on stderr telling the agent to run `testsprite setup`. Silence: `TESTSPRITE_NO_SKILL_WARNING=1`.
  [V `src/lib/skill-nudge.ts:42,154,211-214`] If the plugin replaces the official skills, it must suppress this or the
  model will install the duplicates it was meant to replace (doc 06, SessionStart).
- Skill descriptions are capped at 1,536 characters for Claude. [V `src/lib/agent-targets.ts` SkillSpec]
- `.testsprite/config.json` (`{"projectId": "proj_…"}`) is **a convention read by the skill, not by the CLI**. Resolution
  order: `$TESTSPRITE_PROJECT_ID` → `.testsprite/config.json` → name match in `project list` → ask. [V CLID:getting-started/quickstart-for-agents; VERIFY:88-97]

## 2. What the official skills do well (keep as *knowledge*, not as files)

These are the parts a plugin should carry forward, rewritten into progressive-disclosure references:

| Knowledge | Where in the official text |
|---|---|
| "At least one terminal verdict per shipped change, or say **unverified because X**." Unit tests, lint, a drafted plan, or asking the user do not count. | VERIFY:52-74 |
| Skip list is narrow: docs-only, pure build/config, credentials unavailable. | VERIFY:39-50 |
| Deployed target vs local: `--env <name>` for deployed, `--local <port>` for loopback FE (not LAN/RFC1918, not BE). Built server beats dev server through a tunnel. | VERIFY:19-34, 429-448; HELP:test-run |
| FE plan authoring: one verb per step; outcomes not selectors; `Navigate to` only in step 1; 1–2 assertions at the end; **presence ≠ working**; name the page region; layout assertions for CSS-dependent features; keep `description` and `planSteps` in agreement; avoid flows outside the test's control (OAuth/2FA, native dialogs, iframes, multi-tab); self-contained data. | VERIFY:276-340 |
| BE sandbox: stdlib + requests + pytest + numpy + scipy; no importing project code; **the file runs top to bottom, so call your `test_*`**. | VERIFY:183-206 |
| BE auth: read injected `__AUTH_HEADERS__`; never hard-code a credential; `test create` emits a `[warn]` on an inlined one — treat as must-fix. | VERIFY:208-239 |
| BE dependencies: `--produces`/`--needs`/`--category teardown`; don't hand-sequence runs, use `test run --all`; edit with `test update`, don't delete/recreate. | VERIFY:241-271 |
| **Read the result: plan problem or product problem?** Plan is the suspect when recorded actions < plan actions, assertions degrade to bare "visible", or 5+ consecutive similar clicks. Product is the suspect when `cause` names a concrete app observation. Failure summaries can conflate two phases. BE closure runs: root-cause the **earliest failed wave**. | VERIFY:494-538 |
| Tighten the plan once and rerun once; don't grind. Don't auto-fix on the bundle's recommendation alone. | VERIFY:534-538, 560-562 |
| Run-id receipts on stderr (`Run <runId>`, `Dashboard: <url>`) must be kept even if the wait stops. | VERIFY:436-437 |
| Concurrency/limits: 60 triggers/min/key (CLI self-throttles to 50); 50 in-flight runs cap (exit 11, `details.reason inflight_cap`); 5 tunnel bindings/user (exit 11, never auto-retried). | VERIFY:431-433, 470-478 |
| Exit 12/13 are **not retriable**: show the server's message and the link, stop. | VERIFY:455 |
| Onboarding: generate → **review** → accept; "a subset accept discards the rest, so name every wanted proposal in one call"; seed ~8–15 tests; smoke-run 2–3, never the whole suite; quote the cost to run the rest. | ONBOARD §3a, §5, §6 |
| CI: decide shape A (platform deploys previews → `on: deployment_status`) vs B (workflow deploys → `on: pull_request`) from config, not history; `ci run`'s exit code is the gate — never re-judge in YAML; prove on one real non-draft PR; don't add a gate next to the GitHub App without asking. | CI:1-150 |

## 3. Where the official skills fall short as the *base of a plugin*

| Gap | Evidence | What the plugin does instead |
|---|---|---|
| Monolith: 31 KB loaded whole on every trigger (~8K tokens) | `wc -c` | Router + references loaded on demand (doc 05) |
| Enforcement is prose only; "don't claim done without a verdict" relies on the model remembering after compaction | VERIFY:52-74 | `Stop` soft gate (doc 06) |
| No project-type detection; the agent is told to read source and ask | ONBOARD §1 | `sprite-detect` + fit verdicts (doc 04) |
| No audit workflow (assess coverage of an existing suite, separate bug from test defect) | absent | `/testsprite:audit` (doc 07) |
| No path for MCP servers, CLI tools, libraries, GraphQL, monorepos | absent; backend skill says "test the API over HTTP" only | doc 04 |
| Spend control is advice ("don't auto-run the full suite") | ONBOARD "Don'ts" | `PreToolUse` guard (doc 06) |
| Install is per-repo files (committed, version-stamped) — good for teams, but it duplicates and drifts; 11 releases in 3 months since the 0.4.0 the earlier skills pin | HELP:agent-status; CHG | Plugin reads the **installed** CLI's own copy via `sprite-ref` |
| Two clashing locations of truth for the backend target URL | `{TARGET_URL}` in the skill vs `BASE_URL` in the CLI scaffold | **[U2]**; plugin templates use an explicit `BASE_URL` |
| BE dependency mechanism incomplete: tells you to declare `--produces`, not how the Python exports the value | VERIFY:241-271 | **[U1]** spike before backend guidance is final |

## 4. The author's earlier skills (`run-testsprite-backend`, `run-testsprite-frontend`)

Files: `sources/yigitkonur-skills/skills/run-testsprite-{backend,frontend}/`.

| | backend | frontend |
|---|---|---|
| `SKILL.md` | 26,374 B | 15,128 B |
| references | 6 files, 110,084 B | 5 files, 54,759 B |
| script | `audit_backend_test.py` 159,988 B | `audit_frontend_plan.py` 24,166 B |
| frontmatter | `disable-model-invocation: true` | `disable-model-invocation: true` |
| CLI pinned | `@testsprite/testsprite-cli@0.4.0` | `…@0.4.0` |
| Codex face | `agents/openai.yaml` | `agents/openai.yaml` |

### What they got right (distilled into the plugin)

| Idea | Why it is right | Where it lands |
|---|---|---|
| Don't call something verified on a rerun, an auto-healed pass, or a stale target; finish with a **fresh run after the deploy**. | Heal can change what is being tested; a replay of old code against old build proves nothing. | `verify`/`audit` result rules; "feedback vs proof" in `triage` reference |
| Freeze the expected test IDs/closure before a run; **never drop a failed member afterwards**; batch exit 0 is not green unless `conflicts`, `deferred`, `skipped*` are empty and every member is terminal `passed`. | Matches how `run --all` really reports (`accepted`, `conflicts`, `deferred`, `skippedFrontend`). [V VERIFY:479-488; DRY:test-run-all] | `audit` run phase |
| "Require a material consumer-visible contract and a **deployed-boundary signal native tests cannot give** before spending runs." | This is exactly the fit test that excludes most stdio-MCP and CLI-tool repos honestly. | `testsprite` skill `project-fit` reference |
| No secrets in argv; separate the TestSprite key plane from the app-credential plane; inherited `TESTSPRITE_API_KEY`/`TESTSPRITE_API_URL` override profiles. | Real footguns; also in the official CI skill. [V CI "Testing `ci run` locally"] | guard hook + `sprite-state` warnings |
| "Call every `test_*` function"; assertion-strength ledger (each material contract → a named assertion). | The silent-pass trap. | `authoring-backend` reference; `test lint`-style self-check |
| Distrust LLM root-cause as proof; correlate evidence to one pinned run. | Same as official `artifact get <run-id>` guidance. | `failure-triager` rubric |
| Honest "TestSprite cannot establish X" table. | Sets expectations; reused in fit docs. | doc 04 |

### Where they fall short (evidence)

| Gap | Evidence |
|---|---|
| **Pinned to 0.4.0.** Misses everything since: `--local`/tunnels, `plan generate/accept`, `project env`, `sign-in`, `ci run/init`, `testlist`, `schedule`, `test flaky/diff/lint/open`, `usage`, refunds, rerun billing, `--no-auto-heal`, `agent status`. | `…/SKILL.md` "CLI 0.4.0"; HELP:commands.txt (88 command paths) |
| **Routes localhost to MCP** — now stale; `--local <port>` handles FE loopback. | `run-testsprite-frontend/SKILL.md` step 3, `references/mcp-localhost.md`; HELP:test-run `--local` |
| **Says `test run --all --target-url` is rejected (exit 5).** 0.13.0 made it apply to FE batches. | `run-testsprite-frontend/SKILL.md` step 10; CHG 0.13.0 |
| **`disable-model-invocation: true` on both.** A verification skill that can never self-trigger cannot do "verify before done"; the user must remember to type it. | frontmatter |
| **Authorization ceremony on every action** (account, project, exact IDs, rollback, retention, cleanup owner…) — the CLI already requires `--confirm` for deletes, prints schedule cost first, and refuses unsafe states before charge. Proportionate for a release gate, heavy as the default for a 0.5-credit smoke run. | backend SKILL.md §2; HELP:schedule-create |
| **Size.** 26 KB + 110 KB references + a 160 KB auditor script; an agent cannot hold this, and the script's author concedes it "accepts a narrower … subset than the platform may support". | file sizes; backend SKILL.md §9 |
| **TypeScript-backend-first.** Not generic. | backend SKILL.md intro |
| **No hooks, no agents, no detection, no CI shapes.** `ci run` / `ci init` did not exist at 0.4.0. | absent |
| **Auto-heal persistence "unresolved".** 0.15.0 help answers the CLI side (replaces stored code); the portal docs disagree (**[U3]**). | frontend SKILL.md §9; HELP:test-rerun |
| Treats the backend target as unknowable (`--target-url`/`TARGET_URL` untrusted) — correct caution, but no resolution. | backend SKILL.md §6; **[U2]** |
| Wrapper boilerplate (`npm exec --yes --package=…@0.4.0 -- testsprite …`) repeated in every command; the official CI skill says **don't pin** the CLI because verdicts come from the backend. | frontend SKILL.md §4; CI "Keep what the template fixes" |
| Only one entry point each (a long procedure). No separate "set up" vs "audit" vs "verify" vs "CI" flows. | structure |

Net: the **discipline** is worth keeping (it is mostly judgment, which suits a plugin). The **mechanics** are stale and
heavy, and the main structural problem is that each skill is one large file the user must invoke by name, so nothing is
split by when it is needed.

## 5. What the SwiftUI plugin teaches (and what not to copy)

Source: `sources/plugin-swiftui/` (manifest 914 B, 1 hook, 1 agent, 4 commands, 33 skills, `eval/`).

| Pattern | What it does there | Borrow? |
|---|---|---|
| Knowledge as data behind a PATH CLI, queried on demand (`bin/swiftui-ctx` shim → `scripts/`) | Nothing is injected up front; the model runs `swiftui-ctx lookup X` | **Yes** → `sprite-detect`, `sprite-state`, `sprite-ref` in `bin/` (Claude adds `bin/` to the Bash PATH [V SPEC:plugins_components.md:572]) |
| One `PostToolUse` hook, **non-blocking, static grep, no CLI call, opt-out via settings file/env**, payload = precise list of deprecated names | Zero latency; `additionalContext` carries a concrete finding | **Yes in spirit**: our hooks are cheap, opt-out, and fire only with a concrete payload. **No** for a per-edit generic nudge (we have no precise lint to attach) |
| Thin command files that tell the model what to run (`commands/swiftui*.md`) | Body = "Do this now via Bash: …" | Partly: our user-only workflows are skills (newer format) with `` !`…` `` pre-execution so state arrives without a tool call |
| One reviewer agent, read-only (`tools: Bash, Read, Grep, Glob`), evidence-bound output | Findings ranked, no rewrites unless asked | **Yes** → `failure-triager`, `coverage-auditor` |
| `eval/` harness: baseline vs grounded output scored deterministically (parses, deprecated count, lint, shape regex) | Measures whether grounding helps | **Yes** → `claude plugin eval` suite (doc 08) |
| `AGENTS.md` maintenance rules: **bump `version` on any shipped change or nobody gets the fix**; manifest is strictly validated, no path fields | Prevents invisible fixes | **Yes** (doc 05 release rule) |
| Neutral settings location shared by Claude and Codex | Cross-agent | No: we use `userConfig` (native) and target Claude Code only |
| 33 skills, descriptions 585–1036 chars (median 986), SKILL.md bodies up to 21 KB | Domain-per-skill audit suite | **No.** ≈33 KB of always-on listing; our domain is small enough for 2 model-invocable entries |
| Generated catalog (tens of MB of JSON) | Needed because its knowledge is a corpus | **No.** Our live source is the installed CLI |
| Reports `$ARGUMENTS` and `` !`…` `` do not run when the model invokes a command through the Skill tool | `AGENTS.md` "Commands & skills are model-first" | Treated as **[U6]**; spec says pre-execution happens before the model sees the content [V SPEC:skills.md:129] — test it, and design model-invoked skills not to depend on it |

The transferable lesson is about **where knowledge lives and when it is paid for**: put deterministic lookups in a helper the model
calls, keep always-on text tiny, and spend a hook only where it carries a payload the model could not cheaply get itself.
