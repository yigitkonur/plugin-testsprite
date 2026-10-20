# Authoring frontend plans

A frontend test is a plan: a name, a description, a priority and ordered steps in plain language. You describe user intent; a cloud agent finds the elements. Start from `testsprite test scaffold` (a schema-correct starter, pure-local) or `testsprite test create --plan-template`, and validate with `testsprite test lint`, which collects every problem offline. The exact schema: `sprite-ref schema plan`. Placeholders such as `{{LOGIN_USER}}` are **not** substituted; the agent would type the braces literally. Store login credentials on the project instead.

**Show the user the drafted plan before creating it.** Creating writes to their project.

## Shape

```json
{
  "projectId": "<from testsprite project list>",
  "type": "frontend",
  "name": "Extending the booking range updates the estimated total",
  "description": "When a user extends the booking date range on a listing, the booking panel's estimated total updates before payment.",
  "priority": "p1",
  "planSteps": [
    { "type": "action", "description": "Navigate to the homepage" },
    { "type": "action", "description": "Search for stays with a valid destination and date range" },
    { "type": "action", "description": "Open a listing from the search results" },
    { "type": "action", "description": "Change the date range to a longer stay" },
    { "type": "assertion", "description": "Verify the estimated total in the booking panel changed from its initial value to reflect the longer stay" }
  ]
}
```

- `name`: an assertable behavior (subject, verb, outcome). "Date range" tells the agent nothing.
- `description`: condition plus expected outcome in one sentence. Keep it in agreement with the steps; the agent reads it as the test's purpose and shrinks execution to match.
- `priority`: `p0` must-pass, `p1` important paths, `p2` edge, `p3` cosmetic. Pick honestly.
- Limits: 200 steps, 256 KB.

## Rules that make plans reliable

A loose plan produces a confidently wrong `passed` or a thrashing `blocked`.

1. **One verb per step.** "Search and open the first result" is two steps.
2. **Outcomes, not selectors.** Write "Submit the form", not "Click the blue Submit button". If the app tags elements with its own attribute (`data-cy`, `data-element`), tell the project once with `testsprite project update <project-id> --test-id-attributes <attr>,data-testid`; the project shows the current value in `project get`.
3. **`Navigate to` only on step 1** (or a login page). Use clicks afterwards; direct URLs break SPA routing.
4. **Narrate a user journey.** Each action is what a real user does. The last assertion verifies what the journey produced (state reached, a comparison with an earlier state, a derived count), not that the first page rendered.
5. **Name the entity type** when a page has look-alike rows, and the view you expect to land on.
6. **One or two assertions, at the end,** that check the thing is present **and works**. A node can exist yet be broken (an image whose source 404s still "has alt text"). Assert correctness, and trust the agent to judge it.
7. **Name the page region** an assertion targets (panel, tab, output area); otherwise "some element with that text is visible anywhere" passes for the wrong reason.
8. **Layout-sensitive features need a geometry assertion** (side by side, stacked, spans the width, card background). A content-presence assertion passes on a page whose stylesheet failed to load.
9. **Stay in scope.** Keep out flows that depend on state outside the test's control: third-party auth (OAuth, SSO, 2FA), OS-native surfaces (file upload and download, drag and drop, native dialogs), cross-context state (iframes, multi-tab, external services). Pick another verification.
10. **Self-contained data.** Create what the test needs inside the plan, or do not write the plan.

## Sets and edits

- A coverage set is 2 to 5 plans (happy, error, edge), one JSON object per line in a `.jsonl` file, created with `test create-batch --plans <file>`. More than five needs the user's confirmation. Batch is frontend only.
- Refine an existing test with `test plan put <test-id> --steps <file>`, then rerun once.
- Check `test list` first and extend an existing test before writing a duplicate.

## Sign-in for the app under test

Environment sign-in modes: `public`, `account` (username and password; give a **file path** for the password), `otp` (chosen when the environment is created and cannot be switched later; TestSprite manages the inbox or phone), `manual` (SSO captured once in the portal; behind a per-account flag). Local environments support only public and account. Never ask for a password in chat.

## Local frontends

`--local <port>` tunnels the user's machine to the cloud runner (V3). Prefer a **built** server over a dev server: a dev server can take about a minute per page through the tunnel. The tunnel lives only while the command runs.
