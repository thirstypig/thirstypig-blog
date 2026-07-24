---
id: DOC-021
type: guide
status: active
phase: null
owner: james
tags: [instagram, venue-tags, admin, photo-import]
links: [DOC-020, PRD-001]
updated: "2026-07-23"
---

# Pipeline operations

How the Instagram sync and venue-tags scraping pipelines actually work, and how to
read their current state.

> **Recovered content.** This was the operator handbook hardcoded into
> `tina/AdminDocs.tsx` before that file became a markdown viewer. It was extracted
> mechanically from the JSX so nothing was lost when the board was rewritten.
>
> **[unknown] — figures below were accurate when written (through 2026-06-09) and have
> not been re-verified.** Treat counts as historical. Live numbers come from
> `npm run docs:refresh` → `docs/under-the-hood/stats.md`.
>
> <!-- TODO(james): worth one human proofread pass. The extraction is faithful in
>      content but a few inline `code spans` picked up stray spacing. -->

For day-to-day operations and failure recovery, see the runbook (DOC-020) — it is
hand-written and current.

## Instagram sync

_How new IG posts get from your phone onto thirstypig.com._

**Not a daily pull.** Meta's Graph API is walled for personal-use Pages on the new Pages experience (no Business Verification, no System User token). The flow is _manual export → automatic upload → automatic import_, gated on you triggering a data export.

#### The four-step loop

- **Monday 9am PT reminder** — an Anthropic Cloud routine pings you to request a data export.
- **You request the export** at instagram.com/accounts/access_tool/manage_data. Meta emails a download link 30 min – 2 hr later.
- **You click the email link.** A ZIP named `instagram-*.zip ` lands in `~/Downloads`.
- **Local launchd watcher** (`scripts/local/ig_watcher.sh `) sees the ZIP and uploads it as a GitHub release tagged ` ig-YYYY-MM-DD-HHMM `. The release event triggers `.github/workflows/instagram-sync.yml `, which runs ` sync_pipeline.py `, commits new posts to ` main`, and Vercel auto-deploys.

#### One-time setup the watcher needs

Check whether the watcher is installed:

```
launchctl list | grep thirstypig
```

If nothing prints, the auto-upload step is broken — you'd need to create the GitHub release manually. Install:

```
bash scripts/local/install_ig_watcher.sh
```

After install, dropping any `instagram-*.zip` into Downloads triggers the full chain end-to-end.

#### If something looks wrong

- **Reminders not firing** — check the IG-reminder routine in `claude.ai/code → Routines`.
- **Watcher not triggering** — check `~/Library/Logs/thirstypig-ig-watcher.log ` and ` launchctl list | grep ig-watcher`.
- **Workflow run failed** — see `gh run list --workflow=instagram-sync.yml `. Setup walkthrough lives at ` docs/local-ig-automation.md `. The Meta API wall reasoning is in memory at ` project_meta_api_wall.md` — don't re-explore that path; it's closed.

## Venue-tags scraping

_How "Refine reviews" topic tags get from Google Maps onto post pages as pill widgets._

#### Pipeline shape

- `curate_candidates.py ` walks ` src/content/posts/`, groups by `(location, city)`, drops non-food and already-tagged venues. Output: YAML candidate list.
- `lookup_place_ids_api.py --apply ` calls Google's Places API (New) ` places:searchText ` endpoint. Writes either FID hex (rare) or a CID (common) back into ` venues.yaml`. ~100ms per venue, ~95% hit rate. Free tier covers our needs.
- `scrape_google.py ` opens headed Chrome, navigates via `?ftid=<FID>` (preferred), `?cid=<N>` (cid fallback), or `?q=<text>` (last resort). Extracts chips from `[role="radio"]` aria-labels. If navigated by cid, extracts FID hex from the page's sign-in continuation link and writes it back to venues.yaml so the next run goes direct via ftid.
- `publish.py ` copies ` data/{key}_chips.json ` → ` public/venue-tags/{place_id}.json`.
- `sync_post_placeids.py --apply ` joins venues.yaml on post frontmatter and injects the matching ` placeId` field. The auto-tag step.

#### Why it's "self-healing"

Each venue resolves once. The first scrape converts a `cid ` (decimal) into a ` place_id ` (FID hex pair) and writes it back. Future runs skip the cid resolution dance and navigate directly via `?ftid=`. Failure mode documented at ` docs/solutions/api-migration/google-maps-cid-fid-self-healing-scrape.md`.

#### Auth wall (Google)

Cold/anonymous Playwright sessions hit Google's "limited view" — no Reviews tab, no chips. Gate is **session trust** (signed-in Google account), not fingerprint detection. `bootstrap_profile.py` opens real Chrome (not Playwright — Google blocks sign-in via automated browsers) for the one-time sign-in; the scraper inherits cookies on subsequent runs.

#### Yelp source

**Paused since 2026-04-27.** Yelp's "Popular Dishes" widget is richer than Google's chips, but a 5-URL probe tripped Yelp's PerimeterX-grade anti-bot at the IP level (block ID returned in HTML). Resumption playbook in `scripts/venue-tags/YELP.md`. Don't re-scrape Yelp without reading that file first.

#### Running a batch

```
# 1. Curate candidates (start with high-confidence 2+ post venues)
scripts/venue-tags/venv/bin/python scripts/venue-tags/curate_candidates.py \\
--min-posts 2 > /tmp/batch-candidates.yaml
# 2. Append to venues.yaml, then resolve via Places API
scripts/venue-tags/venv/bin/python scripts/venue-tags/lookup_place_ids_api.py --apply
# 3. Scrape (run in background — 12s/venue)
scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py
# 4. Publish + auto-tag
scripts/venue-tags/venv/bin/python scripts/venue-tags/publish.py
scripts/venue-tags/venv/bin/python scripts/venue-tags/sync_post_placeids.py --apply
```

#### API key trap

"Application restrictions" in Google Cloud Console must be set to **None** for server-side use — "Websites" with an empty domain list silently 403s every request and the error names the empty referer, not the restriction. Full diagnosis at `docs/operator/api-key-trap.md`.

## Pipeline status

_Counts drift batch-to-batch — this section deliberately doesn't hard-code numbers. Run the one-liners below for current values._

#### Venue-tags coverage — count it now

```
# Venues curated (entries in venues.yaml)
grep -c '^- key:' scripts/venue-tags/venues.yaml
# Venues with FID hex resolved
grep -c 'place_id: "0x' scripts/venue-tags/venues.yaml
# Chip JSONs published
ls public/venue-tags/*.json | wc -l
# Posts displaying tags (placeId frontmatter set)
grep -lrE '^placeId:' src/content/posts/ | wc -l
```

#### Long tail remaining

Single-post candidates (venues mentioned in exactly one post) are the long tail. Quality drops as we go deeper — limited-view failure rate has been climbing batch-over-batch. **Tighten curator filters before the next sweep.** See `docs/operator/curator-bugs.md` for the specific patterns to add.

#### Known curator bug

The `\bpark\b ` non-food filter false-matches names like "Park's BBQ". Full write-up at ` docs/operator/curator-bugs.md`.

#### Genuinely unresolvable venues

Three venues returned "limited view" on Google and cannot be tagged. Roster + revisit conditions at `docs/operator/unresolvable-venues.md`.

#### Instagram sync

- **Last release:** `gh release list --limit 5`
- **Watcher installed?** `launchctl list | grep thirstypig`
