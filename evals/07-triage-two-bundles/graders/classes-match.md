---
type: llm
---

Ground truth: bundle-a is a PLAN DEFECT (the plan's "checkout button" step was ambiguous, the agent clicked "Continue shopping" repeatedly, recorded 4 of 9 planned actions, a bare "element is visible" assertion, steps skipped). The app is fine. bundle-b is an APP BUG (all 6 steps ran as planned; after save and reload the display name is the old value and the field is read-only).

PASS if the reply classifies bundle-a as a plan/test defect (not an app bug) AND bundle-b as an app bug (not a plan defect), each with at least one concrete piece of evidence from that bundle.
FAIL if either class is swapped, hedged to inconclusive, or has no evidence.
