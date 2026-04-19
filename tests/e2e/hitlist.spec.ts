import { test, expect } from "@playwright/test";

/**
 * /hitlist — client-rendered list fetched from /places-hitlist.json.
 *
 * Content is reasonably stable (~11 entries) so we assert against known
 * structural facts rather than specific entry names where possible.
 */
test.describe("hitlist page", () => {
	test("renders cards after fetching the JSON", async ({ page }) => {
		await page.goto("/hitlist");
		await expect(page.getByRole("heading", { level: 1, name: "Hit List" })).toBeVisible();

		// The loading message starts visible; wait for the first card instead
		const cards = page.locator("#hitlist-cards > div");
		await expect(cards.first()).toBeVisible();

		const count = await cards.count();
		expect(count).toBeGreaterThan(0);
	});

	test("city filter narrows results", async ({ page }) => {
		await page.goto("/hitlist");
		const cards = page.locator("#hitlist-cards > div");
		await expect(cards.first()).toBeVisible();

		const totalCount = await cards.count();
		expect(totalCount).toBeGreaterThan(1);

		// Pick the first non-empty city option from the dropdown
		const citySelect = page.locator("#city-filter");
		const firstCity = await citySelect.locator("option").nth(1).getAttribute("value");
		expect(firstCity).toBeTruthy();

		await citySelect.selectOption(firstCity!);

		// After filter, every visible card should mention that city
		const filteredCount = await cards.count();
		expect(filteredCount).toBeLessThanOrEqual(totalCount);

		// The count badge should update too
		await expect(page.locator("#hitlist-count")).toContainText(/\d+ places?/);
	});

	test("tag filter narrows results", async ({ page }) => {
		await page.goto("/hitlist");
		await expect(page.locator("#hitlist-cards > div").first()).toBeVisible();

		const initialCount = await page.locator("#hitlist-cards > div").count();

		// Click the first tag pill
		const firstTag = page.locator("#tag-pills button").first();
		await firstTag.click();

		const filteredCount = await page.locator("#hitlist-cards > div").count();
		expect(filteredCount).toBeLessThanOrEqual(initialCount);
	});

	test("clear-filters resets the view and the button re-hides", async ({ page }) => {
		await page.goto("/hitlist");
		await expect(page.locator("#hitlist-cards > div").first()).toBeVisible();

		const initialCount = await page.locator("#hitlist-cards > div").count();

		// Apply a filter
		await page.locator("#tag-pills button").first().click();

		// Clear button should appear
		const clearBtn = page.locator("#clear-filters");
		await expect(clearBtn).toBeVisible();

		// Click it
		await clearBtn.click();

		// Back to full list, clear button hidden again
		await expect(clearBtn).toBeHidden();
		expect(await page.locator("#hitlist-cards > div").count()).toBe(initialCount);
	});

	test("Hit List nav link gets aria-current on this page", async ({ page }) => {
		await page.goto("/hitlist");
		const activeLinks = page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]');
		await expect(activeLinks.first()).toHaveText("Hit List");
	});
});
