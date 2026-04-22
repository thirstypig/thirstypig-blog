/**
 * Derive the internal map URL and external Google Maps URL for a venue.
 *
 * Split out of LocationCard.astro so the conditional-URL logic can be
 * unit-tested without mounting the component. The rules:
 *
 * - `mapUrl` points to this site's /map page. With coordinates, it deep-links
 *   to that venue; with only a city, it lands on the bare /map. No city and
 *   no coords → null (no link rendered).
 *
 * - `googleMapsUrl` opens Google Maps. With coordinates, uses a lat/lng
 *   query; else falls back to an address query; else null.
 */

export interface Coordinates {
	lat: number;
	lng: number;
}

export interface LocationLinksInput {
	coordinates?: Coordinates | null;
	city?: string | null;
	address?: string | null;
}

export interface LocationLinks {
	mapUrl: string | null;
	googleMapsUrl: string | null;
}

export function buildLocationLinks({
	coordinates,
	city,
	address,
}: LocationLinksInput): LocationLinks {
	const mapUrl = coordinates
		? `/map#lat=${coordinates.lat}&lng=${coordinates.lng}&zoom=15`
		: city
			? `/map`
			: null;

	const googleMapsUrl = coordinates
		? `https://www.google.com/maps/search/?api=1&query=${coordinates.lat},${coordinates.lng}`
		: address
			? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
			: null;

	return { mapUrl, googleMapsUrl };
}
