# CI shapes

Adapted from the vendor's CI guidance (paraphrased; the installed copy is `sprite-ref skill ci`). The plugin adds the "no second gate" check and an honest non-GitHub path. CI applies only where a deployed web or HTTP surface exists: for a stdio MCP server or a CLI tool, stop at the fit message in [project-fit](project-fit.md).

## 1. Pick the shape from configuration, not from history

| Shape | Signal | Trigger |
|---|---|---|
| **A: the platform deploys every PR** | no workflow deploys; `vercel.json`, `.vercel/`, `netlify.toml` or the platform's git integration is present | `deployment_status` |
| **B: the workflow deploys** | a workflow step already runs `vercel deploy`, `netlify deploy` or a deploy script | `pull_request` plus a deploy step that writes `url=<preview>` to `$GITHUB_OUTPUT` |
| unclear | | ask who deploys previews |

Deployment history (`gh api repos/{owner}/{repo}/deployments`) is evidence only: recent preview records support A; production-only records mean preview deploys are off. The proof is a real pull request.

## 2. Existing gate?

Ask whether the TestSprite GitHub App already gates the project (portal setting). If yes, stop unless the user wants both.

## 3. Generate, then finish by hand

`testsprite ci init github --project <project-id> --env <name>` writes `.github/workflows/testsprite.yml` with one step marked `REPLACE ME` that fails until replaced. `--env` names the environment whose **account** the gate signs in with (`ci run --target-url` swaps only the address). Regenerate with `--force` (the previous file is kept as `.bak`). Show the diff.

- **A:** change the trigger from `pull_request:` to `deployment_status:` and delete the placeholder. With several Vercel projects, add the `github.event.deployment.environment` filter.
- **B:** replace the placeholder's `run:` with the deploy commands ending in `echo "url=<preview>" >> "$GITHUB_OUTPUT"`; the platform token goes in its own secret.
- **Keep what the template fixes:** `ci run ... --target-url "$PREVIEW_URL" --fail-on-skipped --summary-file`, the global install of the CLI with no version pin, fork and draft PRs skipped, the upload step on `if: always()`, job-level `concurrency`.
- **Never** re-judge pass/fail in YAML (`jq` plus `exit 1`). The exit code of `ci run` is the gate.

## 4. Secret

`gh secret set TESTSPRITE_API_KEY` (paste when prompted, or stdin). `ci init github ... --set-secret` does the same and **overwrites** an existing secret, so confirm first. Never put the key in argv, YAML or logs.

## 5. Prove it

Preflight: `gh auth status`, `gh secret list`, `actionlint` if installed. Then, with the user's OK (it is outward-facing): push on a branch, open a **non-draft** PR with no conflicts, watch the check. Expect `Dispatched N tests.` then `CI run: x/y passed`, and a `testsprite-results` artifact holding `testsprite-summary.json`. Known silent failures: a draft PR is skipped with exit 0; a PR with merge conflicts never fires; disabled Actions (common on forks) runs nothing; in shape A check that a `deployment_status` with state `success` arrived. A workflow that has not run on a real PR is not onboarded. Then suggest making the check required in branch protection.

## 6. Reading the result

`ci run` exits 1 when a test failed, 7 for a timeout or an unsupported backend (including a backend too old for `ci run`), 5 for configuration, 4 for a missing test id, and 3 / 12 / 13 for credentials, credits or plan. Backend tests use the URL in their own code. When testing `ci run` locally, a shell that exports `TESTSPRITE_API_URL` or `TESTSPRITE_API_KEY` overrides `--profile`: check `env | grep TESTSPRITE_` before blaming the API.

## 7. Nightly regression

Option 1, cloud-scheduled (plan-gated, bills per firing; the CLI prints frequency and estimated cost first): `testsprite schedule create --name "Nightly" --target-type project --target-id <project-id> --env <name> --cron "0 3 * * *" --timezone <IANA>`. The guard asks before creating one. Option 2, in CI: a `schedule:` workflow running `testsprite ci run --project <id> --env <name>` with no pull-request context.

## 8. Not GitHub

`ci init` supports GitHub only. For other CI give a generic recipe and mark it as the model's work, not the vendor's: install the CLI, export `TESTSPRITE_API_KEY` as a masked secret, run `testsprite ci run --project <id> --summary-file testsprite-summary.json` (optionally `--report junit --report-file <path>`), and archive reports even on failure. Do not promise provider-specific YAML.

## Don'ts

No second gate beside the GitHub App without asking. No `vercel link --yes`. No secrets as arguments. No version pin of the CLI in the workflow. No parsing of the summary to decide the verdict. No loopback or private `--target-url` (`ci run` refuses it). No skipping step 5.
