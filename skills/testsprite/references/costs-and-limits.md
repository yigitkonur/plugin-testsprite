# Costs and limits

Credits pay for cloud execution. LLM tokens are spent only by you reading and writing plans, results and bundles. Check the balance with `testsprite usage` before any fan-out.

## Spend classes

| Class | Examples | Price | What to do |
|---|---|---|---|
| Free reads and local helpers | `project list`, `test list`, `test get`, `test result`, `test steps`, `test failure ...`, `test artifact get`, `usage`, `doctor`, `auth status`, `test scaffold`, `test lint`, anything with `--dry-run` | 0 | Run freely |
| Free cloud writes | `project create`, `project update`, `test create` without `--run`, `test plan accept`, `project credential`, env and sign-in settings, API-spec upload | 0 | Show the drafted plan or code first when it creates tests |
| Single billable run | `test run <id>`, `test rerun <id>`, `test create ... --run` | FE 0.5 (local tunnel runs too); BE 0.2, fresh or rerun (observed) | Say what you are running; the guard asks at the first one in a session and every fifth |
| Not charged (observed) | a run refused before it starts: `blocked` replay through a tunnel, a dead local port, generation refused on a local project or on an empty strategy, several ids against a public target (exit 5) | 0 | Read the message; nothing to refund |
| Fan-out | `test run --all`, `test rerun --all`, many ids in one command, `test create-batch --run`, `testlist run`, `ci run`, `test flaky` with many runs | each member bills | Tell the user the count and the estimate; the guard asks |
| Billed per stage | `test plan generate` | not published; observed: backend from a spec 3 credits (strategy + proposals, 42 proposals, 17 s); frontend 5 credits (exploration 41 s + strategy + proposals, 3 proposals). A stage already done is not charged twice | Background; ask first; a frontend project with no stored test account explores public pages only and still bills |
| Auto-assembled integration tests | the first `test run --all` on a backend project with a produces/needs chain may generate one; every later batch runs it after the waves | 0.2 each per batch | Read its code once; delete it if it is hollow ([authoring-backend](authoring-backend.md)) |
| One-off | PRD upload (`project docs upload --role prd`) | 0.5 per document; `api-doc` is free | Ask |
| Recurring | `schedule create`, `schedule update --cron` | each firing bills like a run; plan-gated | Ask; the CLI prints frequency and estimate first |

Cancelling a V3 frontend run before it finishes attempts to return the charge (read `refund.status`); backend and V2 keep billing. Never rely on a cancel to save money.

## Limits worth knowing

| Limit | Value | Note |
|---|---|---|
| Run triggers | 60 per minute per key (server); the CLI self-throttles to 50 | Excess returns exit 11; the test row stays created and the run never started. Re-list and check `draft` rows |
| Runs in flight | 50 per account by default, counting runs from every source (CLI, portal, schedules, CI) | A single `test run` over the cap exits 11 (`details.reason` `inflight_cap`) and is not retried; a batch accepts nothing and returns every id in `deferred[]`, exit 7. Wait for running runs (`test wait`), or send a smaller batch |
| Local tunnel bindings | 5 live per user | `tunnel_binding_limit` is exit 11 and is not auto-retried. `testsprite tunnel list`, then `testsprite tunnel stop <id>` |
| Local run concurrency | default 5, cap 10 | One tunnel serves the whole command |
| Timeouts | ordinary waits default to 600 s; local runs to 1200 s; `plan generate` waits longer | Pass `--timeout` deliberately; in `claude -p` a background command is stopped by the harness after about 10 minutes |
| Batch size | 50 plans or 5 MB per `create-batch` (FE only) | |
| Plan size | 200 steps, 256 KB | |

## Before a large spend

1. `testsprite usage` for the balance and per-run price.
2. Count the tests (`test list --output json`).
3. State "N runs, about X credits" and wait for the user's yes.
4. Run in the background with a summary file so the result survives truncation.
