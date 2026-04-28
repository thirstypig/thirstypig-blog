import { test, expect } from "@playwright/test";

/**
 * Category page coverage — /categories/ index + an individual category page.
 * Categories are derived from cuisine + a few non-food categories.
 */
test.describe("categories", () => {
	test("index renders Categories heading and multiple category links", async ({ page }) => {
		await page.goto("/categories/");
		await expect(page.getByRole("heading", { level: 1, name: "Categories" })).toBeVisible();

		// Japanese is one of the largest categories and has existed since the rebuild
		await expect(page.getByRole("link", { name: /^Japanese/ })).toBeVisible();

		// There should be many categories — the seed-time count was 45
		const categoryLinks = page.locator('a[href^="/categories/"]');
		const count = await categoryLinks.count();
		expect(count).toBeGreaterThan(10);
	});

	test("individual category page renders with correct heading and posts", async ({ page }) => {
		await page.goto("/categories/japanese/");
		await expect(page.getByRole("heading", { level: 1, name: "Japanese" })).toBeVisible();

		// Category page uses PostCard grid — every card is a link to /posts/...
		const postLinks = page.locator('main a[href^="/posts/"]');
		const count = await postLinks.count();
		expect(count).toBeGreaterThan(0);
	});

	test("Cities nav link (points to /categories) gets aria-current on category pages", async ({ page }) => {
		// Bold Red Poster redesign renamed "Categories" -> "Cities"; the route stayed at /categories.
		await page.goto("/categories/");
		const active = page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]').first();
		await expect(active).toHaveText("Cities");
	});
});
