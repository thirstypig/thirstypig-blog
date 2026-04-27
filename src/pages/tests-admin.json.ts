import type { APIRoute } from "astro";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { glob } from "node:fs/promises";

/**
 * Test inventory served to the Testing admin dashboard.
 *
 * Phase 2 upgrade: assertion counts are auto-derived at build time by
 * scanning the actual test files; aggregate latest-CI status is fetched
 * from the GitHub Actions API. Only the `covers` description remains
 * hand-maintained per file (it's prose; worth writing by hand).
 *
 * Drift invariants this endpoint enforces:
 * - Every hand-maintained metadata entry must correspond to a real file
 *   (missing file → status: "missing")
 * - Every scanned test file should have a metadata entry
 *   (undocumented file → covers: "(undocumented — add entry in tests-admin.json.ts)")
 * - Assertion counts come from the files themselves, not memory of them
 */

type TestKind = "unit" | "e2e";
type TestStatus = "passing" | "failing" | "untested" | "missing";

interface TestEntry {
	file: string;
	kind: TestKind;
	covers: string;
	assertions: number;
	status: TestStatus;
}

// Hand-maintained per-file descriptions. Keep the narrative accurate; this
// is the part that tells future readers what each file guards against.
const metadata: Record<string, { kind: TestKind; covers: string }> = {
	"src/utils.test.ts": {
		kind: "unit",
		covers: "slugify() — lowercase, diacritic strip, non-alphanumeric removal, hyphen collapse, CJK limitation",
	},
	"src/plugins/remark-image-optimize.test.mjs": {
		kind: "unit",
		covers: "buildPictureHtml() — webp-with-source, bare <img> fallback, missing dimensions, HTML escaping, empty alt",
	},
	"src/plugins/remark-instagram-mentions.test.mjs": {
		kind: "unit",
		covers: "@mention plugin — splits text/link/text, hProperties (target/rel/class), start/end/middle positioning, multiple @handles, email-boundary rejection, dot/underscore handles, skip-override (the/was/a/etc), mixed skip+real, case preservation",
	},
	"src/utils/image-dimensions.test.mjs": {
		kind: "unit",
		covers: "webpSibling() path transforms + getImageInfo integration (file-missing fallback, real dimensions via sharp, webp sibling detection, portrait orientation, non-absolute path rejection) using temp fixtures with {cache: false}",
	},
	"src/utils/pagination.test.ts": {
		kind: "unit",
		covers: "paginationUrls() — page 1 has next-no-prev, last page has prev-no-next, middle has both, single-page has neither, alt baseUrl, off-by-one regression guard at page=1 / total=1",
	},
	"src/utils/location-links.test.ts": {
		kind: "unit",
		covers: "Location link helpers — venue/address/city URL construction, fallback ordering, query encoding, edge cases (empty fields, special characters)",
	},
	"src/utils/regions.test.ts": {
		kind: "unit",
		covers: "aggregateRegions() — homepage city tile aggregation. Posts without `region` field land in elsewhereCount (regression guard against phantom undefined-keyed top region), counts ranked desc, topN respected, sum invariant: top counts + elsewhere = posts.length, empty-list safe",
	},
	"scripts/test_sync_hitlist.py": {
		kind: "unit",
		covers: "Hit List vault parser — header parsing with commas in names, metadata keys, tag normalization, priority bounds, id slug + override, unknown-key drop, CJK slug handling",
	},
	"scripts/test_post_utils.py": {
		kind: "unit",
		covers: "Frontmatter parser + dead-URL helpers — crash-free on malformed frontmatter, stray --- in values handled, dead-domain list structure invariants",
	},
	"scripts/test_seed_hitlist_vault.py": {
		kind: "unit",
		covers: "Hit List vault seeder — entry_to_md field formatting, optional-field omission, id override always emitted, integration round-trip (real YAML → md → parsed back) preserves ids/names/cities/priorities/links/tags",
	},
	"scripts/test_strip_dead_images.py": {
		kind: "unit",
		covers: "Dead-image cleaner — markdown images, empty-alt Blogger [](), angle-bracket autolinks, bare wp-content/blogspot URLs (apex + subdomain), HTML <img> tags (case-insensitive), blank-line collapse. Caught a regex bug (+ instead of * before apex domain) during writing.",
	},
	"scripts/test_mark_imageless_drafts.py": {
		kind: "unit",
		covers: "Imageless-post detector — image_exists (empty/None, dead URLs, externals, data URLs, live local, missing local) + get_image_refs (heroImage, images array, inline markdown, HTML img, missing fields, None entries)",
	},
	"tests/e2e/homepage.spec.ts": {
		kind: "e2e",
		covers: "Homepage — hero renders, aria-current on active nav, skip link works (WebKit uses .focus() due to macOS Tab-skip-links default), theme toggle persists across navigation",
	},
	"tests/e2e/hitlist.spec.ts": {
		kind: "e2e",
		covers: "Hit List — cards render from JSON, city filter narrows, tag filter narrows, clear-filters resets, active-nav aria-current",
	},
	"tests/e2e/search.spec.ts": {
		kind: "e2e",
		covers: "Search — initial state + total count, debounced typing filters, results emit <picture> with WebP source, gibberish shows no-results state",
	},
	"tests/e2e/map.spec.ts": {
		kind: "e2e",
		covers: "Map — heading + legend render, Leaflet initializes and paints markers, marker count populates from /map.json",
	},
	"tests/e2e/post-page.spec.ts": {
		kind: "e2e",
		covers: "Post page regression — h1 singleton + no heading-level skips, hero <picture> with WebP + dimensions, body images <picture>/lazy/dimensioned, LocationCard renders, no unexpected console errors, skip link jumps to main (WebKit uses .focus())",
	},
	"tests/e2e/closed-venues.spec.ts": {
		kind: "e2e",
		covers: "Closed venue rendering — dynamic fixture picks a closed post from /search.json, asserts CLOSED badge + grayscale class in results. Currently skips gracefully because all 37 closed-venue posts are marked draft:true, excluding them from the index.",
	},
	"tests/e2e/archive.spec.ts": {
		kind: "e2e",
		covers: "/archive/* — index lists years, year page (2022) shows month-with-posts links, year-month page (2022/06) lists post links, Archive nav gets aria-current on archive pages",
	},
	"tests/e2e/categories.spec.ts": {
		kind: "e2e",
		covers: "/categories/* — index renders with >10 category links, individual category (japanese) shows heading + post grid, Categories nav gets aria-current",
	},
	"tests/e2e/pagination.spec.ts": {
		kind: "e2e",
		covers: "/posts/N/ — post grid renders, Next link in Pagination nav navigates to page 2, Previous is disabled on page 1 (scoped to nav aria-label=Pagination to avoid PostCard matches)",
	},
	"tests/e2e/static-pages.spec.ts": {
		kind: "e2e",
		covers: "/about, /best-of, /changelog — each renders its heading + stable content markers; About nav link gets aria-current",
	},
	"tests/e2e/feeds.spec.ts": {
		kind: "e2e",
		covers: "/rss.xml, /sitemap-index.xml, /robots.txt — each returns 200 with XML/text content-type, RSS has channel+title, sitemap references downstream file, robots disallows admin paths",
	},
	"tests/e2e/endpoints.spec.ts": {
		kind: "e2e",
		covers: "Build-time JSON schema + self-consistency — /tests-admin.json (counters match entries; no dashboard lies), /stats.json (StatsDashboard keys + image-stats invariant), /posts-admin.json (12-field PostManager shape), /search.json (WebP metadata for every heroImage — PR #40 guard), /places-hitlist.json (priority 1-3)",
	},
};

