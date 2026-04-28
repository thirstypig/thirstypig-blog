# Yelp scraping — paused 2026-04-27

We started building Yelp as a second chip source alongside Google, hit
PerimeterX-grade anti-bot, got our IP blocked, and paused. This file
captures what we learned so resumption (once the IP block lifts, or
from a different network) is fast.

## Why Yelp is worth doing

Yelp's "Popular Dishes" widget gives us *granular menu items*, not just
broad topic chips. For Franklin BBQ, Google chips were `brisket (2,142)`.
Yelp distinguishes Lean Brisket / Fatty Brisket / Beef Brisket / Burnt
Ends / Beef Rib — each with explicit photo + review counts. Strictly
richer signal than Google's clustered chips.

## What we confirmed (via MCP browser, 2026-04-27)

- **Yelp biz URLs** look like `https://www.yelp.com/biz/{slug}` (e.g.
  `franklin-barbecue-austin`). Yelp normalizes the slug server-side —
  `franklin-barbecue-austin-2` redirects to `franklin-barbecue-austin`.
- **Popular Dishes section** is present on biz pages and contains
  ~10–15 dishes per venue, each rendered as a card with:
  - `<img alt="{dish name}">` for the dish
  - text content of shape `"{dish name}{photo_count} Photos {review_count} Reviews"`
  - container class `dishPassport__09f24__j2dob` (hash suffix rotates;
    use `[class*="dishPassport"]` for partial-match resilience)
- **"What's the vibe?"** is *not* a chips widget — it's a photo-collection
  navigator (Inside / Outside / All). Skip it.
- **No "Refine reviews" or topic-chip equivalent.** Popular Dishes is the
  only chip-shaped data Yelp exposes.

## Why it failed in this session

Two compounding gates:

1. **Session trust** — fresh Playwright sessions look suspicious. The
   MCP browser worked because it inherited James's daily Chrome cookies
   + history. A clean `launch_persistent_context` doesn't.
2. **IP rate-limiting** — running a slug-lookup script that hit 5 search
   URLs in ~10 seconds tripped Yelp's IP filter. We got a hard "You have
   been blocked" page (PerimeterX). IP-level, not session-level — even
   the warm MCP browser stopped working from this IP.

The session-trust gate has the same fix as Google did: bootstrap a real
Chrome profile, browse Yelp manually for a few minutes, then use that
profile in headed Playwright. The IP block is the new wall — it doesn't
care about session trust.

## Resumption playbook

When you come back to this:

1. **Wait for the IP block to lift.** Usually 12–24 hours. Confirm by
   visiting `https://www.yelp.com/biz/franklin-barbecue-austin` in your
   regular Chrome — if you see review content, the block is gone.

2. **Bootstrap a Yelp profile** in real Chrome (no Playwright). Same
   pattern as `bootstrap_profile.py` for Google, but pointed at
   `yelp.com` instead of `accounts.google.com`. **No sign-in required**
   — Yelp serves data to logged-out users; we just need session warmth.
   Browse a handful of biz pages (search, click results, scroll
   reviews) for ~5 min. Close.

3. **Build `scrape_yelp.py`** parallel to `scrape_google.py`:
   - URL pattern: `https://www.yelp.com/biz/{yelp_slug}`. Add a
     `yelp_slug` field to `venues.yaml` (optional, like `place_id`).
   - Wait for `[class*="dishPassport"]` to render.
   - For each dish card:
     - `dish_name = card.querySelector('img').alt`
     - `text = card.innerText.replace(dish_name, '').trim()`
     - regex: `/(\d+)\s*Photos?\s+([\d,]+)\s*Reviews?/i` → `(photo_count, review_count)`
   - Output `data/{key}_yelp.json` with chips array of
     `{label, photo_count, review_count}`.
   - **Rate limit**: ~30s between requests. Don't burst.
   - Headed by default (same reason as Google scraper).

4. **Skip Yelp search resolution.** It's gated harder than biz pages.
   Pre-fill `yelp_slug` in `venues.yaml` manually (look up each
   venue's slug in your real Chrome, copy from URL). For our 5 MVP
   venues:
   - `franklin-bbq-austin` → `franklin-barbecue-austin`
   - `canters-deli-la` → unknown (Yelp has multiple Canter's locations
     in LA; pick the Fairfax one)
   - `katzs-deli-nyc` → likely `katzs-delicatessen-new-york-3`
   - `bellagio-shanghai` → may not exist (Yelp coverage in mainland
     China is near-zero; skip if 404)
   - `wulao-hotpot-taipei` → may not exist (Yelp coverage in Taiwan
     is thin; skip if 404)

5. **Update `publish.py`** to merge Google + Yelp data. Suggested
   schema: keep `chips` as Google's array (no source field needed —
   Google is implicit), add `yelp_dishes: [{label, photo_count,
   review_count}]` as a separate top-level array. Distinct shapes
   keep the consumers simpler than a unified-but-source-tagged array.

6. **Update `VenueChips.astro`** to render a second section when
   `yelp_dishes` is present. Source attribution becomes
   "Popular phrases from Google Maps reviews; popular dishes from Yelp".

## Block diagnostic (in case it happens again)

Symptoms:
- Page title returns "yelp.com" (no venue name)
- `<h1>` element absent
- Body text empty or shows "You have been blocked."

Yelp shows a unique block ID on the page (e.g.
`b1addc1a-5f95-6d1a-88c9-b690244b7e69`) — they want you to submit
feedback. Don't bother; the block will lift on its own.

## Out of scope

- **Yelp Fusion API** — free tier only gives 3 review excerpts per
  business. No Popular Dishes. Also requires partner approval for
  most useful endpoints. Not worth the integration cost.
- **Residential proxies** — would defeat the IP block but cost
  $50-200/mo. Not justifiable for a personal blog.
- **Dianping / OpenRice / Tabelog** — alternatives for the international
  venues Yelp doesn't cover. Each is its own scraper project.
