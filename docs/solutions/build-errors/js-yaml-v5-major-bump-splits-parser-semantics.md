---
id: DOC-022
type: solution
status: done
phase: null
owner: james
tags: [build-deploy, content-pipeline, hitlist]
links: [ADR-001, DOC-010]
updated: "2026-07-24"

category: build-errors
severity: p1
symptoms:
  - '`npm install js-yaml` silently resolved 5.2.1 — a major bump from the 4.x Astro ships'
  - Bare YAML dates began parsing as strings instead of Date objects
  - No test, hook, or CI job failed — every gate stayed green
  - '`validate_hitlist.mjs` would have silently stopped being a guard'
components:
  - package.json
  - scripts/validate_hitlist.mjs
  - src/pages/data-quality.json.ts
  - src/pages/docs-admin.json.ts
  - src/content.config.ts
related:
  - docs/solutions/build-errors/producer-consumer-parser-parity-and-silent-build-feedback-loops.md
  - docs/solutions/build-errors/yaml-round-trip-timestamp-and-utf8-corruption.md
  - docs/solutions/data-issues/pyyaml-tolerates-duplicate-keys-jsyaml-strict-catch.md
  - docs/solutions/data-issues/yaml-duplicate-keys-from-regex-injection.md
---

# js-yaml v5 major bump splits parser semantics inside one node_modules

**Caught before commit, 2026-07-24.** Nothing broke in production. This documents a
near-miss because the failure mode was *invisible* — no red build, no failing test — and
the same three keystrokes will reproduce it.

## Symptom

Adding `js-yaml` as an explicit devDependency (it was already present transitively via
Astro) looked routine:

```bash
npm install --save-dev js-yaml @types/js-yaml
```

npm resolved **`js-yaml@5.2.1`**. The only visible signal was one unrelated typecheck
error (`Unused '@ts-expect-error' directive` in `data-quality.json.ts`, because the new
`@types/js-yaml` made an old suppression redundant). Nothing announced that the YAML
parser's semantics had changed.

## Why it mattered

`CLAUDE.md` names js-yaml as **the authoritative YAML consumer, YAML 1.1, strict
duplicate-key rejection**. ADR-001 encodes the same thing as invariant **I2**. js-yaml v5
moves to YAML 1.2, where a bare `2026-07-23` is a **string**, not a `!!timestamp`.

Verified empirically in-session against both versions actually installed here — not read
from a changelog:

```
# js-yaml 5.2.1
bare date -> string   (YAML 1.2)

# js-yaml 4.3.0
updated: 2026-07-23   -> Date  2026-07-23T00:00:00.000Z   (YAML 1.1)  ✓ matches invariant
a: 1\na: 2            -> throws (duplicate key)                       ✓
!!js/function "…"     -> throws (unknown tag)                          ✓
```

> **Confidence note.** The v4 behaviours above are HIGH confidence — directly executed.
> The claim "v5 switched to YAML 1.2" is inferred from that observed behaviour change, not
> from reading js-yaml's changelog. Both 4.3.0 and 5.2.1 postdate the assistant's training
> data. If you need the authoritative reason, check the upstream CHANGELOG.

## Root cause — the split-brain, not the string

The obvious framing ("dates parse differently") is the *smaller* half. The real hazard is
**npm deduping**.

Today `^4.3.0` at the root means exactly **one** physical copy of js-yaml, shared by:

| Consumer | Declared range |
|---|---|
| `<root>` (our 3 call sites) | `^4.3.0` |
| `astro` | `^4.1.1` |
| `@astrojs/markdown-remark` | `^4.1.1` |
| `@tinacms/cli` | `^4.1.0` |
| `cosmiconfig` | `^4.1.0` |

Pin the root to 5.x and npm **cannot** dedupe. It nests a separate `js-yaml@4.x` under
`astro/` to satisfy `^4.1.1`, while our own code resolves the root 5.2.1. The result,
inside a single `npm run build`:

- `scripts/validate_hitlist.mjs` → YAML **1.2**
- Astro's `file()` content loader → YAML **1.1**

That is a textbook recurrence of
`producer-consumer-parser-parity-and-silent-build-feedback-loops.md` — except the previous
instance was PyYAML-vs-js-yaml across a *language* boundary. This one is
**js-yaml-vs-js-yaml inside one `node_modules`.**

### The guard inverts into the bug it exists to catch

`scripts/validate_hitlist.mjs` says so in its own header:

> Uses js-yaml because Astro's file() loader uses js-yaml (YAML 1.1 semantics). … If this
> validator used the `yaml` package, it would pass files that then fail Astro's schema —
> exactly the bug class it's meant to catch.

Its live assertion is `typeof e[field] !== "string"` over
`["id","name","city","date_added"]`. Under v5 that check can **never fire**: a bare
`date_added` parses to a string, the validator green-lights it, and Astro — still on 4.x —
parses it to a `Date` and fails `date_added: z.string()` in `src/content.config.ts`.

The validator doesn't break. It becomes decorative.

## Why every gate stayed green

