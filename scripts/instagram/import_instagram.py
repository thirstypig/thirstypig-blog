#!/usr/bin/env python3
"""
Instagram Data Export Importer for The Thirsty Pig.

Reads the Instagram JSON export, extracts posts with media,
deduplicates against existing blog posts, and generates Markdown files.
"""

import glob
import json
import os
import re
import shutil
import sys
from datetime import datetime
from difflib import SequenceMatcher

import yaml

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(SCRIPT_DIR, 'data')
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
CONTENT_DIR = os.path.join(PROJECT_ROOT, 'src', 'content', 'posts')
IMAGES_DIR = os.path.join(PROJECT_ROOT, 'public', 'images', 'posts')
VIDEOS_DIR = os.path.join(PROJECT_ROOT, 'public', 'videos', 'posts')


def fix_encoding(text: str) -> str:
    """Fix Instagram's broken UTF-8 encoding (stored as Latin-1 escaped)."""
    if not text:
        return ''
    try:
        return text.encode('latin-1').decode('utf-8')
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


def get_post_date(post: dict) -> datetime:
    """Extract the best available date from an Instagram post."""
    # Try post-level timestamp
    ts = post.get('creation_timestamp', 0)
    if ts > 86400:
        return datetime.fromtimestamp(ts)

    # Fallback to first media's timestamp
    media = post.get('media', [])
    for m in media:
        mts = m.get('creation_timestamp', 0)
        if mts > 86400:
            return datetime.fromtimestamp(mts)

    # Fallback to folder date from URI
    for m in media:
        match = re.search(r'media/posts/(\d{4})(\d{2})/', m.get('uri', ''))
        if match:
            return datetime(int(match.group(1)), int(match.group(2)), 15)  # mid-month

    return datetime(2020, 1, 1)


def extract_hashtags(text: str) -> list[str]:
    """Extract hashtags from caption text."""
    return [tag.lower() for tag in re.findall(r'#(\w+)', text)]


def extract_mentions(text: str) -> list[str]:
    """Extract @mentions from caption text."""
    return [m.lower() for m in re.findall(r'@(\w+)', text)]


def clean_caption(text: str) -> str:
    """Clean up caption for use as Markdown body."""
    text = fix_encoding(text)
    # Remove trailing hashtag blocks (keep inline ones)
    text = re.sub(r'\n\s*(?:#\w+\s*)+$', '', text)
    # Remove excessive hashtag spam (more than 5 consecutive)
    text = re.sub(r'(?:\s*#\w+){5,}', '', text)
    # Clean up whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def make_slug(title: str, date: datetime) -> str:
    """Generate a URL-safe slug from title and date."""
    # Try to extract restaurant name from caption
    text = title.split('.')[0] if '.' in title else title
    text = text.split('!')[0] if '!' in text else text
    # Remove mentions and hashtags
    text = re.sub(r'@\w+', '', text)
    text = re.sub(r'#\w+', '', text)
    # Slugify
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'\s+', '-', text)
    text = re.sub(r'-+', '-', text).strip('-')
    # Limit length
    text = text[:60].rstrip('-')

    if not text or len(text) < 3:
        text = f'instagram-{date.strftime("%H%M")}'

    return f'{date.strftime("%Y-%m-%d")}-{text}'


def extract_location(post: dict) -> dict:
    """Extract GPS location from media metadata."""
    for m in post.get('media', []):
        exif = m.get('media_metadata', {}).get('photo_metadata', {}).get('exif_data', [])
        for e in exif:
            if 'latitude' in e and 'longitude' in e:
                return {'lat': e['latitude'], 'lng': e['longitude']}
    return {}


