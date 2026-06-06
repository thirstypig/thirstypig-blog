import { test, expect } from "@playwright/test";

test.describe("tag cloud", () => {
	test("Tags nav link routes to /tags/cloud and lights up aria-current", async ({ page }) => {
		// nav-tags moved to mobile menu in PR #123 (desktop nav: Posts + Cities only).
		// Navigate directly and assert aria-current on nav-tags-mobile (always in DOM).
		await page.goto("/tags/cloud");
		await expect(page).toHaveURL(/\/tags\/cloud\/?$/);
		await expect(page.locator('[data-testid="nav-tags-mobile"]').first())
			.toHaveAttribute("aria-current", "page");
	});

	test("renders at least 5 chips so the page is non-empty", async ({ page }) => {
		await page.goto("/tags/cloud");
		const chips = page.locator(".tag-link");
		// Smoke: fewer than 5 means the venue-tags pipeline produced no published
		// JSON, the loader regressed, or the aggregator dropped everything.
		await expect(chips.first()).toBeVisible();
		expect(await chips.count()).toBeGreaterThanOrEqual(5);
	});

	test("clicking a tag chip navigates to a search results page for that tag", async ({ page }) => {
		await page.goto("/tags/cloud");
		const firstChip = page.locator(".tag-link").first();
		// Capture the chip's label before clicking so we can assert the search query
		const chipLabel = await firstChip.textContent();
		await firstChip.click();
		// Chips link to /search/?q=<tag> (not /tags/<slug>/ — tag cloud is search-powered)
		await expect(page).toHaveURL(/\/search\/\?q=/);
		// Search page should render results for that query
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	});

	test("biggest chip renders larger than the smallest (popularity sort intact)", async ({ page }) => {
		await page.goto("/tags/cloud");
		const chips = page.locator(".tag-link");
		const count = await chips.count();
		expect(count).toBeGreaterThanOrEqual(2);

		// Each chip's font-size is set inline as `--rem:Xrem; ...`. The cloud must
		// render in popularity-descending order: first chip largest, last smallest.
		// If a shuffle gets reintroduced or the sort flips, this assertion fails.
		const remOf = async (index: number): Promise<number> => {
			const style = await chips.nth(index).getAttribute("style");
			expect(style).toBeTruthy();
			const match = style!.match(/--rem:\s*([\d.]+)rem/);
			expect(match).toBeTruthy();
			return parseFloat(match![1]);
		};

		const firstRem = await remOf(0);
		const lastRem = await remOf(count - 1);
		expect(firstRem).toBeGreaterThan(lastRem);
	});
});
