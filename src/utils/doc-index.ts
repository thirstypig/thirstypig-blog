/**
 * Pure helpers for the docs board index.
 *
 * Kept dependency-free and side-effect-free so they can be unit tested without
 * touching the filesystem — the same split as `data-quality.ts` and
 * `image-validation.ts`. The filesystem walk lives in
 * `src/pages/docs-admin.json.ts`; the decisions live here.
 */

export interface DocRecord {
	id: string | null;
	type: string;
	status: string;
	title: string;
	path: string;
	tags: string[];
	links: string[];
	owner: string | null;
	updated: string | null;
	/** PRDs only: whether the feature actually shipped. */
	delivery?: "shipped" | "planned" | null;
	/** Set when the file's frontmatter could not be parsed. */
	error?: string | null;
	/** True when the file has no frontmatter at all — indexed, but flagged. */
	unindexed?: boolean;
	section: SectionId;
}

export type SectionId =
	| "product"
	| "marketing"
	| "engineering"
	| "security"
	| "operations"
	| "prompts"
	| "troubleshooting"
	| "foundations"
	| "notes"
	| "needs-frontmatter";

export interface SectionMeta {
	id: SectionId;
	label: string;
	emoji: string;
	/** One-line purpose blurb rendered under the section header. */
	blurb: string;
}

/**
 * Sections are the QUESTION a reader is asking, not the folder a file sits in.
 * Order is most-referenced first; foundations near the bottom.
 */
export const SECTIONS: SectionMeta[] = [
	{ id: "product", label: "Product", emoji: "🎯", blurb: "What we're building, and why it's worth building." },
	{ id: "engineering", label: "Engineering", emoji: "⚙️", blurb: "How it's actually put together — architecture, decisions, APIs, tests." },
	{ id: "security", label: "Security", emoji: "🔐", blurb: "Posture, ranked open risks, and the gaps we're knowingly carrying." },
	{ id: "operations", label: "Operations", emoji: "📊", blurb: "Running it: live metrics, costs, system status, and the runbook." },
	{ id: "troubleshooting", label: "Troubleshooting", emoji: "🔧", blurb: "Problems already solved. Check here before debugging from scratch." },
	{ id: "marketing", label: "Marketing", emoji: "📣", blurb: "Market, pricing, acquisition, retention — one doc each, never a monolith." },
	{ id: "prompts", label: "Prompt library", emoji: "💬", blurb: "Reusable prompts and the context they expect." },
	{ id: "foundations", label: "Foundations", emoji: "📚", blurb: "Glossary, conventions, guides — the decoder for everything above." },
	{ id: "notes", label: "Notes", emoji: "📝", blurb: "Personal scratchpad. No structure expected." },
	{ id: "needs-frontmatter", label: "Needs frontmatter", emoji: "⚠️", blurb: "Real docs with no frontmatter — invisible to search and filtering until fixed." },
];

/** type → section. The primary routing rule. */
const TYPE_SECTION: Record<string, SectionId> = {
	prd: "product",
	"launch-spec": "product",
	"intake-rules": "product",
	roadmap: "product",
	todos: "product",
	plan: "product",

	adr: "engineering",
	"tech-spec": "engineering",
	"api-docs": "engineering",
	"decision-log": "engineering",
	testing: "engineering",
	"component-lib": "engineering",

	privacy: "security",
	risk: "security",

	stats: "operations",
	costs: "operations",
	status: "operations",
	runbook: "operations",
	changelog: "operations",
	experiment: "operations",

	solution: "troubleshooting",

	glossary: "foundations",
	guide: "foundations",
	brainstorm: "foundations",
	audit: "foundations",

	note: "notes",
	prompt: "prompts",
};

/**
 * Small path→section override map for exceptions where the type is right but
 * the intent differs. Longest matching prefix wins.
 */
