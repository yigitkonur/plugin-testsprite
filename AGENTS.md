# AGENTS.md

Working rules for this repo.

<!-- kit:agents:start -->
## Releases, versions and installs (shared by every plugin repo)

- **Never bump a version by hand.** `.github/workflows/release.yml` runs after `ci` is green on `main`. `scripts/kit/release.py` reads the conventional-commit subjects since the last release tag (`feat` is a minor, `fix`/`perf`/unprefixed a patch, `type!:` or a BREAKING CHANGE line a major, a minor while the version is 0.x; docs, ci, chore, test, style, build and refactor release nothing) and counts only commits that touch shipped files. It writes every manifest, the marketplace entries and CHANGELOG.md, commits `chore(release): vX [skip ci]`, tags `vX` and `<plugin>--vX` (several plugins: `<plugin>--vX` only) and publishes the GitHub release. `python3 scripts/kit/release.py` with no flags prints what it would do; Actions > release > Run workflow forces a level or a dry run.
- **One version source: the manifests** (`.claude-plugin/plugin.json`, `.codex-plugin/plugin.json`, the marketplace entry). Never a constant in code; read the manifest at runtime.
- Installed copies update only when the version string changes, so a change users should get must reach `main` as a releasing commit type (`feat`, `fix`, `perf`, or `!`).
- **Install policy:** installed globally and off (`"defaultEnabled": false`), switched on per project with `plugin on <name>`. Never document a project-scope install as the way in.
- `scripts/kit/*`, `scripts/kit.sha256`, `.github/workflows/release.yml`, the `kit:manifests` job in `ci.yml` and the blocks between `kit:` markers in README.md and AGENTS.md are copies from [yigitkonur/plugin-kit](https://github.com/yigitkonur/plugin-kit). Change them there and run its `sync.sh`; `scripts/kit/check-manifests.py` fails CI on a local edit.
- Before pushing: `python3 scripts/kit/check-manifests.py --validate`, `python3 scripts/kit/secret-scan.py --tree`, `python3 scripts/kit/check-links.py`, then this repo's own checks.
<!-- kit:agents:end -->

- Never rename the plugin (`testsprite`): installs are recorded under the name.
- The release file list is `.github/release.json`; `scripts/release-gate.sh` runs the context-budget check on the bumped tree.

## Claude Code and Codex

One repo, two hosts. `.claude-plugin/plugin.json`, `.codex-plugin/plugin.json` and the marketplace entry carry the same version (`scripts/kit/release.py` writes all three; ci checks they match; never hardcode the version in code). `.agents/plugins/marketplace.json` uses a `local` source with path `./` (the plugin folder is the repo root), verified with a throwaway `CODEX_HOME`. Codex hooks are `hooks/codex-hooks.json`, run with `--host=codex`: Codex has no `ask` (it logs "unsupported permissionDecision:ask" and runs the command), so the guard turns an ask into a deny that tells the model to get a yes and rerun with `TESTSPRITE_CONFIRMED=1`, and it never returns `allow` there. Settings are `CLAUDE_PLUGIN_OPTION_<KEY>` or `TESTSPRITE_<KEY>`. Skill text mentions neither host's root variable; `skills/testsprite/SKILL.md` has the one "In Codex" section.

## Do not restate the CLI

Plugin text carries stable knowledge only. Exact flags come from the installed CLI (`sprite-ref help <command path>`). Every `testsprite ...` command and flag written in this repo must exist in `ci/pinned/<version>/`; `scripts/flag_trace.py` enforces it. Mark an intentional bad example with `trace:ignore`.

## Refreshing the pinned CLI surface

Install the new CLI to a throwaway prefix, then `python3 -I scripts/capture_cli_help.py --out ci/pinned/<new version>`. Run `scripts/flag_trace.py` and fix anything the new CLI removed, update the verified range (`VERIFIED_CLI` in `lib/state.mjs`, README, `skills/testsprite/references/cli-surface.md`), and bump the version.

## Hooks

Gate a hook on a command with an `sh` prefilter that greps the payload (`hooks/guard.sh`), not with `if: Bash(...)`: `if` matches a literal command prefix and misses `npx -y ...`, `./node_modules/.bin/...`, `env X=1 ...` and `time ...`. A hook must carry a concrete payload or enforce what a skill cannot (`docs/design/06-hooks.md` section 0). The guard returns `allow` for one thing only, a lone read it can vouch for end to end (`isStrictRead` in `lib/guard-rules.mjs`: one command, no shell syntax, a read-only path, no `--endpoint-url`, `--out` only under `.testsprite/`); everything else is `ask`, `deny` or silence. It fails open on anything it cannot parse and has no network access. Keep the allowlist narrow: an `allow` skips the user's prompt. Hooks must stay silent in repos that are not linked to a TestSprite project, except the one-line environment export in `hooks/session-start.sh`.

## Developing without spending

Never run a `testsprite` command that needs a key or reaches the cloud while developing. Use a throwaway `HOME`, no `TESTSPRITE_API_KEY`, and `TESTSPRITE_API_URL=http://127.0.0.1:9` so a stray call cannot leave the machine. Tests use stdin fixtures and the CLI's `--help` / `--dry-run` only. Evals call a model (paid) but not TestSprite; cap them with `--max-cost-usd`.

## Before publishing a change

`node --test tests/*.test.mjs`, `python3 -I scripts/flag_trace.py`, `sh scripts/secret_scan.sh`, `claude plugin validate --strict` on the manifest, marketplace, `skills` and `agents`, and `sh scripts/check_budget.sh`; then the kit checks `python3 scripts/kit/check-manifests.py --validate`, `python3 scripts/kit/secret-scan.py --tree --history` and `python3 scripts/kit/check-links.py`. Commit with the repository's noreply identity.