# City-to-region mapping for auto-categorization
CITY_REGIONS = {
    # LA area
    'los angeles': 'Los Angeles', 'la': 'Los Angeles', 'dtla': 'Los Angeles',
    'downtown la': 'Los Angeles', 'koreatown': 'Los Angeles', 'ktown': 'Los Angeles',
    'hollywood': 'Los Angeles', 'west hollywood': 'Los Angeles', 'weho': 'Los Angeles',
    'silver lake': 'Los Angeles', 'echo park': 'Los Angeles', 'los feliz': 'Los Angeles',
    'highland park': 'Los Angeles', 'eagle rock': 'Los Angeles',
    'venice': 'Los Angeles', 'santa monica': 'Los Angeles', 'culver city': 'Los Angeles',
    'beverly hills': 'Los Angeles', 'brentwood': 'Los Angeles', 'westwood': 'Los Angeles',
    'sawtelle': 'Los Angeles', 'mar vista': 'Los Angeles',
    # SGV
    'pasadena': 'San Gabriel Valley', 'alhambra': 'San Gabriel Valley',
    'arcadia': 'San Gabriel Valley', 'monterey park': 'San Gabriel Valley',
    'san gabriel': 'San Gabriel Valley', 'rosemead': 'San Gabriel Valley',
    'rowland heights': 'San Gabriel Valley', 'temple city': 'San Gabriel Valley',
    'monrovia': 'San Gabriel Valley', 'duarte': 'San Gabriel Valley',
    'el monte': 'San Gabriel Valley', 'hacienda heights': 'San Gabriel Valley',
    'sgv': 'San Gabriel Valley', 'mpk': 'San Gabriel Valley',
    'covina': 'San Gabriel Valley', 'west covina': 'San Gabriel Valley',
    'diamond bar': 'San Gabriel Valley', 'azusa': 'San Gabriel Valley',
    # South Bay
    'torrance': 'South Bay', 'gardena': 'South Bay', 'redondo beach': 'South Bay',
    'hermosa beach': 'South Bay', 'manhattan beach': 'South Bay',
    # Other LA
    'burbank': 'San Fernando Valley', 'glendale': 'San Fernando Valley',
    'long beach': 'Long Beach', 'irvine': 'Orange County',
    'laguna beach': 'Orange County', 'costa mesa': 'Orange County',
    'anaheim': 'Orange County', 'fullerton': 'Orange County',
    # California
    'san francisco': 'San Francisco', 'san jose': 'Bay Area',
    'san diego': 'San Diego', 'oakland': 'Bay Area',
    # Other US
    'las vegas': 'Las Vegas', 'new york': 'New York', 'nyc': 'New York',
    'honolulu': 'Honolulu', 'portland': 'Portland', 'seattle': 'Seattle',
    'chicago': 'Chicago',
    # International
    'shanghai': 'Shanghai', 'taipei': 'Taipei', 'tokyo': 'Tokyo',
    'seoul': 'Seoul', 'hong kong': 'Hong Kong', 'bangkok': 'Bangkok',
    'singapore': 'Singapore', 'osaka': 'Osaka', 'kyoto': 'Kyoto',
    'beijing': 'Beijing', 'chengdu': 'Chengdu',
}

# Patterns that suggest a venue mention in captions
VENUE_PATTERNS = [
    r'(?:at|@)\s+([A-Z][A-Za-z\s&\'\.]+?)(?:\s+in\s+|\s*[,\.\!\n])',  # "at Venue Name in..."
    r'^([A-Z][A-Za-z\s&\'\.]{2,30})(?:\s*[-–—]\s*)',                    # "Venue Name - ..."
    r'(?:from|at)\s+([A-Z][A-Za-z\s&\'\.]{2,40})(?:\s*[,\.\!\n]|$)',   # "from Venue Name."
]


def extract_venue_from_caption(caption: str, hashtags: list[str]) -> dict:
    """Extract venue name and city from Instagram caption and hashtags."""
    result = {}

    if not caption:
        return result

    # Try to extract venue name from caption patterns
    for pattern in VENUE_PATTERNS:
        match = re.search(pattern, caption)
        if match:
            venue = match.group(1).strip().rstrip('.')
            # Filter out common false positives
            skip_words = {'The', 'This', 'That', 'They', 'These', 'Here', 'Just',
                          'Best', 'Great', 'Good', 'Love', 'Such', 'What', 'When',
                          'Happy', 'Post', 'Instagram'}
            if venue.split()[0] not in skip_words and len(venue) > 2:
                result['location'] = venue
                break

    # Extract city from caption text
    caption_lower = caption.lower()
    for city_key, region in CITY_REGIONS.items():
        # Look for city name as a whole word in caption
        if re.search(r'\b' + re.escape(city_key) + r'\b', caption_lower):
            result['city'] = city_key.title()
            result['region'] = region
            break

    # If no city found in caption, check hashtags
    if 'city' not in result:
        for tag in hashtags:
            tag_lower = tag.lower()
            # Check direct city name hashtags
            if tag_lower in CITY_REGIONS:
                result['city'] = tag_lower.title()
                result['region'] = CITY_REGIONS[tag_lower]
                break
            # Check for city embedded in hashtag (e.g., #pasadenafood, #losangeleseats)
            for city_key, region in CITY_REGIONS.items():
                if city_key in tag_lower and len(city_key) > 3:
                    result['city'] = city_key.title()
                    result['region'] = region
                    break
            if 'city' in result:
                break

    # Fix known city name casing
    city_fixes = {
        'Dtla': 'Downtown LA', 'La': 'Los Angeles', 'Sgv': 'San Gabriel',
        'Mpk': 'Monterey Park', 'Ktown': 'Koreatown', 'Weho': 'West Hollywood',
        'Nyc': 'New York',
    }
    if result.get('city') in city_fixes:
        result['city'] = city_fixes[result['city']]

    return result


