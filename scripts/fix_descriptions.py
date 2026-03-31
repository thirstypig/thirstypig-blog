#!/usr/bin/env python3
"""
Fix truncated descriptions by rebuilding them from the full post body.

The original import script truncated descriptions to 200 chars. This
restores them to the full caption text (minus hashtags and @mentions).

Usage:
  python3 scripts/fix_descriptions.py [--dry-run]
"""

import argparse
import glob
import os
import re

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')


def parse_post(filepath):
    """Parse frontmatter and body from markdown file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not content.startswith('---'):
        return None, None, None, content

    end = content.index('---', 3)
    fm_text = content[3:end].strip()
    body = content[end + 3:].strip()

    # Extract description and source from frontmatter
    desc = ''
    source = ''
    for line in fm_text.split('\n'):
        if line.startswith('description:'):
            desc = line.split(':', 1)[1].strip().strip("'\"")
        elif line.startswith('source:'):
            source = line.split(':', 1)[1].strip()

    return desc, source, fm_text, content


def extract_clean_caption(body):
    """Extract the clean caption text from post body (last text paragraph)."""
    if not body:
        return ''

    # Remove image markdown
    text = re.sub(r'!\[.*?\]\(.*?\)', '', body)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove markdown links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)

    # Get the last non-empty paragraph (usually the caption with hashtags)
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    if not paragraphs:
        return ''

    # The caption is typically the last paragraph
    caption = paragraphs[-1]

    # Clean: remove hashtags and @mentions, collapse whitespace
    clean = re.sub(r'[#@]\w+', '', caption)
    clean = re.sub(r'\s+', ' ', clean).strip()

    return clean


def process_file(filepath, dry_run=False):
    """Fix a single post's truncated description."""
    desc, source, fm_text, content = parse_post(filepath)
    if desc is None:
        return None

    # Only fix Instagram-sourced posts
    if source != 'instagram':
        return None

    # Only fix if description looks truncated (exactly 200 chars or ends mid-word)
    if len(desc) < 195:
        return None

    # Get full caption from body
    body = content[content.index('---', 3) + 3:].strip()
    full_caption = extract_clean_caption(body)

    if not full_caption or len(full_caption) <= len(desc):
        return None

    # Escape for YAML
    safe_desc = full_caption.replace("'", "''")

    result = {
        'file': os.path.basename(filepath),
        'old_len': len(desc),
        'new_len': len(full_caption),
        'preview': full_caption[:80] + '...' if len(full_caption) > 80 else full_caption,
    }

    if not dry_run:
        # Replace the description line in frontmatter
        old_line = None
        for line in content.split('\n'):
            if line.startswith('description:'):
                old_line = line
                break

        if old_line:
            new_line = f"description: '{safe_desc}'"
            content = content.replace(old_line, new_line, 1)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)

    return result


def main():
    parser = argparse.ArgumentParser(description='Fix truncated post descriptions')
    parser.add_argument('--dry-run', action='store_true', help='Preview changes')
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f"Scanning {len(files)} posts for truncated descriptions...")

    results = []
    for f in files:
        r = process_file(f, dry_run=args.dry_run)
        if r:
            results.append(r)

    if not results:
        print("No truncated descriptions found.")
        return

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Fixed {len(results)} descriptions:\n")
    for r in results[:15]:
        print(f"  {r['file']}")
        print(f"    {r['old_len']} → {r['new_len']} chars: {r['preview']}")
        print()

    if len(results) > 15:
        print(f"  ... and {len(results) - 15} more\n")

    if args.dry_run:
        print(f"Run without --dry-run to apply {len(results)} fixes.")


if __name__ == '__main__':
    main()
