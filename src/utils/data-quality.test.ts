import { describe, it, expect } from "vitest";
import {
	tokenize,
	jaccard,
	stripCityFromTitle,
	slugFromId,
	evaluateSuspectPost,
	SUSPECT_THRESHOLD,
} from "./data-quality";

// Each test below encodes a real regression — the underlying detection
// either caught a contamination bug, or correctly let a true-positive
// through. Don't relax the heuristic without re-evaluating these.

describe("tokenize", () => {
	it("lowercases, splits, drops punctuation", () => {
		expect(tokenize("Pine & Crane")).toEqual(new Set(["pine", "crane"]));
	});

	it("preserves CJK characters via Unicode property escapes", () => {
		// JS \w is ASCII-only; a naive [^a-z0-9] strip would drop these.
		// We use \p{L} so 阿娘 survives as a token and joins via space.
		const tokens = tokenize("A Niang Noodles (阿娘面)");
		expect(tokens.has("niang")).toBe(true);
		expect(tokens.has("noodles")).toBe(true);
		expect(tokens.has("阿娘面")).toBe(true);
	});

	it("drops apostrophes so possessives normalize correctly", () => {
		// "Park's BBQ" → tokens park, bbq. The apostrophe is the same
		// gotcha that tripped scripts/venue-tags/curate_candidates.py
		// — \b treats ' as a word boundary in Python regex.
		const tokens = tokenize("Park's BBQ");
		expect(tokens).toEqual(new Set(["park", "bbq"]));
	});

	it("drops short tokens (< 2 chars) and stopwords", () => {
		const tokens = tokenize("a b ab the and BBQ");
		expect(tokens).toEqual(new Set(["ab", "bbq"]));
	});

	it("returns empty set for empty / whitespace input", () => {
		expect(tokenize("").size).toBe(0);
		expect(tokenize("   ").size).toBe(0);
	});
});

describe("jaccard", () => {
	it("returns 1 when both sets are empty (degenerate-but-stable case)", () => {
		expect(jaccard(new Set(), new Set())).toBe(1);
	});

	it("returns 0 when sets are disjoint", () => {
		expect(jaccard(new Set(["a", "b"]), new Set(["c", "d"]))).toBe(0);
	});

	it("returns 1 when sets are identical", () => {
		expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
	});

	it("computes |intersect| / |union| for partial overlap", () => {
		// {a,b,c} vs {b,c,d} → intersect={b,c}=2, union={a,b,c,d}=4
		expect(
			jaccard(new Set(["a", "b", "c"]), new Set(["b", "c", "d"])),
		).toBeCloseTo(0.5, 5);
	});
});

describe("stripCityFromTitle", () => {
	it("drops the trailing comma-City part of an enriched title", () => {
		// Why: the title format is "{Venue}, {City}" so the city tokens
		// would otherwise inflate every Jaccard score with the location's
		// city tokens, masking real disagreements.
		expect(stripCityFromTitle("Pine & Crane, Downtown LA")).toBe(
			"Pine & Crane",
		);
	});

	it("returns the title unchanged when there's no comma", () => {
		expect(stripCityFromTitle("Just A Venue Name")).toBe(
			"Just A Venue Name",
		);
	});

	it("handles multiple commas — only strips the last segment", () => {
		// e.g., "Smith's, Cellar, Beverly Hills" → "Smith's, Cellar"
		expect(stripCityFromTitle("Smith's, Cellar, Beverly Hills")).toBe(
			"Smith's, Cellar",
		);
	});
});

describe("slugFromId", () => {
	it("strips the YYYY-MM-DD- date prefix", () => {
		expect(slugFromId("2009-12-17-the-open-door-monterey-park")).toBe(
			"the-open-door-monterey-park",
		);
	});

	it("strips a trailing .md if present", () => {
		expect(slugFromId("2024-04-14-had-a-burger-today.md")).toBe(
			"had-a-burger-today",
		);
	});

	it("returns the input unchanged when there's no date prefix", () => {
		expect(slugFromId("orphaned-no-date-slug")).toBe(
			"orphaned-no-date-slug",
		);
	});
});

