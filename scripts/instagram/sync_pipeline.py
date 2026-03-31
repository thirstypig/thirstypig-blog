#!/usr/bin/env python3
"""
Instagram Auto-Sync Pipeline Orchestrator.

Accepts a ZIP file from an Instagram data export, extracts it safely,
runs all processing scripts in sequence, validates output, and logs results.

Usage:
  python scripts/instagram/sync_pipeline.py /path/to/export.zip
"""

import glob
import json
import os
import shutil
import subprocess
import sys
import zipfile
from datetime import datetime, timezone

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..'))
DATA_DIR = os.path.join(SCRIPT_DIR, 'data')
CONTENT_DIR = os.path.join(PROJECT_ROOT, 'src', 'content', 'posts')
LOGS_DIR = os.path.join(PROJECT_ROOT, 'logs')
SYNC_LOG = os.path.join(LOGS_DIR, 'sync-log.json')

# Safety limits
MAX_FILE_SIZE = 50 * 1024 * 1024       # 50 MB per entry
MAX_FILE_COUNT = 10_000
MAX_TOTAL_SIZE = 2 * 1024 * 1024 * 1024  # 2 GB total


def safe_extract_zip(zip_path: str, dest_dir: str) -> None:
    """Extract ZIP with ZIP-slip protection and size limits."""
    dest = os.path.realpath(dest_dir)

    with zipfile.ZipFile(zip_path, 'r') as zf:
        members = zf.infolist()

        if len(members) > MAX_FILE_COUNT:
            raise ValueError(
                f"ZIP contains {len(members)} files, exceeds limit of {MAX_FILE_COUNT}"
            )

        total_size = sum(m.file_size for m in members)
        if total_size > MAX_TOTAL_SIZE:
            raise ValueError(
                f"ZIP total uncompressed size {total_size} bytes exceeds "
                f"limit of {MAX_TOTAL_SIZE} bytes"
            )

        for member in members:
            # Check individual file size
            if member.file_size > MAX_FILE_SIZE:
                raise ValueError(
                    f"Entry {member.filename!r} is {member.file_size} bytes, "
                    f"exceeds limit of {MAX_FILE_SIZE} bytes"
                )

            # ZIP slip protection: resolve the target path and ensure it
            # stays within the destination directory
            target = os.path.realpath(os.path.join(dest, member.filename))
            if not target.startswith(dest + os.sep) and target != dest:
                raise ValueError(
                    f"ZIP slip detected: {member.filename!r} resolves outside "
                    f"destination directory"
                )

        # All checks passed -- extract
        zf.extractall(dest)


def validate_posts_json(data_dir: str) -> list[str]:
    """Verify at least one posts_*.json exists. Return matching paths."""
    matches = glob.glob(os.path.join(data_dir, '**', 'posts_*.json'), recursive=True)
    if not matches:
        raise FileNotFoundError(
            "No posts_*.json found in extracted data. "
            "Is this a valid Instagram export?"
        )
    return matches


def count_markdown_files() -> set[str]:
    """Return set of current markdown filenames in content dir."""
    return set(glob.glob(os.path.join(CONTENT_DIR, '*.md')))


def run_step(label: str, cmd: list[str], critical: bool = False) -> bool:
    """Run a subprocess step. Returns True on success."""
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")

    result = subprocess.run(cmd, cwd=PROJECT_ROOT)

    if result.returncode != 0:
        msg = f"FAILED (exit {result.returncode}): {label}"
        if critical:
            print(f"  CRITICAL {msg}")
            raise RuntimeError(msg)
        else:
            print(f"  WARNING {msg} -- continuing")
            return False

    print(f"  OK: {label}")
    return True


def validate_new_markdown(new_files: set[str]) -> list[str]:
    """Parse YAML frontmatter of newly-created markdown files. Return errors."""
    # Import yaml here -- it's available since the other scripts use it
    import yaml

    errors = []
    for path in sorted(new_files):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()

            if not content.startswith('---'):
                errors.append(f"{os.path.basename(path)}: missing YAML frontmatter")
                continue

            # Extract frontmatter between first two '---' markers
            parts = content.split('---', 2)
            if len(parts) < 3:
                errors.append(f"{os.path.basename(path)}: malformed frontmatter")
                continue

            yaml.safe_load(parts[1])

        except yaml.YAMLError as e:
            errors.append(f"{os.path.basename(path)}: invalid YAML -- {e}")
        except Exception as e:
            errors.append(f"{os.path.basename(path)}: {e}")

    return errors


def append_sync_log(entry: dict) -> None:
    """Append an entry to the sync log JSON file."""
    os.makedirs(LOGS_DIR, exist_ok=True)

    log = []
    if os.path.exists(SYNC_LOG):
        try:
            with open(SYNC_LOG, 'r', encoding='utf-8') as f:
                log = json.load(f)
        except (json.JSONDecodeError, ValueError):
            log = []

    log.append(entry)

    with open(SYNC_LOG, 'w', encoding='utf-8') as f:
        json.dump(log, f, indent=2, ensure_ascii=False)