const PATH_OVERRIDES: Array<[string, SectionId]> = [
	["docs/solutions/", "troubleshooting"],
	["docs/brainstorms/", "foundations"],
	["docs/operator/", "troubleshooting"],
	["docs/notes/", "notes"],
	["docs/prompts/", "prompts"],
];

export function sectionFor(type: string, path: string, hasFrontmatter = true): SectionId {
	if (!hasFrontmatter) return "needs-frontmatter";
	const norm = path.replace(/\\/g, "/");
	let best: SectionId | null = null;
	let bestLen = -1;
	for (const [prefix, section] of PATH_OVERRIDES) {
		if (norm.startsWith(prefix) && prefix.length > bestLen) {
			best = section;
			bestLen = prefix.length;
		}
	}
	if (best) return best;
	return TYPE_SECTION[type] ?? "foundations";
}

/**
 * Remove fenced code blocks before any content matching.
 *
 * This is not optional. `docs/testing.md` and `README.md` both contain bash
 * blocks whose comment lines start with "# ", e.g.
 *     # Typecheck everything (src/, tina/, scripts/*.mjs)
 * Without stripping, that becomes the document title.
 *
 * Handles ``` and ~~~ fences, and tolerates an unclosed final fence by
 * dropping everything after it (safer than treating the rest as prose).
 */
export function stripCodeFences(raw: string): string {
	return raw
		.replace(/^[ \t]*```[\s\S]*?^[ \t]*```[ \t]*$/gm, "")
		.replace(/^[ \t]*~~~[\s\S]*?^[ \t]*~~~[ \t]*$/gm, "")
		.replace(/^[ \t]*(```|~~~)[\s\S]*$/m, "");
}

/** Turn a filename into a readable fallback title. */
export function tidyFilename(path: string): string {
	const base = (path.split("/").pop() ?? path).replace(/\.md$/, "");
	const withoutId = base.replace(/^((PRD|ADR|DOC|RISK|EXP)-\d+)[-_]?/i, "");
	// A filename that is ONLY an ID (e.g. "ADR-001.md") strips to empty. Return it
	// verbatim rather than de-hyphenating it into "ADR 001", which reads as broken.
	if (!withoutId.trim()) return base;
	const words = withoutId.replace(/[-_]+/g, " ").trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Title = first H1 in the body, with fences stripped first.
 * Falls back to a tidied filename when there is no H1.
 */
export function extractTitle(body: string, path: string): string {
	const cleaned = stripCodeFences(body);
	for (const line of cleaned.split("\n")) {
		const m = line.match(/^#\s+(.+?)\s*$/);
		if (m && m[1].trim()) return m[1].trim();
	}
	return tidyFilename(path);
}

/** Split leading frontmatter from body. Returns null frontmatter when absent. */
export function splitFrontmatter(raw: string): { frontmatter: string | null; body: string } {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
	if (!m) return { frontmatter: null, body: raw };
	return { frontmatter: m[1], body: raw.slice(m[0].length) };
}

/** Files that must never be indexed, regardless of content. */
export function isExcluded(path: string): boolean {
	const norm = path.replace(/\\/g, "/");
	if (norm.includes("/_templates/")) return true;
	if (norm.includes("/node_modules/")) return true;
	if (norm.split("/").some((seg) => seg.startsWith(".") && seg !== "." && seg !== "..")) return true;
	return !norm.endsWith(".md");
}

/** Group records into ordered, non-empty sections. */
export function groupBySection(docs: DocRecord[]): Array<{ meta: SectionMeta; docs: DocRecord[] }> {
	return SECTIONS.map((meta) => ({
		meta,
		docs: docs.filter((d) => d.section === meta.id),
	})).filter((g) => g.docs.length > 0);
}

/** Case-insensitive match across title, id, and path. */
export function matchesQuery(doc: DocRecord, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) return true;
	return (
		doc.title.toLowerCase().includes(q) ||
		(doc.id ?? "").toLowerCase().includes(q) ||
		doc.path.toLowerCase().includes(q) ||
		doc.tags.some((t) => t.toLowerCase().includes(q))
	);
}
