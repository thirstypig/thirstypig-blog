import { getCollection } from 'astro:content';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
	const posts = (await getCollection('posts')).filter(p => !p.data.draft);

	// We need to read GPS from Instagram export data, but for now
	// use city-based coordinates as fallback
	const cityCoords: Record<string, [number, number]> = {
		// LA proper
		'Los Angeles': [34.0522, -118.2437],
		'Downtown LA': [34.0407, -118.2468],
		'Downtown Los Angeles': [34.0407, -118.2468],
		'Dtla': [34.0407, -118.2468],
		'Hollywood': [34.0928, -118.3287],
		'West Hollywood': [34.0900, -118.3617],
		'Koreatown': [34.0578, -118.3006],
		'Chinatown': [34.0622, -118.2386],
		'Little Tokyo': [34.0497, -118.2396],
		'Silver Lake': [34.0869, -118.2702],
		'Echo Park': [34.0781, -118.2606],
		'Los Feliz': [34.1064, -118.2838],
		'Beverly Hills': [34.0736, -118.4004],
		'Santa Monica': [34.0195, -118.4912],
		'Culver City': [34.0211, -118.3965],
		'Venice': [33.985, -118.4695],
		'Westwood': [34.0589, -118.4452],
		'Brentwood': [34.0594, -118.4728],
		'Malibu': [34.0259, -118.7798],
		'Arts District': [34.0395, -118.2330],
		'Highland Park': [34.1114, -118.1920],
		'Eagle Rock': [34.1392, -118.2106],
		'East LA': [34.0239, -118.1720],
		// San Gabriel Valley
		'Pasadena': [34.1478, -118.1445],
		'Alhambra': [34.0953, -118.127],
		'Arcadia': [34.1397, -118.0353],
		'Monterey Park': [34.0625, -118.1228],
		'San Gabriel': [34.0961, -118.1058],
		'Rosemead': [34.0806, -118.0728],
		'Rowland Heights': [33.9761, -117.9053],
		'Temple City': [34.1072, -118.0578],
		'San Marino': [34.1215, -118.1064],
		'Monrovia': [34.1442, -117.9990],
		'Sierra Madre': [34.1617, -118.0528],
		'Duarte': [34.1395, -117.9773],
		'La Puente': [34.0200, -117.9495],
		'El Monte': [34.0686, -118.0276],
		'West Covina': [34.0686, -117.9390],
		'Covina': [34.0900, -117.8903],
		'Diamond Bar': [33.9977, -117.8103],
		'Hacienda Heights': [33.9930, -117.9684],
		'San Gabriel Valley': [34.0961, -118.1058],
		'Sgv': [34.0961, -118.1058],
		'Mpk': [34.0625, -118.1228],
		// South Bay & Beach
		'Long Beach': [33.77, -118.1937],
		'Torrance': [33.8358, -118.3406],
		'Gardena': [33.8883, -118.3089],
		'Manhattan Beach': [33.8847, -118.4109],
		'Redondo Beach': [33.8492, -118.3884],
		'El Segundo': [33.9192, -118.4165],
		// San Fernando Valley
		'Burbank': [34.1808, -118.3090],
		'Glendale': [34.1425, -118.255],
		// Orange County
		'Irvine': [33.6846, -117.8265],
		'Laguna Beach': [33.5427, -117.7834],
		'Anaheim': [33.8366, -117.9143],
		'Costa Mesa': [33.6411, -117.9187],
		'Fullerton': [33.8703, -117.9242],
		'Orange County': [33.7175, -117.8311],
		// California
		'San Francisco': [37.7749, -122.4194],
		'San Jose': [37.3382, -121.8863],
		'Oakland': [37.8044, -122.2712],
		'Bay Area': [37.5585, -122.2711],
		'San Diego': [32.7157, -117.1611],
		'Solvang': [34.5958, -120.1376],
		// Texas
		'Austin': [30.2672, -97.7431],
		'Houston': [29.7604, -95.3698],
		'Dallas': [32.7767, -96.7970],
		'San Antonio': [29.4241, -98.4936],
		'Lockhart': [29.8849, -97.6700],
		'Texas': [30.2672, -97.7431],
		// US
		'Las Vegas': [36.1699, -115.1398],
		'New York': [40.7128, -74.006],
		'Brooklyn': [40.6782, -73.9442],
		'Honolulu': [21.3069, -157.8583],
		'Maui': [20.7984, -156.3319],
		'Hawaii': [21.3069, -157.8583],
		'Seattle': [47.6062, -122.3321],
		'Portland': [45.5051, -122.6750],
		'Chicago': [41.8781, -87.6298],
		'New Orleans': [29.9511, -90.0715],
		'Bardstown': [37.8092, -85.4669],
		// Mexico
		'Ensenada': [31.8667, -116.5964],
		'Tijuana': [32.5149, -117.0382],
		// South America
		'Medellin': [6.2442, -75.5812],
		'Bogota': [4.7110, -74.0721],
		// Asia
		'Shanghai': [31.2304, 121.4737],
		'Taipei': [25.033, 121.5654],
		'Tokyo': [35.6762, 139.6503],
		'Osaka': [34.6937, 135.5023],
		'Kyoto': [35.0116, 135.7681],
		'Seoul': [37.5665, 126.978],
		'Hong Kong': [22.3193, 114.1694],
		'Bangkok': [13.7563, 100.5018],
		'Singapore': [1.3521, 103.8198],
		'Beijing': [39.9042, 116.4074],
		'Chengdu': [30.5728, 104.0668],
		'Dalian': [38.9140, 121.6147],
		'Chongming Island': [31.6237, 121.3962],
		'Koh Samui': [9.5120, 100.0136],
		// Canada
		'Victoria': [48.4284, -123.3656],
		// Europe
		'London': [51.5074, -0.1278],
		'Paris': [48.8566, 2.3522],
	};

	const markers = posts
		.filter(p => p.data.coordinates || p.data.city || p.data.region)
		.map(post => {
			const city = post.data.city || '';

			// Prefer exact GPS coordinates from post, fall back to city lookup
			let lat: number, lng: number;
			if (post.data.coordinates) {
				lat = post.data.coordinates.lat;
				lng = post.data.coordinates.lng;
				// Small jitter so co-located posts don't overlap perfectly
				lat += (Math.random() - 0.5) * 0.001;
				lng += (Math.random() - 0.5) * 0.001;
			} else {
				const coords = cityCoords[city] || cityCoords[post.data.region || ''];
				if (!coords) return null;
				const jitter = () => (Math.random() - 0.5) * 0.008;
				lat = coords[0] + jitter();
				lng = coords[1] + jitter();
			}

			return {
				id: post.id,
				title: post.data.title,
				city: city,
				region: post.data.region || '',
				location: post.data.location || '',
				lat,
				lng,
				heroImage: post.data.heroImage || '',
				date: post.data.pubDate.toISOString().split('T')[0],
				closed: (post.data.tags || []).some(t => t.toLowerCase() === 'closed'),
				hasExactCoords: !!post.data.coordinates,
			};
		})
		.filter(Boolean);

	return new Response(JSON.stringify(markers), {
		headers: { 'Content-Type': 'application/json' },
	});
};
