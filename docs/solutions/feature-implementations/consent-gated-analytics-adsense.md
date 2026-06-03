# Consent-gated GA4 + AdSense (GDPR/CCPA banner)

**Date:** 2026-06-03
**Status:** Shipped

## Problem

The site needed Google Analytics 4 and Google AdSense back (PR #98 had removed
both on privacy grounds), but only behind opt-in consent — GA4 and AdSense must
**not** load before the visitor accepts the matching category, to satisfy
GDPR/PECR and CCPA/CPRA. The previous privacy page had twice drifted out of sync
with what actually loaded (todo #004); whatever we shipped had to keep the
privacy page truthful.

## Solution

`vanilla-cookieconsent` v3 (the real npm package — **not** `orestbida-cookieconsent`,
which 404s), **bundled from npm, not a CDN**, to honor the PR #38 decision to
kill third-party CDN dependencies.

### Gating mechanism — native `data-category` script blocking

Tracker tags are emitted as `type="text/plain" data-category="analytics|marketing"`.
The browser treats `text/plain` scripts as inert data and **never executes them
on load**. CookieConsent flips the type to executable only when the matching
category is accepted. This is a *structural* guarantee — there is no public-site
CSP backstop (the CSP in `vercel.json` is scoped to `/admin` only), so the
library's inert-by-default behavior is the entire defense.

This replaced an originally-planned `window.consentGiven(cat)` helper that had a
real bug: v3's `getCookie().categories` is an **array** of accepted category
strings, not a keyed boolean object, so `categories[cat] === true` was always
false → GA4 would never have loaded even after consent. Native gating sidesteps
the helper entirely.

### Where things live

- `src/layouts/BaseLayout.astro` — bundles CookieConsent + CSS, runs the config,
  emits the gated GA4 tags + AdSense loader (IDs from `PUBLIC_GA4_ID` /
  `PUBLIC_ADSENSE_PUB_ID`). The CookieConsent runner is placed **before** the
  gated tags in source order (harmless either way, since the tags are inert).
- `src/components/AdSlot.astro` — CLS-safe (`min-height` reservation), consent-gated
  `<ins>` unit; renders nothing unless both the publisher ID and a slot ID are set.
- `src/layouts/BlogPost.astro` — two `<AdSlot>` placements (top + end of article),
  slots from `PUBLIC_ADSENSE_SLOT_TOP` / `PUBLIC_ADSENSE_SLOT_BOTTOM`.
- `src/components/Footer.astro` — "Cookie preferences" button using v3's native
  `data-cc="show-preferencesModal"` (no `window` global needed), plus a `/privacy` link.
- `public/ads.txt` — `google.com, pub-7103672049879516, DIRECT, f08c47fec0942fa0`.
- `src/pages/privacy.astro` — discloses GA4/AdSense/Vercel by name, GDPR + CCPA
  rights, and withdrawal via the footer control.

## Key invariants

- All consent categories default OFF except `necessary` (`enabled: false`).
- Withdrawal must stay reachable: the footer `data-cc` button re-opens
  preferences after the first choice (GDPR "withdraw as easily as you gave").
- AdSense activation requires three out-of-repo steps: an **approved** AdSense
  account for the pub ID, **created ad units** (slot IDs), and the slot env vars
  set in **both** `.env` and **Vercel** (build-time vars → need a redeploy).

## Gotchas lived through

- **Wrong package name** — `npm install orestbida-cookieconsent` 404s; the package
  is `vanilla-cookieconsent`. Installing a guessed name is a typosquat risk.
- **CSP is admin-only** — the `vercel.json` CSP applies to `/admin`, not public
  pages, so no CSP change was needed (and editing the admin CSP would have been
  wrong). The public site has **no CSP at all** — a separate hardening gap.
- **SRI doesn't apply to GA4/AdSense** — `gtag/js` and `adsbygoogle.js` are
  dynamically generated and unversioned; Google publishes no hashes. `integrity`
  would break them on every Google-side update.
- **`.env` trailing-newline trap** — appending `KEY=val` to a `.env` that lacks a
  trailing newline glues the new var onto the previous line, silently corrupting
  both. Always guard the append (ensure file ends with `\n` first), and verify by
  listing key *names* afterward.
- **`npm run build` fails locally** at the TinaCMS step (missing Tina Cloud creds);
  use `npx astro build` to validate site changes in isolation. Vercel has the creds.

## Verification

Built HTML on a real post page confirmed: GA4/AdSense rendered as `text/plain`
with real IDs, both `adsbygoogle.push()` calls gated `marketing`, **zero**
executable (non-`text/plain`) tracker scripts, `ads.txt` at root, and the
`.ad-slot` `min-height:280px` CLS reservation (inlined into `<head>` by Astro's
`inlineStylesheets: 'auto'`).