def main() -> int:
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <path-to-zip>", file=sys.stderr)
        return 1

    zip_path = os.path.abspath(sys.argv[1])
    if not os.path.isfile(zip_path):
        print(f"Error: ZIP file not found: {zip_path}", file=sys.stderr)
        return 1

    python = sys.executable
    errors: list[str] = []
    new_posts_count = 0
    venues_extracted = 0
    geocoded_count = 0

    # Snapshot existing markdown files before we start
    before_files = count_markdown_files()

    # ------------------------------------------------------------------
    # Step 1: Extract ZIP safely
    # ------------------------------------------------------------------
    print(f"\nExtracting {os.path.basename(zip_path)} -> {DATA_DIR}")
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        safe_extract_zip(zip_path, DATA_DIR)
    except Exception as e:
        print(f"Error extracting ZIP: {e}", file=sys.stderr)
        return 1

    try:
        # ------------------------------------------------------------------
        # Step 2: Validate posts JSON exists
        # ------------------------------------------------------------------
        try:
            found = validate_posts_json(DATA_DIR)
            print(f"Found {len(found)} posts JSON file(s)")
        except FileNotFoundError as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1

        # ------------------------------------------------------------------
        # Step 3: Import Instagram posts (CRITICAL)
        # ------------------------------------------------------------------
        run_step(
            "Import Instagram posts",
            [python, os.path.join(SCRIPT_DIR, 'import_instagram.py')],
            critical=True,
        )

        # Count new posts created
        after_import = count_markdown_files()
        new_files = after_import - before_files
        new_posts_count = len(new_files)
        print(f"  New posts created: {new_posts_count}")

        # ------------------------------------------------------------------
        # Step 4: Extract venues from captions (non-critical)
        # ------------------------------------------------------------------
        ok = run_step(
            "Extract venues from captions",
            [python, os.path.join(SCRIPT_DIR, 'extract_ig_venues.py')],
            critical=False,
        )
        if not ok:
            errors.append("extract_ig_venues failed")

        # Count venue extractions by checking how many new files got a location
        import yaml
        for path in sorted(new_files):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    fm = yaml.safe_load(parts[1]) or {}
                    if fm.get('location'):
                        venues_extracted += 1
            except Exception:
                pass

        # ------------------------------------------------------------------
        # Step 5: Cleanup locations (non-critical)
        # ------------------------------------------------------------------
        ok = run_step(
            "Cleanup locations",
            [python, os.path.join(PROJECT_ROOT, 'scripts', 'cleanup_locations.py')],
            critical=False,
        )
        if not ok:
            errors.append("cleanup_locations failed")

        # ------------------------------------------------------------------
        # Step 6: Fix venues from @mentions (non-critical)
        # ------------------------------------------------------------------
        ok = run_step(
            "Fix venues from @mentions",
            [python, os.path.join(PROJECT_ROOT, 'scripts', 'fix_venues_from_mentions.py')],
            critical=False,
        )
        if not ok:
            errors.append("fix_venues_from_mentions failed")

        # ------------------------------------------------------------------
        # Step 7: Geocode via Foursquare (non-critical)
        # ------------------------------------------------------------------
        ok = run_step(
            "Geocode addresses (Foursquare)",
            [python, os.path.join(PROJECT_ROOT, 'scripts', 'lookup_addresses.py'),
             '--limit', '50'],
            critical=False,
        )
        if not ok:
            errors.append("lookup_addresses failed")

        # Count geocoded posts among new files
        for path in sorted(new_files):
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                parts = content.split('---', 2)
                if len(parts) >= 3:
                    fm = yaml.safe_load(parts[1]) or {}
                    if fm.get('coordinates') or (fm.get('latitude') and fm.get('longitude')):
                        geocoded_count += 1
            except Exception:
                pass

        # ------------------------------------------------------------------
        # Step 8: Validate new markdown files
        # ------------------------------------------------------------------
        print(f"\n{'='*60}")
        print("  Validating new markdown files")
        print(f"{'='*60}")

        validation_errors = validate_new_markdown(new_files)
        if validation_errors:
            for ve in validation_errors:
                print(f"  WARN: {ve}")
                errors.append(ve)
        else:
            print(f"  OK: All {len(new_files)} new files have valid YAML")

    finally:
        # ------------------------------------------------------------------
        # Cleanup: remove extracted data
        # ------------------------------------------------------------------
        print(f"\nCleaning up {DATA_DIR}")
        try:
            shutil.rmtree(DATA_DIR)
        except Exception as e:
            print(f"  Warning: cleanup failed: {e}")

    # ------------------------------------------------------------------
    # Write sync log
    # ------------------------------------------------------------------
    log_entry = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'zip_filename': os.path.basename(zip_path),
        'new_posts_count': new_posts_count,
        'venues_extracted': venues_extracted,
        'geocoding_count': geocoded_count,
        'errors': errors,
    }
    append_sync_log(log_entry)

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print(f"\n{'='*60}")
    print("Instagram Sync Complete")
    print(f"  New posts: {new_posts_count}")
    print(f"  Venues extracted: {venues_extracted}")
    print(f"  Geocoded: {geocoded_count}")
    print(f"  Errors: {len(errors)}")
    print(f"{'='*60}")

    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"\nABORTED: {e}", file=sys.stderr)
        # Cleanup on critical failure
        if os.path.isdir(DATA_DIR):
            print(f"Cleaning up {DATA_DIR}")
            shutil.rmtree(DATA_DIR, ignore_errors=True)
        sys.exit(1)
