# Venue tags MVP

**Status: WIP scaffolding — scraper has NOT been run against live Google Maps yet.**

A planned per-venue tag system. Scrapes Google Maps reviews, extracts emergent
keywords + classifies into a curated taxonomy, outputs JSON consumable by
both thirstypig.com (via per-venue files served from `/public/venue-tags/`)
and tastemakers-ios (via the same URLs over CORS).

## What's here

| File | Purpose |
|------|---------|
| `venues.yaml` | Slice MVP venue list — 1 each from Austin, LA, NYC, Shanghai, Taipei |
| `taxonomy.yaml` | Curated tag categories with keyword phrases for classification |
| `scrape_google.py` | Playwright-based Google Maps reviews scraper |
| `data/` | Raw scraped JSON output per venue (gitignored) |
| `venv/` | Python venv with playwright + pyyaml (gitignored) |

## Decisions baked in (from session 2026-04-27)

- **DIY scraping** (no paid services) — accepts ToS gray area, periodic
  selector maintenance when Google changes its DOM
- **Hybrid tag model** — emergent N-grams + curated taxonomy
- **Join key = Google place_id** — consistent with existing geocoding pipeline,
  works for both thirstypig.com and tastemakers-ios
- **UI integration** — tags appear on individual post pages on thirstypig.com
- **MVP scope** — slice MVP first: 5 venues, eyeball output, decide if useful
  before scaling

## Next steps (where to pick up)

1. **Run the scraper against Franklin BBQ** to validate selectors:
   ```bash
   cd ~/Projects/thirstypig
   scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py \
     --query "Franklin Barbecue Austin TX" --key franklin-bbq-austin --debug
   ```
   The `--debug` flag opens a non-headless browser AND saves a screenshot +
   DOM dump to `data/franklin-bbq-austin_*` so you can inspect the live page.

2. **Iterate selectors.** Google Maps' class names rotate every few months.
   Most likely points of failure:
   - `div[data-review-id]` (used for review cards) → may need to fall back to
     class-based selectors like `.jftiEf`
   - The "Reviews" tab click — try `get_by_role("tab", name="Reviews")` first,
     then text-based fallback
   - Scroll container detection — currently picks the last `tabindex="-1"`
     div in the side panel

3. **Build `extract_tags.py`.** Reads `data/{key}_raw.json`, computes:
   - **Emergent tags**: top-N N-grams (1, 2, 3-gram) by frequency, with
     stopword filtering
   - **Curated tags**: hit ratio per category from `taxonomy.yaml`
   Writes to `public/venue-tags/{place_id}.json` (or similar).

4. **Eyeball one venue's output** before scaling to all 5. The riskiest
   unknown is "do these tags actually look insightful or just noisy?" —
   answer it on Franklin BBQ before automating.

## What's NOT here yet

- Yelp scraper (deferred — Yelp blocks aggressively, and 4 of 5 MVP venues
  are international where Yelp coverage is thin)
- Keyword extractor (`extract_tags.py`)
- API endpoint or static-file output for the JSON consumers
- Integration into thirstypig.com post pages
- Integration into tastemakers-ios

## Why this branch was committed before validation

Session ran long; we paused at "files written, not yet run" to /clear and
resume in a fresh session. This README + the in-script docstrings carry the
context forward.
