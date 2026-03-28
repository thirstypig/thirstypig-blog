import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
	const posts = (await getCollection('posts'))
		.filter(p => !p.data.draft)
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

	const searchIndex = posts.map(post => ({
		id: post.id,
		title: post.data.title,
		description: post.data.description || '',
		date: post.data.pubDate.toISOString().split('T')[0],
		categories: post.data.categories || [],
		tags: post.data.tags || [],
		city: post.data.city || '',
		region: post.data.region || '',
		location: post.data.location || '',
		heroImage: post.data.heroImage || '',
		source: post.data.source || '',
	}));

	return new Response(JSON.stringify(searchIndex), {
		headers: { 'Content-Type': 'application/json' },
	});
};
