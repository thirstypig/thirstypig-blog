import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
	const posts = (await getCollection('posts')).filter(p => !p.data.draft);

	// We need to read GPS from Instagram export data, but for now
	// use city-based coordinates as fallback
	const cityCoords: Record<string, [number, number]> = {
		'Los Angeles': [34.0522, -118.2437],
		'Pasadena': [34.1478, -118.1445],
		'Alhambra': [34.0953, -118.127],
		'Arcadia': [34.1397, -118.0353],
		'Monterey Park': [34.0625, -118.1228],
		'San Gabriel': [34.0961, -118.1058],
		'Rosemead': [34.0806, -118.0728],
		'Rowland Heights': [33.9761, -117.9053],
		'Temple City': [34.1072, -118.0578],
		'Beverly Hills': [34.0736, -118.4004],
		'Santa Monica': [34.0195, -118.4912],
		'Hollywood': [34.0928, -118.3287],
		'West Hollywood': [34.0900, -118.3617],
		'Culver City': [34.0211, -118.3965],
		'Venice': [33.985, -118.4695],
		'Koreatown': [34.0578, -118.3006],
		'Downtown LA': [34.0407, -118.2468],
		'Dtla': [34.0407, -118.2468],
		'Chinatown': [34.0622, -118.2386],
		'Little Tokyo': [34.0497, -118.2396],
		'Silver Lake': [34.0869, -118.2702],
		'Echo Park': [34.0781, -118.2606],
		'Long Beach': [33.77, -118.1937],
		'Torrance': [33.8358, -118.3406],
		'Gardena': [33.8883, -118.3089],
		'Burbank': [34.1808, -118.3090],
		'Glendale': [34.1425, -118.255],
		'Irvine': [33.6846, -117.8265],
		'Laguna Beach': [33.5427, -117.7834],
		'San Francisco': [37.7749, -122.4194],
		'San Jose': [37.3382, -121.8863],
		'San Diego': [32.7157, -117.1611],
		'Las Vegas': [36.1699, -115.1398],
		'Shanghai': [31.2304, 121.4737],
		'Taipei': [25.033, 121.5654],
		'Tokyo': [35.6762, 139.6503],
		'Seoul': [37.5665, 126.978],
		'Hong Kong': [22.3193, 114.1694],
		'Bangkok': [13.7563, 100.5018],
		'Singapore': [1.3521, 103.8198],
		'New York': [40.7128, -74.006],
		'Honolulu': [21.3069, -157.8583],
		'Westwood': [34.0589, -118.4452],
		'Brentwood': [34.0594, -118.4728],
		'Mpk': [34.0625, -118.1228],
		'Sgv': [34.0961, -118.1058],
	};

	const markers = posts
		.filter(p => p.data.city || p.data.region)
		.map(post => {
			const city = post.data.city || '';
			const coords = cityCoords[city] || cityCoords[post.data.region || ''];
			if (!coords) return null;

			// Add small random offset so markers don't stack exactly
			const jitter = () => (Math.random() - 0.5) * 0.008;

			return {
				id: post.id,
				title: post.data.title,
				city: city,
				region: post.data.region || '',
				lat: coords[0] + jitter(),
				lng: coords[1] + jitter(),
				heroImage: post.data.heroImage || '',
				date: post.data.pubDate.toISOString().split('T')[0],
				closed: (post.data.tags || []).some(t => t.toLowerCase() === 'closed'),
			};
		})
		.filter(Boolean);

	return new Response(JSON.stringify(markers), {
		headers: { 'Content-Type': 'application/json' },
	});
};
