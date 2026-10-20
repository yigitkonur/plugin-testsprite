# Reading a red run

Do not take the verdict at face value. Decide first whether the **plan** or the **product** is wrong. For big evidence use the `failure-triager` agent: the bundle can be tens of kilobytes and the answer is a dozen lines.

## Get the evidence

- The run id comes from the early stderr receipt (`Run <runId>`). Do not use an earlier run.
- `testsprite test artifact get <run-id> --out .testsprite/runs/<run-id>` (the parent directory must exist) downloads one self-consistent bundle: result, failing step with neighbors, DOM as text, test source, root-cause hypothesis, recommended fix target. Items share a snapshot id; the CLI will not mix runs.
- Cheaper first looks: `testsprite test failure summary`, `testsprite test failure get`, `testsprite test steps <test-id> --run-id <run-id> --output json` (the default is the latest run; older backends may return cumulative bare steps, so pin the run id before counting), `testsprite test result <test-id> --history` to choose a run explicitly.

## Classes

| Class | Signals | Action |
|---|---|---|
| **plan-defect** (frontend) | recorded action count is below the plan's; assertions degraded to a bare "element is visible" with no subject; five or more click attempts on similar targets without progress; steps skipped as ambiguous | Tighten the plan (`test plan put`), rerun **once**, then stop |
| **test-code-defect** (backend) | the file never calls its tests; imports not in the sandbox; hardcoded or expired credential; wrong `BASE_URL`; asserts on the wrong field | Fix the code (`test code get`, edit, `test code put` with `--expected-version`), rerun once |
| **app-bug** | `cause` or `error` names a concrete app observation ("renders read-only", "page 404s") and the steps ran as planned | Report the verdict with the agent's observation and evidence. Do **not** auto-fix on the recommendation alone |
| **environment** | trace blames infra: deploy lag, auth gate, missing fixture, target unreachable, wrong environment | Fix the environment (`project env update`, wait for deploy); no test edits |
| **auth** | exit 3, 401 and 403 in the trace, expired credential, sign-in step failing before the feature | Credential or sign-in settings (user supplies values by file); no test edits |
| **flaky** | passes and fails on identical input | `testsprite test flaky <id> --runs 5` (costs runs; the guard asks) before declaring it flaky |
| **starvation** | a backend **producer** failed, so consumers fail or block for a missing token or fixture | Root-cause the **earliest failed wave**; report consumers as failed-downstream; pull the producer's bundle first |
| **inconclusive** | cannot tell | Report `inconclusive` with the signal that triggered the call and ask |

## Skeptical reading

- The agent's failure summary can conflate two phases. When a flow produces an artifact that then runs against an external target, "the backend returned an error" can mean the action endpoint failed (feature broken) **or** the action succeeded and the produced artifact failed later at runtime. Check the step trace and the runtime output; if the runtime output quotes a literal the plan submitted earlier, the action succeeded.
- A `passed` can be wrong: bare visibility assertions, steps skipped, a healed pass. If the sanity checks above trip, report `inconclusive` with the signal.
- A rerun after heal is feedback, not proof (see [agent-loop](agent-loop.md)).

## Never

Widen a pass by editing assertions after a failure. Drop a failed member from a set. Retry a run blindly. Auto-fix the app on the hypothesis alone. Count a batch green from exit code 0 without accounting for every member.
