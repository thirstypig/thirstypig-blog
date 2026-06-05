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
		// nav-about moved to mobile menu in PR #123 (desktop nav: Posts + Cities only).
		// nav-about-mobile is always in the DOM even when the menu is closed.
		await expect(page.locator('[data-testid="nav-about-mobile"]').first())
			.toHaveAttribute("aria-current", "page");
	});

	test("cuisine index renders heading (also covers the /best-of redirect)", async ({ page }) => {
		await page.goto("/cuisine");
		await expect(page.getByRole("heading", { level: 1, name: "Cuisine" })).toBeVisible();
	});

	test("changelog renders heading and recent entry", async ({ page }) => {
		await page.goto("/changelog");
		await expect(page.getByRole("heading", { level: 1, name: "Changelog" })).toBeVisible();
		// The April 2026 section should be near the top after PR #43/53
		await expect(page.getByRole("heading", { level: 2, name: /April 2026/ })).toBeVisible();
	});

	test("footer renders three grouped columns with Browse / Discover / Info headings", async ({ page }) => {
		await page.goto("/about");
		const footer = page.locator("footer");
		// Column headings — DOM text is mixed-case; CSS `uppercase` is cosmetic only.
		await expect(footer.getByText("Browse", { exact: true })).toBeVisible();
		await expect(footer.getByText("Discover", { exact: true })).toBeVisible();
		await expect(footer.getByText("Info", { exact: true })).toBeVisible();
		// Browse column contains the primary content links
		await expect(footer.getByRole("link", { name: "Posts" })).toBeVisible();
		await expect(footer.getByRole("link", { name: "Cities" })).toBeVisible();
		await expect(footer.getByRole("link", { name: "Cuisine" })).toBeVisible();
		// Info column contains utility/legal links
		await expect(footer.getByRole("link", { name: "RSS" })).toBeVisible();
		await expect(footer.getByRole("link", { name: "Privacy" })).toBeVisible();
	});

	test("privacy page discloses trackers and GDPR/CCPA rights", async ({ page }) => {
		await page.goto("/privacy");
		await expect(page.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeVisible();
		// Must name each tracker that actually loads (guards the /privacy drift in todo #004).
		await expect(page.getByText("Google Analytics 4")).toBeVisible();
		await expect(page.getByText("Google AdSense")).toBeVisible();
		await expect(page.getByText("Vercel Analytics", { exact: false })).toBeVisible();
		// Both legal frameworks the consent banner is built for.
		await expect(page.getByText(/GDPR/)).toBeVisible();
		await expect(page.getByText(/CCPA/)).toBeVisible();
	});
});
