import { test, expect } from "@playwright/test";

/**
 * Prose pages with no dynamic behavior — /about, /best-of, /changelog.
 * Tests are lightweight: heading renders, nav active state is right,
 * page doesn't crash.
 */
test.describe("static pages", () => {
	test("about page renders with its heading and tech-stack content", async ({ page }) => {
		await page.goto("/about");
		await expect(page.getByRole("heading", { level: 1, name: /About The Thirsty Pig/i })).toBeVisible();
		// About mentions the tech stack; pick a stable marker
		await expect(page.getByText("Astro", { exact: false })).toBeVisible();
	});

	test("about nav link gets aria-current", async ({ page }) => {
		await page.goto("/about");
		const active = page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]').first();
		await expect(active).toHaveText("About");
	});

	test("best-of index renders heading", async ({ page }) => {
		await page.goto("/best-of");
		await expect(page.getByRole("heading", { level: 1, name: "Best Of" })).toBeVisible();
	});

	test("changelog renders heading and recent entry", async ({ page }) => {
		await page.goto("/changelog");
		await expect(page.getByRole("heading", { level: 1, name: "Changelog" })).toBeVisible();
		// The April 2026 section should be near the top after PR #43/53
		await expect(page.getByRole("heading", { level: 2, name: /April 2026/ })).toBeVisible();
	});
});
