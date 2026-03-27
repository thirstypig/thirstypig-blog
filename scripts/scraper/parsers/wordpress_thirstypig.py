"""Parser for thirstypig.com (WordPress with Flavor theme)."""

import re
from datetime import datetime

from bs4 import BeautifulSoup

from .base import BaseParser
from utils import extract_date_from_url


class WordPressThirstyPigParser(BaseParser):
    """Parse HTML from thirstypig.com WordPress site."""

    def extract_title(self, soup: BeautifulSoup) -> str | None:
        # Try various WordPress title selectors
        for selector in [
            'div.post-meta h1',
            'h1.entry-title',
            'h1.post-title',
            'h2.entry-title',
            'article h1',
            'h1',
        ]:
            el = soup.select_one(selector)
            if el and el.get_text(strip=True):
                return el.get_text(strip=True)

        # Try <title> tag as fallback
        title_tag = soup.find('title')
        if title_tag:
            text = title_tag.get_text(strip=True)
            # Remove site name suffix
            text = re.sub(r'\s*[\|–—-]\s*(The\s+)?Thirsty\s*Pig.*$', '', text, flags=re.IGNORECASE)
            if text:
                return text

        return None

    def extract_date(self, soup: BeautifulSoup, url: str) -> str:
        # Try post date element
        for selector in ['span.post-date', 'time.entry-date', 'span.entry-date', 'time']:
            el = soup.select_one(selector)
            if el:
                # Check datetime attribute first
                dt = el.get('datetime')
                if dt:
                    try:
                        parsed = datetime.fromisoformat(dt.replace('Z', '+00:00'))
                        return parsed.strftime('%Y-%m-%d')
                    except ValueError:
                        pass

                # Try parsing text
                text = el.get_text(strip=True)
                for fmt in ['%B %d, %Y', '%b %d, %Y', '%m/%d/%Y', '%Y-%m-%d']:
                    try:
                        parsed = datetime.strptime(text, fmt)
                        return parsed.strftime('%Y-%m-%d')
                    except ValueError:
                        continue

        # Fallback: extract from URL
        date = extract_date_from_url(url)
        return date or '2009-01-01'

    def extract_body_html(self, soup: BeautifulSoup):
        # Try various WordPress content selectors
        for selector in [
            'div.post-content',
            'div.entry-content',
            'article .entry-content',
            'div.post-body',
            'article',
        ]:
            el = soup.select_one(selector)
            if el and len(el.get_text(strip=True)) > 20:
                return el
        return None

    def extract_categories(self, soup: BeautifulSoup) -> list[str]:
        categories = []

        # Method 1: Category links
        for selector in [
            'span.cat-links a[rel*="category"]',
            'a[rel="category tag"]',
            'span.categories a',
            '.post-categories a',
        ]:
            for a in soup.select(selector):
                cat = a.get_text(strip=True)
                if cat and cat not in categories:
                    categories.append(cat)

        # Method 2: CSS classes on post container
        if not categories:
            for selector in ['div.single', 'article', 'div.post']:
                el = soup.select_one(selector)
                if el:
                    classes = el.get('class', [])
                    for cls in classes:
                        if cls.startswith('category-'):
                            cat = cls[9:].replace('-', ' ').title()
                            if cat and cat not in categories:
                                categories.append(cat)

        return categories

    def extract_tags(self, soup: BeautifulSoup) -> list[str]:
        tags = []

        # Method 1: Tag links
        for selector in [
            'span.tag-links a[rel="tag"]',
            'span.tags-links a',
            '.post-tags a',
        ]:
            for a in soup.select(selector):
                tag = a.get_text(strip=True)
                if tag and tag not in tags:
                    tags.append(tag)

        # Method 2: CSS classes
        for selector in ['div.single', 'article', 'div.post']:
            el = soup.select_one(selector)
            if el:
                classes = el.get('class', [])
                for cls in classes:
                    if cls.startswith('tag-'):
                        tag = cls[4:].replace('-', ' ').title()
                        if tag and tag not in tags:
                            tags.append(tag)

        return tags

    def extract_author(self, soup: BeautifulSoup) -> str:
        for selector in ['span.post-author a', 'span.author a', 'a.author', '.byline a']:
            el = soup.select_one(selector)
            if el:
                return el.get_text(strip=True)
        return 'The Thirsty Pig'
