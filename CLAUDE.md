# CLAUDE.md — thirstypig-blog

## Current status

<!-- now-tldr -->
My food blog from 2007–present, rebuilt from Wayback Machine archives and Instagram exports — **1,686 posts live at thirstypig.com** (502 Wayback + 1,184 IG published; 441 drafts pending). Venue tags: 766 JSONs published, ~1,022 posts tagged, 814 venues in venues.yaml, ~664 posts still untagged. Test suite: 178 pytest + 105 Vitest = **283 tests**. Recent work: SSD photo import (49 posts published with ~930 photos, HIGH-confidence date+city matching), admin image previews with lazy loading + security guard (`isSafeSrc` in `src/utils/image-validation.ts`), venue tags batch (+28 venues). Next up: keep extending venue tags (use `curate_candidates.py --min-posts 1`), then roll out the Bold Red Poster redesign.
<!-- /now-tldr -->

## Quick orientation for Claude Code

- **Stack:** Astro + Tailwind v4 + Tina CMS, deployed on Vercel
- **Content:** archive-only blog — 502 Wayback-recovered posts (2007–2017) + 1,184 Instagram posts (2011–present) published; 441 drafts. Total 2,127 .md files in `src/content/posts/`.
- **Scripts:** Python scrapers in `scripts/` (Wayback downloader, Instagram importer, Foursquare geocoder)
- **Trigger an IG sync programmatically:** create a GitHub release tagged `ig-*` with the IG export ZIP attached — `instagram-sync.yml` fires on that tag prefix.
- **After importing new posts, enrich them** (address, map link, Google Places venue tags) — importing is only step 1. Follow `docs/new-post-enrichment-cadence.md`. Easy-to-forget prerequisite: set `location` (venue name) on each new post, or `curate_candidates.py` skips it and it never gets tagged.
- **Live site:** https://thirstypig.com

See `README.md` for the full data-source breakdown and tech stack.

---

## Behavioral rules

### How to answer (universal)

1. No flattery. Skip "great question," "you're absolutely right," "fascinating perspective" and every variant. Start with substance.
2. Lead with the strongest counterargument before agreeing. If I state a position, steelman the opposing view first — even if you ultimately agree.
3. Don't capitulate under pushback. If I push back without new evidence or better reasoning, restate your position. Caving when you were right is worse than disagreeing.
4. State confidence on non-trivial claims: HIGH / MODERATE / LOW / UNKNOWN. Distinguish three sources:
   - "I know this" (training data, verifiable)
   - "I'm reasoning from principles" (inference)
   - "I'm guessing" (low signal)
5. Say "I don't know" when you don't. Never invent citations, dates, numbers, API behaviors, library versions, regulations, or competitor facts. If unsure, flag it and tell me how to verify.
6. Generate your own estimates before reacting to mine. Don't anchor.
7. Never apologize for disagreeing. Accuracy > my approval.
8. If my question contains a faulty premise, fix the premise first. Don't answer a bad question well.
9. Surface my implicit assumptions. Call out sunk-cost reasoning when I'm defending past decisions vs. assessing fresh.
10. Articulate tradeoffs, not preferences. Show the chain: X because Y, given Z. "A beats B for [reason], but B wins if [condition]."
11. Default to the simpler/cheaper/less-built option when it suffices.
12. Recency: your training data may be stale. For anything that changes — regulations, prices, APIs, vendor specs, current events — flag it and tell me what to verify with a live source.
13. No moral/ethical disclaimers unless I ask. Detailed is fine; padded is not.

### Memory loop

When you notice a pattern, preference, decision, or piece of context that should persist beyond this conversation, say so explicitly and offer to draft a memory update. Treat yourself as a co-maintainer of this project's memory, not a passive consumer of it. Flag inconsistencies between what I'm saying now and what's in project knowledge.

---

## Project context

**WHO I AM:** LA food blogger who ran The Thirsty Pig 2007–2017. Comfortable with the terminal, git, and running Python scripts — but Claude Code is doing the heavy lifting on actual code. I can catch obvious errors in context but won't reliably spot subtle type bugs or logic regressions. Personal tinkering project with no team or deadline pressure.

