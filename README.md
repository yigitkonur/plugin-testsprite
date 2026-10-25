# plugin-testsprite

an **unofficial** claude code and codex plugin for the [testsprite](https://www.testsprite.com) cli. it doesn't wrap or replace the cli. it's the judgment layer around it: set a repo up, audit a suite, get a real verdict before claude says "done", gate ci, and say it straight when a repo just isn't a fit.

not affiliated with or endorsed by testsprite. "TestSprite" is their name.

<!-- kit:install:start -->
## install

Every plugin of ours is installed **once, globally, and off**, then **turned on per project**. Nothing runs and no tokens are spent in chats that don't switch it on. It works the same in Claude Code and Codex.

### 1. install it globally

**Claude Code**

```sh
claude plugin marketplace add yigitkonur/plugin-testsprite
claude plugin install testsprite@plugin-testsprite -s user          # stays off: defaultEnabled is false in the manifest
```

**Codex** (0.163+)

```sh
codex plugin marketplace add yigitkonur/plugin-testsprite
codex plugin add testsprite@plugin-testsprite
codex-plugin-project.sh global-off testsprite@plugin-testsprite     # Codex has no enable/disable command; this keeps it off everywhere
```

All our plugins, both hosts, plus the `plugin` command and the 6-hourly update job, in one line:

```sh
curl -fsSL https://raw.githubusercontent.com/yigitkonur/plugin-kit/main/install.sh | sh -s -- --all
```

### 2. turn it on in a project

```sh
cd your-project
plugin on testsprite    # Claude Code and Codex, this folder only
plugin off testsprite   # undo
plugin                  # or pick from a list (TUI)
```

By hand, without the `plugin` command:

```sh
claude plugin enable testsprite@plugin-testsprite --scope project      # undo: claude plugin disable testsprite@plugin-testsprite --scope project
codex-plugin-project.sh on testsprite@plugin-testsprite . --trust      # undo: codex-plugin-project.sh off testsprite@plugin-testsprite
```

Restart `claude` / `codex` in that folder afterwards.
Codex reads a folder's `.codex/config.toml` only when the folder is trusted; `--trust` adds that, and it also enables the folder's hooks and rules, so use it for your own projects only. `plugin` and `codex-plugin-project.sh` come from [plugin-kit](https://github.com/yigitkonur/plugin-kit) (the one-line installer above).

### 3. updates

A plugin updates only when its `version` changes, and this repo's `release` workflow bumps it on every shipped change. Machines pick it up with `plugin update`, or by themselves with the 6-hourly job (`plugin autoupdate install`). By hand:

```sh
claude plugin marketplace update plugin-testsprite && claude plugin update testsprite@plugin-testsprite
codex plugin marketplace upgrade plugin-testsprite        # then start a new session
```

No GitHub SSH key on the machine? `export CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` (`plugin install` sets it in Claude's settings for you).

### 4. uninstall

```sh
claude plugin uninstall testsprite@plugin-testsprite -s user
claude plugin marketplace remove plugin-testsprite
codex plugin remove testsprite@plugin-testsprite
codex plugin marketplace remove plugin-testsprite
```
<!-- kit:install:end -->

### bring your own testsprite cli and key

the plugin never installs the cli for you:

```
npm install -g @testsprite/testsprite-cli
! testsprite setup --no-agent
```

the `!` runs it in your session with a masked prompt, so the key never touches the chat. the `--no-agent` matters: plain `testsprite setup` installs the vendor's own skills, which duplicate this plugin.

### what you need

- claude code (tested on 2.1.302);
- macos or linux (the hooks run under `sh` and `git`; windows is untested);
- node 20.19+;
- the testsprite cli (checked against 0.15.x).

claude code may say three plugin settings are unset after install. that's fine, the defaults apply. `/plugin configure testsprite@plugin-testsprite` changes them.

### use it in codex

- the first time, codex shows "Hooks need review": pick "Trust all and continue".
- the plugin adds no mcp server, so `codex mcp list` stays empty. you know it's on when `codex plugin list` says `installed, enabled` and the `testsprite:*` skills are listed.
- codex has no subagents, no `bin/` on the path and no ask prompts for hooks. the skills tell codex to run `node <plugin root>/bin/sprite-*` and to read `agents/*.md` inline. the guard blocks instead of asking: get your yes, then the model reruns with `TESTSPRITE_CONFIRMED=1` in front. settings are env vars there: `TESTSPRITE_GUARD`, `TESTSPRITE_STOP_GATE`, `TESTSPRITE_CONFIRM_RUNS_OVER`.

## what it does

testsprite is a hosted testing service with a thin cli. you describe tests, their cloud runs them against an app it can reach, and you read structured verdicts. runs cost credits, the cli ships fast, and its agent guidance is long. this plugin keeps the stable knowledge (mental model, authoring rules, triage, fit, costs) and reads exact flags from the cli you actually have installed, so it doesn't rot when the cli changes.

| you type | what happens |
|---|---|
| `/testsprite:init` | detects the project type and **checks fit first**, then walks auth, project, sources, tests and a smoke run. nothing gets created in the cloud before the project step |
| `/testsprite:audit` | a read-only subagent maps your pages, endpoints and tools to the suite. you approve a costed run plan, and failures get classified (app bug, plan defect, test-code defect, environment, auth, flaky, starvation) |
| `/testsprite:verify` | claude uses this one on its own too, before calling a change done. it runs or creates the covering test and reports a verdict, or says `Unverified because <reason>` |
| `/testsprite:ci` | picks the pr-gate shape, generates and finishes the workflow, proves it on a real pr, optionally schedules a nightly |
| (automatic) | the `testsprite` skill answers "can testsprite even test this?", helps write frontend plans and backend test code, and reads red runs |

## fit: what testsprite can actually test

testsprite's cloud can only test what it can **reach**. the plugin says so out loud instead of pushing your repo through a setup that can't work.

| repo | fit | path |
|---|---|---|
| web frontend (spa, ssr, static, docs) | full | a url, or an app on your machine through **testsprite's own tunnel** (`project create --local <port>`; v3 account, any plan). never a third-party tunnel |
| rest / openapi backend | full, with a public url | spec upload plus generation, or hand-written python tests |
| graphql | partial | hand-written post tests |
| mcp server over streamable http, deployed | partial | hand-written json-rpc tests (template runs green in their sandbox) |
| **mcp server over stdio only** | **none** | native client tests; add and host an http transport to change the answer |
| **cli tool, library** | **none** | native subprocess or golden tests; test any web surface it also has |

a `none` verdict prints the reason and a "do instead" list, and creates nothing in the cloud. mixed repos (say an mcp server plus a landing site) go ahead on the testable part.

## safety model

- **spend guard** (`PreToolUse`, on by default). it asks before:
  - `test run --all`, big id lists, batch `--run`, `ci run`, `plan generate`, flaky checks, schedules and prd uploads;
  - deletions and `--force` overwrites;
  - a secret on the command line (`--password`, `--credential`, `--api-key`, …);
  - `setup` / `agent install` without `--no-agent`;
  - in a linked repo, the first billable run of a session and every fifth after it, so a fix-and-rerun loop can't quietly drain credits.
- **the guard's one `allow`.** it answers `allow` for exactly one thing: a lone read-only `testsprite` or `sprite-*` command. that means no pipes, `;` or `$()`, no `--endpoint-url`, and output only into `.testsprite/`. that's why the read-only subagents don't spam you with prompts. your own deny and ask rules still win. anything it can't vouch for falls through to the normal permission flow. it raises friction on common footguns and isn't a security boundary. it also keeps both subagents read-only.
- **session hook** (`SessionStart`) is silent unless the repo is linked (`.testsprite/config.json`, with an optional `targetUrl` saying where the app runs). in a linked repo it drops a few facts plus one standing rule: before saying a code change is done, get a testsprite verdict or end with `Unverified because <reason>`. docs, config and test-file edits are exempt.
  - measured on an ordinary change request: 0/5 with 0.1.1, 5/5 with this hook, 0/6 false triggers on exempt work.
- **stop gate** (`Stop`, **off by default**). once per change set it asks for a verdict or an explicit "unverified because …". the session rule above already does most of the work, so this is an opt-in backstop: flip `stop_gate` on if you want it.
- **settings** (`userConfig`): `guard` (true), `stop_gate` (false), `confirm_runs_over` (3).
- the plugin sends nothing anywhere and sets no telemetry. the cli has its own telemetry (`TESTSPRITE_NO_TELEMETRY` turns it off).

## what it costs to keep installed

about 230–350 tokens of always-on context, per `claude plugin details testsprite` (about 230 for an installed copy, about 350 loaded with `--plugin-dir`). hooks add no model context except the short note in linked repos. everything else loads only when a skill or agent fires.

## field-tested, not vibes

0.2.0 ran against the real testsprite cloud with a purpose-built app (an event-rsvp page plus a json api) on a trial account, for 25.2 credits:

- local frontend tests through testsprite's tunnel: a green baseline, two planted bugs caught by exactly the two tests that should catch them, then fixes verified;
- the plugin's triager on real failure bundles. it named the right commit and line and rejected testsprite's own wrong root-cause guess;
- backend tests on a public deploy, spec-driven and exploration-based generation, and heal.

where the service didn't behave like its docs, the guidance changed. two big ones:
- **a frontend replay isn't a verdict.** a strict replay passed a deployed bug that a fresh `test run` caught.
- **backend values hand over through `__VARS__`.**

full write-up: [`docs/design/11-field-test.md`](docs/design/11-field-test.md).

still not exercised: frontend generation with a signed-in test account, and windows. [`docs/design/09-evidence-ledger.md`](docs/design/09-evidence-ledger.md) lists every claim with its source.

## development

```
node --test tests/*.test.mjs          # detect, state, ref, hooks (no network, no credentials)
python3 -I scripts/flag_trace.py      # every `testsprite ...` command and flag here exists in the pinned cli
sh scripts/check_budget.sh            # claude plugin details: inventory and always-on tokens <= 400
sh scripts/secret_scan.sh             # no keys, personal paths or addresses in tracked files
claude plugin validate --strict .claude-plugin/plugin.json
claude plugin eval . --help           # behavior evals (see evals/README.md; every run is a paid model call)
```

a nightly workflow installs the newest published cli and opens an issue when a command or flag in the pinned surface disappears, or when plugin text stops tracing to it. release rules are in `AGENTS.md`. the design notes (why each piece exists, hooks considered and rejected, evidence) are in [`docs/design/`](docs/design/README.md).

## license

mit. see `THIRD_PARTY_NOTICES.md`.
