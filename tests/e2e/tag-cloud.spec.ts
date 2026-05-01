import { test, expect } from "@playwright/test";

test.describe("tag cloud", () => {
	test("Tags nav link routes to /tags/cloud and lights up aria-current", async ({ page }) => {
		await page.goto("/");
		const tagsLink = page.locator('[data-testid="nav-tags"]').first();
		await expect(tagsLink).toBeVisible();
		await tagsLink.click();
		await expect(page).toHaveURL(/\/tags\/cloud\/?$/);
		await expect(tagsLink).toHaveAttribute("aria-current", "page");
	});

	test("renders at least 5 chips so the page is non-empty", async ({ page }) => {
		await page.goto("/tags/cloud");
		const chips = page.locator(".tag-link");
		// Smoke: fewer than 5 means the venue-tags pipeline produced no published
		// JSON, the loader regressed, or the aggregator dropped everything.
		await expect(chips.first()).toBeVisible();
		expect(await chips.count()).toBeGreaterThanOrEqual(5);
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
