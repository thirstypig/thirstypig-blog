#!/usr/bin/env python3
"""
Batch post enrichment: retitle, retag, classify cuisine.

Phase 1 (deterministic): Fix titles to "Venue, City", clear categories, set city tag.
Phase 2 (Claude API): Classify cuisine, generate dish tags, backfill missing titles/cities.

Usage:
  python3 scripts/enrich_posts.py --dry-run --phase1-only --limit 20
  python3 scripts/enrich_posts.py --dry-run --limit 50
  python3 scripts/enrich_posts.py                          # full run
  python3 scripts/enrich_posts.py --resume                 # resume Phase 2
"""

import argparse
import csv
import glob
import json
import os
import re
import sys
import time

import yaml

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONTENT_DIR = os.path.join(SCRIPT_DIR, '..', 'src', 'content', 'posts')
PROGRESS_FILE = os.path.join(SCRIPT_DIR, '.enrich_progress.json')
REPORT_FILE = os.path.join(SCRIPT_DIR, 'enrich_report.csv')

# City tag overrides for common abbreviations
CITY_TAG_MAP = {
    'Downtown LA': 'dtla',
    'Downtown Los Angeles': 'dtla',
    'San Gabriel Valley': 'sgv',
    'Koreatown': 'koreatown',
    'West Hollywood': 'weho',
    'Little Tokyo': 'little-tokyo',
    'Arts District': 'arts-district',
    'Silver Lake': 'silver-lake',
    'Echo Park': 'echo-park',
    'Los Feliz': 'los-feliz',
    'Eagle Rock': 'eagle-rock',
    'Highland Park': 'highland-park',
    'Beverly Hills': 'beverly-hills',
    'Santa Monica': 'santa-monica',
    'Culver City': 'culver-city',
    'Rowland Heights': 'rowland-heights',
    'Monterey Park': 'monterey-park',
    'San Gabriel': 'san-gabriel',
    'Temple City': 'temple-city',
    'Hacienda Heights': 'hacienda-heights',
    'Diamond Bar': 'diamond-bar',
    'West Covina': 'west-covina',
    'El Monte': 'el-monte',
    'Long Beach': 'long-beach',
    'Redondo Beach': 'redondo-beach',
    'Manhattan Beach': 'manhattan-beach',
    'El Segundo': 'el-segundo',
    'Hong Kong': 'hong-kong',
    'New York': 'nyc',
    'New Orleans': 'new-orleans',
    'Las Vegas': 'las-vegas',
    'San Francisco': 'san-francisco',
    'San Diego': 'san-diego',
    'Koh Samui': 'koh-samui',
    'Chongming Island': 'chongming',
}

CUISINE_VALUES = [
    'Japanese', 'Korean', 'Mexican', 'Taiwanese', 'American', 'Chinese',
    'Thai', 'Vietnamese', 'Italian', 'French', 'Indian', 'Peruvian',
    'Mediterranean', 'Filipino', 'Hawaiian', 'Colombian', 'Cajun',
    'BBQ', 'Seafood', 'Bakery', 'Dessert', 'Coffee', 'Cocktails',
    'Fusion', 'Multi',
]

CLAUDE_PROMPT = """You are classifying food blog posts for a restaurant review blog. Return ONLY valid JSON, no markdown.

Rules:
- cuisine: ONE value from: {cuisines}
- dish_tags: 1-2 specific lowercase tags about the food (e.g. "ramen", "tacos", "dim-sum", "brunch", "hot-pot", "sushi", "burgers", "cocktails", "boba", "noodles", "bbq", "fried-chicken", "steak", "pizza", "pho", "curry", "dumplings"). No generic words like "food" or "restaurant".
- title: Provide "Venue Name, City" ONLY if current title is NOT already in that format. null if title is already good.
- city: Provide ONLY if currently unknown. null otherwise.
- is_restaurant: false if this is an "About" page, contributor bio, non-food post, or meta content. true otherwise.

Post data:
Title: {title}
Location: {location}
City: {city}
Description: {description}
Body: {body}

Return: {{"cuisine":"...","dish_tags":["..."],"title":null,"city":null,"is_restaurant":true}}"""


# ---------------------------------------------------------------------------
# Frontmatter I/O
# ---------------------------------------------------------------------------

