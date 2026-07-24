import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import yaml from "js-yaml";

/**
 * Two distinct things are guarded here.
 *
 * 1. THE js-yaml PARSER CONTRACT.
 *    Four consumers depend on js-yaml's YAML 1.1 semantics: this validator,
 *    src/pages/data-quality.json.ts, src/pages/docs-admin.json.ts, and Astro's
 *    own file() content loader. Nothing asserted that contract until now — which
 *    is exactly why `npm install js-yaml` silently resolving v5.x (YAML 1.2)
 *    passed typecheck, 172 vitest tests, 178 pytest tests, the pre-commit hook,
 *    and CI on 2026-07-24.
 *    Write-up: docs/solutions/build-errors/js-yaml-v5-major-bump-splits-parser-semantics.md
 *
 * 2. validate_hitlist.mjs ITSELF.
 *    It gates `npm run build` (and therefore Vercel) but had no test. It exports
 *    nothing and calls process.exit, so it's driven as a subprocess via its
 *    argv[2] file argument.
 *    Note: `validate:hitlist` is NOT in CI's unit job — .github/workflows/test.yml
 *    runs `npm run test:unit` only. These tests put the validator in front of CI
 *    for the first time.
 */

const REPO_ROOT = join(import.meta.dirname, "..");
const VALIDATOR = join(REPO_ROOT, "scripts", "validate_hitlist.mjs");

let fixtureRoot;

const writeFixture = (name, body) => {
	const p = join(fixtureRoot, name);
	writeFileSync(p, body, "utf8");
	return p;
};

