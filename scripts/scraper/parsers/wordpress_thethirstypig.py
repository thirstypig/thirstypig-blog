"""Parser for thethirstypig.com / www.thethirstypig.com (WordPress)."""

import re
from datetime import datetime

from bs4 import BeautifulSoup

from .base import BaseParser
from utils import extract_date_from_url


class WordPressTheThirstyPigParser(BaseParser):
    """Parse HTML from thethirstypig.com WordPress site."""

    def extract_title(self, soup: BeautifulSoup) -> str | None:
        for selector in [
            'h2.entry-title',
            'h1.entry-title',
            'h2.post-title',
            'h1.post-title',
            'h1',
        ]:
            el = soup.select_one(selector)
            if el:
                # May contain a link
                a = el.find('a')
                text = (a or el).get_text(strip=True)
                if text:
                    return text

        title_tag = soup.find('title')
        if title_tag:
            text = title_tag.get_text(strip=True)
            text = re.sub(r'\s*[\|–—-]\s*(The\s+)?Thirsty\s*Pig.*$', '', text, flags=re.IGNORECASE)
            if text:
                return text

        return None

    def extract_date(self, soup: BeautifulSoup, url: str) -> str:
        # ISO datetime in abbr.published
        abbr = soup.select_one('abbr.published')
        if abbr:
            dt = abbr.get('title', '')
            if dt:
                try:
                    parsed = datetime.fromisoformat(dt.replace('Z', '+00:00'))
                    return parsed.strftime('%Y-%m-%d')
                except ValueError:
                    pass

        # Try time elements
        for el in soup.select('time[datetime]'):
            try:
                parsed = datetime.fromisoformat(el['datetime'].replace('Z', '+00:00'))
                return parsed.strftime('%Y-%m-%d')
            except (ValueError, KeyError):
                continue

        # Try date text patterns
        for selector in ['span.entry-date', 'span.post-date', '.date']:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(strip=True)
                for fmt in ['%B %d, %Y', '%b %d, %Y', '%m/%d/%Y']:
                    try:
                        return datetime.strptime(text, fmt).strftime('%Y-%m-%d')
                    except ValueError:
                        continue

        date = extract_date_from_url(url)
        return date or '2009-01-01'

    def extract_body_html(self, soup: BeautifulSoup):
        for selector in [
            'div.entry-content',
            'div.post-content',
            'div.entry',
            'article .content',
        ]:
            el = soup.select_one(selector)
            if el and len(el.get_text(strip=True)) > 20:
                return el
        return None

    def extract_categories(self, soup: BeautifulSoup) -> list[str]:
        categories = []
        for selector in [
            'span.cat-links a[rel*="category"]',
            'a[rel="category tag"]',
            '.post-categories a',
        ]:
            for a in soup.select(selector):
                cat = a.get_text(strip=True)
                if cat and cat not in categories:
                    categories.append(cat)
        return categories

    def extract_tags(self, soup: BeautifulSoup) -> list[str]:
        tags = []
        for selector in [
            'span.tag-links a[rel="tag"]',
            'span.tags-links a',
        ]:
            for a in soup.select(selector):
                tag = a.get_text(strip=True)
                if tag and tag not in tags:
                    tags.append(tag)
        return tags
