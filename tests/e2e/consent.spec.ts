import { test, expect } from "@playwright/test";

/**
 * Consent-gated GA4 / AdSense — the privacy-critical, silent-regression invariant:
 * GA4 and AdSense must NOT load as executable scripts before the visitor opts in.
 * They are emitted as `type="text/plain" data-category=...` tags that
 * vanilla-cookieconsent flips to executable only on consent. If someone strips the
 * gating, trackers would fire pre-consent with no error — the drift that bit
 * /privacy twice (todo #004).
 *
 * NOTE ON SCOPE: the consent *banner UI* (vanilla-cookieconsent's modal) does not
 * render in headless Chromium — run() builds no DOM there (verified: the canonical
 * library + config produce nothing headless, while the banner shows normally in a
 * real browser). So banner-interaction flows (accept/reject activates or suppresses
 * trackers, footer "Cookie preferences" re-open) are NOT covered here — they'd be
 * permanently red in CI. They must be verified manually in a real browser. What we
 * CAN guard headlessly, and what actually matters most, is the static served HTML:
 * trackers ship inert. That's below.
 *
 * The gated tags only render when PUBLIC_GA4_ID / PUBLIC_ADSENSE_* are set at build
 * time; absent that config the test skips with a reason (CI sets fake public IDs).
 */

const GA4 = 'script[src*="googletagmanager.com"]';
const ADS = 'script[src*="adsbygoogle"]';
const POST = "/posts/2008-12-21-jimmy-c/";

test.describe("consent-gated trackers", () => {
	test("GA4 + AdSense ship inert (text/plain + data-category) before consent", async ({ page }) => {
		await page.goto(POST);

		const ga = page.locator(GA4);
		if ((await ga.count()) === 0) {
			test.skip(true, "PUBLIC_GA4_ID not set in this build — gated tag absent");
		}
		// GA4 is present but inert and tagged to the analytics category.
		await expect(ga.first()).toHaveAttribute("type", "text/plain");
		await expect(ga.first()).toHaveAttribute("data-category", "analytics");

		// AdSense loader is present but inert and tagged to the marketing category.
		const ads = page.locator(ADS);
		await expect(ads.first()).toHaveAttribute("type", "text/plain");
		await expect(ads.first()).toHaveAttribute("data-category", "marketing");

		// Critically: nothing executable. No tracker may load before opt-in.
		await expect(page.locator(`${GA4}:not([type="text/plain"])`)).toHaveCount(0);
		await expect(page.locator(`${ADS}:not([type="text/plain"])`)).toHaveCount(0);
	});
});
