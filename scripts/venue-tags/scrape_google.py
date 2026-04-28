"""Scrape Google Maps reviews for a venue.

DIY approach (no API costs): drives a real Chromium via Playwright through the
public Google Maps web UI, scrolls the reviews feed, expands truncated text,
and dumps every review's text + rating into JSON.

ToS caveat: scraping Google Maps violates their TOS. For personal-volume use
(low frequency, low concurrency) this rarely triggers blocks. If/when blocks
happen, the script logs the failure and exits cleanly — no retry storms.

Usage:
    scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py \\
        --query "Franklin Barbecue Austin TX" --key franklin-bbq-austin

    # Diagnostic mode: open browser non-headless and pause so you can inspect
    # the DOM. Use this on first run to verify selectors are still valid.
    scripts/venue-tags/venv/bin/python scripts/venue-tags/scrape_google.py \\
        --query "Franklin Barbecue Austin TX" --key franklin-bbq-austin --debug

Output: scripts/venue-tags/data/{key}_raw.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import quote_plus

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

HERE = Path(__file__).resolve().parent
DATA_DIR = HERE / "data"
DATA_DIR.mkdir(exist_ok=True)

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)


def log(msg: str) -> None:
    print(f"[scrape] {msg}", flush=True)


def extract_place_id(url: str) -> str | None:
    """Pull a Google place_id out of a Maps URL if present."""
    m = re.search(r"!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)", url)
    if m:
        return m.group(1)
    m = re.search(r"place_id:([A-Za-z0-9_-]+)", url)
    if m:
        return m.group(1)
    return None


def scrape(query: str, key: str, max_reviews: int = 200, debug: bool = False) -> dict:
    out: dict = {"key": key, "query": query, "reviews": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not debug)
        ctx = browser.new_context(user_agent=USER_AGENT, locale="en-US")
        page = ctx.new_page()

        url = f"https://www.google.com/maps/search/?api=1&query={quote_plus(query)}"
        log(f"opening {url}")
        page.goto(url, wait_until="domcontentloaded")

        try:
            page.wait_for_selector("h1", timeout=20_000)
        except PWTimeout:
            log("ERROR: page never produced an h1 (consent screen? blocked?)")
            if debug:
                page.screenshot(path=str(DATA_DIR / f"{key}_error.png"), full_page=True)
            browser.close()
            return out

        out["resolved_url"] = page.url
        out["place_id"] = extract_place_id(page.url)
        try:
            out["venue_name"] = page.locator("h1").first.inner_text(timeout=3000)
        except PWTimeout:
            out["venue_name"] = None
        log(f"resolved: {out.get('venue_name')!r}  place_id={out.get('place_id')}")

        # Click the Reviews tab. Try a few selector strategies in order; first
        # one to land wins.
        clicked = False
        for selector_try in [
            lambda: page.get_by_role("tab", name=re.compile(r"reviews", re.I)).first.click(timeout=4000),
            lambda: page.get_by_role("button", name=re.compile(r"reviews", re.I)).first.click(timeout=4000),
            lambda: page.locator('button[aria-label*="Reviews"]').first.click(timeout=4000),
        ]:
            try:
                selector_try()
                clicked = True
                log("clicked Reviews tab")
                break
            except Exception:
                continue
        if not clicked:
            log("WARNING: couldn't click Reviews tab — proceeding anyway in case reviews are already visible")

        page.wait_for_timeout(2500)

        # Identify the scroll container. The reviews feed is the last element
        # in the side panel that scrolls — we'll grab it heuristically and
        # confirm by feature-detecting that scrolling it loads more reviews.
        scroll_targets = page.locator('div[role="main"] div[tabindex="-1"]').all()
        scroll_el = scroll_targets[-1] if scroll_targets else None
        if not scroll_el:
            scroll_el = page.locator('div[role="main"]').last

        # Scroll loop. Stop when we hit max OR when reviews count plateaus.
        previous_count = -1
        plateau = 0
        for i in range(40):
            count = page.locator('[data-review-id], div[jsaction*="review"]').count()
            log(f"  scroll {i}: ~{count} review nodes")
            if count >= max_reviews:
                break
            if count == previous_count:
                plateau += 1
                if plateau >= 3:
                    log("  plateaued — assuming no more reviews")
                    break
            else:
                plateau = 0
            previous_count = count
            try:
                scroll_el.evaluate("el => el.scrollBy(0, el.scrollHeight)")
            except Exception:
                pass
            page.wait_for_timeout(1200)

        # Expand truncated reviews. Many reviews show "More" — clicking it
        # reveals the full text. Best effort; ignore individual failures.
        more_buttons = page.locator('button:has-text("More")').all()
        log(f"  expanding {len(more_buttons)} 'More' buttons")
        for btn in more_buttons:
            try:
                btn.click(timeout=400)
            except Exception:
                pass

        # Strategy: pull text from elements that look like review cards.
        # We try multiple shapes — first the [data-review-id] anchor (most
        # stable), then a fallback class-name approach as backup.
        cards = page.locator('div[data-review-id]').all()
        if not cards:
            log("  no [data-review-id] nodes — falling back to .jftiEf")
            cards = page.locator('div.jftiEf').all()

        log(f"  parsing {len(cards)} review cards")
        for card in cards:
            try:
                # Get full text content of the card
                full_text = card.inner_text(timeout=1000)
            except Exception:
                continue

            # Try to extract just the review text (the longest paragraph-ish
            # chunk in the card, after author + date). The card text usually
            # looks like: "Author\nLocal Guide · 50 reviews\n5 stars 1 month ago\n
            # The actual review text..."
            lines = [ln.strip() for ln in full_text.splitlines() if ln.strip()]
            if not lines:
                continue

            # Heuristic: review text is the longest line that isn't a star/date/
            # author meta line. Skip obvious meta patterns.
            meta_pat = re.compile(
                r"^(\d+\s+(stars?|months?\s+ago|years?\s+ago|days?\s+ago|weeks?\s+ago|reviews?)|"
                r"local\s+guide|new|google|edited|like|share|see\s+more|less|more)$",
                re.I,
            )
            text_candidates = [ln for ln in lines if not meta_pat.match(ln) and len(ln) > 30]
            text = max(text_candidates, key=len) if text_candidates else ""

            # Rating: look for "X stars" pattern inside the card
            rating: float | None = None
            stars_match = re.search(r"(\d)(?:\.\d)?\s+stars?", full_text, re.I)
            if stars_match:
                try:
                    rating = float(stars_match.group(1))
                except ValueError:
                    pass

            if text:
                out["reviews"].append({"text": text, "rating": rating})

        log(f"got {len(out['reviews'])} reviews with text")

        if debug:
            page.screenshot(path=str(DATA_DIR / f"{key}_final.png"), full_page=True)
            (DATA_DIR / f"{key}_dom.html").write_text(page.content())
            log(f"saved debug artifacts to {DATA_DIR}/{key}_*")

        browser.close()

    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", required=True)
    ap.add_argument("--key", required=True, help="filename slug for output")
    ap.add_argument("--max-reviews", type=int, default=150)
    ap.add_argument("--debug", action="store_true", help="non-headless + save DOM/screenshot")
    args = ap.parse_args()

    result = scrape(args.query, args.key, max_reviews=args.max_reviews, debug=args.debug)
    out_path = DATA_DIR / f"{args.key}_raw.json"
    out_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    log(f"wrote {out_path} ({len(result['reviews'])} reviews)")


if __name__ == "__main__":
    main()
