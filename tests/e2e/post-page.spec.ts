import { test, expect } from "@playwright/test";

/**
 * Post-page regression suite.
 *
 * A post is the highest-traffic page type; this suite guards the image
 * pipeline work (PRs #35/#40), accessibility work (PR #36), and markup
 * structure that's easy to silently regress when the BlogPost layout changes.
 *
 * Uses one stable post as the fixture. Texas BBQ from Stiles Switch has a
 * hero image + 8 gallery images + a LocationCard, which exercises every
 * post-layout branch.
 *
 * Note: after IG prose migration (PR #118), inline body images moved from
 * .prose to BlogPost.astro's gallery loop (.post-image-wrap blocks outside the
 * prose). Tests updated in PR #127 to target the new selectors.
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

		// Hero is the first .post-image-wrap — gallery images share the same class but follow it.
		// The structural selector is intentional: this is the class we'd lose if BlogPost.astro changed.
		const heroPicture = page.locator(".post-image-wrap picture").first();
		await expect(heroPicture).toBeVisible();

		const webpSource = heroPicture.locator('source[type="image/webp"]');
		const srcset = await webpSource.getAttribute("srcset");
		expect(srcset).toMatch(/\.webp(\?|$)/);

		const heroImg = heroPicture.locator("img");
		await expect(heroImg).toHaveAttribute("width", /\d+/);
		await expect(heroImg).toHaveAttribute("height", /\d+/);
		// Hero must be eager-loaded: it's the LCP candidate (PR #120 changed this from lazy).
		await expect(heroImg).toHaveAttribute("loading", "eager");
	});

	test("hero WebP preload <link> is in <head> (LCP optimization)", async ({ page }) => {
		await page.goto(POST_URL);
		// The preload must use imagesrcset (not href) so the browser matches it against
		// <source srcset> in the <picture> element rather than <img src>.
		const preload = page.locator('head link[rel="preload"][as="image"]');
		await expect(preload).toHaveCount(1);
		const imagesrcset = await preload.getAttribute("imagesrcset");
		expect(imagesrcset).toMatch(/\.webp$/);
	});

	test("gallery images use <picture> with WebP sources (BlogPost gallery loop)", async ({ page }) => {
		await page.goto(POST_URL);

		// After IG prose migration (PR #118): body images moved from .prose to BlogPost's
		// gallery loop — full-size stacked .post-image-wrap blocks outside the article prose.
		// This post has a hero + 8 gallery images, all rendered via the gallery loop.
		const allPictures = page.locator("article .post-image-wrap picture");
		const count = await allPictures.count();
		expect(count).toBeGreaterThan(1); // hero + at least 1 gallery image

		// Every .post-image-wrap should carry a WebP source
		const webpSources = page.locator("article .post-image-wrap source[type='image/webp']");
		expect(await webpSources.count()).toBe(count);
	});

	test("hero is eager-loaded (LCP); gallery images are lazy-loaded", async ({ page }) => {
		await page.goto(POST_URL);

		const allPostImgs = page.locator("article .post-image-wrap img");
		const total = await allPostImgs.count();
		expect(total).toBeGreaterThan(1);

		// Hero (first image) must be eager for LCP
		await expect(allPostImgs.first()).toHaveAttribute("loading", "eager");

		// All gallery images after the hero must be lazy
		const lazyCount = await allPostImgs.evaluateAll(imgs =>
			imgs.slice(1).filter(img => img.getAttribute("loading") === "lazy").length
		);
		expect(lazyCount).toBe(total - 1);
	});

	test("post images have explicit width and height (CLS prevention)", async ({ page }) => {
		await page.goto(POST_URL);

		// All images — hero and gallery — must have explicit dimensions to prevent CLS.
		const missingDims = await page.locator("article .post-image-wrap img").evaluateAll(imgs =>
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

		// Known-benign patterns:
		// - Vercel Analytics: beacons POST to /_vercel/insights/* (404 outside Vercel)
		// - AdSense: returns 403 on localhost (only activates on approved domains)
		// - Astro dev toolbar: MIME error fires on fresh server restart before Vite
		//   finishes dep optimisation — Astro internals, not our code
		const isBenign = (text: string) =>
			/_vercel\/insights/.test(text) ||
			/googleads|doubleclick\.net/.test(text) ||
			/astro\/runtime\/client\/dev-toolbar/.test(text) ||
			// Vite 504 on fresh restart while dep-optimisation is still running
			/504.*Outdated Optimize Dep/.test(text) ||
			// AdSense 403 on localhost — WebKit omits the URL from the message
			text.startsWith("Failed to load resource: the server responded with a status of 403") ||
			text === "Failed to load resource: the server responded with a status of 404 (Not Found)";

		page.on("console", msg => {
			if (msg.type() === "error" && !isBenign(msg.text())) errors.push(msg.text());
		});
		page.on("pageerror", err => errors.push(err.message));

		await page.goto(POST_URL);
		await page.waitForLoadState("networkidle");

		expect(errors, `Unexpected console errors:\n${errors.join("\n")}`).toHaveLength(0);
	});

	test("'You might also enjoy' section is inside the max-w-3xl container, not flush to viewport edge", async ({ page }) => {
		await page.goto(POST_URL);

		const heading = page.getByRole("heading", { name: /you might also enjoy/i });
		await expect(heading).toBeVisible();

		// Guard against the regression fixed in this session: <slot name="related"> was
		// outside <article>'s max-w-3xl wrapper, so RelatedPosts rendered full-width
		// flush-left on desktop and edge-to-edge on mobile.
		const isInsideMaxW = await heading.evaluate(el => {
			let node: Element | null = el.parentElement;
			while (node && node.tagName !== "MAIN") {
				if (node.classList.contains("max-w-3xl")) return true;
				node = node.parentElement;
			}
			return false;
		});
		expect(isInsideMaxW).toBe(true);
	});

	test("article landmark gets focused when skip link is activated", async ({ page, browserName }) => {
		await page.goto(POST_URL);

		const skipLink = page.getByRole("link", { name: "Skip to content" });

		if (browserName === "webkit") {
			// WebKit + macOS default keyboard-nav skips links in the Tab sequence.
			// See tests/e2e/homepage.spec.ts for the full explanation.
			await skipLink.focus();
		} else {
			await page.keyboard.press("Tab");
			await expect(skipLink).toBeFocused();
		}

		await skipLink.press("Enter");
		await expect(page.locator("main#main")).toBeFocused();
	});
});
