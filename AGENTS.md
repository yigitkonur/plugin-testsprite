# AGENTS.md

Working rules for this repo.

## Release rule

Any shipped change (skills, agents, hooks, `bin/`, `lib/`, references, templates) bumps `version` in **both** `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` in the same commit; installers gate updates on it. Tag with `claude plugin tag --push` once CI is green. Never rename the plugin (`testsprite`): installs are recorded under the name.

## Do not restate the CLI

Plugin text carries stable knowledge only. Exact flags come from the installed CLI (`sprite-ref help <command path>`). Every `testsprite ...` command and flag written in this repo must exist in `ci/pinned/<version>/`; `scripts/flag_trace.py` enforces it. Mark an intentional bad example with `trace:ignore`.

## Refreshing the pinned CLI surface

Install the new CLI to a throwaway prefix, then `python3 -I scripts/capture_cli_help.py --out ci/pinned/<new version>`. Run `scripts/flag_trace.py` and fix anything the new CLI removed, update the verified range (`VERIFIED_CLI` in `lib/state.mjs`, README, `skills/testsprite/references/cli-surface.md`), and bump the version.

## Hooks

A hook must carry a concrete payload or enforce what a skill cannot (`docs/design/06-hooks.md` section 0). The guard never returns `allow`, fails open on anything it cannot parse, and has no network access. Hooks must stay silent in repos that are not linked to a TestSprite project, except the one-line environment export in `hooks/session-start.sh`.

## Developing without spending

Never run a `testsprite` command that needs a key or reaches the cloud while developing. Use a throwaway `HOME`, no `TESTSPRITE_API_KEY`, and `TESTSPRITE_API_URL=http://127.0.0.1:9` so a stray call cannot leave the machine. Tests use stdin fixtures and the CLI's `--help` / `--dry-run` only. Evals call a model (paid) but not TestSprite; cap them with `--max-cost-usd`.

## Before publishing a change

`node --test tests/*.test.mjs`, `python3 -I scripts/flag_trace.py`, `sh scripts/secret_scan.sh`, `claude plugin validate --strict` on the manifest, marketplace, `skills` and `agents`, and `sh scripts/check_budget.sh`. Commit with the repository's noreply identity.
