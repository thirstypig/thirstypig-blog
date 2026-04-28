import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import { getImageInfo } from '../utils/image-dimensions.mjs';

// Cache the per-placeId chip lookup so we don't re-read each JSON for every
// post that shares a venue.
const chipsByPlaceId = new Map<string, { label: string; mention_count: number }[]>();
const venueDir = path.join(process.cwd(), 'public', 'venue-tags');
if (fs.existsSync(venueDir)) {
	for (const f of fs.readdirSync(venueDir)) {
		if (!f.endsWith('.json')) continue;
		try {
			const data = JSON.parse(fs.readFileSync(path.join(venueDir, f), 'utf-8'));
			if (data.place_id && Array.isArray(data.chips)) {
				chipsByPlaceId.set(data.place_id, data.chips);
			}
		} catch {
			// Skip malformed; search degrades gracefully.
		}
	}
}

export const GET: APIRoute = async () => {
	const posts = (await getCollection('posts'))
		.filter(p => !p.data.draft)
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

	const searchIndex = await Promise.all(posts.map(async post => {
		const hero = post.data.heroImage;
		const heroInfo = hero ? await getImageInfo(hero) : null;
		const placeId = post.data.placeId;
		const chips = placeId ? chipsByPlaceId.get(placeId) || [] : [];

		return {
			id: post.id,
			title: post.data.title,
			description: post.data.description || '',
			date: post.data.pubDate.toISOString().split('T')[0],
			categories: post.data.categories || [],
			tags: post.data.tags || [],
			city: post.data.city || '',
			region: post.data.region || '',
			location: post.data.location || '',
			heroImage: hero || '',
			heroWebp: heroInfo?.webp || '',
			heroWidth: heroInfo?.width || 0,
			heroHeight: heroInfo?.height || 0,
			source: post.data.source || '',
			// Chip labels + mention counts. Lets the search page rank chip
			// matches by mention_count so e.g. searching "brisket" surfaces
			// Franklin BBQ (2,142 mentions) above any post that just says
			// "brisket" once in its body.
			chips: chips.map(c => ({ label: c.label, n: c.mention_count })),
		};
	}));

	return new Response(JSON.stringify(searchIndex), {
		headers: { 'Content-Type': 'application/json' },
	});
};
