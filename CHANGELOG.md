# Changelog

## 0.2.4 - 2026-10-25

- fix(detect): trim marker evidence so indented matches dedupe (ce9dcb8)

## 0.2.3 - 2026-10-25

- fix(detect): argparse only marks a CLI in a file that runs (93142ab)

## 0.2.2

- ci: automatic version bump, tag and release after ci passes on main (811d882)
- docs: lead with the one-line install (--marketplace), add the installed-but-off recipe (d6789ec)

## 0.2.1

- **`sprite-detect` reads the port of a plain `node <file>` start script** (`PORT || 4173`, `.listen(4173)`). Before, a zero-dependency Node app reported no dev server, so `verify` had to ask for the port.
- **`ci run` is a fresh run, not a replay** (CLI 0.15.0 source: `ci.js` calls `runTestRunAll`, the `test run --all` path), so a CI gate gets agent-judged frontend verdicts. `ci-shapes.md` says so.
- **New eval case `11-linked-change-verifies`:** a linked repo and an ordinary change request that never mentions TestSprite. With the plugin it scored 1.00 and `verify` fired; without it, 0.00.
- **README rewritten**, with the install commands checked against `claude plugin --help` and a fresh marketplace install.

## 0.2.0

Steering fixes measured in headless sessions, then a field test against the real TestSprite cloud ([docs/design/11-field-test.md](docs/design/11-field-test.md)).

- **Verify before "done", by default.** In a linked repo the SessionStart text now tells the model to get a verdict with the verify skill, or end with "Unverified because <reason>". It also shows where the app runs (`targetUrl` in `.testsprite/config.json`, written by `init`).
  - On an ordinary change request: 0/5 with 0.1.1 → 5/5 with the directive.
  - Exempt work (docs, a question, a test file): 0/6 false triggers.
  - The Stop gate stays off by default, by the rule set in advance.
- **Session spend consent.** The guard asks before the first billable run of a session and again at every fifth, so a fix-and-rerun loop cannot spend silently.
- **Prompt-free reads.** The guard answers `allow` for exactly one thing: a lone read-only `testsprite` or `sprite-*` command. That means no pipes, `;`, `$()` or other shell syntax, no `--endpoint-url`, and `--out` or redirects only into `.testsprite/`. The literal `mkdir -p .testsprite/tmp|runs` is allowed too. Your own deny and ask rules still win.
  - In default permission mode the 0.1.1 `failure-triager` was denied its first read and returned `inconclusive`; now it works with 0 prompts.
  - The agents are told to run each read alone.
- **TestSprite's own tunnel is first-class.** New reference `local-and-tunnels.md`:
  - saved loopback projects tunnel by themselves;
  - `tunnel start --ttl` + `--tunnel-client` (on `test run` only);
  - owned vs borrowed tunnels;
  - local runs never store or replay code;
  - no generation on local projects;
  - limits and exit codes.

  `project-fit` and `verify` no longer point frontends at third-party tunnels.
- **Replay is not a verdict.** A frontend `test rerun` (`--no-auto-heal` included) replays stored code whose assertions can be just "page loaded". In the field test it passed a deployed bug that a fresh `test run` failed. `verify`, `agent-loop`, `audit` and the skill rules now use a fresh `test run` to verify a change. `--no-auto-heal` on a local run is a guaranteed `blocked`, and the text no longer suggests it.
- **Backend facts, field-verified:**
  - values hand over through `__VARS__`;
  - `TARGET_URL` is not injected;
  - `__AUTH_CREDENTIAL__` is the raw secret (never print globals);
  - Auto Cleanup does not cover CLI-authored tests;
  - a fresh backend run costs 0.2 credit;
  - auto-assembled integration tests exist, cost 0.2 per batch and can pass vacuously;
  - `codeVersion` lives in `test code get`;
  - upload a spec and let it finish processing before generating;
  - generated tests need triage (4 of 14 broken on a correct app).

  The MCP-over-HTTP template ran green in the sandbox. Heal replaces the stored code (`codeVersion` v1.0 → v2.0).
- **Smaller fixes:**
  - the agent-loop no longer forbids fixing your own regression;
  - the triage heuristic for recorded actions is corrected;
  - several ids in one `test run` work only through a tunnel;
  - the Starter plan allows one environment;
  - a pasted key goes to a 600 `.env` and is never echoed;
  - never reset app data to make a test pass;
  - dry runs no longer count as run attempts.

## 0.1.1

Fixes from a second read of 0.1.0 against the installed CLI 0.15.0, real repositories and real sessions.

- **Stop gate and "linked units"**: a `.testsprite/config.json` that git does not track yet, or ignores, now links the unit. Before, only tracked configs counted, so the gate did nothing in the session where `/testsprite:init` wrote the file.
- **Guard coverage**: the guard now runs through a `hooks/guard.sh` prefilter instead of `if: Bash(testsprite *)` filters, which never matched `npx -y @testsprite/...`, `./node_modules/.bin/testsprite`, `env X=1 testsprite ...` or `time testsprite ...`. Live check: 1 of 4 forms was guarded before, 4 of 4 now. A Bash command that does not mention testsprite costs about 10 ms and starts no Node.
- **Guard rules**: `test cancel` is no longer read-only (the read-only agents could cancel runs); `test flaky` follows `confirm_runs_over`; `ci init --set-secret` asks before overwriting a repository secret; boolean flags such as `--skip-terminal` no longer swallow the next id.
- **`sprite-detect`**: listeners in test files, `examples/` and `testserver`-style directories no longer make a repo an API; cargo feature names and TOML prose fields (`description`, `keywords`) are not dependencies. Two new fixtures. A library that implements an HTTP transport can still read as an API; the evidence is printed and `init` asks.
- **`verify`**: a new frontend test on a local app is created first, then run with `test run --local` (`test create` has no `--local`).
- **Corrected text**: where batch accounting lives (command JSON, not `--summary-file`) and `skippedIntegration`; the 50-run in-flight cap; `testsprite doctor` always warns about the verify skill; `agent install` is not harmless.
- **Stop-gate verdict check** no longer accepts a bare "verified" (typecheck, lint). Still off by default.
- Both agents were dispatched in real sessions for the first time (`failure-triager` on the two eval-07 bundles, `coverage-auditor` against a fixture with a canned-data CLI stub); `failure-triager` rows must be single lines.
- README states macOS and Linux only; design notes 05, 06 and 09 carry an "as built" note; the nightly canary issue text, the budget script on format change, and the eval-08 grader (ignores comments) are fixed.

## 0.1.0

First release.

- Skills: `testsprite` (knowledge and router, 11 references, 4 backend templates), `verify`, and user-only `init`, `audit`, `ci`.
- Agents: `failure-triager`, `coverage-auditor` (read-only).
- Hooks: `SessionStart` (silent unless linked; silences the CLI's `testsprite setup` nag), `PreToolUse` guard (spend, destructive, secret-in-argv, conflicting install), `Stop` gate (off by default).
- Helpers: `sprite-detect`, `sprite-state`, `sprite-ref`.
- Pinned CLI surface 0.15.0, flag-trace, nightly drift canary, behavior evals.

Not in 0.1.0: `sprite-run` (capture and digest; build only if output truncation is measured to lose evidence), a per-project settings file, Windows support, any MCP wrapper. The credit spike that would close the backend unknowns (`--produces` hand-off, `TARGET_URL`, auto-heal persistence, Auto Cleanup coverage, MCP-over-HTTP in the sandbox) has not been run.
