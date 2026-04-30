---
title: "Google Maps cid→FID self-healing scrape — silent extraction failure on ?cid= URLs"
date: 2026-04-30
tags:
  - google-places-api
  - google-maps
  - playwright
  - scraper
  - venue-tags
  - regex
  - silent-failure
  - timing
components:
  - scripts/venue-tags/scrape_google.py
  - scripts/venue-tags/lookup_place_ids_api.py
  - scripts/venue-tags/venues.yaml
  - scripts/venue-tags/test_lookup_place_ids_api.py
problem_type: integration-issue
severity: high
status: resolved
prs:
  - "#96"
---

## Problem

The new Places API (PR #96) returns `?cid=<decimal>` URLs for the majority of
queries — the FID hex format (`0x...:0x...`) used elsewhere in the pipeline
appears in `googleMapsUri` only ~5% of the time. The pipeline plan was: when
the API gave us only a cid, navigate to `https://www.google.com/maps/place/?cid=N`
in headed Chrome and let the page's JS-driven redirect bring us to the
canonical `/maps/place/Name/data=…!1s0x…:0x…` URL, where `EXTRACT_JS` would
pick up the FID from `location.href`.

That plan worked locally on isolated tests but failed silently when run as a
98-venue batch. Symptoms:

- 98 chip JSONs successfully written to `scripts/venue-tags/data/`
- Every JSON had `place_id: null` and `final_url:
  "https://www.google.com/maps/place/?cid=<N>"` (URL never rewrote)
- `_writeback_place_id()` never fired (it only runs when extraction succeeds)
- `publish.py` skipped all 98 with `SKIPPED <key> (no place_id)` — public
  JSONs not written, posts couldn't get tagged
- Net output: hours of scrape time produced zero user-visible value

Failure mode is "succeeds but does nothing": no exception, no error log,
no signal in CI. The only way to notice is to count downstream artifacts.

## Investigation

### What didn't work

- **Longer page wait** — bumped `wait_for_timeout` 2500 → 4000ms.
  Single-venue retest succeeded; production batch still failed. Page state
  varies between runs.
- **Suspecting session trust** — the bootstrapped Chrome profile is signed
  in. Re-running `bootstrap_profile.py` didn't help; the profile state was
  fine.
- **Searching `document.body.innerHTML`** — looked for `0x...:0x...` raw hex
  pairs in HTML. Found one match (`0x0:0x<cid>`), but the upper half was
  zero — only the cid encoded as hex, not the real FID.

### What surfaced the cause

Manual Playwright session, navigating to the same `?cid=N` URL, evaluated:

```js
() => {
  const links = Array.from(document.querySelectorAll('a[href*="0x"]'))
    .slice(0, 3)
    .map(a => a.href);
  return links;
}
```

The first link returned was Maps' sign-in continuation URL:

```
https://accounts.google.com/ServiceLogin?...continue=https%3A%2F%2Fwww.google.com%2Fmaps%2Fplace%2F%25E9%2598%25BF...%2F%4031.21%2C121.46%2C17z%2Fdata%3D!3m1!4b1!4m6!3m5!1s0x35b2700b6dd01297%3A0x3403c5e1c645dd29!8m2!...
```

The FID is right there: `1s0x35b2700b6dd01297%3A0x3403c5e1c645dd29` —
URL-encoded, with `:` percent-encoded as `%3A`. Maps renders this sign-in
link unconditionally (signed-in or not), so it's a reliable extraction
surface even when `location.href` never rewrites.

A second test confirmed that with a longer wait (~4s), `location.href`
sometimes rewrites to the canonical `/maps/place/Name/data=…!1s…` form too —
but unreliably, hence the production batch's silent failure.

## Root cause

Two compounding issues:

1. **Maps' URL rewrite from `?cid=N` to `/maps/place/.../data=…!1s…` is
   timing-dependent.** The 2500ms wait was below the threshold for many
   venues, so `EXTRACT_JS`'s regex on `location.href` returned `null`.
2. **The original extraction regex only checked `location.href`.** When
   Maps left the URL at `?cid=N`, there was no fallback path to recover the
   FID from elsewhere on the page — even though it's embedded in
   sign-in/share anchors in URL-encoded form.

The combination produces silent failure: the page LOADS the place (chip
data extraction succeeds), but the URL identity of that place can't be
recovered, so the data has nowhere to go in the publishing layer.

## Fix

`scripts/venue-tags/scrape_google.py`:

### 1. Longer wait when arriving via cid

```python
log(f"  → {url}")
page.goto(url, wait_until="domcontentloaded")
page.wait_for_timeout(2500)
# cid loads need extra time for Maps to rewrite the URL into the
# /maps/place/Name/data=…!1s0x…:0x… form that contains the FID hex.
# Without this, FID extraction silently falls back to None.
if cid and not place_id:
    try:
        page.wait_for_url("**/maps/place/**/data=**", timeout=5000)
    except Exception:
        page.wait_for_timeout(2000)
```

### 2. Multi-stage FID extraction in `EXTRACT_JS`

```js
// FID hex pair extraction. Three search surfaces in priority order:
//   1. location.href — present when navigated via ?ftid= or after a
//      /maps/place/Name/data=…!1s redirect.
//   2. Anchor hrefs — present in URL-encoded form (`1s0x…%3A0x…`)
//      inside the sign-in continuation link, which Maps renders even
//      when the page URL stays at ?cid=N. This is the path that makes
//      cid-driven scrapes self-healing.
//   3. Anywhere in document HTML — last resort.
const fidPattern = /(?:!1s|ftid=)(0x[0-9a-f]+:0x[0-9a-f]+)/;
const fidEncPattern = /[!1]?1s(0x[0-9a-f]+)%3A(0x[0-9a-f]+)/i;
let placeIdMatch = location.href.match(fidPattern);
if (!placeIdMatch) {
  for (const a of document.querySelectorAll('a[href*="1s0x"]')) {
    const m = (a.getAttribute('href') || '').match(fidEncPattern);
    if (m) { placeIdMatch = [m[0], `${m[1]}:${m[2]}`]; break; }
  }
}
if (!placeIdMatch) {
  const m = (document.documentElement.outerHTML || '').match(fidPattern);
  if (m) placeIdMatch = m;
}
```

### 3. Self-healing writeback

Already present in `scrape_google.py`: when the scraper extracts a FID from
a venue that previously only had `cid` in venues.yaml, `_writeback_place_id()`
injects the FID back into the YAML. Future runs of the same venue navigate
via `?ftid=<FID>` directly, skipping the cid resolution dance entirely. So
each venue pays the timing/anchor-extraction cost exactly once.

## Verification

After the fix, re-running the failed 93-venue batch:

- 89 venues: `location.href` rewrite succeeded within the bumped timeout
- 4 venues: anchor-href fallback fired (sign-in link extraction)
- 0 venues: failed FID extraction (vs. 93 silent failures previously)
- venues.yaml now self-healing for all future runs

End-to-end: 65 → 336 venues with FID across batches 6/7/8, 123 → 439 tagged
posts on the live site.

Unit tests in `scripts/venue-tags/test_lookup_place_ids_api.py` lock down
the API-side parsers (`extract_fid_hex`, `CID_RE`, `FID_HEX_RE`,
`write_yaml_field`) — 16 tests, runs in <0.1s.

## Prevention

### What to do at code time

1. **Never trust `location.href` as the sole identity surface for SPA
   pages.** Modern web apps (Google Maps, Twitter, LinkedIn) rewrite URLs
   asynchronously after data loads. If you need to extract an identifier
   embedded in the URL, also scan anchor hrefs and inline JSON.

2. **Three fallback surfaces for SPA URL extraction**, in order:
   - `location.href`
   - Anchor `href` attributes (handle URL-encoded forms — e.g. `%3A` for
     `:`)
   - Full `documentElement.outerHTML` regex scan (last resort, expensive)

3. **Tag silent-fail-class code with explicit assertions.** Whenever a
   pipeline step's output can be "I succeeded but produced nothing
   actionable", emit a count or error to surface the no-op. Our
   `_writeback_place_id()` does this via the log line; downstream
   `publish.py` does this via `SKIPPED` per file.

### What to do at run time

Every batch should print summary counts that distinguish:
- successes (place_id newly written)
- limited-view failures (legit — Google has no chip data)
- extraction failures (illegitimate — should be 0; if not, regress test)

If extraction failures > 0, the silent-fail mode has returned and you
should investigate before shipping the batch.

### Tests added

`scripts/venue-tags/test_lookup_place_ids_api.py` — 16 unit tests covering
the four parsing/writeback functions in `lookup_place_ids_api.py`. The
module is importable without Playwright, so tests run in plain CI Python
(no browser deps). The scraper-side `_writeback_place_id()` is not tested
directly because importing `scrape_google.py` requires Playwright; the
`write_yaml_field` tests cover the same regex shape.

## Related

- `feedback_pre_staged_tests.md` (memory) — the "scrape produced 98 files
  with null place_id" pattern is the same shape as the pre-staged-tests
  problem: data-dependent operation that succeeds-as-no-op when its data
  preconditions aren't met.
- `docs/solutions/api-migration/google-places-migration-and-data-repair.md` —
  prior Places API integration work (Foursquare → Google Places); this doc
  is the next chapter in the same arc.
- `scripts/venue-tags/README.md` — venue-tags pipeline overview.
