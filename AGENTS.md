# AGENTS.md

Working rules for this repo.

## Release rule

Releases are automatic. Installers (and auto-update) gate on the computed version, so a shipped change that keeps the same `version` never reaches anyone. After `ci` passes on `main`, `.github/workflows/release.yml` runs `scripts/release.mjs`: if anything under `skills/`, `agents/`, `hooks/`, `bin/` or `lib/` changed since the last `testsprite--v*` tag, it bumps `version` (plugin.json, the marketplace entry and `metadata.version` together), adds a CHANGELOG entry, commits `chore(release): … [skip ci]`, tags with `claude plugin tag --push` and publishes a GitHub release.

- The bump comes from conventional commits since the last tag: `feat` is a minor, `!:` or `BREAKING CHANGE` is a major (a minor while the version is 0.x), anything else is a patch. A hand-written `## X.Y.Z` entry in CHANGELOG.md wins over the generated one.
- Do not bump versions by hand. To force or steer a release, run the `release` workflow from the Actions tab (`bump`, `force`).
- Never rename the plugin (`testsprite`): installs are recorded under the name.

## Do not restate the CLI

Plugin text carries stable knowledge only. Exact flags come from the installed CLI (`sprite-ref help <command path>`). Every `testsprite ...` command and flag written in this repo must exist in `ci/pinned/<version>/`; `scripts/flag_trace.py` enforces it. Mark an intentional bad example with `trace:ignore`.

## Refreshing the pinned CLI surface

Install the new CLI to a throwaway prefix, then `python3 -I scripts/capture_cli_help.py --out ci/pinned/<new version>`. Run `scripts/flag_trace.py` and fix anything the new CLI removed, update the verified range (`VERIFIED_CLI` in `lib/state.mjs`, README, `skills/testsprite/references/cli-surface.md`), and bump the version.

## Hooks

Gate a hook on a command with an `sh` prefilter that greps the payload (`hooks/guard.sh`), not with `if: Bash(...)`: `if` matches a literal command prefix and misses `npx -y ...`, `./node_modules/.bin/...`, `env X=1 ...` and `time ...`. A hook must carry a concrete payload or enforce what a skill cannot (`docs/design/06-hooks.md` section 0). The guard returns `allow` for one thing only, a lone read it can vouch for end to end (`isStrictRead` in `lib/guard-rules.mjs`: one command, no shell syntax, a read-only path, no `--endpoint-url`, `--out` only under `.testsprite/`); everything else is `ask`, `deny` or silence. It fails open on anything it cannot parse and has no network access. Keep the allowlist narrow: an `allow` skips the user's prompt. Hooks must stay silent in repos that are not linked to a TestSprite project, except the one-line environment export in `hooks/session-start.sh`.

## Developing without spending

Never run a `testsprite` command that needs a key or reaches the cloud while developing. Use a throwaway `HOME`, no `TESTSPRITE_API_KEY`, and `TESTSPRITE_API_URL=http://127.0.0.1:9` so a stray call cannot leave the machine. Tests use stdin fixtures and the CLI's `--help` / `--dry-run` only. Evals call a model (paid) but not TestSprite; cap them with `--max-cost-usd`.

## Before publishing a change

`node --test tests/*.test.mjs`, `python3 -I scripts/flag_trace.py`, `sh scripts/secret_scan.sh`, `claude plugin validate --strict` on the manifest, marketplace, `skills` and `agents`, and `sh scripts/check_budget.sh`. Commit with the repository's noreply identity.
