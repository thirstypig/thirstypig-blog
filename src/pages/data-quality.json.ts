import type { APIRoute } from "astro";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error — js-yaml has no bundled types; runtime API is stable
import yaml from "js-yaml";
import { getCollection } from "astro:content";

/**
 * Data quality report served to the Cleanup admin dashboard.
 *
 * Surfaces two classes of issues:
 *
 * 1. **Duplicate venues**: entries in scripts/venue-tags/venues.yaml that
 *    share a place_id. publish.py collapses these to a single chip JSON,
 *    so they don't break rendering — but they bloat the curator pool and
 *    confuse sync_post_placeids.py which picks "first match wins". 14
 *    real groups today (e.g., bankara-ramen-bangkok + Thai-script alias).
 *
 * 2. **Suspect posts**: posts whose slug, title, and location field
 *    significantly disagree on tokens — strong signal that the location/
 *    placeId record was contaminated by a different business during
 *    enrichment (the Pine & Crane / Wolf & Crane class). We use Jaccard
 *    similarity on cleaned token sets across three pairwise comparisons
 *    (slug↔title, slug↔location, title↔location) and flag posts where
 *    any pair scores below SUSPECT_THRESHOLD.
 *
 * Both detections run at build time. Auto-derived "open" status: if the
 * issue still fires on next build, it's open; if not, it's been fixed.
 * No persistent dismissal state.
 */

const REPO_ROOT = join(process.cwd());
const VENUES_PATH = join(
	REPO_ROOT,
	"scripts/venue-tags/venues.yaml",
);

// Posts below this minimum pairwise Jaccard get flagged as suspect.
// Calibrated so Pine & Crane (0.17) and Garvey/Open Door (0.13) both fire.
// Tighter than 0.4 to keep false-positive volume manageable.
const SUSPECT_THRESHOLD = 0.35;

// Common stopwords that bloat token sets without signal. Keep small —
// content tokens like "lunch", "vegan", "burger" are real signal.
const STOPWORDS = new Set([
	"the", "a", "an", "and", "of", "in", "at", "on", "with", "to", "for",
	"by", "from", "is", "are", "was", "were", "be", "or", "but",
]);

interface VenueEntry {
	key: string;
	name?: string;
	city?: string;
	place_id?: string;
}

interface DuplicateVenueGroup {
	placeId: string;
	keys: string[];
	names: string[];
	city: string;
}

interface SuspectPost {
	id: string;          // TinaCMS edit id (filename relative to posts/)
	slug: string;        // filename slug (no date prefix, no .md)
	title: string;
	location: string;
	city: string;
	placeId: string;
	jaccard: {
		slugTitle: number;
		slugLocation: number;
		titleLocation: number;
	};
	worstPair: "slugTitle" | "slugLocation" | "titleLocation";
	worstScore: number;
}

function tokenize(s: string): Set<string> {
	const tokens = (s || "")
		.toLowerCase()
		// Strip non-alphanumeric (keeps CJK because \w in JS regex doesn't
		// — but [\p{L}\p{N}] does. Use Unicode property escapes.)
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter((t) => t.length >= 2 && !STOPWORDS.has(t));
	return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1;
	const intersection = [...a].filter((x) => b.has(x)).length;
	const union = new Set([...a, ...b]).size;
	return union === 0 ? 0 : intersection / union;
}

function stripCityFromTitle(title: string): string {
	// Title format is "{Venue Name}, {City}" — drop the trailing comma part
	// so we compare venue-name tokens only, not city tokens that bias
	// matches up.
	const idx = title.lastIndexOf(",");
	return idx > 0 ? title.slice(0, idx) : title;
}

function slugFromId(id: string): string {
	// Astro post ids look like "2009-12-17-the-open-door-monterey-park" or
	// similar. Strip leading date prefix YYYY-MM-DD- if present.
	const noExt = id.replace(/\.md$/, "");
	const m = noExt.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
	return m ? m[1] : noExt;
}

