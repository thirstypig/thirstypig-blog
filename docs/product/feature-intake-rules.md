---
id: DOC-003
type: intake-rules
status: active
phase: null
owner: james
tags: [docs-system]
links: [DOC-002]
updated: "2026-07-23"
---

# Feature intake rules

The gate a new feature passes **before** it earns a PRD.

**Default answer to a new mid-cycle feature idea is: "not yet — log it in `roadmap.md`."**
That is not obstruction. It's the only thing that keeps a one-person project from
accumulating five half-finished features instead of one finished one.

---

## The five questions

A request must answer all five. An answer of "I don't know" is a valid answer — it just
means the request isn't ready, and the honest move is to log it and move on.

### 1. What problem, for whom?

Name the person and the moment. "A reader landing on a 2011 post who can't tell if the
restaurant is still good" passes. "It would be nice to have comments" does not — that
names a *solution*, not a problem.

### 2. Which metric does it move, and to what number?

State the metric and the target. If it isn't instrumented, say so plainly — an
uninstrumented feature can still be worth building, but you should know going in that you
won't be able to tell whether it worked.

> Precedent: PRD-001 (venue tags) shipped with **zero engagement instrumentation**. Chip
> coverage is countable; whether anyone reads them is not. That was probably fine — but it
> was never a decision, just an omission. Make it a decision this time.

### 3. Does it strengthen the core, or is it periphery?

The core of this project is **the archive: 1,686 recovered posts, browsable and
findable.** Everything else exists to serve that.

Ask directly: does this make the archive more complete, more findable, or more useful? Or
is it a new surface bolted alongside it? Periphery isn't forbidden — but it should be
*known* to be periphery when you choose it.

### 4. What does it cost — to build, and to run?

Both numbers. Build cost is your time. Run cost includes the ones easy to forget:

- API calls (Google Places is metered)
- **Deploy time** — image-heavy deploys already take ~10 minutes against 722 MB of
  committed WebPs; anything touching the image pipeline pays that tax on every push
- Ongoing maintenance when an upstream surface changes (the venue-tag scraper depends on
  a signed-in Google session that can break without warning)

### 5. What are you deferring to fit it?

Time is fixed. If nothing is being deferred, the estimate is wrong. Name the thing that
moves down the list, and say so in the PRD.

---

## What happens after the gate

| Outcome | Action |
|---|---|
| Clears all five | Write a PRD in `docs/product/prds/`. Assign the next `PRD-###`. |
| Clears some | Log it in `roadmap.md` with an ID, and note which question it failed. |
| Clearly periphery | Log it in `roadmap.md`. Revisit when the core is thinner on work. |

**Nothing enters `launch-spec.md` without a PRD that cleared this gate.**

---

## Exemptions

The gate is for *features*. It does not apply to:

- Bug fixes
- Content work — importing, enriching, tagging posts
- Dependency and security updates
- Documentation

If you're unsure whether something is a feature or maintenance: if it adds a new thing a
reader can see or do, it's a feature.
