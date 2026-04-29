import { test, expect } from "@playwright/test";

/**
 * Category page coverage — /categories/[category] detail pages.
 *
 * The bare /categories index was redirected to /cuisine in PR #91 (it
 * was orphaned from nav once /cuisine + /cities shipped). The detail
 * pages still resolve directly.
 */
test.describe("categories", () => {
	test("/categories redirects to /cuisine", async ({ page }) => {
		await page.goto("/categories/");
		// Astro redirects are 301/308; Playwright follows them by default,
		// landing us on /cuisine. Assert we ended up there.
		await expect(page).toHaveURL(/\/cuisine\/?$/);
		await expect(page.getByRole("heading", { level: 1, name: "Cuisine" })).toBeVisible();
	});

	test("individual category page renders with correct heading and posts", async ({ page }) => {
		await page.goto("/categories/japanese/");
		await expect(page.getByRole("heading", { level: 1, name: "Japanese" })).toBeVisible();

		// Category page uses PostCard grid — every card is a link to /posts/...
		const postLinks = page.locator('main a[href^="/posts/"]');
		const count = await postLinks.count();
		expect(count).toBeGreaterThan(0);
	});

	test("Cities nav link gets aria-current on /cities (the new cities index)", async ({ page }) => {
		await page.goto("/cities/");
		// Assert via stable data-testid; survives label renames.
		await expect(page.locator('[data-testid="nav-cities"]').first())
			.toHaveAttribute("aria-current", "page");
	});
});