function detectDuplicateVenues(): DuplicateVenueGroup[] {
	const raw = readFileSync(VENUES_PATH, "utf8");
	const venues = (yaml.load(raw) as VenueEntry[]) || [];
	const byPid = new Map<string, VenueEntry[]>();
	for (const v of venues) {
		const pid = v.place_id;
		if (!pid || !pid.startsWith("0x")) continue;
		if (!byPid.has(pid)) byPid.set(pid, []);
		byPid.get(pid)!.push(v);
	}
	const groups: DuplicateVenueGroup[] = [];
	for (const [pid, entries] of byPid) {
		if (entries.length < 2) continue;
		groups.push({
			placeId: pid,
			keys: entries.map((e) => e.key),
			names: [...new Set(entries.map((e) => e.name || ""))],
			city: entries[0].city || "",
		});
	}
	// Sort: most aliases first, then alphabetical by first key
	groups.sort((a, b) =>
		b.keys.length - a.keys.length ||
		a.keys[0].localeCompare(b.keys[0]),
	);
	return groups;
}

async function detectSuspectPosts(): Promise<SuspectPost[]> {
	const posts = await getCollection("posts");
	const suspects: SuspectPost[] = [];
	for (const p of posts) {
		const data = p.data as Record<string, unknown>;
		const placeId = data.placeId as string | undefined;
		// Only check posts that have a placeId — the wrong-tag bug only
		// matters if a tag is being rendered.
		if (!placeId) continue;

		const title = String(data.title || "");
		const location = String(data.location || "");
		const city = String(data.city || "");
		// If location or title is empty, can't meaningfully compare —
		// surface separately if you want, but skip for now.
		if (!title || !location) continue;

		const slug = slugFromId(p.id);
		const slugTokens = tokenize(slug.replace(/-/g, " "));
		const titleTokens = tokenize(stripCityFromTitle(title));
		const locationTokens = tokenize(location);

		const jST = jaccard(slugTokens, titleTokens);
		const jSL = jaccard(slugTokens, locationTokens);
		const jTL = jaccard(titleTokens, locationTokens);

		// Primary flag: title and location should agree (both are venue
		// identifiers). Wayback-era slugs are often descriptive prose
		// ("World's Best Hainan Chicken Rice") so slug pairs are noisy
		// and shown for context only.
		// Secondary flag: Garvey-class — title and location agree but
		// both disagree strongly with slug. Requires BOTH slug Jaccards
		// to be very low.
		const titleLocationFlag = jTL < SUSPECT_THRESHOLD;
		const garveyClassFlag = jTL >= SUSPECT_THRESHOLD &&
			jST < 0.2 && jSL < 0.2;
		if (!titleLocationFlag && !garveyClassFlag) continue;

		const worstPair: SuspectPost["worstPair"] = titleLocationFlag
			? "titleLocation"
			: jST <= jSL ? "slugTitle" : "slugLocation";
		const worst = titleLocationFlag ? jTL : Math.min(jST, jSL);

		suspects.push({
			id: p.id,
			slug,
			title,
			location,
			city,
			placeId,
			jaccard: {
				slugTitle: Number(jST.toFixed(3)),
				slugLocation: Number(jSL.toFixed(3)),
				titleLocation: Number(jTL.toFixed(3)),
			},
			worstPair,
			worstScore: Number(worst.toFixed(3)),
		});
	}
	// Worst (lowest score) first so reviewer sees most-suspect at top.
	suspects.sort((a, b) => a.worstScore - b.worstScore);
	return suspects;
}

export const GET: APIRoute = async () => {
	const duplicateVenues = detectDuplicateVenues();
	const suspectPosts = await detectSuspectPosts();
	const body = {
		generatedAt: new Date().toISOString(),
		thresholds: {
			suspectJaccard: SUSPECT_THRESHOLD,
		},
		duplicateVenues,
		suspectPosts,
	};
	return new Response(JSON.stringify(body), {
		headers: {
			"Content-Type": "application/json",
			"X-Robots-Tag": "noindex",
		},
	});
};
