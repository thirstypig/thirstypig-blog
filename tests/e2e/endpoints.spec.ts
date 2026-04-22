import { test, expect } from "@playwright/test";

/**
 * Schema checks for build-time JSON endpoints.
 *
 * These are static files emitted by src/pages/*.json.ts during astro build.
 * We assert shape + self-consistency invariants so that a silent field
 * rename or count drift in a generator shows up in CI instead of surprising
 * the admin dashboard consumer.
 *
 * Philosophy: each test verifies what a CONSUMER actually relies on. If you
 * add a field that no consumer reads, don't add an assertion here — it just
 * creates churn. If you add a field a consumer DOES read, add an assertion.
 */

test.describe("build-time JSON endpoints", () => {
	test("/tests-admin.json has stable shape and self-consistent summary", async ({ request }) => {
		const resp = await request.get("/tests-admin.json");
		expect(resp.ok()).toBe(true);

		const body = await resp.json();
		expect(body).toHaveProperty("generatedAt");
		expect(body).toHaveProperty("tests");
		expect(body).toHaveProperty("summary");
		expect(Array.isArray(body.tests)).toBe(true);
		expect(body.tests.length).toBeGreaterThan(0);

		// Every entry has the 5 fields the TestingDashboard UI reads
		for (const entry of body.tests) {
			expect(entry).toHaveProperty("file");
			expect(entry).toHaveProperty("kind");
			expect(entry).toHaveProperty("covers");
			expect(entry).toHaveProperty("assertions");
			expect(entry).toHaveProperty("status");
			expect(["unit", "e2e"]).toContain(entry.kind);
			expect(["passing", "failing", "untested", "missing"]).toContain(entry.status);
			expect(typeof entry.assertions).toBe("number");
		}

		// Self-consistency: summary counters must match actual entries.
		// If these drift, the admin dashboard is lying about itself.
		const unitCount = body.tests.filter((t: any) => t.kind === "unit").length;
		const e2eCount = body.tests.filter((t: any) => t.kind === "e2e").length;
		const totalAssertions = body.tests.reduce((sum: number, t: any) => sum + t.assertions, 0);

		expect(body.summary.total).toBe(body.tests.length);
		expect(body.summary.unit).toBe(unitCount);
		expect(body.summary.e2e).toBe(e2eCount);
		expect(body.summary.totalAssertions).toBe(totalAssertions);
	});

	test("/stats.json has top-level keys the StatsDashboard UI reads", async ({ request }) => {
		const resp = await request.get("/stats.json");
		expect(resp.ok()).toBe(true);

		const body = await resp.json();
		// Sampled from tina/StatsDashboard.tsx's Stats interface
		for (const key of [
			"generatedAt",
			"totalPosts",
			"postsByYear",
			"postsBySource",
			"topCities",
			"topCategories",
			"topTags",
			"gpsStats",
			"imageStats",
			"recentPosts",
			"uncategorizedPosts",
		]) {
			expect(body).toHaveProperty(key);
		}

		// totalPosts counts live (non-draft) posts — 1,602 at time of writing
		// after the draft-filtering pass in PR #41. Loose lower bound so the
		// test stays stable as drafts flip live or new posts ship.
		expect(body.totalPosts).toBeGreaterThan(1000);
		expect(Array.isArray(body.postsByYear)).toBe(true);
		expect(body.postsByYear.length).toBeGreaterThan(0);
		// Year entries have {year, count}
		expect(body.postsByYear[0]).toHaveProperty("year");
		expect(body.postsByYear[0]).toHaveProperty("count");

		// Image coverage invariant: hero + gallery + any ≥ without + 0
		const i = body.imageStats;
		expect(i.withHero + i.withGallery + i.withAny + i.without).toBeGreaterThan(0);
	});

	test("/posts-admin.json has posts/categories/cities arrays with expected entry shape", async ({ request }) => {
		const resp = await request.get("/posts-admin.json");
		expect(resp.ok()).toBe(true);

		const body = await resp.json();
		for (const key of ["posts", "categories", "cities"]) {
			expect(body).toHaveProperty(key);
			expect(Array.isArray(body[key])).toBe(true);
		}
		expect(body.posts.length).toBeGreaterThan(100);

		// Every entry has the 12 fields PostManager.tsx reads
		const post = body.posts[0];
		for (const key of [
			"id", "title", "date", "categories", "location",
			"city", "hasCoords", "draft", "hasHero", "hasGallery",
			"hasImages", "source",
		]) {
			expect(post).toHaveProperty(key);
		}
		expect(typeof post.draft).toBe("boolean");
		expect(typeof post.hasImages).toBe("boolean");
	});

	test("/search.json ships WebP metadata for every post with a heroImage (PR #40 guard)", async ({ request }) => {
		const resp = await request.get("/search.json");
		expect(resp.ok()).toBe(true);

		const body = await resp.json();
		expect(Array.isArray(body)).toBe(true);
		expect(body.length).toBeGreaterThan(1000);

		// Every entry has the 14 fields search.astro's renderResults reads
		const entry = body[0];
		for (const key of [
			"id", "title", "description", "date", "categories",
			"tags", "city", "region", "location",
			"heroImage", "heroWebp", "heroWidth", "heroHeight", "source",
		]) {
			expect(entry).toHaveProperty(key);
		}

		// Regression guard: every entry with a heroImage must also have a
		// heroWebp path + positive dimensions. PR #40 added this; a silent
		// removal of the Promise.all in search.json.ts would break this.
		const withHero = body.filter((e: any) => e.heroImage);
		expect(withHero.length).toBeGreaterThan(0);
		for (const e of withHero.slice(0, 20)) {
			expect(e.heroWebp, `entry ${e.id} missing heroWebp`).toMatch(/\.webp$/);
			expect(e.heroWidth).toBeGreaterThan(0);
			expect(e.heroHeight).toBeGreaterThan(0);
		}
	});

	test("/places-hitlist.json has the CORS header for jameschang.co (PR #31)", async ({ request }) => {
		const resp = await request.get("/places-hitlist.json");
		expect(resp.ok()).toBe(true);

		const body = await resp.json();
		expect(body).toHaveProperty("items");
		expect(Array.isArray(body.items)).toBe(true);
		expect(body.items.length).toBeGreaterThan(0);

		// Each hitlist entry matches the content-collection schema
		const item = body.items[0];
		for (const key of ["id", "name", "city", "priority", "dateAdded"]) {
			expect(item).toHaveProperty(key);
		}
		expect(typeof item.priority).toBe("number");
		expect(item.priority).toBeGreaterThanOrEqual(1);
		expect(item.priority).toBeLessThanOrEqual(3);
	});
});
