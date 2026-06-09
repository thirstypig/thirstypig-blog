---
status: pending
priority: p2
issue_id: "061"
tags: [code-review, performance, admin]
dependencies: []
---

# ImagePreview: Eager loading 90 JPEGs will stall admin on large posts

## Problem Statement
`ImageListPreview` loads all images simultaneously at mount with no `loading` attribute, no `width`/`height`, and no `decoding` hint. A post like Ike's Place SF (90 images, up to 1.5MB each) fires 90 concurrent HTTP requests and decodes up to 135MB of JPEG data. This stalls the admin UI for seconds and can exhaust browser memory inside TinaCMS's iframe. Layout shift also occurs since no dimensions are reserved before decode.

## Findings
- `tina/ImagePreview.tsx` line 156: `<img src={src} alt={...} style={{ width: 72, height: 72 }}>` — no `loading`, no `width/height` attributes (only CSS)
- `tina/ImagePreview.tsx` line 38: `HeroImagePreview` `<img>` also missing `decoding="async"` and explicit width/height
- Performance agent: at 90 × 1.5MB = 135MB transferred + decode overhead; browser caps 6 concurrent connections so queue takes ~15s on slow connections; even same-origin CDN is 2–5s
- Browser can't reserve layout space without explicit `width`/`height` HTML attributes (CSS-only dimensions don't prevent CLS)

## Proposed Solutions

### Option A: Add lazy loading + size attributes (Recommended)
**Effort:** Small | **Risk:** None

Thumbnail `<img>`:
```tsx
<img
  src={src}
  alt={`Image ${i + 1}`}
  loading="lazy"
  decoding="async"
  width={72}
  height={72}
  style={{ width: 72, height: 72, objectFit: "cover", ... }}
/>
```

Hero `<img>` (should NOT be lazy — always visible):
```tsx
<img
  src={src}
  alt="Hero image preview"
  decoding="async"
  style={{ maxWidth: "100%", maxHeight: 220, ... }}
/>
```

**Pros:** One-line change per attribute. Browser loads only in-viewport thumbnails. Memory drops from 135MB to ~15MB for a 90-image post.
**Cons:** None.

### Option B: Add collapse toggle for large lists
**Effort:** Medium | **Risk:** Low

Add `const [showThumbs, setShowThumbs] = useState(images.length <= 20)`. For posts with >20 images, default the strip to collapsed with a "Show 90 thumbnails" button.

**Pros:** Eliminates loading entirely for large lists until needed.
**Cons:** Adds state; hides thumbnails by default which reduces the feature's value.

### Option C: Virtual scroll
**Effort:** Large | **Risk:** Medium

Use a virtualizing list for the thumbnail strip (react-window or similar).

**Pros:** Best for very large lists.
**Cons:** Adds a dependency; overkill for an admin-only component used by one person.

## Recommended Action
Option A. One-line changes to both components, eliminates the problem entirely.

## Technical Details
- **File:** `tina/ImagePreview.tsx` lines 38, 156
- **Impact:** Any post with >20 images; worst case Ike's Place SF (90 images)

## Acceptance Criteria
- [ ] Thumbnail `<img>` elements have `loading="lazy"`, `decoding="async"`, `width={72}`, `height={72}` HTML attributes
- [ ] Hero `<img>` has `decoding="async"` 
- [ ] Opening a 90-image post in admin does not cause a noticeable stall

## Work Log
- 2026-06-09: Identified by performance-oracle agent in CE review of PR #131
