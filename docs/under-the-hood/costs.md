---
id: DOC-014
type: costs
status: active
phase: null
owner: james
tags: [docs-system, build-deploy]
links: [DOC-001]
updated: "2026-07-23"
---

<!-- GENERATED FILE — do not hand-edit.
     Regenerate with: npm run docs:refresh  (scripts/refresh-docs.mjs)
     Hand edits are lost silently. -->

# Costs

Inputs live in `docs/costs.config.json`. Edit that, then `npm run docs:refresh`.

> **⚠️ Everything marked VERIFY is unconfirmed and currently 0.** Nothing below has
> been checked against an actual bill. Treat this as a *model with the numbers
> missing*, not a statement of what this project costs. Fill the config before
> showing this to anyone.

## How this differs from a standard SaaS cost model

**Why:** The specified shape modelled a per-user SaaS (planPriceUsd, unitsPerUserPerMonth, perUserMonthAuth, perUserMonthDb, payment fees, revenue = users x plan). This project has no users, no plan, no auth provider, no database, and takes no payments — see ADR-001. Filling that shape honestly would produce a table of zeros in every column.

**Kept:** The three top-level keys (assumptions, unitCosts, tiers), the rule that assumptions print above the table, and the VERIFY convention so no guess is ever shown as fact.

**Changed:** Tiers are monthly PAGEVIEW levels, not user counts. Revenue is AdSense (RPM-based), not subscription. The main variable cost is Google Places API calls, not per-user infra.

**Dropped:** perUserMonthAuth, perUserMonthDb, paymentPctFee, paymentFlatFee — no auth provider, no DB, no payment processor exists. Re-add them if that ever changes.

## Assumptions

These drive every number in the table. Change them here and the table moves.

| Assumption | Value |
|---|---|
| Monthly pageviews | 0 ⚠️ VERIFY |
| Ad impressions per pageview | 3 (3 slots/post, confirmed in code) |
| Google Places API calls per month | 0 ⚠️ VERIFY |
| Builds per month | 0 ⚠️ VERIFY |
| Minutes per build | 10 (image-heavy; confirmed) |

## Unit costs

| Driver | Rate |
|---|---|
| AdSense revenue per 1,000 pageviews (RPM) | $0.00 ⚠️ VERIFY |
| Google Places, per call | $0.0000 ⚠️ VERIFY |
| Hosting, flat per month | $0.00 ⚠️ VERIFY |
| Domain, per month | $0.00 ⚠️ VERIFY |

## Per-tier model

Tiers are monthly pageviews.

| Monthly pageviews | Variable cost | Fixed cost | Total cost | Revenue | Margin $ | Margin % |
|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 | n/a |
| 10,000 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 | n/a |
| 100,000 | $0.00 | $0.00 | $0.00 | $0.00 | $0.00 | n/a |

**Margin % is `n/a` wherever revenue is 0** — a percentage of zero is undefined,
and printing `0.0%` or `-100%` would imply a measurement that doesn't exist.

## Notes on each input

- **`adImpressionsPerPageview`** — 3 consent-gated AdSense slots per post (top, in-article, bottom). This is a CONFIRMED count from the code, not a guess — but actual impressions are lower, since ads only load after opt-in.
- **`deployMinutesPerBuild`** — ~10 min, driven by 722 MB of committed WebP images. Confirmed in project docs. Not a direct dollar cost on all plans, but it is the real constraint on iteration speed.
- **`adsenseRpmUsd`** — Revenue per 1,000 pageviews. AdSense account was IN REVIEW as of 2026-06; if it never approved, revenue is 0 and should stay 0.
- **`hostingFlatMonth`** — Vercel. UNKNOWN whether this project is on Hobby (free) or Pro. Check the Vercel dashboard.
- **`placesApiPerCall`** — Google Places pricing changes and is tier-dependent with a monthly free allowance. Do not fill this from memory — read the current pricing page and the actual GCP bill.

