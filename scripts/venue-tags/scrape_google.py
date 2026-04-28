"""Scrape Google Maps "Refine reviews" topic chips for venues.

Why chips, not raw reviews: validated 2026-04-27 that Google's pre-computed
chip widget yields better tags than naive N-gram extraction over scraped
review text. See README for the pivot rationale.

Why a persistent Chrome profile: cold/anonymous sessions see Google Maps'
"limited view" — no Reviews tab, no chips. Auth gates the chips. The
profile must be signed into Google once via bootstrap_profile.py.

Usage:
    # All MVP venues from venues.yaml
    scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py

    # Just one (useful for re-running after a Google UI change)
    scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py \\
        --venue franklin-bbq-austin

    # Ad-hoc venue not in venues.yaml
    scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py \\
        --query "Tatsu Ramen Sawtelle" --key tatsu-ramen-sawtelle

    # Show the browser (debug)
    scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py --headed

Output: scripts/venue-tags/data/{key}_chips.json per venue.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Iterable
from urllib.parse import quote_plus

import yaml
from playwright.sync_api import Page, sync_playwright
from playwright_stealth import Stealth

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
USER_DATA_DIR = HERE / ".chrome-profile"
VENUES_PATH = HERE / "venues.yaml"

DATA_DIR.mkdir(exist_ok=True)


def log(msg: str) -> None:
    print(f"[scrape] {msg}", flush=True)


def clear_stale_singleton_locks() -> None:
    """Chrome leaves SingletonLock + SingletonCookie + SingletonSocket
    in the user-data-dir to prevent multiple instances from corrupting the
    profile. When Playwright kills the browser abruptly (or a previous run
    crashed), the locks survive and abort the next launch with 'Failed to
    create a ProcessSingleton'. Removing the locks is safe — no profile
    data is touched."""
    for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
        (USER_DATA_DIR / name).unlink(missing_ok=True)


# Browser-side: wait for chips, expand "View N more", parse aria-labels.
# Assumes we're already on a /maps/place/ page — caller handles the
# results-list-to-place-page navigation, since SPA-click via JS .click()
# doesn't reliably trigger Maps' route handler.
EXTRACT_JS = r"""
async () => {
  // Wait for the chip radiogroup to appear (signed-in) or time out (auth-gated).
  for (let i = 0; i < 30; i++) {
    if (document.querySelector('[role="radio"][aria-label*="mentioned in"]')) break;
    await new Promise(r => setTimeout(r, 500));
  }

  // Expand the chip list if there's a "View N more Topics" toggle.
  const moreBtn = Array.from(document.querySelectorAll('button')).find(b =>
    /View \d+ more Topics?/i.test(b.textContent || ''));
  if (moreBtn) {
    moreBtn.click();
    await new Promise(r => setTimeout(r, 800));
  }

  const chipPattern = /^(.+?), mentioned in ([\d,]+) reviews?$/;
  const chips = Array.from(document.querySelectorAll('[role="radio"]'))
    .map(r => r.getAttribute('aria-label') || '')
    .map(label => {
      const m = label.match(chipPattern);
      return m ? { label: m[1], mention_count: parseInt(m[2].replace(/,/g, ''), 10) } : null;
    })
    .filter(Boolean);

  const tabs = Array.from(document.querySelectorAll('[role="tab"]'))
    .map(t => t.getAttribute('aria-label') || t.textContent || '');
  // Match either Google's data-param format (`!1s<hex>:<hex>`, embedded in
  // /maps/place/Foo/data=!4m...!1s0x...:0x...) or the cleaner ftid query
  // param we use directly (?ftid=0x...:0x...).
  const placeIdMatch = location.href.match(/(?:!1s|ftid=)(0x[0-9a-f]+:0x[0-9a-f]+)/);

  return {
    final_url: location.href,
    place_id: placeIdMatch ? placeIdMatch[1] : null,
    venue_name: (document.title || '').replace(/ - Google Maps$/, '') || null,
    tab_labels: tabs,
    chips,
  };
}
"""


# When chip data is sparse, Google pads the radiogroup with **amenity
# attributes** ("Serves dessert", "Offers takeout", "Wheelchair accessible")
# sourced from its place-attributes widget, not from review content. These
# follow predictable verb-prefix patterns. The naive "starts with capital"
# heuristic was too aggressive — it dropped real chips like "Bingsu"
# (Korean dessert) just because they're proper nouns. So we filter on the
# specific verb prefixes Google uses.
_AMENITY_PREFIXES = (
    "Serves ",
    "Offers ",
    "Has ",
    "Wheelchair",
    "No-contact",
    "Accepts ",
)


def looks_like_amenity(label: str) -> bool:
    return any(label.startswith(p) for p in _AMENITY_PREFIXES)


def scrape_venue(
    page: Page, query: str, key: str, place_id: str | None = None
) -> dict:
    # Prefer a direct /maps/place/?ftid=<place_id> URL when we have it —
    # bypasses Google's multi-match resolution, which session-trust-scoring
    # gates and which fails for chain venues. ?q= search is the fallback
    # for ad-hoc queries we don't have a place_id for yet.
    if place_id:
        url = f"https://www.google.com/maps/place/?ftid={place_id}"
    else:
        url = f"https://www.google.com/maps?q={quote_plus(query)}"
    log(f"  → {url}")
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)

    # ?q= flow may have landed on a /maps/search/ results list. Navigate to
    # the first result's href directly (page.goto, not click — Maps' SPA
    # route handler doesn't reliably pick up programmatic clicks).
    if "/maps/place/" not in page.url:
        try:
            page.wait_for_selector(
                'article a[href*="/maps/place/"]', timeout=10_000
            )
        except Exception:
            log(f"    WARNING: no article links appeared on results page")
        first_link = page.locator('article a[href*="/maps/place/"]').first
        href = first_link.get_attribute("href") if first_link.count() else None
        if href:
            log(f"    multi-match → navigating to first result")
            page.goto(href, wait_until="domcontentloaded")
            page.wait_for_timeout(1500)

    result = page.evaluate(EXTRACT_JS)

    raw_chips = result.get("chips") or []
    chips = [c for c in raw_chips if not looks_like_amenity(c["label"])]
    dropped = [c["label"] for c in raw_chips if looks_like_amenity(c["label"])]
    if dropped:
        log(f"    dropped amenity-like chips: {dropped}")

    return {
        "key": key,
        "query": query,
        # Prefer the place_id we passed in from venues.yaml (canonical) over
        # whatever the URL parser extracted. Fall back to the URL-extracted
        # value for ad-hoc queries that didn't supply one.
        "place_id": place_id or result.get("place_id"),
        "venue_name": result.get("venue_name"),
        "final_url": result.get("final_url"),
        "tab_labels": result.get("tab_labels") or [],
        "chips": chips,
        "scraped_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def auth_gated(record: dict) -> bool:
    """Detect the 'limited view' failure mode.

    Logged-in places have 4 tabs (Overview/Menu/Reviews/About) and at
    least some chips. Logged-out places have 2 tabs and no chips."""
    has_reviews_tab = any(
        "Reviews" in (label or "") for label in record.get("tab_labels", [])
    )
    return not has_reviews_tab and not record.get("chips")


def load_venues() -> list[dict]:
    return yaml.safe_load(VENUES_PATH.read_text())


def venues_to_scrape(
    args: argparse.Namespace,
) -> Iterable[tuple[str, str, str | None]]:
    if args.query and args.key:
        yield args.query, args.key, None
        return
    venues = load_venues()
    for v in venues:
        if args.venue and v["key"] != args.venue:
            continue
        yield v["query"], v["key"], v.get("place_id")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--venue", help="Scrape just this venue key from venues.yaml")
    ap.add_argument("--query", help="Ad-hoc Google Maps query (use with --key)")
    ap.add_argument("--key", help="Filename slug for ad-hoc query")
    ap.add_argument(
        "--headless",
        action="store_true",
        help="Run without a visible browser window. Often hits Google's "
        "'limited view' even with valid auth — Google detects headless "
        "Chrome's fingerprint and downgrades the page. Default is headed.",
    )
    args = ap.parse_args()

    if bool(args.query) != bool(args.key):
        ap.error("--query and --key must be used together")

    targets = list(venues_to_scrape(args))
    if not targets:
        ap.error(
            "No venues to scrape. Pass --venue, --query/--key, "
            "or check venues.yaml."
        )

    if not USER_DATA_DIR.exists() or not any(USER_DATA_DIR.iterdir()):
        log("WARNING: profile dir is empty. Run bootstrap_profile.py first.")

    log(f"scraping {len(targets)} venue(s)")
    failures: list[str] = []
    clear_stale_singleton_locks()

    # Stealth wraps the playwright instance to mask headless-Chrome fingerprint
    # signals (navigator.webdriver, sec-ch-ua, plugins, WebGL vendor, etc.).
    # Without this, headless runs hit Google's "limited view" even with valid
    # signed-in cookies — Google's session-trust scorer sees the automation
    # fingerprint and downgrades the page. Headed mode doesn't need it because
    # real-GPU rendering already produces a non-suspicious fingerprint.
    with Stealth().use_sync(sync_playwright()) as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            channel="chrome",
            headless=args.headless,
            viewport={"width": 1280, "height": 900},
            locale="en-US",
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        for query, key, place_id in targets:
            log(f"[{key}] {query}")
            try:
                record = scrape_venue(page, query, key, place_id=place_id)
            except Exception as exc:
                log(f"    ERROR: {exc}")
                failures.append(key)
                continue

            if auth_gated(record):
                log(
                    "    ERROR: page has no Reviews tab or chips — looks like "
                    "Google's 'limited view'. Re-run bootstrap_profile.py and "
                    "make sure you're signed in."
                )
                failures.append(key)
                continue

            out_path = DATA_DIR / f"{key}_chips.json"
            out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False))
            log(
                f"    {len(record['chips'])} chips → {out_path.name} "
                f"(top: {record['chips'][0]['label']}={record['chips'][0]['mention_count']})"
                if record["chips"]
                else f"    0 chips → {out_path.name} (low-coverage venue)"
            )

        ctx.close()

    if failures:
        log(f"FAILED: {failures}")
        return 1
    log("done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
