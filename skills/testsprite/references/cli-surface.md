# Reading the CLI surface (live, not remembered)

This plugin deliberately carries no flag tables. The CLI shipped many releases in a few months and old copies of its syntax go stale; the installed CLI is always right. This file says how to ask it.

## Ask the installed CLI

| Need | Command |
|---|---|
| Version and whether it is inside the range this plugin was checked against | `sprite-ref version` |
| Exact flags for a command | `sprite-ref help <command path>` (same as `testsprite <command path> --help`) |
| The vendor's own version-matched guidance | `sprite-ref skill verify`, `sprite-ref skill onboard`, `sprite-ref skill ci` |
| The plan JSON schema | `sprite-ref schema plan` |
| What a command's output looks like before any credentials | add `--dry-run`: it makes no network call and prints a canned sample whose shape matches the wire contract (the data is fake) |

If `sprite-ref` reports the CLI missing, print its install hint and stop; do not install it unasked.

## Conventions that hold across versions

- Prefer `--output json` when a script or you will read the result; stdout is the result channel, stderr carries receipts and advisories.
- Exit codes are a contract ([exit-codes](exit-codes.md)).
- Global flags are listed at the top of `testsprite --help` (profile, output format, endpoint override, request timeout, dry-run).
- Environment: `TESTSPRITE_API_KEY` and `TESTSPRITE_API_URL` override the credentials file; `TESTSPRITE_PROFILE` picks a profile; `TESTSPRITE_PROJECT_ID` is the default project; `TESTSPRITE_NO_TELEMETRY` or `DO_NOT_TRACK` opt out of usage telemetry. Do not set `TESTSPRITE_CLIENT` on the user's behalf (it reports a wrapper's identity).
- Pure-local commands (no network, no key): `test scaffold`, `test lint`, `test create --plan-template`. `agent install` also needs no key but writes the vendor skills this plugin replaces: do not run it.
- Check `env | grep TESTSPRITE_` when behavior looks wrong: an exported variable silently beats `--profile`.
- `testsprite doctor` always warns that the verify skill is not installed and suggests `testsprite setup`. Ignore that line; the plugin's `TESTSPRITE_NO_SKILL_WARNING` covers the stderr nudge, not doctor.

## When a flag you remember is not in the help

The help wins. Do not guess a replacement flag. Read the help of the command, or `sprite-ref skill verify` for the vendor's current wording, and tell the user if the plugin's guidance is out of date (the plugin's CI diffs the live CLI surface against the pinned one nightly).

## Verified range

The plugin's text was checked against CLI 0.15.x. A newer minor works the same way until the help says otherwise; `sprite-ref version` prints a one-line notice, never an error.
