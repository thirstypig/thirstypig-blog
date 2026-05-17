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

from venues_io import load_venues

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
POSTS_DIR = REPO_ROOT / "src" / "content" / "posts"


# City aliases: venue.city → tokens that must appear in post city/region/location.
# Keep aliases broad enough to cover neighbourhood variants of the same metro,
# but never alias two *different* cities together (would cause cross-city false
# positives for chains).
CITY_ALIASES = {
    # Los Angeles metro — core city accepts posts tagged with any LA neighbourhood
    # so that a venue city of "Los Angeles" matches posts tagged "Hollywood",
    # "Koreatown", etc. (Night + Market is one example).
    "Los Angeles": ["los angeles", "la", "hollywood", "koreatown", "little tokyo",
                    "eagle rock", "los feliz", "studio city", "venice", "east la",
                    "echo park", "silver lake", "chinatown", "westwood", "brentwood",
                    "culver city", "santa monica", "beverly hills", "west hollywood"],
    "Downtown LA": ["downtown la", "dtla", "downtown los angeles", "los angeles", "la"],
    "Dtla": ["dtla", "downtown la", "downtown los angeles", "los angeles", "la"],
    "Downtown Los Angeles": ["downtown los angeles", "downtown la", "dtla", "los angeles", "la"],
    "Hollywood": ["hollywood", "los angeles", "la"],
    "Koreatown": ["koreatown", "los angeles", "la"],
    "Little Tokyo": ["little tokyo", "los angeles", "la"],
    "East LA": ["east la", "east los angeles", "los angeles", "la"],
    "Eagle Rock": ["eagle rock", "los angeles", "la"],
    "Los Feliz": ["los feliz", "los angeles", "la"],
    "Studio City": ["studio city", "los angeles", "la"],
    "Venice": ["venice", "los angeles", "la"],
    "Culver City": ["culver city"],
    "Santa Monica": ["santa monica"],
    "Beverly Hills": ["beverly hills"],
    "Malibu": ["malibu"],
    "Glendale": ["glendale"],
    "Burbank": ["burbank"],
    # SGV / East San Gabriel Valley
    "San Gabriel": ["san gabriel", "sgv"],
    "San Gabriel Valley": ["san gabriel valley", "sgv", "san gabriel"],
    "Sgv": ["sgv", "san gabriel"],
    "Rosemead": ["rosemead", "sgv"],
    "Monterey Park": ["monterey park", "sgv"],
    "Arcadia": ["arcadia"],
    "Alhambra": ["alhambra"],
    "Pasadena": ["pasadena"],
    "Temple City": ["temple city", "sgv"],
    "Rowland Heights": ["rowland heights"],
    "San Marino": ["san marino"],
    "Monrovia": ["monrovia"],
    "Sierra Madre": ["sierra madre"],
    # South Bay / OC / other SoCal
    "Torrance": ["torrance"],
    "Gardena": ["gardena"],
    "Long Beach": ["long beach"],
    "Irvine": ["irvine"],
    "Anaheim": ["anaheim", "orange county", "oc"],
    "Orange County": ["orange county", "oc"],
    "San Clemente": ["san clemente"],
    # Rest of US
    "Austin": ["austin"],
    "New York": ["new york", "nyc"],
    "Brooklyn": ["brooklyn", "new york", "nyc"],
    "San Francisco": ["san francisco", "sf", "bay area"],
    "Seattle": ["seattle"],
    "Las Vegas": ["las vegas"],
    "New Orleans": ["new orleans"],
    "San Antonio": ["san antonio"],
    "San Diego": ["san diego"],
    # International
    "Shanghai": ["shanghai"],
    "Taipei": ["taipei"],
    "Taichung": ["taichung"],
    "Tokyo": ["tokyo"],
    "Osaka": ["osaka"],
    "Sapporo": ["sapporo"],
    "Hong Kong": ["hong kong", "hk"],
    "Seoul": ["seoul"],
    "Bangkok": ["bangkok"],
    "Singapore": ["singapore"],
    "Ensenada": ["ensenada"],
    "Victoria": ["victoria"],
    # Remaining single-venue cities — each unique enough to not need metro-grouping
    "Harbin": ["harbin"],
    "Mammoth": ["mammoth"],
    "Honolulu": ["honolulu"],
    "La Jolla": ["la jolla"],
    "Downtown La": ["downtown la", "dtla", "los angeles", "la"],
    "Chino Hills": ["chino hills"],
    "Mpk": ["mpk", "menlo park"],
    "PuDong": ["pudong", "shanghai"],
    "Dalian": ["dalian"],
    "Ho Chi Minh City": ["ho chi minh", "saigon"],
    "Lockhart": ["lockhart"],
    "Manhattan": ["manhattan", "new york", "nyc"],
    "Napa": ["napa"],
    "Chinatown": ["chinatown", "los angeles", "la"],
    "Duarte": ["duarte"],
    "Echo Park": ["echo park", "los angeles", "la"],
    "Universal City": ["universal city", "los angeles", "la"],
    "Yountville": ["yountville"],
    "Solvang": ["solvang"],
    "Manhattan Beach": ["manhattan beach"],
    "Chicago": ["chicago"],
    "Costa Mesa": ["costa mesa"],
    "Redondo Beach": ["redondo beach"],
    "City of Industry": ["city of industry"],
    "West Hollywood": ["west hollywood"],
    "Covina": ["covina"],
    "Silver Lake": ["silver lake", "los angeles", "la"],
    "Sequim": ["sequim"],
    "Westwood": ["westwood", "los angeles", "la"],
    "Brentwood": ["brentwood", "los angeles", "la"],
}

