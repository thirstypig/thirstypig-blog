import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
	const entries = await getCollection('wishlist');
	const posts = (await getCollection('posts')).filter(p => !p.data.draft);
	const postMap = new Map(posts.map(p => [p.id, p]));

	const items = entries.map(entry => {
		const resolvedPosts = (entry.data.thirstypig_posts || [])
			.map((slug: string) => {
				const post = postMap.get(slug);
				if (!post) return null;
				return {
					slug: post.id,
					title: post.data.title,
					url: `/posts/${post.id}/`,
				};
			})
			.filter(Boolean);

		return {
			id: entry.id,
			name: entry.data.name,
			neighborhood: entry.data.neighborhood || '',
			city: entry.data.city,
			visited: entry.data.visited,
			priority: entry.data.priority,
			dateAdded: entry.data.date_added,
			dateVisited: entry.data.date_visited,
			notes: entry.data.notes || '',
			links: Object.fromEntries(
				Object.entries(entry.data.links).filter(([, v]) => v != null)
			),
			posts: resolvedPosts,
			tags: entry.data.tags,
		};
	});

	const toVisit = items
		.filter(i => !i.visited)
		.sort((a, b) => a.priority - b.priority || b.dateAdded.localeCompare(a.dateAdded));

	const visited = items
		.filter(i => i.visited)
		.sort((a, b) => (b.dateVisited || '').localeCompare(a.dateVisited || ''));

	return new Response(JSON.stringify({
		toVisit,
		visited,
		lastUpdated: new Date().toISOString(),
	}), {
		headers: { 'Content-Type': 'application/json' },
	});
};
