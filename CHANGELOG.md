# Changelog

## 0.1.0

First release.

- Skills: `testsprite` (knowledge and router, 11 references, 4 backend templates), `verify`, and user-only `init`, `audit`, `ci`.
- Agents: `failure-triager`, `coverage-auditor` (read-only).
- Hooks: `SessionStart` (silent unless linked; silences the CLI's `testsprite setup` nag), `PreToolUse` guard (spend, destructive, secret-in-argv, conflicting install), `Stop` gate (off by default).
- Helpers: `sprite-detect`, `sprite-state`, `sprite-ref`.
- Pinned CLI surface 0.15.0, flag-trace, nightly drift canary, behavior evals.

Not in 0.1.0: `sprite-run` (capture and digest; build only if output truncation is measured to lose evidence), a per-project settings file, Windows support, any MCP wrapper. The credit spike that would close the backend unknowns (`--produces` hand-off, `TARGET_URL`, auto-heal persistence, Auto Cleanup coverage, MCP-over-HTTP in the sandbox) has not been run.
