---
status: pending
priority: p1
issue_id: "004"
tags:
  - code-review
  - security
  - privacy
  - legal
dependencies: []
---

# Privacy policy materially conflicts with site behavior

## Problem Statement

`src/pages/privacy.astro` (shipped 2026-04-27) explicitly claims:

> "no analytics, no email signups, no cookies that identify you, and no third-party trackers"
> "No Google Analytics, no Meta Pixel, no other behavioural trackers"
> "No advertising network. No tracking pixels"

But `src/layouts/BaseLayout.astro` ships **all three** of those things on every page:

- **Google AdSense** — `pagead2.googlesyndication.com/pagead/js/adsbygoogle.js` is loaded conditionally on `PUBLIC_ADSENSE_PUB_ID`. `src/components/AdSlot.astro` renders ad slots in posts.
- **Google Analytics 4 / gtag** — preconnect + script for `googletagmanager.com`
- **Vercel Analytics** — referenced in BaseLayout

In the EU/UK this is a GDPR/PECR violation (false consent basis, no cookie banner). In California it conflicts with CCPA/CPRA "do not sell or share" assertions. Even outside legal jurisdiction, it's a credibility issue if any reader inspects the page.

## Findings

- `src/layouts/BaseLayout.astro:40-58` — AdSense + GTM preconnects + script tags
- `src/components/AdSlot.astro` — renders Google AdSense ad slots inside posts
- `src/pages/privacy.astro:11-46` — claims no analytics/ads/trackers
- Discovered by security-sentinel during the post-session multi-agent code review

## Proposed Solutions

### Option A: Rewrite privacy page to disclose what's actually shipped

- Pros: cheapest, accurate, no behavior change
- Cons: requires accepting that the site has trackers (you may want this — ads pay for hosting)
- Effort: Small (~30 min)
- Risk: Low

### Option B: Remove AdSense + GA + Vercel Analytics

- Pros: makes the existing privacy page truthful; removes tracking weight
- Cons: loses ad revenue (if any) and analytics insight
- Effort: Small (~15 min — remove BaseLayout snippets, delete AdSlot.astro)
- Risk: Low

### Option C: Add a cookie banner + disclosed trackers (full GDPR/CCPA)

- Pros: legally compliant for any jurisdiction
- Cons: nontrivial UX work; consent management adds complexity
- Effort: Medium-Large
- Risk: Low-Medium

## Recommended Action

_To be filled during triage_

## Technical Details

Affected files:
- `src/pages/privacy.astro`
- `src/layouts/BaseLayout.astro`
- `src/components/AdSlot.astro`

## Acceptance Criteria

- [ ] Privacy policy content matches reality of shipped scripts/cookies
- [ ] If keeping trackers: policy discloses each (AdSense, GA4, Vercel Analytics) with what they store
- [ ] If removing trackers: BaseLayout no longer ships those scripts in any condition

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review session multi-agent scan | Privacy page was written assuming a clean-slate site; missed that AdSense + GA were already wired |

## Resources

- `src/pages/privacy.astro`
- `src/layouts/BaseLayout.astro`
- [GDPR Recital 32 (consent)](https://gdpr-info.eu/recitals/no-32/)
