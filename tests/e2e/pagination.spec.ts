import { test, expect } from "@playwright/test";

/**
 * Paginated post list at /posts/N/ — the "View all" destination from the homepage.
 */
test.describe("post pagination", () => {
	test("/posts/1/ renders a grid of posts", async ({ page }) => {
		await page.goto("/posts/1/");
		// Page shows a post grid — every entry links to /posts/<slug>/
		const postLinks = page.locator('main a[href^="/posts/"]').filter({
			hasNot: page.locator('a[href$="/"]:has-text("View all")'),
		});
		const count = await postLinks.count();
		expect(count).toBeGreaterThan(5);
	});

	test("Next link navigates to page 2", async ({ page }) => {
		await page.goto("/posts/1/");
		// Scope to the Pagination <nav aria-label="Pagination"> block so we don't
		// pick up a post card title that happens to contain the word "Next"
		const pagination = page.getByRole("navigation", { name: "Pagination" });
		const nextLink = pagination.getByRole("link", { name: /Next/i });
		await expect(nextLink).toBeVisible();

		await nextLink.click();
		await expect(page).toHaveURL(/\/posts\/2\/?$/);
	});

	test("Previous is disabled on page 1", async ({ page }) => {
		await page.goto("/posts/1/");
		// Pagination.astro renders a <span> (not <a>) for the disabled state
		const pagination = page.getByRole("navigation", { name: "Pagination" });
		const prevSpan = pagination.locator("span", { hasText: /Previous/i });
		await expect(prevSpan).toBeVisible();
	});
});
