import type { APIRoute } from "astro";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-expect-error — js-yaml has no bundled types; runtime API is stable
import yaml from "js-yaml";
import { getCollection } from "astro:content";
import {
	SUSPECT_THRESHOLD,
	evaluateSuspectPost,
	slugFromId,
} from "../utils/data-quality";

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
 * 2. **Suspect posts**: posts whose title and location frontmatter fields
 *    disagree on tokens — strong signal that one was contaminated by a
 *    different business during enrichment (the Pine & Crane / Wolf & Crane
 *    class). Detection logic lives in src/utils/data-quality.ts so it can
 *    be unit-tested without spinning up Astro's content layer.
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
		const slug = slugFromId(p.id);

		const evalResult = evaluateSuspectPost(slug, title, location);
		if (!evalResult || !evalResult.flagged) continue;

		suspects.push({
			id: p.id,
			slug,
			title,
			location,
			city,
			placeId,
			jaccard: evalResult.jaccard,
			worstPair: evalResult.worstPair,
			worstScore: evalResult.worstScore,
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