def load_post(filepath):
    """Load a post, returning (frontmatter_dict, body_text) or (None, None)."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if not content.startswith('---'):
        return None, None
    try:
        end = content.index('---', 3)
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


# ---------------------------------------------------------------------------
# Phase 1: Deterministic fixes
# ---------------------------------------------------------------------------

def city_to_tag(city):
    """Convert city name to a clean tag."""
    if not city:
        return None
    city = city.strip()
    if city in CITY_TAG_MAP:
        return CITY_TAG_MAP[city]
    return city.lower().replace(' ', '-')


def is_good_title(title, location, city):
    """Check if title is already in 'Venue, City' format."""
    if not title or not location or not city:
        return False
    expected = f"{location}, {city}"
    return title.strip() == expected.strip()


def phase1_fix(fm):
    """Apply deterministic fixes. Returns dict of changes made."""
    changes = {}
    location = (fm.get('location') or '').strip()
    city = (fm.get('city') or '').strip()
    old_title = fm.get('title', '')

    # Fix title if we have location + city
    if location and city:
        new_title = f"{location}, {city}"
        if old_title != new_title:
            changes['title'] = (old_title, new_title)
            fm['title'] = new_title

    # Set city tag
    tag = city_to_tag(city)
    old_tags = list(fm.get('tags') or [])
    fm['tags'] = [tag] if tag else []
    if old_tags != fm['tags']:
        changes['tags'] = (old_tags, fm['tags'])

    # Clear categories
    old_cats = list(fm.get('categories') or [])
    if old_cats:
        changes['categories'] = (old_cats, [])
    fm['categories'] = []

    return changes


# ---------------------------------------------------------------------------
# Phase 2: Claude API enrichment
# ---------------------------------------------------------------------------

def clean_body_for_prompt(body):
    """Extract clean text from body, removing markdown/images/hashtags."""
    if not body:
        return ''
    text = body.strip()
    # Remove image references
    text = re.sub(r'!\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'<img[^>]*>', '', text)
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove hashtags at end
    text = re.sub(r'(?:\s*#\S+)+\s*$', '', text)
    # Remove @mentions
    text = re.sub(r'@\S+', '', text)
    # Collapse whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:500]


def classify_post(client, fm, body):
    """Call Claude to classify a single post. Returns parsed JSON or None."""
    title = fm.get('title', 'unknown')
    location = fm.get('location') or 'unknown'
    city = fm.get('city') or 'unknown'
    description = (fm.get('description') or '')[:200]
    body_excerpt = clean_body_for_prompt(body)

    prompt = CLAUDE_PROMPT.format(
        cuisines=', '.join(CUISINE_VALUES),
        title=title,
        location=location,
        city=city,
        description=description,
        body=body_excerpt,
    )

    try:
        response = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=150,
            temperature=0,
            messages=[{'role': 'user', 'content': prompt}],
        )
        text = response.content[0].text.strip()
        # Strip markdown fencing if present
        text = re.sub(r'^```json\s*', '', text)
        text = re.sub(r'\s*```$', '', text)
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"  JSON parse error: {e} | raw: {text[:100]}")
        return None
    except Exception as e:
        print(f"  API error: {e}")
        return None


def apply_enrichment(fm, result):
    """Apply Claude's classification to frontmatter. Returns dict of changes."""
    changes = {}

    # Title override
    if result.get('title'):
        old = fm.get('title', '')
        fm['title'] = result['title']
        changes['title'] = (old, result['title'])

    # City backfill
    if result.get('city') and not fm.get('city'):
        fm['city'] = result['city']
        changes['city'] = ('', result['city'])

    # Cuisine
    cuisine = result.get('cuisine')
    is_restaurant = result.get('is_restaurant', True)
    if cuisine and is_restaurant:
        fm['cuisine'] = [cuisine]
        changes['cuisine'] = cuisine
    else:
        fm['cuisine'] = []
        changes['cuisine'] = ''

    # Build final tags: city + cuisine + dish_tags
    tags = []
    city_tag = city_to_tag(fm.get('city'))
    if city_tag:
        tags.append(city_tag)
    if cuisine and is_restaurant:
        cuisine_tag = cuisine.lower().replace(' ', '-')
        if cuisine_tag not in tags:
            tags.append(cuisine_tag)
    for dt in (result.get('dish_tags') or []):
        tag = dt.lower().strip()
        if tag and tag not in tags:
            tags.append(tag)

    old_tags = list(fm.get('tags') or [])
    fm['tags'] = tags
    changes['tags'] = (old_tags, tags)

    # Categories always empty
    fm['categories'] = []

    changes['dish_tags'] = result.get('dish_tags', [])
    changes['is_restaurant'] = is_restaurant

    return changes


