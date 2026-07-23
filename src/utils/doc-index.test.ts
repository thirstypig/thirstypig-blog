import { describe, it, expect } from "vitest";
import {
	stripCodeFences,
	extractTitle,
	tidyFilename,
	sectionFor,
	splitFrontmatter,
	isExcluded,
	groupBySection,
	matchesQuery,
	type DocRecord,
} from "./doc-index";

const doc = (over: Partial<DocRecord> = {}): DocRecord => ({
	id: "DOC-001", type: "guide", status: "active", title: "T", path: "docs/a.md",
	tags: [], links: [], owner: "james", updated: "2026-07-23", section: "foundations", ...over,
});

describe("stripCodeFences", () => {
	it("removes a fenced block entirely", () => {
		expect(stripCodeFences("a\n```\n# not a title\n```\nb")).not.toContain("not a title");
	});

	it("removes tilde fences too", () => {
		expect(stripCodeFences("a\n~~~\n# nope\n~~~\nb")).not.toContain("nope");
	});

	it("drops everything after an unclosed fence", () => {
		const out = stripCodeFences("intro\n```bash\n# dangling\nmore");
		expect(out).toContain("intro");
		expect(out).not.toContain("dangling");
	});

	it("leaves prose untouched", () => {
		expect(stripCodeFences("# Real\ntext")).toBe("# Real\ntext");
	});
});

describe("extractTitle — the code-fence guard", () => {
	it("takes the first H1", () => {
		expect(extractTitle("# Testing\n\nbody", "docs/testing.md")).toBe("Testing");
	});

	// The exact shape of docs/testing.md and README.md, which both contain bash
	// blocks whose comments start with "# ". This is the regression that matters.
	it("does NOT take a # comment inside a bash block", () => {
		const body = [
			"Intro prose with no heading.",
			"",
			"```bash",
			"# Typecheck everything (src/, tina/, scripts/*.mjs) — ~14s",
			"npm run typecheck",
			"```",
		].join("\n");
		expect(extractTitle(body, "docs/testing.md")).toBe("Testing");
	});

	it("prefers a real H1 over a later fenced comment", () => {
		const body = "# Real Title\n\n```bash\n# Fake Title\n```";
		expect(extractTitle(body, "docs/x.md")).toBe("Real Title");
	});

	it("ignores H2 and deeper", () => {
		expect(extractTitle("## Sub\n### Deeper", "docs/my-doc.md")).toBe("My doc");
	});

	it("falls back to a tidy filename when there is no H1", () => {
		expect(extractTitle("no heading", "docs/product/launch-spec.md")).toBe("Launch spec");
	});
});

describe("tidyFilename", () => {
	it("strips an ID prefix", () => {
		expect(tidyFilename("docs/product/prds/PRD-001-venue-tags.md")).toBe("Venue tags");
	});
	it("handles plain names", () => {
		expect(tidyFilename("docs/risks-register.md")).toBe("Risks register");
	});
	it("does not blank out a file that is only an ID", () => {
		expect(tidyFilename("docs/ADR-001.md")).toBe("ADR-001");
	});
});

describe("sectionFor", () => {
	it("routes by type", () => {
		expect(sectionFor("prd", "docs/product/prds/x.md")).toBe("product");
		expect(sectionFor("adr", "docs/engineering/adrs/x.md")).toBe("engineering");
		expect(sectionFor("risk", "docs/under-the-hood/x.md")).toBe("security");
		expect(sectionFor("privacy", "docs/under-the-hood/x.md")).toBe("security");
		expect(sectionFor("runbook", "docs/under-the-hood/x.md")).toBe("operations");
		expect(sectionFor("glossary", "docs/product/x.md")).toBe("foundations");
	});

	it("path override beats type", () => {
		// A solution doc typed as a guide still belongs in troubleshooting.
		expect(sectionFor("guide", "docs/solutions/ui-bugs/x.md")).toBe("troubleshooting");
		expect(sectionFor("guide", "docs/operator/curator-bugs.md")).toBe("troubleshooting");
	});

	it("unknown types land in foundations, not lost", () => {
		expect(sectionFor("wat", "docs/x.md")).toBe("foundations");
	});

	it("no frontmatter routes to needs-frontmatter regardless of path", () => {
		expect(sectionFor("guide", "docs/solutions/x.md", false)).toBe("needs-frontmatter");
	});
});

describe("splitFrontmatter", () => {
	it("splits a normal doc", () => {
		const { frontmatter, body } = splitFrontmatter("---\nid: DOC-1\n---\n# T\n");
		expect(frontmatter).toBe("id: DOC-1");
		expect(body).toBe("# T\n");
	});

	it("returns null when absent", () => {
		expect(splitFrontmatter("# T").frontmatter).toBeNull();
	});

	// A fenced yaml block mid-document must not be mistaken for frontmatter.
	it("only matches frontmatter anchored at the start", () => {
		const raw = "# Title\n\n```yaml\n---\nid: NOPE\n---\n```\n";
		expect(splitFrontmatter(raw).frontmatter).toBeNull();
	});
});

describe("isExcluded", () => {
	it("excludes templates", () => {
		expect(isExcluded("docs/_templates/prd.template.md")).toBe(true);
	});
	it("excludes dotfiles and dot-dirs", () => {
		expect(isExcluded("docs/.obsidian/x.md")).toBe(true);
	});
	it("excludes non-markdown", () => {
		expect(isExcluded("docs/_comments.json")).toBe(true);
	});
	it("includes normal docs", () => {
		expect(isExcluded("docs/product/roadmap.md")).toBe(false);
	});
});

describe("groupBySection", () => {
	it("drops empty sections and preserves order", () => {
		const groups = groupBySection([
			doc({ section: "foundations" }),
			doc({ section: "product" }),
		]);
		expect(groups.map((g) => g.meta.id)).toEqual(["product", "foundations"]);
	});

	it("returns nothing for no docs", () => {
		expect(groupBySection([])).toEqual([]);
	});
});

describe("matchesQuery", () => {
	const d = doc({ title: "Venue tags", id: "PRD-001", path: "docs/product/prds/PRD-001-venue-tags.md", tags: ["venue-tags"] });
	it("matches title case-insensitively", () => expect(matchesQuery(d, "VENUE")).toBe(true));
	it("matches id", () => expect(matchesQuery(d, "prd-001")).toBe(true));
	it("matches path", () => expect(matchesQuery(d, "prds/")).toBe(true));
	it("matches tag", () => expect(matchesQuery(d, "venue-tags")).toBe(true));
	it("empty query matches everything", () => expect(matchesQuery(d, "  ")).toBe(true));
	it("rejects a miss", () => expect(matchesQuery(d, "zzz")).toBe(false));
});
