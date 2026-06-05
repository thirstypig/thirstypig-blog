---
status: complete
priority: p2
issue_id: "047"
tags:
  - security
  - analytics
  - ads
  - code-review
dependencies: []
---

# `set:html` in BaseLayout Interpolates Unvalidated Env Vars

## Problem Statement

`BaseLayout.astro` constructs a raw HTML string by interpolating `ga4Id` and `adsenseId` directly, then injects it via `<Fragment set:html={trackerTags} />`. `set:html` deliberately bypasses Astro's XSS escaping. If a Vercel env var is ever malformed or sourced from a misconfigured secret, a bad value would produce broken or injectable HTML on every page of the site.

Runtime risk is low (env vars are build-time constants), but this is a footgun pattern worth closing.

## Findings

In `src/layouts/BaseLayout.astro`:
```ts
const ga4Id = import.meta.env.PUBLIC_GA4_ID;
const adsenseId = import.meta.env.PUBLIC_ADSENSE_PUB_ID;
// ... trackerTags = `<script ...>${ga4Id}...</script> <script ...data-ad-client="${adsenseId}"...>`
// ... <Fragment set:html={trackerTags} />
```

If `PUBLIC_GA4_ID` contains `"` or `>`, the injected HTML is broken. If a CI misconfiguration pointed to a compromised secret, the value could inject arbitrary HTML into `<head>` on every page.

## Proposed Solutions

### Option A: Add format-validation gates before interpolation (Recommended)

```ts
const rawGa4 = import.meta.env.PUBLIC_GA4_ID;
const rawAdsense = import.meta.env.PUBLIC_ADSENSE_PUB_ID;
const ga4Id = /^G-[A-Z0-9]+$/.test(rawGa4 ?? '') ? rawGa4 : null;
const adsenseId = /^ca-pub-\d+$/.test(rawAdsense ?? '') ? rawAdsense : null;
```

Then use `ga4Id`/`adsenseId` (which are null if malformed) in the `trackerTags` construction. A malformed value produces no tracker tags rather than broken HTML.

- **Effort:** XS (2 lines)
- **Risk:** None — the valid formats are stable (G- prefix for GA4, ca-pub- for AdSense)

### Option B: Use Astro template interpolation instead of set:html

Restructure tracker injection using Astro's native `<script define:vars>` or `is:inline` patterns with explicit attribute binding, which gets Astro's auto-escaping.

- **Effort:** Medium (requires restructuring the tracker tag pattern)
- **Risk:** Low but more invasive

## Recommended Action

Option A — two regex checks, merged immediately alongside todo #046.

## Technical Details

**Affected file:** `src/layouts/BaseLayout.astro`

## Acceptance Criteria

- [ ] A malformed `PUBLIC_GA4_ID` (e.g., containing `"` or `>`) does NOT produce broken HTML
- [ ] Valid `G-JVG4TB1BR4` format passes the regex and renders normally
- [ ] Valid `ca-pub-XXXXXXXXXX` format passes and renders normally
- [ ] Build does NOT throw on missing env vars (null-safe path)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-06-05 | Identified by security-sentinel during code review | `set:html` is a footgun when used with non-literal content; validation is cheap insurance |
