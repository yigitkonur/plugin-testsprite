# Changelog

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
