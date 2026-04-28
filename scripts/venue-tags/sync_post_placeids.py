"""Auto-populate `placeId` frontmatter in posts that match a venue in venues.yaml.

Match logic (high-confidence only — false positives are worse than misses):
- Substring match on the venue's `name` in the post's title OR location.
- Confirm with a city overlap if available.
- Skip posts that already have a `placeId`.

Output: prints a report of (matched, ambiguous, skipped) and applies edits
in --apply mode. Default is --dry-run.

Usage:
    # Preview matches
    scripts/venue-tags/venv/bin/python scripts/venue-tags/sync_post_placeids.py
    # Apply
    scripts/venue-tags/venv/bin/python scripts/venue-tags/sync_post_placeids.py --apply
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
POSTS_DIR = REPO_ROOT / "src" / "content" / "posts"
VENUES_PATH = HERE / "venues.yaml"


# Very conservative city aliases. Add as needed.
CITY_ALIASES = {
    "Los Angeles": ["los angeles", "la"],
    "San Gabriel": ["san gabriel", "sgv"],
    "Rosemead": ["rosemead", "sgv"],
    "Monterey Park": ["monterey park", "sgv"],
    "Pasadena": ["pasadena"],
    "Arcadia": ["arcadia"],
    "Alhambra": ["alhambra"],
    "Beverly Hills": ["beverly hills"],
    "Austin": ["austin"],
    "New York": ["new york", "nyc"],
    "Shanghai": ["shanghai"],
    "Taipei": ["taipei"],
    "Tokyo": ["tokyo"],
    "Hong Kong": ["hong kong", "hk"],
}


def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def venue_match_phrase(name: str) -> str | None:
    """The full venue name as a normalized phrase, with parens stripped.
    Returns None if the phrase is too short (< 8 chars after normalize)
    to be safely distinctive."""
    # Strip parenthetical disambiguators like "(Arcadia)" from the matcher
    # — they don't help phrase matching since the post probably says
    # "Din Tai Fung Arcadia" without parens.
    bare = re.sub(r"\([^)]*\)", "", name)
    phrase = normalize(bare)
    return phrase if len(phrase) >= 8 else None


def post_text(meta: dict, body_head: str) -> str:
    """Title + location + address only. Body text is too noisy — too many
    false positives from venues being mentioned in passing."""
    parts = [
        meta.get("title", ""),
        meta.get("location", ""),
        meta.get("address", ""),
    ]
    return normalize(" ".join(str(p) for p in parts if p))


def post_city_text(meta: dict) -> str:
    return normalize(" ".join(filter(None, [
        str(meta.get("city", "")),
        str(meta.get("region", "")),
        str(meta.get("location", "")),
    ])))


def parse_frontmatter(content: str) -> tuple[dict, str, int, int]:
    """Returns (meta, body, fm_start, fm_end_line_index)."""
    if not content.startswith("---\n") and not content.startswith("---\r\n"):
        return ({}, content, 0, 0)
    lines = content.split("\n")
    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break
    if end_idx is None:
        return ({}, content, 0, 0)
    fm_text = "\n".join(lines[1:end_idx])
    try:
        meta = yaml.safe_load(fm_text) or {}
    except Exception:
        meta = {}
    return meta, "\n".join(lines[end_idx + 1:]), 1, end_idx


def inject_place_id(content: str, place_id: str) -> str:
    """Insert `placeId: "<id>"` on the line right before the closing `---`."""
    lines = content.split("\n")
    if not lines or lines[0].strip() != "---":
        return content
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            lines.insert(i, f'placeId: "{place_id}"')
            return "\n".join(lines)
    return content


def venue_matches_post(venue: dict, post_meta: dict, post_body_head: str) -> bool:
    phrase = venue_match_phrase(venue["name"])
    if phrase is None:
        # Name too generic / too short for safe phrase matching.
        return False

    text = post_text(post_meta, post_body_head)

    # Phrase substring match — the full venue name (e.g. "din tai fung")
    # must appear as a contiguous substring in the post's title/location/
    # address. Massively cuts false positives compared to token matching.
    if phrase not in text:
        return False

    # Confirm city overlap so the same chain across cities (e.g. Din Tai Fung
    # Arcadia vs Taipei) doesn't cross-match.
    city_text = post_city_text(post_meta)
    aliases = CITY_ALIASES.get(venue.get("city", ""), [])
    if aliases:
        if not any(a in city_text for a in aliases):
            return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apply", action="store_true",
                    help="Actually write changes (default is dry-run)")
    args = ap.parse_args()

    venues = yaml.safe_load(VENUES_PATH.read_text())
    venues_with_id = [v for v in venues if v.get("place_id")]
    print(f"Loaded {len(venues_with_id)} venues with place_id "
          f"(of {len(venues)} total)\n")

    posts = sorted(POSTS_DIR.glob("*.md"))
    matched: list[tuple[str, str, str]] = []  # (post_filename, venue_key, place_id)
    skipped_already_set: list[str] = []

    for p in posts:
        content = p.read_text()
        meta, body, _, _ = parse_frontmatter(content)
        if not meta:
            continue
        if meta.get("placeId"):
            skipped_already_set.append(p.name)
            continue

        body_head = body[:500]
        for v in venues_with_id:
            if venue_matches_post(v, meta, body_head):
                matched.append((p.name, v["key"], v["place_id"]))
                if args.apply:
                    new_content = inject_place_id(content, v["place_id"])
                    p.write_text(new_content)
                break  # first match wins

    print(f"Matched: {len(matched)} posts")
    for fn, key, pid in matched:
        print(f"  {fn}  ←  {key}")
    print()
    print(f"Skipped (already had placeId): {len(skipped_already_set)}")
    for fn in skipped_already_set:
        print(f"  {fn}")
    print()

    if not args.apply:
        print("Dry run. Re-run with --apply to write changes.")
    else:
        print(f"Applied {len(matched)} edits.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
