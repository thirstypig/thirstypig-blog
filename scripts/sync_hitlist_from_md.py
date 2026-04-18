#!/usr/bin/env python3
"""Parse a hitlist markdown file (Obsidian vault format) into YAML.

Designed for mobile-friendly thumb-typing in Obsidian. Minimum viable entry
is just a header + paragraph:

    ## Miopane, Pasadena
    Taiwanese bakery, Roman-style pizza.

Everything below is optional. Bullet lines of the form `- key: value` set
metadata. Recognized keys:

    priority        integer 1-3 (defaults to 2)
    neighborhood    string
    tags            comma-separated
    date_added      ISO date (defaults to today when missing)
    id              override (otherwise slugified from name)

    yelp, google, instagram, resy, opentable, website — URL entries in `links:`

Header format: `## Name, City` — the comma splits name from city. A header
without a comma is accepted but the `city` field becomes blank (validator
will reject, which is the correct behavior — city is required).

Usage:
    python3 scripts/sync_hitlist_from_md.py <input.md> <output.yaml>
    python3 scripts/sync_hitlist_from_md.py --stdin < input.md > output.yaml
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date

import yaml

LINK_KEYS = {"yelp", "google", "instagram", "resy", "opentable", "website"}
METADATA_KEYS = {"priority", "neighborhood", "tags", "date_added", "id", "notes"}
ALL_KEYS = LINK_KEYS | METADATA_KEYS

ENTRY_HEADER_RE = re.compile(r"^##\s+(.+?)\s*$")
META_LINE_RE = re.compile(r"^-\s+([a-z_]+):\s*(.*?)\s*$", re.IGNORECASE)


def slugify(name: str) -> str:
    """Derive a stable id from a restaurant name."""
    s = name.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def parse_header(line: str) -> tuple[str, str]:
    """Split '## Name, City' into (name, city). Handles names with commas by
    treating the LAST comma as the name/city boundary (so 'Ma's, Pasadena'
    works and 'Churrería El Moro, Los Angeles' also works)."""
    m = ENTRY_HEADER_RE.match(line)
    if not m:
        return "", ""
    text = m.group(1).strip()
    if "," in text:
        name, _, city = text.rpartition(",")
        return name.strip(), city.strip()
    return text, ""


def parse_tags(raw: str) -> list[str]:
    parts = [p.strip().lower().replace(" ", "-") for p in raw.split(",")]
    return [p for p in parts if p]


def parse_entry(name: str, city: str, lines: list[str]) -> dict:
    """Turn a header + body lines into a hitlist YAML entry dict."""
    entry: dict = {
        "name": name,
        "city": city,
        "priority": 2,
        "date_added": date.today().isoformat(),
        "links": {},
        "tags": [],
    }

    notes_parts: list[str] = []
    seen_metadata = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        m = META_LINE_RE.match(stripped)
        if m:
            seen_metadata = True
            key = m.group(1).lower()
            value = m.group(2).strip()

            if key == "priority":
                try:
                    p = int(value)
                    if 1 <= p <= 3:
                        entry["priority"] = p
                except ValueError:
                    pass  # validator will catch if we write a bad one; we just skip
            elif key == "tags":
                entry["tags"] = parse_tags(value)
            elif key == "notes":
                notes_parts.append(value)
            elif key in ("neighborhood", "id", "date_added"):
                entry[key] = value
            elif key in LINK_KEYS:
                entry["links"][key] = value
            # unknown keys silently ignored so the vault can evolve without
            # breaking builds
            continue

        # Non-metadata, non-empty line before any `- key:` lines = notes paragraph
        if not seen_metadata:
            notes_parts.append(stripped)

    notes = " ".join(notes_parts).strip()
    if notes:
        entry["notes"] = notes

    if "id" not in entry:
        entry["id"] = slugify(name)

    # Emit empty links/tags as missing so the YAML stays clean
    if not entry["links"]:
        del entry["links"]
    if not entry["tags"]:
        del entry["tags"]

    return entry


def parse_markdown(text: str) -> list[dict]:
    """Parse a full hitlist markdown document into a list of YAML entries."""
    entries: list[dict] = []
    current_name = ""
    current_city = ""
    current_lines: list[str] = []

    def flush():
        if current_name:
            entries.append(parse_entry(current_name, current_city, current_lines))

    for line in text.splitlines():
        if line.startswith("## "):
            flush()
            current_name, current_city = parse_header(line)
            current_lines = []
        else:
            current_lines.append(line)

    flush()
    return entries


def write_yaml(entries: list[dict], out) -> None:
    """Write entries in the canonical field order the admin UI produces."""
    # Field order mirrors HitListManager.tsx so diffs stay minimal across
    # admin-commits and vault-syncs.
    field_order = [
        "id", "name", "neighborhood", "city", "priority", "date_added",
        "notes", "links", "tags",
    ]
    ordered = []
    for e in entries:
        o = {}
        for k in field_order:
            if k in e:
                o[k] = e[k]
        ordered.append(o)

    yaml.dump(
        ordered,
        out,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        width=1000,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", nargs="?", help="Input markdown file (default: stdin)")
    parser.add_argument("output", nargs="?", help="Output YAML file (default: stdout)")
    parser.add_argument("--stdin", action="store_true", help="Read from stdin (ignored if input given)")
    args = parser.parse_args()

    if args.input and args.input != "-":
        with open(args.input, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = sys.stdin.read()

    entries = parse_markdown(text)

    if not entries:
        print("No entries found in markdown input", file=sys.stderr)
        return 1

    if args.output and args.output != "-":
        with open(args.output, "w", encoding="utf-8") as f:
            write_yaml(entries, f)
        print(f"Wrote {len(entries)} entries to {args.output}", file=sys.stderr)
    else:
        write_yaml(entries, sys.stdout)
        print(f"Wrote {len(entries)} entries to stdout", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
