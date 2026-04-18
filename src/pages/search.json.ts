import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';
import { getImageInfo } from '../utils/image-dimensions.mjs';

export const GET: APIRoute = async () => {
	const posts = (await getCollection('posts'))
		.filter(p => !p.data.draft)
		.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

	const searchIndex = await Promise.all(posts.map(async post => {
		const hero = post.data.heroImage;
		const heroInfo = hero ? await getImageInfo(hero) : null;

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
		};
	}));

	return new Response(JSON.stringify(searchIndex), {
		headers: { 'Content-Type': 'application/json' },
	});
};
