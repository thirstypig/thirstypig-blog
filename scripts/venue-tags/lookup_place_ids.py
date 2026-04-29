"""Look up Google Maps place_ids (FID hex pairs) for venues in venues.yaml
that don't have one yet.

Reads scripts/venue-tags/venues.yaml, finds entries missing `place_id`,
runs each `query` through Google Maps with headed Chrome (signed-in
profile), extracts the FID hex from the resolved /maps/place/ URL, and
prints the place_ids back so you can paste them into venues.yaml.

Headed because headless trips Google's session-trust scoring even with
valid auth cookies. Conservative wait between requests.

Usage:
    scripts/venue-tags/venv/bin/python scripts/venue-tags/lookup_place_ids.py
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus

import yaml
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

HERE = Path(__file__).resolve().parent
USER_DATA_DIR = HERE / ".chrome-profile"
VENUES_PATH = HERE / "venues.yaml"

PLACE_ID_RE = re.compile(r"!1s(0x[0-9a-f]+:0x[0-9a-f]+)")


def load_missing_venues() -> list[tuple[str, str, str, str]]:
    """Return (key, name, city, query) tuples for every venue in venues.yaml
    that doesn't yet have a place_id."""
    venues = yaml.safe_load(VENUES_PATH.read_text())
    out = []
    for v in venues:
        if v.get("place_id"):
            continue
        out.append((v["key"], v.get("name", ""), v.get("city", ""), v["query"]))
    return out


def clear_singleton_locks() -> None:
    for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        (USER_DATA_DIR / name).unlink(missing_ok=True)


def main() -> int:
    clear_singleton_locks()
    targets = load_missing_venues()
    if not targets:
        print("All venues in venues.yaml already have place_id. Nothing to do.")
        return 0
    print(f"Looking up place_ids for {len(targets)} venues missing one.")
    print()
    yaml_lines: list[str] = []
    failures: list[str] = []

    with Stealth().use_sync(sync_playwright()) as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            channel="chrome",
            headless=False,
            viewport={"width": 1280, "height": 900},
            locale="en-US",
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        for idx, (key, name, city, query) in enumerate(targets, 1):
            url = f"https://www.google.com/maps?q={quote_plus(query)}"
            print(f"  [{idx:2d}/{len(targets)}] {key:30s} ", end="", flush=True)
            page.goto(url, wait_until="domcontentloaded")
            # Wait for either the place-page redirect or a results list.
            for _ in range(20):
                if "/maps/place/" in page.url:
                    break
                page.wait_for_timeout(500)

            place_id = None
            if "/maps/place/" in page.url:
                m = PLACE_ID_RE.search(page.url)
                if m:
                    place_id = m.group(1)
            else:
                # Multi-match — click first result href and re-extract
                first_link = page.locator('article a[href*="/maps/place/"]').first
                if first_link.count():
                    href = first_link.get_attribute("href")
                    if href:
                        m = PLACE_ID_RE.search(href)
                        if m:
                            place_id = m.group(1)

            if place_id:
                print(f"→ {place_id}")
                yaml_lines.append(
                    f'\n- key: {key}\n  name: "{name}"\n  city: {city}\n  query: "{query}"\n  place_id: "{place_id}"'
                )
            else:
                print("→ <NOT FOUND>")
                failures.append(key)

            # Conservative rate limit; Google session-trust scoring is sensitive.
            if idx < len(targets):
                time.sleep(2)  # short — relying on the place_id-direct URL flow not the search

        ctx.close()

    print("\n" + "=" * 60)
    print(f"Found: {len(yaml_lines)}  Failed: {len(failures)}")
    if failures:
        print(f"Failures: {failures}")
    print("\n--- YAML to append to venues.yaml ---")
    for line in yaml_lines:
        print(line)
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
