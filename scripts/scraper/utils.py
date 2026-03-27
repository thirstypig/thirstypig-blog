"""Utility functions for the scraper."""

import re
import unicodedata
from urllib.parse import unquote, urlparse


def normalize_title(title: str) -> str:
    """Normalize a title for deduplication comparison."""
    if not title:
        return ''
    # Decode URL encoding
    title = unquote(title)
    # Normalize unicode
    title = unicodedata.normalize('NFKD', title)
    # Lowercase
    title = title.lower()
    # Remove punctuation except spaces
    title = re.sub(r'[^\w\s]', '', title)
    # Collapse whitespace
    title = re.sub(r'\s+', ' ', title).strip()
    return title


def url_to_slug(url: str) -> str:
    """Extract a clean slug from a blog post URL."""
    parsed = urlparse(url)
    path = parsed.path.rstrip('/')

    # Remove .html extension (Blogspot)
    if path.endswith('.html'):
        path = path[:-5]

    # Get the last path segment as slug
    parts = [p for p in path.split('/') if p]
    if not parts:
        return 'untitled'

    slug = parts[-1]
    # Decode URL encoding
    slug = unquote(slug)
    # Clean up the slug
    slug = re.sub(r'[^\w\-]', '-', slug)
    slug = re.sub(r'-+', '-', slug).strip('-').lower()

    return slug or 'untitled'


def extract_date_from_url(url: str) -> str | None:
    """Try to extract a date (YYYY-MM-DD) from a URL path."""
    # Match /YYYY/MM/DD/ pattern (WordPress)
    match = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', url)
    if match:
        return f'{match.group(1)}-{match.group(2)}-{match.group(3)}'

    # Match /YYYY/MM/ pattern (Blogspot)
    match = re.search(r'/(\d{4})/(\d{2})/', url)
    if match:
        return f'{match.group(1)}-{match.group(2)}-01'

    return None


def clean_wayback_url(url: str) -> str:
    """Remove Wayback Machine URL wrapping from a URL."""
    # Pattern: https://web.archive.org/web/TIMESTAMP/ORIGINAL_URL
    match = re.match(r'https?://web\.archive\.org/web/\d+(?:id_)?/(https?://.+)', url)
    if match:
        return match.group(1)

    # Pattern: //web.archive.org/web/TIMESTAMP/ORIGINAL_URL
    match = re.match(r'//web\.archive\.org/web/\d+(?:id_)?/(https?://.+)', url)
    if match:
        return match.group(1)

    return url


def sanitize_filename(name: str) -> str:
    """Sanitize a string for use as a filename."""
    # Remove or replace unsafe characters
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', '-', name)
    return name[:200]  # limit length
