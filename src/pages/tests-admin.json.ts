import type { APIRoute } from "astro";

/**
 * Static test inventory served to the Testing admin dashboard.
 *
 * For now this is hand-maintained — when you add or remove a test, update the
 * corresponding entry here so the admin screen stays truthful. Phase 2 will
 * replace this with a CI-artifact-driven source that shows real pass/fail
 * status and timestamps.
 */

type TestKind = "unit" | "e2e";
type TestStatus = "passing" | "failing" | "untested";

interface TestEntry {
	file: string;
	kind: TestKind;
	covers: string;
	assertions: number;
	status: TestStatus;
}

const tests: TestEntry[] = [
	{
		file: "src/utils.test.ts",
		kind: "unit",
		covers: "slugify() — lowercase, diacritic strip, non-alphanumeric removal, hyphen collapse, CJK limitation",
		assertions: 6,
		status: "passing",
	},
	{
		file: "src/plugins/remark-image-optimize.test.mjs",
		kind: "unit",
		covers: "buildPictureHtml() — webp-with-source, bare <img> fallback, missing dimensions, HTML escaping, empty alt",
		assertions: 5,
		status: "passing",
	},
	{
		file: "src/utils/image-dimensions.test.mjs",
		kind: "unit",
		covers: "webpSibling() path transforms + getImageInfo integration (file-missing fallback, real dimensions via sharp, webp sibling detection, portrait orientation, non-absolute path rejection) using temp fixtures with {cache: false}",
		assertions: 13,
		status: "passing",
	},
	{
		file: "scripts/test_sync_hitlist.py",
		kind: "unit",
		covers: "Hit List vault parser — header parsing with commas in names, metadata keys, tag normalization, priority bounds, id slug + override, unknown-key drop, CJK slug handling",
		assertions: 25,
		status: "passing",
	},
	{
		file: "scripts/test_post_utils.py",
		kind: "unit",
		covers: "Frontmatter parser + dead-URL helpers — crash-free on malformed frontmatter, stray --- in values handled, dead-domain list structure invariants",
		assertions: 18,
		status: "passing",
	},
	{
		file: "scripts/test_seed_hitlist_vault.py",
		kind: "unit",
		covers: "Hit List vault seeder — entry_to_md field formatting, optional-field omission, id override always emitted, integration round-trip (real YAML → md → parsed back) preserves ids/names/cities/priorities/links/tags",
		assertions: 14,
		status: "passing",
	},
	{
		file: "tests/e2e/homepage.spec.ts",
		kind: "e2e",
		covers: "Homepage — hero renders, aria-current on active nav, skip link works, theme toggle persists across navigation",
		assertions: 4,
		status: "passing",
	},
	{
		file: "tests/e2e/hitlist.spec.ts",
		kind: "e2e",
		covers: "Hit List — cards render from JSON, city filter narrows, tag filter narrows, clear-filters resets, active-nav aria-current",
		assertions: 5,
		status: "passing",
	},
	{
		file: "tests/e2e/search.spec.ts",
		kind: "e2e",
		covers: "Search — initial state + total count, debounced typing filters, results emit <picture> with WebP source, gibberish shows no-results state",
		assertions: 4,
		status: "passing",
	},
	{
		file: "tests/e2e/map.spec.ts",
		kind: "e2e",
		covers: "Map — heading + legend render, Leaflet initializes and paints markers, marker count populates from /map.json",
		assertions: 3,
		status: "passing",
	},
	{
		file: "tests/e2e/post-page.spec.ts",
		kind: "e2e",
		covers: "Post page regression — h1 singleton + no heading-level skips, hero <picture> with WebP + dimensions, body images <picture>/lazy/dimensioned, LocationCard renders, no unexpected console errors, skip link jumps to main",
		assertions: 7,
		status: "passing",
	},
	{
		file: "tests/e2e/closed-venues.spec.ts",
		kind: "e2e",
		covers: "Closed venue rendering — dynamic fixture picks a closed post from /search.json, asserts CLOSED badge + grayscale class in results. Currently skips gracefully because all 37 closed-venue posts are marked draft:true, excluding them from the index.",
		assertions: 1,
		status: "untested",
	},
	{
		file: "tests/e2e/archive.spec.ts",
		kind: "e2e",
		covers: "/archive/* — index lists years, year page (2022) shows month-with-posts links, year-month page (2022/06) lists post links, Archive nav gets aria-current on archive pages",
		assertions: 4,
		status: "passing",
	},
	{
		file: "tests/e2e/categories.spec.ts",
		kind: "e2e",
		covers: "/categories/* — index renders with >10 category links, individual category (japanese) shows heading + post grid, Categories nav gets aria-current",
		assertions: 3,
		status: "passing",
	},
	{
		file: "tests/e2e/pagination.spec.ts",
		kind: "e2e",
		covers: "/posts/N/ — post grid renders, Next link in Pagination nav navigates to page 2, Previous is disabled on page 1 (scoped to nav aria-label=Pagination to avoid PostCard matches)",
		assertions: 3,
		status: "passing",
	},
	{
		file: "tests/e2e/static-pages.spec.ts",
		kind: "e2e",
		covers: "/about, /best-of, /changelog — each renders its heading + stable content markers; About nav link gets aria-current",
		assertions: 4,
		status: "passing",
	},
	{
		file: "tests/e2e/feeds.spec.ts",
		kind: "e2e",
		covers: "/rss.xml, /sitemap-index.xml, /robots.txt — each returns 200 with XML/text content-type, RSS has channel+title, sitemap references downstream file, robots disallows admin paths",
		assertions: 3,
		status: "passing",
	},
	{
		file: "tests/e2e/endpoints.spec.ts",
		kind: "e2e",
		covers: "Build-time JSON schema + self-consistency — /tests-admin.json (counters match entries; no dashboard lies), /stats.json (StatsDashboard keys + image-stats invariant), /posts-admin.json (12-field PostManager shape), /search.json (WebP metadata for every heroImage — PR #40 guard), /places-hitlist.json (priority 1-3)",
		assertions: 5,
		status: "passing",
	},
];

export const GET: APIRoute = async () => {
	const body = {
		generatedAt: new Date().toISOString(),
		tests,
		summary: {
			total: tests.length,
			unit: tests.filter(t => t.kind === "unit").length,
			e2e: tests.filter(t => t.kind === "e2e").length,
			totalAssertions: tests.reduce((sum, t) => sum + t.assertions, 0),
		},
	};
	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
	});
};