# Short names that are too generic to safely phrase-match — would match any
# post mentioning the food type rather than the venue. "slab" and "yummy"
# are real specific restaurant names (Slab Hollywood, Yummy Pasadena) so
# they are NOT here — they rely on city confirmation to stay safe.
_GENERIC_NAMES = frozenset({"ramen", "pizza", "sushi"})

# Very short names (< 5 chars) that ARE specific restaurant names and are safe
# to match when city confirmation is strict. Without this allowlist they'd be
# rejected by the length gate.
_SHORT_NAME_ALLOWLIST = frozenset({"erb", "omg", "gaam", "goga", "slab"})

# All SGV city tokens — used so that a venue in Arcadia matches a post tagged
# city: San Gabriel Valley, or a venue in Monterey Park matches city: Arcadia.
# Within the SGV cluster, cross-city matching is safe because the venues are
# geographically contiguous and we don't have duplicate chain entries per city.
_SGV_TOKENS = frozenset({
    "arcadia", "alhambra", "san gabriel", "sgv", "san gabriel valley",
    "monterey park", "mpk",  # mpk = Monterey Park shorthand
    "temple city", "rowland heights", "san marino",
    "rosemead", "monrovia", "sierra madre", "el monte", "south pasadena",
    "east san gabriel valley",
})