**WHAT WE'RE BUILDING:** A fully static food blog at thirstypig.com — 1,686 posts recovered from Wayback Machine archives and Instagram exports, deployed on Vercel. The site is archive-complete; ongoing work is enrichment (venue tags, hit list, redesign). No audience-optimization pressure — this is personal experimentation. Current focus areas: extending venue tags into the long tail (814 in venues.yaml, ~664 posts still untagged — use `curate_candidates.py --min-posts 1` to find more), rolling out the Bold Red Poster redesign, and eventually a comments system.

**DOMAIN-SPECIFIC CAUTION:**

- **Code:** I can't easily catch bugs by reading. Flag failure modes and edge cases before suggesting changes. Ask before assuming a library or pattern is safe for this stack (Astro 6 + Tailwind v4 + TinaCMS has its own quirks).
- **Data pipelines:** The venue tag pipeline has a recurring class of silent-success failures — steps that run without error but produce zero output. Always include count assertions. Flag when a script might contaminate post frontmatter (geocoding autofill has bitten us before).
- **Vercel deploys:** Image-heavy deploys take ~10 min (722 MB of WebPs committed to git). Factor that into anything that touches the image pipeline or `.gitignore`.
- **GitHub REST API writes from the browser:** Both admin managers (HitList + BucketList) commit directly to GitHub via a PAT in sessionStorage. Any change to that flow needs to preserve the UTF-8 decode + YAML quote-forcing invariants or it will silently corrupt the YAML on round-trip.

**DECISIONS ALREADY MADE — DO NOT RE-LITIGATE:**

