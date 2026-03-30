# Post Enhancements & Admin Capabilities Brainstorm

**Date:** 2026-03-30
**Status:** Brainstorm — needs discussion before planning

---

## Overview

Six interconnected initiatives to improve post quality, discoverability, and manageability:

1. **Location cards on posts** — Show venue/map info inline on each post
2. **@mention linking** — Make @handles clickable to Instagram
3. **Admin enhancements** — Extend TinaCMS with missing fields, image management, analytics
4. **SEO improvements** — Fill gaps in structured data, fix meta descriptions, optimize images
5. **Content quality pass** — Fix titles, grammar, spelling; improve writing consistency
6. **Layout improvements** — Rethink content flow (text vs. images above the fold)

---

## 1. Location Cards on Posts

### Current State
- Posts have `location`, `city`, `region`, `address`, and `coordinates` in frontmatter
- **None of this is displayed on the post page** — BlogPost.astro only shows title, author, date, categories, and tags
- 841 venues have GPS coordinates; many more have city/region

### Proposal
Add a **Location Card** component to BlogPost.astro, displayed between the header and hero image (or as a sidebar element). It would show:

- **Venue name** (location field) with city/region
- **Street address** (if available)
- **Mini Leaflet map** with a single pin (if coordinates exist)
- **"View on full map"** link → `/map` centered on that pin's coordinates
- **Google Maps link** → opens directions to the address

### Design Considerations
- Only render the card when at least `location` or `city` exists
- Make the mini-map lightweight — static image or tiny Leaflet embed (150px tall)
- On mobile, card stacks above the hero image; on desktop, could be a sidebar float
- Consider a "nearby posts" link that filters map to the same city

### Complexity: Low-Medium
The data already exists. This is a new Astro component + layout change.

---

## 2. @Mention Linking to Instagram

### Current State
- @mentions appear as plain text in 1,191 Instagram-sourced posts
- 65+ venue names already identified from @handles
- No processing or linking currently happens
- Some @mentions are NOT Instagram handles (e.g., `@was` in "the BM@was gross")

### Proposal: Two-Part Approach

**Part A — Remark Plugin (auto-linking at build time)**
A custom remark plugin that finds `@handle` patterns in markdown AST and converts them to links:
- Pattern: `@[a-zA-Z0-9._]{1,30}` (Instagram handle format)
- Output: `<a href="https://www.instagram.com/handle/" target="_blank" rel="noopener">@handle</a>`
- Styled distinctly (amber color, subtle Instagram icon)

**Part B — Override/Exclusion Map**
A JSON file (e.g., `src/data/mention-overrides.json`) with entries like:
```json
{
  "was": { "skip": true },
  "isliou": { "skip": true, "reason": "personal account" },
  "franklinbbq": { "url": "https://www.instagram.com/franklinbbq/", "label": "Franklin BBQ" },
  "thelocalvictoria": { "label": "The Local (Victoria, BC)" }
}
```
- `skip: true` — don't link this @mention
- `url` — override the default Instagram URL
- `label` — display name (for tooltip or future use)

**Edge Cases to Handle:**
- Email addresses containing @ (skip if preceded by alphanumeric)
- @mentions at the end of hashtag blocks (still link them)
- Multiple @mentions in sequence (link each independently)

### Complexity: Medium
Remark plugin is straightforward. Override map needs initial population + admin UI.

---

## 3. Admin Enhancements (TinaCMS Extension)

