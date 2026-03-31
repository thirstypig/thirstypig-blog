#!/usr/bin/env python3
"""
Detect potential Foursquare venue mismatches in blog posts.

Compares the post title against the location field. If there's zero
meaningful word overlap (ignoring common stop words), it flags the
post as a potential mismatch.
"""

import os
import re
import sys
from pathlib import Path

POSTS_DIR = Path(__file__).resolve().parent.parent / "src" / "content" / "posts"

# Common words to ignore when comparing title vs location
STOP_WORDS = {
    "the", "at", "in", "and", "of", "a", "an", "to", "for", "on", "with",
    "is", "it", "my", "our", "we", "i", "from", "by", "its", "was", "were",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "shall", "can",
    "this", "that", "these", "those", "not", "no", "nor", "but", "or",
    "so", "as", "if", "then", "than", "too", "very", "just", "about",
    "up", "out", "off", "over", "under", "after", "before", "between",
    "through", "during", "above", "below", "new", "old", "good", "great",
    "best", "first", "last", "big", "little", "more", "some", "all",
    "back", "down", "food", "restaurant", "bar", "cafe", "grill",
    "kitchen", "house", "place", "spot", "eat", "eating", "lunch",
    "dinner", "brunch", "breakfast", "meal", "night", "day", "trip",
    "visit", "time", "week", "weekend", "s", "la", "los", "angeles",
    "nyc", "sf", "city", "st", "ave", "blvd",
}


def tokenize(text):
    """Extract meaningful words from text, lowercased."""
    words = re.findall(r"[a-z0-9]+", text.lower())
    return {w for w in words if w not in STOP_WORDS and len(w) > 1}


def parse_frontmatter(filepath):
    """Parse YAML frontmatter from a markdown file (simple parser)."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    if not content.startswith("---"):
        return {}

    end = content.find("---", 3)
    if end == -1:
        return {}

    fm_text = content[3:end]
    result = {}

    for line in fm_text.split("\n"):
        # Simple key: value parsing (top-level only)
        match = re.match(r"^(\w[\w-]*)\s*:\s*(.+)$", line)
        if match:
            key = match.group(1).strip()
            value = match.group(2).strip().strip("'\"")
            result[key] = value

    return result


def detect_mismatches():
    mismatches = []
    total_with_location = 0

    for fname in sorted(os.listdir(POSTS_DIR)):
        if not fname.endswith(".md"):
            continue

        filepath = POSTS_DIR / fname
        fm = parse_frontmatter(filepath)

        title = fm.get("title", "")
        location = fm.get("location", "")

        if not title or not location:
            continue

        total_with_location += 1

        title_words = tokenize(title)
        location_words = tokenize(location)

        overlap = title_words & location_words

        if not overlap:
            city = fm.get("city", "N/A")
            mismatches.append({
                "filename": fname,
                "title": title,
                "location": location,
                "city": city,
            })

    return mismatches, total_with_location


def main():
    mismatches, total = detect_mismatches()

    print(f"Scanned posts with location data: {total}")
    print(f"Potential mismatches found: {len(mismatches)}")
    print()

    if not mismatches:
        print("No mismatches detected!")
        return

    print("=" * 90)
    print(f"{'#':<4} {'Filename':<60} {'City':<15}")
    print(f"     {'Title'}")
    print(f"     {'Location'}")
    print("=" * 90)

    for i, m in enumerate(mismatches, 1):
        print(f"{i:<4} {m['filename']:<60} {m['city']:<15}")
        print(f"     Title:    {m['title']}")
        print(f"     Location: {m['location']}")
        print("-" * 90)


if __name__ == "__main__":
    main()
