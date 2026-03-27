"""Step 2: Fetch archived HTML for each blog post URL."""

import asyncio
import os
import time

import aiohttp

from config import (
    BACKOFF_BASE,
    BACKOFF_MAX,
    HTML_CACHE_DIR,
    MAX_CONCURRENT_REQUESTS,
    MAX_RETRIES,
    REQUEST_DELAY,
    WAYBACK_BASE,
)
from utils import sanitize_filename


async def fetch_single_post(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    post: dict,
    stats: dict,
) -> dict | None:
    """Fetch a single post's HTML from the Wayback Machine."""
    domain = post['domain']
    slug = post['slug']
    timestamp = post['timestamp']
    url = post['url']

    # Cache path
    domain_dir = os.path.join(HTML_CACHE_DIR, sanitize_filename(domain))
    os.makedirs(domain_dir, exist_ok=True)
    cache_file = os.path.join(domain_dir, f'{sanitize_filename(slug)}.html')

    # Check cache
    if os.path.exists(cache_file):
        stats['cached'] += 1
        with open(cache_file, 'r', encoding='utf-8', errors='replace') as f:
            html = f.read()
        return {**post, 'html': html, 'from_cache': True}

    # Fetch from Wayback Machine using id_ modifier (no toolbar injection)
    wayback_url = f'{WAYBACK_BASE}/{timestamp}id_/{url}'

    for attempt in range(MAX_RETRIES):
        async with semaphore:
            try:
                async with session.get(wayback_url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status == 200:
                        html = await resp.text(errors='replace')
                        # Save to cache
                        with open(cache_file, 'w', encoding='utf-8') as f:
                            f.write(html)
                        stats['fetched'] += 1
                        return {**post, 'html': html, 'from_cache': False}

                    elif resp.status in (429, 503):
                        # Rate limited or service unavailable - backoff
                        delay = min(BACKOFF_BASE * (2 ** attempt), BACKOFF_MAX)
                        stats['retries'] += 1
                        await asyncio.sleep(delay)
                        continue

                    else:
                        stats['errors'] += 1
                        if attempt == MAX_RETRIES - 1:
                            print(f'  FAILED ({resp.status}): {slug} [{domain}]')
                        return None

            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                delay = min(BACKOFF_BASE * (2 ** attempt), BACKOFF_MAX)
                stats['retries'] += 1
                if attempt == MAX_RETRIES - 1:
                    stats['errors'] += 1
                    print(f'  FAILED (timeout): {slug} [{domain}]')
                    return None
                await asyncio.sleep(delay)

    return None


async def fetch_all_posts(all_urls: dict[str, list[dict]]) -> list[dict]:
    """Fetch HTML for all blog posts across all domains."""
    os.makedirs(HTML_CACHE_DIR, exist_ok=True)

    # Flatten all posts
    all_posts = []
    for domain, posts in all_urls.items():
        all_posts.extend(posts)

    total = len(all_posts)
    print(f'\nFetching HTML for {total} posts...')

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    stats = {'fetched': 0, 'cached': 0, 'errors': 0, 'retries': 0}

    results = []
    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS, force_close=True)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Process in batches
        batch_size = 20
        for i in range(0, total, batch_size):
            batch = all_posts[i:i + batch_size]
            tasks = [
                fetch_single_post(session, semaphore, post, stats)
                for post in batch
            ]
            batch_results = await asyncio.gather(*tasks)
            results.extend([r for r in batch_results if r is not None])

            # Progress update
            done = min(i + batch_size, total)
            print(f'  Progress: {done}/{total} '
                  f'(fetched: {stats["fetched"]}, cached: {stats["cached"]}, '
                  f'errors: {stats["errors"]})')

            # Small delay between batches
            if i + batch_size < total and stats['fetched'] > 0:
                await asyncio.sleep(REQUEST_DELAY)

    print(f'\nFetch complete: {len(results)} posts retrieved '
          f'({stats["fetched"]} fetched, {stats["cached"]} cached, '
          f'{stats["errors"]} errors, {stats["retries"]} retries)')

    return results
