# CLAUDE.md — thirstypig-blog

## Current status

<!-- now-tldr -->
My food blog from 2007–present, rebuilt from Wayback Machine archives and Instagram exports — **1,639 posts and 1,400+ mapped restaurants live at thirstypig.com**. Venue tags long-tail push ongoing: 655 venue JSONs published, 885 posts displaying tag pills, 699 venues in venues.yaml. Python test suite at 118 (+ new `test_scrape_google.py` for auth_gated() heuristic). Next up: keep extending venue tags (use `curate_candidates.py --min-posts 1`), then roll out the Bold Red Poster redesign across the rest of the site.
<!-- /now-tldr -->

## Quick orientation for Claude Code

- **Stack:** Astro + Tailwind v4 + Tina CMS, deployed on Vercel
- **Content:** archive-only blog — 923 Wayback-recovered posts (2007–2017) + 1,649 Instagram posts (2011–present), all static
- **Scripts:** Python scrapers in `scripts/` (Wayback downloader, Instagram importer, Foursquare geocoder)
- **Trigger an IG sync programmatically:** create a GitHub release tagged `ig-*` with the IG export ZIP attached — `instagram-sync.yml` fires on that tag prefix.
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

**WHAT WE'RE BUILDING:** A fully static food blog at thirstypig.com — 1,639+ posts recovered from Wayback Machine archives and Instagram exports, deployed on Vercel. The site is archive-complete; ongoing work is enrichment (venue tags, hit list, redesign). No audience-optimization pressure — this is personal experimentation. Current focus areas: extending venue tags into the long tail (699 in venues.yaml, ~754 posts still untagged — use `curate_candidates.py --min-posts 1` to find more), rolling out the Bold Red Poster redesign, and eventually a comments system.

**DOMAIN-SPECIFIC CAUTION:**

- **Code:** I can't easily catch bugs by reading. Flag failure modes and edge cases before suggesting changes. Ask before assuming a library or pattern is safe for this stack (Astro 6 + Tailwind v4 + TinaCMS has its own quirks).
- **Data pipelines:** The venue tag pipeline has a recurring class of silent-success failures — steps that run without error but produce zero output. Always include count assertions. Flag when a script might contaminate post frontmatter (geocoding autofill has bitten us before).
- **Vercel deploys:** Image-heavy deploys take ~10 min (722 MB of WebPs committed to git). Factor that into anything that touches the image pipeline or `.gitignore`.
- **GitHub REST API writes from the browser:** Both admin managers (HitList + BucketList) commit directly to GitHub via a PAT in sessionStorage. Any change to that flow needs to preserve the UTF-8 decode + YAML quote-forcing invariants or it will silently corrupt the YAML on round-trip.

**DECISIONS ALREADY MADE — DO NOT RE-LITIGATE:**

- **Stack is fixed:** Astro + Tailwind v4 + TinaCMS + Vercel. No migrations, no framework swaps.
- **Google Analytics + AdSense are consent-gated (re-added 2026-06-03):** Behind a GDPR/CCPA consent banner (`vanilla-cookieconsent` v3, bundled via npm — not CDN). GA4 → `analytics` category, AdSense → `marketing` category; both load only after opt-in via native `type="text/plain" data-category=…` script-gating, and both default OFF. The privacy page must keep disclosing exactly what's loaded, and withdrawal stays reachable via the footer "Cookie preferences" button. AdSense slot IDs come from `PUBLIC_ADSENSE_SLOT_TOP`/`PUBLIC_ADSENSE_SLOT_BOTTOM` env vars. (Reverses the PR #98 "no trackers" removal; see `docs/solutions/feature-implementations/consent-gated-analytics-adsense.md`.)
- **Venue tags via Google Places API only:** Foursquare replaced; Yelp deferred (IP-blocked, see `scripts/venue-tags/YELP.md`).
- **Hit List schema has no visited/date_visited fields:** It's a "to try" list, not a log. Cross-site display (jameschang.co) is Phase 3.
- **Static-only architecture:** No server-side DB, no backend. Admin writes go via GitHub REST API from the browser.
- **js-yaml (Astro's parser) is the authoritative YAML consumer:** Any script that writes YAML must produce output that js-yaml (YAML 1.1, strict duplicate-key rejection) will accept cleanly — not just PyYAML or the `yaml` npm package.
- **Surgical content edits over yaml.dump:** For field-flip migrations on N markdown files, sed-style replacements keep diffs 12× smaller.

**TONE:** Direct and decision-oriented. No padding. When there's a choice to make, name the tradeoff and give a recommendation — don't present a neutral menu.
