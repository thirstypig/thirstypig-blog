#!/usr/bin/env python3
"""
Sync categories from cuisine field.

Sets categories = cuisine for restaurant posts.
Posts with no cuisine get categories = ["Uncategorized"].

Usage:
  python3 scripts/sync_categories.py --dry-run
  python3 scripts/sync_categories.py
"""

import glob
import os
import sys

from post_utils import load_post, save_post

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTENT_DIR = os.path.join(SCRIPT_DIR, '..', 'src', 'content', 'posts')


def main():
    dry_run = '--dry-run' in sys.argv
    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    print(f"Processing {len(files)} posts (dry_run={dry_run})")

    changed = 0
    uncategorized = 0
    categorized = 0

    for filepath in files:
        fname = os.path.basename(filepath)
        fm, body = load_post(filepath)
        if fm is None:
            continue

        cuisine = fm.get('cuisine') or []
        old_categories = fm.get('categories') or []

        if cuisine:
            new_categories = list(cuisine)
        else:
            new_categories = ['Uncategorized']
            uncategorized += 1

        if old_categories != new_categories:
            changed += 1
            if dry_run and changed <= 20:
                print(f"  {fname}: {old_categories} -> {new_categories}")
            fm['categories'] = new_categories
            if not dry_run:
                save_post(filepath, fm, body)

        if cuisine:
            categorized += 1

    print(f"\nResults:")
    print(f"  {categorized} posts with cuisine -> categories")
    print(f"  {uncategorized} posts -> Uncategorized")
    print(f"  {changed} posts modified")
    if dry_run:
        print(f"\n  (dry run — no files written)")


if __name__ == '__main__':
    main()
