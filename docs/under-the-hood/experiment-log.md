---
id: DOC-018
type: experiment
status: active
phase: null
owner: james
tags: [docs-system, venue-tags]
links: [PRD-001]
updated: "2026-07-23"
---

# Experiment log

Closes the loop on PRD hypotheses. **A PRD states a bet; this is where the bet gets
settled.** Without it, every hypothesis stays permanently "we believe…" and you never
find out whether you were right.

Each entry gets an `EXP-###`, links to the PRD it tests, and ends with a result:
`pending` · `confirmed` · `refuted` · `inconclusive` · `abandoned`.

**`inconclusive` and `abandoned` are honest results.** An experiment that couldn't be
measured is data about your instrumentation, and it should be recorded as such rather than
quietly dropped.

---

## EXP-001 — Do venue chips make old posts more useful?

| | |
|---|---|
| **Links** | PRD-001 |
| **Hypothesis** | Showing what a venue is *known for* makes an old archive post useful for deciding whether to go today — turning a diary entry into a recommendation. |
| **We're wrong if** | Readers ignore the chips entirely, or the chips are so generic ("good food", "friendly staff") that they add nothing over the post text. |
| **Result** | **`inconclusive` — cannot be measured.** |

**Why inconclusive rather than pending:** the feature has shipped to 1,022 posts, so
there's been ample opportunity to learn — but `VenueTags.astro` emits **no analytics
event**. No click tracking on the city pill, no impression count. GA4 exists but is
consent-gated and carries no venue-tag events. There is no instrument, so there is no
reading, and waiting longer will not produce one.

**What we *can* say:** coverage is 48.0% (1,022 / 2,127), 766 venues published, 107
cities. That measures *delivery*, not *value* — a distinction worth keeping sharp.

**To make this measurable:** one event on chip render and one on chip click, gated behind
the existing `analytics` consent category. Cheap. Not currently on the roadmap.

<!-- TODO(james): decide whether this is worth instrumenting at all. For a personal -->
<!-- archive with no growth target, "I like that it's there" may be a legitimate and -->
<!-- sufficient answer — but that should be a decision, not a gap. -->

---

## EXP-002 — <!-- next experiment -->

<!-- Prompt-to-self: template. -->
<!-- | Links | PRD-### | -->
<!-- | Hypothesis | We believe X will cause Y | -->
<!-- | We're wrong if | the falsifiable condition — fill this in BEFORE shipping | -->
<!-- | How measured | the actual instrument, named. "We'll see" is not a measurement. | -->
<!-- | Result | pending | -->

*(none yet)*

---

## Lessons

- **PRD-001 shipped with no instrumentation, and that was never a decision** — just an
  omission. The feature-intake gate (DOC-003, question 2) now forces the question up
  front: name the metric, or state plainly that you're choosing not to measure.
