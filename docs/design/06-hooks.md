# 06 · Hooks: what each one prevents, why a skill cannot, what it costs — and what was rejected

Source keys and evidence tags: see `README.md`. Hook facts cite `SPEC:hooks.md` (raw, 2026-10-20). Latency figures were **estimates [I]** and are now **measured** in a live session (`claude --debug`, Claude Code 2.1.302): SessionStart 134 ms in-session in a linked repo (50 ms when run standalone; 20 ms when unlinked), guard 43-58 ms per testsprite command, Stop prefilter 7 ms when the gate is off. Token figures come from the shapes defined here.

## 0. The test every hook must pass

1. Name the failure it prevents (a thing that really happens, with a source).
2. Say why a skill, command, agent, or helper cannot do the same job.
3. State latency and context cost, and how to switch it off.
4. Carry a concrete payload or enforce something; never "remind in general".

Three hooks pass. Eight ideas failed (§5). One justification was **withdrawn during verification** (§6).

## 1. Summary

| Hook | Event | Prevents | Why not a skill | Latency | Context | Off |
|---|---|---|---|---|---|---|
| **A. session state** | `SessionStart` (`startup\|resume\|clear\|compact`) | Blind `testsprite` calls (no auth / wrong project); the CLI's `[warn]` pushing the model to run `testsprite setup` and install duplicate skills; losing the TestSprite rules after compaction | Skills cannot set env vars, and are not in context until invoked; state is dynamic | ~30 ms; Node only when linked | 0 in unlinked repos; ≈100 tokens per start/clear/compact in linked repos | none in v0.1 (silent unless the repo is linked); disabling the plugin removes it (Q17) |
| **B. guard** | `PreToolUse` on `Bash` with `if: Bash(testsprite *)` (+ `npx @testsprite/*`, `sprite-run *`) | Credit fan-out without a human; destructive commands satisfied by a blind `--confirm`/`--force`; secrets in argv; the model installing official skills over the plugin; subagents running billable commands | The model forgets; plugins cannot ship `permissions.ask` rules; the CLI's own `--confirm` is satisfied by the model itself | `if` filter ⇒ **0 spawns** on other Bash; ~25–40 ms on a testsprite command | 0 unless it intervenes (~60 tokens) | `guard: false` |
| **C. stop gate** | `Stop` | Declaring a change done in a TestSprite-linked app with neither a verdict nor an explicit "unverified because …" | Prose rules decay after compaction and are not consulted at the moment of "done" | ~5 ms when unlinked; ~40 ms when linked | 0 unless it blocks (~70 tokens, once per change set) | `stop_gate: false` |

## 2. Hook A — `SessionStart`: tiny, silent unless linked

**Input used:** `source`, `session_id`, `cwd`. **Output:** `hookSpecificOutput.additionalContext` (≤ 10,000 chars; we use < 800) and lines appended to `$CLAUDE_ENV_FILE`
(available for `SessionStart`). [V SPEC:hooks.md:1252, 1334-1346, 1385; additionalContext cap SPEC:hooks.md:1042]

**What it does, in order (all offline):**
1. Append `export TESTSPRITE_NO_SKILL_WARNING=1` to `$CLAUDE_ENV_FILE`. Reason: with `CLAUDECODE` set and no `.claude/skills/testsprite-verify`, `test run|rerun|create|create-batch` and
   `auth status` print a `[warn]` whose remedy is `testsprite setup` — which installs the duplicate official skills the plugin replaces. [V `sources/testsprite-cli/src/lib/skill-nudge.ts:42,154,211-214`]
   The env var is documented as the opt-out. [V DOC:1353 table `TESTSPRITE_NO_SKILL_WARNING`]