def load_existing_posts() -> list[dict]:
    """Load existing blog post titles and dates for dedup."""
    posts = []
    import glob
    for f in glob.glob(os.path.join(CONTENT_DIR, '*.md')):
        with open(f, encoding='utf-8') as fh:
            content = fh.read()
        parts = content.split('---', 2)
        if len(parts) >= 3:
            try:
                fm = yaml.safe_load(parts[1])
                posts.append({
                    'title': (fm.get('title', '') or '').lower(),
                    'date': str(fm.get('pubDate', '')),
                    'source': fm.get('source', ''),
                    'file': os.path.basename(f),
                })
            except Exception:
                pass
    return posts


def is_duplicate(ig_title: str, ig_date: datetime, existing_posts: list[dict]) -> bool:
    """Check if an Instagram post duplicates an existing blog post.

    Only flags as duplicate if:
    - Same date AND very similar title, OR
    - Already imported from Instagram (same source + date)
    """
    ig_date_str = ig_date.strftime('%Y-%m-%d')
    ig_norm = ig_title.lower()[:100]

    for ep in existing_posts:
        # Skip non-matching dates
        if ep['date'] != ig_date_str:
            continue

        # If already imported from Instagram on same date
        if ep['source'] == 'instagram':
            # Check title similarity
            ratio = SequenceMatcher(None, ig_norm, ep['title'][:100]).ratio()
            if ratio > 0.6:
                return True

        # Check against blog posts
        ratio = SequenceMatcher(None, ig_norm, ep['title'][:100]).ratio()
        if ratio > 0.8:
            return True

    return False


