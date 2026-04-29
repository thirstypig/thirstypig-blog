import { test, expect } from "@playwright/test";

/**
 * Homepage smoke suite.
 *
 * Exercises the full pipeline: HTML shell, CSS, fonts, JS, theme-init inline
 * script, skip link, and theme toggle persistence across navigation.
 */
test.describe("homepage", () => {
	test("renders Bold Red Poster hero and the Right off the stove section", async ({ page }) => {
		await page.goto("/");
		// H1 is "Eat<br>everything.<br>Twice." — accessible name normalizes the <br>s
		// to whitespace, but to be tolerant across browsers use a regex.
		await expect(page.getByRole("heading", { level: 1 })).toContainText(/Eat\s*everything\.\s*Twice\./);
		await expect(page.getByRole("heading", { level: 2, name: "Right off the stove" })).toBeVisible();
	});

	test("aria-current is set on the matching nav link when visiting an interior page", async ({ page }) => {
		// The Bold Red Poster nav intentionally has no "Home" link — the wordmark links to /
		// instead. So aria-current is meaningful only on interior pages. Visit /about to
		// verify the mechanism wires up correctly.
		await page.goto("/about");
		// Assert via stable data-testid; survives label renames.
		await expect(page.locator('[data-testid="nav-about"]').first())
			.toHaveAttribute("aria-current", "page");
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
