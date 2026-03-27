"""Parser for blog.thethirstypig.com (Blogspot/Blogger)."""

import re
from datetime import datetime

from bs4 import BeautifulSoup

from .base import BaseParser
from utils import clean_wayback_url, extract_date_from_url


class BlogspotParser(BaseParser):
    """Parse HTML from blog.thethirstypig.com Blogspot site."""

    def extract_title(self, soup: BeautifulSoup) -> str | None:
        # Blogspot title is usually in h3.post-title
        for selector in [
            'h3.post-title a',
            'h3.post-title',
            'h3.entry-title a',
            'h3.entry-title',
            'h1.post-title',
        ]:
            el = soup.select_one(selector)
            if el and el.get_text(strip=True):
                return el.get_text(strip=True)

        title_tag = soup.find('title')
        if title_tag:
            text = title_tag.get_text(strip=True)
            text = re.sub(r'\s*[\|–—-]\s*(The\s+)?Thirsty\s*Pig.*$', '', text, flags=re.IGNORECASE)
            if text:
                return text

        return None

    def extract_date(self, soup: BeautifulSoup, url: str) -> str:
        # Blogspot date header
        for selector in ['h2.date-header span', 'h2.date-header', '.date-header span']:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(strip=True)
                for fmt in [
                    '%A, %B %d, %Y',  # "Saturday, December 20, 2008"
                    '%B %d, %Y',
                    '%b %d, %Y',
                ]:
                    try:
                        return datetime.strptime(text, fmt).strftime('%Y-%m-%d')
                    except ValueError:
                        continue

        # Blogspot timestamp
        for selector in ['abbr.published', 'span.post-timestamp a', '.post-timestamp']:
            el = soup.select_one(selector)
            if el:
                dt = el.get('title', '') or el.get_text(strip=True)
                try:
                    parsed = datetime.fromisoformat(dt)
                    return parsed.strftime('%Y-%m-%d')
                except ValueError:
                    pass

        # Fallback: URL date
        date = extract_date_from_url(url)
        return date or '2009-01-01'

    def extract_body_html(self, soup: BeautifulSoup):
        for selector in [
            'div.post-body.entry-content',
            'div.post-body',
            'div.entry-content',
        ]:
            el = soup.select_one(selector)
            if el and len(el.get_text(strip=True)) > 10:
                return el
        return None

    def extract_categories(self, soup: BeautifulSoup) -> list[str]:
        categories = []
        for selector in ['span.post-labels a', '.post-labels a']:
            for a in soup.select(selector):
                cat = a.get_text(strip=True)
                if cat and cat not in categories:
                    categories.append(cat)
        return categories

    def extract_tags(self, soup: BeautifulSoup) -> list[str]:
        # Blogspot labels are essentially both categories and tags
        return []

    def extract_images(self, soup: BeautifulSoup) -> list[str]:
        """Extract image URLs, preferring full-size Blogspot images."""
        images = []
        body = self.extract_body_html(soup)
        if not body:
            return images

        for img in body.find_all('img'):
            src = img.get('src', '')
            src = clean_wayback_url(src)

            if not src or src.startswith('data:'):
                continue

            # Upgrade Blogspot image size (replace /s400/ with /s1600/)
            src = re.sub(r'/s\d+(-h)?/', '/s1600/', src)

            if src not in images:
                images.append(src)

        # Also check for linked images (Blogspot often wraps images in <a>)
        for a in body.find_all('a'):
            href = a.get('href', '')
            href = clean_wayback_url(href)
            if href and any(ext in href.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                # Upgrade size
                href = re.sub(r'/s\d+(-h)?/', '/s1600/', href)
                if href not in images:
                    images.append(href)

        return images
