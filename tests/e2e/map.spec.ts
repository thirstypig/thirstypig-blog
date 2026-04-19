import { test, expect } from "@playwright/test";

/**
 * /map — Leaflet-driven interactive map, fetches /map.json (~1,400 markers).
 *
 * E2E intentionally light — Leaflet internals are out of scope. We verify the
 * page shell, legend, that markers actually render into the DOM, and that the
 * count populates.
 */
test.describe("map page", () => {
	test("page shell, heading, and legend render", async ({ page }) => {
		await page.goto("/map");
		await expect(page.getByRole("heading", { level: 1, name: "Restaurant Map" })).toBeVisible();

		// Legend is rendered server-side so it's visible immediately
		const legend = page.getByLabel("Map legend");
		await expect(legend).toBeVisible();
		await expect(legend).toContainText("Open");
		await expect(legend).toContainText("Closed");
	});

	test("map container initializes and renders marker elements", async ({ page }) => {
		await page.goto("/map");

		// Leaflet injects classes on #map once it's initialized
		await expect(page.locator("#map.leaflet-container")).toBeVisible();

		// Markers render as SVG path elements inside the marker pane
		const markers = page.locator("#map .leaflet-marker-pane, #map svg path");
		// Wait for at least one marker; not strict about count (data changes)
		await expect(markers.first()).toBeVisible({ timeout: 10_000 });
	});

	test("marker count text populates from /map.json", async ({ page }) => {
		await page.goto("/map");
		await expect(page.locator("#map-count")).toContainText(/\d+ restaurants mapped/, {
			timeout: 10_000,
		});
	});
});