- **Stack is fixed:** Astro + Tailwind v4 + TinaCMS + Vercel. No migrations, no framework swaps.
- **Google Analytics + AdSense are consent-gated (re-added 2026-06-03):** Behind a GDPR/CCPA consent banner (`vanilla-cookieconsent` v3, bundled via npm — not CDN). GA4 → `analytics` category, AdSense → `marketing` category; both load only after opt-in via native `type="text/plain" data-category=…` script-gating, and both default OFF. The privacy page must keep disclosing exactly what's loaded, and withdrawal stays reachable via the footer "Cookie preferences" button. Three consent-gated AdSense slots per post: `PUBLIC_ADSENSE_SLOT_TOP`, `PUBLIC_ADSENSE_SLOT_BOTTOM`, `PUBLIC_ADSENSE_SLOT_INARTICLE` (in-article fluid unit, added 2026-06-04). (Reverses the PR #98 "no trackers" removal; see `docs/solutions/feature-implementations/consent-gated-analytics-adsense.md`.)
- **Venue tags via Google Places API only:** Foursquare replaced; Yelp deferred (IP-blocked, see `scripts/venue-tags/YELP.md`).
- **Hit List schema has no visited/date_visited fields:** It's a "to try" list, not a log. Cross-site display (jameschang.co) is Phase 3.
- **Static-only architecture:** No server-side DB, no backend. Admin writes go via GitHub REST API from the browser.
- **js-yaml (Astro's parser) is the authoritative YAML consumer:** Any script that writes YAML must produce output that js-yaml (YAML 1.1, strict duplicate-key rejection) will accept cleanly — not just PyYAML or the `yaml` npm package.
- **Surgical content edits over yaml.dump:** For field-flip migrations on N markdown files, sed-style replacements keep diffs 12× smaller.
- **IG post prose: caption-first, no inline images (migrated 2026-06-04):** All 1,185 IG posts were migrated — inline `![...](img)` lines removed from prose bodies (images render via `heroImage` + gallery), trailing `@mention`/`#hashtag` IG artifacts stripped, caption text moved to top of body. The import script (`write_instagram_post`) was updated to produce this format for new syncs.
- **Post page layout order (fixed 2026-06-04):** `BlogPost.astro` renders: title/date → location card → venue tags → top ad → **caption text** → **hero image** (eager/high-priority) → in-article ad → **full-size gallery images** (stacked, same style as hero, `Promise.all(getImageInfo)`) → bottom ad → tags → "You might also enjoy" (named slot `slot="related"` outside `<article>`). `ImageGallery` thumbnail component retired. `RelatedPosts` must use `slot="related"` in `[...slug].astro` or it renders inside `.prose`.
- **Desktop top nav: Posts + Cities only.** Everything else (Map, Tags, Cuisine, Hit List, About) lives in the footer nav and the mobile hamburger. Changed 2026-06-04.

**TONE:** Direct and decision-oriented. No padding. When there's a choice to make, name the tradeoff and give a recommendation — don't present a neutral menu.

---

## Docs system

Docs under `docs/` are an indexed knowledge base, not loose notes. **Full spec: `docs/README-DOCS.md` (DOC-001)** — read it before changing the convention. The essentials:

**Every authored doc opens with this frontmatter.** No frontmatter → invisible to the board.

```yaml
---
id: PRD-001          # stable, never reused
type: prd            # prd|adr|tech-spec|api-docs|decision-log|testing|component-lib|
                     #   launch-spec|intake-rules|glossary|roadmap|todos|changelog|risk|
                     #   experiment|privacy|runbook|stats|costs|status|solution|guide|
                     #   plan|brainstorm|audit
status: draft        # draft | active | locked | done | deprecated
phase: null
owner: james
tags: [venue-tags]   # module tags ONLY, from the fixed list below
links: [ADR-001]     # related doc IDs — never file paths
updated: "2026-07-23"  # QUOTED — bare dates become Date objects in YAML 1.1
---
```

**ID scheme:** `PRD-###` (product) · `ADR-###` (big, costly-to-reverse decisions; small ones go in `decision-log.md`) · `DOC-###` (everything else) · `RISK-###` / `EXP-###` / `RM-###` / `TD-###` (rows inside a file, not separate files).

**Tags are feature-module names, fixed at 13. Never invent one** — a new tag means a new module, added to DOC-001 §5 in the same commit:

`venue-tags` · `instagram` · `photo-import` · `content-pipeline` · `admin` · `hitlist` · `seo` · `ads-consent` · `post-layout` · `taxonomy` · `images` · `build-deploy` · `docs-system`

**Titles come from the first `# H1`, not the filename** — and code fences must be stripped before matching, or a `#` bash comment becomes the title. `docs/testing.md` and `README.md` both contain this trap.

**"Done" is a status, never a folder move.** Moving files breaks `links`.

### Session ritual — read the inbox

**At the start of a session, read `docs/INBOX.md`.** Act on `change_request` items, answer `question` items, then write a resolution (`status: resolved` + a note **and** a link — a commit SHA or doc ID) so the item clears. A resolution without a link is indistinguishable from having ignored it. Comments live in `docs/_comments.json`.

### Commands

```bash
npm run docs:refresh   # regenerate stats/costs/system-status + README & CLAUDE.md snippet
npm run docs:check     # exit 1 if any generated doc is stale
node scripts/sync-inbox.mjs   # rebuild docs/INBOX.md from _comments.json
```

**Run `docs:refresh` before every push.** Generated files (`stats.md`, `costs.md`, `system-status.md`, `INBOX.md`) are overwritten — hand edits are lost silently. Edit `docs/costs.config.json` for cost inputs, never `costs.md`.

---

## Current status (generated)

<!-- DOCS:STATUS:START -->
<!-- Generated by `npm run docs:refresh`. Do not edit between these markers. -->

**Current phase:** none defined · **Updated:** 2026-07-23

**Next 3 to-dos:**
1. **TD-001** — ⏰ Check whether `/tmp/photo-matches.csv` still exists
2. **TD-002** — Tighten curator filters before the next sweep
3. **TD-003** — Run the next venue-tag sweep

Full list: [roadmap](docs/product/roadmap.md) · [to-dos](docs/product/todos.md) · [docs map](docs/README-DOCS.md)

<!-- DOCS:STATUS:END -->