2. Find linked units: tracked `**/.testsprite/config.json` (one `git ls-files` call), else the root file. None ⇒ **exit 0 with no output** (steps 3–5 skipped).
3. Write the session baseline to `${CLAUDE_PLUGIN_DATA}/sessions/<session_id>.json`: `{head, startedAt, linkedRoots[]}`; prune files older than 14 days. (Survives plugin updates. [V SPEC:plugins_manifest-reference.md env vars])
4. Read CLI version from the installed package's `package.json` (no spawn); compare to the verified range; check `~/.testsprite/credentials` for a section / `TESTSPRITE_API_KEY` (**never read or print the key**); detect leftover official skills.
5. Emit context, phrased as **facts, not commands**, because imperative "system" phrasing can trip the model's prompt-injection defenses and get surfaced to the user instead of used. [V SPEC:hooks.md:1140]

**Example payload (linked monorepo):**
```
TestSprite plugin 0.1.0. CLI 0.15.0 (verified range 0.15.x). Auth: API key from environment, no endpoint override.
Linked units: apps/web → proj_8f0f6 (frontend); services/api → proj_21ac3 (backend).
No TestSprite verdict has been recorded in this session.
Long TestSprite commands (plan generate, --local, --all, ci run) are run with run_in_background. Fan-out spend, deletions and overwrites are confirmed with the user.
Official testsprite-* skills are also installed in .claude/skills (duplicate guidance).
```
**Why `compact` is in the matcher:** compaction keeps only the most recent invocation of each skill (first 5,000 tokens each, 25,000 combined) [V SPEC:skills.md:614], so re-injecting 5 lines is cheaper than hoping the rules survived.

**Cost:** step 1 only (unlinked repos) is one `echo` ≈ 3 ms and no tokens. Linked: one `git ls-files` + a few file reads ≈ 30 ms, ≈ 100 tokens × (start + each clear/compact).
`SessionStart` does not block launch but the first response waits for it. [V SPEC:hooks.md:1230]
**Failure mode:** any error ⇒ exit 0 silently (a non-zero non-2 exit shows the first stderr line to the user). Fail open.

## 3. Hook B — `PreToolUse` guard

### 3.1 Trigger and fail-open parsing
`matcher: "Bash"` plus `if: "Bash(testsprite *)"`. `if` evaluates a permission-rule string, strips leading `VAR=value`, and checks **each subcommand** of a compound command; it is best-effort
(if Claude Code cannot tell what the Bash input runs, the hook runs anyway; use permissions for hard enforcement). [V SPEC:hooks.md:353, 427-450]
Extra handlers: `Bash(npx @testsprite/*)` for the no-install form, and `Bash(sprite-run *)` because the optional `sprite-run -- testsprite …` wrapper would otherwise hide the program name from the first `if`.

The script tokenizes each `testsprite` segment: skips global flags (`--profile <v>`, `--output <v>`, `--endpoint-url <v>`, `--request-timeout <v>`, `--dry-run`, `--verbose`, `--debug`), reads the subcommand path up to the first `-` token, then the flags.
**Anything it cannot parse ⇒ exit 0 with no output (fail open).** The guard raises friction on the common footguns; it is not a security boundary. [V SPEC:hooks.md:450]

**The guard never returns `allow`.** `permissionDecision: "allow"` *skips* the user's permission prompt [V SPEC:hooks.md:1958], which would silently widen what the user approved. Silence (exit 0, no JSON) defers to the normal permission flow; the guard only ever escalates to `ask` or `deny`.

### 3.2 Command classes (cost basis cited per row)

