---
title: YAML Duplicate Keys from Regex-Based Field Injection
slug: yaml-duplicate-keys-regex-injection
category: data-issues
severity: high
date: 2026-05-05
status: solved
tags:
  - yaml-parsing
  - data-integrity
  - venue-tags-pipeline
  - regex-injection
related_issues:
  - "#97"  # PyYAML/js-yaml parser parity
  - "#96"  # Places API integration
components:
  - scripts/venue-tags/lookup_place_ids_api.py
  - scripts/venue-tags/venues.yaml
keywords:
  - duplicate keys
  - yaml validation
  - pre-commit hooks
  - idempotency
---

# YAML Duplicate Keys from Regex-Based Field Injection

## Problem

After running the venue-tags batch pipeline (specifically `lookup_place_ids_api.py` to inject Google Places `place_id` and `cid` fields into `venues.yaml`), the pre-commit hook `test_venues_yaml_no_duplicate_keys` **rejected the commit** with duplicate key violations.

**Failure Details:**
- 22 duplicate lines across 21 venue entries
- All duplicates were consecutive lines at identical indentation with the same key name (`cid`)
- Example: Mundo Cafe entry had two identical lines: `cid: "13770102953811356094"` (lines 746–747)
- Structural validation: `yaml.safe_load()` rejects YAML with duplicate keys at same level

## Investigation

### Discovery Steps

1. **Failure Detection** → Pre-commit hook identified duplicate `cid` keys during `yaml.safe_load()` validation
2. **Pattern Analysis** → Python script scanned venues.yaml and found 21 venue entries with duplicate key pairs (all `cid` field)
3. **Timing Evidence** → All duplicates traced to a single batch run; pipeline had not run twice (rules out simple re-run logic error)
4. **Scope Assessment** → 22 problematic lines out of ~6,500 total; geographically scattered venues (not a batching artifact)
5. **Validation Proof** → After deduplication, `yaml.safe_load()` parsed cleanly with 366 venue entries intact

## Root Cause

The `lookup_place_ids_api.py` script uses a regex-based field injection function (`write_yaml_field()`) to append new key-value pairs to YAML entries:

```python
def write_yaml_field(content, key, venue_key, field_name, field_value):
    # Regex pattern to find the venue entry and inject after a reference line
    pattern = r"(- key: {key}.*?query:.*?\n)".format(key=re.escape(venue_key))
    replacement = r"\1  {}: {}\n".format(field_name, field_value)
    return re.sub(pattern, replacement, content, flags=re.DOTALL)
```

**Problem:** This function **does not check whether the field already exists** before appending. When the script processes an entry that already has `cid` from a previous operation, it appends another `cid:` line instead of replacing or skipping.

**Why it happened:** 
- The Places API lookup returns both a `place_id` (FID hex pair) and a `cid` (Google Places decimal ID)
- On the first run, the script would inject both fields
- If the script or a similar process ran again on the same venue, it would append duplicate `cid` lines
- YAML parser tolerates this during editing but `yaml.safe_load()` rejects it

## Solution

### Deduplication Script

Identify and remove duplicate consecutive lines with identical indentation + key name:

```python
import yaml
from pathlib import Path

venues_path = Path("scripts/venue-tags/venues.yaml")
lines = venues_path.read_text().split('\n')

# Find which line indices to remove
lines_to_remove = set()
for i in range(len(lines) - 1):
    if lines[i].startswith('  ') and ':' in lines[i]:
        key1 = lines[i].split(':')[0].strip()
        if i + 1 < len(lines) and lines[i+1].startswith('  ') and ':' in lines[i+1]:
            key2 = lines[i+1].split(':')[0].strip()
            if key1 == key2:
                lines_to_remove.add(i+1)  # Mark second occurrence for removal

# Rebuild file without duplicates
output_lines = [line for i, line in enumerate(lines) if i not in lines_to_remove]
fixed_content = '\n'.join(output_lines)

# Validate before writing
yaml.safe_load(fixed_content)  # Raises if malformed
venues_path.write_text(fixed_content)
print(f"Removed {len(lines_to_remove)} duplicate lines")
```

### Verification

