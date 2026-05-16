"""Shared I/O helpers for venues.yaml — imported by all venue-tag scripts."""

from pathlib import Path

import yaml

VENUES_PATH = Path(__file__).resolve().parent / "venues.yaml"


def load_venues() -> list[dict]:
    return yaml.safe_load(VENUES_PATH.read_text())