def process_post(post: dict, post_index: int, existing_posts: list[dict],
                 media_base_dir: str) -> dict | None:
    """Process a single Instagram post into a blog post dict."""
    raw_title = post.get('title', '') or ''
    title = fix_encoding(raw_title)
    date = get_post_date(post)
    media = post.get('media', [])

    if not media:
        return None

    # Skip posts with no caption (just photos with no context)
    # Actually, keep them — food photos are valuable even without text
    caption = clean_caption(raw_title)

    # Generate title for the blog post
    if caption:
        # Use first sentence or first 80 chars as title
        blog_title = caption.split('.')[0].split('!')[0].split('\n')[0]
        blog_title = re.sub(r'@\w+', '', blog_title).strip()
        blog_title = re.sub(r'#\w+', '', blog_title).strip()
        if len(blog_title) > 80:
            blog_title = blog_title[:77] + '...'
        if len(blog_title) < 3:
            blog_title = f'Instagram Post — {date.strftime("%B %d, %Y")}'
    else:
        blog_title = f'Instagram Post — {date.strftime("%B %d, %Y")}'

    # Check for duplicates
    if is_duplicate(blog_title, date, existing_posts):
        return None

    slug = make_slug(blog_title, date)
    hashtags = extract_hashtags(raw_title)
    location = extract_location(post)

    # Copy media files
    image_paths = []
    video_paths = []
    slug_dir = os.path.join(IMAGES_DIR, f'ig-{slug}')

    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov'}

    for m in media:
        uri = m.get('uri', '')
        src_path = os.path.realpath(os.path.join(media_base_dir, uri))

        # Path traversal check — media must be inside the data directory
        if not src_path.startswith(os.path.realpath(media_base_dir) + os.sep):
            print(f'  Skipping suspicious URI: {uri}')
            continue

        if not os.path.exists(src_path):
            continue

        filename = os.path.basename(uri)

        # Extension allowlist
        ext = os.path.splitext(filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            print(f'  Skipping unsupported file type: {filename}')
            continue

        if uri.endswith('.mp4'):
            # Video
            video_dir = os.path.join(VIDEOS_DIR, f'ig-{slug}')
            os.makedirs(video_dir, exist_ok=True)
            dst = os.path.join(video_dir, filename)
            if not os.path.exists(dst):
                shutil.copy2(src_path, dst)
            video_paths.append(f'/videos/posts/ig-{slug}/{filename}')
        else:
            # Image
            os.makedirs(slug_dir, exist_ok=True)
            dst = os.path.join(slug_dir, filename)
            if not os.path.exists(dst):
                shutil.copy2(src_path, dst)
            image_paths.append(f'/images/posts/ig-{slug}/{filename}')

    if not image_paths and not video_paths:
        return None

    return {
        'title': blog_title,
        'date': date.strftime('%Y-%m-%d'),
        'slug': slug,
        'caption': caption,
        'hashtags': hashtags,
        'images': image_paths,
        'videos': video_paths,
        'hero_image': image_paths[0] if image_paths else None,
        'location': location,
    }


def write_instagram_post(post: dict) -> str:
    """Write a single Instagram post as Markdown."""
    filename = f'{post["slug"]}.md'
    filepath = os.path.join(CONTENT_DIR, filename)

    frontmatter = {
        'title': post['title'],
        'pubDate': post['date'],
        'author': 'The Thirsty Pig',
        'source': 'instagram',
        'draft': False,
    }

    if post.get('hero_image'):
        frontmatter['heroImage'] = post['hero_image']
    if post.get('images'):
        frontmatter['images'] = post['images']
    if post.get('hashtags'):
        frontmatter['tags'] = post['hashtags'][:10]  # limit to 10 tags

    # GPS coordinates
    if post.get('location'):
        frontmatter['coordinates'] = {
            'lat': round(post['location']['lat'], 6),
            'lng': round(post['location']['lng'], 6),
        }

    # Try to extract venue/city from caption
    venue_info = extract_venue_from_caption(post.get('caption', ''), post.get('hashtags', []))
    if venue_info.get('location'):
        frontmatter['location'] = venue_info['location']
    if venue_info.get('city'):
        frontmatter['city'] = venue_info['city']
    if venue_info.get('region'):
        frontmatter['region'] = venue_info['region']

    # Build description (full caption, cleaned of hashtags/mentions)
    if post['caption']:
        desc = re.sub(r'[#@]\w+', '', post['caption'])
        desc = re.sub(r'\s+', ' ', desc).strip()
        if desc:
            frontmatter['description'] = desc

    yaml_str = yaml.dump(frontmatter, default_flow_style=False,
                         allow_unicode=True, sort_keys=False, width=1000)

    # Build body
    body_parts = []

    # Images
    for img in post.get('images', []):
        body_parts.append(f'![{post["title"]}]({img})\n')

    # Videos
    for vid in post.get('videos', []):
        body_parts.append(f'<video controls width="100%"><source src="{vid}" type="video/mp4"></video>\n')

    # Caption text
    if post['caption']:
        body_parts.append(post['caption'])

    body = '\n'.join(body_parts)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('---\n')
        f.write(yaml_str)
        f.write('---\n\n')
        f.write(body)
        f.write('\n')

    return filepath


def main():
    print('=' * 60)
    print('  INSTAGRAM IMPORT')
    print('=' * 60)

    # Load Instagram data — glob for posts_*.json (Instagram splits large exports)
    posts_files = sorted(glob.glob(os.path.join(DATA_DIR, '**', 'posts_*.json'), recursive=True))
    if not posts_files:
        print(f'ERROR: No posts_*.json found in {DATA_DIR}')
        sys.exit(1)

    ig_posts = []
    for pf in posts_files:
        print(f'Loading: {os.path.relpath(pf, DATA_DIR)}')
        with open(pf, encoding='utf-8') as f:
            ig_posts.extend(json.load(f))

    print(f'Instagram posts: {len(ig_posts)} (from {len(posts_files)} file(s))')

    # Load existing posts for dedup
    existing = load_existing_posts()
    print(f'Existing blog posts: {len(existing)}')

    # Media base directory (where we extracted the ZIP)
    media_base = DATA_DIR

    # Process all posts
    os.makedirs(CONTENT_DIR, exist_ok=True)
    os.makedirs(IMAGES_DIR, exist_ok=True)
    os.makedirs(VIDEOS_DIR, exist_ok=True)

    processed = []
    skipped_no_media = 0
    skipped_duplicate = 0
    has_video = 0

    for i, post in enumerate(ig_posts):
        result = process_post(post, i, existing, media_base)
        if result:
            processed.append(result)
            if result.get('videos'):
                has_video += 1
        else:
            # Distinguish why it was skipped
            if not post.get('media'):
                skipped_no_media += 1

    print(f'\nProcessed: {len(processed)} posts')
    print(f'With video: {has_video}')
    print(f'Skipped (no media): {skipped_no_media}')

    # Write Markdown files
    written = 0
    for post in processed:
        filepath = write_instagram_post(post)
        if filepath:
            written += 1

    print(f'Written: {written} Markdown files')

    # Count total media copied
    ig_image_dirs = [d for d in os.listdir(IMAGES_DIR) if d.startswith('ig-')]
    total_images = sum(
        len(os.listdir(os.path.join(IMAGES_DIR, d)))
        for d in ig_image_dirs
        if os.path.isdir(os.path.join(IMAGES_DIR, d))
    )
    print(f'Total Instagram images copied: {total_images}')

    if os.path.exists(VIDEOS_DIR):
        ig_video_dirs = [d for d in os.listdir(VIDEOS_DIR) if d.startswith('ig-')]
        total_videos = sum(
            len(os.listdir(os.path.join(VIDEOS_DIR, d)))
            for d in ig_video_dirs
            if os.path.isdir(os.path.join(VIDEOS_DIR, d))
        )
        print(f'Total Instagram videos copied: {total_videos}')

    print(f'\nImport complete!')


if __name__ == '__main__':
    main()
