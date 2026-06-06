#!/usr/bin/env python3
"""
Migrate IG post prose: remove redundant embedded images from body and
move caption text to the top.

Background: The Instagram importer wrote posts as:
  [image lines]  ← redundant; BlogPost.astro renders these via heroImage + inline gallery loop
  [video lines]  ← keep; videos are NOT in frontmatter
  [caption text] ← move to top; strip trailing @mentions / #hashtags

Run dry-run first (default), then --apply to write changes:
  python3 scripts/migrate_ig_prose.py           # dry-run: shows counts
  python3 scripts/migrate_ig_prose.py --apply   # writes changes to disk
"""

import re
import sys
from pathlib import Path

POSTS_DIR = Path("src/content/posts")

IMG_LINE_RE = re.compile(r'^!\[.*?\]\(.*?\)\s*$')
VIDEO_LINE_RE = re.compile(r'^<video\b')
# Strip trailing IG artifact block: sequences of space-separated @mentions and #hashtags
IG_TRAILING_RE = re.compile(r'(\s+[@#]\S+)+\s*$')


def strip_ig_artifacts(text: str) -> str:
    """Remove trailing @mention / #hashtag block from caption text."""
    return IG_TRAILING_RE.sub('', text).rstrip()


def migrate_post(filepath: Path, apply: bool) -> dict:
    raw = filepath.read_text(encoding='utf-8')

    parts = raw.split('---', 2)
    if len(parts) < 3:
        return {'status': 'skip', 'reason': 'no frontmatter'}

    fm_block, body_raw = parts[1], parts[2]

    if 'source: instagram' not in fm_block:
        return {'status': 'skip', 'reason': 'not instagram'}

    lines = body_raw.split('\n')

    img_lines, video_lines, text_lines, blank_lines = [], [], [], []
    for line in lines:
        s = line.strip()
        if not s:
            blank_lines.append(line)
        elif IMG_LINE_RE.match(s):
            img_lines.append(line)
        elif VIDEO_LINE_RE.match(s):
            video_lines.append(line)
        else:
            text_lines.append(line)

    if not img_lines:
        return {'status': 'skip', 'reason': 'already clean (no img lines)'}

    # Build clean caption text
    caption = '\n'.join(text_lines).strip()
    caption = strip_ig_artifacts(caption)

    # New body: caption first, then video (if any), no image lines
    new_body_parts = []
    if caption:
        new_body_parts.append(caption)
    if video_lines:
        new_body_parts.append('\n'.join(video_lines))

    new_body = '\n\n'.join(new_body_parts)
    new_content = f'---{fm_block}---\n\n{new_body}\n' if new_body else f'---{fm_block}---\n'

    result = {
        'status': 'migrated',
        'imgs_removed': len(img_lines),
        'videos_kept': len(video_lines),
        'has_caption': bool(caption),
    }

    if apply:
        filepath.write_text(new_content, encoding='utf-8')
        result['written'] = True

    return result


def main():
    apply = '--apply' in sys.argv

    counts = {'migrated': 0, 'skip_not_ig': 0, 'skip_clean': 0, 'skip_other': 0,
              'no_caption': 0, 'has_video': 0, 'imgs_removed': 0}

    for filepath in sorted(POSTS_DIR.glob('*.md')):
        r = migrate_post(filepath, apply=apply)
        if r['status'] == 'skip':
            if 'not instagram' in r['reason']:
                counts['skip_not_ig'] += 1
            elif 'clean' in r['reason']:
                counts['skip_clean'] += 1
            else:
                counts['skip_other'] += 1
        else:
            counts['migrated'] += 1
            counts['imgs_removed'] += r['imgs_removed']
            if not r['has_caption']:
                counts['no_caption'] += 1
            if r['videos_kept']:
                counts['has_video'] += 1

    mode = 'APPLY' if apply else 'DRY-RUN'
    print(f'\n=== migrate_ig_prose [{mode}] ===')
    print(f"Posts migrated:      {counts['migrated']}")
    print(f"  Images removed:    {counts['imgs_removed']}")
    print(f"  No caption:        {counts['no_caption']} (body will be empty — OK)")
    print(f"  Has video:         {counts['has_video']} (video tags preserved)")
    print(f"Posts skipped:")
    print(f"  Not Instagram:     {counts['skip_not_ig']}")
    print(f"  Already clean:     {counts['skip_clean']}")
    print(f"  Other:             {counts['skip_other']}")

    total_posts = counts['migrated'] + counts['skip_not_ig'] + counts['skip_clean'] + counts['skip_other']
    print(f"\nTotal posts scanned: {total_posts}")

    assert counts['migrated'] > 0, "ERROR: 0 posts migrated — check POSTS_DIR path"
    assert counts['imgs_removed'] > 0, "ERROR: 0 images removed — check IMG_LINE_RE"

    if not apply:
        print('\nRun with --apply to write changes.')


if __name__ == '__main__':
    main()
