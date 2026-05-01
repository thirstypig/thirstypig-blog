"""Lock-down test against the silent-failure class documented at
docs/solutions/data-issues/pyyaml-tolerates-duplicate-keys-jsyaml-strict-catch.md.

PyYAML's `safe_load` accepts duplicate mapping keys with last-wins
semantics — silently. js-yaml (used by src/pages/data-quality.json.ts on
the same file) rejects them per YAML 1.2. We had 33 duplicate `cid:`
field lines accumulate across 30 entries before js-yaml caught it.

This test elevates duplicate-key tolerance to a build failure on the
Python side too, so a future scraper-write regression fails fast in
pre-commit instead of festering until a JS consumer trips over it.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

VENUES = Path(__file__).resolve().parent / "venues.yaml"


class StrictLoader(yaml.SafeLoader):
    """SafeLoader that raises on duplicate mapping keys."""


def _no_duplicates(loader, node, deep=False):
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            raise ValueError(
                f"Duplicate key {key!r} at line {key_node.start_mark.line + 1}"
            )
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


StrictLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _no_duplicates
)


def test_venues_yaml_has_no_duplicate_keys():
    with VENUES.open() as f:
        try:
            yaml.load(f, Loader=StrictLoader)
        except ValueError as e:
            pytest.fail(f"venues.yaml has duplicate keys: {e}")
