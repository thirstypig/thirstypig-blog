---
title: "js-yaml strict duplicate-key parser exposed PyYAML silent-accept dupes in venues.yaml"
date: 2026-04-30
status: solved
tags:
  - yaml
  - parsers
  - strict-vs-lenient
  - cross-language
  - data-integrity
  - brand:thirstypig
problem_type: silent-corruption
component: venues-yaml-pipeline
related_files:
  - src/pages/data-quality.json.ts
  - scripts/venue-tags/venues.yaml
  - scripts/venue-tags/lookup_place_ids_api.py
  - scripts/venue-tags/scrape_google.py
pr: 97
---

# Stricter parser caught 33 latent duplicate keys PyYAML had silently tolerated

## Symptom

A newly added TypeScript admin endpoint (`src/pages/data-quality.json.ts`) that loaded `scripts/venue-tags/venues.yaml` via `js-yaml` failed at parse time. After `npm run dev`, curling the endpoint returned a 500 with a `YAMLException`:

```
YAMLException: duplicated mapping key (153:3)
 150 |   city: Los Angeles
 151 |   query: "Ave 26 Tacos Lincoln Heights Los Angeles"
 152 |   place_id: "0x80c2c3eb0240144d:0xb85fa85974b60789"
 153 |   cid: "13285522527929894793"
-----^
 154 |   cid: "13285522527929894793"
```

The same file had been read happily for months by the Python venue-tags pipeline using `yaml.safe_load` (PyYAML). Nothing about the YAML had changed — only the consumer.

## Investigation

The exception pointed at exact coordinates (line 153, column 3), which made the first instance trivial to confirm by eye. The interesting question was whether this was a one-off or systemic.

A regex sweep across the file, scoped to each venue block (delimited by `^- key:` boundaries), showed the duplication was widespread:

```python
import re
from pathlib import Path

text = Path("scripts/venue-tags/venues.yaml").read_text()
blocks = re.split(r"(?m)^(?=- key:)", text)

dupe_blocks = 0
dupe_lines = 0
for block in blocks:
    if not block.strip():
        continue
    seen = {}
    for line in block.splitlines():
        m = re.match(r"^\s{2,}([a-zA-Z_]+):", line)
        if not m:
            continue
        field = m.group(1)
        seen[field] = seen.get(field, 0) + 1
    repeats = sum(c - 1 for c in seen.values() if c > 1)
    if repeats:
        dupe_blocks += 1
        dupe_lines += repeats

print(f"{dupe_blocks} venue blocks with duplicates, {dupe_lines} duplicate lines total")
```

Output: **30 venue blocks with duplicates, 33 duplicate lines total** — almost all of them `cid:` repeats. Every duplicate pair held identical values, which explained why the Python pipeline had never misbehaved at runtime: PyYAML's last-wins semantics gave the same answer as first-wins when both sides agreed.

Cross-checking parser behavior confirmed the split:

- **PyYAML (`yaml.safe_load`)** silently accepts duplicate mapping keys and retains the last value. No warning, no error.
- **js-yaml** rejects duplicate keys with `YAMLException` per the YAML 1.2 spec ("the keys in a mapping should be unique").
- **The `yaml` npm package** (YAML 1.2 strict mode) also rejects.

Adopting js-yaml had effectively turned on a linter that PyYAML never ran.

## Root cause

A code path in the Python scrape pipeline was emitting `cid:` (and a few sibling fields) twice when writing certain venue records back to `venues.yaml` — likely a double-call into the writer or a merge step that re-appended already-present fields without de-duplicating. Because the values were always identical, PyYAML's tolerance hid the bug. The data file accumulated 33 extra lines across 30 venues over time, no test caught it, and no consumer flinched until a stricter parser arrived.

The latent risks the silent tolerance was masking:

- **Diff bloat** — 33 dead lines polluting every diff that touched the file.
- **Merge conflict roulette** — if a future edit changed one of the duplicates, a three-way merge could resolve to the wrong line.
- **Drift-induced silent breakage** — the moment a duplicate's value diverged from its twin, last-wins would either silently overwrite the canonical value or silently retain a stale one, depending on write order. No alarm, no log line.

## Solution

A short Python script that splits the file on venue boundaries, walks each block tracking seen field names, drops repeat field-name lines (preserving the first occurrence), and writes the file back. Run once, 33 lines removed, 364 venues preserved, all entries uniquely keyed. The js-yaml endpoint parsed clean on the next request.

Going forward, js-yaml's strict parsing acts as a tripwire: any future double-write regression in the Python pipeline will fail the admin endpoint immediately instead of festering.

## Code excerpts

Detector (the "found it" script):

```python
import re
from pathlib import Path

text = Path("scripts/venue-tags/venues.yaml").read_text()
blocks = re.split(r"(?m)^(?=- key:)", text)

for i, block in enumerate(blocks):
    if not block.strip():
        continue
    seen = {}
    for line in block.splitlines():
        m = re.match(r"^\s{2,}([a-zA-Z_]+):", line)
        if not m:
            continue
        seen[m.group(1)] = seen.get(m.group(1), 0) + 1
    dupes = {k: v for k, v in seen.items() if v > 1}
    if dupes:
        head = block.splitlines()[0]
        print(f"{head}  -> {dupes}")
```

Fix (line-preserving dedupe — keeps formatting, comments, and field order intact):

