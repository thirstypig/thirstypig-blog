import { describe, it, expect } from "vitest";
import { buildLocationLinks } from "./location-links";

describe("buildLocationLinks", () => {
	describe("mapUrl", () => {
		it("deep-links to /map with lat/lng/zoom when coordinates are present", () => {
			const { mapUrl } = buildLocationLinks({
				coordinates: { lat: 34.05, lng: -118.25 },
			});
			expect(mapUrl).toBe("/map#lat=34.05&lng=-118.25&zoom=15");
		});

		it("falls back to bare /map when only city is known", () => {
			const { mapUrl } = buildLocationLinks({ city: "Los Angeles" });
			expect(mapUrl).toBe("/map");
		});

		it("is null when neither coords nor city are known", () => {
			const { mapUrl } = buildLocationLinks({ address: "123 Any St" });
			expect(mapUrl).toBeNull();
		});

		it("prefers coordinates over city when both present", () => {
			const { mapUrl } = buildLocationLinks({
				coordinates: { lat: 1.5, lng: 2.5 },
				city: "Anywhere",
			});
			expect(mapUrl).toBe("/map#lat=1.5&lng=2.5&zoom=15");
		});
	});

	describe("googleMapsUrl", () => {
		it("builds a lat/lng query when coordinates are present", () => {
			const { googleMapsUrl } = buildLocationLinks({
				coordinates: { lat: 34.05, lng: -118.25 },
			});
			expect(googleMapsUrl).toBe(
				"https://www.google.com/maps/search/?api=1&query=34.05,-118.25",
			);
		});

		it("falls back to address query when no coordinates", () => {
			const { googleMapsUrl } = buildLocationLinks({
				address: "123 Main St, Los Angeles, CA",
			});
			expect(googleMapsUrl).toBe(
				"https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Los%20Angeles%2C%20CA",
			);
		});

		it("URL-encodes special characters in addresses", () => {
			const { googleMapsUrl } = buildLocationLinks({
				address: "45 café & 5th Ave, NY",
			});
			expect(googleMapsUrl).toContain("caf%C3%A9");
			expect(googleMapsUrl).toContain("%26");  // &
		});

		it("is null when neither coords nor address are known", () => {
			const { googleMapsUrl } = buildLocationLinks({ city: "Somewhere" });
			expect(googleMapsUrl).toBeNull();
		});

		it("prefers coordinates over address when both present", () => {
			const { googleMapsUrl } = buildLocationLinks({
				coordinates: { lat: 1, lng: 2 },
				address: "Ignored Street",
			});
			expect(googleMapsUrl).toBe(
				"https://www.google.com/maps/search/?api=1&query=1,2",
			);
		});
	});

	describe("combined behavior", () => {
		it("both null for a completely empty input", () => {
			expect(buildLocationLinks({})).toEqual({
				mapUrl: null,
				googleMapsUrl: null,
			});
		});

		it("with coords only: both map and google URLs populated", () => {
			const { mapUrl, googleMapsUrl } = buildLocationLinks({
				coordinates: { lat: 40.7, lng: -74 },
			});
			expect(mapUrl).toBeTruthy();
			expect(googleMapsUrl).toBeTruthy();
		});

		it("with city + address only: mapUrl points to /map, google uses address", () => {
			const { mapUrl, googleMapsUrl } = buildLocationLinks({
				city: "Tokyo",
				address: "1-1 Chiyoda, Tokyo",
			});
			expect(mapUrl).toBe("/map");
			expect(googleMapsUrl).toContain("query=1-1");
		});
	});
});
