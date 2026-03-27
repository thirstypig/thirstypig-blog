"""Base parser class for extracting blog post data from HTML."""

import re
from abc import ABC, abstractmethod
from datetime import datetime

from bs4 import BeautifulSoup
from markdownify import markdownify as md

from utils import clean_wayback_url, extract_date_from_url


class BaseParser(ABC):
    """Abstract base parser for blog post HTML."""

    def parse(self, html: str, url: str, domain: str) -> dict | None:
        """Parse HTML and return structured post data."""
        soup = BeautifulSoup(html, 'lxml')

        title = self.extract_title(soup)
        if not title:
            return None

        date = self.extract_date(soup, url)
        body_html = self.extract_body_html(soup)
        if not body_html:
            return None

        # Convert body HTML to Markdown
        body_md = self._html_to_markdown(body_html)
        if not body_md or len(body_md.strip()) < 20:
            return None

        categories = self.extract_categories(soup)
        tags = self.extract_tags(soup)
        images = self.extract_images(soup)
        author = self.extract_author(soup)

        return {
            'title': title.strip(),
            'date': date,
            'body': body_md.strip(),
            'body_html': str(body_html),
            'categories': categories,
            'tags': tags,
            'images': images,
            'author': author,
            'url': url,
            'domain': domain,
        }

    def _html_to_markdown(self, html_element) -> str:
        """Convert HTML to clean Markdown."""
        # Remove WordPress sharing/related/like boilerplate before conversion
        import copy
        element = copy.copy(html_element)

        # Remove sharing widgets and related posts
        for selector in [
            'div.sharedaddy', 'div.sd-sharing', 'div.sd-like',
            'div.jp-relatedposts', 'div.related-posts',
            'div#jp-post-flair',
        ]:
            for el in element.select(selector):
                el.decompose()

        # Remove share/like/related headings and their content
        for heading in element.find_all(['h3', 'h4', 'h5']):
            text = heading.get_text(strip=True).lower()
            if text in ('share this:', 'like this:', 'related', 'share this', 'like this:'):
                # Remove this heading and following siblings until next heading or end
                next_sib = heading.find_next_sibling()
                heading.decompose()
                while next_sib:
                    following = next_sib.find_next_sibling()
                    if next_sib.name in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6'):
                        break
                    next_sib.decompose()
                    next_sib = following

        html_str = str(element)

        # Clean Wayback Machine URLs before converting
        html_str = re.sub(
            r'(https?:)?//web\.archive\.org/web/\d+(?:id_)?/',
            '',
            html_str
        )

        # Convert to Markdown
        markdown = md(
            html_str,
            heading_style='atx',
            bullets='-',
            strip=['script', 'style', 'nav', 'aside'],
        )

        # Clean up excessive whitespace
        markdown = re.sub(r'\n{3,}', '\n\n', markdown)
        markdown = re.sub(r'[ \t]+\n', '\n', markdown)

        # Remove leftover "Like Loading..." text
        markdown = re.sub(r'(?:Like|like)\s+Loading\.\.\.?\n*', '', markdown)

        return markdown

    @abstractmethod
    def extract_title(self, soup: BeautifulSoup) -> str | None:
        pass

    @abstractmethod
    def extract_date(self, soup: BeautifulSoup, url: str) -> str:
        pass

    @abstractmethod
    def extract_body_html(self, soup: BeautifulSoup):
        pass

    def extract_categories(self, soup: BeautifulSoup) -> list[str]:
        return []

    def extract_tags(self, soup: BeautifulSoup) -> list[str]:
        return []

    def extract_author(self, soup: BeautifulSoup) -> str:
        return 'The Thirsty Pig'

    def extract_images(self, soup: BeautifulSoup) -> list[str]:
        """Extract image URLs from the post body.

        Returns list of dicts with 'src' (display URL) and 'orig' (original URL).
        We try multiple URL variants when downloading.
        """
        images = []
        body = self.extract_body_html(soup)
        if not body:
            return images

        for img in body.find_all('img'):
            src = img.get('src', '')
            src = clean_wayback_url(src)

            if not src or src.startswith('data:'):
                continue

            # Skip tracking pixels, icons, badges
            skip_patterns = ['pixel', 'linkwithin', 'feedburner', 'badge',
                           'transparent.gif', 'nothing.gif', 'loading.gif',
                           'urbanspoon', 'foodbuzz']
            if any(p in src.lower() for p in skip_patterns):
                continue

            width = img.get('width', '')
            height = img.get('height', '')
            if width and height:
                try:
                    if int(width) < 10 or int(height) < 10:
                        continue
                except ValueError:
                    pass

            if src not in images:
                images.append(src)

        return images