### Current State
TinaCMS is configured at `/admin` with 14 editable fields. But several schema fields are **missing from the admin UI**:
- `address` — not editable in admin
- `coordinates` (lat/lng) — not editable in admin
- `originalUrl` — not editable
- `archiveUrl` — not editable
- `images` array — not editable (can't manage multiple images per post)

### Proposal: Three Tiers

#### Tier 1 — Complete the Admin Fields
Add missing fields to `tina/config.ts`:
- Address (text input)
- Coordinates (two number inputs: latitude, longitude)
- Images array (list of image uploads)
- originalUrl and archiveUrl (text inputs, collapsible "Advanced" group)

#### Tier 2 — Image Management Per Post
- Enable drag-and-drop image reordering in the images array
- Allow setting which image is the heroImage (first in array or explicit selection)
- Upload new images to the post's image folder
- Preview thumbnails of all post images
- **Bulk image association** — select from existing unassigned images in `/public/images/posts/`

This addresses the goal of attributing old photos to posts. The workflow would be:
1. Upload photos to a staging area or directly to a post folder
2. In the admin, select which post to associate them with
3. Drag/reorder to set hero image and gallery order

#### Tier 3 — Visitor Analytics Dashboard
Options (in order of recommendation):

| Option | Cost | Effort | Geo Detail |
|--------|------|--------|------------|
| **Vercel Analytics** | Free | 1 line in astro.config | Country only |
| **Plausible** | $9/mo | Script tag | City-level |
| **Custom Edge Middleware + KV** | Free | Build it | IP-level |

**Recommendation:** Start with **Vercel Analytics** (free, zero-effort) for basic traffic data. If city/IP-level geo data is important, add **Plausible** — it's privacy-friendly, lightweight (< 1KB script), no cookie banner needed, and shows city-level visitor origin on a world map.

Building a custom analytics dashboard is high effort for a static site. Use a service.

#### Tier 3b — @Mention Override Editor
Add a custom admin page or a TinaCMS collection for the mention-overrides.json file, so overrides can be managed through the admin UI instead of editing JSON by hand.

### Complexity: Medium-High (for all tiers combined)

---

## 4. SEO Improvements

### Current State — What's Already Good
- OpenGraph tags (type, url, title, description, image, site_name)
- Twitter Cards (summary_large_image when image exists)
- JSON-LD Article schema (headline, datePublished, author, publisher, image)
- Canonical URLs (dynamic from pathname)
- Sitemap (auto-generated via @astrojs/sitemap)
- robots.txt (allows all, links to sitemap)
- RSS feed (latest 50 posts)

### Gaps & Opportunities

#### A. Missing Meta Descriptions (~90% of posts)
- Most posts have no `description` field in frontmatter
- SEO.astro falls back to a generic site description for ALL posts
- Google will auto-excerpt, but custom descriptions rank better
- **Fix:** Script to auto-generate descriptions from first 150 chars of post body (or AI-generated summaries)

#### B. Missing Image Alt Text Diversity
- Instagram posts duplicate the title as alt text for every image
- Same alt text on 7 images hurts accessibility AND image SEO
- **Fix:** AI-generated descriptive alt text per image, or at minimum: "Image 1 of 7: [title]"

#### C. Restaurant/Recipe Structured Data
- Currently only Article schema in JSON-LD
- Missing **Restaurant** schema for posts with location/address/coordinates
- Missing **Review** schema for posts with ratings (older blog posts had "X Pigs" ratings)
- **Fix:** Add conditional JSON-LD for Restaurant when location + address exist

#### D. Image Optimization Pipeline
- Images are pre-converted to WebP but NOT served through Astro's Image component
- No `<picture>` element with format fallbacks
- No responsive srcset for different screen sizes
- Sharp is installed but not integrated
- **Fix:** Migrate to Astro `<Image>` component for automatic optimization, responsive sizing, and format negotiation

#### E. Internal Linking
- Posts don't link to related posts within their content
- Related posts section exists but only shows 4 thumbnails at the bottom
- **Fix:** Auto-suggest internal links where venue names or city names match other posts

#### F. Page Speed / Core Web Vitals
- Hero images use `loading="eager"` (good for LCP)
- But no `width`/`height` attributes → causes layout shift (bad CLS)
- No `fetchpriority="high"` on hero image
- **Fix:** Add dimensions to hero images; add fetchpriority hint

#### G. RSS Feed Enhancement
- Currently only 50 posts with title/date/description
- No content in RSS (just metadata)
- **Fix:** Include full post content in RSS for better feed reader experience; increase to 100+ posts

### Priority Matrix

| Fix | SEO Impact | Effort | Priority |
|-----|-----------|--------|----------|
| Meta descriptions | High | Medium (script) | 1 |
| Restaurant JSON-LD | High | Low | 2 |
| Image dimensions (CLS) | Medium | Low | 3 |
| Image optimization (Astro) | Medium | Medium | 4 |
| Alt text diversity | Medium | Medium | 5 |
| RSS enhancement | Low | Low | 6 |
| Internal linking | Medium | High | 7 |

---

## 5. Content Quality Pass

### Current State — Quality Audit Findings

**Title Issues:**
- **441 posts** with generic "Instagram Post — [Date]" titles (zero SEO value)
- **66 posts** with truncated titles ending in "..."
- Double/triple spaces in some titles
- Inconsistent capitalization

**Writing Issues:**
- Grammar errors in recent posts: "It's had been a minute" → "It had been a minute"
- Subject-verb agreement: "I'm hope next time" → "I hope next time"
- Lowercase "i" in older posts: "i've been to Savoy" → "I've been to Savoy"
- ~433 posts with zero text content (image-only Instagram posts)

**Content Gaps:**
- Most posts lack a `description` field (impacts SEO + social sharing)
- Hashtag-heavy endings that read awkwardly on a blog

### Proposal: AI-Assisted Content Enhancement Script

A Python script that processes posts in batches with LLM assistance:

#### Pass 1 — Title Improvement (441 generic + 66 truncated)
- For "Instagram Post — [Date]" titles: Generate a descriptive title from the post body and images
- For truncated titles: Complete the title naturally
- For all: Fix double spaces, normalize capitalization
- **Human review required** — output a CSV of old title → suggested title for James to approve

#### Pass 2 — Grammar & Spelling Fix
- Run each post body through a light editing pass
- Fix obvious errors: capitalization, subject-verb agreement, tense consistency
- **Preserve voice** — don't rewrite, just correct. Keep the casual Instagram tone
- Flag posts where changes exceed a threshold for manual review

#### Pass 3 — Description Generation
- Auto-generate 150-160 character meta descriptions from post content
- Focus on: what was eaten, where, and a brief opinion
- Example: "Deviled eggs, fried chicken, and spicy chicken sandwiches at Crack Shack in Costa Mesa — crispy, flavorful, and worth the drive."

#### Pass 4 — Hashtag Cleanup (Optional)
- Move Instagram hashtags from post body to `tags` array in frontmatter
- Clean the body text of hashtag blocks
- Keep hashtags as metadata (useful for search/filtering) but remove from prose

### Voice Preservation Guidelines
- Keep first-person perspective
- Keep casual/conversational tone
- Keep food-specific slang and enthusiasm
- Don't add formality or "blog voice"
- Don't expand beyond what was originally said
- Only fix what's clearly wrong (grammar, spelling, capitalization)

### Complexity: Medium-High
The script itself is moderate. The review/approval workflow needs thought. Batch processing 2,100 posts through an LLM has cost implications.

---

## 6. Layout Improvements — Content Flow

### Current State
The BlogPost layout renders in this order:
1. Categories (pill badges)
2. Title (large serif heading)
3. Author + Date
4. Hero Image (full-width, can be very tall)
5. Post body text (prose)
6. Tags
7. Source attribution
8. Related Posts

### The Problem
For posts with tall hero images (especially portrait-orientation Instagram photos), you have to scroll past the entire image to reach any text. The reading experience is:
- **Above the fold:** Title + giant image
- **Below the fold:** Everything else

For image-only posts (433 of them), there's nothing below the image at all.

### Proposal: Layout Options to Evaluate

#### Option A — Text First, Image Gallery Below
```
[Categories]
[Title]
[Author + Date]
[Location Card]        ← NEW
[Post Body Text]       ← MOVED UP
[Hero Image + Gallery] ← MOVED DOWN
[Tags]
[Related Posts]
```
**Pros:** Text is immediately readable; good for SEO (content appears early in DOM)
**Cons:** Loses the visual impact of leading with the food photo

#### Option B — Side-by-Side on Desktop
```
Desktop:
┌──────────────────┬─────────────────┐
│ [Hero Image]     │ [Title]         │
│                  │ [Date + Author] │
│                  │ [Location Card] │
│                  │ [Body Text...]  │
└──────────────────┴─────────────────┘

Mobile:
[Title]
[Hero Image (constrained height)]
[Location Card]
[Body Text]
```
**Pros:** Both image and text visible above the fold; magazine-style feel
**Cons:** More complex layout; doesn't work as well for posts with multiple images

#### Option C — Constrained Hero + Text Peek (Recommended)
```
[Categories]
[Title]
[Author + Date]
[Location Card]                 ← NEW
[Hero Image (max-height: 400px, object-fit: cover)]  ← CONSTRAINED
[Post Body Text]                ← Visible sooner
[Additional Images as Gallery]  ← NEW
[Tags]
[Related Posts]
```
**Pros:** Image still leads visually, but text is always within one scroll. Gallery shows all images
**Cons:** Cropping tall images may lose context

#### Option D — Instagram-Style Card Layout
```
┌─────────────────────────────┐
│ [Avatar] The Thirsty Pig    │
│          May 11, 2025       │
├─────────────────────────────┤
│ [Hero Image — full width]   │
│ [Image carousel dots]       │
├─────────────────────────────┤
│ [Location Card — compact]   │
│ [Body Text]                 │
│ [Tags as hashtags]          │
└─────────────────────────────┘
```
**Pros:** Familiar for Instagram-sourced content; image carousel for multi-image posts
**Cons:** May not suit the longer blog-era posts; too "social media"

### Recommendation: Option C (Constrained Hero)
- Constrains hero image height to ~400px with `object-fit: cover`
- Adds a location card between header and image
- Converts the `images` array into a scrollable gallery below the text
- Works for both short Instagram captions and long blog reviews
- Keeps the visual-first feel without burying the text

For the 433 image-only posts, the location card and gallery become the primary content below the image, making them feel less empty.

### Image Gallery Component
For posts with multiple images (common in Instagram posts), add a gallery:
- Thumbnail strip or grid below the main content
- Lightbox on click (full-screen image view)
- Swipe support on mobile
- Lazy loading for gallery images

---

## Implementation Order (Suggested)

### Phase 1 — Quick Wins (1-2 sessions)
1. Location card component on posts
2. @mention auto-linking (remark plugin)
3. Add missing fields to TinaCMS config
4. Enable Vercel Analytics

### Phase 2 — SEO & Content (2-3 sessions)
5. Meta description generation script
6. Restaurant JSON-LD structured data
7. Image dimension attributes (fix CLS)
8. Title improvement script (441 generic titles)

### Phase 3 — Layout & UX (2-3 sessions)
9. Constrained hero image layout
10. Image gallery component
11. Grammar/spelling pass script
12. @mention override editor in admin

### Phase 4 — Advanced (ongoing)
13. Image optimization pipeline (Astro Image component)
14. Plausible analytics (if geo data needed)
15. Internal linking suggestions
16. Hashtag-to-tags migration

---

## Open Questions for Discussion

1. **Location card placement** — Between header and image, or after the content? Or sidebar on desktop?
2. **@mention linking** — Should personal accounts (friends tagged in photos) also link to Instagram, or only venues?
3. **Content editing approval** — Should title/grammar changes go through a CSV review, or trust the AI with light edits?
4. **Image-only posts** — Should we try to generate captions for the 433 posts with no text? Or leave them as visual-only?
5. **Hashtag handling** — Move hashtags to tags array and clean from body? Or keep them inline?
6. **Analytics depth** — Is Vercel Analytics (country-level) enough, or do you need city/IP-level data?
7. **Layout preference** — Which option (A/B/C/D) feels right for the blog's personality?
8. **Voice preservation** — Any specific phrases, slang, or stylistic quirks you want to make sure the grammar pass preserves?
