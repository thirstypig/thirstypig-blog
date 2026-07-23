---
id: PRD-001
type: prd
status: active
phase: null
owner: james
tags: [venue-tags]
links: [DOC-001]
updated: "2026-07-23"
---

# PRD-001 — Venue tags

> **Retroactive PRD.** This feature shipped before this doc existed. Every claim below is
> tagged **[intended]** (evidence it was a deliberate up-front decision), **[inferred]**
> (a reasonable read of the code, not a known fact), or **[unknown]** (the code can't
> tell us — James needs to answer). A PRD with many `[unknown]`s is doing its job.
>
> Evidence base: `scripts/venue-tags/README.md`, 34 commits (2026-04-27 → 2026-06-08),
> and the shipped code. Counts verified 2026-07-23.

---

## 1. Problem statement
<!-- Prompt-to-self: what's broken, and for whom? Name the person, not "users". -->

Archive posts say what *I* ate on one visit, years ago. A reader landing on a 2011 post
about a Shanghai restaurant has no signal about what the place is actually known for, or
whether it's still worth going. The post is a diary entry, not a recommendation. **[inferred]**

The archive is large (2,127 posts) and old (2007–present), so hand-writing a "known for"
line per venue is not feasible. **[inferred]**

**[unknown]** — Was this reader-facing from the start, or was the original motive to feed
`tastemakers-ios`? The README names both consumers in the same sentence, which makes the
ordering genuinely ambiguous.

## 2. Strategic rationale
<!-- Prompt-to-self: why now, why worth it? Tie to the core value of the project. -->

**[intended]** — Cross-product reuse was designed in from day one, not retrofitted. The
README's opening paragraph states the output is "consumable by **both** thirstypig.com
(via per-venue files served from `/public/venue-tags/`) **and** tastemakers-ios (via the
same URLs over CORS)." Publishing to `public/` rather than an internal data dir is a
deliberate cost paid for that second consumer — an internal-only feature would not have
been shaped this way.

**[inferred]** — It fits the project's static-only constraint: chips are scraped offline,
committed as JSON, and read at build time. No runtime API call, no server, no key exposed
to the browser.

## 3. User story
<!-- Prompt-to-self: as a [role], I want [X] so that [Y]. One sentence, no hedging. -->

**[inferred]** — As a reader who landed on an old post about a restaurant, I want to see
what that place is actually known for, so I can judge whether it's worth my trip today
rather than relying on one visit from years ago.

## 4. Assumptions this feature bet on
<!-- Prompt-to-self: what had to be TRUE for this to be worth building? Include the -->
<!-- bets that were never written down but the build implicitly made. -->

| # | Assumption | Tag | Status today |
|---|---|---|---|
| A1 | Google's pre-computed review chips beat our own N-gram extraction | **[intended]** | **Confirmed.** The README documents this as an explicit mid-build pivot: "Google already does the extraction for us… the output is *better*." `extract_tags.py` was abandoned. |
| A2 | Chips are stable enough to scrape once and commit, not refresh continuously | **[inferred]** | Unverified. Nothing re-scrapes. `scraped_at` is captured but never checked for staleness. |
| A3 | Enough venues have ≥ hundreds of reviews for chips to be meaningful | **[intended]** | **Partly wrong, and known.** README: works for ≥ hundreds of reviews, "degrades gracefully (but un-usefully) below ~50." The Shanghai MVP venue returned 5 thin chips, one of which was contamination from Google's amenity widget. |
| A4 | Venue identity can be resolved from a post's `location` + `city` fields | **[inferred]** | **The main bottleneck.** ~492 posts have no `location` at all; the pipeline can't see them. |
| A5 | Scraping access would remain workable | **[inferred]** | **Contested.** Google gates the Reviews UI behind a signed-in session; `playwright-stealth` + real Chrome channel did not defeat it. The pipeline needs a bootstrapped profile and can return AUTH-GATED. |

## 5. Impact & KPIs

### (a) What the metric *should* be
<!-- Prompt-to-self: the bet you'd have made. A number and a direction. -->

**[inferred]** — Coverage: share of venue posts showing chips. **[unknown]** — the target.
There is no stated goal anywhere in the repo, so any number here would be invented.

**[unknown]** — Was there ever an engagement bet (chips → more clicks, longer dwell), or
was coverage always the only goal?

### (b) What we can measure TODAY

| Metric | Value (2026-07-23) | How |
|---|---|---|
| Posts displaying chips | **1,022 of 2,127 (48.0%)** | `grep -rl '^placeId:' src/content/posts/` |
| Venues catalogued | **814** across **107** cities | `venues.yaml` |
| Venues with published chips | **766** | `ls public/venue-tags/*.json` |
| **Catalogued but unpublished** | **48** | 814 − 766 — venues resolved but never successfully scraped |
| Venues with no ID at all | **10** | neither `place_id` nor `cid` in `venues.yaml` |
| Venues with `cid` but no FID | **13** | have an ID but the scraper can't reach them |

