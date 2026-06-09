---
status: pending
priority: p2
issue_id: "063"
tags: [code-review, security, admin]
dependencies: []
---

# ImagePreview: No URL scheme validation on img src allows data: URI vector

## Problem Statement
Both `HeroImagePreview` and `ImageListPreview` render `<img src={src}>` where `src` is the raw text input value with no URL scheme validation. The admin's `img-src` CSP includes `data:`, so a `data:image/svg+xml` URI typed or pasted into the path field would be loaded by the browser. Current browser engines sandbox SVG loaded via `<img>` so scripts don't execute, but this relies on browser engine behavior rather than an explicit CSP restriction.

Secondary: an arbitrary `https://` URL would cause the browser to fire a DNS lookup + connection attempt to that host before CSP blocks the response (timing oracle, low severity).

## Findings
- `tina/ImagePreview.tsx` line 34: `{src ? <img src={src} ...> : <div>No hero image set</div>}` — no scheme check
- `tina/ImagePreview.tsx` line 157: `<img src={src} ...>` — no scheme check
- `vercel.json` lines 11, 23: `img-src` includes `data:` — enables `data:image/svg+xml` loads
- Security agent: `data:image/svg+xml,<svg><script>...</script></svg>` via `<img>` is currently sandboxed by browsers, but this relies on engine behavior not CSP
- All legitimate image paths in this project start with `/images/posts/`

## Proposed Solutions

### Option A: Add src scheme guard in components (Recommended)
**Effort:** Small | **Risk:** None

```tsx
const isSafeSrc = (s: string) => s === "" || s.startsWith("/") || s.startsWith("https://thirstypig.com");

// In render:
{src && isSafeSrc(src) ? (
  <img src={src} ... />
) : src ? (
  <div style={{ color: "#ef4444", fontSize: 12 }}>⚠ Invalid path (must start with /)</div>
) : (
  <div>No hero image set</div>
)}
```

**Pros:** Explicit, in-component defense. Shows user a helpful error for invalid paths. Eliminates data: and external host vectors.
**Cons:** Slightly more complex render logic.

### Option B: Remove `data:` from img-src in vercel.json CSP
**Effort:** Small | **Risk:** None

Remove `data:` from the `img-src` directive in both admin CSP blocks in `vercel.json`.

**Pros:** Closes the CSP-level gap. No code changes needed in components.
**Cons:** Doesn't block external https:// URLs. Does not show user feedback for invalid paths.

### Option C: Both A and B
**Effort:** Small | **Risk:** None

Defense in depth: validate in components AND tighten CSP.

## Recommended Action
Option C. The CSP change is a one-word removal. The component guard adds user feedback for malformed paths, which is genuinely useful.

## Technical Details
- **Files:** `tina/ImagePreview.tsx` (lines 34, 157), `vercel.json` (lines 11, 23)
- All legitimate admin image paths are `/images/posts/...` — absolute paths starting with `/`

## Acceptance Criteria
- [ ] `<img>` is not rendered when `src` is a `data:` URI or external URL
- [ ] User sees a visible warning for invalid paths
- [ ] `data:` removed from `img-src` in both admin CSP entries in vercel.json

## Work Log
- 2026-06-09: Identified by security-sentinel agent in CE review of PR #131
