import { test, expect } from "@playwright/test";

/**
 * Archive page coverage — /archive/, /archive/[year]/, /archive/[year]/[month]/.
 *
 * Static pages (no client-side JS), so assertions focus on server-rendered
 * structure: heading, year grid, month grid, nav active state.
 */
test.describe("archive", () => {
	test("index renders heading and year links for every year with posts", async ({ page }) => {
		await page.goto("/archive/");
		await expect(page.getByRole("heading", { level: 1, name: "Archive" })).toBeVisible();

		// Every year since the blog started should have a link. Spot-check two
		// corners: 2008 (oldest era) and a recent year.
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

	test("Archive nav link gets aria-current on archive pages", async ({ page }) => {
		await page.goto("/archive/");
		const active = page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]').first();
		await expect(active).toHaveText("Archive");
	});
});