| Gate | Would it have caught v5? |
|---|---|
| `npm run typecheck` | ❌ types are identical across the bump |
| Vitest (172 tests) | ❌ **zero tests import js-yaml** |
| pytest (178 tests) | ❌ `test_venues_yaml_no_duplicate_keys.py` is PyYAML-side and date-agnostic |
| `.githooks/pre-commit` | ❌ runs validate:hitlist + unit + py — all pass |
| `.github/workflows/test.yml` | ❌ no parity step; the e2e job runs bare `npx astro build`, not `npm run build` |
| Vercel build | ❌ **today.** All 11 `date_added` values are already quoted, so the guard is inert either way |

**First symptom would have arrived weeks later** as a Vercel build failure on a hitlist
entry the validator had approved — with the actual cause a `package.json` line changed in
an unrelated session.

## Blast radius (measured, not estimated)

| Data | Count | Date exposure |
|---|---|---|
| `src/content/posts/*.md` | 2,127 files, 100% with frontmatter | **95 bare `pubDate`** — 76 ISO-Z, 19 space-separated (`2025-08-05 00:00:00+00:00`, a YAML 1.1 `!!timestamp` that is *not* valid ISO-8601) |
| `scripts/venue-tags/venues.yaml` | 814 entries | none — no date keys at all |
| `src/data/places-hitlist.yaml` | 11 entries | 11 `date_added`, **all quoted** |
| `docs/**/*.md` | 61 files | **20 bare `date:`** values (legacy solution docs) |

Only three files import js-yaml directly: `scripts/validate_hitlist.mjs:20`,
`src/pages/data-quality.json.ts:72`, `src/pages/docs-admin.json.ts:101`. Small surface —
which is exactly why it was easy to miss that one of them is load-bearing.

Also worth knowing: two *other* js-yaml copies already exist at **3.14.2**, nested under
`gray-matter` and `@tinacms/graphql`. The repo has been running multiple YAML parsers for
a while; the v5 bump would have been the first time they *disagreed on semantics*.

## The fix

```bash
npm install --save-dev js-yaml@^4.1.1     # resolves 4.3.0 — stays on 4.x
```

Then verify, don't assume:

```bash
node -e '
const y=require("js-yaml");
console.log("version:", require("js-yaml/package.json").version);
console.log("bare date ->", y.load("d: 2026-07-23").d instanceof Date ? "Date (1.1) OK" : "string (1.2) WRONG");
try{ y.load("a: 1\na: 2"); console.log("dup keys ACCEPTED — WRONG"); }
catch{ console.log("dup keys rejected OK"); }
try{ y.load("!!js/function \"function(){}\""); console.log("unsafe tag ACCEPTED — WRONG"); }
catch{ console.log("unsafe tag rejected OK"); }
'
```

Also removed the now-redundant `// @ts-expect-error` above the js-yaml import in
`src/pages/data-quality.json.ts` — with `@types/js-yaml` installed, the suppression itself
became a typecheck error.

**The caret matters.** `^4.3.0` permits 4.x only, so a future `npm install` cannot walk to
5.x on its own. Do not "modernise" this to `^5` without re-reading this doc.

## Prevention

1. **Treat adopting a transitive dep as a version decision, not paperwork.** `npm install X`
   where X already exists transitively will happily resolve a *different major*. Pin
   deliberately: `npm install X@^<the version already on disk>`.
2. **Add a parser-parity test.** The real gap: nothing asserts js-yaml's behaviour. A
   handful of assertions in a `.test.ts` would have failed loudly on the bump —
   `bare date → Date`, `duplicate keys → throw`, `!!js/function → throw`. This is
   ugly-case **U3** in DOC-010, currently marked ⚠️ *partial / untested*. Closing it is
   cheap and high-value.
3. **Suspect any single-copy dedupe you depend on.** If your code and a framework must
   agree on a parser, they must resolve the *same physical module*. Check with
   `npm ls js-yaml` — more than one version listed means more than one semantics.
4. **Quote dates on write.** Already the rule (ADR-001 I2, DOC-001 §1), and it's why the
   hitlist survived unscathed — all 11 `date_added` values were quoted. The 95 bare
   `pubDate` values in posts are the remaining soft spot.
5. **Beware guards that are currently inert.** `validate_hitlist.mjs` passes today because
   the data is already clean. A guard with nothing to catch gives no signal when it stops
   working. Consider a fixture that deliberately trips it.

## Related

- `producer-consumer-parser-parity-and-silent-build-feedback-loops.md` — the parent
  pattern; use the parser the *consumer* uses. This incident is that rule recurring
  intra-language.
- `yaml-round-trip-timestamp-and-utf8-corruption.md` — the concrete build break YAML 1.1
  date coercion causes (`date_added` → `Date` → Astro `z.string()` failure).
- `pyyaml-tolerates-duplicate-keys-jsyaml-strict-catch.md` — the strictness half of the
  invariant a major bump would put at risk.
- ADR-001 invariant **I2**; DOC-010 ugly-case **U2/U3**.
