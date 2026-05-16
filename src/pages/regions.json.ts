import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { slugify } from '../utils';

export const GET: APIRoute = async () => {
	const posts = (await getCollection('posts')).filter(p => !p.data.draft);

	const bySlug = new Map<string, { region: string; slug: string; count: number }>();
	for (const post of posts) {
		const region = post.data.region;
		if (!region) continue;
		const slug = slugify(region);
		if (!slug) continue;
		const existing = bySlug.get(slug);
		if (existing) {
			existing.count++;
		} else {
			bySlug.set(slug, { region, slug, count: 1 });
		}
	}

	const regions = [...bySlug.values()].sort((a, b) => b.count - a.count);

	return new Response(JSON.stringify({ regions, total: posts.length }), {
		headers: { 'Content-Type': 'application/json' },
	});
};