# ---------------------------------------------------------------------------
# Progress tracking
# ---------------------------------------------------------------------------

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            return json.load(f)
    return {'phase1_complete': False, 'phase2_completed': [], 'phase2_results': {}}


def save_progress(progress):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------

def write_report(report_rows, filepath):
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'filename', 'old_title', 'new_title', 'cuisine',
            'dish_tags', 'new_tags', 'title_changed', 'city_backfilled',
        ])
        for row in report_rows:
            writer.writerow(row)
    print(f"\nReport written to {filepath} ({len(report_rows)} rows)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description='Batch enrich post metadata')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing files')
    parser.add_argument('--phase1-only', action='store_true', help='Only run deterministic fixes')
    parser.add_argument('--phase2-only', action='store_true', help='Only run AI enrichment')
    parser.add_argument('--resume', action='store_true', help='Resume Phase 2 from checkpoint')
    parser.add_argument('--limit', type=int, default=0, help='Process only first N posts')
    parser.add_argument('--batch-size', type=int, default=50, help='Save progress every N posts')
    parser.add_argument('--report', default=REPORT_FILE, help='Report output path')
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(CONTENT_DIR, '*.md')))
    if args.limit:
        files = files[:args.limit]
    print(f"Processing {len(files)} posts (dry_run={args.dry_run})")

    progress = load_progress() if args.resume else {'phase1_complete': False, 'phase2_completed': [], 'phase2_results': {}}
    report_rows = []

    # --- Phase 1 ---
    if not args.phase2_only:
        print(f"\n{'='*60}")
        print("PHASE 1: Deterministic fixes")
        print(f"{'='*60}")
        changed = 0
        for filepath in files:
            fname = os.path.basename(filepath)
            fm, body = load_post(filepath)
            if fm is None:
                continue

            changes = phase1_fix(fm)
            if changes:
                changed += 1
                if 'title' in changes:
                    old, new = changes['title']
                    print(f"  TITLE: {old[:50]} -> {new[:50]}")
                if not args.dry_run:
                    save_post(filepath, fm, body)

        print(f"\nPhase 1: {changed}/{len(files)} posts modified")
        if not args.dry_run:
            progress['phase1_complete'] = True
            save_progress(progress)

    # --- Phase 2 ---
    if not args.phase1_only:
        print(f"\n{'='*60}")
        print("PHASE 2: Claude API enrichment")
        print(f"{'='*60}")

        api_key = os.environ.get('ANTHROPIC_API_KEY')
        if not api_key:
            print("ERROR: Set ANTHROPIC_API_KEY environment variable")
            sys.exit(1)

        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        completed_set = set(progress.get('phase2_completed', []))
        batch_count = 0
        total_classified = 0

        for i, filepath in enumerate(files):
            fname = os.path.basename(filepath)

            # Skip already completed
            if args.resume and fname in completed_set:
                continue

            fm, body = load_post(filepath)
            if fm is None:
                continue

            # Classify with Claude
            result = classify_post(client, fm, body)
            if result is None:
                print(f"  SKIP (API error): {fname}")
                continue

            # Apply enrichment
            old_title = fm.get('title', '')
            changes = apply_enrichment(fm, result)
            new_title = fm.get('title', '')

            # Report row
            report_rows.append([
                fname,
                old_title,
                new_title,
                changes.get('cuisine', ''),
                '|'.join(changes.get('dish_tags', [])),
                '|'.join(fm.get('tags', [])),
                'Y' if old_title != new_title else '',
                'Y' if changes.get('city') else '',
            ])

            total_classified += 1
            cuisine = changes.get('cuisine', '?')
            dish = '|'.join(changes.get('dish_tags', []))
            tags = ', '.join(fm.get('tags', []))
            print(f"  [{total_classified}/{len(files)}] {fname[:55]}  cuisine={cuisine}  dish={dish}  tags=[{tags}]")

            if not args.dry_run:
                save_post(filepath, fm, body)

            # Progress tracking
            progress['phase2_completed'].append(fname)
            progress['phase2_results'][fname] = result
            batch_count += 1

            if batch_count >= args.batch_size and not args.dry_run:
                save_progress(progress)
                batch_count = 0
                print(f"  ... checkpoint saved ({total_classified} done)")

            # Small delay to be nice to the API
            time.sleep(0.05)

        if not args.dry_run:
            save_progress(progress)

        print(f"\nPhase 2: {total_classified} posts classified")

        # Write report
        if report_rows:
            write_report(report_rows, args.report)

    print("\nDone!")


if __name__ == '__main__':
    main()
