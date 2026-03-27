"""Step 6: Write parsed posts as Markdown files with YAML frontmatter."""

import os
import re

import yaml

from config import CONTENT_DIR


def write_post(post: dict) -> str | None:
    """Write a single post as a Markdown file. Returns the filepath."""
    date = post.get('date', '2009-01-01')
    slug = post.get('slug', 'untitled')
    filename = f'{date}-{slug}.md'
    filepath = os.path.join(CONTENT_DIR, filename)

    # Build frontmatter
    frontmatter = {
        'title': post['title'],
        'pubDate': date,
        'author': post.get('author', 'The Thirsty Pig'),
        'source': post.get('domain', 'thirstypig.com'),
        'originalUrl': post.get('url', ''),
    }

    # Optional fields
    if post.get('hero_image'):
        frontmatter['heroImage'] = post['hero_image']

    if post.get('local_images'):
        frontmatter['images'] = post['local_images']

    if post.get('categories'):
        frontmatter['categories'] = post['categories']

    if post.get('tags'):
        frontmatter['tags'] = post['tags']

    # Try to extract description from first paragraph of body
    body = post.get('body', '')
    if body:
        # Get first paragraph as description
        paragraphs = [p.strip() for p in body.split('\n\n') if p.strip()]
        for p in paragraphs:
            # Skip image-only paragraphs
            if p.startswith('![') or p.startswith('[!['):
                continue
            # Clean markdown formatting for description
            desc = re.sub(r'[#*_\[\]()!]', '', p)
            desc = re.sub(r'\s+', ' ', desc).strip()
            if len(desc) > 20:
                frontmatter['description'] = desc[:200]
                break

    # Build the archive URL
    if post.get('timestamp') and post.get('url'):
        frontmatter['archiveUrl'] = f'https://web.archive.org/web/{post["timestamp"]}/{post["url"]}'

    frontmatter['draft'] = False

    # Write the file
    os.makedirs(CONTENT_DIR, exist_ok=True)

    # Use yaml.dump for clean frontmatter
    yaml_str = yaml.dump(
        frontmatter,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
        width=1000,  # prevent line wrapping
    )

    # Fix: ensure body images reference local paths
    body = update_image_refs(body, post)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('---\n')
        f.write(yaml_str)
        f.write('---\n\n')
        f.write(body)
        f.write('\n')

    return filepath


def update_image_refs(body: str, post: dict) -> str:
    """Replace remote image URLs in markdown body with local paths."""
    images = post.get('images', [])
    local_images = post.get('local_images', [])

    if not images or not local_images:
        return body

    # Build mapping from original URL to local path
    # Match by index since we downloaded them in order
    for i, orig_url in enumerate(images):
        if i < len(local_images):
            local_path = local_images[i]
            # Replace in markdown image syntax
            body = body.replace(orig_url, local_path)

    return body


def write_all_posts(posts: list[dict]) -> int:
    """Write all posts as Markdown files."""
    print(f'\nWriting {len(posts)} posts as Markdown...')

    written = 0
    for post in posts:
        filepath = write_post(post)
        if filepath:
            written += 1

    print(f'  Written {written} Markdown files to {CONTENT_DIR}')
    return written
