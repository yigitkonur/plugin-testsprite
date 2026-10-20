# Authoring backend tests

A backend test is Python you write. TestSprite executes the file **top to bottom** in a sandbox against a **public HTTP URL**. There is no server-side code generation on the CLI. Start from `testsprite test scaffold --type backend`; templates for REST, GraphQL, MCP over HTTP (experimental) and teardown are in `../templates/`.

**Show the user the drafted code before creating it.** Creating writes to their project.

## Non-negotiable rules

1. **Call your test functions.** The runner does not collect `test_*` functions the way pytest does. A function that is defined but never called passes vacuously. End the file by calling every one. Check before creating: every `def test_...` has a matching bare call (`grep -n '^def test_' f.py` against `grep -n '^test_' f.py`). The CLI has no offline validator for backend code, so this check is yours.
2. **Sandbox imports only:** the standard library, `requests`, `pytest`, `numpy`, `scipy` (plus `requests`' own dependencies). Do not import the project's own modules or other packages (`torch`, `pandas`, `django`); the test fails before it starts. Test the API over HTTP and read values from responses.
3. **Explicit target.** Write `BASE_URL = "https://..."` at the top of the file. A public URL is required; `--local` is refused. Do **not** rely on an injected `TARGET_URL`: the vendor's own examples use it while its scaffold hard-codes `BASE_URL`, and whether it is injected is unverified. `ci run --target-url` does not apply to backend tests either; they use the URL in their code.
4. **Never hardcode a credential** (Bearer, API key, basic blob, cookie). Configure it once on the project and read the injected `__AUTH_HEADERS__`:
   `testsprite project credential <project-id> --type "Bearer token" --credential-file <path>` (types: Bearer token, API key, basic token, public). Spread it into every authenticated request: `headers={**__AUTH_HEADERS__}`. A recurring token uses `testsprite project auto-auth` (Pro). `test create` warns when it detects an inlined credential; treat that as a must-fix. A hardcoded token also expires within hours.
5. **Set timeouts** on every request (`timeout=30`) and assert the status code with a message that shows what came back.
6. **One behavior per test; assertions that mean something.** Assert on the contract (status, shape, the field that matters), not only "200".

## Dependencies between tests (partly unverified)

The CLI lets you declare a graph: `--produces <var>` and `--needs <var>` (repeatable) and `--category teardown`, all backend-only. `test run --all` is wave-ordered (producers, consumers, teardown last) and enumerates `accepted`, `conflicts`, `deferred`, `skippedFrontend`. Do not hand-sequence runs to fake ordering. Declarations can be amended with `test update`; declare the graph at create time when you can.

**Unverified:** how a producer's Python code exports the variable and how a consumer reads it is not documented. Until verified in a spike, do this:

- Prefer **self-contained** scripts: log in inside the file that needs the token.
- Use `--produces` / `--needs` for **ordering** only when the user accepts that the hand-off mechanism is unverified, and check the first run's variable view (`test get`, the run's result) before building more on it.
- Say so in the report.

## Cleanup (unverified)

The portal describes Auto Cleanup (deleting records generated tests created, children first, 404 counted as success). Whether it covers CLI-authored code is **unverified**. Do not rely on it. Write an explicit teardown test (`--category teardown`, runs last) that removes what the suite created, finding it by a unique name prefix rather than by a value passed from another test. See `../templates/teardown.py`.

## Running

- A fresh run executes one test. `test run --all --project <id>` is the dependency-aware batch over all backend tests (frontend tests are skipped with an advisory).
- `test rerun <be-id>` expands the **whole producer and teardown closure** (0.2 credit each) and reports failed members in `closureFailures[]` without flipping the exit code. `--skip-dependencies` runs only the named test, appropriate only while iterating on one script whose producers were verified this round; finish with a closure run before reporting.
- `test code put <id> --code-file <f> --expected-version <codeVersion>`: a stale version is exit 6; re-fetch with `test get <id>` and retry once.

## GraphQL and MCP over HTTP

Both are hand-authored POSTs. GraphQL: assert on `errors` as well as `data`, since many failures arrive as HTTP 200. MCP over streamable HTTP: no MCP SDK exists in the sandbox, so the template frames JSON-RPC by hand (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`) and parses SSE responses itself. The MCP template is **experimental and unverified** in the sandbox; read the target server's protocol version and session behavior first and tell the user it is experimental.

## Reading the result

Root-cause the **earliest failed wave** first; see [triage](triage.md).
