"""Curate untagged venues from the post corpus into a high-quality candidate list.

Step 1 of the "tag all venues" pipeline. Walks src/content/posts/, groups by
canonical (location, city), filters out:
- Already-tagged venues (placeId in frontmatter)
- Drafts
- Non-food venues by name pattern (hotels, spas, parks, etc.)
- Venues with fewer than --min-posts posts (default 2)

Outputs YAML-shaped entries to stdout. With the Places API in the pipeline
the `@lat,lng` query trick is no longer necessary (API disambiguates by
name + city alone), so queries are kept simple.

Usage:
    # Default: only venues with 2+ posts (high-confidence)
    scripts/venue-tags/venv/bin/python scripts/venue-tags/curate_candidates.py

    # Include single-post venues (broader sweep — paired with API lookup)
    scripts/venue-tags/venv/bin/python scripts/venue-tags/curate_candidates.py --min-posts 1

    # Cap the number of candidates emitted (sorted by post count desc)
    scripts/venue-tags/venv/bin/python scripts/venue-tags/curate_candidates.py --min-posts 1 --limit 100
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from collections import defaultdict
from typing import Optional

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
POSTS_DIR = REPO_ROOT / "src" / "content" / "posts"
VENUES_PATH = Path(__file__).resolve().parent / "venues.yaml"

# Skip venues whose name matches these patterns — they aren't restaurants.
#
# `\bpark(?!')\b` — Python's `\b` treats apostrophe as a non-word boundary,
# so the naive `\bpark\b` false-matches "Park's BBQ" (a real Korean BBQ in
# LA). The negative lookahead `(?!')` prevents matching "park" followed by
# an apostrophe.
NON_FOOD_PATTERNS = [
    r"\bhotel\b",
    r"\bspa\b",
    r"\bsalon\b",
    r"\bpark(?!')\b",
    r"\bmuseum\b",
    r"\btheatre\b",
    r"\btheater\b",
    r"\bairport\b",
    r"\bterminal\b",
    r"\bstadium\b",
    r"\barena\b",
    r"\bplaza\b",  # often shopping plazas, not venues
    r"\bgallery\b",
    r"\bequinox\b",  # gym chain
    r"\bmarriott\b",
    r"\bhilton\b",
    r"\bhyatt\b",
    r"\bsheraton\b",
    r"\bwestin\b",
    r"\binn\b",
    r"\bresort\b",
    r"\bservice\b",  # auto service, dry cleaning service, etc.
    r"\brepair\b",
    r"\bauto\b",
    r"^old town\b",  # neighborhoods
    r"^downtown\b",
    r"\bbeach$",
    r"\bcounty\b",  # county park, etc.
    r"\bfair\b",  # state fair, etc.
    r"\blibrary\b",
    r"\bmonument\b",
    r"\bhistoric\b",
    r"^the broad\b",  # The Broad museum (specific phrase to avoid false matches)
    r"^row dtla\b",  # arts district / shopping area, not a single venue
    r"^el pueblo\b",  # historic monument
]


def parse_frontmatter(text: str) -> tuple[Optional[dict], str]:
    if not text.startswith("---\n"):
        return None, ""
    end = text.find("\n---\n", 4)
    if end < 0:
        return None, ""
    try:
        return yaml.safe_load(text[4:end + 1]), text[end + 5:]
    except Exception:
        return None, ""


def is_non_food(name: str) -> bool:
    n = name.lower()
    return any(re.search(p, n) for p in NON_FOOD_PATTERNS)


def slugify(s: str) -> str:
    """Filename-safe slug for the venue key."""
    s = s.lower()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s[:50]


def main() -> int:
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-posts", type=int, default=2,
                    help="Min posts per venue to include (default 2 — high "
                         "confidence). Use 1 for broader API-driven sweeps.")
    ap.add_argument("--limit", type=int, default=0,
                    help="Cap candidates emitted (0 = no cap). Sorted by "
                         "post count desc.")
    args = ap.parse_args()

    # Index venues already in venues.yaml so we don't re-suggest them.
    existing_venues = yaml.safe_load(VENUES_PATH.read_text())
    existing_keys = {v["key"] for v in existing_venues}
    existing_query_substrs = {(v.get("name") or "").lower() for v in existing_venues}

    # Aggregate posts by (location, city), tracking sample coordinates +
    # post counts.
    bucket: dict[tuple[str, str], dict] = defaultdict(
        lambda: {"posts": [], "coords": None, "address": None}
    )
    skipped_already_tagged = 0
    skipped_draft = 0

    for p in sorted(POSTS_DIR.glob("*.md")):
        fm, _ = parse_frontmatter(p.read_text(encoding="utf-8", errors="replace"))
        if not fm:
            continue
        if fm.get("draft"):
            skipped_draft += 1
            continue
        if fm.get("placeId"):
            skipped_already_tagged += 1
            continue
        loc = (fm.get("location") or "").strip()
        city = (fm.get("city") or "").strip()
        if not loc or not city:
            continue
        key = (loc, city)
        bucket[key]["posts"].append(p.name)
        # Take coordinates from the first post that has them (good enough
        # for disambiguating Google Maps search).
        if bucket[key]["coords"] is None and isinstance(fm.get("coordinates"), dict):
            c = fm["coordinates"]
            if "lat" in c and "lng" in c:
                bucket[key]["coords"] = (float(c["lat"]), float(c["lng"]))
        if bucket[key]["address"] is None and fm.get("address"):
            bucket[key]["address"] = str(fm["address"]).strip()

    # Apply filters: drop non-food + single-post venues + duplicates of
    # existing venues.yaml entries.
    candidates: list[dict] = []
    skipped_nonfood = 0
    skipped_single_post = 0
    skipped_existing = 0

    for (loc, city), data in bucket.items():
        if is_non_food(loc):
            skipped_nonfood += 1
            continue
        if len(data["posts"]) < args.min_posts:
            skipped_single_post += 1
            continue
        # Skip if the venue name matches one already in venues.yaml
        if loc.lower() in existing_query_substrs:
            skipped_existing += 1
            continue
        # Simple `name city` query — Places API disambiguates well enough
        # that @lat,lng or address concatenation isn't needed (and the
        # @lat,lng form actually CONFUSED Google Maps' web search; not
        # an issue for the API but cleaner to leave it off).
        if data["address"]:
            query = f"{loc} {data['address']}"
        else:
            query = f"{loc} {city}"

        key = slugify(loc)[:35] + "-" + slugify(city)[:10]
        if key in existing_keys:
            # Same key collision — dedupe with a suffix
            key = key + "-2"
        candidates.append({
            "key": key,
            "name": loc,
            "city": city,
            "query": query,
            "post_count": len(data["posts"]),
        })

    # Sort by post count desc — biggest impact venues first
    candidates.sort(key=lambda c: -c["post_count"])
    if args.limit > 0:
        candidates = candidates[:args.limit]

    # --- Diagnostic header to stderr ---
    print(f"# Curated {len(candidates)} candidates", file=sys.stderr)
    print(f"# Total post-corpus venue groups: {len(bucket)}", file=sys.stderr)
    print(f"# Skipped: {skipped_nonfood} non-food, "
          f"{skipped_single_post} single-post, "
          f"{skipped_existing} already in venues.yaml, "
          f"{skipped_already_tagged} already-tagged-posts (no group)",
          file=sys.stderr)
    print("", file=sys.stderr)

    # --- YAML output to stdout ---
    print("# === Curated batch candidates ===")
    print(f"# Generated by curate_candidates.py — review + edit before appending to venues.yaml")

    def yaml_str(s: str) -> str:
        # Always double-quote so CJK + apostrophes + parens don't trip the parser.
        return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

    for c in candidates:
        print(f"\n# [{c['post_count']} posts]")
        print(f"- key: {c['key']}")
        print(f"  name: {yaml_str(c['name'])}")
        print(f"  city: {yaml_str(c['city'])}")
        print(f"  query: {yaml_str(c['query'])}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
