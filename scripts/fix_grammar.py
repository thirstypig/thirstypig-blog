#!/usr/bin/env python3
"""
Light grammar and spelling fixes for post content.

Fixes:
  - Lowercase "i" → "I" (i've, i'm, i'd, i'll, i was, etc.)
  - Common tense errors (it's had been → it had been)
  - Double spaces
  - Missing capitalization after periods

Preserves the author's voice — only fixes clear errors, never rewrites.

Usage:
  python3 scripts/fix_grammar.py [--dry-run]
"""

import argparse
import glob
import os
import re

CONTENT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'content', 'posts')

# Patterns: (regex, replacement, description)
FIXES = [
    # Lowercase "i" as pronoun
    (re.compile(r"(?<![a-zA-Z])i(?='m\b)", re.MULTILINE), "I", "i'm → I'm"),
    (re.compile(r"(?<![a-zA-Z])i(?='ve\b)", re.MULTILINE), "I", "i've → I've"),
    (re.compile(r"(?<![a-zA-Z])i(?='d\b)", re.MULTILINE), "I", "i'd → I'd"),
    (re.compile(r"(?<![a-zA-Z])i(?='ll\b)", re.MULTILINE), "I", "i'll → I'll"),
    (re.compile(r"(?<![a-zA-Z])i(?=\s+(?:was|am|had|have|got|went|think|thought|love|like|just|really|also|don't|didn't|can't|won't|would|could|should|need|want|hope|wish|know|feel|guess|believe|remember|ate|tried|ordered|recommend|heard)\b)", re.MULTILINE), "I", "i [verb] → I [verb]"),
    (re.compile(r"(?<=\.\s)i(?=\s)", re.MULTILINE), "I", "sentence start i → I"),
    (re.compile(r"^i(?=\s)", re.MULTILINE), "I", "line start i → I"),

    # Double spaces → single
    (re.compile(r"(?<!\n) {2,}(?!\n)"), " ", "double space"),

    # Common tense errors
    (re.compile(r"\bit's had been\b", re.IGNORECASE), "it had been", "it's had been → it had been"),
    (re.compile(r"\bI'm hope\b"), "I hope", "I'm hope → I hope"),

    # Missing space after period (but not in URLs or numbers)
    (re.compile(r"(?<=[a-z])\.(?=[A-Z][a-z])"), ". ", "missing space after period"),
]


def parse_post(filepath):
    """Parse frontmatter and body from markdown file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if not content.startswith('---'):
        return None, None

    end = content.index('---', 3)
    frontmatter = content[:end + 3]
    body = content[end + 3:]

    return frontmatter, body


def fix_body(body):
    """Apply grammar fixes to post body. Returns (fixed_body, list_of_changes)."""
    changes = []

    for pattern, replacement, desc in FIXES:
        matches = list(pattern.finditer(body))
        if matches:
            body = pattern.sub(replacement, body)
            changes.append(f"{desc} ({len(matches)}x)")

    return body, changes


def process_file(filepath, dry_run=False):
    """Process a single markdown file."""
    frontmatter, body = parse_post(filepath)
    if frontmatter is None or not body.strip():
        return None

    fixed_body, changes = fix_body(body)

    if not changes:
        return None

    result = {
        'file': os.path.basename(filepath),
        'changes': changes,
    }

    if not dry_run:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(frontmatter + fixed_body)

    return result


def main():
    parser = argparse.ArgumentParser(description='Light grammar fixes for post content')
    parser.add_argument('--dry-run', action='store_true', help='Show changes without applying')
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f"Scanning {len(files)} posts...")

    results = []
    total_fixes = 0
    for filepath in files:
        result = process_file(filepath, dry_run=args.dry_run)
        if result:
            results.append(result)
            total_fixes += len(result['changes'])

    if not results:
        print("No grammar fixes needed.")
        return

    print(f"\n{'[DRY RUN] ' if args.dry_run else ''}Fixed {total_fixes} issues across {len(results)} posts:\n")
    for r in results:
        print(f"  {r['file']}")
        for c in r['changes']:
            print(f"    - {c}")
        print()

    if args.dry_run:
        print(f"Run without --dry-run to apply changes.")


if __name__ == '__main__':
    main()
