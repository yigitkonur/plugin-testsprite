# The agent loop

```
change code
  └─ is the behavior already covered?
       ├─ no  → create the test and run it (create ... --run --wait)
       └─ yes → run it fresh (test run <id> --wait)
            cloud runs against the real app          ← you are idle here
            ├─ pass → the suite grows; report the verdict
            └─ fail → fetch ONE failure bundle (test artifact get <run-id>)
                      triage plan vs product vs environment → fix → rerun
```

Exact flags: [cli-surface](cli-surface.md). Cost: [costs-and-limits](costs-and-limits.md). Reading a red run: [triage](triage.md).

## Rules that make the loop work

- **Reachability first.** A deployed change must be live before the run, or you verify the previous build. A change that only runs locally can be tested with `--local <port>` for frontend tests (V3). A backend change on a machine with no public URL cannot be tested: deploy a preview, or report **unverified**.
- **Wait once.** `--wait` long-polls with its own backoff. Do not wrap it in a retry loop or poll yourself. On exit 7 with an ordinary wait, resume with `testsprite test wait <run-id>`; never trigger a new run to "see if it finishes".
- **Keep the receipts.** The run id and dashboard link appear early on stderr (`Run <runId>`, `Dashboard: <url>`). Keep them even if the wait later stops.
- **Pin evidence to the run you care about.** `test steps` shows the latest run by default; pass the run id you are verifying. Do not use an earlier run as evidence.
- **One bundle, then decide.** Download the failure bundle once per failing run (`test artifact get <run-id>` writes `.testsprite/runs/<run-id>` and creates the directory; an explicit `--out` needs an existing parent) and read it before changing code.
- **Do not act on the recommendation alone.** The recommended fix target can be wrong; confirm the cause in source. A plan defect is tightened with `test plan put` and rerun once, then stop. An app bug in the code you just changed is your regression: fix it and rerun once. An app bug outside your change is reported with evidence.
- **Large output.** Failing runs exit 1 and the harness truncates their output to about 10,000 characters with no file path. For a command that can print a lot (`test run --all --output json`), run `mkdir -p .testsprite/tmp` and redirect stdout and stderr to files there, then read the files.
- **Several local tests, one command.** Run several local frontend tests in one `test run` invocation so they share a tunnel (5 live tunnel bindings per user). Against a **public** target several ids in one `test run` are refused (exit 5, free): use `test run --all --project <id> [--filter <text>]` or one id per command.

## Feedback is not proof

Two different things run a frontend test:

- **Agent run** (`test run`, every local tunnel run): an AI drives the browser through the plan and judges its assertions. This is the verdict on a change.
- **Replay** (`test rerun`, `--no-auto-heal`): the stored Playwright script runs. Its assertions can be as thin as `assert current_url` ("final outcome verified by the AI judge during the run"), so a replay pass says the flow still clicks through, not that the plan's checks hold. Field test: with a stale-count bug deployed, `test rerun --no-auto-heal` **passed** and a fresh `test run` **failed** on the same test. Read `test code get <id>` before relying on replays.

Auto-heal (on by default for frontend reruns) re-authors a drifted script and **replaces the stored version** (`codeVersion` v1.0 → v2.0 in the field test). A local tunnel run never stores or replays code (`test code get` is exit 4 for a test that only ever ran locally), and `--no-auto-heal` there is refused as `blocked`. Backend reruns are different: the stored Python *is* the test, and the rerun pulls in the producer and teardown closure, so expect side effects and extra runs in history. Backend reruns pull in the whole producer and teardown closure, so expect side effects and extra runs in history.

## Accounting

After a batch (`test run --all`), account for every member in the command's JSON output: `accepted[]`, `conflicts[]`, `deferred[]`, `skippedFrontend` and `skippedIntegration` (a rerun also has `notFound[]` and `closure`). `--summary-file` holds only totals and per-run rows. Anything not terminal is not green. Exit 0 alone does not prove every test ran: skipped members do not change it.

## Report

Per test one line: id, name, verdict. Add the dashboard link. On red add the triage class and one line of evidence. Or: `Unverified because <reason>`.