describe("evaluateSuspectPost — primary (title vs location)", () => {
	it("flags Pine & Crane / Wolf & Crane Bar contamination", () => {
		// Real contamination caught on this branch: post is about Pine &
		// Crane (per title and slug) but its location field said "Wolf &
		// Crane Bar" — a different venue. Tagging would render Wolf &
		// Crane's chip pills on a Pine & Crane post.
		const result = evaluateSuspectPost(
			"pine-crane-vegan-lunch",
			"Pine & Crane, Downtown LA",
			"Wolf & Crane Bar",
		);
		expect(result).not.toBeNull();
		expect(result!.flagged).toBe(true);
		expect(result!.worstPair).toBe("titleLocation");
		expect(result!.worstScore).toBeLessThan(SUSPECT_THRESHOLD);
	});

	it("flags Rou Jia Mo / A Niang Noodles disagreement (CJK)", () => {
		// CJK regression — the tokenizer must preserve 阿娘面 and 肉夾饃
		// as tokens for the heuristic to detect this contamination.
		const result = evaluateSuspectPost(
			"had-a-burger-today",
			"Rou Jia Mo 肉夾饃, Shanghai",
			"A Niang Noodles (阿娘面)",
		);
		expect(result).not.toBeNull();
		expect(result!.flagged).toBe(true);
		expect(result!.worstPair).toBe("titleLocation");
	});

	it("does NOT flag a clean-aligned post (same venue in title and location)", () => {
		// Spago Beverly Hills: title says Spago, location says Spago. No
		// contamination — must pass through.
		const result = evaluateSuspectPost(
			"2024-08-17-spago-beverly-hills",
			"Spago Beverly Hills, Beverly Hills",
			"Spago Beverly Hills",
		);
		expect(result!.flagged).toBe(false);
	});
});

describe("evaluateSuspectPost — known limitation (Garvey-class)", () => {
	it("does NOT flag Garvey-class contamination — slug-pair Jaccards are ambiguous", () => {
		// Garvey-class: title and location both contaminated to the same
		// wrong value. Mathematically indistinguishable from a legitimate
		// Wayback post with descriptive slug + correct title=location:
		// both produce slug↔title ≈ 0.14, title↔location = 1.0. We
		// deliberately don't flag this with the slug-pair heuristic alone
		// to avoid mass-false-positives on Wayback posts. A future
		// body-content heuristic could distinguish them.
		const result = evaluateSuspectPost(
			"the-open-door-monterey-park",
			"Garvey Garage Door Repair, Monterey Park",
			"Garvey Garage Door Repair",
		);
		expect(result!.flagged).toBe(false);
		// Document the ambiguous-signal numbers so a future change to the
		// heuristic can verify that any new approach DOES distinguish.
		expect(result!.jaccard.titleLocation).toBeGreaterThanOrEqual(
			SUSPECT_THRESHOLD,
		);
		expect(result!.jaccard.slugTitle).toBeLessThan(0.2);
		expect(result!.jaccard.slugLocation).toBeLessThan(0.2);
	});
});

describe("evaluateSuspectPost — Wayback false-positive guards", () => {
	it("does NOT flag a Wayback descriptive slug when title=location", () => {
		// User's Wayback-era posts often have descriptive prose slugs
		// ("World's Best Hainan Chicken Rice") that legitimately disagree
		// with the enriched venue title (Savoy Kitchen). The slug check
		// must NOT fire on this normal pattern — only when title AND
		// location both also disagree.
		const result = evaluateSuspectPost(
			"worlds-best-hainan-chicken-rice-savoy",
			"Savoy Kitchen, Alhambra",
			"Savoy Kitchen",
		);
		expect(result!.flagged).toBe(false);
	});

	it("does NOT flag a Wayback descriptive slug when title and location agree on a single venue", () => {
		// Same class — descriptive slug should be a-priori OK as long as
		// title and location are coherent.
		const result = evaluateSuspectPost(
			"home-of-the-pug-burger-the-hungry-cat",
			"The Hungry Cat, Beverly Hills",
			"The Hungry Cat",
		);
		expect(result!.flagged).toBe(false);
	});
});

describe("evaluateSuspectPost — input edge cases", () => {
	it("returns null when title is empty", () => {
		expect(evaluateSuspectPost("some-slug", "", "Some Location")).toBeNull();
	});

	it("returns null when location is empty", () => {
		expect(evaluateSuspectPost("some-slug", "Some Title", "")).toBeNull();
	});
});
