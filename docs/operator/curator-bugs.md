# Venue-tags curator — known bugs

## `\bpark\b` non-food filter false-matches "Park's BBQ"

`scripts/venue-tags/curate_candidates.py` excludes venues whose names
match `\bpark\b` to filter out actual parks. But Python regex treats `'`
(apostrophe) as a non-word character, so `\b` matches **inside**
`Park's` — meaning "Park's BBQ" (a real Korean BBQ in LA) is incorrectly
filtered.

Same class hits any venue name where the trigger word is followed by `'s`
or punctuation.

**Status:** not yet fixed.

**Likely fix:** add explicit lookahead so `\bpark\b(?!')` is the gate, or
switch to a tokenizer-based approach for non-food classification.

## Tightening filters before next sweep

The single-post candidate pool (552 venues) has limited-view failure
rates climbing batch-over-batch (9% in batch 7, 19% in batch 8). Before
the next sweep, add:

- `\bservice\b`
- `\brepair\b`
- `\bauto\b`
- length cap on sentence-shaped names

These remove auto shops, repair services, and OCR'd sentence fragments
from the candidate pool.
