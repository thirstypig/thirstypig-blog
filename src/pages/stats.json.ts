import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

function countBy<T>(items: T[], keyFn: (item: T) => string | undefined): { key: string; count: number }[] {
	const map = new Map<string, number>();
	for (const item of items) {
		const key = keyFn(item);
		if (key) map.set(key, (map.get(key) || 0) + 1);
	}
	return [...map.entries()]
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count);
}

function countFlat<T>(items: T[], keyFn: (item: T) => string[]): { key: string; count: number }[] {
	const map = new Map<string, number>();
	for (const item of items) {
		for (const key of keyFn(item)) {
			if (key) map.set(key, (map.get(key) || 0) + 1);
		}
	}
	return [...map.entries()]
		.map(([key, count]) => ({ key, count }))
		.sort((a, b) => b.count - a.count);
}

export const GET: APIRoute = async () => {
	const posts = (await getCollection('posts')).filter(p => !p.data.draft);

	// Posts by year (sorted ascending for timeline chart)
	const yearMap = new Map<number, number>();
	for (const p of posts) {
		const year = p.data.pubDate.getFullYear();
		yearMap.set(year, (yearMap.get(year) || 0) + 1);
	}
	const postsByYear = [...yearMap.entries()]
		.map(([year, count]) => ({ year, count }))
		.sort((a, b) => a.year - b.year);

	// Posts by source
	const postsBySource = countBy(posts, p => p.data.source || 'unknown');

	// Top cities
	const topCities = countBy(posts, p => p.data.city?.trim()).slice(0, 20);

	// Top categories
	const topCategories = countFlat(posts, p => p.data.categories || []).slice(0, 15);

	// Top tags (exclude 'closed')
	const topTags = countFlat(posts, p => (p.data.tags || []).filter(t => t.toLowerCase() !== 'closed')).slice(0, 15);

	// GPS stats
	const withCoords = posts.filter(p => p.data.coordinates).length;
	const withCity = posts.filter(p => p.data.city).length;

	// Image stats
	const withHero = posts.filter(p => p.data.heroImage).length;
	const withGallery = posts.filter(p => p.data.images && p.data.images.length > 0).length;
	const withAny = posts.filter(p => p.data.heroImage || (p.data.images && p.data.images.length > 0)).length;

	// Unique venues
	const venueSet = new Set(
		posts.map(p => p.data.location?.trim().toLowerCase()).filter(Boolean)
	);

	// Closed venues
	const closedVenues = posts.filter(p =>
		(p.data.tags || []).some(t => t.toLowerCase() === 'closed')
	).length;

	// Recent posts
	const recentPosts = [...posts]
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
		.slice(0, 10)
		.map(p => ({
			id: p.id,
			title: p.data.title,
			date: p.data.pubDate.toISOString().split('T')[0],
			city: p.data.city || '',
			source: p.data.source || '',
		}));

	const stats = {
		generatedAt: new Date().toISOString(),
		totalPosts: posts.length,
		postsByYear,
		postsBySource,
		topCities,
		topCategories,
		topTags,
		gpsStats: { withCoords, withCity, total: posts.length },
		imageStats: { withHero, withGallery, withAny, without: posts.length - withAny },
		uniqueVenues: venueSet.size,
		closedVenues,
		recentPosts,
	};

	return new Response(JSON.stringify(stats), {
		headers: { 'Content-Type': 'application/json' },
	});
};
