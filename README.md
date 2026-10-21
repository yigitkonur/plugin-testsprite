# plugin-testsprite

An **unofficial** Claude Code plugin for the [TestSprite](https://www.testsprite.com) CLI. It does not wrap or replace the CLI; it adds the judgment around it: set a repo up, audit an existing suite, get a verdict before saying "done", gate CI, and say honestly when a repo is not a fit.

Not affiliated with or endorsed by TestSprite. "TestSprite" is their name.

## What it does

TestSprite is a hosted testing service with a thin CLI: you describe tests, the cloud runs them against an app it can reach over the network, and you read structured verdicts. The CLI costs credits, changes often, and its agent guidance is long. This plugin keeps the stable knowledge (mental model, authoring rules, triage, fit, cost classes) and reads exact flags from the **installed** CLI at the moment of use, so it does not rot when the CLI changes.

| You type | What happens |
|---|---|
| `/testsprite:init` | Detects the project type, **checks fit first**, then walks auth, project, sources, tests and a smoke run. Creates nothing in the cloud until the project step. |
| `/testsprite:audit` | A read-only subagent maps the repo's pages, endpoints and tools to the suite; you approve a costed run plan; failures are classified (app bug, plan defect, test-code defect, environment, auth, flaky, starvation). |
| `/testsprite:verify` | Also used by Claude itself before it reports a change done: run or create the covering test and report a verdict, or `Unverified because <reason>`. |
| `/testsprite:ci` | Pick the PR-gate shape, generate and finish the workflow, prove it on a real PR, optionally schedule a nightly run. |
| (automatic) | The `testsprite` skill answers "can TestSprite test this?", helps write frontend plans and backend test code, and reads red runs. |

## Fit: what TestSprite can test

TestSprite's cloud can only test something it can **reach over the network**. The plugin says so out loud instead of pushing a repo through a setup that cannot work.

| Repo | Fit | Path |
|---|---|---|
| Web frontend (SPA, SSR, static, docs site) | full | URL, or an app on your machine through TestSprite's own tunnel (`project create --local <port>`, V3 account, any plan) |
| REST / OpenAPI backend | full if it has a public URL | spec upload or hand-written tests |
| GraphQL | partial | hand-written POST tests |
| MCP server over streamable HTTP, deployed | partial | hand-written JSON-RPC tests (experimental template) |
| **MCP server over stdio only** | **none** | native client tests; add and host an HTTP transport to change the answer |
| **CLI tool, library** | **none** | native subprocess/golden tests; test any hosted or web surface it also has |

A `none` verdict prints the reason and a "do instead" list, and creates no cloud state. Mixed repos (an MCP server plus a landing site) proceed on the testable part.

## Install

Requires Claude Code (tested on 2.1.302), macOS or Linux (the hooks run under `sh` and `git`; Windows is untested), Node 20.19 or newer, and the TestSprite CLI installed separately (`npm install -g @testsprite/testsprite-cli`; verified against 0.15.x). The plugin never installs it for you.

```
claude plugin marketplace add yigitkonur/plugin-testsprite
claude plugin install testsprite@plugin-testsprite
```

Claude Code may note that three plugin settings are unset after install; the defaults apply (guard on, Stop gate off, confirm above 3 runs), and `/plugin configure testsprite@plugin-testsprite` changes them.

Authenticate yourself: create a workspace key in the TestSprite portal and run `! testsprite setup --no-agent` (masked prompt). The plugin never reads, prints or asks for the key. Do not run `testsprite setup` without `--no-agent`: it installs the official skills this plugin replaces (the plugin silences the CLI's stderr nudge about that; `testsprite doctor` still prints it, so ignore that line).

## Safety model

- **Spend guard** (`PreToolUse`, on by default): asks before `test run --all`, large id lists, batch `--run`, `ci run`, `plan generate`, flaky checks, schedules and PRD uploads; before deletions and `--force` overwrites; before a secret goes on the command line (`--password`, `--credential`, `--api-key`, ...); before `setup`/`agent install` without `--no-agent`; and, in a linked repo, before the first billable run of a session and every fifth after it, so a fix-and-rerun loop cannot spend silently. It escalates to `ask` or `deny`, and answers `allow` for exactly one thing: a lone read-only command (one `testsprite` or `sprite-*` command, no pipes, `;`, `$()` or other shell syntax, no `--endpoint-url`, `--out` only under `.testsprite/`, output redirected only to `.testsprite/tmp/`), so the two subagents are not prompted for every read. Your own deny and ask rules still win over an `allow`. Anything else it cannot vouch for passes silently to the normal permission flow: it raises friction on common mistakes and is not a security boundary. It also keeps the two subagents read-only.
- **Session hook** (`SessionStart`): silent unless the repo is linked to a TestSprite project (`.testsprite/config.json`; an optional `targetUrl` there tells later sessions where the app runs). In a linked repo it injects a few facts (CLI version, auth source, linked units and their app URL) and one standing instruction: before reporting a code change done, get a TestSprite verdict with the verify skill or end with `Unverified because <reason>`. Docs, config and test-file edits are exempt.
- **Stop gate** (`Stop`, **off by default**): once per change set, asks for a verdict or an explicit "unverified because ...". The session instruction above already steers most turns (in 5 of 5 headless sessions with an ordinary change request the model invoked verify and ended with a verdict or a reasoned "Unverified because"; 0.1.1 did so in 0 of 5), so the gate is an opt-in backstop. Enable it with the `stop_gate` plugin setting.
- Settings (`userConfig`): `guard` (true), `stop_gate` (false), `confirm_runs_over` (3).
- The plugin sends nothing anywhere and sets no telemetry variables. The CLI has its own telemetry; see its docs (`TESTSPRITE_NO_TELEMETRY`).

## Cost of having it installed

About 230 to 350 tokens of always-on context, as reported by `claude plugin details testsprite` (about 230 for an installed copy, about 350 when loaded with `--plugin-dir`; the tool's own estimate, covering two model-invocable skills, two agents and three short user-only skill descriptions). Hooks add no model context except a short note in linked repos. Everything else loads when a skill or agent runs.

## Field-tested

0.2.0 was checked against the real TestSprite cloud with a purpose-built app (an event-RSVP page plus a JSON API) on a trial account. It covered:

- local frontend tests through TestSprite's tunnel: a green baseline, two deliberate bugs caught exactly as predicted, fixes verified;
- the plugin's triager on the real failure bundles;
- backend tests on a public deploy;
- spec-driven and exploration-based generation;
- heal.

The plugin's guidance changed where the service behaved differently from its docs. Two examples: a frontend replay is not a verdict (a fresh `test run` is), and backend values hand over through `__VARS__`. See [`docs/design/11-field-test.md`](docs/design/11-field-test.md).

Still not exercised: whether `ci run` replays or runs fresh; frontend generation with a signed-in test account; Windows. `docs/design/09-evidence-ledger.md` lists every claim with its source.

## Development

```
node --test tests/*.test.mjs          # detect, state, ref, hooks (no network, no credentials)
python3 -I scripts/flag_trace.py      # every `testsprite ...` command and flag in the plugin exists in the pinned CLI
sh scripts/check_budget.sh            # claude plugin details: inventory and always-on tokens <= 400
sh scripts/secret_scan.sh             # no keys, personal paths or addresses in tracked files
claude plugin validate --strict .claude-plugin/plugin.json
claude plugin eval . --help           # behavior evals (see evals/README.md; every run is a paid model call)
```

A nightly workflow installs the newest published CLI and opens an issue when a command or flag in the pinned CLI surface is gone, or plugin text no longer traces to it. `AGENTS.md` has the release rules. The design notes (why each piece exists, hooks considered and rejected, evidence) are in [`docs/design/`](docs/design/README.md).

## License

MIT. See `THIRD_PARTY_NOTICES.md`.
