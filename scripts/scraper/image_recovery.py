#!/usr/bin/env python3
"""
Image Recovery Script — Second pass to recover more images.

Strategies:
1. Blogspot images: try direct CDN at /s400/ and /s1600/ sizes
2. thethirstypig.com WP images: try Wayback with multiple timestamps
3. thirstypig.com WP images: search CDX for any archived version of the upload
4. Try Google Photos CDN as alternative for blogspot images
"""

import asyncio
import json
import os
import re
import sys
from urllib.parse import urlparse, unquote

import aiohttp

sys.path.insert(0, os.path.dirname(__file__))
from config import DATA_DIR, IMAGES_DIR, WAYBACK_BASE, MAX_CONCURRENT_REQUESTS
from image_downloader import is_image_content, get_image_filename
from utils import sanitize_filename


async def search_cdx_for_image(session: aiohttp.ClientSession, image_url: str) -> str | None:
    """Search the Wayback CDX API for any archived version of an image URL."""
    # Strip query params for cleaner search
    clean_url = re.sub(r'\?.*$', '', image_url)

    # Try exact URL first
    params = {
        'url': clean_url,
        'output': 'json',
        'fl': 'timestamp,original,statuscode,mimetype',
        'filter': ['statuscode:200'],
        'limit': '1',
    }

    try:
        async with session.get('https://web.archive.org/cdx/search/cdx',
                               params=params,
                               timeout=aiohttp.ClientTimeout(total=15)) as resp:
            if resp.status == 200:
                data = await resp.json(content_type=None)
                if data and len(data) > 1:
                    timestamp, original = data[1][0], data[1][1]
                    return f'{WAYBACK_BASE}/{timestamp}id_/{original}'
    except (aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError):
        pass

    # For wp-content URLs, try matching the filename with wildcard
    match = re.search(r'/([^/]+\.(jpg|jpeg|png|gif))', clean_url, re.IGNORECASE)
    if match and 'wp-content/uploads' in clean_url:
        filename = match.group(1)
        # Search for any version of this filename
        params['url'] = f'thirstypig.com/wp-content/uploads/*{filename}'
        params['matchType'] = 'prefix'
        # We need to reconstruct — try searching with the base filename
        base_name = re.sub(r'-\d+x\d+\.', '.', filename)  # strip dimension suffixes

        search_urls = [
            clean_url,
            clean_url.replace('http://', 'http://www.'),
        ]

        # Also try with/without dimension suffixes
        if base_name != filename:
            for url in list(search_urls):
                search_urls.append(url.replace(filename, base_name))

        for search_url in search_urls:
            params_copy = {**params, 'url': search_url, 'matchType': 'exact'}
            del params_copy['matchType']  # use default
            try:
                async with session.get('https://web.archive.org/cdx/search/cdx',
                                       params=params_copy,
                                       timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json(content_type=None)
                        if data and len(data) > 1:
                            timestamp, original = data[1][0], data[1][1]
                            return f'{WAYBACK_BASE}/{timestamp}id_/{original}'
            except (aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError):
                continue

    return None


def build_recovery_urls(image_url: str) -> list[str]:
    """Build exhaustive list of URLs to try for image recovery."""
    urls = []

    if 'bp.blogspot.com' in image_url:
        # Strategy: try multiple Blogspot CDN sizes directly
        # Original size as-is
        urls.append(image_url)
        # Try /s400/ version
        s400 = re.sub(r'/s\d+(-h)?/', '/s400/', image_url)
        if s400 != image_url:
            urls.append(s400)
        # /s1600/ for high res
        s1600 = re.sub(r'/s\d+(-h)?/', '/s1600/', image_url)
        if s1600 not in urls:
            urls.append(s1600)
        # /s0/ for original
        s0 = re.sub(r'/s\d+(-h)?/', '/s0/', image_url)
        if s0 not in urls:
            urls.append(s0)

        # Google Photos CDN alternative
        match = re.search(r'bp\.blogspot\.com/(_[^/]+)/([^/]+)/([^/]+)/([^/]+)/s\d+/(.+)', image_url)
        if match:
            gphoto_url = f'https://lh3.googleusercontent.com/{match.group(1)}/{match.group(2)}/{match.group(3)}/{match.group(4)}/{match.group(5)}'
            urls.append(gphoto_url)

        # Wayback fallback for each size
        for u in list(urls):
            urls.append(f'{WAYBACK_BASE}/0id_/{u}')

    elif 'wp.com' in image_url or 'thirstypig.com/wp-content' in image_url:
        # For WordPress images, try stripping resize params
        clean = re.sub(r'\?.*$', '', image_url)

        # Extract the actual path
        if 'wp.com' in image_url:
            match = re.search(r'wp\.com/(.*?/wp-content/uploads/.+?)(?:\?|$)', image_url)
            if match:
                direct = f'http://{match.group(1)}'
                clean = direct

        urls.append(f'{WAYBACK_BASE}/0id_/{clean}')

        # Try www variant
        if 'www.' not in clean:
            www = clean.replace('thirstypig.com', 'www.thirstypig.com')
            urls.append(f'{WAYBACK_BASE}/0id_/{www}')

        # Try without dimension suffix (e.g., -188x188.jpg -> .jpg)
        no_dims = re.sub(r'-\d+x\d+\.', '.', clean)
        if no_dims != clean:
            urls.append(f'{WAYBACK_BASE}/0id_/{no_dims}')

    elif 'thethirstypig.com/wp-content' in image_url:
        urls.append(f'{WAYBACK_BASE}/0id_/{image_url}')
        www = image_url.replace('thethirstypig.com', 'www.thethirstypig.com')
        urls.append(f'{WAYBACK_BASE}/0id_/{www}')
        if 'www.' not in image_url:
            urls.append(image_url)

    return urls


async def recover_single_image(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    image_url: str,
    slug: str,
    stats: dict,
) -> str | None:
    """Try to recover a single failed image."""
    filename = get_image_filename(image_url)
    save_dir = os.path.join(IMAGES_DIR, slug)
    save_path = os.path.join(save_dir, filename)

    # Skip if already exists
    if os.path.exists(save_path) and os.path.getsize(save_path) > 200:
        stats['already_exists'] += 1
        return f'/images/posts/{slug}/{filename}'

    # Skip non-image URLs (tracking pixels, badges, etc.)
    skip = ['fooddigger.com', 'urbanspoon.com', 'foodbuzz.com', 'linkwithin.com',
            'pixel.png', 'badge', 'score.ashx', 'transparent.gif']
    if any(s in image_url.lower() for s in skip):
        stats['skipped'] += 1
        return None

    urls_to_try = build_recovery_urls(image_url)

    async with semaphore:
        for url in urls_to_try:
            try:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30),
                                       allow_redirects=True) as resp:
                    if resp.status == 200:
                        content_type = resp.headers.get('content-type', '')
                        content = await resp.read()
                        if is_image_content(content, content_type):
                            os.makedirs(save_dir, exist_ok=True)
                            with open(save_path, 'wb') as f:
                                f.write(content)
                            stats['recovered'] += 1
                            return f'/images/posts/{slug}/{filename}'

                    if resp.status in (429, 503):
                        await asyncio.sleep(5)
            except (aiohttp.ClientError, asyncio.TimeoutError):
                continue

        # Last resort: CDX search for thirstypig.com images
        if 'thirstypig.com' in image_url:
            cdx_url = await search_cdx_for_image(session, image_url)
            if cdx_url:
                try:
                    async with session.get(cdx_url, timeout=aiohttp.ClientTimeout(total=30),
                                           allow_redirects=True) as resp:
                        if resp.status == 200:
                            content = await resp.read()
                            content_type = resp.headers.get('content-type', '')
                            if is_image_content(content, content_type):
                                os.makedirs(save_dir, exist_ok=True)
                                with open(save_path, 'wb') as f:
                                    f.write(content)
                                stats['recovered_cdx'] += 1
                                return f'/images/posts/{slug}/{filename}'
                except (aiohttp.ClientError, asyncio.TimeoutError):
                    pass

        stats['still_failed'] += 1
        return None


