#!/usr/bin/env python3
"""
Set the `location` field on IG posts that are missing it but have a
clear "Venue Name, City" title pattern.

Dry-run (default) — shows what would be set and prints the full candidate list.
--apply — writes the location field surgically to frontmatter.

Only touches HIGH-confidence extractions (short proper-noun phrase before
a single comma). Descriptive titles and ambiguous cases are listed but
never auto-set.

Usage:
    python3 scripts/set_ig_locations.py          # dry-run
    python3 scripts/set_ig_locations.py --apply  # write changes
"""

import re
import sys
import yaml
from pathlib import Path

POSTS_DIR = Path("src/content/posts")

VENUE_CITY_RE = re.compile(r'^(.{1,50}),\s+([A-Z][A-Za-z ,]+)$')
NON_VENUE_WORDS = re.compile(
    r'\b(mural|stadium|game|monument|sunrise|sunset|airport|cruise|ferry|'
    r'festival|parade|concert|winery|distillery|hotel|resort|bar none)\b',
    re.IGNORECASE,
)
BLOG_NAME = "The Thirsty Pig"
PLACEHOLDER_VENUES = {"Unknown Venue", "Unknown", "TBD"}

# Surgical frontmatter field insertion — sed-style, no yaml.dump
LOCATION_INSERT_RE = re.compile(r'^(tags:)', re.MULTILINE)


def extract_venue(title: str) -> tuple[str, str]:
    """Return (venue, confidence) from title. Confidence: 'high', 'skip', 'none'."""
    m = VENUE_CITY_RE.match(title)
    if not m:
        return "", "none"
    venue = m.group(1).strip()
    if venue in PLACEHOLDER_VENUES or venue == BLOG_NAME or NON_VENUE_WORDS.search(title):
        return venue, "skip"
    words = venue.split()
    all_title_cased = all(w[0].isupper() or not w[0].isascii() for w in words)
    if all_title_cased and 1 <= len(words) <= 6:
        return venue, "high"
    return venue, "review"


def set_location(filepath: Path, venue: str, apply: bool) -> bool:
    """Surgically insert `location: Venue` into frontmatter. Returns True if changed."""
    raw = filepath.read_text(encoding="utf-8")
    parts = raw.split("---", 2)
    if len(parts) < 3:
        return False
    fm_block = parts[1]

    if "location:" in fm_block:
        return False  # already set

    # Insert before `tags:` line (consistent field ordering)
    new_fm = LOCATION_INSERT_RE.sub(f'location: {venue}\n\\1', fm_block, count=1)
    if new_fm == fm_block:
        # fallback: append before end of frontmatter
        new_fm = fm_block.rstrip() + f"\nlocation: {venue}\n"

    new_raw = f"---{new_fm}---{parts[2]}"
    if apply:
        filepath.write_text(new_raw, encoding="utf-8")
    return True


def main():
    apply = "--apply" in sys.argv

    high, skip, review, no_venue = [], [], [], []

    for filepath in sorted(POSTS_DIR.glob("*.md"), reverse=True):
        raw = filepath.read_text(encoding="utf-8")
        parts = raw.split("---", 2)
        if len(parts) < 3:
            continue
        try:
            fm = yaml.safe_load(parts[1])
        except Exception:
            continue
        if not fm or fm.get("draft"):
            continue
        if fm.get("source") != "instagram":
            continue
        if fm.get("location"):
            continue

        title = str(fm.get("title", "")).strip()
        venue, confidence = extract_venue(title)

        entry = {"file": filepath.name, "title": title, "venue": venue}
        if confidence == "high":
            high.append(entry)
        elif confidence == "skip":
            skip.append(entry)
        elif confidence == "review":
            review.append(entry)
        else:
            no_venue.append(entry)

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"\n=== set_ig_locations [{mode}] ===\n")

    print(f"HIGH confidence — will {'set' if apply else 'set (run --apply)'} ({len(high)} posts):")
    applied = 0
    for e in high:
        status = ""
        if apply:
            changed = set_location(POSTS_DIR / e["file"], e["venue"], apply=True)
            status = " ✓" if changed else " (already set)"
            if changed:
                applied += 1
        print(f"  location: {e['venue']!r:35s} ← {e['file'][:50]}{status}")

    if review:
        print(f"\nREVIEW — ambiguous, not auto-set ({len(review)} posts):")
        for e in review:
            print(f"  ? {e['venue']!r:35s} ← {e['title']}")

    if skip:
        print(f"\nSKIP — matched pattern but not a venue ({len(skip)} posts):")
        for e in skip:
            print(f"  ✗ {e['venue']!r:35s} ← {e['title']}")

    print(f"\nNO VENUE — descriptive titles, needs manual research ({len(no_venue)} posts):")
    for e in no_venue[:10]:
        print(f"  – {e['title']}")
    if len(no_venue) > 10:
        print(f"  … and {len(no_venue) - 10} more")

    print(f"\nSummary:")
    print(f"  HIGH (auto-settable):    {len(high)}")
    print(f"  REVIEW (ambiguous):      {len(review)}")
    print(f"  SKIP (not a venue):      {len(skip)}")
    print(f"  NO VENUE (manual work):  {len(no_venue)}")
    if apply:
        print(f"  Written:                 {applied}")

    assert len(high) > 0, "ERROR: 0 high-confidence candidates — check POSTS_DIR or regex"

    if not apply:
        print("\nRun with --apply to write the HIGH-confidence locations.")


if __name__ == "__main__":
    main()
