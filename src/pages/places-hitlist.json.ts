import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
	const entries = await getCollection('hitlist');

	const items = entries
		.map(entry => ({
			id: entry.id,
			name: entry.data.name,
			neighborhood: entry.data.neighborhood || '',
			city: entry.data.city,
			priority: entry.data.priority,
			dateAdded: entry.data.date_added,
			notes: entry.data.notes || '',
			links: Object.fromEntries(
				Object.entries(entry.data.links).filter(([, v]) => v != null)
			),
			tags: entry.data.tags,
		}))
		.sort((a, b) => a.priority - b.priority || b.dateAdded.localeCompare(a.dateAdded));

	return new Response(JSON.stringify({
		items,
		lastUpdated: new Date().toISOString(),
	}), {
		headers: { 'Content-Type': 'application/json' },
	});
};