- Ran deduplication script: removed 22 lines
- Validated with `yaml.safe_load()`: parsed successfully with 366 entries
- Verified entry counts matched expectations
- Pre-commit hook passed after fix

## Prevention

### Strategy 1: Pre-Write Validation in Pipeline Scripts

Before `write_yaml_field()` appends a new field, check if the key already exists in that entry:

```python
def write_yaml_field_safe(content, venue_key, field_name, field_value):
    """Safely inject field; skip if already present (idempotent)."""
    pattern = rf"(- key: {re.escape(venue_key)}.*?)(?=^- key|\Z)"
    
    def replace_fn(match):
        entry = match.group(1)
        # Check if field already exists at same indentation
        if re.search(rf"^  {re.escape(field_name)}:", entry, re.MULTILINE):
            return entry  # Skip; field exists
        # Otherwise inject
        return entry + f"  {field_name}: {field_value}\n"
    
    return re.sub(pattern, replace_fn, content, flags=re.DOTALL | re.MULTILINE)
```

**Why:** Fail-loud pattern catches the problem at write time, not at commit time.

### Strategy 2: Idempotency Tests

Add a test fixture that runs the pipeline twice on the same input and asserts no duplicates emerge:

```python
def test_lookup_place_ids_api_is_idempotent():
    """Running the script twice on same input should not create duplicates."""
    original = venues_content()
    
    # First run
    result1 = lookup_place_ids_api.update_venues(original, test_venues)
    
    # Second run on already-updated content
    result2 = lookup_place_ids_api.update_venues(result1, test_venues)
    
    # Validate both parse and have no duplicates
    yaml.safe_load(result1)
    yaml.safe_load(result2)
    
    # Extract duplicate counts
    duplicates1 = count_duplicate_keys(result1)
    duplicates2 = count_duplicate_keys(result2)
    
    assert duplicates1 == 0, "First run created duplicates"
    assert duplicates2 == 0, "Second run created duplicates"
```

### Strategy 3: Replace Regex Injection with Proper YAML Parsing

Avoid the entire class of injection bugs by using proper YAML parsing:

```python
def write_yaml_field_correct(yaml_path, venue_key, field_name, field_value):
    """Update YAML by parsing, modifying dict, and dumping."""
    with open(yaml_path) as f:
        venues = yaml.safe_load(f)
    
    # Find and update the entry
    for entry in venues:
        if entry.get('key') == venue_key:
            entry[field_name] = field_value
            break
    
    # Write back cleanly
    with open(yaml_path, 'w') as f:
        yaml.dump(venues, f, default_flow_style=False, sort_keys=False)
```

**Why:** YAML parsing guarantees structural correctness; regex manipulation cannot.

## Related Issues

- **#97**: PyYAML vs js-yaml parser strictness parity — js-yaml's stricter validation caught 33 latent duplicate keys that PyYAML had silently tolerated
- **#96**: Places API integration with self-healing scraper fallback — the venue-tags pipeline that triggered this issue
- **Cross-parser validation pattern**: Stricter second consumer (js-yaml) acts as accidental linter for PyYAML producer output

## Key Insights

1. **Regex injection is fragile.** Without explicit checks, it can create structural violations that pass manual review but fail strict parsers.
2. **Silent tolerance is dangerous.** PyYAML silently read duplicate keys; js-yaml's stricter validation would have caught this immediately.
3. **Idempotency matters in pipelines.** A script that's "not designed to run twice" should be tested to ensure it's safe if it does.
4. **Validation should happen at write time**, not commit time. Catching the issue during `write_yaml_field()` execution is faster than a failed pre-commit hook.

## Test Coverage

- `scripts/venue-tags/test_venues_yaml_no_duplicate_keys.py` — Unit test for duplicate key detection (all 112 tests passing)
- Pre-commit hook `test_venues_yaml_no_duplicate_keys` — Structural validation on every commit

## Follow-Up

- [ ] Refactor `lookup_place_ids_api.py` to use Strategy 3 (proper YAML parsing)
- [ ] Add idempotency test (Strategy 2) to prevent regression
- [ ] Update pipeline documentation to warn about duplicate-key risk in regex-based injection patterns
