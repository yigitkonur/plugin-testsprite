# Plugin evals

Ten behavior cases for `claude plugin eval` (early access, Claude Code >= 2.1.269). Graders only read the transcript; nothing calls TestSprite's cloud.
Every run and every `llm` grader is a paid model call, so set a cost cap. Run from the repo root.

    # one case, one arm, one run
    claude plugin eval . --case 01-stdio-mcp-not-a-fit --runs 1 --ablation none --scaffold --allow-tools Write "Bash(sprite-*)" "Bash(testsprite *)" "Bash(cat *)" "Bash(printf *)"
    # whole suite (3 runs x 2 arms x 10 cases), capped
    claude plugin eval . --scaffold --max-cost-usd 10 --threshold 0.8 --no-publish --allow-tools Write "Bash(sprite-*)" "Bash(testsprite *)" "Bash(cat *)" "Bash(printf *)"

- `--scaffold` is needed for cases 1-4, 7, 9, 10: each `fixture.sh` copies a repo from `tests/fixtures/repos/` into the empty workspace (local files only).
- Granted Bash runs in the OS sandbox with no network and an empty temporary HOME, so `testsprite` cannot reach the cloud. Case 7 copies its two evidence bundles into the workspace with `fixture.sh` (`add_dirs` was unreliable in the sandbox).
- The `tool_used: Skill` graders are plugin-fired indicators and are not scored in a two-arm run.
- `init`, `audit` and `ci` are user-only skills (`disable-model-invocation`), so the model cannot invoke them. Cases 2, 3 and 9 phrase the request in prose and check that the model reaches the same behavior through the `testsprite` skill.
- Spec limits: there is no top-level eval config file; cost cap, tool grants and `--scaffold` are CLI flags only. `tool_order` needs both tools called, so case 3's order grader (weight 0.5) fails if the model never calls `testsprite` at all.
- `results/` is written by each run and is git-ignored.
