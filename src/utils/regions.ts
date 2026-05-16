/**
 * Aggregate posts by their `region` frontmatter field for the homepage city
 * picker. Returns the top N regions by post count plus a count of "everywhere
 * else" — posts that don't make the top N OR don't have a region at all.
 *
 * The total of all returned counts always equals `posts.length`, so the
 * "everywhere else" tile is honest about the long tail.
 */

interface PostWithRegion {
	data: { region?: string };
}

export interface RegionAggregation {
	top: Array<{ region: string; count: number }>;
	elsewhereCount: number;
}

export function aggregateRegions<T extends PostWithRegion>(
	posts: readonly T[],
	topN: number,
): RegionAggregation {
	const counts = new Map<string, number>();
	for (const post of posts) {
		const region = post.data.region;
		if (region) counts.set(region, (counts.get(region) || 0) + 1);
	}
	const top = [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
		.slice(0, topN)
		.map(([region, count]) => ({ region, count }));
	const topTotal = top.reduce((sum, { count }) => sum + count, 0);
	return { top, elsewhereCount: posts.length - topTotal };
}
