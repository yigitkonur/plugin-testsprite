# plugin-testsprite

an **unofficial** claude code plugin for the [testsprite](https://www.testsprite.com) cli. it doesn't wrap or replace the cli. it's the judgment layer around it: set a repo up, audit a suite, get a real verdict before claude says "done", gate ci, and say it straight when a repo just isn't a fit.

not affiliated with or endorsed by testsprite. "TestSprite" is their name.

## tl;dr install

```
claude plugin install testsprite --marketplace yigitkonur/plugin-testsprite
```

one line: `--marketplace` adds the marketplace first if you don't have it yet, then installs.

prefer two steps, or already inside a claude code session? same thing:

```
claude plugin marketplace add yigitkonur/plugin-testsprite
claude plugin install testsprite@plugin-testsprite
```

```
/plugin marketplace add yigitkonur/plugin-testsprite
/plugin install testsprite@plugin-testsprite
```

`--scope user|project|local` on `claude plugin install` picks where it lands (user is the default).

then bring your own testsprite cli and key:

```
npm install -g @testsprite/testsprite-cli
! testsprite setup --no-agent
```

the `!` runs it in your session with a masked prompt, so the key never touches the chat. the `--no-agent` matters: plain `testsprite setup` installs the vendor's own skills, which duplicate this plugin.

**needs:**
- claude code (tested on 2.1.302);
- macos or linux (the hooks run under `sh` and `git`; windows is untested);
- node 20.19+;
- the testsprite cli (checked against 0.15.x). the plugin never installs it for you.

claude code may say three plugin settings are unset after install. that's fine, the defaults apply. `/plugin configure testsprite@plugin-testsprite` changes them.

## keep it off until you need it, and keep it current

**installed but off, on demand per project.** install once, globally, and leave it off. an off plugin costs no tokens, and you switch it on only in the project where you want it:

```
claude plugin install testsprite --marketplace yigitkonur/plugin-testsprite
claude plugin disable testsprite@plugin-testsprite --scope user
```

then, in a project:

```
claude plugin enable testsprite@plugin-testsprite --scope project     # on, for this project
claude plugin disable testsprite@plugin-testsprite --scope project    # off again
```

the project's `.claude/settings.json` records `true` or `false`, and project beats user. checked in live sessions: with it enabled a fresh session lists `testsprite:testsprite` and `testsprite:verify`; disabled, it lists nothing.

**stay current.** claude code leaves auto-update off for third-party marketplaces, so turn it on once and enabled installs follow new releases: `/plugin` → marketplaces → `plugin-testsprite` → enable auto-update. or put it in `~/.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "plugin-testsprite": {
      "source": { "source": "github", "repo": "yigitkonur/plugin-testsprite" },
      "autoUpdate": true
    }
  }
}
```

updates land in the background after your first message of a session (about 3 min in a test, up to ~10 by design) and load on the next start, or right away with `/reload-plugins`. to pull one by hand: `claude plugin update testsprite@plugin-testsprite`.

**caveat: auto-update skips disabled plugins.** measured: an enabled project install moved to the new version by itself, while installs left off (the global-but-off recipe above) stayed on the old one. for those, [`scripts/update-installs.mjs`](scripts/update-installs.mjs) walks every user, project and local install, refreshes the marketplace and runs `claude plugin update` for each. it never changes on/off state, and it repairs git worktrees (claude resolves those to the main checkout and leaves their own record stale). run it by hand, or schedule it. cron on linux:

```
23 */6 * * * flock -n /tmp/tsp-update.lock node /path/to/scripts/update-installs.mjs >> ~/tsp-update.log 2>&1
```

on macos use a launchd agent with `StartInterval` 21600 that runs `node /path/to/scripts/update-installs.mjs` (give it a `PATH` that contains your `claude` binary, not a shell function).

releases are automatic. once ci is green on `main`, [`release.yml`](.github/workflows/release.yml) bumps the version in both manifests, writes the changelog entry, tags `vX.Y.Z` and `testsprite--vX.Y.Z` and publishes a github release, whenever something under `skills/`, `agents/`, `hooks/`, `bin/` or `lib/` changed. a version that doesn't change never reaches installs, which is why nobody bumps it by hand.

## what it does

testsprite is a hosted testing service with a thin cli. you describe tests, their cloud runs them against an app it can reach, and you read structured verdicts. runs cost credits, the cli ships fast, and its agent guidance is long. this plugin keeps the stable knowledge (mental model, authoring rules, triage, fit, costs) and reads exact flags from the cli you actually have installed, so it doesn't rot when the cli changes.

| you type | what happens |
|---|---|
| `/testsprite:init` | detects the project type and **checks fit first**, then walks auth, project, sources, tests and a smoke run. nothing gets created in the cloud before the project step |
| `/testsprite:audit` | a read-only subagent maps your pages, endpoints and tools to the suite. you approve a costed run plan, and failures get classified (app bug, plan defect, test-code defect, environment, auth, flaky, starvation) |
| `/testsprite:verify` | claude uses this one on its own too, before calling a change done. it runs or creates the covering test and reports a verdict, or says `Unverified because <reason>` |
| `/testsprite:ci` | picks the pr-gate shape, generates and finishes the workflow, proves it on a real pr, optionally schedules a nightly |
| (automatic) | the `testsprite` skill answers "can testsprite even test this?", helps write frontend plans and backend test code, and reads red runs |

## fit: what testsprite can actually test

testsprite's cloud can only test what it can **reach**. the plugin says so out loud instead of pushing your repo through a setup that can't work.

| repo | fit | path |
|---|---|---|
| web frontend (spa, ssr, static, docs) | full | a url, or an app on your machine through **testsprite's own tunnel** (`project create --local <port>`; v3 account, any plan). never a third-party tunnel |
| rest / openapi backend | full, with a public url | spec upload plus generation, or hand-written python tests |
| graphql | partial | hand-written post tests |
| mcp server over streamable http, deployed | partial | hand-written json-rpc tests (template runs green in their sandbox) |
| **mcp server over stdio only** | **none** | native client tests; add and host an http transport to change the answer |
| **cli tool, library** | **none** | native subprocess or golden tests; test any web surface it also has |

a `none` verdict prints the reason and a "do instead" list, and creates nothing in the cloud. mixed repos (say an mcp server plus a landing site) go ahead on the testable part.

## safety model

- **spend guard** (`PreToolUse`, on by default). it asks before:
  - `test run --all`, big id lists, batch `--run`, `ci run`, `plan generate`, flaky checks, schedules and prd uploads;
  - deletions and `--force` overwrites;
  - a secret on the command line (`--password`, `--credential`, `--api-key`, …);
  - `setup` / `agent install` without `--no-agent`;
  - in a linked repo, the first billable run of a session and every fifth after it, so a fix-and-rerun loop can't quietly drain credits.
- **the guard's one `allow`.** it answers `allow` for exactly one thing: a lone read-only `testsprite` or `sprite-*` command. that means no pipes, `;` or `$()`, no `--endpoint-url`, and output only into `.testsprite/`. that's why the read-only subagents don't spam you with prompts. your own deny and ask rules still win. anything it can't vouch for falls through to the normal permission flow. it raises friction on common footguns and isn't a security boundary. it also keeps both subagents read-only.
- **session hook** (`SessionStart`) is silent unless the repo is linked (`.testsprite/config.json`, with an optional `targetUrl` saying where the app runs). in a linked repo it drops a few facts plus one standing rule: before saying a code change is done, get a testsprite verdict or end with `Unverified because <reason>`. docs, config and test-file edits are exempt.
  - measured on an ordinary change request: 0/5 with 0.1.1, 5/5 with this hook, 0/6 false triggers on exempt work.
- **stop gate** (`Stop`, **off by default**). once per change set it asks for a verdict or an explicit "unverified because …". the session rule above already does most of the work, so this is an opt-in backstop: flip `stop_gate` on if you want it.
- **settings** (`userConfig`): `guard` (true), `stop_gate` (false), `confirm_runs_over` (3).
- the plugin sends nothing anywhere and sets no telemetry. the cli has its own telemetry (`TESTSPRITE_NO_TELEMETRY` turns it off).

## what it costs to keep installed

about 230–350 tokens of always-on context, per `claude plugin details testsprite` (about 230 for an installed copy, about 350 loaded with `--plugin-dir`). hooks add no model context except the short note in linked repos. everything else loads only when a skill or agent fires.

## field-tested, not vibes

0.2.0 ran against the real testsprite cloud with a purpose-built app (an event-rsvp page plus a json api) on a trial account, for 25.2 credits:

- local frontend tests through testsprite's tunnel: a green baseline, two planted bugs caught by exactly the two tests that should catch them, then fixes verified;
- the plugin's triager on real failure bundles. it named the right commit and line and rejected testsprite's own wrong root-cause guess;
- backend tests on a public deploy, spec-driven and exploration-based generation, and heal.

where the service didn't behave like its docs, the guidance changed. two big ones:
- **a frontend replay isn't a verdict.** a strict replay passed a deployed bug that a fresh `test run` caught.
- **backend values hand over through `__VARS__`.**

full write-up: [`docs/design/11-field-test.md`](docs/design/11-field-test.md).

still not exercised: frontend generation with a signed-in test account, and windows. [`docs/design/09-evidence-ledger.md`](docs/design/09-evidence-ledger.md) lists every claim with its source.

## development

```
node --test tests/*.test.mjs          # detect, state, ref, hooks (no network, no credentials)
python3 -I scripts/flag_trace.py      # every `testsprite ...` command and flag here exists in the pinned cli
sh scripts/check_budget.sh            # claude plugin details: inventory and always-on tokens <= 400
sh scripts/secret_scan.sh             # no keys, personal paths or addresses in tracked files
claude plugin validate --strict .claude-plugin/plugin.json
claude plugin eval . --help           # behavior evals (see evals/README.md; every run is a paid model call)
```

a nightly workflow installs the newest published cli and opens an issue when a command or flag in the pinned surface disappears, or when plugin text stops tracing to it. release rules are in `AGENTS.md`. the design notes (why each piece exists, hooks considered and rejected, evidence) are in [`docs/design/`](docs/design/README.md).

## license

mit. see `THIRD_PARTY_NOTICES.md`.
