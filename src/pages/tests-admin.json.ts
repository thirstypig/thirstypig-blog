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
		file: "tests/e2e/homepage.spec.ts",
		kind: "e2e",
		covers: "Homepage — hero renders, aria-current on active nav, skip link works, theme toggle persists across navigation",
		assertions: 4,
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
