# Venue tags MVP

**Status: validated 2026-04-27. 5/5 MVP venues captured. Pivoted from raw-N-gram extraction to scraping Google's pre-computed topic chips.**

A per-venue tag system. Scrapes the **"Refine reviews" topic chips** from
Google Maps place pages (with mention counts), outputs JSON consumable by
both thirstypig.com (via per-venue files served from `/public/venue-tags/`)
and tastemakers-ios (via the same URLs over CORS).

## What's here

| File | Purpose |
|------|---------|
| `venues.yaml` | Slice MVP venue list — 1 each from Austin, LA, NYC, Shanghai, Taipei |
| `scrape_google.py` | Playwright scraper. **Currently broken**: blocked by Google's signed-in-only Reviews gate. See "Path forward" below |
| `probe_url.py` | One-off debug script that proved `?api=1&query=` redirects nowhere; the working URL form is `?q=` (gitignored) |
| `data/{key}_validation.json` | Validation captures from the 2026-04-27 MCP-browser run — one per MVP venue |
| `venv/`, `.chrome-profile/` | Python venv + Chrome user-data-dir (both gitignored) |

## What we learned (the pivot)

The original plan was to scrape raw review text and run our own N-gram
extraction over it. While debugging selectors we discovered something
better: **Google already does the extraction for us.**

Every place page has a "Refine reviews" radiogroup like:

```
brisket (2,142)  ·  pork ribs (288)  ·  long lines (287)
potato salad (218)  ·  pulled pork (208)  ·  texas bbq (90)  ·  ...
```

These are weighted, deduplicated, locale-translated, and cleanly split
into food vs. experience semantics. Scraping them is dramatically simpler
than running our own N-gram pipeline, and the output is *better* —
Google's clustering is more accurate than naive frequency counts.

**So `extract_tags.py` is no longer needed.** The "tags" are the chips.

## Validation results (5 MVP venues)

| Venue | Chips | Top mention | Notes |
|---|---|---|---|
| Franklin BBQ Austin | 10 | brisket (2,142) | Strong food + experience signals |
| Katz's Deli NYC | 10 | pastrami (9,550) | Highest signal density |
| Canter's Deli LA | 10 | pastrami (143) | Includes "people watching" — captures place identity |
| Wulao Hotpot Taipei | 10 | spicy hot pot (117) | Chips translated to English; signature dishes (ice cream tofu, mandarin duck hot pot) all surface |
| 鹿港小镇 Shanghai | 5 | bingsu (5) | **Thin** — mainland China has sparse Google reviews. One chip ("Serves dessert") leaked from Google's amenity-attribute widget |

Conclusion: the chip approach works strongly for venues with ≥hundreds of
reviews and degrades gracefully (but un-usefully) below ~50 reviews. For
mainland China venues, supplement with a different source if needed (or
skip — Google has thin coverage there because Google services are blocked).

## The auth wall (what we can't avoid)

Cold/anonymous browsers see Google's "limited view" of Maps — no Reviews
tab, no chips. The fix isn't anti-bot fingerprint masking (we tried
`playwright-stealth` + real Chrome channel + persistent profile — all
unblocked the place card but not the Reviews UI). The gate is **session
trust**, specifically signed-in-Google-account state.

## Phase 1: validated via MCP browser (done 2026-04-27)

We drove the Playwright MCP browser (which inherits the user's
signed-in Google session) through all 5 MVP venues and captured chips
into `data/{key}_validation.json`. Answered the "are the chips
insightful?" question — yes.

## Phase 2: signed-in headless scraper (current)

Two files:
- `bootstrap_profile.py` — one-time, opens Chrome non-headless so you
  sign in to Google. Saves cookies/state to `.chrome-profile/`.
- `scrape_google.py` — headless, reads `venues.yaml`, writes
  `data/{key}_chips.json` per venue.

### One-time bootstrap

```bash
scripts/venue-tags/venv/bin/python scripts/venue-tags/bootstrap_profile.py
```

This launches **real Chrome** (not Playwright) pointed at
`.chrome-profile/`. Sign in to Google there. Why: Google's sign-in
flow detects Playwright's automation flags and shows "Connection not
secure" if you try to sign in inside an automated browser. Real Chrome
sets the cookies, then Playwright reads them on subsequent headless
runs.

Sign in with whatever Google account you're comfortable using for
automated Maps browsing (a non-primary account is safer — small ToS
risk). Optionally visit google.com/maps + a place page to warm cookies.
Close the window when done.

### Scraping

```bash
# All MVP venues from venues.yaml
scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py

# Just one venue (useful after a Google UI change)
scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py \
  --venue franklin-bbq-austin

# Ad-hoc venue not in venues.yaml
scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py \
  --query "Tatsu Ramen Sawtelle" --key tatsu-ramen-sawtelle

# Show the browser (debug)
scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py --headed
```

### Output schema

```json
{
  "key": "franklin-bbq-austin",
  "query": "Franklin Barbecue Austin TX",
  "place_id": "0x8644b5a4ae3bcc33:0x31aba8abf8f64c84",
  "venue_name": "Franklin Barbecue",
  "final_url": "https://www.google.com/maps/place/...",
  "tab_labels": ["Overview of ...", "Menu", "Reviews for ...", "About ..."],
  "chips": [
    {"label": "brisket", "mention_count": 2142},
    ...
  ],
  "scraped_at": "2026-04-27T..."
}
```

### Failure modes

- **"page has no Reviews tab or chips — looks like Google's 'limited
  view'"** → cookies expired or profile got logged out. Re-run
  `bootstrap_profile.py`.
- **0 chips, but Reviews tab present** → low-coverage venue (typical for
  mainland China). Output is written anyway; downstream code should
  handle empty `chips`.
- **Chip starts with capital letter (e.g. `Serves dessert`)** → already
  filtered. Logged as "dropped amenity-like chips: [...]" so you can
  spot if Google changes the widget shape.

## Out of scope

- Yelp / TripAdvisor / Dianping scrapers (not needed if chips work)
- Integration into thirstypig.com post pages or tastemakers-ios
- Refresh cadence for stored chip data
