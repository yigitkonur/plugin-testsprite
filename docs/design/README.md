# TestSprite plugin: design plan (nothing is built yet)

A plan for a **native Claude Code plugin** around the TestSprite CLI, written after reading the official repo, the CLI/portal docs, the five tutorials, your two skills, your SwiftUI plugin, and the current Claude Code plugin spec.
Nothing in this folder installs, builds, or runs the plugin. **No credits were spent, no cloud project or test was created, no API key was used.** The only things executed were the packaged CLI's `--help` and `--dry-run` (throwaway `HOME`, no key).

## The short version

- **What TestSprite is:** a hosted testing service with a thin client. You describe tests; the cloud runs them against your *reachable* app; you read structured verdicts. Cost is **credits**, not tokens. (doc 01)
- **The plugin is a judgment-and-steering layer**, not a copy of the CLI's docs: 5 skills, 2 subagents, 3 hooks, 3 helper scripts (+1 optional), no MCP, no `commands/`. (doc 05)
- **Flags are never restated.** The CLI shipped 11 releases in the 3 months since the 0.4.0 that your skills pin. Exact commands come from the *installed* CLI at the moment of use, and a flag-trace check keeps the plugin honest. (docs 03, 05, 08)
- **Hooks that earn their place (3):** a tiny `SessionStart` (state + silencing the CLI's "run `testsprite setup`" nag), a `PreToolUse` guard (credit fan-out, deletions, secrets in argv), a soft `Stop` gate (a verdict or "unverified because X"). Eight other hook ideas were rejected, and one justification was **withdrawn** after reading the spec. (doc 06)
- **Fit, honestly:** web frontends and public HTTP APIs: yes. Hosted (HTTP) MCP servers and GraphQL: partial. **stdio MCP servers and CLI tools: not a fit**, and the plugin says so and points to what to do instead. (doc 04)
- **Biggest unknowns** (4 need a ≤ 5-credit spike you must approve): how backend dependency variables are exported, whether `TARGET_URL` is injected, whether auto-heal overwrites stored code, whether Auto Cleanup covers CLI-authored tests. (docs 08, 09)

## Reading order

| File | What you get | Read it if |
|---|---|---|
| `01-how-testsprite-works.md` | Plain-language model, glossary, local vs cloud, the agent loop, FE vs BE, the named features decoded (feature map, auto-heal, dynamic variables, cleanup…), credits vs tokens, two worked examples, your pre-research claims checked | you want to understand TestSprite |
| `02-portal-vs-cli.md` | Capability matrix with exact CLI equivalents, hand-off rules, the docs-site staleness list, contradictions, what the tutorials actually are | you want to know what the plugin drives vs hands off |
| `03-official-skills-and-yours.md` | What the three official skills do, what to keep, where yours fall short, what to borrow (and not) from the SwiftUI plugin | you want the comparison |
| `04-project-type-fit.md` | Detection signals, verdict per project type, test templates (GraphQL, MCP over HTTP), the honest MCP-stdio and CLI-tool answers | you build MCP servers and CLI tools |
| `05-plugin-architecture.md` | File tree, manifest, every skill/agent/helper (purpose, trigger, I/O), context budget, what was left out | you want the design |
| `06-hooks.md` | Each hook: prevents / why not a skill / cost; rejected hooks; the withdrawn justification | you want the steering reasoning |
| `07-workflows.md` | init, audit, verify, CI step by step with the primitive doing each step | you want the flows |
| `08-build-test-risks.md` | Phased build, spikes, how to test the plugin (static, unit, eval, canary), risks, open questions with defaults | you decide go / no-go |
| `09-evidence-ledger.md` | Every claim → source line; the unverified list; corrections log; the flag-trace result | you want to audit the plan |
| `10-execution-plan.md` | How this design becomes the public plugin: guardrails, defaults adopted, waves, steps S0–S12 each with its proof, ledger-row map, fallbacks | you want to follow or challenge the build |
| `sources/` | Read-only snapshots (see `sources/MANIFEST.md`) | you want to check a citation |
| `tools/` | `capture_cli_help.py`, `flag_trace.py`, `build_validation_skeleton.py`, `flag-trace.out.txt` | you want to re-run the checks |

## Evidence tags and source keys

**[V]** read in a primary source in `sources/` (path or line given) · **[I]** my inference or design · **[U#]** unverified, listed in doc 09 §2 with how to close it.

| Key | Path under `sources/` |
|---|---|
| `DOC`, `CHG` | `testsprite-cli/DOCUMENTATION.md`, `testsprite-cli/CHANGELOG.md` |
| `HELP:<cmd>` | `cli-help/<command-path-with-dashes>.txt` (real `--help` of CLI 0.15.0) |
| `DRY:<name>` | `cli-dry-run/<name>.json` (canned `--dry-run` samples) |
| `VERIFY`, `ONBOARD`, `CI` | `testsprite-cli/skills/testsprite-{verify,onboard,ci}.skill.md` |
| `CLID:`, `WEB:`, `LEARN:` | `docs/cli/…`, `docs/web-portal/…`, `docs/learn/…` (docs.testsprite.com, `.md`) |
| `SPEC:` | `claude-code-spec/<page>.md` (code.claude.com, read raw) |
| `MINE-BE`, `MINE-FE` | `yigitkonur-skills/skills/run-testsprite-{backend,frontend}/` |
| `SWUI` | `plugin-swiftui/` |

Source priority when they disagree: packaged CLI help > `DOCUMENTATION.md` > `CHANGELOG.md` > docs site > portal docs > tutorials. (The docs site lags the CLI; see doc 02 §4.)

## Decisions I need from you (defaults in doc 08 §6)

1. **Supersede the three official skills** (recommended) or coexist? (Q1)
2. **May I spend ≤ 5 credits once, on a throwaway project, to close U1–U4/U9?** Nothing runs without your yes. (Q3)
3. Name `testsprite` (gives `/testsprite:init`) described as unofficial. (Q2)
4. Stop gate on by default in linked repos, after a dogfood check. (Q6)
5. Claude Code only, macOS/Linux first. (Q4, Q5)

## What changed my mind while researching (details: doc 09 §4)

- A foreground wait that exceeds Claude's Bash timeout is **moved to the background, not killed**, so one planned hook job (deny foreground waits) was dropped. A different real hazard appeared: TestSprite's exit 1 on a failed test makes Claude Code truncate large output to ~10 KB with no file path.
- The docs site is stale in at least nine specific ways; the repo, changelog, and packaged help are the truth.
- All five "tutorial" pages are video embeds with no code block; three of them are MCP/portal flows, not CLI.
- The SwiftUI plugin's 33 skill descriptions cost ~33 KB of always-on listing; the design here deliberately keeps two.
- My own context-cost estimate was off by ~45% (`plugin details` measured 554 tokens; I had said ~380). I shortened the descriptions and re-measured: **347 tokens**, with a build gate at 400.

## Re-run the checks

```bash
python3 -I tools/capture_cli_help.py   # regenerates sources/cli-help from the packaged CLI (offline, throwaway HOME)
python3 -I tools/flag_trace.py         # exit 1 if any `testsprite …` command or flag in these docs is not in that help
python3 -I tools/build_validation_skeleton.py   # prints a throwaway plugin dir built from the sketches in docs 05/06, then:
#   claude plugin validate <dir> --strict ; claude plugin validate <dir>/skills --strict ; claude plugin validate <dir>/agents --strict
#   cd /tmp && claude --plugin-dir <dir> plugin details testsprite      # always-on tokens + hook inventory
```