| Class | Commands | Decision | Basis |
|---|---|---|---|
| **R · read-only / free** | `project list\|get`, `project env list\|get`, `project sign-in get`, `test list\|get\|result\|steps\|diff\|code get\|lint\|scaffold\|open\|wait\|cancel`, `test failure get\|summary`, `test artifact get`, `usage`, `doctor`, `auth status`, `agent list\|status`, `tunnel list\|status`, `schedule list\|get\|run list`, `testlist list\|get`, `completion`, anything with `--dry-run` or `--help`, `test create --plan-template` | silent | HELP; DOC:356-380 pure-local helpers; `--dry-run` is "Skip the network and credentials" [HELP:top] |
| **A · single billable action** | `test run <id>` / `test rerun <id>` / `test create … --run` with ≤ `confirm_runs_over` ids; `test flaky --runs ≤ N` | silent | FE run/rerun 0.5, BE rerun 0.2 [V HELP:test-rerun; ONBOARD §5] |
| **B · fan-out spend** | `test run --all`; `test rerun --all`; `test run` with more ids than the threshold; `test create-batch --run`; `testlist run`; `ci run`; `test plan generate`; `test flaky` above threshold (default 5 runs ≈ 2.5 credits); `schedule create` / `schedule update --cron`; `project docs upload --role prd` | **ask**, message states what and the cheapest check (`testsprite usage`) | `--all` runs every test; `plan generate` bills per stage that runs; schedule firings bill like runs and the CLI already prints cost; PRD 0.5 [V DOC:609-736, 1014-1068; HELP] |
| **C · destructive / overwrite** | `project delete`, `test delete`, `test delete-batch`, `schedule delete`, `testlist delete`, `project env delete`, `tunnel stop --all`, `auth remove`; `--force` on `setup`, `agent install`, `test code put`, `test plan put`, `ci init`, `test scaffold` | **ask**, message names what is lost (e.g. "project delete cascades to sub-projects, tests and backend fixtures; no restore window") | `delete` requires `--confirm` and a model supplies it unprompted [V HELP:project; DOC:556-563] |
| **D · secret in argv** | any of `--password`, `--credential`, `--api-key`, `--client-secret`, `--refresh-token` (each has a `*-file` form except `--api-key`; `--var` is documented as plain-text-not-for-secrets and is out of scope) | **ask**, with the file-based remedy (`--password-file`, `--credential-file`, `--client-secret-file`, `--refresh-token-file`; for the API key use `setup --from-env` or let the user run `! testsprite setup --no-agent`) | argv lands in the transcript and shell history; the CLI itself says "prefer `--password-file`" [V HELP:project-env-create, project-auto-auth, project-credential] |
| **E · conflicting install** | `testsprite setup` / `agent install` **without** `--no-agent` (or `--skill` narrowed away) | **ask**: "this writes testsprite-verify/onboard/ci into .claude/skills; the plugin replaces them; use `setup --no-agent`" | default `setup` installs the official skills for detected agents [V HELP:setup] |
| **F · cloud writes, free** | `project create\|update`, `test create` (no `--run`), `test update`, `test plan accept\|put`, `test code put`, `project env create\|update\|set-default`, `project credential`, `project sign-in set`, `project docs upload --role api-doc` | silent | Free or free-tier [V HELP:project-credential "Free tier"; test-plan-accept "free"]. The *skills* require showing the drafted plan before creating |
| **G · held resource** | `tunnel start` | silent (skill steers to background) | holds a tunnel until stopped; 5 live bindings/user [V HELP:tunnel-start] |

`ask` carries a reason string shown to the user and the model, e.g.:
```
TestSprite: `test run --all` starts one billable run per test in the project (FE 0.5 credit, BE 0.2). The number of tests is not known to this check.
Check the balance first: `testsprite usage`. Approve to continue.
```

### 3.3 Read-only enforcement for the two agents
`PreToolUse` input carries `agent_id` and `agent_type` when the hook fires inside a subagent, and plugin hooks do run inside subagents. [V SPEC:hooks.md:269, 745-750]
When `agent_type` ends with `failure-triager` or `coverage-auditor`, any command **not** in class R (plus `test artifact get`/`test failure get --out`, which write local files only) is **denied** with
"read-only agent; return the finding to the caller". This substitutes for the `permissionMode`/`hooks` frontmatter that plugin agents are not allowed to set. [V SPEC:plugins_components.md:740]

### 3.4 What it deliberately does not do
- No `updatedInput` rewriting of the user's command (invisible mutation). Candidates considered and dropped: adding `--output json`, adding `--timeout`.
- No network calls (no `usage` lookup): the balance check stays in the model's hands so the hook stays at ~30 ms.
- No block on unknown subcommands (new CLI releases add commands; unknown ⇒ silent).

## 4. Hook C — `Stop` soft verify gate

