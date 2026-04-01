import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
	const posts = await getCollection('posts');

	// Collect unique values for filter dropdowns
	const categorySet = new Set<string>();
	const citySet = new Set<string>();

	const rows = posts
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
		.map(p => {
			for (const c of p.data.categories || []) categorySet.add(c);
			if (p.data.city) citySet.add(p.data.city);

			const hasHero = !!p.data.heroImage;
			const hasGallery = (p.data.images?.length || 0) > 0;

			return {
				id: p.id,
				title: p.data.title,
				date: p.data.pubDate.toISOString().split('T')[0],
				categories: p.data.categories || [],
				location: p.data.location || '',
				city: p.data.city || '',
				hasCoords: !!p.data.coordinates,
				draft: p.data.draft || false,
				hasHero,
				hasGallery,
				hasImages: hasHero || hasGallery,
				source: p.data.source || '',
			};
		});

	const categories = [...categorySet].sort();
	const cities = [...citySet].sort();

	return new Response(JSON.stringify({ posts: rows, categories, cities }), {
		headers: { 'Content-Type': 'application/json' },
	});
};
