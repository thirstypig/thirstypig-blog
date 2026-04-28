"""Look up Google Maps place_ids (FID hex pairs) for a list of venue queries.

Headed Chrome with the existing signed-in profile. Conservative ~30s rate
between requests so we don't trip Google's "limited view" downgrade for
this session.

Output: prints YAML-shaped entries you can paste into venues.yaml.

Usage:
    scripts/venue-tags/venv/bin/python scripts/venue-tags/lookup_place_ids.py
"""

from __future__ import annotations

import re
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus

from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

HERE = Path(__file__).resolve().parent
USER_DATA_DIR = HERE / ".chrome-profile"

# 20 venues to expand to. Format: (key, name, city, query)
# 13 have posts in the corpus; 7 are aspirational.
VENUES = [
    # LA / SGV (15)
    ("langers-deli-la",        "Langer's Deli",            "Los Angeles",  "Langer's Deli 704 S Alvarado Los Angeles"),
    ("sushi-gen-la",           "Sushi Gen",                "Los Angeles",  "Sushi Gen Little Tokyo Los Angeles"),
    ("din-tai-fung-arcadia",   "Din Tai Fung (Arcadia)",   "Arcadia",      "Din Tai Fung Arcadia CA"),
    ("sapp-coffee-shop-la",    "Sapp Coffee Shop",         "Los Angeles",  "Sapp Coffee Shop Thai Town Los Angeles"),
    ("jitlada-la",             "Jitlada",                  "Los Angeles",  "Jitlada Hollywood Los Angeles"),
    ("howlin-rays-la",         "Howlin' Ray's",            "Los Angeles",  "Howlin Ray's Chinatown Los Angeles"),
    ("republique-la",          "Republique",               "Los Angeles",  "Republique 624 S La Brea Los Angeles"),
    ("bestia-la",              "Bestia",                   "Los Angeles",  "Bestia Arts District Los Angeles"),
    ("guisados-boyle-heights", "Guisados (Boyle Heights)", "Los Angeles",  "Guisados Boyle Heights Los Angeles"),
    ("newport-seafood-sgv",    "Newport Seafood",          "San Gabriel",  "Newport Seafood San Gabriel CA"),
    ("sea-harbour-sgv",        "Sea Harbour",              "Rosemead",     "Sea Harbour Seafood Rosemead CA"),
    ("elite-restaurant-sgv",   "Elite Restaurant",         "Monterey Park","Elite Restaurant Monterey Park CA"),
    ("pie-n-burger-pasadena",  "Pie 'n Burger",            "Pasadena",     "Pie 'n Burger Pasadena CA"),
    ("yangs-kitchen-alhambra", "Yang's Kitchen",           "Alhambra",     "Yang's Kitchen Alhambra CA"),
    ("spago-bh",               "Spago Beverly Hills",      "Beverly Hills","Spago Beverly Hills"),
    # Asia (5)
    ("din-tai-fung-taipei",    "Din Tai Fung (Taipei)",    "Taipei",       "Din Tai Fung Xinyi Taipei"),
    ("tim-ho-wan-hk",          "Tim Ho Wan",               "Hong Kong",    "Tim Ho Wan Sham Shui Po Hong Kong"),
    ("ippudo-tokyo",           "Ippudo (Roppongi)",        "Tokyo",        "Ippudo Roppongi Tokyo"),
    ("yangs-fried-dumplings",  "Yang's Fried Dumplings",   "Shanghai",     "Yang's Fried Dumplings 小杨生煎 Shanghai"),
    ("crystal-jade-shanghai",  "Crystal Jade La Mian",     "Shanghai",     "Crystal Jade La Mian Xiao Long Bao Shanghai"),
]

PLACE_ID_RE = re.compile(r"!1s(0x[0-9a-f]+:0x[0-9a-f]+)")


def clear_singleton_locks() -> None:
    for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        (USER_DATA_DIR / name).unlink(missing_ok=True)


def main() -> int:
    clear_singleton_locks()
    print(f"Looking up place_ids for {len(VENUES)} venues. ~30s per venue.")
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

        for idx, (key, name, city, query) in enumerate(VENUES, 1):
            url = f"https://www.google.com/maps?q={quote_plus(query)}"
            print(f"  [{idx:2d}/{len(VENUES)}] {key:30s} ", end="", flush=True)
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
            if idx < len(VENUES):
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
