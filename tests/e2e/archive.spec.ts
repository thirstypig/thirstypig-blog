import { test, expect } from "@playwright/test";

/**
 * Posts archive coverage — /posts/, /archive/[year]/, /archive/[year]/[month]/.
 *
 * The archive index moved from /archive to /posts in PR #91; year + month
 * detail pages still live at /archive/[year]/ for now (renaming would
 * collide with /posts/[page].astro pagination + /posts/[...slug].astro).
 * /archive 301-redirects to /posts via astro.config.mjs.
 */
test.describe("posts archive", () => {
	test("index renders year links for every year with posts", async ({ page }) => {
		await page.goto("/posts/");
		// H1 was dropped in PR #91 — the page-title + count line carry context.
		// Verify the year links instead, which are the load-bearing content.
		await expect(page.getByRole("link", { name: /^2008$/ })).toBeVisible();
		await expect(page.getByRole("link", { name: /^2022$/ })).toBeVisible();
	});

	test("year page renders year heading and month-with-posts links", async ({ page }) => {
		await page.goto("/archive/2022/");
		await expect(page.getByRole("heading", { level: 1, name: "2022" })).toBeVisible();

		// The year page lists only months that had posts, with full month names.
		// 2022 has multiple active months — at least one should be linked.
		const monthLinks = page.locator('a[href^="/archive/2022/"]');
		const count = await monthLinks.count();
		expect(count).toBeGreaterThan(0);
	});

	test("year-month page lists posts for that month", async ({ page }) => {
		await page.goto("/archive/2022/06/");
		// The page should render headings AND show post links
		await expect(page.locator("h1")).toBeVisible();
		// Post cards link to /posts/<slug>/ — there should be at least one
		const postLinks = page.locator('a[href^="/posts/2022-06-"]');
		const count = await postLinks.count();
		expect(count).toBeGreaterThan(0);
	});

	test("Posts nav link gets aria-current on the /posts index", async ({ page }) => {
		await page.goto("/posts/");
		// Assert via stable data-testid; survives label renames.
		await expect(page.locator('[data-testid="nav-posts"]').first())
			.toHaveAttribute("aria-current", "page");
	});
});
