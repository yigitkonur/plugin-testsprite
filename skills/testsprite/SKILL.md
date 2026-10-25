---
name: testsprite
description: Use for TestSprite CLI work: projects, tests, runs, failures, CI gates; writing test plans or backend test code; deciding whether TestSprite fits a repo (web, HTTP API, MCP server, CLI tool).
---

# TestSprite

TestSprite is a hosted testing service with a thin CLI (`testsprite`). You describe a test; TestSprite's cloud runs it against an app it can **reach over the network**; you read a structured verdict. Frontend tests are plain-language steps run by a cloud browser agent. Backend tests are Python (`requests`) that you write and the cloud executes. Cloud work costs **credits**, not tokens: `--wait` makes the CLI poll, so you stay idle while it runs.

This plugin is unofficial. It adds judgment on top of the CLI and never restates the CLI's flags: the installed CLI is the source of truth for syntax (`sprite-ref`, see [cli-surface](references/cli-surface.md)). The CLI changes often; check the version banner and read live help before trusting a remembered flag.

## Rules of engagement

1. **Long commands go in the background.** Run `test plan generate`, anything with `--local`, `--all`, or `ci run` with `run_in_background`; the harness re-invokes you when they exit. A foreground command that reaches Claude's timeout is moved to the background, not killed, unless background tasks are disabled; then it stops and a billing run can be left behind. `sprite-state` reports `bgTasksDisabled`.
2. **Capture big output.** A non-zero exit, including TestSprite's exit 1 for a failed test, is a failure result truncated to about 10,000 characters with no file path. Redirect to a file when a command can print a lot (`mkdir -p .testsprite/tmp`, then `> .testsprite/tmp/<name>.json 2>&1`), and keep the stderr receipts (`Run <runId>`, `Dashboard: <url>`). Run reads alone and plain, with no pipes or `;`: the plugin approves a lone read without a prompt and asks the user about a compound command.
3. **Spend with consent.** Reads are free. A single run costs about 0.5 credit (frontend) or 0.2 (backend rerun). Anything that fans out (`--all`, `plan generate`, batch `--run`, schedules, PRD upload, flaky checks) needs the user's yes first; the plugin's guard asks too, and it also asks at the first billable run of a session and at every fifth. See [costs-and-limits](references/costs-and-limits.md).
4. **Secrets never go in argv or chat.** Use the `*-file` flags (`--password-file`, `--credential-file`, and the like) or have the user run `! testsprite setup --no-agent` themselves. Never print or invent a key. If the user pastes a key into chat anyway: write it once to a gitignored mode-600 `.env` (or `testsprite setup --from-env --no-agent`), load it from there for every command, never echo it, and tell the user it is now in the transcript and should be rotated later.
5. **Say what you ran and what it proved.** End with a terminal verdict per test (`id · name · verdict`, dashboard link) or `Unverified because <reason>`. Never claim done on a change TestSprite did not run.
6. **Plan problem before product problem.** Most red runs on frontend tests are wording or environment. Read [triage](references/triage.md) before changing app code, and hand big failure bundles to the `failure-triager` agent.
7. **A frontend replay is not proof; a fresh run is.** `test rerun` (and `--no-auto-heal`) replays the stored Playwright script, whose assertions can be just "the page loaded": the plan's checks are judged by the AI only during an agent run. In the field test a strict replay **passed** a deployed stale-count bug that a fresh `test run` **failed**. Verify a change, and gate a release, with a fresh `test run`. Auto-heal re-authors a drifted script and replaces the stored version (`codeVersion` goes up). A local tunnel run is always an agent run.
8. **Do not install or configure behind the user's back.** If the CLI is missing, give the install command and ask. Do not run `testsprite setup` without `--no-agent`: it installs official skills that duplicate this plugin.
9. **Say "not a fit" out loud.** stdio MCP servers, CLI tools and libraries have no network surface for the cloud to call. Run `sprite-detect`, report the verdict with its reason and the "do instead" path, and create nothing in the cloud. See [project-fit](references/project-fit.md).
10. **Portal-only work is handed off, not faked.** Feature-map editing, re-exploration, proposal editing, SSO capture, run-behavior settings, integrations, insights, key minting: say which portal screen, then continue with what the CLI can do. See [portal-handoffs](references/portal-handoffs.md).

## Router

| You are about to... | Read |
|---|---|
| explain TestSprite, its terms, FE vs BE, what runs where | [concepts](references/concepts.md) |
| run, wait, read results, fix, rerun | [agent-loop](references/agent-loop.md) |
| test an app running on this machine (`localhost`), or keep a tunnel open across runs | [local-and-tunnels](references/local-and-tunnels.md): TestSprite's own tunnel, never a third-party one |
| run more than one test, or wonder what something costs | [costs-and-limits](references/costs-and-limits.md) |
| react to a non-zero exit | [exit-codes](references/exit-codes.md) |
| judge whether a repo can use TestSprite | [project-fit](references/project-fit.md) (run `sprite-detect` first) |
| write a frontend plan | [authoring-frontend](references/authoring-frontend.md) |
| write backend test code (REST, GraphQL, MCP over HTTP) | [authoring-backend](references/authoring-backend.md) and `templates/` |
| read a red run | [triage](references/triage.md) |
| something only the web portal can do | [portal-handoffs](references/portal-handoffs.md) |
| gate pull requests or schedule a nightly run (`ci init` generates GitHub Actions only; other CI gets a generic recipe) | [ci-shapes](references/ci-shapes.md) |
| need exact flags or output shapes | [cli-surface](references/cli-surface.md) |

## Workflows

- `/testsprite:init` sets a repo up: fit gate, auth, project, sources, plans, smoke run.
- `/testsprite:audit` assesses an existing project, runs it with approval, and separates app bugs from test defects.
- `/testsprite:verify` (also used by you at "about to say done") gets a verdict for a change.
- `/testsprite:ci` gates pull requests or schedules a regression run.

`init`, `audit` and `ci` start only from the user: they are slash commands the model cannot invoke. When the user asks for one in prose, name the command to type and do the free steps now (`sprite-state`, `sprite-detect`, the fit verdict).

## Helpers on the PATH

- `sprite-state [--json]`: CLI present and version, auth source (never the key), linked project, duplicate official skills, background-task setting. Offline.
- `sprite-detect [path] [--json]`: project kinds, transport, deploy signals, and the fit verdict per unit. Offline.
- `sprite-ref skill|schema|help|version`: the installed CLI's own guidance, schema and help.

## In Codex

Same skills, no `bin/` on the PATH: run a helper as `node <plugin root>/bin/sprite-state` (and `sprite-detect`, `sprite-ref`), where the plugin root is two folders above this SKILL.md. A `!`command`` line in a skill is not run for you; run it yourself. There are no subagents: where a skill names `failure-triager` or `coverage-auditor`, read `agents/<name>.md` in the plugin root and follow it inline. There is no background mode: give a long command a long timeout instead. The guard blocks (it cannot ask): when it does, get the user's yes and rerun with `TESTSPRITE_CONFIRMED=1` in front. Settings are env vars: `TESTSPRITE_GUARD=false`, `TESTSPRITE_STOP_GATE=true`, `TESTSPRITE_CONFIRM_RUNS_OVER=<n>`.

## Pure-local commands (no network, no key)

`testsprite test scaffold`, `testsprite test lint`, `testsprite test create --plan-template`, and any command with `--dry-run` make no network call. Use them to validate plans and to learn output shapes before any credentials exist.

## When unsure

Prefer the smaller, reversible, free action; show the user the plan or code before creating cloud state; and when a source disagrees with the installed CLI's help, the help wins.
