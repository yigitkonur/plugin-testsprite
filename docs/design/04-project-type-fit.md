# 04 · How TestSprite applies to each project type — detection, honest fit, and the path through the plugin

Source keys and evidence tags: see `README.md`. This document drives `sprite-detect`, the `project-fit` reference, and the
fit gate in `/testsprite:init` and `/testsprite:audit`.

## 1. The one rule that decides fit

> TestSprite's cloud can only test something it can **reach over the network and drive as a user or an HTTP client**.

- **Frontend:** a web app at a public URL, or at `localhost:<port>` through a tunnel (V3 accounts, FE only). [V HELP:test-run `--local`]
- **Backend:** an HTTP API at a **public URL written into the test**. `--local` is rejected for backend. [V VERIFY:26-34; HELP:test-run; scaffold comment "must be reachable from the internet"]
- **Generation vs hand-authoring.** Proposal generation (`plan generate`) is REST-first; GraphQL is "best-effort"; gRPC and JSON-RPC are "not supported"; WebSocket is not mentioned. [V WEB:core/api/api-discovery] But a **hand-authored backend test is arbitrary Python over HTTP** (`requests`), so anything with an HTTP surface is testable by hand even where generation does not apply. [V VERIFY:183-206]
- **Worth the credits** only when the test sees a *deployed-boundary* fact native tests cannot (real network, auth, proxies, CORS, SSE, cold start, real browser). This is the test your own backend skill already used; it is kept. [V MINE-BE "Value boundary"]

## 2. Verdict table

| Repo type | Fit | Needs | Plugin path |
|---|---|---|---|
| **Web frontend** (SPA, SSR, static site, docs site) | **Full** | Reachable URL (deployed) or a dev/preview server port + V3 account | `init` → project → `plan generate` or hand plans → smoke → `verify` |
| **REST / OpenAPI backend** | **Full if reachable**, else **Partial** | Public base URL (preview/staging). Local-only API → deploy a preview or use your own tunnel (plugin never exposes your machine) | spec upload → `plan generate`, or hand-authored `requests` tests with `--produces/--needs/teardown` |
| **GraphQL** | **Partial** | Public endpoint | hand-authored POST tests (§5); upload `.graphql` schema for best-effort generation |
| **MCP server — streamable HTTP / SSE, deployed** | **Partial, genuinely useful at the deployed boundary** | Public MCP endpoint; auth token | hand-authored JSON-RPC tests (§6); compare with native tests first |
| **MCP server — stdio only** (most local servers) | **None** | — | Say so. Native client test / MCP inspector. TestSprite becomes relevant only if an HTTP transport is added and hosted (§7) |
| **CLI tool** | **None** (for the binary) | — | Say so. Native subprocess/golden tests. Test any *hosted or web surface* the project also has (§8) |
| **Library / SDK** | **None** (for the code) | — | Same; test a demo/docs site if there is one |
| **Monorepo** | **Per unit** | One TestSprite project per deployable surface | nearest-ancestor `.testsprite/config.json`; fit computed per unit (§9) |
| **Mobile / desktop native** | **None** | — | Out of scope; a web companion, if any, is FE |

"None" is a first-class answer: `init`/`audit` print it with the reason and stop instead of pushing the repo through a
setup that cannot produce a meaningful test.

## 3. Detection: signals, not assumptions

`sprite-detect` (a Node ESM helper, no dependencies) scans the repo — respecting `.gitignore`, depth-limited — and reports **units**
(one per manifest root) with `kinds[]`, `evidence[]`, and `fit`. A unit can have several kinds. Nothing here is hard-coded to a
language; each row is a signal family.

