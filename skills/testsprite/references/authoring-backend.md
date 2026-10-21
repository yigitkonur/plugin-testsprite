# Authoring backend tests

A backend test is Python you write. TestSprite executes the file **top to bottom** in a sandbox against a **public HTTP URL**. There is no server-side code generation on the CLI. Start from `testsprite test scaffold --type backend`; templates for REST, GraphQL, MCP over HTTP (experimental) and teardown are in `../templates/`.

**Show the user the drafted code before creating it.** Creating writes to their project.

## Non-negotiable rules

1. **Call your test functions.** The runner does not collect `test_*` functions the way pytest does. A function that is defined but never called passes vacuously. End the file by calling every one. Check before creating: every `def test_...` has a matching bare call (`grep -n '^def test_' f.py` against `grep -n '^test_' f.py`). The CLI has no offline validator for backend code, so this check is yours.
2. **Sandbox imports only:** the standard library, `requests`, `pytest`, `numpy`, `scipy` (plus `requests`' own dependencies). Do not import the project's own modules or other packages (`torch`, `pandas`, `django`); the test fails before it starts. Test the API over HTTP and read values from responses.
3. **Explicit target.** Write `BASE_URL = "https://..."` at the top of the file. A public URL is required; `--local` is refused (TestSprite's tunnel serves frontend tests only). `TARGET_URL` is **not** injected (field-checked: neither an environment variable nor a global), although the vendor's own examples use it. `ci run --target-url` does not apply to backend tests either; they use the URL in their code.
4. **Never hardcode or print a credential** (Bearer, API key, basic blob, cookie). Configure it once on the project and read the injected `__AUTH_HEADERS__` (a dict, `{'Authorization': …}` for a Bearer credential). The runner also injects `__AUTH_CREDENTIAL__`, the **raw secret**: never print it, never print `globals()`, because everything a test prints is stored with the run (`apiOutput`). The credential applies to every request you spread it into, so never send it to a third-party host:
   `testsprite project credential <project-id> --type "Bearer token" --credential-file <path>` (types: Bearer token, API key, basic token, public). Spread it into every authenticated request: `headers={**__AUTH_HEADERS__}`. A recurring token uses `testsprite project auto-auth` (Pro). `test create` warns when it detects an inlined credential; treat that as a must-fix. A hardcoded token also expires within hours.
5. **Set timeouts** on every request (`timeout=30`) and assert the status code with a message that shows what came back.
6. **One behavior per test; assertions that mean something.** Assert on the contract (status, shape, the field that matters), not only "200".

## Dependencies between tests (field-checked, CLI 0.15.0)

Declare the graph with `--produces <var>` and `--needs <var>` (repeatable) and `--category teardown`, all backend-only. `test run --all` is wave-ordered: independent tests and producers first, consumers next, teardown last (`startedAt` is the dispatch time; the finish times show the waves). `test rerun <consumer>` pulls in its producers ("Reran 2 tests: 1 selected + 1 producer"). Do not hand-sequence runs to fake ordering. Declarations can be amended with `test update`.

**How the value travels:** the producer exports nothing. The runner records the producer's HTTP responses and publishes their fields in a dict `__VARS__`, under several spellings (`rsvp_id`, `rsvpId`, `RsvpId`, `rsvp-id`, `eventId`, `event_id`, a path-derived `api_events_…_id`, …). A consumer reads `__VARS__["rsvp_id"]`. Not a global, not an environment variable.

**Auto-assembled integration tests.** The first `test run --all` on a backend project with a produces/needs chain can generate an integration test (`isIntegration: true`, `createdFrom: portal`, "Integration Test (auto-assembled)") that inlines the member tests' code, and every later batch runs it after the waves at 0.2 credit (`Integration phase: 1 existing integration test run after this wave`). It is a **snapshot** of the member code at assembly time, and it can pass **vacuously**: a `return` in an inlined producer function ended it after step 1 with a `passed` verdict. After the first batch, read it once (`test code get <id>`); delete it if it is hollow. Producers written as straight-line code (no `return` inside the test body) inline safely.

## Cleanup

The portal describes Auto Cleanup (deleting records generated tests created). It does **not** clean up after CLI-authored tests: in the field test every record the suite created was still there after the run. Write an explicit teardown test (`--category teardown`, it runs last) that removes what the suite created, finding it by a unique name prefix rather than by a value passed from another test. See `../templates/teardown.py`.

## Running

- A fresh run executes one test. `test run --all --project <id>` is the dependency-aware batch over all backend tests (frontend tests are skipped with an advisory).
- `test rerun <be-id>` expands the **whole producer and teardown closure** (0.2 credit each) and reports failed members in `closureFailures[]` without flipping the exit code. `--skip-dependencies` runs only the named test, appropriate only while iterating on one script whose producers were verified this round; finish with a closure run before reporting.
- `test code put <id> --code-file <f> --expected-version <codeVersion>`: the version is in `test code get <id> --output json` (`codeVersion`, not in `test get`). A stale one is exit 6 and the message names the server's version; retry once with it.
- Reading a result: `test result <id> --output json` carries the test's printed output in `apiOutput` and the Python traceback in `trace`. A fresh backend run costs 0.2 credit.

## Generated backend tests

Upload the spec (`project docs upload <file> --project <id> --role api-doc`, free) and **wait until it is processed** (there is no CLI status command; give it a minute or two) before the first `test plan generate`. Generating while the upload is still processing built a strategy with no endpoints (exit 6, "its only category carries no endpoint"), and only the portal can rebuild it; a fresh project with a processed spec generated 42 proposals in two stages for 3 credits. Read every proposal against the code before `test plan accept --only`: one proposal asserted an auth requirement on a public endpoint that has none. The code of accepted tests is generated when they first run.

## GraphQL and MCP over HTTP

Both are hand-authored POSTs. GraphQL: assert on `errors` as well as `data`, since many failures arrive as HTTP 200. MCP over streamable HTTP: no MCP SDK exists in the sandbox, so the template frames JSON-RPC by hand (`initialize`, `notifications/initialized`, `tools/list`, `tools/call`) and parses SSE responses itself. The template **ran green in TestSprite's sandbox** against a public streamable-HTTP MCP server (DeepWiki: `initialize`, then `tools/list` over SSE). Still read the target server's protocol version and session behavior first: servers differ on session ids and SSE framing. The project credential is spread into every request, so use it only against your own server.

## Reading the result

Root-cause the **earliest failed wave** first; see [triage](triage.md).