```python
import re
from pathlib import Path

path = Path("scripts/venue-tags/venues.yaml")
text = path.read_text()
blocks = re.split(r"(?m)^(?=- key:)", text)

field_re = re.compile(r"^\s{2,}([a-zA-Z_]+):")
out_blocks = []
removed = 0

for block in blocks:
    if not block.strip():
        out_blocks.append(block)
        continue
    seen = set()
    kept_lines = []
    for line in block.splitlines(keepends=True):
        m = field_re.match(line)
        if m:
            field = m.group(1)
            if field in seen:
                removed += 1
                continue
            seen.add(field)
        kept_lines.append(line)
    out_blocks.append("".join(kept_lines))

path.write_text("".join(out_blocks))
print(f"Removed {removed} duplicate field lines")
```

Result: `Removed 33 duplicate field lines`. Endpoint returns 200; both PyYAML and js-yaml now agree on the file's shape.

## Prevention

### Generalized lesson

A data file is only as strict as the loosest parser that touches it. PyYAML's `safe_load` silently picks "last wins" for duplicate keys (YAML 1.1 era behavior), so 33 duplicate `cid:` lines accumulated in `scripts/venue-tags/venues.yaml` undetected until js-yaml — strict per YAML 1.2 — refused the same file. The free lesson: **adopting a stricter second parser is a one-shot linter**, but the durable win is wiring both parsers into CI so neither one can drift again. If only one consumer reads a multi-consumer format (YAML, JSON, TOML, INI), assume the file is *quietly invalid* until proven otherwise. Treat "parses without error" as the floor, not the ceiling, of correctness.

### Concrete checklist

- **One-time cross-parser audit:** run `js-yaml` (or `yaml@2`) against every YAML file currently loaded only by PyYAML — `npx js-yaml path/to/file.yaml > /dev/null` is enough to surface duplicate keys, anchor collisions, and tag mismatches.
- **Structural-validation test in CI:** add a test that fails the build on duplicate top-level or per-block keys (see pattern below). Don't rely on the loader; assert directly against the token stream or raw text.
- **Tighten Python loaders:** subclass `yaml.SafeLoader` with a `construct_mapping` override that raises on duplicate keys, or pin PyYAML ≥ 6.0 and elevate its `DuplicateKeyWarning` to an error in CI. Same idea applies to `json.loads(..., object_pairs_hook=...)` to catch duplicate JSON keys.
- **Generalize to other multi-impl formats:** JSON (`json` vs `simdjson` vs JS `JSON.parse`), TOML (`tomli` vs `@iarna/toml`), and INI parsers all disagree on duplicates and case. Run two implementations once per format you own.
- **Don't conflate "accepts" with "correct":** require either both consumers reject malformed input or both accept it deterministically. Asymmetric tolerance is the bug.
- **Cheap drift linter:** a 5-line script that counts unique field names per block vs total field lines per block flags duplicates instantly — wire it into pre-commit or the venue-tags scrape pipeline.
- **Fail loudly on writer side too:** the scraper that *produces* `venues.yaml` should round-trip its output through the strict parser before committing.

### What to do when this pattern recurs

1. **Identify both parsers** consuming the file. List them; note their spec version (YAML 1.1 vs 1.2, JSON RFC 8259 strictness, etc.).
2. **Run the strict one** against the suspect file in isolation — capture the exact line numbers it rejects.
3. **Dedupe with a small script** that preserves order and keeps the *first* (or last, but pick deliberately) occurrence; never hand-edit if there are >5 duplicates.
4. **Add the lock-down test below** in the same PR as the dedupe so the regression can't return.
5. **Audit sibling files** in the same directory or pipeline — duplicates rarely occur alone if a writer bug caused them.

### Reusable pytest lock-down

```python
# scripts/venue-tags/test_venues_yaml_no_duplicate_keys.py
from pathlib import Path
import yaml
import pytest

VENUES = Path(__file__).parent / "venues.yaml"


class StrictLoader(yaml.SafeLoader):
    pass


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
```

Pair with a JS-side equivalent (`js-yaml` parse step in the build) so both consumers enforce the invariant in CI.

## Related

- [`docs/solutions/build-errors/producer-consumer-parser-parity-and-silent-build-feedback-loops.md`](../build-errors/producer-consumer-parser-parity-and-silent-build-feedback-loops.md) — Direct precedent: PyYAML vs js-yaml disagreement let invalid data through a "validator" that used the wrong parser; same cross-parser strictness mismatch shape.
- [`docs/solutions/build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md`](../build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md) — Companion "what broke" doc on Python-writes / JS-reads YAML drift (timestamp autotagging, UTF-8 mojibake) — same producer/consumer asymmetry class.
- [`docs/solutions/test-failures/jaccard-signature-collision-false-positive-guard.md`](../test-failures/jaccard-signature-collision-false-positive-guard.md) — Sibling on stricter checks as accidental data-integrity tooling; also caught a real bug as a side-effect of adding a more rigorous consumer.
- Memory: `feedback_silent_fail_class.md` — The "succeed-as-no-op needs explicit count assertions" rule; duplicate-key tolerance is the same silent-fail class.
- Memory: `feedback_surgical_content_edits.md` — Explains why venues.yaml is hand/sed-edited (not yaml.dump round-tripped), which is exactly how 33 duplicate keys could accumulate without PyYAML complaining.
