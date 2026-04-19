import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config.
 *
 * - Boots `astro preview` on port 4321 before tests run
 * - Runs tests from `tests/e2e/**`
 * - Uses Chromium only for now (add Firefox/WebKit later once suite is stable)
 */
export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "list",

	use: {
		baseURL: "http://localhost:4321",
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Build + preview server the tests hit
	webServer: {
		// Use a pre-built dist in CI (faster); use dev mode locally for fast iteration
		command: process.env.CI ? "npm run preview" : "npm run preview",
		url: "http://localhost:4321",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