// --- Auto-count assertions per test file -----------------------------------

async function discoverTestFiles(): Promise<string[]> {
	const patterns = [
		"src/**/*.test.ts",
		"src/**/*.test.mjs",
		"scripts/test_*.py",
		"tests/e2e/*.spec.ts",
	];
	const files: string[] = [];
	for (const pattern of patterns) {
		for await (const f of glob(pattern)) {
			files.push(f as string);
		}
	}
	return files.sort();
}

function countAssertions(filepath: string): number {
	let content: string;
	try {
		content = readFileSync(filepath, "utf-8");
	} catch {
		return 0;
	}

	if (filepath.endsWith(".py")) {
		// pytest: count `def test_...` definitions (including indented ones in classes)
		return (content.match(/^\s*def test_/gm) || []).length;
	}

	// Vitest / Playwright: count top-level `it(...)` and `test(...)` calls.
	// Excludes `test.describe`, `test.skip`, `test.only`, `expect`, etc. by
	// requiring the identifier to be immediately followed by `(`.
	return (content.match(/^\s*(it|test)\(/gm) || []).length;
}

// --- Latest CI run status (best-effort; degrades gracefully) --------------

interface LatestRun {
	status: "passing" | "failing" | "untested";
	conclusion: string | null;
	runNumber: number | null;
	url: string | null;
	finishedAt: string | null;
}

async function getLatestTestRun(): Promise<LatestRun> {
	const fallback: LatestRun = {
		status: "untested",
		conclusion: null,
		runNumber: null,
		url: null,
		finishedAt: null,
	};

	try {
		const resp = await fetch(
			"https://api.github.com/repos/thirstypig/thirstypig-blog/actions/workflows/test.yml/runs?branch=main&per_page=1",
			{ headers: { Accept: "application/vnd.github+json", "User-Agent": "thirstypig-build" } },
		);
		if (!resp.ok) return fallback;
		const data = await resp.json();
		const run = data.workflow_runs?.[0];
		if (!run) return fallback;

		return {
			status:
				run.conclusion === "success" ? "passing" :
				run.conclusion === "failure" ? "failing" : "untested",
			conclusion: run.conclusion,
			runNumber: run.run_number,
			url: run.html_url,
			finishedAt: run.updated_at,
		};
	} catch {
		return fallback;
	}
}

// --- Assemble the endpoint response ----------------------------------------

export const GET: APIRoute = async () => {
	const discoveredFiles = await discoverTestFiles();
	const documentedFiles = new Set(Object.keys(metadata));
	const discoveredSet = new Set(discoveredFiles);

	const entries: TestEntry[] = [];

	// Every documented file either has a real asset or is marked missing
	for (const [file, meta] of Object.entries(metadata)) {
		if (!existsSync(join(process.cwd(), file))) {
			entries.push({ file, kind: meta.kind, covers: meta.covers, assertions: 0, status: "missing" });
			continue;
		}
		const assertions = countAssertions(file);
		entries.push({ file, kind: meta.kind, covers: meta.covers, assertions, status: "passing" });
	}

	// Any discovered file without documentation surfaces as (undocumented)
	for (const file of discoveredFiles) {
		if (documentedFiles.has(file)) continue;
		const kind: TestKind = file.startsWith("tests/e2e") ? "e2e" : "unit";
		entries.push({
			file,
			kind,
			covers: "(undocumented — add entry to metadata in tests-admin.json.ts)",
			assertions: countAssertions(file),
			status: "untested",
		});
	}

	entries.sort((a, b) => a.file.localeCompare(b.file));

	const latestRun = await getLatestTestRun();

	// Apply aggregate CI status to every entry that's currently marked "passing"
	// — if the latest run failed, flip them to "failing" so the dashboard
	// reflects reality. Individual-entry tracking would require artifact
	// parsing; this aggregate view is the meaningful signal for a personal
	// project.
	if (latestRun.status === "failing") {
		for (const entry of entries) {
			if (entry.status === "passing") entry.status = "failing";
		}
	}

	const body = {
		generatedAt: new Date().toISOString(),
		tests: entries,
		summary: {
			total: entries.length,
			unit: entries.filter(e => e.kind === "unit").length,
			e2e: entries.filter(e => e.kind === "e2e").length,
			totalAssertions: entries.reduce((sum, e) => sum + e.assertions, 0),
			missing: entries.filter(e => e.status === "missing").length,
			undocumented: entries.filter(e => e.covers.startsWith("(undocumented")).length,
		},
		latestRun,
	};

	return new Response(JSON.stringify(body), {
		headers: { "Content-Type": "application/json" },
	});
};
