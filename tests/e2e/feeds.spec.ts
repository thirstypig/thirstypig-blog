import { test, expect } from "@playwright/test";

/**
 * Non-HTML outputs — RSS feed and sitemap. Verified as raw HTTP responses,
 * not via page.goto since neither is an HTML document browsers render.
 */
test.describe("feeds and site metadata", () => {
	test("/rss.xml returns valid RSS with channel title", async ({ request }) => {
		const resp = await request.get("/rss.xml");
		expect(resp.ok()).toBe(true);

		const contentType = resp.headers()["content-type"] || "";
		expect(contentType).toMatch(/xml/);

		const body = await resp.text();
		expect(body).toContain("<rss");
		expect(body).toContain("<channel>");
		expect(body).toContain("The Thirsty Pig");
	});

	test("/sitemap-index.xml returns valid sitemapindex", async ({ request }) => {
		const resp = await request.get("/sitemap-index.xml");
		expect(resp.ok()).toBe(true);

		const contentType = resp.headers()["content-type"] || "";
		expect(contentType).toMatch(/xml/);

		const body = await resp.text();
		expect(body).toContain("<sitemapindex");
		// Should reference at least one downstream sitemap file
		expect(body).toMatch(/<loc>[^<]*sitemap-0\.xml<\/loc>/);
	});

	test("/robots.txt is served and disallows admin paths", async ({ request }) => {
		const resp = await request.get("/robots.txt");
		expect(resp.ok()).toBe(true);

		const body = await resp.text();
		// Per PR #34: posts-admin.json and /admin/ are blocked
		expect(body).toContain("Disallow: /posts-admin.json");
		expect(body).toContain("Disallow: /admin/");
		// Sitemap should be referenced
		expect(body).toContain("Sitemap:");
	});
});
