# Local apps and TestSprite's tunnel

TestSprite ships its own tunnel. A frontend test can reach an app running on the user's machine (`localhost`) through it, on any plan including Free (ordinary run credits apply). **Never set up a third-party tunnel (cloudflared, ngrok) for a frontend test.** The only case that needs a public URL is a backend test or plan generation; see the bottom of this page.

## Preconditions

- The key carries the `run:tunnel` scope (`testsprite auth status --output json` lists scopes); the CLI names the scope when it is missing (exit 3).
- The account is V3-routed (`v3Enabled: true` in the same output). A V2-only account gets exit 7 `local-origin-requires-v3`.
- The app is listening before the command runs. The CLI probes the port and refuses a dead one **before** minting a tunnel or charging (exit 5); do not pass `--skip-preflight` to get around that.
- The environment's sign-in is `public` or `account`. An OTP environment is refused through a tunnel before charge (exit 6, `tunnel-otp-auth-unsupported`).

## Make the project local once, then just run

`testsprite project create --type frontend --name <repo> --local <port>` saves `http://localhost:<port>` as the default environment (`project get` shows `(Local)`). From then on every frontend command that runs a test opens a tunnel **by itself**: `test run`, `test rerun`, `test create --run`, `test create-batch --run`, `testlist run`. No extra flag is needed:

```
Environment "default" is on this machine (http://localhost:4173) — opening a tunnel.
[tunnel] Minted tunnel client <client-id>; connecting…
Running 3 tests through one tunnel, up to 5 at a time.
[1/3] <test-id> → run <run-id>
Dashboard: https://www.testsprite.com/dashboard-v3/o/<org>/projects/<project>/test-cases/<test-id>
```

For a project with a public URL, `test run <id> --local <port>` (or `--target-url http://localhost:<port>`) points one run at the local app instead; `--local` implies `--wait`. On plans that allow more environments a project can keep both, a public default plus a loopback one (`project env create … --local <port>`), selected with `--env <name>`; the Starter plan refuses the second environment (FEATURE_GATED, "the Starter plan allows 1"), so there use `--local <port>` per run.

Prefer a built server over a dev server (a dev server can take about a minute per page through the tunnel). Exact flags: `sprite-ref help test run`, `sprite-ref help tunnel start`.

## Several tests, one tunnel

Put several ids (or `--all --project <id>`) in one command: one tunnel binding, up to 5 runs at a time (`--max-concurrency` 1–10). The runs share the app, so give each concurrent test its own data (a different record, a different event, a unique email), or one test's writes break another's assertions.

## The agent-loop pattern: one long-lived tunnel, borrowed

An owned tunnel lives only while its command runs. In an edit, run, fix loop, start one tunnel and borrow it:

1. `testsprite tunnel start --ttl 3600` with `run_in_background` (it is a foreground process; there is no daemon). Its first stderr line is `Minted tunnel client <client-id> (expires …); connecting…`; stdout then prints `clientId`, `status online` and `transport tls`.
2. Each run: `testsprite test run <id> <id> --tunnel-client <client-id> --wait --output json`. The JSON then reports `"tunnel": {"clientId": …, "adopted": true}`.
3. When done: stop the background task, or `testsprite tunnel stop <client-id>`.

In CLI 0.15.0 only `test run` accepts `--tunnel-client`. `test rerun`, `test create --run` and `testlist run` open their own owned tunnel for a loopback environment, which is a second live binding while the borrowed one stays up (5 allowed).

Owned versus borrowed matters on interruption:

- **Owned** (the run command opened the tunnel): Ctrl-C, a timeout or tunnel loss cancels unfinished runs, and a run cancelled before it finished is **refunded**. After an owned timeout, `test wait` cannot reattach: start a new run with a longer `--timeout`.
- **Borrowed** (`--tunnel-client`): Ctrl-C only detaches. The run keeps going, and `test wait <run-id>` can resume while the owner is alive. If the owner disappears, the borrower cancels its own run.

## What a local run is and is not

- A V3 `--local` run always takes the agent path. It never replays saved code, so there is no auto-heal question and it never overwrites the test's saved code (`codeVersion` stays `null` on a local-only test). Do **not** pass `--no-auto-heal` to a local run or rerun: the run comes back `blocked` with `[Tunnel] Deterministic replay cannot run through a tunnel. Drop --no-auto-heal so the agent can run through your tunnel.` (observed 0.15.0; not charged).
- `test plan generate` on a local project is refused **before any charge** (exit 6, `PRECONDITION_FAILED`, "Write the plan yourself"). Author plans by hand ([authoring-frontend](authoring-frontend.md)).
- Portal runs and cloud schedules cannot reach a loopback environment: they are BLOCKED at no charge (`tunnel-required`) until the project also has a public URL (`project update <id> --url https://…`).

## Limits and failures

| Situation | What happens | Do |
|---|---|---|
| 5 live tunnel bindings per user | `tunnel_binding_limit`, exit 11, not retried | `testsprite tunnel list`, then `testsprite tunnel stop <client-id>` for an unused one, or reuse one with `--tunnel-client` |
| A second `tunnel start` with the same credential | The first exits 10 | Keep one owner |
| The tunnel cannot connect for 60 s | Exit 10; an owned run is cancelled and refunded | Check the network; on a TLS-intercepting network set `NODE_EXTRA_CA_CERTS` to the organisation's root CA |
| `tunnel stop <client-id>` while the owner runs in the background | The owner exits 10 ("revoked, expired, or taken over by another process") | Normal for a revoked owner, not an outage |
| Revoke everything | `testsprite tunnel stop --all --confirm` revokes **every** live tunnel on the account, including other people's processes | Ask the user first (the guard asks too) |

## Backend tests and generation need a public URL

"Tunnels serve frontend tests." A loopback target on a backend test fails validation (exit 5), and `test run --all --local` skips backend tests. A backend test calls the URL written in its own code, so it needs a deployed preview, staging or production URL. The same holds for plan generation (exploration needs a public frontend URL; spec-driven backend generation needs a project with an uploaded spec). See [project-fit](project-fit.md) for the order of preference.