def normalize(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def phrase_in_text(phrase: str, text: str) -> bool:
    """Word-boundary-aware phrase match.

    For ASCII-only phrases: anchors with \\b at the start and allows an
    optional plural suffix (e?s) at the end, so "stacked sandwich" matches
    "stacked sandwiches" but "public" does NOT match inside "republic"
    (the Korean provisional-government post false-positive).
    For CJK phrases: falls back to substring match because CJK has no ASCII
    word-boundary concept.
    """
    if re.search(r'[^\x00-\x7F]', phrase):
        return phrase in text
    return bool(re.search(r'\b' + re.escape(phrase) + r'(?:e?s)?\b', text))


def normalize_with_cjk(s: str) -> str:
    """Like normalize but keeps CJK characters (U+4E00–U+9FFF, U+AC00–U+D7A3,
    U+3040–U+30FF) so Chinese/Japanese/Korean venue names can match."""
    return re.sub(r"[^\w一-鿿぀-ヿ가-힣]+", " ",
                  (s or "").lower()).strip()


def venue_match_phrase(name: str) -> str | None:
    """Return the match phrase for a venue name, or None if it's too short
    or too generic to match safely.

    Threshold lowered from 8 → 5 ASCII chars so short well-known venue names
    (Bavel, Bestia, Ippudo, Yakiya…) can match. City confirmation (via
    CITY_ALIASES) is the second safety net for short names. CJK-only names
    are matched via a separate Unicode-aware path.
    """
    bare = re.sub(r"\([^)]*\)", "", name)
    # Try CJK-aware normalization first — if the name is primarily CJK keep it
    phrase_cjk = normalize_with_cjk(bare).strip()
    phrase_ascii = normalize(bare)
    # Use CJK phrase if it contains non-ASCII chars (i.e., the CJK pass kept them)
    phrase = phrase_cjk if phrase_cjk != phrase_ascii else phrase_ascii
    if not phrase or phrase in _GENERIC_NAMES:
        return None
    # Short allowlist bypasses the length gate for known specific restaurant
    # names (ERB, OMG, Gaam, Goga, Slab). City confirmation is required.
    if phrase in _SHORT_NAME_ALLOWLIST:
        return phrase
    # 5-char minimum for ASCII names; CJK ideographs are more distinctive so
    # even a single character is meaningful — but require ≥ 2 for safety.
    min_len = 2 if phrase_cjk != phrase_ascii else 5
    return phrase if len(phrase) >= min_len else None


def post_text(meta: dict, body_head: str) -> str:
    """Title + location + address only. Body text is too noisy — too many
    false positives from venues being mentioned in passing."""
    parts = [
        meta.get("title", ""),
        meta.get("location", ""),
        meta.get("address", ""),
    ]
    return normalize_with_cjk(" ".join(str(p) for p in parts if p))


def post_city_text(meta: dict) -> str:
    return normalize_with_cjk(" ".join(filter(None, [
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
    if not phrase_in_text(phrase, text):
        # Also try without a leading English article — "The Boiling Crab"
        # often appears in posts as just "Boiling Crab". Strip and re-check,
        # but only if the resulting bare phrase is still specific (≥ 5 chars
        # and not in the generic-name blocklist).
        short = phrase
        for article in ("the ", "a ", "an "):
            if phrase.startswith(article):
                short = phrase[len(article):]
                break
        if short == phrase or len(short) < 5 or short in _GENERIC_NAMES or not phrase_in_text(short, text):
            return False
        phrase = short

    # Confirm city overlap so the same chain across cities (e.g. Din Tai Fung
    # Arcadia vs Taipei) doesn't cross-match.
    city_text = post_city_text(post_meta)
    venue_city = venue.get("city", "")
    aliases = CITY_ALIASES.get(venue_city, [])

    # SGV cluster: allow cross-SGV matching when BOTH the venue city and the
    # post's city OR region field place it in the SGV cluster.
    # Rules:
    # 1. city: with any SGV token → cross-SGV match OK (existing rule)
    # 2. city: empty + region: generic-SGV token → cross-SGV match OK
    #    (older posts like Boiling Crab 2009 have no city: but do have
    #     region: San Gabriel Valley)
    # 3. city: specific non-SGV value (e.g. Pasadena) → do NOT let
    #    region: San Gabriel Valley override it; Pasadena is intentionally
    #    excluded from _SGV_TOKENS to prevent In-N-Out Rosemead ≠ Pasadena
    #    cross-matches.
    _GENERIC_SGV = frozenset({"sgv", "san gabriel valley", "east san gabriel valley"})
    post_city_field = normalize(str(post_meta.get("city", "") or ""))
    post_region_field = normalize(str(post_meta.get("region", "") or ""))
    venue_is_sgv = any(t in normalize(venue_city) for t in _SGV_TOKENS)
    post_city_is_sgv = any(t in post_city_field for t in _SGV_TOKENS)
    # Region may trigger SGV match only when city is absent or is itself a
    # generic SGV label — a specific city: Pasadena must NOT be overridden.
    city_absent_or_generic_sgv = (
        not post_city_field or any(t in post_city_field for t in _GENERIC_SGV)
    )
    post_region_is_generic_sgv = (
        city_absent_or_generic_sgv and
        any(t in post_region_field for t in _GENERIC_SGV)
    )
    if venue_is_sgv and (post_city_is_sgv or post_region_is_generic_sgv):
        return True

    if aliases:
        # Use city + region for the empty-city gate (not city_text, which
        # includes location: and is never truly empty for food posts).
        post_has_city_info = bool(post_city_field or post_region_field)
        if not post_has_city_info:
            # No city or region at all — only allow match for very specific
            # names (≥ 10 chars) to keep false-positive risk low.
            return len(phrase) >= 10
        if not any(a in city_text for a in aliases):
            return False
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apply", action="store_true",
                    help="Actually write changes (default is dry-run)")
    args = ap.parse_args()

    venues = load_venues()
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
