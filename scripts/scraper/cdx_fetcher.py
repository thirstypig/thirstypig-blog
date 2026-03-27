"""Step 1: Fetch all blog post URLs from the Wayback Machine CDX API."""

import json
import os
import re
from urllib.parse import unquote, urlparse

import aiohttp
import asyncio

from config import CDX_API_URL, DATA_DIR, DOMAINS, EXCLUDE_PATTERNS, POST_PATTERNS
from utils import url_to_slug


async def fetch_cdx_urls(session: aiohttp.ClientSession, domain: str, config: dict) -> list[dict]:
    """Fetch all archived URLs for a domain from the CDX API."""
    params = {
        'url': config['cdx_url'],
        'matchType': config['match_type'],
        'output': 'json',
        'fl': 'timestamp,original,statuscode,mimetype',
        'filter': ['statuscode:200', 'mimetype:text/html'],
        'collapse': 'urlkey',
        'limit': '10000',
    }

    print(f'  Fetching CDX data for {domain}...')
    async with session.get(CDX_API_URL, params=params) as resp:
        if resp.status != 200:
            print(f'  ERROR: CDX API returned {resp.status} for {domain}')
            return []
        data = await resp.json(content_type=None)

    if not data or len(data) < 2:
        print(f'  No results for {domain}')
        return []

    rows = data[1:]  # skip header
    print(f'  Found {len(rows)} total URLs for {domain}')

    # Filter to blog posts only
    post_pattern = re.compile(POST_PATTERNS.get(domain, r'.*'))
    posts = []

    for timestamp, original, statuscode, mimetype in rows:
        # Parse URL
        parsed = urlparse(original)
        path = unquote(parsed.path)

        # Exclude non-post URLs
        if any(excl in path.lower() for excl in EXCLUDE_PATTERNS):
            continue

        # Exclude query strings (comment pages, etc.)
        if parsed.query and ('showComment' in parsed.query or 'replytocom' in parsed.query):
            continue

        # Match post pattern
        clean_path = path.rstrip('/')
        if not post_pattern.search(clean_path) and not post_pattern.search(path):
            continue

        # Exclude bare month/year archive pages (e.g., /2009/08/)
        if re.match(r'^/\d{4}/\d{2}/?$', clean_path):
            continue
        if re.match(r'^/\d{4}/\d{2}/page/\d+/?$', clean_path):
            continue

        slug = url_to_slug(original)
        posts.append({
            'timestamp': timestamp,
            'url': original,
            'slug': slug,
            'domain': domain,
        })

    # Deduplicate by slug within same domain (keep latest timestamp)
    seen = {}
    for post in posts:
        key = post['slug']
        if key not in seen or post['timestamp'] > seen[key]['timestamp']:
            seen[key] = post

    unique_posts = list(seen.values())
    print(f'  Filtered to {len(unique_posts)} unique blog posts for {domain}')
    return unique_posts


async def fetch_all_urls() -> dict[str, list[dict]]:
    """Fetch URLs for all configured domains."""
    os.makedirs(DATA_DIR, exist_ok=True)
    cache_file = os.path.join(DATA_DIR, 'urls.json')

    # Check cache
    if os.path.exists(cache_file):
        print('Loading cached URLs from urls.json...')
        with open(cache_file) as f:
            return json.load(f)

    print('Fetching URLs from Wayback Machine CDX API...')
    all_urls = {}

    async with aiohttp.ClientSession() as session:
        for domain, config in DOMAINS.items():
            urls = await fetch_cdx_urls(session, domain, config)
            all_urls[domain] = urls

    total = sum(len(v) for v in all_urls.values())
    print(f'\nTotal blog posts found: {total}')

    # Save to cache
    with open(cache_file, 'w') as f:
        json.dump(all_urls, f, indent=2)
    print(f'Saved to {cache_file}')

    return all_urls


if __name__ == '__main__':
    asyncio.run(fetch_all_urls())
