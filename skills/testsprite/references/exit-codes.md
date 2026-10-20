# Exit codes → action

The CLI's exit codes are a contract. With `--output json` the same information is on stdout (or in the `error` envelope), so branch on it instead of scraping text. Never retry blindly.

| Code | Meaning | Do |
|---|---|---|
| 0 | Success (a run: passed) | Report the verdict. In a batch, still account for every member |
| 1 | Generic failure or a non-passed run (failed, blocked, cancelled) | Triage: [triage](triage.md). Fetch the bundle once |
| 2 | Not yet implemented | Report the limitation; do not look for a workaround flag |
| 3 | Auth or missing scope | `testsprite auth status`; name the missing scope; ask the user to fix the key (never handle the key yourself) |
| 4 | Not found | Check ids and the project; list before guessing |
| 5 | Validation error or payload too large | Fix the input; run `testsprite test lint` on plans; read the message, it names the field |
| 6 | Conflict, precondition failed, ambiguous org | Read the message. Stale `codeVersion` on `test code put`: re-fetch with `test get` and retry once. `tunnel-required`: add `--local` or choose a deployed environment. `plan generate` on a local project: author plans by hand |
| 7 | Timeout or unsupported | Ordinary wait: `testsprite test wait <run-id>`; never trigger a new run. Owned local timeout: start a new run with a longer `--timeout`. "Unsupported": read the message (for example a backend too old for `ci run`) |
| 10 | Service unavailable (also: a second `tunnel start` with the same credential takes over and the first exits 10) | Back off and retry later; do not loop |
| 11 | Rate limited; also standing limits such as `tunnel_binding_limit` | Back off. For tunnel limits list and stop unused bindings; do not retry automatically |
| 12 | Insufficient credits | **Stop.** Show the server's message and link; do not retry or reduce the batch silently |
| 13 | Feature gated (plan entitlement or per-account flag) | **Stop.** Show the message and link. Typical: SSO sign-in mode, schedules |
| 14 | Client too old | Tell the user to upgrade the CLI; stop |
| 129, 130, 143 | Interrupted by a signal | An owned local run requests cancellation; read the reported outcome and `refund.status` |

Notes:

- Exit 1 from `test run --wait` is the ordinary failed-test case, not a tool failure. Read the JSON; do not treat it as a crash.
- Exit 12 and 13 are configuration or account problems, not test failures.
- `ci run` has its own reading: 1 a test failed, 7 timeout or unsupported backend, 5 configuration, 4 missing test id, 3 / 12 / 13 credentials, credits, plan.
