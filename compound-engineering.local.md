---
review_agents:
  - security-sentinel
  - kieran-typescript-reviewer
  - architecture-strategist
  - performance-oracle
  - code-simplicity-reviewer
---

# Project Review Context

This is a fully-static food blog built with Astro 6 + Tailwind v4 + TinaCMS + Vercel.

## Key characteristics

- **Static-only architecture**: No server-side DB. All admin writes go via GitHub REST API from the browser using a fine-grained PAT stored in sessionStorage.
- **Admin at /admin/**: TinaCMS admin. Holds a GitHub PAT in sessionStorage. Two admin managers (HitListManager, BucketListManager) commit directly to GitHub repos. CSP now applied via Vercel headers.
- **Content**: 2,120+ markdown posts in src/content/posts/. YAML frontmatter parsed by js-yaml (YAML 1.1 strict). Any script writing YAML must pass js-yaml validation, not just PyYAML.
- **Venue tags**: Google Places API chips at public/venue-tags/{place_id}.json. placeId frontmatter field uses /^0x[0-9a-f]+:0x[0-9a-f]+$/ schema — malformed values fail the build.
- **YAML quirks**: js-yaml (Astro's parser) is YAML 1.1 strict — rejects duplicate keys that PyYAML silently tolerates. Any field injection must be surgical (sed-style) not yaml.dump.
- **Image pipeline**: 7,503 WebPs committed to git (722 MB). Vercel deploys take ~10 min. Don't touch .gitignore for *.webp.
- **Test suite**: 281 assertions across Vitest + pytest + Playwright (3-tier: pre-commit, CI, nightly).

## Known issues / do not re-raise

- `'unsafe-inline'` in script-src is intentional — required by TinaCMS-generated index.html. Cannot be removed without breaking the admin.
- Google Analytics and AdSense were deliberately removed. Do not suggest adding them back.
- No server-side backend is intentional. Do not suggest adding one.

## Security priorities

- PAT exfiltration via XSS is the primary threat model for /admin/*.
- connect-src in CSP is the main defense (restricts where fetch() can send data).
- frame-ancestors 'none' prevents clickjacking of the admin.
