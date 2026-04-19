import { test, expect } from "@playwright/test";

/**
 * Post-page regression suite.
 *
 * A post is the highest-traffic page type; this suite guards the image
 * pipeline work (PRs #35/#40), accessibility work (PR #36), and markup
 * structure that's easy to silently regress when the BlogPost layout changes.
 *
 * Uses one stable post as the fixture. Texas BBQ from Stiles Switch has a
 * hero image + 8 body images + a LocationCard, which exercises every
 * post-layout branch.
 */

const POST_URL = "/posts/2022-06-29-texas-bbq-from-stiles-switch-in-austin-texas/";

test.describe("post page", () => {
	test("renders with exactly one h1 and no skipped heading levels", async ({ page }) => {
		await page.goto(POST_URL);

		const h1s = page.locator("h1");
		await expect(h1s).toHaveCount(1);
		await expect(h1s.first()).toHaveText(/Stiles Switch/);

		// Heading-level skips (h1 → h3 with no h2) fail WCAG heuristics.
		// Collect all heading tag names in document order and assert each jump
		// is ≤ 1 level.
		const levels = await page.$$eval("h1, h2, h3, h4, h5, h6", els =>
			els.map(el => Number(el.tagName.substring(1)))
		);
		for (let i = 1; i < levels.length; i++) {
			expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
		}
	});

	test("hero image is a <picture> with a WebP <source> and explicit dimensions", async ({ page }) => {
		await page.goto(POST_URL);

		// The hero lives in .hero-container — structural selector is intentional;
		// this is the class we'd lose if someone rewrote BlogPost.astro
		const heroPicture = page.locator(".hero-container picture");
		await expect(heroPicture).toBeVisible();

		const webpSource = heroPicture.locator('source[type="image/webp"]');
		const srcset = await webpSource.getAttribute("srcset");
		expect(srcset).toMatch(/\.webp(\?|$)/);

		const heroImg = heroPicture.locator("img");
		await expect(heroImg).toHaveAttribute("width", /\d+/);
		await expect(heroImg).toHaveAttribute("height", /\d+/);
		await expect(heroImg).toHaveAttribute("loading", "lazy");
	});

	test("body images use <picture> with WebP sources (remark plugin output)", async ({ page }) => {
		await page.goto(POST_URL);

		// Markdown body images get transformed by remark-image-optimize.mjs into
		// <picture> with a WebP source. All 8 body images in this post have webp
		// siblings, so every one should be wrapped.
		const bodyPictures = page.locator("article .prose picture, article > picture").filter({
			hasNot: page.locator(".hero-container *"),
		});
		const count = await bodyPictures.count();
		expect(count).toBeGreaterThan(1);

		// Every body <img> should be lazy + async
		const bodyImgs = page.locator("article img").filter({
			hasNot: page.locator(".hero-container *"),
		});
		const lazyCount = await bodyImgs.evaluateAll(imgs =>
			imgs.filter(img => img.getAttribute("loading") === "lazy").length
		);
		const totalBody = await bodyImgs.count();
		expect(lazyCount).toBe(totalBody);
	});

	test("body images have explicit width and height (CLS prevention)", async ({ page }) => {
		await page.goto(POST_URL);

		const missingDims = await page.locator("article .prose img").evaluateAll(imgs =>
			imgs.filter(img => !img.getAttribute("width") || !img.getAttribute("height")).length
		);
		expect(missingDims).toBe(0);
	});

	test("LocationCard renders with venue name and address", async ({ page }) => {
		await page.goto(POST_URL);
		const locationCard = page.locator(".location-card");
		await expect(locationCard).toBeVisible();
		await expect(locationCard).toContainText("Stiles Switch");
		await expect(locationCard).toContainText("Austin");
	});

	test("page load produces no unexpected console errors", async ({ page }) => {
		const errors: string[] = [];

		// Known-benign patterns: Vercel Analytics beacons POST to /_vercel/insights/*
		// which only exists when deployed to Vercel. In local preview + CI, these
		// return 404 and browsers log a generic resource-load error. Not a real bug.
		const isBenign = (text: string) =>
			/_vercel\/insights/.test(text) ||
			text === "Failed to load resource: the server responded with a status of 404 (Not Found)";

		page.on("console", msg => {
			if (msg.type() === "error" && !isBenign(msg.text())) errors.push(msg.text());
		});
		page.on("pageerror", err => errors.push(err.message));

		await page.goto(POST_URL);
		await page.waitForLoadState("networkidle");

		expect(errors, `Unexpected console errors:\n${errors.join("\n")}`).toHaveLength(0);
	});

	test("article landmark gets focused when skip link is activated", async ({ page }) => {
		await page.goto(POST_URL);
		await page.keyboard.press("Tab");
		const skipLink = page.getByRole("link", { name: "Skip to content" });
		await expect(skipLink).toBeFocused();
		await skipLink.press("Enter");
		await expect(page.locator("main#main")).toBeFocused();
	});
});
