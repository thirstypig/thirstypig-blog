"""Look up Google Maps place_ids via the Places API (New) — no Chrome.

For venues missing `place_id` in venues.yaml, calls Google's
`places:searchText` endpoint, extracts the FID hex pair from the
returned `googleMapsUri`, and writes results back into venues.yaml.

This is the API-based alternative to lookup_place_ids.py (which uses
headed Chrome + Playwright). Use this script when you have a Places
API key configured. It scales much better — ~100ms per venue, no
session-trust gating, ~95%+ success rate including CJK queries.

Usage:
    # Dry-run (default — shows what would be looked up)
    scripts/venue-tags/venv/bin/python scripts/venue-tags/lookup_place_ids_api.py

    # Apply (writes place_ids back to venues.yaml)
    scripts/venue-tags/venv/bin/python scripts/venue-tags/lookup_place_ids_api.py --apply

Environment:
    GOOGLE_PLACES_API_KEY in .env at repo root. The key needs the
    "Places API (New)" service enabled. Free tier covers 10,000 calls
    per SKU per month — well above our needs.

Pricing reference: https://developers.google.com/maps/billing-and-pricing/pricing
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import yaml

from venues_io import VENUES_PATH, load_venues

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent.parent
ENV_PATH = REPO_ROOT / ".env"

PLACES_API_URL = "https://places.googleapis.com/v1/places:searchText"
# Field mask — only ask for what we need. Smaller responses, lower SKU.
FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.googleMapsUri"

# FID hex pair, e.g. !1s0x80c2c79f65c05a3f:0x36ae812febfdc501 — embedded
# in /maps/place/ URLs returned via the API's googleMapsUri field.
FID_HEX_RE = re.compile(r"!1s(0x[0-9a-f]+:0x[0-9a-f]+)")
# Decimal CID extracted from the new Places API's googleMapsUri, which
# is shaped `https://maps.google.com/?cid=12345...`. CID is the lower
# half of the FID hex, base-10 — useful as a navigation fallback even
# when we can't get the upper half (the Maps tile id) from the API.
CID_RE = re.compile(r"[?&]cid=(\d+)")


def load_env_var(name: str) -> str:
    """Parse .env at the repo root and return the named var. Raises if missing.

    Uses a tiny inline parser instead of pulling in python-dotenv as a dep —
    the .env shape here is one KEY=VALUE per line, no quoting tricks needed.
    """
    if not ENV_PATH.exists():
        raise SystemExit(f"ERROR: {ENV_PATH} not found")
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == name:
            return v.strip().strip('"').strip("'")
    raise SystemExit(f"ERROR: {name} not set in {ENV_PATH}")


def lookup_place(query: str, api_key: str) -> dict | None:
    """Call the Places API for one query. Returns the first matching place
    dict, or None if no match."""
    body = json.dumps({"textQuery": query}).encode("utf-8")
    req = urllib.request.Request(
        PLACES_API_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")[:200]
        print(f"    HTTP {e.code}: {body_text}", flush=True)
        return None
    except urllib.error.URLError as e:
        print(f"    network error: {e.reason}", flush=True)
        return None

    places = data.get("places") or []
    return places[0] if places else None


def extract_fid_hex(google_maps_uri: str | None) -> str | None:
    """Pull our pipeline's `0x...:0x...` place_id from the API's
    googleMapsUri field. Returns None if the URI doesn't contain it
    (the new Places API typically returns `?cid=...` URIs which don't
    embed the FID hex; in that case use the cid as a fallback)."""
    if not google_maps_uri:
        return None
    m = FID_HEX_RE.search(google_maps_uri)
    return m.group(1) if m else None


def load_missing_venues() -> list[tuple[str, str]]:
    """Return (key, query) for venues that need API lookup (no place_id and no cid)."""
    return [
        (v["key"], v["query"])
        for v in load_venues()
        if v.get("query") and not v.get("place_id") and not v.get("cid")
    ]


def write_yaml_field(updates: dict[str, dict[str, str]]) -> int:
    """Inject one or more `field: "value"` lines into matching venues.yaml
    entries. Surgical regex sub — keeps the rest of the file byte-identical.
    Returns count of successful injections (one increment per venue, not per
    field).

    `updates` is `{key: {field: value, ...}}`. Multiple fields per venue
    are written as separate consecutive lines."""
    content = VENUES_PATH.read_text()
    written = 0
    for k, fields in updates.items():
        pattern = re.compile(
            r'(- key: ' + re.escape(k) + r'\n(?:  [^\n]+\n)*?  query: "[^"]+")\n',
            re.MULTILINE,
        )
        injected_lines = "".join(f'\n  {f}: "{v}"' for f, v in fields.items())
        new_content = pattern.sub(rf'\1{injected_lines}\n', content, count=1)
        if new_content == content:
            print(f"    WARN: didn't inject {k} (regex miss)")
        else:
            content = new_content
            written += 1
    VENUES_PATH.write_text(content)
    return written


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apply", action="store_true",
                    help="Actually write place_ids back to venues.yaml. "
                         "Default is dry-run (shows what would happen).")
    ap.add_argument("--rate-sleep", type=float, default=0.1,
                    help="Seconds between API calls (default 0.1). The API "
                         "supports ~100 QPS so this is conservative.")
    args = ap.parse_args()

    api_key = load_env_var("GOOGLE_PLACES_API_KEY")
    targets = load_missing_venues()

    if not targets:
        print("All venues in venues.yaml already have place_id. Nothing to do.")
        return 0

    print(f"Looking up place_ids for {len(targets)} venues via Places API.")
    if not args.apply:
        print("(dry-run — pass --apply to write to venues.yaml)")
    print()

    # key -> dict of fields to write. May contain place_id (FID hex), cid
    # (decimal, used by scrape_google.py as navigation fallback), or both.
    updates: dict[str, dict[str, str]] = {}
    not_found: list[str] = []

    for idx, (key, query) in enumerate(targets, 1):
        print(f"  [{idx:2d}/{len(targets)}] {key:42s} ", end="", flush=True)
        place = lookup_place(query, api_key)
        if not place:
            print("→ <NOT FOUND>")
            not_found.append(key)
            continue
        uri = place.get("googleMapsUri") or ""
        fid = extract_fid_hex(uri)
        cid_match = CID_RE.search(uri)
        cid = cid_match.group(1) if cid_match else None

        if fid:
            print(f"→ FID {fid}")
            updates[key] = {"place_id": fid}
        elif cid:
            print(f"→ cid {cid}")
            updates[key] = {"cid": cid}
        else:
            chij = place.get("id", "").removeprefix("places/")
            print(f"→ ChIJ-only (no cid): {chij[:40]}…")
            not_found.append(f"{key} (ChIJ {chij})")

        if idx < len(targets):
            time.sleep(args.rate_sleep)

    fid_count = sum(1 for f in updates.values() if "place_id" in f)
    cid_count = sum(1 for f in updates.values() if "cid" in f and "place_id" not in f)

    print()
    print("=" * 60)
    print(f"Resolved with FID hex (place_id): {fid_count}")
    print(f"Resolved with CID only (cid): {cid_count}  "
          f"— scrape_google.py will navigate via ?cid= and extract FID on first run")
    print(f"Not found: {len(not_found)}")

    if args.apply and updates:
        n = write_yaml_field(updates)
        print(f"\nWrote {n} entries back to venues.yaml.")
    elif updates:
        print(f"\n(dry-run) Would write {len(updates)} entries.")
        print("Pass --apply to commit changes.")

    if not_found:
        print(f"\n{len(not_found)} venues had no API match or ChIJ-only with no cid:")
        for f in not_found:
            print(f"  - {f}")

    return 0 if not not_found else 1


if __name__ == "__main__":
    sys.exit(main())
