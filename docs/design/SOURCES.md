# Sources

What the design notes were written from. Snapshot date 2026-10-20. Third-party trees are not redistributed here; fetch them at the pins to re-check a citation.

| Source | Pin |
|---|---|
| TestSprite CLI repository `TestSprite/testsprite-cli` (incl. `skills/`, `DOCUMENTATION.md`, `CHANGELOG.md`) | commit `d61e6dfc400f5e88ee34ac799c5496ac5c5a7751` (2026-10-19) |
| npm package `@testsprite/testsprite-cli@0.15.0` (packaged `--help`, `--dry-run`, `skills/`, `schemas/`) | tarball sha256 `0b24cbfea1d790d5f6012d48183e95b1969006e3d226cacecf9e9153beb88067` |
| docs.testsprite.com: 22 CLI pages, 44 web-portal pages, 7 learn pages, `llms.txt` | fetched 2026-10-20 |
| `yigitkonur/skills-by-yigitkonur`: `skills/run-testsprite-backend`, `skills/run-testsprite-frontend` | commit `62ceafffc21221547a8f9dd61a29ded88a9360b5` |
| `yigitkonur/plugin-swiftui` (design reference) | commit `fa190e4640967510926571e12b89f555d4f4ebca` |
| code.claude.com/docs/en: plugins (overview, manifest, components, CLI reference, create, measure, loading, security, publish), hooks, skills, slash commands, sub-agents, mcp, plugin evals, tools reference | fetched 2026-10-20, Claude Code 2.1.302 |

Known gaps: hidden or deprecated CLI commands (`init`, `ci doctor`, `ci connect`, `auth logout`, `auth whoami`) are not listed in help and were not walked. <!-- trace:ignore -->

The command and flag surface the plugin is checked against is pinned in `ci/pinned/<version>/`, regenerated with `scripts/capture_cli_help.py`.
