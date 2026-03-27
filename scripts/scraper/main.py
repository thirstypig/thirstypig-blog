#!/usr/bin/env python3
"""
Thirsty Pig Wayback Machine Scraper

Scrapes blog posts from archived versions of thirstypig.com,
thethirstypig.com, and blog.thethirstypig.com.

Usage:
    python main.py              # Full pipeline
    python main.py --step cdx   # Just fetch URLs
    python main.py --step fetch # Just fetch HTML (requires URLs)
    python main.py --step parse # Just parse (requires HTML cache)
    python main.py --step images # Just download images (requires parsed data)
    python main.py --step write # Just write Markdown (requires parsed data)
    python main.py --test N     # Test with first N posts per domain
"""

import argparse
import asyncio
import json
import os
import sys
import time

# Add script directory to path
sys.path.insert(0, os.path.dirname(__file__))

from config import DATA_DIR, DOMAINS
from cdx_fetcher import fetch_all_urls
from post_fetcher import fetch_all_posts
from parsers import get_parser
from deduplicator import deduplicate_posts
from image_downloader import download_all_images
from markdown_writer import write_all_posts


def parse_html_posts(fetched_posts: list[dict]) -> list[dict]:
    """Step 3: Parse HTML into structured post data."""
    print(f'\nParsing {len(fetched_posts)} posts...')

    parsed = []
    failed = 0

    for post in fetched_posts:
        domain = post['domain']
        parser_name = DOMAINS[domain]['parser']
        parser = get_parser(parser_name)

        if not parser:
            print(f'  WARNING: No parser for {domain}')
            continue

        result = parser.parse(post['html'], post['url'], domain)
        if result:
            # Carry over metadata from fetch step
            result['slug'] = post['slug']
            result['timestamp'] = post['timestamp']
            parsed.append(result)
        else:
            failed += 1

    print(f'  Parsed: {len(parsed)}, Failed: {failed}')
    return parsed


async def run_pipeline(args):
    """Run the full scraping pipeline or individual steps."""
    start_time = time.time()
    step = args.step
    test_limit = args.test

    # Step 1: CDX URL Discovery
    if step in (None, 'cdx'):
        all_urls = await asyncio.to_thread(lambda: asyncio.run(fetch_all_urls()))
        if test_limit:
            for domain in all_urls:
                all_urls[domain] = all_urls[domain][:test_limit]
                print(f'  TEST MODE: Limited {domain} to {test_limit} posts')
    else:
        urls_file = os.path.join(DATA_DIR, 'urls.json')
        with open(urls_file) as f:
            all_urls = json.load(f)
        if test_limit:
            for domain in all_urls:
                all_urls[domain] = all_urls[domain][:test_limit]

    if step == 'cdx':
        return

    # Step 2: Fetch HTML
    if step in (None, 'fetch'):
        fetched_posts = await fetch_all_posts(all_urls)
        # Save intermediate result
        save_intermediate(fetched_posts, 'fetched_posts.json')
    else:
        fetched_posts = load_intermediate('fetched_posts.json')
        if fetched_posts is None:
            # Fetch if no cache
            fetched_posts = await fetch_all_posts(all_urls)
            save_intermediate(fetched_posts, 'fetched_posts.json')

    if step == 'fetch':
        return

    # Step 3: Parse HTML
    if step in (None, 'parse'):
        parsed_posts = parse_html_posts(fetched_posts)
        save_intermediate(parsed_posts, 'parsed_posts.json', exclude_keys=['html', 'body_html'])
    else:
        parsed_posts = load_intermediate('parsed_posts.json')
        if parsed_posts is None:
            parsed_posts = parse_html_posts(fetched_posts)
            save_intermediate(parsed_posts, 'parsed_posts.json', exclude_keys=['html', 'body_html'])

    if step == 'parse':
        return

    # Step 4: Deduplicate
    if step in (None, 'dedup'):
        unique_posts = deduplicate_posts(parsed_posts)
        save_intermediate(unique_posts, 'unique_posts.json')
    else:
        unique_posts = load_intermediate('unique_posts.json')
        if unique_posts is None:
            unique_posts = deduplicate_posts(parsed_posts)
            save_intermediate(unique_posts, 'unique_posts.json')

    if step == 'dedup':
        return

    # Step 5: Download images
    if step in (None, 'images'):
        unique_posts = await download_all_images(unique_posts)
        save_intermediate(unique_posts, 'posts_with_images.json')
    else:
        posts_with_images = load_intermediate('posts_with_images.json')
        if posts_with_images:
            unique_posts = posts_with_images

    if step == 'images':
        return

    # Step 6: Write Markdown
    if step in (None, 'write'):
        count = write_all_posts(unique_posts)

    elapsed = time.time() - start_time
    print(f'\nPipeline complete in {elapsed:.1f} seconds')


def save_intermediate(data: list[dict], filename: str, exclude_keys: list[str] | None = None):
    """Save intermediate results to JSON (excluding large fields)."""
    os.makedirs(DATA_DIR, exist_ok=True)
    filepath = os.path.join(DATA_DIR, filename)

    if exclude_keys:
        save_data = [{k: v for k, v in d.items() if k not in exclude_keys} for d in data]
    else:
        save_data = data

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(save_data, f, indent=2, ensure_ascii=False, default=str)


def load_intermediate(filename: str) -> list[dict] | None:
    """Load intermediate results from JSON."""
    filepath = os.path.join(DATA_DIR, filename)
    if os.path.exists(filepath):
        print(f'Loading cached {filename}...')
        with open(filepath, encoding='utf-8') as f:
            return json.load(f)
    return None


def main():
    parser = argparse.ArgumentParser(description='Thirsty Pig Wayback Machine Scraper')
    parser.add_argument('--step', choices=['cdx', 'fetch', 'parse', 'dedup', 'images', 'write'],
                       help='Run a specific step only')
    parser.add_argument('--test', type=int, metavar='N',
                       help='Test mode: limit to N posts per domain')
    parser.add_argument('--fresh', action='store_true',
                       help='Ignore cached data and re-fetch everything')
    args = parser.parse_args()

    if args.fresh:
        # Clear cached intermediate data (but not HTML cache)
        for f in ['urls.json', 'fetched_posts.json', 'parsed_posts.json',
                   'unique_posts.json', 'posts_with_images.json']:
            path = os.path.join(DATA_DIR, f)
            if os.path.exists(path):
                os.remove(path)
                print(f'Cleared {f}')

    print('=' * 60)
    print('  THIRSTY PIG WAYBACK MACHINE SCRAPER')
    print('=' * 60)

    asyncio.run(run_pipeline(args))


if __name__ == '__main__':
    main()
