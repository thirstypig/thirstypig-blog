// Pure helpers for the build-time data-quality detection (consumed by
// src/pages/data-quality.json.ts). Extracted into its own module so the
// detection heuristics can be unit-tested without spinning up Astro's
// content-layer or filesystem stack.

// Posts below this minimum pairwise Jaccard get flagged as suspect.
// Calibrated so Pine & Crane (0.0) and Garvey/Open Door (~0.13) both fire.
// Tighter than 0.4 to keep false-positive volume manageable.
export const SUSPECT_THRESHOLD = 0.35;

// Common stopwords that bloat token sets without signal. Keep small —
// content tokens like "lunch", "vegan", "burger" are real signal.
export const STOPWORDS = new Set([
	"the", "a", "an", "and", "of", "in", "at", "on", "with", "to", "for",
	"by", "from", "is", "are", "was", "were", "be", "or", "but",
]);

export type SuspectWorstPair =
	| "slugTitle"
	| "slugLocation"
	| "titleLocation";

export interface SuspectEvaluation {
	jaccard: {
		slugTitle: number;
		slugLocation: number;
		titleLocation: number;
	};
	worstPair: SuspectWorstPair;
	worstScore: number;
	flagged: boolean;
}

export function tokenize(s: string): Set<string> {
	const tokens = (s || "")
		.toLowerCase()
		// Strip non-alphanumerics. Use Unicode property escapes so CJK and
		// other non-ASCII letters survive (\w in JS is ASCII-only).
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
	return new Set(tokens);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1;
	const intersection = [...a].filter((x) => b.has(x)).length;
	const union = new Set([...a, ...b]).size;
	return union === 0 ? 0 : intersection / union;
}

// Title format is "{Venue Name}, {City}" — drop the trailing comma part
// so we compare venue-name tokens only, not city tokens that bias matches up.
export function stripCityFromTitle(title: string): string {
	const idx = title.lastIndexOf(",");
	return idx > 0 ? title.slice(0, idx) : title;
}

// Astro post ids look like "2009-12-17-the-open-door-monterey-park" or
// similar. Strip leading date prefix YYYY-MM-DD- if present.
export function slugFromId(id: string): string {
	const noExt = id.replace(/\.md$/, "");
	const m = noExt.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
	return m ? m[1] : noExt;
}

/**
 * Evaluate whether a post should be flagged as suspect.
 *
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
 * follow-up. Slug Jaccards are still computed and exposed for reviewer
 * context.
 */
export function evaluateSuspectPost(
	slug: string,
	title: string,
	location: string,
): SuspectEvaluation | null {
	if (!title || !location) return null;

	const slugTokens = tokenize(slug.replace(/-/g, " "));
	const titleTokens = tokenize(stripCityFromTitle(title));
	const locationTokens = tokenize(location);

	const jST = jaccard(slugTokens, titleTokens);
	const jSL = jaccard(slugTokens, locationTokens);
	const jTL = jaccard(titleTokens, locationTokens);

	const flagged = jTL < SUSPECT_THRESHOLD;

	return {
		jaccard: {
			slugTitle: Number(jST.toFixed(3)),
			slugLocation: Number(jSL.toFixed(3)),
			titleLocation: Number(jTL.toFixed(3)),
		},
		worstPair: "titleLocation",
		worstScore: Number(jTL.toFixed(3)),
		flagged,
	};
}
