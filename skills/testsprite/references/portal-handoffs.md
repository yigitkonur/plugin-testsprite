# Portal hand-offs

The CLI, the web portal and the legacy MCP server share one backend: a test created in the terminal appears in the dashboard and the reverse. The CLI is a complement to the dashboard, not a replacement. When a step is portal-only, **do not fake it**: print one sentence naming the portal location and why the CLI cannot do it, then continue with whatever is still possible. Prefer a deep link (`testsprite test open <test-id> --no-browser` prints it; run results carry `dashboardUrl` when the backend can form one).

## Hand off to the portal

| Task | Where in the portal | Why the CLI cannot |
|---|---|---|
| Edit the feature map; "Regenerate from sources" | Test Coverage | Visual edit. Regenerate discards all use cases and their tests, irreversibly |
| Re-explore after fixing URL or credentials | Sources card, Re-explore | No CLI command. Say that exploration already billed and re-exploring bills again |
| Edit a staged proposal before accepting | proposal review | The CLI can only accept or discard; regenerating a staged batch is also portal-only |
| SSO sign-in (manual capture) | Project, Settings, Environments, the environment, Log in | A human logs in once in a live browser; per-account feature flag (exit 13 when off). The CLI can choose the mode and report session status |
| Run Behavior (viewport, log in once per run, max tests per run, "always use planned steps") | Project Settings, Test Execution | No CLI setting. Note that with "always use planned steps" off, an unedited case replays its last recorded steps |
| List or delete uploaded sources, crawled pages, Figma / Jira / GitHub sources | Sources | There is no `docs list` or `docs delete` |
| API endpoint review after project creation | API project settings | The endpoint list is locked after creation; re-extracting replaces the whole list |
| Insights: issues, trends, regressions, coverage gaps; test report PDF | Insights, report page | Visual. `audit` produces its own coverage view |
| GitHub App (PR comments, "Block PR until tests pass"), Slack, Jira / Linear | Integrations | OAuth install by an Owner or Admin. Do not run the App and an Actions gate on the same project without asking |
| Workspaces, roles, sharing, billing and top-up | Settings | Account administration. "Share" invites someone into the whole workspace |
| API key minting | Settings, API Keys | Shown once; the user pastes it into `! testsprite setup --no-agent`. Never handle the key |
| Watching the video replay | test page | Use `test open --no-browser` for the link |

## The CLI drives these (do not hand off)

Projects, environments and sign-in modes (public, account, otp), PRD and API-spec upload, plan generation and accept, manual test authoring and edits, runs, reruns, waits, cancels, flaky checks, test lists, schedules (with spend confirmation), failure bundles, step lists, results with history, local tunnels, `ci init github` and `ci run`, per-test code export.

## Rules

1. Name the cost of the hand-off when it follows a spend.
2. Secrets never travel through chat: the user supplies a file path or runs the command themselves.
3. If the docs site disagrees with the installed CLI, the CLI's help wins (the site lags: it still claims the CLI cannot target localhost and lists test lists and schedules as roadmap items).
