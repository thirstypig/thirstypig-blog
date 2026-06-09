---
status: pending
priority: p3
issue_id: "066"
tags: [code-review, quality, simplification, admin]
dependencies: []
---

# ImageListPreview: double map (thumbnail strip + input list) adds misalignment risk

## Problem Statement
`ImageListPreview` iterates `images` twice: once for the thumbnail strip and once for the editable path list below it. The two loops must stay positionally synchronized — a future reorder of one without the other would silently misalign thumbnails and their corresponding inputs. Merging into a single pass eliminates this risk and removes ~40-45 LOC.

## Findings
- `tina/ImagePreview.tsx` lines 144–186: thumbnail strip map (conditional on `images.length > 0`)
- `tina/ImagePreview.tsx` lines 188–223: editable inputs map
- Simplicity reviewer: merging saves ~40-45 LOC; the "strip above, inputs below" layout is decorative — the index badge already labels each thumbnail
- The two-pass pattern has a real maintenance risk: if someone adds sorting to one loop but not the other, thumbnails and inputs desync

## Proposed Solution

Replace the two separate maps with a single per-row layout: thumbnail + input + remove button side by side.

```tsx
<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
  {images.map((src, i) => (
    <div key={src + '_' + i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Thumbnail */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <img
          src={src}
          alt={`Image ${i + 1}`}
          loading="lazy"
          decoding="async"
          width={72}
          height={72}
          style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 4, border: "1px solid #d1d5db" }}
        />
        <span style={{ position: "absolute", bottom: 2, left: 2, background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, padding: "2px 4px", borderRadius: 2 }}>
          {i + 1}
        </span>
      </div>
      {/* Path input + remove */}
      <input
        type="text"
        value={src}
        onChange={(e) => update(i, e.target.value)}
        style={{ flex: 1, padding: "4px 8px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 11, fontFamily: "monospace", color: "#374151" }}
      />
      <button type="button" onClick={() => remove(i)} title="Remove" style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16, padding: "2px 4px" }}>×</button>
    </div>
  ))}
</div>
```

**Estimated LOC reduction:** ~40-45 lines (the separate conditional thumbnail strip block disappears entirely)

## Technical Details
- **File:** `tina/ImagePreview.tsx` lines 140–223
- Can be combined with todo #065 (key fix) and #061 (lazy loading) in one pass

## Acceptance Criteria
- [ ] Single map loop renders thumbnail + path input + remove button per row
- [ ] Separate thumbnail strip block removed
- [ ] Visual result is equivalent (thumbnail visible next to each path)

## Work Log
- 2026-06-09: Identified by code-simplicity-reviewer agent in CE review of PR #131
