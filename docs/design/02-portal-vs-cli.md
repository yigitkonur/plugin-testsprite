# 02 · Portal vs CLI: what each does, where they overlap, what the plugin hands off

Source keys and evidence tags: see `README.md`. The portal docs are 44 pages under `sources/docs/web-portal/`.

## 1. Same backend, three surfaces

CLI, Web Portal, and the (legacy) MCP server all talk to one backend. A test created from the terminal appears in the
dashboard and vice versa. [V CLID:getting-started/overview] The CLI's own charter says it is "a complement to the
dashboard, optimized for terminals, CI, and agents — not a full UI replacement." [V `sources/testsprite-cli/VISION.md`]

| | Web Portal | CLI (v0.15.0) |
|---|---|---|
| Built for | A human looking at screens | An agent or CI reading JSON and exit codes |
| Strength | Visual: coverage map, video replay, trends, admin, integrations | Scriptable, stable, structured failure bundles |
| Weakness for an agent | Not scriptable | No visual editing, no admin, no insights |

## 2. Capability matrix (portal feature → CLI → what the plugin does)

"Drive" = the plugin runs it through the CLI. "Hand off" = the plugin stops and tells the user exactly what to do in the
portal. "Ignore" = irrelevant to a CLI-driven plugin.

| Portal feature | CLI equivalent (exact) | Plugin stance | Why |
|---|---|---|---|
| Create project (URL, type, sign-in) | `testsprite project create` | **Drive** | `--type`, `--url`/`--local`, `--username`, `--password-file`, `--instruction`, `--test-id-attributes` [V HELP:project-create] |
| Environments (URL, creds, variables, default) | `testsprite project env list\|get\|create\|update\|delete\|set-default` | **Drive** | `--var KEY=VALUE`, `--sign-in`, `--set-default` [V HELP:project-env-create] |
| Sign-in modes: none / account / OTP | `testsprite project sign-in get\|set` (`--mode public\|account\|otp\|manual`) | **Drive** | OTP is chosen **at environment creation and cannot be switched later**; create a new environment instead [V DOC:552] |
| Sign-in: SSO (manual capture) | `project sign-in set --mode manual` selects it, but the login itself is captured once in a live portal browser; needs a public URL; per-account feature flag (`FEATURE_GATED`, exit 13) | **Hand off** | Needs a human in a browser modal [V DOC:537-552; WEB:core/ui/ui-authentication] |
| Upload PRD / API spec | `testsprite project docs upload <file> --project <id> --role prd\|api-doc` | **Drive** | PRD 0.5 credit; `api-doc` free [V DOC:728] |
| List / delete uploaded sources, test-file fixtures (beta), crawled pages, Figma/Jira/GitHub sources | none (`docs list`/`delete` do not exist) | **Hand off** | "the Portal is the place to review or remove a project's sources" [V DOC:736] |
| Exploration of the live FE app | stage 1 of `test plan generate` | **Drive** | Runs automatically if missing [V HELP:test-plan-generate] |
| **Re-explore** after fixing URL/credentials | none | **Hand off** | Portal "Re-explore" on the Sources card [V WEB:core/ui/feature-exploration] |
| API endpoint review at project creation (remove, fix path, auth, add manually) | none; endpoint list is "locked" after creation | **Hand off** | Re-extracting replaces the whole list [V WEB:core/api/api-discovery] |
| Feature map / Coverage map: view, edit, "Regenerate from sources" | none (an internal stage of `plan generate`) | **Hand off** | Visual edit; regenerate is destructive and irreversible [V WEB:core/working-with-test/coverage-map, managing-test-cases] |
| Generate proposals | `testsprite test plan generate --project <id>` | **Drive** (background, costs credits) | [V HELP:test-plan-generate] |
| Review / edit staged proposals | table printed by `generate`; **edit is portal-only** | **Drive** to accept or discard; **Hand off** to edit | "Editing a proposal before accepting is not available from the CLI yet" [V DOC:708] |
| Accept proposals | `testsprite test plan accept --project <id> [--only …]` | **Drive** | Subset accept discards the rest [V HELP:test-plan-accept] |
| Regenerate an already-staged batch | none | **Hand off** | "a Portal action for now" [V DOC:663] |
| Add / edit a test manually | `test create`, `create-batch`, `test plan put`, `test code put`, `test update`, `test scaffold`, `test lint` | **Drive** | [V HELP] |
| Run / rerun / batch | `test run`, `test rerun`, `test wait`, `test cancel`, `test flaky`, `testlist run` | **Drive** | [V HELP] |
| Step replay, video, "Agent actions" tiles | `test steps`, `test artifact get`, `test open --no-browser` (prints the deep link) | **Drive** artifacts; **Hand off** to watch video | `test open --no-browser` is "SSH, headless, CI, agents" [V HELP:test-open] |
| Error / Cause / Fix, "Copy fix prompt" | `test failure summary`, `test failure get`, `test result --include-analysis` | **Drive** | [V HELP] |
| Auto-heal (UI rerun) | on by default for FE `test rerun`; `--no-auto-heal` | **Drive** | Portal has no toggle [V WEB:core/ui/auto-heal] |
| Run Behavior (viewport, "log in once per run", max tests per run, "always use planned steps") | none | **Hand off** | Project Settings → Test Execution. "Always use planned steps" off means an unedited case **replays its last recorded steps** [V WEB:setup/execution-settings] |
| Test Lists | `testlist list\|get\|create\|update\|delete\|add\|remove\|run` | **Drive** | docs site still lists as "roadmap" [V HELP:testlist; CLID:reference/whats-included] |
| Schedules (monitoring) | `schedule list\|get\|create\|update\|delete\|run list` | **Drive**, with spend confirmation | Plan-gated (exit 13); CLI prints frequency + estimated cost before sending [V DOC:1014-1068] |
| Insights: issues-to-fix, trends, regressions, coverage gaps | none (`usage` only shows credits) | **Hand off** | Visual; the plugin's `audit` produces its own coverage view |
| Test report / PDF | none | **Hand off** | Print-to-PDF in the browser [V WEB:results/test-report] |
| GitHub App (PR comments, "Block PR until tests pass") | none (the CLI's `ci init github` is a *different* mechanism) | **Hand off** | OAuth install in the portal; do not run the App and an Actions gate on the same project without asking [V CI:150] |
| Export tests to a GitHub repo | `testsprite test code get <id> --out <file>` per test | **Drive** (local files) | Portal export writes to `main` under `testsprite_test_code/`, no branch choice [V WEB:integrations/github-integration] |
| Slack, Jira/Linear ticketing | none | **Hand off** | Workspace OAuth (Owner/Admin) |
| Workspaces, roles, sharing, billing/top-up | none | **Hand off** | "Share" means inviting someone into the whole workspace |
| API key minting | none (`setup` stores one you paste) | **Hand off** | Settings → API Keys; shown once; workspace keys `sk-member-…`, max 2 per member per workspace [V WEB:admin/api-keys] |
| AI Chat | none | **Ignore** | Claude Code is the chat |

## 3. Hand-off rules the plugin follows

1. **Never fake a portal action.** If the step is "Hand off", print one sentence naming the portal location and why the CLI
   cannot do it, then continue with whatever is still possible.
2. **Prefer a deep link over directions.** `testsprite test open <test-id> --no-browser` prints the URL; run outputs carry
   `dashboardUrl` (optional — the backend omits it when it cannot form a correct link, with an `[advisory]`).
   [V HELP:test-open; CLID:reference/configuration]
3. **Name the cost of the handoff** when it follows a spend (e.g. "exploration already billed; fixing the login now and
   re-exploring in the portal will bill again").
4. **Secrets never travel through chat.** API keys, test-account passwords, SSO: the user supplies a file path or runs the
   command themselves (`! testsprite setup --no-agent`).

## 4. The docs site is stale; the repo is the truth

Source priority used throughout this plan: CLI `--help` (packaged 0.15.0) > `DOCUMENTATION.md` > `CHANGELOG.md` > docs
site > portal docs > tutorials.

| Docs-site claim | Reality in 0.15.0 | Evidence |
|---|---|---|
| "The CLI does not support `localhost` targets; use the MCP server" (7 pages) | `--local <port>` + `tunnel` + `project create --local` exist (V3, FE only) | docs: `cli/concepts/the-agent-loop.md:106`, `cli/core/projects.md:92`, `cli/core/running-tests.md:103`, `cli/troubleshooting/common-issues.md:34`, `cli/getting-started/overview.md:131`, `cli/getting-started/quickstart-for-agents.md:166`, `cli/core/projects.md:68` · truth: HELP:test-run `--local`; CHG 0.13.0/0.14.0 |
| Test Lists and schedule reads are "on the roadmap" | Shipped: `testlist`, `schedule` | `cli/reference/whats-included.md:116-117` · HELP:testlist, HELP:schedule |
| `ci run`, `ci init`, `testlist`, `schedule create`, `--local` | Zero mentions in all 22 CLI doc pages | `grep` over `sources/docs/cli` |
| Doctor sample shows CLI `0.3.0` | Current is 0.15.0 (11 releases in 3 months since the 0.4.0 your skills pin) | `cli/reference/command-reference.md:111` · CHG |
| Exit codes table has no `13` (feature gated) | Exit 13 exists | `cli/reference/exit-codes.md` (no match) · DOC:1519-1537 |
| Cancelling gives "No refund" | V3 FE run cancelled before terminal: original charge returned (attempted; read `refund.status`); BE/V2 keep billing | `cli/core/cancelling-runs.md:69` · HELP:test-cancel |
| `--target-url` "not applied on V3-routed accounts" | CHG 0.13.0: `--target-url` supported for run-time FE targets; used by `ci run` | `cli/reference/command-reference.md:489` · CHG 0.13.0 |
| Backend project takes no URL | On V3, `--url` is required for backend projects too | HELP:project-create |
| Tutorials: "CLI with Claude Code", "From local to production", "Plan, Test, Ship" | Three of five video tutorials are **MCP-server or Portal flows**, not CLI | see §6 |

## 5. Contradictions inside the sources (unresolved → tagged)

| Topic | Source A | Source B | Plan treats as |
|---|---|---|---|
| Does auto-heal overwrite stored code? | HELP:test-rerun: "the agent re-authors the test and the new code replaces the stored version" | WEB:core/ui/auto-heal: "doesn't overwrite it unless you explicitly save" | **[U3]**; plugin never counts heal-pass as proof and diffs `codeVersion` before/after |
| `TARGET_URL` injected into BE tests? | VERIFY:188 and :226 use `{TARGET_URL}` | scaffold in the CLI hard-codes `BASE_URL = "https://staging.example.com"`; `ci run` help: "Backend tests use the URL in their own code, not --target-url"; your skill distrusts it | **[U2]**; plugin templates use explicit `BASE_URL` |
| API endpoint list after creation | WEB:api-discovery: "locked", re-extract replaces | CLI `docs upload --role api-doc` on an existing project | **[U]** whether a later upload adds endpoints |
| Smart Rerun, "Create test: three paths" | Mentioned in your brief | Absent from all 73 pages | Treated as marketing; not designed around |

## 6. What the five tutorials actually demonstrate

The five "tutorial" pages are each **~1.5–2 KB: one YouTube embed, a few chapter bullets, two link cards, a recording-date note, and no code block at all**; only `mcp-demo`
(18 KB, 12 code fences) has real content. That is why they feel confusing: there is nothing written to follow. [V `sources/docs/learn/*.md`: sizes 1,527–2,091 B, 0 code fences, 1 embed each; measured]

| Page | What it demonstrates | Surface actually used | Use for the plugin? |
|---|---|---|---|
| `tutorial-cli-claude-code` | The pitch: Claude Code needs an *external verifier* that checks real user experience, not just compilation | **CLI** | The framing for `verify`; the loop itself is on `concepts/the-agent-loop` |
| `tutorial-cli-local-llm` | Same CLI loop with a local model (Qwen) as the coding agent. Cloud runs still cost credits despite a "zero-cost" title | **CLI** | Shows the loop is model-agnostic (exit codes + JSON) |
| `tutorial-local-to-production` | Test a Next.js app locally, deploy to Netlify, retest, set up monitoring | **MCP server** (local) + **Portal schedules** | Best *workflow template*: local → prod → monitor. Now doable entirely in the CLI (`--local`, `project update --url`, `schedule`) |
| `tutorial-plan-test-ship` | Cursor plan mode → build → TestSprite finds validation/a11y bugs → feed fix prompts back | **MCP server** in Cursor (Oct 2025, pre-3.0) | The plan → build → verify → fix sequence |
| `tutorial-github-ci` | GitHub App vs GitHub Actions; Actions variant uses a Cloudflare tunnel and the legacy marketplace action | **GitHub App (portal)** + **Actions**, no coding agent | Decision rule only; superseded by `ci run` / `ci init github` |
| `mcp-demo` (+`#frontend`) | One prompt → PRD → plan → Playwright files → run → report, on a local React app | **MCP server only** | Output structure for reports; its internal numbers disagree (62.5% vs 56%); do not copy its mechanics |

## 7. Implications for the design

- The plugin's value is *judgment and steering* on the CLI-drivable ~70% of the surface; the portal ~30% (visual editing,
  admin, integrations, insights) needs crisp hand-offs, not emulation.
- Because the docs site lags, anything the plugin teaches must be checked against the **installed CLI**, not the site —
  hence `sprite-ref` (doc 05) and the flag-trace check (doc 08).
- `.mcp.json` is not needed: nothing in the CLI-drivable surface requires an MCP server, and the one thing MCP did that the
  CLI could not (localhost) is now covered by `--local`.