**Algorithm (deterministic, no LLM):**
1. Read `${CLAUDE_PLUGIN_DATA}/sessions/<session_id>.json`. No file, or `linkedRoots` empty ⇒ exit 0.
2. If `stop_hook_active` is true ⇒ exit 0 (never loop; Claude Code also caps consecutive stop-hook continuations at 8). [V SPEC:hooks.md:2594, 2732]
3. `changed` = `git diff --name-only <baseline.head>..HEAD` ∪ `git ls-files -m -o --exclude-standard` filtered to files with mtime > `startedAt`.
4. Drop non-behavioral paths (the vendor's skip list: docs-only, pure build/config): `*.md`, `*.mdx`, `docs/**`, lockfiles, `tsconfig*`, lint/format configs, `.github/**`, `.testsprite/**`, `.claude/**`, tests (`*.test.*`, `*.spec.*`, `tests/**`, `__tests__/**`). [V VERIFY:39-50]
5. Keep only files under a linked root. Empty ⇒ exit 0.
6. If a run was attempted after the newest changed file's mtime (the guard stamps attempts into the session file) **or** `last_assistant_message` already mentions a verdict (`testsprite`, `verified`, `unverified`, `could not run`, `not verified`) **or** it ends with `?` (the model is asking you something) ⇒ exit 0. [V `last_assistant_message` is provided to `Stop`: SPEC:hooks.md:738, 2577]
7. Otherwise record `nagged_for = newest mtime` (so the same change set never blocks twice) and emit:
   `{"decision":"block","reason":"Files changed under linked project proj_8f0f6 (apps/web/src/Cart.tsx, +2) and no TestSprite verdict is recorded. Run /testsprite:verify, or say 'unverified because <reason>' in the reply."}`.

**What it enforces:** honesty, not spend. The model can satisfy it by saying why it did not verify (no credentials, no reachable target). That mirrors the vendor rule
("Feature shipped but I could not run any TestSprite test because <X>. Treat this as unverified…"). [V VERIFY:72-74]
**Cost:** ~5 ms in unlinked repos (a `grep` on the small session file, via the `sh` prefilter); ~40 ms linked; tokens only when it blocks.
**Failure modes and mitigations:** false positive on exploratory edits ⇒ once per change set + a question-mark escape + opt-out; non-git repos ⇒ gate is a no-op; a model that replies with the magic words without verifying ⇒ not defended
(deliberately; it is an honesty gate, and the verdict line is visible to you).
**Ship rule:** built last (Phase 3b), `stop_gate` default on only in linked repos, and measured in dogfood (false-positive rate < 1 in 20 stops) before the default stays on.

## 5. Hooks considered and rejected

| Idea | Why rejected |
|---|---|
| **`PostToolUse` after every `Edit`/`Write` ("consider verifying")** | The SwiftUI plugin's PostToolUse works because it carries a precise lint finding. A generic nudge repeats every edit, is ignored within a session, and burns context. The Stop gate checks once, at the moment that matters. |
| **`UserPromptSubmit` keyword injection ("test", "verify")** | Duplicates what a skill description already does, costs tokens on every prompt in every repo, and misfires on unrelated uses of "test". |
| **`PostToolUse` on `testsprite test run` that auto-fetches the bundle / parses results** | Hidden automation that spends the agent's context and needs judgment (plan vs product). The skill + `failure-triager` do it visibly. |
| **`prompt`- or `agent`-type hooks** (LLM judging "did you verify?") | Seconds of latency and tokens on every stop for what a deterministic check does; also non-deterministic. [V SPEC:hooks.md hook types] |
| **`PreCompact` hook persisting a run-id ledger** | Cloud history (`test result <id> --history --source cli --since 1h`) already is the ledger; a local copy goes stale. [V HELP:test-result] |
| **`Setup` hook that installs the CLI** | The vendor skill forbids installing behind the user's back; `init` states the command and asks. [V VERIFY:83-86] |
| **Rewriting commands to add `--output json` / `--timeout`** | Invisible mutation of what the user and model wrote; the skills state the convention instead. |
| **Setting `TESTSPRITE_CLIENT=<plugin>/<ver>`** | Would report the plugin's identity in the user's CLI telemetry without being asked. [V DOC:1358-1401 telemetry] |

## 6. A justification that was withdrawn (verification record)

The first version of this plan said the guard should **deny foreground `--wait` commands** because a foreground Bash call that exceeds the tool timeout (120 s default, 600 s max)
would be killed and leave a detached run **billing**. Reading Claude Code's tool reference showed that is **mostly false in interactive sessions**: when a foreground command reaches its timeout,
"Claude Code moves it to the background instead of stopping it" (unless it begins with `sleep`). [V SPEC:tools-reference.md:213-215] It stays true only when auto-backgrounding is disabled
(`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` or bare mode, where a command that reaches its timeout stops [V same:217]) and when a background command hits its time limit in unattended sessions
(30 min, or 10 min for `claude -p` with a text prompt) [V same:191-205]. Consequences for the design:

- The deny is **dropped**. Long commands are steered into the background by the `testsprite` skill rules (cheap, advisory).
- `sprite-state` reports `bgTasksDisabled`; when true, the skill rules tell the model to keep `--timeout` below the foreground limit.
- In `claude -p` runs, a local run whose `--timeout` (default 1200 s) exceeds the background limit (10 min) will be stopped by the harness; the CLI then cancels an owned local run
  (refund attempted) [V HELP:test-run]. Documented as a risk, not a hook.

A second, genuine hazard came out of the same page and is handled in doc 05 (`sprite-run`): non-zero exits (TestSprite's exit 1 on a failed test) are "failure" results truncated to ~10 K characters with no file path. [V SPEC:tools-reference.md:166-176]

## 7. `hooks/hooks.json` sketch (loads in a throwaway skeleton: `plugin details` lists SessionStart, PreToolUse, Stop)

```json
{
  "description": "TestSprite steering hooks (session state, spend/destructive guard, verify-before-done)",
  "hooks": {
    "SessionStart": [
      { "matcher": "startup|resume|clear|compact",
        "hooks": [ { "type": "command", "command": "sh", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/session-start.sh"] } ] }
    ],
    "PreToolUse": [
      { "matcher": "Bash",
        "hooks": [
          { "type": "command", "if": "Bash(testsprite *)",     "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"] },
          { "type": "command", "if": "Bash(npx @testsprite/*)", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"] },
          { "type": "command", "if": "Bash(sprite-run *)",      "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs"] }
        ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "sh", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/stop-gate.sh"] } ] }
    ]
  }
}
```
Exec form (`command` + `args`) is used because the hooks reference `${CLAUDE_PLUGIN_ROOT}`, and exec form passes each argument unquoted-safe. [V SPEC:hooks.md:458-490] `hooks/hooks.json` carries the top-level `"hooks"` wrapper. [V SPEC:plugins_manifest-reference.md hooks]

## 8. Test plan per hook (details in doc 08)

| Hook | Test |
|---|---|
| A | Pipe `{"hook_event_name":"SessionStart","source":"startup","session_id":"t1","cwd":"<fixture>"}` into the script with fixture repos: unlinked (⇒ empty stdout, env line written), linked-single, linked-monorepo, linked + official skills present, CLI absent, key absent. Golden stdout JSON. |
| B | One fixture per row of §3.2 (≈ 40 command strings incl. `VAR=x testsprite …`, `cd x && testsprite …`, `npx @testsprite/testsprite-cli …`, `sprite-run -- testsprite …`, unparseable shell) ⇒ expected `{}` / `ask` / `deny`; subagent fixtures with `agent_type`. |
| C | Fixture repos + session files: no changes; docs-only change; code change unverified; code change with run stamp; message with "unverified because"; message ending "?"; `stop_hook_active:true`. |
| All | `claude --debug` shows `Hooks: <event>:<matched> … finished with status N (Nms)` lines (2.1.296+) for latency numbers. [V SPEC:hooks.md:4228] |
