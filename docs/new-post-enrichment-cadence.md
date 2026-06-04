# New-Post Enrichment Cadence

When new posts land (Instagram sync, or any new content), importing them is only
**step 1**. Address, map link, and Google Places venue tags come from a separate
enrichment pass. This runbook is that pass — run it after every import so new
posts reach parity with the rest of the blog.

## What a fully-enriched post has

| Field | Source | Drives |
|---|---|---|
| `title`, `pubDate`, `images`, `tags`, `city`, `region` | importer (caption heuristics) | the post itself |
| `location` (venue name) | **manual / title** (see step 2) | required key for everything below |
| `placeId` | venue-tags pipeline (Google Places) | `<VenueTags>` chips + Google Maps link |
| `address`, `coordinates` | geocoding | `LocationCard` ("View on map" / "Directions") |

A freshly-imported post has only the first row. The rest is this cadence.

## Step 1 — Import

- Production: create a GitHub release tagged `ig-*` with the export ZIP → `instagram-sync.yml` runs `sync_pipeline.py`.
- Local: `python scripts/instagram/sync_pipeline.py <export.zip>` (note: the `--dry-run` flag is NOT honored by `import_instagram.py` — it writes regardless; preview against the live blog instead of trusting it).

Imported posts have `city`/`region` from captions but **no reliable `location`, no address, no coordinates, no `placeId`**.

## Step 2 — Set `location` (venue name) + verify `city`  ← the easy-to-forget prerequisite

`curate_candidates.py` **skips any post missing `location` or `city`** (see its
`if not loc or not city: continue`). The importer's caption parser sets `location`
on only a minority of posts (2 of 7 in the June 2026 batch), so the rest are
**invisible to venue-tagging until you set it**.

For each new post, set `location:` to the venue name (from the title) and sanity-check
`city:`. Example: title "Stinky tofu at Tofu King in Arcadia" → `location: Tofu King`,
`city: Arcadia`. Watch for the importer mis-grabbing a nearby phrase as the venue
(June batch: Basqueria was tagged `location: Surf Canyon`).

## Step 3 — Google Places venue tags (chips + Maps link)

Run from `scripts/venue-tags/` (see `project_venue_tags` memory + `YELP.md`):

```bash
python curate_candidates.py --min-posts 1 --limit 200   # untagged (location,city) → review, filter junk, append to venues.yaml
python lookup_place_ids_api.py --apply                   # Google Places resolves place_id / cid into venues.yaml
python scrape_google.py --new-only                       # scrape chips — HEADED Playwright, needs a signed-in Google session
python publish.py                                        # chip JSON → public/venue-tags/{place_id}.json
python sync_post_placeids.py --apply                     # inject placeId into matching post frontmatter
```

Notes:
- `scrape_google.py` needs a trusted (signed-in) Google session — run `bootstrap_profile.py` once; use `--check-auth` to pre-flight before a batch. Headed mode only.
- This is the **authoritative** venue source (CLAUDE.md: "Venue tags via Google Places API only").

## Step 4 — Address + coordinates (LocationCard)  — optional / decide per batch

The only current writer of `address`/`coordinates` to post frontmatter is
`scripts/lookup_addresses.py` (**Foursquare**), which has a documented history of
returning confidently-wrong matches on ambiguous queries (geocoding-autofill
contamination). It's also the path CLAUDE.md says is being replaced by Google Places.

Options:
- **Skip** (default for clean imports): the Google Places chips from step 3 already
  give a Maps link; the `LocationCard` just won't render until address/coords exist.
- **Run with review**: `python scripts/lookup_addresses.py --limit 50`, then inspect
  every result before committing (do not bulk-trust it).

## Step 5 — Verify + commit + deploy

- `npx astro build` (validates content schema; confirms `<VenueTags>` + `LocationCard` render).
- Commit posts + `public/venue-tags/*` + `venues.yaml`; push → Vercel deploys (~10 min, image-heavy).

## Gotchas captured

- **Dedup on re-sync**: `import_instagram.py` dedups Instagram posts by **date** (titles
  drift to "Venue, City" after enrichment; pubDate becomes a full datetime). See
  `scripts/instagram/test_import_instagram.py`.
- **`location` prerequisite** (step 2) is the single most-forgotten step — without it,
  new posts never enter the venue-tags funnel.
- **WebP**: the importer copies JPGs only; generate sibling `.webp` (sharp, quality 80)
  so the image plugin emits `<picture>` — otherwise posts ship unoptimized (plain `<img>`).
