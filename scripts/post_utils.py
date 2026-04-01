"""Shared utilities for loading and saving blog post frontmatter."""

import os

import yaml


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
