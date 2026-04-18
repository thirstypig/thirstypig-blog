#!/usr/bin/env python3
"""Convert the current places-hitlist.yaml into the vault markdown format.

Use this once when seeding the external Obsidian vault repo — it produces a
hitlist.md that round-trips through sync_hitlist_from_md.py back to the same
YAML (with the same ids preserved via `- id:` overrides).

Usage:
    python3 scripts/seed_hitlist_vault.py > hitlist.md
    python3 scripts/seed_hitlist_vault.py src/data/places-hitlist.yaml > hitlist.md
"""

from __future__ import annotations

import sys
from pathlib import Path

import yaml

DEFAULT_INPUT = Path(__file__).parent.parent / "src" / "data" / "places-hitlist.yaml"


HEADER = """\
# Hit List

Edit this file in Obsidian on mobile. Commits push to the vault repo, which
triggers the main repo's sync workflow to convert markdown → YAML and rebuild
the site.

See docs/hitlist-vault-setup.md in the main repo for the schema and setup.

---
"""


def entry_to_md(entry: dict) -> str:
    name = entry.get("name", "")
    city = entry.get("city", "")
    header = f"## {name}, {city}" if city else f"## {name}"

    lines = [header]
    if notes := entry.get("notes"):
        lines.append(notes)

    # Emit the id override so round-trip stays stable even for slugified names
    if entry_id := entry.get("id"):
        lines.append(f"- id: {entry_id}")
    if neighborhood := entry.get("neighborhood"):
        lines.append(f"- neighborhood: {neighborhood}")
    if priority := entry.get("priority"):
        lines.append(f"- priority: {priority}")
    if date_added := entry.get("date_added"):
        lines.append(f"- date_added: {date_added}")
    if tags := entry.get("tags"):
        lines.append(f"- tags: {', '.join(tags)}")

    for key in ("yelp", "google", "instagram", "resy", "opentable", "website"):
        value = (entry.get("links") or {}).get(key)
        if value:
            lines.append(f"- {key}: {value}")

    return "\n".join(lines)


def main() -> int:
    input_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_INPUT
    with open(input_path, "r", encoding="utf-8") as f:
        entries = yaml.safe_load(f) or []

    if not isinstance(entries, list):
        print(f"{input_path}: expected a list at the top level", file=sys.stderr)
        return 1

    sys.stdout.write(HEADER)
    sys.stdout.write("\n")
    for e in entries:
        sys.stdout.write(entry_to_md(e))
        sys.stdout.write("\n\n")

    print(f"Emitted {len(entries)} entries from {input_path}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
