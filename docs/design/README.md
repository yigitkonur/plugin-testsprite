# Design notes

How the `testsprite` plugin was designed, and why. These notes were written before the plugin was built; `10-execution-plan.md` records how they became the code in this repository, including where the build deviated.

The plugin is a **steering layer** for the TestSprite CLI: skills for judgment, subagents for bulky reading, three small hooks for the few things a skill cannot enforce, and three helper scripts for deterministic work. It never restates the CLI's flag surface.

## Reading order

| File | What it covers |
|---|---|
| `01-how-testsprite-works.md` | Plain-language model, glossary, local vs cloud, the agent loop, frontend vs backend, the named features decoded (feature map, auto-heal, dynamic variables, cleanup), credits vs tokens, two worked examples |
| `02-portal-vs-cli.md` | Capability matrix with the exact CLI equivalents, hand-off rules, the docs-site staleness list, contradictions, what the tutorials actually are |
| `03-official-skills-and-yours.md` | What the three official skills do, what was kept, where the author's earlier skills fell short, what was borrowed from the SwiftUI plugin |
| `04-project-type-fit.md` | Detection signals, a verdict per project type, test templates, the honest answers for stdio MCP servers and CLI tools |
| `05-plugin-architecture.md` | File tree, manifest, every skill, agent and helper (purpose, trigger, inputs and outputs), context budget, what was left out |
| `06-hooks.md` | Each hook: what it prevents, why a skill cannot, what it costs; the rejected hooks; a withdrawn justification |
| `07-workflows.md` | init, audit, verify and CI step by step, with the primitive doing each step |
| `08-build-test-risks.md` | Phased build, how the plugin is tested, risks, open questions with defaults |
| `09-evidence-ledger.md` | Every claim traced to a source line; the unverified list; the corrections log |
| `10-execution-plan.md` | How the design became this repository: guardrails, defaults adopted, steps, proofs, deviations |
| `SOURCES.md` | Pins of everything the notes were written from |

## Evidence tags and source keys

**[V]** read in a primary source (path or line given) · **[I]** an inference or design decision · **[U#]** unverified, listed in `09-evidence-ledger.md` §2 with how to close it.

The notes cite a local snapshot directory (`sources/`) that is **not** shipped in this repository (it holds third-party trees). `SOURCES.md` has the commit pins and fetch dates, so each key can be re-fetched.

| Key | Source |
|---|---|
| `DOC`, `CHG` | `DOCUMENTATION.md`, `CHANGELOG.md` of the TestSprite CLI repository |
| `HELP:<cmd>` | the real `--help` of CLI 0.15.0 (the command and flag lists are pinned in `ci/pinned/0.15.0/`) |
| `DRY:<name>` | canned `--dry-run` output of the CLI |
| `VERIFY`, `ONBOARD`, `CI` | the three official skills shipped in the CLI package |
| `CLID:`, `WEB:`, `LEARN:` | docs.testsprite.com CLI, web-portal and learn pages |
| `SPEC:` | code.claude.com plugin, hook, skill and tool documentation |
| `MINE-BE`, `MINE-FE` | the author's earlier `run-testsprite-backend` / `run-testsprite-frontend` skills |
| `SWUI` | the author's SwiftUI plugin (design reference) |

Source priority when they disagree: packaged CLI help > `DOCUMENTATION.md` > `CHANGELOG.md` > docs site > portal docs > tutorials. The docs site lags the CLI (`02-portal-vs-cli.md` §4).

## Decisions made for 0.1.0

The notes ended with open questions and recommended defaults (`08-build-test-risks.md` §6). The build adopted them as listed in `10-execution-plan.md` §1. The ones that matter:

- The plugin **supersedes** the official skills and flags duplicates; it never deletes files it did not write.
- The credit spike that would close U1–U4 and U9 has **not** been run, so backend guidance stays conservative and the MCP-over-HTTP template is tagged experimental.
- The Stop gate ships **off** until its false-positive rate is measured.
- `sprite-run` was not built.

## What changed the design while researching

- A foreground command that outlives Claude's Bash timeout is moved to the background, not killed, so a planned hook job (deny foreground waits) was dropped. The hazard that remained is output size: TestSprite's exit 1 on a failed test makes Claude Code truncate large output to about 10 KB with no file path.
- The docs site is stale in at least nine specific ways; the repository, changelog and packaged help are the truth.
- All five tutorial pages are video embeds with no code block; three are MCP or portal flows, not CLI.
- The SwiftUI plugin's 33 skill descriptions cost about 33 KB of always-on listing; this design keeps two model-invocable skills.
- The context-cost estimate was off by about 45% (`claude plugin details` measured 554 tokens against an estimate of 380); descriptions were shortened and re-measured at 347, with a build gate at 400.
