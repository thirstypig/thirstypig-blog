import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config.
 *
 * Runs against one of two targets depending on PLAYWRIGHT_BASE_URL:
 *   - Unset (default): boots `astro preview` on :4321 and tests locally
 *   - Set (e.g. https://thirstypig.com): hits that URL directly, no local server
 *
 * The nightly workflow sets PLAYWRIGHT_BASE_URL to production so the same
 * E2E suite doubles as a live-site regression check.
 */
const prodBaseURL = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "list",

	use: {
		baseURL: prodBaseURL || "http://localhost:4321",
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Local preview only spins up when we DON'T have a prod URL override
	webServer: prodBaseURL
		? undefined
		: {
			command: "npm run preview",
			url: "http://localhost:4321",
			reuseExistingServer: !process.env.CI,
			timeout: 120_000,
		},
});