async def main():
    print('=' * 60)
    print('  IMAGE RECOVERY — SECOND PASS')
    print('=' * 60)

    # Load posts with image data
    with open(os.path.join(DATA_DIR, 'posts_with_images.json')) as f:
        posts = json.load(f)

    # Find all failed images
    failed_images = []  # (image_url, slug)
    for post in posts:
        images = post.get('images', [])
        local_images = post.get('local_images', [])
        slug = post.get('slug', 'unknown')

        # Images that weren't downloaded
        local_filenames = set()
        for li in local_images:
            if li:
                local_filenames.add(os.path.basename(li))

        for img_url in images:
            fname = get_image_filename(img_url)
            if fname not in local_filenames:
                failed_images.append((img_url, slug))

    print(f'\nFound {len(failed_images)} failed images to retry')

    # Categorize
    blogspot = [(u, s) for u, s in failed_images if 'bp.blogspot.com' in u]
    wp_thirsty = [(u, s) for u, s in failed_images if 'thirstypig.com' in u and 'thethirstypig' not in u]
    wp_the = [(u, s) for u, s in failed_images if 'thethirstypig.com' in u]
    other = [(u, s) for u, s in failed_images if (u, s) not in blogspot + wp_thirsty + wp_the]

    print(f'  Blogspot CDN: {len(blogspot)}')
    print(f'  thirstypig.com WP: {len(wp_thirsty)}')
    print(f'  thethirstypig.com WP: {len(wp_the)}')
    print(f'  Other: {len(other)}')

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    stats = {'recovered': 0, 'recovered_cdx': 0, 'already_exists': 0,
             'skipped': 0, 'still_failed': 0}

    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS, force_close=True)
    async with aiohttp.ClientSession(connector=connector) as session:
        # Process in batches
        total = len(failed_images)
        batch_size = 20

        for i in range(0, total, batch_size):
            batch = failed_images[i:i + batch_size]
            tasks = [
                recover_single_image(session, semaphore, url, slug, stats)
                for url, slug in batch
            ]
            results = await asyncio.gather(*tasks)

            done = min(i + batch_size, total)
            if done % 200 == 0 or done == total:
                print(f'  Progress: {done}/{total} '
                      f'(recovered: {stats["recovered"]}, cdx: {stats["recovered_cdx"]}, '
                      f'exists: {stats["already_exists"]}, skipped: {stats["skipped"]}, '
                      f'failed: {stats["still_failed"]})')

            # Rate limit
            if (i + batch_size) < total:
                await asyncio.sleep(0.5)

    total_recovered = stats['recovered'] + stats['recovered_cdx']
    print(f'\n=== RECOVERY COMPLETE ===')
    print(f'Recovered: {total_recovered} images')
    print(f'  Via direct/CDN: {stats["recovered"]}')
    print(f'  Via CDX search: {stats["recovered_cdx"]}')
    print(f'Already existed: {stats["already_exists"]}')
    print(f'Skipped (tracking pixels): {stats["skipped"]}')
    print(f'Still failed: {stats["still_failed"]}')

    # Update posts_with_images.json with newly recovered images
    if total_recovered > 0:
        print(f'\nUpdating post data with recovered images...')
        for post in posts:
            slug = post.get('slug', 'unknown')
            image_dir = os.path.join(IMAGES_DIR, slug)
            if os.path.exists(image_dir):
                local_files = os.listdir(image_dir)
                post['local_images'] = [
                    f'/images/posts/{slug}/{f}' for f in sorted(local_files)
                    if f.lower().endswith(('.jpg', '.jpeg', '.png', '.gif', '.webp'))
                ]
                if post['local_images']:
                    post['hero_image'] = post['local_images'][0]

        with open(os.path.join(DATA_DIR, 'posts_with_images.json'), 'w') as f:
            json.dump(posts, f, indent=2, ensure_ascii=False, default=str)
        print('Updated posts_with_images.json')


if __name__ == '__main__':
    asyncio.run(main())
