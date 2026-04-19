import { test, expect } from "@playwright/test";

/**
 * /search — client-rendered results from /search.json (~1,600 posts).
 *
 * Tests target behavior, not specific content, since the index refreshes on
 * every content change.
 */
test.describe("search page", () => {
	test("initial state shows recent posts and a total count", async ({ page }) => {
		await page.goto("/search");
		await expect(page.getByRole("heading", { level: 1, name: "Search" })).toBeVisible();

		// Wait for JSON to load and the initial render (debounce is 200ms; no input typed)
		await page.waitForFunction(() => {
			const el = document.getElementById("results-count");
			return el && el.textContent && el.textContent.length > 0;
		});

		await expect(page.locator("#results-count")).toContainText(/Showing recent posts\. \d+ total posts\./);
		expect(await page.locator("#search-results > article").count()).toBeGreaterThan(0);
	});

	test("debounced typing narrows to matching results", async ({ page }) => {
		await page.goto("/search");
		await expect(page.locator("#search-results > article").first()).toBeVisible();

		// Type a generic term that should match multiple posts
		await page.locator("#search-input").fill("taiwanese");

		// Debounce is 200ms; wait for results to repopulate
		await page.waitForFunction(() => {
			const text = document.getElementById("results-count")?.textContent || "";
			return /\d+ results? found/.test(text);
		});

		await expect(page.locator("#results-count")).toContainText(/\d+ results? found/);
		expect(await page.locator("#search-results > article").count()).toBeGreaterThan(0);
	});

	test("results use <picture> with WebP source (PR #35 + #40)", async ({ page }) => {
		await page.goto("/search");
		await expect(page.locator("#search-results > article").first()).toBeVisible();

		// Every result card with a hero image should emit <picture><source type="image/webp">
		const pictures = page.locator("#search-results picture source[type='image/webp']");
		const count = await pictures.count();
		expect(count).toBeGreaterThan(0);

		// Spot-check the source srcset points to a .webp file
		const firstSrcset = await pictures.first().getAttribute("srcset");
		expect(firstSrcset).toMatch(/\.webp(\?|$)/);
	});

	test("no-results state appears for gibberish queries", async ({ page }) => {
		await page.goto("/search");

		// Wait for the index to load AND the initial render to place at least
		// one result — otherwise typing immediately can race the 200ms debounce
		// against loadIndex() fetching /search.json.
		await expect(page.locator("#search-results > article").first()).toBeVisible();

		await page.locator("#search-input").fill("zzzxxxqqqnotarealword");

		await expect(page.locator("#no-results")).toBeVisible();
		await expect(page.locator("#search-results")).toBeEmpty();
	});
});
