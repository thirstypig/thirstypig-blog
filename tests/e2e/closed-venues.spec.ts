import { test, expect } from "@playwright/test";

/**
 * Closed-venue rendering regression.
 *
 * Closed restaurants get three visual signals:
 *   - grayscale + reduced opacity on the thumbnail
 *   - CLOSED pill overlaid on the image
 *   - muted title color (text-stone instead of text-ink)
 *
 * We pick the closed post dynamically at test time from /search.json so the
 * test doesn't depend on a specific slug. If the current index has no closed
 * posts (unlikely — the archive contains ~39 closed venues), the test skips
 * with a clear message rather than failing.
 */
test.describe("closed venue rendering", () => {
	test("search results show CLOSED badge and grayscale thumbnail", async ({ page, request }) => {
		// Find a closed post in the current index
		const resp = await request.get("/search.json");
		expect(resp.ok()).toBe(true);
		const posts: Array<{ id: string; title: string; tags?: string[] }> = await resp.json();

		const closedPost = posts.find(p =>
			(p.tags || []).some(t => t.toLowerCase() === "closed") ||
			p.title.toLowerCase().includes("closed")
		);

		test.skip(
			!closedPost,
			"No closed posts in current /search.json index — skipping",
		);

		// Navigate to search and query for the closed post's title
		await page.goto("/search");

		// Wait for index load
		await expect(page.locator("#search-results > article").first()).toBeVisible();

		// Search by the closed post's title (take the first ~30 chars to avoid
		// over-specific matches on long titles)
		const query = closedPost!.title.slice(0, 30);
		await page.locator("#search-input").fill(query);

		// Wait for the debounced render to complete
		await page.waitForFunction(() => {
			const text = document.getElementById("results-count")?.textContent || "";
			return /\d+ results? found/.test(text) || /Showing recent/.test(text);
		});

		// Find the specific result article and assert closed styling
		const resultCard = page.locator("#search-results article", { hasText: closedPost!.title.split(",")[0] }).first();
		await expect(resultCard).toBeVisible();

		// CLOSED badge is the universal signal — renders whether or not the post
		// has a hero image. Always expected.
		const badge = resultCard.locator("text=Closed");
		await expect(badge).toBeVisible();

		// Grayscale class only applies when there's a hero image. Most legacy
		// closed-venue posts (2009-2012 WordPress reviews) are text-only, so
		// this assertion only fires when the picked post happens to have one.
		const hasHero = Boolean((closedPost as unknown as { heroImage?: string }).heroImage);
		if (hasHero) {
			const grayscaleImg = resultCard.locator("img.grayscale");
			await expect(grayscaleImg).toBeVisible();
		}
	});
});
