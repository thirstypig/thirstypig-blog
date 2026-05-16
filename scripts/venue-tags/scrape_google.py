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

from venues_io import VENUES_PATH, load_venues

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
USER_DATA_DIR = HERE / ".chrome-profile"

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
  // FID hex pair extraction. Three search surfaces in priority order:
  //   1. location.href — present when navigated via ?ftid= or after a /maps/place/Name/data=…!1s redirect.
  //   2. Anchor hrefs — present in URL-encoded form (`1s0x…%3A0x…`) inside the sign-in continuation
  //      link, which Maps renders even when the page URL stays at ?cid=N. This is the path that
  //      makes cid-driven scrapes self-healing.
  //   3. Anywhere in document HTML — last resort.
  const fidPattern = /(?:!1s|ftid=)(0x[0-9a-f]+:0x[0-9a-f]+)/;
  const fidEncPattern = /[!1]?1s(0x[0-9a-f]+)%3A(0x[0-9a-f]+)/i;
  let placeIdMatch = location.href.match(fidPattern);
  if (!placeIdMatch) {
    for (const a of document.querySelectorAll('a[href*="1s0x"]')) {
      const m = (a.getAttribute('href') || '').match(fidEncPattern);
      if (m) { placeIdMatch = [m[0], `${m[1]}:${m[2]}`]; break; }
    }
  }
  if (!placeIdMatch) {
    const m = (document.documentElement.outerHTML || '').match(fidPattern);
    if (m) placeIdMatch = m;
  }

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
    page: Page,
    query: str,
    key: str,
    place_id: str | None = None,
    cid: str | None = None,
) -> dict:
    # URL preference order:
    # 1. ftid=<FID hex pair> — direct, bypasses Google's multi-match resolution
    # 2. cid=<decimal> — Places API gives us this when FID hex isn't in the
    #    response. Maps redirects cid URLs to the full /maps/place/ URL
    #    (containing FID hex), so the EXTRACT_JS regex picks it up after load.
    # 3. ?q= search — ad-hoc queries; subject to multi-match failures.
    if place_id:
        url = f"https://www.google.com/maps/place/?ftid={place_id}"
    elif cid:
        url = f"https://www.google.com/maps/place/?cid={cid}"
    else:
        url = f"https://www.google.com/maps?q={quote_plus(query)}"
    log(f"  → {url}")
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_timeout(2500)
    # cid loads need extra time for Maps to rewrite the URL into the
    # /maps/place/Name/data=…!1s0x…:0x… form that contains the FID hex.
    # Without this, FID extraction silently falls back to None.
    if cid and not place_id:
        try:
            page.wait_for_url("**/maps/place/**/data=**", timeout=5000)
        except Exception:
            page.wait_for_timeout(2000)

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



def _writeback_place_id(key: str, place_id: str) -> None:
    """Inject `place_id: "<pid>"` into the venues.yaml entry for `key`,
    keeping the rest of the file byte-identical. Used after a cid-based
    scrape resolves the actual FID hex via the redirect."""
    import re as _re
    content = VENUES_PATH.read_text()
    pattern = _re.compile(
        r'(- key: ' + _re.escape(key) + r'\n(?:  [^\n]+\n)*?  query: "[^"]+")\n',
        _re.MULTILINE,
    )
    new_content = pattern.sub(rf'\1\n  place_id: "{place_id}"\n', content, count=1)
    if new_content != content:
        VENUES_PATH.write_text(new_content)
        log(f"    venues.yaml: wrote place_id for {key}")


def venues_to_scrape(
    args: argparse.Namespace,
) -> Iterable[tuple[str, str, str | None, str | None]]:
    """Yield (query, key, place_id, cid) per venue."""
    if args.query and args.key:
        yield args.query, args.key, None, None
        return
    venues = load_venues()
    for v in venues:
        if args.venue and v["key"] != args.venue:
            continue
        # Coerce cid to str — yaml may parse decimals as int
        cid = v.get("cid")
        cid = str(cid) if cid is not None else None
        yield v["query"], v["key"], v.get("place_id"), cid


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
    ap.add_argument(
        "--check-auth",
        action="store_true",
        help="Pre-flight: scrape one canary venue (Franklin BBQ) and exit 0 if "
             "auth is valid, 2 if auth-gated. Use before starting a long batch.",
    )
    args = ap.parse_args()

    if args.check_auth:
        args.query = "Franklin Barbecue Austin TX"
        args.key = "_auth_check"
        args.venue = None

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
    # Exit codes:
    #   0 — success (some venues may have 0 chips; that's venue-specific, not an error)
    #   1 — transient/network/selector failures (retry may help)
    #   2 — auth-gated ("limited view"); re-run bootstrap_profile.py and sign in
    transient_failures: list[str] = []
    auth_failures: list[str] = []
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

        for query, key, place_id, cid in targets:
            log(f"[{key}] {query}")
            try:
                record = scrape_venue(page, query, key, place_id=place_id, cid=cid)
            except Exception as exc:
                log(f"    ERROR: {exc}")
                transient_failures.append(key)
                continue

            if auth_gated(record):
                log(
                    "    ERROR: page has no Reviews tab or chips — looks like "
                    "Google's 'limited view'. Re-run bootstrap_profile.py and "
                    "make sure you're signed in."
                )
                auth_failures.append(key)
                continue

            out_path = DATA_DIR / f"{key}_chips.json"
            out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False))
            log(
                f"    {len(record['chips'])} chips → {out_path.name} "
                f"(top: {record['chips'][0]['label']}={record['chips'][0]['mention_count']})"
                if record["chips"]
                else f"    0 chips → {out_path.name} (low-coverage venue)"
            )

            # If we resolved a venue via cid (no place_id in venues.yaml) and
            # the scraper extracted the FID hex from the page URL, write it
            # back so future scrape + auto-tag runs can use it as a normal
            # ftid-keyed venue.
            extracted_pid = record.get("place_id")
            if extracted_pid and not place_id and cid:
                _writeback_place_id(key, extracted_pid)

        ctx.close()

    if auth_failures:
        log(f"AUTH-GATED (exit 2 — re-run bootstrap_profile.py): {auth_failures}")
    if transient_failures:
        log(f"FAILED (exit 1 — retry): {transient_failures}")
    if not auth_failures and not transient_failures:
        log("done.")
    if auth_failures:
        return 2
    if transient_failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
