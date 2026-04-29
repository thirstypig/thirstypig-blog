/**
 * Shared helper for loading published venue-tags JSON at build time.
 *
 * The same `read every JSON in public/venue-tags/` pattern was previously
 * hand-rolled in 4 callsites with subtle interface drift between them.
 * This consolidates the load + the type shape into one place. See todo
 * 017 in the code review.
 */
import fs from 'node:fs';
import path from 'node:path';

export interface Chip {
	label: string;
	mention_count: number;
}

export interface VenueRecord {
	place_id: string;
	venue_name: string;
	city?: string | null;
	key?: string | null;
	chips: Chip[];
	scraped_at?: string;
}

const VENUE_DIR = path.resolve('public/venue-tags');
let _cache: VenueRecord[] | null = null;

/**
 * Load every published venue's chip JSON. Memoized for the duration of
 * a build — multiple callsites share one disk pass and one parse pass.
 *
 * Returns [] if the directory doesn't exist (e.g. fresh checkout before
 * the scraper has run). Skips any file that fails to parse.
 */
export function loadAllVenues(): VenueRecord[] {
	if (_cache) return _cache;
	if (!fs.existsSync(VENUE_DIR)) {
		_cache = [];
		return _cache;
	}
	_cache = fs
		.readdirSync(VENUE_DIR)
		.filter((f) => f.endsWith('.json'))
		.map((f) => {
			try {
				return JSON.parse(fs.readFileSync(path.join(VENUE_DIR, f), 'utf-8')) as VenueRecord;
			} catch {
				return null;
			}
		})
		.filter((v): v is VenueRecord => v !== null);
	return _cache;
}

/**
 * Load chips for a single venue by place_id. Returns null if the file
 * is missing — used by VenueTags.astro on post pages where most posts
 * won't have a placeId.
 */
export function loadVenueByPlaceId(placeId: string): VenueRecord | null {
	const file = path.join(VENUE_DIR, `${placeId}.json`);
	if (!fs.existsSync(file)) return null;
	try {
		return JSON.parse(fs.readFileSync(file, 'utf-8')) as VenueRecord;
	} catch {
		return null;
	}
}
