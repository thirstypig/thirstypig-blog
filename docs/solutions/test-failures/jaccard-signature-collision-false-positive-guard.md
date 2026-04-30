---
title: Jaccard slug-pair heuristic cannot distinguish descriptive Wayback slugs from contaminated frontmatter
date: 2026-04-30
status: solved
tags:
  - heuristic
  - detection
  - jaccard
  - false-positive
  - admin-tools
  - testing
  - brand:thirstypig
problem_type: false-positives
component: data-quality-detection
related_files:
  - src/utils/data-quality.ts
  - src/utils/data-quality.test.ts
  - src/pages/data-quality.json.ts
  - tina/DataQuality.tsx
  - docs/operator/curator-bugs.md
pr: 97
---

# Jaccard signature collision in detection heuristic — caught by a false-positive-guard test

## Symptom

Building a Jaccard-similarity heuristic to detect contaminated post frontmatter, I had a "secondary" rule firing on what I thought was a narrow class of bugs (`Garvey-class`: title and location both stamped with the wrong venue). When I added a false-positive guard test for legitimate Wayback-era posts — descriptive prose slugs like `worlds-best-hainan-chicken-rice-savoy` paired with enriched venue titles like `Savoy Kitchen` — the heuristic flagged them too. The "bug catcher" was on track to dump hundreds of clean posts into the suspect queue. The catching test made one assertion ("Savoy is clean") and the heuristic disagreed.

## Investigation

I dumped the three pairwise Jaccard scores (slug↔title, slug↔location, title↔location) for the failing case alongside the real bug it was supposed to catch:

| Case | slug | title | location | jST | jSL | jTL |
|---|---|---|---|---|---|---|
| Garvey (real bug) | `the-open-door-monterey-park` | `Garvey Garage Door Repair, Monterey Park` | `Garvey Garage Door Repair` | 0.143 | 0.143 | 1.0 |
| Savoy (legitimate) | `worlds-best-hainan-chicken-rice-savoy` | `Savoy Kitchen, Alhambra` | `Savoy Kitchen` | 0.143 | 0.143 | 1.0 |