**Engagement is not instrumented.** `VenueTags.astro` fires no analytics event — no click
tracking on the city pill, no impression counting. GA4 exists but is consent-gated and
has no venue-tag events. **We cannot currently tell whether anyone reads these chips.**

Top-3 city concentration: Los Angeles 121, Shanghai 96, Taipei 46. **[inferred]** — the
Shanghai figure is a soft spot, since README flags mainland China as having sparse Google
review coverage.

## 6. Technical notes
<!-- Prompt-to-self: how is it ACTUALLY built? Read the code, don't recall it. -->

Five-stage offline pipeline, all under `scripts/venue-tags/`:

```
curate_candidates.py   find untagged (location, city) groups in posts
lookup_place_ids_api.py  Google Places API → place_id / cid into venues.yaml
scrape_google.py       headed Playwright → topic chips  (exit 2 = auth-gated)
publish.py             data/{key}_chips.json → public/venue-tags/{place_id}.json
sync_post_placeids.py  inject placeId: into post frontmatter
```

Render path: `VenueTags.astro` calls `loadVenueByPlaceId()` in `src/utils/venue-tags.ts`,
reading `public/venue-tags/{placeId}.json` **at build time**. Missing file → returns
`null` → component renders nothing. **[intended]** — the code comment says so explicitly:
"keeps posts without chip data unaffected." Chips sort by `mention_count` descending.

`loadAllVenues()` is memoized per build; its docstring notes it consolidated four
hand-rolled callsites that had drifted apart.

`placeId` is Zod-validated as `/^0x[0-9a-f]+:0x[0-9a-f]+$/` — a malformed value fails the
build rather than shipping broken. **[intended]** — that's a deliberate guard.

## 7. AI implementation notes

**No LLM is involved.** Chips come from Google's own review clustering; we scrape, we
don't generate. **[intended]** — that *is* the pivot in A1: the alternative was our own
extraction, and it was rejected as worse.

Cost is Google Places API calls in `lookup_place_ids_api.py`, one per unresolved venue.
**[unknown]** — actual spend to date. Not tracked anywhere in the repo.

## 8. Testing plan

**Exists today:**

| Test | Covers |
|---|---|
| `test_curate_candidates.py` | candidate selection |
| `test_lookup_place_ids_api.py` | Places API resolution |
| `test_scrape_google.py` | scraper, incl. auth-gate detection |
| `test_venues_yaml_no_duplicate_keys.py` | YAML integrity — js-yaml rejects dupes strictly |
| `src/utils/aggregate-chips.test.ts` | chip aggregation |

**Gap: `src/utils/venue-tags.ts` has no test file** — while its sibling
`aggregate-chips.ts` does, and `src/utils/` otherwise follows a strict colocated-test
convention (8 matched pairs). It's the only loader between committed JSON and every
rendered page, and its failure mode is *silent*: a malformed JSON is caught and returned
as `null`, which renders as nothing. A venue could vanish from the site with a green
build. **Worth adding.**

**[unknown]** — was the omission deliberate (thin wrapper, low value) or an oversight?

## 9. What we'd do differently
<!-- Prompt-to-self: be candid. This section is why the exercise is worth doing. -->

1. **The silent-null pattern is the wrong default here.** Three separate places swallow
   errors into `null`/`[]`: missing dir, unparseable JSON, missing file. That's correct
   for *a post with no venue* and wrong for *a venue whose data broke* — the two are
   indistinguishable at build time. This is the same silent-success class already recorded
   in project memory. A build-time assertion — "every `placeId` in frontmatter resolves to
   a readable file" — would catch the 48-venue gap automatically instead of by hand.

2. **48 catalogued-but-unpublished venues are invisible.** Nothing surfaces the drift
   between `venues.yaml` (814) and `public/venue-tags/` (766). It took a manual count to
   find. That number should be printed by `docs:refresh`.

3. **Coverage stalled at ~48% for a reason the pipeline can't fix.** ~492 posts have no
   `location` field, so `curate_candidates.py` cannot see them. Effort went into
   scraper robustness while the actual bottleneck was upstream data entry. A
   `location`-backfill pass would likely unlock more posts than any scraper improvement.

4. **Betting on scraping a hostile surface.** The auth wall was discovered *during* the
   build, after `playwright-stealth` and profile-persistence attempts. It works, but
   requires a bootstrapped signed-in Chrome profile and can fail with exit code 2 at any
   time. **[unknown]** — is a paid/licensed source worth pricing as a fallback?

5. **`scraped_at` is captured and never used.** No staleness check exists, so a 2026-04
   chip set and a 2026-06 one look identical to the site. Chips describe a *living*
   restaurant; some will be wrong by now.

---

## Open questions for James

- [ ] Was `tastemakers-ios` the primary driver, or thirstypig.com? (§1, §2)
- [ ] What coverage % counts as "done"? Is 48% a failure or roughly expected? (§5a)
- [ ] Should chips ever be re-scraped, and on what trigger? (A2, §9.5)
- [ ] Is the untested `venue-tags.ts` loader an accepted risk? (§8)
- [ ] Do the ~96 Shanghai venues actually render useful chips, given thin coverage? (A3)
