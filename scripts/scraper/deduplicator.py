"""Step 4: Deduplicate posts across domains."""

import json
import os
from difflib import SequenceMatcher

from config import DATA_DIR, DOMAINS, FUZZY_MATCH_THRESHOLD
from utils import normalize_title


def deduplicate_posts(parsed_posts: list[dict]) -> list[dict]:
    """Deduplicate posts across domains using title + date matching."""
    print(f'\nDeduplicating {len(parsed_posts)} posts...')

    # Group by normalized title + month/year for exact matching
    groups: dict[str, list[dict]] = {}
    for post in parsed_posts:
        date = post.get('date', '')[:7]  # YYYY-MM
        key = f'{normalize_title(post["title"])}|{date}'
        groups.setdefault(key, []).append(post)

    # Pass 1: Exact matches - pick best from each group
    unique = {}
    duplicates = []

    for key, group in groups.items():
        if len(group) == 1:
            post = group[0]
            unique[key] = post
        else:
            # Sort by priority (lower = better)
            group.sort(key=lambda p: DOMAINS.get(p['domain'], {}).get('priority', 99))
            winner = group[0]
            losers = group[1:]

            # Merge categories and tags from losers
            all_categories = set(winner.get('categories', []))
            all_tags = set(winner.get('tags', []))
            for loser in losers:
                all_categories.update(loser.get('categories', []))
                all_tags.update(loser.get('tags', []))
                duplicates.append({
                    'winner': winner['url'],
                    'loser': loser['url'],
                    'method': 'exact',
                })

            winner['categories'] = list(all_categories)
            winner['tags'] = list(all_tags)
            unique[key] = winner

    # Pass 2: Fuzzy matching on remaining posts within same month
    unique_list = list(unique.values())
    to_remove = set()

    # Group remaining by month for fuzzy comparison
    by_month: dict[str, list[tuple[int, dict]]] = {}
    for i, post in enumerate(unique_list):
        month = post.get('date', '')[:7]
        by_month.setdefault(month, []).append((i, post))

    for month, month_posts in by_month.items():
        if len(month_posts) < 2:
            continue

        for i, (idx_a, post_a) in enumerate(month_posts):
            if idx_a in to_remove:
                continue
            title_a = normalize_title(post_a['title'])

            for idx_b, post_b in month_posts[i + 1:]:
                if idx_b in to_remove:
                    continue
                title_b = normalize_title(post_b['title'])

                ratio = SequenceMatcher(None, title_a, title_b).ratio()
                if ratio >= FUZZY_MATCH_THRESHOLD:
                    # Pick the one with higher priority (lower number)
                    pri_a = DOMAINS.get(post_a['domain'], {}).get('priority', 99)
                    pri_b = DOMAINS.get(post_b['domain'], {}).get('priority', 99)

                    if pri_a <= pri_b:
                        to_remove.add(idx_b)
                        duplicates.append({
                            'winner': post_a['url'],
                            'loser': post_b['url'],
                            'method': 'fuzzy',
                            'ratio': round(ratio, 3),
                        })
                    else:
                        to_remove.add(idx_a)
                        duplicates.append({
                            'winner': post_b['url'],
                            'loser': post_a['url'],
                            'method': 'fuzzy',
                            'ratio': round(ratio, 3),
                        })
                        break

    # Remove fuzzy duplicates
    final = [post for i, post in enumerate(unique_list) if i not in to_remove]

    # Sort by date
    final.sort(key=lambda p: p.get('date', ''))

    print(f'  Exact duplicates removed: {sum(1 for d in duplicates if d["method"] == "exact")}')
    print(f'  Fuzzy duplicates removed: {sum(1 for d in duplicates if d["method"] == "fuzzy")}')
    print(f'  Final unique posts: {len(final)}')

    # Save dedup report
    report_file = os.path.join(DATA_DIR, 'dedup_report.json')
    with open(report_file, 'w') as f:
        json.dump({
            'total_input': len(parsed_posts),
            'total_output': len(final),
            'duplicates_removed': len(duplicates),
            'duplicates': duplicates,
        }, f, indent=2)
    print(f'  Dedup report saved to {report_file}')

    return final
