# Project fit: what TestSprite can and cannot test

**The rule:** TestSprite's cloud can only test something it can **reach over the network and drive as a user or an HTTP client**. A frontend needs a reachable URL, or an app on this machine reached through **TestSprite's own tunnel** (`project create --local <port>`; V3 account, any plan; see [local-and-tunnels](local-and-tunnels.md)). Never set up a third-party tunnel for a frontend. A backend needs a **public HTTP URL written into the test**; `--local` is refused for backend. Run `sprite-detect` first: it reports kinds, transport and a verdict with the evidence, and reports ambiguity instead of guessing.

Generated proposals are REST-first (GraphQL best-effort; gRPC and JSON-RPC unsupported; WebSocket not mentioned). A hand-authored backend test is arbitrary Python over HTTP, so anything with an HTTP surface is testable by hand even where generation does not apply.

**Worth the credits** only when the test sees a deployed-boundary fact that native tests cannot: real network, auth, proxies, CORS, SSE framing, cold start, a real browser.

## Verdicts

| Repo type | Fit | Needs | Path |
|---|---|---|---|
| Web frontend (SPA, SSR, static site, docs site) | **full** | reachable URL, or a dev/preview server port plus a V3 account | `/testsprite:init`, then plans (generated or hand-written), smoke run, `/testsprite:verify` |
| REST / OpenAPI backend | **full if reachable**, else partial | public base URL (preview or staging) | spec upload and generation, or hand-authored `requests` tests with `--produces` / `--needs` / teardown |
| GraphQL | **partial** | public endpoint | hand-authored POST tests ([template](../templates/graphql.py)); upload the schema for best-effort generation |
| MCP server over streamable HTTP or SSE, deployed | **partial**, useful at the deployed boundary | public MCP endpoint and token | hand-authored JSON-RPC tests ([experimental template](../templates/mcp-http.py)); native client tests stay the primary suite |
| MCP server, **stdio only** | **none** | n/a | say so; see below |
| CLI tool | **none** for the binary | n/a | say so; see below |
| Library / SDK | **none** for the code | n/a | same; test a demo or docs site if one exists |
| Monorepo | **per unit** | one TestSprite project per deployable surface | nearest-ancestor `.testsprite/config.json`; fit computed per unit |
| Mobile / desktop native | **none** | n/a | out of scope; a web companion, if any, is a frontend |

`none` is a first-class answer. Print it with the reason and stop. Do not create a project, upload anything, or spend credits.

## What to print for `none`

```
TestSprite fit: none  (<kind>)
Why: TestSprite runs in the cloud and can only call a URL. <this repo> has no network surface.
Do instead (free, faster, more accurate for this kind of repo):
  1. <native test option>
  2. <second option>
What would change the answer: <specific change>
```

### stdio MCP server

Do instead: (1) client tests using your MCP SDK's client against the real server process (spawn over stdio); (2) an MCP inspector or CLI client for black-box tool calls. What would change the answer: add an HTTP transport, host it behind auth on a staging URL, then run `/testsprite:init`. Most MCP SDKs serve the same tools over streamable HTTP with a flag, so this is a small change to the server, not a wrapper. Tell the user plainly that native tests stay the primary suite and TestSprite would be the external smoke check of the deployed boundary (TLS and proxy behavior, auth headers and expiry, CORS, SSE through a load balancer, session ids across instances, cold start).

### CLI tool or library

Do instead: (1) native tests (subprocess with golden output; `bats`; `pytest` with `subprocess`; `go test` with `exec`; property tests); (2) test any web or hosted surface the project also has (docs site, landing page, dashboard, a `serve` mode) as a normal frontend or backend project; `sprite-detect` reports those as extra kinds on the same unit. A thin HTTP wrapper around the binary is possible but recommend against it: it tests the wrapper, needs a deployed authenticated service, and an exec-on-request endpoint is a remote-execution risk. Only defensible when the tool's real production use is already behind a server; then use a fixed argv allow-list, no user-controlled arguments, auth, a throwaway deployment, and no secrets in the sandbox.

## Mixed repos

A unit can have several kinds (an MCP server plus a landing site). The testable kind proceeds; the others stay `none` with their message. Never block the testable part because another part has no fit.

## Backend reachability

TestSprite's tunnel serves frontend tests only, so a backend test needs a public URL. In order of preference: (1) deploy a preview or staging; (2) test an existing staging or production, reads first, writes only with a test account and a teardown test; (3) the user's own tunnel (cloudflared, ngrok, localhost.run), for a backend only. Explain that this makes the dev API and test credentials internet-reachable. **Never start public exposure yourself.**

## Monorepos

One TestSprite project per deployable surface (a project is typed frontend or backend, never both). Resolve the project from the nearest ancestor `.testsprite/config.json` to the changed file, then `TESTSPRITE_PROJECT_ID`, then a name match in `testsprite project list`, then ask. `verify` maps the diff to units first, then to tests; `audit` runs per unit; a test list can span several projects for a CI gate.

## Fit messages

| Verdict | Message | Then |
|---|---|---|
| full | `TestSprite fit: full (web-frontend; deployed at ... / dev server :5173)` | continue |
| partial | `TestSprite fit: partial (GraphQL / MCP over HTTP / API needs a public URL)` plus the specific limit and the hand-authoring path | ask whether to continue |
| none | the block above | stop; no cloud state |
| mixed | one verdict per kind | continue on the testable kinds only |