| Kind | Signals (any language) |
|---|---|
| **web-frontend** | `index.html`; `vite.config.*`, `next.config.*`, `nuxt.config.*`, `svelte.config.*`, `astro.config.*`, `angular.json`, `remix.config.*`; deps `react`/`vue`/`svelte`/`solid`/`@angular/core`; static-site generators (`docusaurus.config.*`, `mkdocs.yml`, `hugo.toml`, `_config.yml`, `book.toml`); scripts `dev`/`start`/`preview`/`build`; framework default ports (vite 5173, next/nuxt/CRA 3000, angular 4200, astro 4321) |
| **http-api** | `openapi.{json,yaml,yml}`, `swagger.*`, `*.postman_collection.json`; framework deps — Node `express|fastify|koa|hono|@nestjs/*`, Python `fastapi|flask|django|starlette|aiohttp`, Go `net/http|gin|echo|chi|fiber`, Rust `axum|actix-web|rocket`, JVM `spring-boot*|ktor|quarkus|micronaut`, Ruby `rails|sinatra`, PHP `laravel|symfony|slim`, .NET `Microsoft.AspNetCore*`, Elixir `phoenix`; Dockerfile `EXPOSE`; `PORT` in `.env.example` |
| **graphql** | `*.graphql`/`schema.graphql`; deps `apollo-server|graphql-yoga|mercurius|strawberry|graphene|gqlgen|async-graphql|juniper`; a `/graphql` route string |
| **mcp-server** | deps `@modelcontextprotocol/sdk`, `fastmcp`, python `mcp`, `mcp-go`/`mark3labs/mcp-go`, `rmcp`, `modelcontextprotocol` JVM/C#; files `server.json` (MCP registry manifest), `smithery.yaml`; README `npx`/`uvx` run line. `.mcp.json` / `mcp.json` / `.cursor/mcp.json` are *client* configs of servers the repo **consumes** and are excluded |
| ↳ **transport = stdio** | `StdioServerTransport`, `stdio_server(`, `transport="stdio"`, `mcp.run()` default in FastMCP, `ServeStdio` |
| ↳ **transport = http** | `StreamableHTTPServerTransport`, `SSEServerTransport`, `transport="streamable-http"`/`"http"`/`"sse"`, `run_streamable_http`, an HTTP framework alongside the MCP SDK, `/mcp` or `/sse` route strings |
| **cli-tool** | `package.json` `bin`; `pyproject.toml` `[project.scripts]`/`console_scripts`; Cargo `[[bin]]` + `clap`; Go `cmd/*/main.go` + `cobra|urfave/cli`; `argparse|click|typer|commander|yargs|oclif`; shebang entrypoints; **no** http-api/web signals |
| **library** | `main`/`exports`/`types` without `bin`; Cargo `[lib]` only; a Python package with no entry points; Go packages without `main` |
| **monorepo** | `workspaces` in `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `nx.json`, `lerna.json`, Cargo `[workspace]`, `go.work`, Gradle multi-project, `apps/*` + `packages/*` layout, ≥2 manifests |
| **deploy signals** (reachability) | `vercel.json`/`.vercel/`, `netlify.toml`, `fly.toml`, `render.yaml`, `railway.json`, `wrangler.toml`, `serverless.yml`, `app.yaml`, `Procfile`, Dockerfile, deploy steps in `.github/workflows/*` |
| **TestSprite state** | `.testsprite/config.json` (nearest ancestor), `.claude/skills/testsprite-*` (official skills present), `.github/workflows/testsprite.yml`, `TESTSPRITE_PROJECT_ID` |

Signals are *evidence*, not verdicts; `sprite-detect` prints them so the model (and you) can see why. Ambiguity is reported, not guessed
("stdio markers found and an Express dep: confirm whether the HTTP server is the MCP transport").

Sketch of the output (stable, additive; consumed by `init`, `audit`, SessionStart):

```json
{
  "root": "/abs/repo", "git": { "head": "abc123" },
  "units": [{
    "path": "apps/web", "languages": ["typescript"],
    "kinds": ["web-frontend"],
    "evidence": ["vite.config.ts", "dep:react", "script:dev"],
    "devServer": { "cmd": "npm run dev", "port": 5173, "source": "vite default" },
    "deploy": ["vercel.json"],
    "testsprite": { "configPath": "apps/web/.testsprite/config.json", "projectId": "proj_8f0f6" },
    "fit": { "verdict": "full", "needs": ["reachable URL or --local on a V3 account"], "next": "init" }
  }],
  "warnings": ["official testsprite skills present in .claude/skills (duplicate guidance)"]
}
```
Everything above that is not a literal file/dep match (the `fit` object, port defaults) is the plugin's own judgment **[I]**.

## 4. The reachability problem for backends (and what the plugin will and will not do)

Backends must be on a public URL. Realistic options, in the order the plugin offers them:

1. **Deploy a preview/staging** (preferred; also what CI needs). Detected via deploy signals.
2. **Test the deployed production/staging that already exists**, read-only first (`GET`s), writes only against test accounts with a
   `--category teardown` test.
3. **Your own tunnel** (cloudflared, ngrok, localhost.run). The plugin explains the exposure (your dev API and the test credentials
   become internet-reachable) and leaves starting it to you. The TestSprite GitHub tutorial does this in CI with a Cloudflare
   tunnel. [V LEARN:tutorial-github-ci] The plugin will never open public exposure itself.

Auth for BE tests is configured once on the project (`project credential`, or `project auto-auth` on Pro) and read inside the test
as `__AUTH_HEADERS__`. [V VERIFY:208-239]

## 5. GraphQL (partial, mechanically simple)

Hand-authored test, one POST per operation. Assert on `errors` as well as `data`; GraphQL returns HTTP 200 for many failures.

```python
import requests

BASE_URL = "https://api-staging.example.com"   # explicit, public

def test_viewer_query() -> None:
    r = requests.post(
        f"{BASE_URL}/graphql",
        json={"query": "query { viewer { id email } }"},
        headers={**__AUTH_HEADERS__},
        timeout=30,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}"
    body = r.json()
    assert "errors" not in body, body.get("errors")
    assert body["data"]["viewer"]["id"], "viewer.id missing"

test_viewer_query()   # MUST be called: the file runs top to bottom
```
[I] Pattern, not a TestSprite document. Skeleton shape (top-to-bottom, call the function, `__AUTH_HEADERS__`) is [V VERIFY:183-239].
Upload the `.graphql` schema with the spec for best-effort proposal generation. [V WEB:core/api/api-discovery]

## 6. MCP servers over HTTP (partial; the one place TestSprite adds real signal)

Why it can be worth it: a *remotely hosted* MCP server has failure modes that in-process tests cannot see — TLS and proxy behavior,
auth headers and expiry, CORS, SSE framing through a load balancer, session-id handling across instances, cold start, and rate limits.

Shape of a test (**[I]/[U9]**: written from the MCP streamable-HTTP transport as I know it, **not** from any file in `sources/`; the target
server's `protocolVersion` and session behavior must be read from the server before this is trusted, and the requests-only sandbox has no
MCP SDK so framing is hand-rolled):

```python
import json, requests

BASE_URL = "https://mcp-staging.example.com/mcp"   # explicit, public

def rpc(session, method, params=None, id_=1):
    h = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json", **__AUTH_HEADERS__}
    if session: h["Mcp-Session-Id"] = session
    body = {"jsonrpc": "2.0", "method": method, **({"params": params} if params else {}), **({"id": id_} if id_ else {})}
    r = requests.post(BASE_URL, json=body, headers=h, timeout=30, stream=True)
    assert r.status_code in (200, 202), f"{method}: HTTP {r.status_code}"
    sid = r.headers.get("Mcp-Session-Id", session)
    if r.headers.get("Content-Type", "").startswith("text/event-stream"):
        for line in r.iter_lines(decode_unicode=True):          # first JSON-RPC response event
            if line.startswith("data:"):
                return sid, json.loads(line[5:])
        raise AssertionError(f"{method}: SSE stream ended without a data event")
    return sid, (r.json() if r.content else None)

def test_initialize_and_list_tools() -> None:
    sid, init = rpc(None, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {},
                                          "clientInfo": {"name": "testsprite-probe", "version": "0"}})
    assert init["result"]["serverInfo"]["name"], "no serverInfo"
    rpc(sid, "notifications/initialized", id_=None)
    _, tools = rpc(sid, "tools/list", id_=2)
    names = {t["name"] for t in tools["result"]["tools"]}
    assert {"search", "fetch"} <= names, f"missing expected tools: {names}"

test_initialize_and_list_tools()
```

What the plugin does with this: the `authoring-backend` reference carries the template; `coverage-auditor` maps *tools* (from `tools/list` in
code) to tests; the plugin tells you plainly that native in-process client tests stay the primary suite and TestSprite is the
**external smoke** of the deployed boundary. Cost check: each BE test run is a credit-bearing run (BE rerun is 0.2 credit; fresh BE price **[U]**).

## 7. MCP servers over stdio (most of yours): honest answer — not a fit

There is no URL for the cloud to call. The plugin's output for such a repo:

```
TestSprite fit: none  (MCP server, stdio transport only)
Why: TestSprite runs in the cloud and can only call a URL. A stdio server has no network surface.
Do instead (free, faster, and more accurate for this kind of repo):
  1. In-process or spawned-stdio client tests with your MCP SDK's client against the real server binary.
  2. An MCP inspector / CLI client for black-box tool calls.   (you already have a tools-by-CLI test approach)
If you want TestSprite's external check later: add an HTTP transport, host it behind auth on staging, then run /testsprite:init.
```

Realistic path if you *do* want the deployed-boundary signal: most MCP SDKs can serve the same tools over streamable HTTP with a flag; deploy
that mode to a staging URL with a token, then §6. This is a small change to the server, not a wrapper, and it also makes the server usable
by remote clients — which is the only reason to host one.

## 8. CLI tools and libraries: honest answer — not a fit for the code

TestSprite cannot execute a binary. Options in order of sense:

1. **Native tests** (subprocess + golden output; `bats`; `pytest` with `subprocess`; `go test` with `exec`; property tests). This is where CLI correctness is verified.
2. **Test the web/hosted surface the project also has**: a docs site, landing page, dashboard, hosted API, `serve` mode — as a normal FE/BE project. `sprite-detect` reports these as extra `kinds` on the same unit.
3. **A thin HTTP wrapper around the binary** (a tiny service that runs fixed commands and returns stdout/exit code; BE tests call it). *Possible, but the plugin recommends against it:*
   it tests the wrapper, not the tool; it needs a deployed, authenticated service; and an exec-on-request endpoint is a remote-execution risk. Only
   defensible for a CLI whose real production use is already behind a server. If you insist: fixed argv allow-list, no user-controlled arguments, auth, throwaway deployment, no secrets in the sandbox.

Libraries: same; a demo/docs site is a FE project, nothing else applies.

## 9. Monorepos

- One TestSprite **project per deployable surface** (each is typed frontend or backend, never mixed). [V CLID:core/running-tests "each project holds one test type"]
- Project resolution: **nearest ancestor `.testsprite/config.json`** to the changed file → `$TESTSPRITE_PROJECT_ID` → name match in `project list` → ask. This keeps the vendor
  convention (`{"projectId": "…"}`) valid per package. [V CLID:getting-started/quickstart-for-agents; VERIFY:88-97]
- `verify` maps the diff to units first, then to tests; `audit` runs per unit; CI uses a `testlist` when a gate spans several projects. [V DOC:1491-1503 test lists for multi-project gates]

## 10. What the fit gate prints (all verdicts)

| Verdict | Message pattern | Then |
|---|---|---|
| full | `TestSprite fit: full (web-frontend; deployed at … / dev server :5173)` | continue |
| partial | `TestSprite fit: partial (GraphQL / MCP over HTTP / API needs a public URL)` + the specific limit + the hand-authoring path | ask whether to continue |
| none | `TestSprite fit: none (<kind>)` + why + "Do instead" list + what would change the answer | stop; do not create cloud state |
| mixed unit | one verdict per kind | continue on the testable kinds only |

## 10b. Walkthrough: the two repo types you mostly build

| Step | stdio MCP server (e.g. TypeScript, `StdioServerTransport`) | CLI tool (e.g. Go + cobra, `cmd/x/main.go`) |
|---|---|---|
| Session starts | `SessionStart`: unlinked ⇒ no output (only the env export). Nothing advertises TestSprite | same |
| You run `/testsprite:init` | `sprite-detect` ⇒ `kinds:[mcp-server]`, `transport:stdio`, evidence `dep:@modelcontextprotocol/sdk`, `StdioServerTransport` | `sprite-detect` ⇒ `kinds:[cli-tool]`, evidence `cmd/x/main.go`, `dep:spf13/cobra`; no web/http signals |
| Fit gate | `none`: no network surface. Prints the §7 block (native client tests; inspector; add + host an HTTP transport to change the answer) | `none`: no network surface. Prints the §8 block (native subprocess/golden tests; test any hosted/web surface instead) |
| Cloud state created | **None.** No project, no upload, no credits | **None** |
| If the repo also has a web/hosted surface | `mcp-plus-landing-site` fixture: the unit gets `kinds:[mcp-server, web-frontend]`; the web kind proceeds as FE, the MCP kind stays `none` | the docs site / dashboard becomes an FE unit |
| If it has (or later gains) an HTTP transport | `transport:http` ⇒ fit `partial`; `init` continues on the hand-authored BE path with the §6 template (`BASE_URL`, explicit teardown); `coverage-auditor` maps `tools/list` entries to tests | n/a unless it exposes a server mode, then `http-api` |
| `/testsprite:audit` | Same gate; with `partial` it audits the BE tests that exist | Same gate |
| `verify` after a change | Does not self-trigger: the repo is unlinked, so SessionStart is silent and the Stop gate is inert. A one-line pointer to native tests is the only output if you ask | same |

The plugin never forces a repo through; it also never leaves you with only "no": every `none` ends with a concrete next step.

## 11. Fixture repos needed to test detection (built in Phase 1)

`web-vite`, `web-next-ssr`, `docs-docusaurus`, `api-fastapi-openapi`, `api-express-no-spec`, `api-go-chi`, `graphql-apollo`, `mcp-ts-stdio`, `mcp-ts-http`,
`mcp-py-fastmcp-stdio`, `mcp-py-http`, `cli-node-bin`, `cli-go-cobra`, `cli-rust-clap`, `lib-ts`, `monorepo-pnpm-web-api`, `mcp-plus-landing-site` (mixed). Each carries an expected
`sprite-detect` JSON golden. Cheap, deterministic, language-spanning — the reason detection is a script and not a prompt.