The numbers were identical, to three decimals. Walking through the math: in both cases the slug describes something other than the venue (a different venue's slug; or descriptive prose), the title strips to a venue name, and the location matches the title. Both pairs of slug-Jaccards land near 0.14 because exactly one short token (`monterey`, or `savoy`) overlaps between the slug and the venue tokens, and the union is around 7. The title-vs-location Jaccard is 1.0 because both fields agree perfectly.

This isn't a tuning problem — there's no threshold that admits Savoy and rejects Garvey using only `(slug, title, location)`. They're indistinguishable signals.

## Root cause

The secondary heuristic was relying on the wrong source of evidence. The "title and location both contaminated" pattern looks identical to "title and location both correct, slug is descriptive" because Wayback posts legitimately have descriptive slugs that don't mention the venue. The slug field carries no information that can disambiguate the two. Distinguishing them requires evidence outside the frontmatter — the post body. Garvey Garage Door Repair won't appear in the body of a restaurant post; Savoy Kitchen will. The heuristic was trying to extract a signal that doesn't exist in the inputs it was given.

## Solution

1. Drop the Garvey-class secondary flag entirely. The primary `title↔location < 0.35` check stays — it catches the Pine & Crane / Wolf & Crane Bar contamination class cleanly, including the CJK variant (`Rou Jia Mo` vs `A Niang Noodles 阿娘面`).
2. Invert the failing test to document the limitation: assert that Garvey is **not** flagged, and pin the exact ambiguous Jaccard numbers so any future heuristic change must explicitly verify it distinguishes Garvey from Savoy.
3. Leave a code comment naming the future fix (a body-content heuristic) so the next person who looks at this doesn't re-derive the same dead end.

## Code excerpts

The heuristic, post-fix, with the limitation called out in the docstring:

```ts
/**
 * Heuristic: title and location should agree on tokens (both are venue
 * identifiers). If their Jaccard is below SUSPECT_THRESHOLD, flag. This
 * catches the Pine & Crane / Wolf & Crane Bar contamination class (one
 * field stamped with the wrong venue's data).
 *
 * What we deliberately don't catch with the slug pair: the Garvey-class
 * "title and location both contaminated identically" pattern is
 * mathematically indistinguishable from the legitimate Wayback pattern
 * "descriptive prose slug + enriched venue title=location". Both produce
 * `slug↔title ≈ 0.14, slug↔location ≈ 0.14, title↔location = 1.0`. A
 * future heuristic that examines the post body (e.g., does the title
 * appear in the body at all?) could distinguish them — leaving as
 * follow-up.
 */
export function evaluateSuspectPost(slug, title, location) {
  // ...
  const jTL = jaccard(titleTokens, locationTokens);
  const flagged = jTL < SUSPECT_THRESHOLD;
  // ...
}
```

The inverted test pins the ambiguous numbers so the limitation is enforceable:

```ts
describe("evaluateSuspectPost — known limitation (Garvey-class)", () => {
  it("does NOT flag Garvey-class contamination — slug-pair Jaccards are ambiguous", () => {
    const result = evaluateSuspectPost(
      "the-open-door-monterey-park",
      "Garvey Garage Door Repair, Monterey Park",
      "Garvey Garage Door Repair",
    );
    expect(result!.flagged).toBe(false);
    // Document the ambiguous-signal numbers so a future change to the
    // heuristic can verify that any new approach DOES distinguish.
    expect(result!.jaccard.titleLocation).toBeGreaterThanOrEqual(SUSPECT_THRESHOLD);
    expect(result!.jaccard.slugTitle).toBeLessThan(0.2);
    expect(result!.jaccard.slugLocation).toBeLessThan(0.2);
  });
});
```

And the false-positive guard that surfaced the bug, kept as a permanent regression check:

```ts
describe("evaluateSuspectPost — Wayback false-positive guards", () => {
  it("does NOT flag a Wayback descriptive slug when title=location", () => {
    const result = evaluateSuspectPost(
      "worlds-best-hainan-chicken-rice-savoy",
      "Savoy Kitchen, Alhambra",
      "Savoy Kitchen",
    );
    expect(result!.flagged).toBe(false);
  });
});
```

The pair of tests — one asserting the real bug is *not* caught, one asserting the legitimate case is *not* flagged — encodes the indistinguishability as a constraint on future changes. Any next attempt has to flip the Garvey assertion without flipping the Savoy assertion, which forces the next author to reach for evidence outside the frontmatter.

## Prevention

### Generalized lesson

When designing a detection heuristic, the question is never "does this signal correlate with bugs?" — it is "does this signal **distinguish** bugs from legitimate-use patterns?" A heuristic that fires on real bugs is worthless if it fires identically on real legitimate content, because the operator now faces a coin flip on every alert and will eventually disable, ignore, or silently bypass the check. The Garvey/Savoy collision proved this concretely: two posts with the same `(jST, jSL, jTL)` slug-Jaccard signature, one a genuine title/venue mismatch bug and the other intentional descriptive prose, are mathematically indistinguishable to a triple of pairwise set similarities. The lesson: a heuristic must be validated against **paired** examples — at least one real bug and one real legitimate use drawn from the actual corpus — before it earns the right to flag anything. If the signatures collide, the heuristic is bankrupt and should be dropped, not tuned.

### Concrete prevention checklist

- **Mine paired examples from the live corpus before writing the heuristic.** For slug/title/location checks, grep at least 5 real bugs (e.g., known mismatches caught manually) and 5 real legitimate-use cases (e.g., descriptive slugs, list-style titles, "best X at Y" patterns) and lay their feature vectors side by side.
- **Compute the proposed signature on both sets and require visible separation.** If the bug-set range overlaps the legit-set range on any axis, that axis is dead — drop it or add a discriminating dimension (e.g., venue-DB cross-check, place_id presence, post-date proximity).
- **Prefer ground-truth lookups over surface similarity.** A `place_id` match against the venues index beats any Jaccard ratio; string-shape heuristics are a last resort, not a first reach.
- **Write the false-positive-guard test first.** Before the heuristic ships, encode the legitimate-use examples as `expect(flag).toBe(false)` cases. If you cannot make them pass without also un-flagging the bugs, the heuristic does not exist yet.
- **Document the math, not just the rule.** When you ship (or drop) a heuristic, record the feature vector and why it separates — or doesn't. Future-you reading "we dropped the slug-pair flag because jST≈jSL≈0.14 collided" saves a re-derivation.
- **Cap heuristic count per pipeline stage.** If you already have N flags and want to add one more, first audit whether any existing flag covers this case at lower false-positive cost.

### What to do when this exact pattern recurs

If someone proposes another slug-pair / title-pair / location-pair similarity check in the Cleanup heuristics, **first re-read the Garvey/Savoy case in this doc**, then run the new proposal through the paired-corpus test below using at least the Savoy-style descriptive-slug class as a known legitimate negative. Do not add the check until you can exhibit a real bug from the corpus that the new signature flags **and** that no existing heuristic already catches. If the new signature reduces to pairwise set similarity on tokens, assume collision until proven otherwise.

### Test pattern for future detection heuristics

```ts
import { describe, it, expect } from 'vitest';

interface HeuristicCase {
  name: string;
  input: PostRecord;       // shape used by the heuristic under test
  expectedFlag: boolean;   // true = real bug, false = legitimate use
}

/**
 * Every detection heuristic must ship with a paired-corpus test:
 * at least one real bug and one real legitimate-use case drawn
 * from the live content. If the heuristic returns the same value
 * for both, it is bankrupt — fail loudly here, not in production.
 */
export function assertHeuristicSeparates(
  heuristic: (p: PostRecord) => boolean,
  cases: HeuristicCase[],
) {
  const bugs = cases.filter(c => c.expectedFlag);
  const legit = cases.filter(c => !c.expectedFlag);
  expect(bugs.length, 'need >=1 real bug').toBeGreaterThan(0);
  expect(legit.length, 'need >=1 real legit case').toBeGreaterThan(0);

  for (const c of cases) {
    expect(heuristic(c.input), `case: ${c.name}`).toBe(c.expectedFlag);
  }
}

describe('slug/title mismatch heuristic vNext', () => {
  it('separates real bugs from legitimate descriptive slugs', () => {
    assertHeuristicSeparates(detectSlugTitleMismatch, [
      { name: 'real-bug-fixture-1',   input: loadFixture('bug-1'),   expectedFlag: true  },
      { name: 'descriptive-slug-1',   input: loadFixture('legit-1'), expectedFlag: false },
      { name: 'best-x-at-y-pattern',  input: loadFixture('legit-2'), expectedFlag: false },
    ]);
  });
});
```

## Related

- [`docs/solutions/feature-implementations/pre-staged-tests-awaiting-data-activation.md`](../feature-implementations/pre-staged-tests-awaiting-data-activation.md) — Canonical pattern for tests that catch bugs before the feature ships, directly mirroring the false-positive-guard test catching the heuristic bug pre-launch.
- [`docs/solutions/build-errors/producer-consumer-parser-parity-and-silent-build-feedback-loops.md`](../build-errors/producer-consumer-parser-parity-and-silent-build-feedback-loops.md) — Closing silent-failure feedback loops between admin writes and validation; same admin-tool detection-logic territory.
- [`docs/solutions/test-failures/e2e-coupled-to-ui-text-after-rename.md`](./e2e-coupled-to-ui-text-after-rename.md) — Drift-detection failure mode where assertions silently passed/failed against a moving target, related to false-positive class.
- Memory: `feedback_silent_fail_class.md` — Rule for surfacing succeed-as-no-op pipeline steps with explicit count assertions; same class as a heuristic that "succeeds" while flagging valid data.
- Memory: `feedback_pre_staged_tests.md` — Pattern of writing the guard test now so it activates on the next run and catches regressions before launch.
