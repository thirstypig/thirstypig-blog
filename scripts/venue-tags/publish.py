"""Copy chip JSONs from data/{key}_chips.json → public/venue-tags/{place_id}.json.

The data/ outputs are full scrape records (with diagnostic fields like
final_url, query, tab_labels). The public/ files are the consumer-facing
shape — slimmer, place_id-keyed, suitable for serving over CORS to
thirstypig.com pages and the planned tastemakers-iOS client.

Run after scrape_google.py:
    scripts/venue-tags/venv/bin/python scripts/venue-tags/publish.py

Output: public/venue-tags/{place_id}.json per venue with a place_id.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

from venues_io import load_venues

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
REPO_ROOT = HERE.parent.parent
PUBLIC_DIR = REPO_ROOT / "public" / "venue-tags"


# Fields copied from the chip JSON. Everything else (query, key, final_url,
# tab_labels) is internal diagnostic data that consumers don't need.
PASSTHROUGH_FIELDS = ("place_id", "venue_name", "chips", "scraped_at")


def main() -> int:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    chip_files = sorted(DATA_DIR.glob("*_chips.json"))
    if not chip_files:
        print(f"[publish] no *_chips.json found in {DATA_DIR}", file=sys.stderr)
        print(f"[publish] run scrape_google.py first.", file=sys.stderr)
        return 1

    # Index venues.yaml by key so we can attach city metadata to public records
    # without consumers having to load yaml separately.
    venues_by_key = {v["key"]: v for v in load_venues()}

    written: list[str] = []
    skipped: list[str] = []
    for src in chip_files:
        record = json.loads(src.read_text())
        place_id = record.get("place_id")
        if not place_id:
            skipped.append(f"{src.name} (no place_id)")
            continue
        venue_meta = venues_by_key.get(record.get("key"), {})
        public_record = {k: record.get(k) for k in PASSTHROUGH_FIELDS}
        public_record["city"] = venue_meta.get("city")
        public_record["key"] = record.get("key")
        out = PUBLIC_DIR / f"{place_id}.json"
        out.write_text(json.dumps(public_record, indent=2, ensure_ascii=False))
        written.append(f"{src.stem} → {out.relative_to(REPO_ROOT)}")

    for w in written:
        print(f"[publish] {w}")
    for s in skipped:
        print(f"[publish] SKIPPED {s}")
    print(f"[publish] {len(written)} file(s) written to {PUBLIC_DIR.relative_to(REPO_ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
