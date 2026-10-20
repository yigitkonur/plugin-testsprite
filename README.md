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
| Web frontend (SPA, SSR, static, docs site) | full | URL, or a local port through a tunnel (V3 account) |
| REST / OpenAPI backend | full if it has a public URL | spec upload or hand-written tests |
| GraphQL | partial | hand-written POST tests |
| MCP server over streamable HTTP, deployed | partial | hand-written JSON-RPC tests (experimental template) |
| **MCP server over stdio only** | **none** | native client tests; add and host an HTTP transport to change the answer |
| **CLI tool, library** | **none** | native subprocess/golden tests; test any hosted or web surface it also has |

A `none` verdict prints the reason and a "do instead" list, and creates no cloud state. Mixed repos (an MCP server plus a landing site) proceed on the testable part.

## Install

Requires Claude Code (tested on 2.1.302), Node 20.19 or newer, and the TestSprite CLI installed separately (`npm install -g @testsprite/testsprite-cli`; verified against 0.15.x). The plugin never installs it for you.

```
claude plugin marketplace add yigitkonur/plugin-testsprite
claude plugin install testsprite@plugin-testsprite
```

Claude Code may note that three plugin settings are unset after install; the defaults apply (guard on, Stop gate off, confirm above 3 runs), and `/plugin configure testsprite@plugin-testsprite` changes them.

Authenticate yourself: create a workspace key in the TestSprite portal and run `! testsprite setup --no-agent` (masked prompt). The plugin never reads, prints or asks for the key. Do not run `testsprite setup` without `--no-agent`: it installs the official skills this plugin replaces (the plugin silences the CLI's nag about that).

## Safety model

- **Spend guard** (`PreToolUse`, on by default): asks before `test run --all`, large id lists, batch `--run`, `ci run`, `plan generate`, flaky checks, schedules and PRD uploads; before deletions and `--force` overwrites; before a secret goes on the command line (`--password`, `--credential`, `--api-key`, ...); and before `setup`/`agent install` without `--no-agent`. It only ever escalates to `ask` or `deny` and never returns `allow`. Anything it cannot parse passes silently: it raises friction on common mistakes and is not a security boundary. It also keeps the two subagents read-only.
- **Session hook** (`SessionStart`): silent unless the repo is linked to a TestSprite project (`.testsprite/config.json`). In a linked repo it injects a few facts (CLI version, auth source, linked units).
- **Stop gate** (`Stop`, **off by default in 0.1.0**): once per change set, asks for a verdict or an explicit "unverified because ...". Enable it with the `stop_gate` plugin setting once you want it; it ships off until its false-positive rate is measured.
- Settings (`userConfig`): `guard` (true), `stop_gate` (false), `confirm_runs_over` (3).
- The plugin sends nothing anywhere and sets no telemetry variables. The CLI has its own telemetry; see its docs (`TESTSPRITE_NO_TELEMETRY`).

## Cost of having it installed

About 230 to 350 tokens of always-on context, as reported by `claude plugin details testsprite` (about 230 for an installed copy, about 350 when loaded with `--plugin-dir`; the tool's own estimate, covering two model-invocable skills, two agents and three short user-only skill descriptions). Hooks add no model context except a short note in linked repos. Everything else loads when a skill or agent runs.

## What is not verified yet

Be skeptical of these; the plugin tags them "unverified" wherever it uses them.

- **The TestSprite cloud was never called while building this.** No account, key or credit was used. Everything that depends on cloud behavior (plan generation, runs, failure bundles, dependency exports) comes from the CLI's help and documentation, not from a live run. Offline behavior (detection, state, hooks, the guard, validation, fit verdicts) is tested.
- Backend dependency hand-off (`--produces` / `--needs`): how a producer's Python exports a value is undocumented. Guidance prefers self-contained tests.
- Whether `TARGET_URL` is injected into backend tests: not relied on; templates use an explicit `BASE_URL`.
- Whether auto-heal overwrites stored test code (the CLI help and the portal docs disagree) and whether Auto Cleanup covers CLI-authored tests.
- The MCP-over-HTTP test template has not run in TestSprite's sandbox.

`docs/design/09-evidence-ledger.md` lists every claim with its source and every unknown with how to close it.

## Development

```
node --test tests/*.test.mjs          # detect, state, ref, hooks (no network, no credentials)
python3 -I scripts/flag_trace.py      # every `testsprite ...` command and flag in the plugin exists in the pinned CLI
sh scripts/check_budget.sh            # claude plugin details: inventory and always-on tokens <= 400
sh scripts/secret_scan.sh             # no keys, personal paths or addresses in tracked files
claude plugin validate --strict .claude-plugin/plugin.json
claude plugin eval . --help           # behavior evals (see evals/README.md; every run is a paid model call)
```

A nightly workflow installs the newest published CLI and fails when a command or flag the plugin cites is gone. `AGENTS.md` has the release rules. The design notes (why each piece exists, hooks considered and rejected, evidence) are in [`docs/design/`](docs/design/README.md).

## License

MIT. See `THIRD_PARTY_NOTICES.md`.