/** Run the real validator against a fixture. Returns exit code + streams. */
function runValidator(fixturePath) {
	try {
		const stdout = execFileSync("node", [VALIDATOR, fixturePath], {
			cwd: REPO_ROOT,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return { code: 0, stdout, stderr: "" };
	} catch (e) {
		return { code: e.status ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
	}
}

const VALID_ENTRY = `- id: test-venue
  name: Test Venue
  city: Los Angeles
  date_added: '2026-04-15'
  priority: 1
  neighborhood: Downtown
  notes: A note
  links:
    website: https://example.com
    menu: null
  tags:
    - ramen
`;

beforeAll(() => {
	fixtureRoot = join(tmpdir(), `tp-hitlist-${process.pid}-${Date.now()}`);
	mkdirSync(fixtureRoot, { recursive: true });
});

afterAll(() => {
	rmSync(fixtureRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------

describe("js-yaml parser contract (YAML 1.1)", () => {
	/**
	 * THE tripwire. Under js-yaml v4 a bare ISO date is a !!timestamp -> Date.
	 * Under v5 (YAML 1.2) it stays a string. Astro's loader expects the v4
	 * behaviour, so a silent major bump desynchronises this repo from itself.
	 */
	it("parses a bare ISO date as a Date object, not a string", () => {
		const parsed = yaml.load("date_added: 2026-04-15");
		expect(parsed.date_added).toBeInstanceOf(Date);
	});

	it("keeps a quoted date as a string", () => {
		const parsed = yaml.load("date_added: '2026-04-15'");
		expect(typeof parsed.date_added).toBe("string");
		expect(parsed.date_added).toBe("2026-04-15");
	});

	// 19 real posts carry this space-separated form, which is a valid YAML 1.1
	// !!timestamp but NOT valid ISO-8601 — so it round-trips differently.
	it("parses a space-separated timestamp as a Date", () => {
		const parsed = yaml.load("pubDate: 2025-08-05 00:00:00+00:00");
		expect(parsed.pubDate).toBeInstanceOf(Date);
	});

	// This strictness is what caught 33 silent cid: duplicates in venues.yaml
	// that PyYAML had been quietly merging.
	it("rejects duplicate mapping keys", () => {
		expect(() => yaml.load("a: 1\na: 2")).toThrow();
	});

	// load() must stay the SAFE schema — no arbitrary type construction.
	it("rejects type-constructing tags", () => {
		expect(() => yaml.load('fn: !!js/function "function(){return 1}"')).toThrow();
	});
});

describe("validate_hitlist.mjs", () => {
	it("accepts a well-formed entry and reports the count", () => {
		const f = writeFixture("valid.yaml", VALID_ENTRY);
		const { code, stdout } = runValidator(f);
		expect(code).toBe(0);
		expect(stdout).toContain("Hit List YAML valid (1 entries)");
	});

	/**
	 * The motivating bug. An unquoted date_added parses to a Date, which fails
	 * Astro's `date_added: z.string()` at build. The validator exists to catch
	 * this locally instead of at the content-collection step.
	 *
	 * If js-yaml is ever bumped to v5, date_added becomes a string, the
	 * validator passes, and THIS TEST FAILS — which is the point. A red test
	 * here means the parser changed underneath the repo.
	 */
	it("rejects an unquoted date_added (parses as Date, not string)", () => {
		const f = writeFixture("bare-date.yaml", VALID_ENTRY.replace("'2026-04-15'", "2026-04-15"));
		const { code, stderr } = runValidator(f);
		expect(code).toBe(1);
		expect(stderr).toContain("date_added");
		expect(stderr).toContain("got Date");
	});

	it("rejects duplicate ids", () => {
		const f = writeFixture("dupe-id.yaml", VALID_ENTRY + VALID_ENTRY);
		const { code, stderr } = runValidator(f);
		expect(code).toBe(1);
		expect(stderr).toContain("duplicate id");
	});

	it("rejects a priority outside 1–3", () => {
		const f = writeFixture("bad-priority.yaml", VALID_ENTRY.replace("priority: 1", "priority: 7"));
		const { code, stderr } = runValidator(f);
		expect(code).toBe(1);
		expect(stderr).toContain("priority must be an integer 1–3");
	});

	it("rejects a missing required field", () => {
		const f = writeFixture("no-city.yaml", VALID_ENTRY.replace("  city: Los Angeles\n", ""));
		const { code, stderr } = runValidator(f);
		expect(code).toBe(1);
		expect(stderr).toContain("city must be a non-empty string");
	});

	it("rejects a top level that is not a list", () => {
		const f = writeFixture("not-a-list.yaml", "id: test\nname: Test\n");
		const { code, stderr } = runValidator(f);
		expect(code).toBe(1);
		expect(stderr).toContain("top-level must be a list");
	});

	it("exits non-zero on malformed YAML rather than throwing", () => {
		const f = writeFixture("malformed.yaml", "- id: test\n  name: [unclosed\n");
		const { code, stderr } = runValidator(f);
		expect(code).toBe(1);
		expect(stderr).toContain("YAML parse failed");
	});

	it("reports every error at once, not just the first", () => {
		const broken = VALID_ENTRY.replace("'2026-04-15'", "2026-04-15").replace("priority: 1", "priority: 9");
		const f = writeFixture("multi-error.yaml", broken);
		const { code, stderr } = runValidator(f);
		expect(code).toBe(1);
		expect(stderr).toContain("2 validation error(s)");
	});
});

describe("the real places-hitlist.yaml", () => {
	// Guards the committed data, not just the validator logic. This is the file
	// Astro actually loads, so it must satisfy the same contract.
	it("passes validation as committed", () => {
		const { code, stdout } = runValidator(join(REPO_ROOT, "src/data/places-hitlist.yaml"));
		expect(code).toBe(0);
		expect(stdout).toContain("Hit List YAML valid");
	});

	it("has every date_added quoted (string after a js-yaml parse)", () => {
		const data = yaml.load(readFileSync(join(REPO_ROOT, "src/data/places-hitlist.yaml"), "utf8"));
		expect(Array.isArray(data)).toBe(true);
		expect(data.length).toBeGreaterThan(0);
		for (const entry of data) {
			expect(typeof entry.date_added, `entry ${entry.id} date_added`).toBe("string");
		}
	});
});
