# The agent loop

```
change code
  └─ is the behavior already covered?
       ├─ no  → create the test and run it (create ... --run --wait)
       └─ yes → rerun it (rerun ... --wait)
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
- **One bundle, then decide.** Download the failure bundle once per failing run, into a directory that already exists (`.testsprite/runs/<run-id>`), and read it before changing code.
- **Do not auto-fix on the recommendation alone.** The recommended fix target can be wrong. A plan defect is tightened with `test plan put` and rerun once, then stop. An app bug is reported with evidence.
- **Large output.** Failing runs exit 1 and the harness truncates their output to about 10,000 characters with no file path. For a command that can print a lot (`test run --all --output json`), write stdout and stderr to files under `.testsprite/tmp/` and read the files.
- **Several local tests, one command.** Run several local frontend tests in one `test run` invocation so they share a tunnel (5 live tunnel bindings per user).

## Feedback is not proof

A rerun replays saved code with auto-heal on: more lenient than a fresh run. A healed pass says the feature still works through a drifted UI; it is not a release claim. For a new change prefer a fresh `test run`; for release confidence run fresh against the deployed revision. Backend reruns pull in the whole producer and teardown closure, so expect side effects and extra runs in history.

## Accounting

After a batch (`test run --all`), account for every member: `accepted[]`, `conflicts[]`, `deferred[]`, `skippedFrontend`. Anything not terminal is not green. Exit 0 alone does not prove every test ran.

## Report

Per test one line: id, name, verdict. Add the dashboard link. On red add the triage class and one line of evidence. Or: `Unverified because <reason>`.
