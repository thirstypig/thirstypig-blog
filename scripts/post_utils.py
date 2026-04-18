"""Shared utilities for loading, saving, and inspecting blog post frontmatter.

Dead-URL registries are kept here as the single source of truth so scripts
that mark broken images (mark_imageless_drafts.py) and scripts that strip
dead content (strip_dead_images.py) don't drift out of sync.
"""

import os

import yaml


# --- Dead-URL registries ---------------------------------------------------

# Narrow /wp-content matcher — safe for content stripping.
# A URL containing "thirstypig.com/wp-content" was uploaded to the old
# WordPress install which no longer serves media, so stripping is safe.
DEAD_WP_CONTENT_DOMAINS = [
    "thethirstypig.com/wp-content",
    "thirstypig.com/wp-content",
    "www.thethirstypig.com/wp-content",
    "www.thirstypig.com/wp-content",
    "blog.thethirstypig.com/wp-content",
    "bp.blogspot.com",  # Google Blogger image CDN — returns 404
]

# Whole-domain legacy hosts — used ONLY for image-existence checks.
# Never use these for content stripping; they'd false-positive on valid
# descriptive mentions of "thethirstypig.com" in post bodies.
DEAD_BLOG_DOMAINS = [
    "thethirstypig.com",
    "www.thethirstypig.com",
    "blog.thethirstypig.com",
]

# For image-existence checks: combine both (broader match).
DEAD_IMAGE_HOST_PATTERNS = DEAD_WP_CONTENT_DOMAINS + DEAD_BLOG_DOMAINS


def is_dead_wp_content_url(url):
    """Narrow check — safe for content stripping. Matches /wp-content only."""
    return any(domain in url for domain in DEAD_WP_CONTENT_DOMAINS)


def is_dead_image_url(url):
    """Broad check — matches /wp-content paths AND bare legacy hosts.
    Use when deciding if an image reference is broken."""
    return any(domain in url for domain in DEAD_IMAGE_HOST_PATTERNS)


# --- Frontmatter parsing ---------------------------------------------------


def load_post(filepath):
    """Load a post, returning (frontmatter_dict, body_text) or (None, None)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if not content.startswith('---'):
        return None, None
    try:
        # Find closing --- on its own line (avoid matching --- inside field values)
        end = content.index('\n---', 3) + 1
    except ValueError:
        return None, None
    try:
        fm = yaml.safe_load(content[3:end])
    except yaml.YAMLError:
        print(f"  YAML error: {os.path.basename(filepath)}")
        return None, None
    if not isinstance(fm, dict):
        return None, None
    body = content[end + 3:]
    return fm, body


def save_post(filepath, fm, body):
    """Write frontmatter + body back to file."""
    yaml_str = yaml.dump(
        fm, default_flow_style=False, allow_unicode=True,
        sort_keys=False, width=1000,
    )
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write('---\n')
        f.write(yaml_str)
        f.write('---')
        f.write(body)


def frontmatter_close_index(content):
    """Return the index of the closing frontmatter '---' delimiter, or -1.

    Use instead of content.index('---', 3) — that idiom crashes on malformed
    posts that have an opening '---' but no closing delimiter, and it matches
    a stray '---' inside a field value (e.g. a long en-dash run).

    This helper anchors on a newline before the closing '---' and returns -1
    on failure so callers can skip the file gracefully.
    """
    if not content.startswith('---'):
        return -1
    # +1 because we want the index of the '-' in '---', not the preceding '\n'
    idx = content.find('\n---', 3)
    return idx + 1 if idx != -1 else -1
