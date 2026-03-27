"""Step 5: Download images from the Wayback Machine and live CDNs."""

import asyncio
import os
import re
from urllib.parse import urlparse, unquote

import aiohttp

from config import IMAGES_DIR, MAX_CONCURRENT_REQUESTS, WAYBACK_BASE
from utils import sanitize_filename


def get_image_filename(url: str) -> str:
    """Extract a clean filename from an image URL."""
    parsed = urlparse(url)
    path = unquote(parsed.path)
    filename = os.path.basename(path)

    # Clean up the filename
    filename = sanitize_filename(filename)
    if not filename:
        filename = 'image.jpg'

    # Ensure it has an extension
    if '.' not in filename:
        filename += '.jpg'

    return filename


def build_urls_to_try(image_url: str, timestamp: str) -> list[str]:
    """Build ordered list of URLs to try for downloading an image."""
    urls = []

    # For Blogspot images (bp.blogspot.com) — try direct CDN first (still alive!)
    if 'bp.blogspot.com' in image_url or 'blogspot.com' in image_url:
        # Direct from Google's CDN (still serves old Blogger images)
        urls.append(image_url)
        # Try upgrading to full resolution
        upgraded = re.sub(r'/s\d+(-h)?/', '/s1600/', image_url)
        if upgraded != image_url:
            urls.append(upgraded)
        # Wayback as fallback
        urls.append(f'{WAYBACK_BASE}/{timestamp}id_/{image_url}')
        urls.append(f'{WAYBACK_BASE}/0id_/{image_url}')
        return urls

    # For Google user content (alternative Blogspot CDN)
    if 'googleusercontent.com' in image_url:
        urls.append(image_url)
        urls.append(f'{WAYBACK_BASE}/0id_/{image_url}')
        return urls

    # For thethirstypig.com WordPress uploads — try Wayback
    if 'thethirstypig.com' in image_url and 'wp-content' in image_url:
        urls.append(f'{WAYBACK_BASE}/{timestamp}id_/{image_url}')
        urls.append(f'{WAYBACK_BASE}/0id_/{image_url}')
        # Try www variant
        if 'www.' not in image_url:
            www_url = image_url.replace('thethirstypig.com', 'www.thethirstypig.com')
            urls.append(f'{WAYBACK_BASE}/{timestamp}id_/{www_url}')
            urls.append(f'{WAYBACK_BASE}/0id_/{www_url}')
        return urls

    # For thirstypig.com wp.com CDN images — these are mostly gone,
    # but try a few strategies
    if 'wp.com' in image_url:
        # Try with and without query params
        clean_url = re.sub(r'\?.*$', '', image_url)
        urls.append(f'{WAYBACK_BASE}/{timestamp}id_/{image_url}')
        urls.append(f'{WAYBACK_BASE}/0id_/{image_url}')
        if clean_url != image_url:
            urls.append(f'{WAYBACK_BASE}/{timestamp}id_/{clean_url}')
            urls.append(f'{WAYBACK_BASE}/0id_/{clean_url}')

        # Extract original wp-content path and try direct
        match = re.search(r'wp\.com/(.*?/wp-content/uploads/.+?)(?:\?|$)', image_url)
        if match:
            direct = f'http://{match.group(1)}'
            urls.append(f'{WAYBACK_BASE}/{timestamp}id_/{direct}')
            urls.append(f'{WAYBACK_BASE}/0id_/{direct}')
        return urls

    # Generic fallback — Wayback then direct
    urls.append(f'{WAYBACK_BASE}/{timestamp}id_/{image_url}')
    urls.append(f'{WAYBACK_BASE}/0id_/{image_url}')
    urls.append(image_url)
    return urls


# JPEG magic bytes (multiple variants)
JPEG_MAGIC = (b'\xff\xd8\xff\xe0', b'\xff\xd8\xff\xe1', b'\xff\xd8\xff\xee',
              b'\xff\xd8\xff\xdb', b'\xff\xd8\xff\xed')


def is_image_content(content: bytes, content_type: str) -> bool:
    """Verify that downloaded content is actually an image."""
    if len(content) < 200:
        return False
    if 'image' in content_type:
        return True
    # Check magic bytes
    if content[:4] in JPEG_MAGIC:
        return True
    if content[:4] == b'\x89PNG':
        return True
    if content[:4] == b'GIF8':
        return True
    if content[:4] == b'RIFF' and content[8:12] == b'WEBP':
        return True
    return False


async def download_image(
    session: aiohttp.ClientSession,
    semaphore: asyncio.Semaphore,
    image_url: str,
    save_dir: str,
    timestamp: str,
    stats: dict,
) -> str | None:
    """Download a single image and return the local path."""
    filename = get_image_filename(image_url)
    save_path = os.path.join(save_dir, filename)

    # Skip if already downloaded
    if os.path.exists(save_path) and os.path.getsize(save_path) > 200:
        stats['cached'] += 1
        return f'/images/posts/{os.path.basename(save_dir)}/{filename}'

    urls_to_try = build_urls_to_try(image_url, timestamp)

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
                            stats['downloaded'] += 1
                            return f'/images/posts/{os.path.basename(save_dir)}/{filename}'

                    if resp.status in (429, 503):
                        await asyncio.sleep(3)
                        continue

            except (aiohttp.ClientError, asyncio.TimeoutError):
                continue

        stats['failed'] += 1
        return None


async def download_all_images(posts: list[dict]) -> list[dict]:
    """Download all images for all posts."""
    total_images = sum(len(post.get('images', [])) for post in posts)
    print(f'\nDownloading images for {len(posts)} posts ({total_images} images total)...')

    if total_images == 0:
        return posts

    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    stats = {'downloaded': 0, 'cached': 0, 'failed': 0}

    connector = aiohttp.TCPConnector(limit=MAX_CONCURRENT_REQUESTS, force_close=True)
    async with aiohttp.ClientSession(connector=connector) as session:
        for i, post in enumerate(posts):
            images = post.get('images', [])
            if not images:
                continue

            slug = post.get('slug', 'unknown')
            timestamp = post.get('timestamp', '20170101000000')
            save_dir = os.path.join(IMAGES_DIR, slug)

            tasks = [
                download_image(session, semaphore, img_url, save_dir, timestamp, stats)
                for img_url in images
            ]
            local_paths = await asyncio.gather(*tasks)

            # Update post with local image paths
            post['local_images'] = [p for p in local_paths if p is not None]
            if post['local_images']:
                post['hero_image'] = post['local_images'][0]

            # Progress
            if (i + 1) % 50 == 0 or i == len(posts) - 1:
                print(f'  Progress: {i + 1}/{len(posts)} posts '
                      f'(downloaded: {stats["downloaded"]}, cached: {stats["cached"]}, '
                      f'failed: {stats["failed"]})')

            # Small delay between posts to be polite
            if (i + 1) % 10 == 0:
                await asyncio.sleep(0.5)

    print(f'\nImage download complete: {stats["downloaded"]} downloaded, '
          f'{stats["cached"]} cached, {stats["failed"]} failed')

    return posts
