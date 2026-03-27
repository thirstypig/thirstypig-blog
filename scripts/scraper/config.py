"""Configuration constants for the Thirsty Pig Wayback Machine scraper."""

import os

# Project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

# Output directories
CONTENT_DIR = os.path.join(PROJECT_ROOT, 'src', 'content', 'posts')
IMAGES_DIR = os.path.join(PROJECT_ROOT, 'public', 'images', 'posts')
DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
HTML_CACHE_DIR = os.path.join(DATA_DIR, 'html')

# Domains to scrape
DOMAINS = {
    'thirstypig.com': {
        'cdx_url': 'thirstypig.com',
        'match_type': 'domain',
        'parser': 'wordpress_thirstypig',
        'priority': 1,  # highest priority for dedup
    },
    'thethirstypig.com': {
        'cdx_url': 'thethirstypig.com',
        'match_type': 'domain',
        'parser': 'wordpress_thethirstypig',
        'priority': 2,
    },
    'blog.thethirstypig.com': {
        'cdx_url': 'blog.thethirstypig.com',
        'match_type': 'domain',
        'parser': 'blogspot',
        'priority': 3,  # lowest priority for dedup
    },
}

# CDX API settings
CDX_API_URL = 'https://web.archive.org/cdx/search/cdx'

# Wayback Machine fetch settings
WAYBACK_BASE = 'https://web.archive.org/web'
MAX_CONCURRENT_REQUESTS = 5
REQUEST_DELAY = 1.0  # seconds between batches
BACKOFF_BASE = 5  # seconds for exponential backoff
BACKOFF_MAX = 60  # max backoff seconds
MAX_RETRIES = 3

# URL patterns to exclude (not blog posts)
EXCLUDE_PATTERNS = [
    '/category/', '/tag/', '/page/', '/author/', '/feed/',
    '/wp-admin/', '/wp-login/', '/wp-content/', '/wp-includes/',
    '/xmlrpc.php', '/wp-cron.php', '/favicon.ico',
    '/comments/', '/trackback/', '/attachment/',
    'robots.txt', 'sitemap', '/search/',
]

# URL patterns that identify blog posts
POST_PATTERNS = {
    'thirstypig.com': r'/\d{4}/\d{2}/\d{2}/[^/]+/?$',
    'thethirstypig.com': r'/\d{4}/\d{2}/\d{2}/[^/]+/?$',
    'blog.thethirstypig.com': r'/\d{4}/\d{2}/[^/]+\.html$',
}

# Deduplication
FUZZY_MATCH_THRESHOLD = 0.85
