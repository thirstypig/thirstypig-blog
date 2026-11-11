# STATUS — thirstypig

**Last updated:** 2026-11-11

## One-line description
The Thirsty Pig: static archive of a food, drink and dining blog (2007–present), rebuilt from Wayback Machine snapshots and Instagram exports.

## Scope / positioning
- Personal project, no team or deadline; archive-complete, ongoing work is enrichment (venue tags, photo recovery, Hit List, redesign).
- ~1,686 posts live; 441 drafts on disk.
- Features: search, map, archive, best-of, venue tag chips, Hit List, Tina CMS admin.
- CLAUDE.md: project is **parked (low priority)**.

## Stack & hosting
- Astro 6, Tailwind v4, TinaCMS 3; Python scrape/import/geocode scripts.
- Static only; admin writes go to GitHub via REST API from the browser.
- Vercel (`vercel.json`); deploys ~10 min (image-heavy).
- GitHub Actions: tests (pytest, Vitest, Playwright), weekly production E2E, Instagram sync (`ig-*` releases), Hit List vault sync.
- GA4 + AdSense consent-gated.

## URLs
- Live: https://thirstypig.com
- Admin: https://thirstypig.com/admin (noindex)
- Repo: github.com/thirstypig/thirstypig-blog

## Shipped (last 60 days)
- **CI hardening (Nov 5, PR #140):** E2E pinned to `ubuntu-24.04`, production E2E nightly → weekly, 30-min job cap.
- **Housekeeping (Nov 5, PRs #141–142):** to-do cleanup, stale CSVs gitignored, done-row parsing fix, testing docs synced.
- **Port registry cleanup (Sep 12, PRs #138–139):** `PORTS.md` retired, `MASTER-PORTS.md` untracked (public repo), dev/preview pinned to 4321.

## In progress
- Nothing active; project parked.
- TD-011: backfill frontmatter on 15 docs (RM-006).

## Open bugs / known issues
- Production TinaCMS admin: CORS errors authenticating with Tina Cloud (`todos/001`).
- Google Places autocomplete works only locally; production key not configured (`todos/002`).
- 820 posts missing Phase 2 cuisine/dish enrichment (`todos/003`).
- 444 photo-match decisions lost to `/tmp` purge; matching pass must re-run with SSD mounted (RISK-001).
- 48 venues catalogued but unpublished (TD-004); `venue-tags.ts` untested, fails silently (TD-005).
- ~199 duplicate titles (TD-009); 38 heroless posts lack default `og:image` (TD-010).
- `todos.md`/`roadmap.md` still say the admin board hardcodes lists; PR #136 appears to have removed that — needs verifying.

## Next phases (in order)
Per `roadmap.md` (ranking marked "[inferred]", owner unconfirmed):
1. RM-001 Venue tags long tail: supply venue names (caption → proposer → Google Sheet review).
2. RM-004 Photo import long tail: re-run matching, then TD-006/007/008.
3. RM-002 Bold Red Poster site-wide rollout (homepage shipped).
4. RM-003 Comments system (Webmentions/Bridgy rejected; direction pending).
5. RM-005 Hit List on jameschang.co.

## Decisions changed recently
- 2026-11-05: Production E2E nightly → weekly; runners pinned to ubuntu-24.04.
- 2026-11-05: Curator tuning abandoned (TD-002/003 retired); next lever is supplying venue names.
- 2026-11-05: Audit CSVs gitignored rather than committed.
- 2026-09-12: `PORTS.md` retired; `MASTER-PORTS.md` no longer published.
