import { test, expect } from "@playwright/test";

/**
 * Homepage smoke suite.
 *
 * Exercises the full pipeline: HTML shell, CSS, fonts, JS, theme-init inline
 * script, skip link, and theme toggle persistence across navigation.
 */
test.describe("homepage", () => {
	test("renders hero and recent posts", async ({ page }) => {
		await page.goto("/");
		await expect(page.getByRole("heading", { level: 1, name: "The Thirsty Pig" })).toBeVisible();
		await expect(page.getByRole("heading", { level: 2, name: "Recent Posts" })).toBeVisible();
	});

	test("main nav has aria-current on the active link", async ({ page }) => {
		await page.goto("/");
		// Scope to the main nav (there's also a mobile menu with duplicate links)
		const homeLinks = page.locator('nav[aria-label="Main navigation"] a[aria-current="page"]');
		await expect(homeLinks.first()).toHaveText("Home");
	});

	test("skip link becomes visible on first Tab and jumps to main", async ({ page, browserName }) => {
		await page.goto("/");

		const skipLink = page.getByRole("link", { name: "Skip to content" });

		if (browserName === "webkit") {
			// WebKit + macOS default keyboard-nav skips links in the Tab sequence
			// unless "Full Keyboard Access" is enabled in System Preferences.
			// Focus the link directly so we still verify the landmark jump works.
			await skipLink.focus();
		} else {
			await page.keyboard.press("Tab");
			await expect(skipLink).toBeFocused();
		}

		await skipLink.press("Enter");
		// After activation, the main landmark receives focus (tabindex="-1")
		await expect(page.locator("main#main")).toBeFocused();
	});

	test("theme toggle persists across navigation", async ({ page }) => {
		await page.goto("/");

		// Default is light mode unless OS prefers dark — force light to make the test deterministic
		await page.emulateMedia({ colorScheme: "light" });
		await page.reload();

		const html = page.locator("html");
		await expect(html).toHaveAttribute("data-theme", "light");

		// Toggle to dark
		await page.getByRole("button", { name: /Switch to dark mode/i }).click();
		await expect(html).toHaveAttribute("data-theme", "dark");

		// Navigate and confirm the setting survived
		await page.goto("/about");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	});
});
