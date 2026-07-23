import type { APIRoute } from "astro";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import yaml from "js-yaml";
import {
	SECTIONS,
	sectionFor,
	extractTitle,
	splitFrontmatter,
	isExcluded,
	type DocRecord,
} from "../utils/doc-index";

/**
 * Docs index served to the /admin → Docs board.
 *
 * Auto-walks docs/ at build time — nothing needs a manual whitelist, so a new
 * doc appears on the board the moment it's committed. The board reads THIS,
 * never filenames: id/type/status come from frontmatter, the title comes from
 * the first H1 with code fences stripped first.
 *
 * Drift invariants:
 * - A doc with unparseable frontmatter is INCLUDED, flagged with `error`, so a
 *   broken file is visible rather than silently missing.
 * - A doc with no frontmatter is INCLUDED in the "needs-frontmatter" section for
 *   the same reason. Templates and dot-paths are excluded outright.
 */

const ROOT = process.cwd();
const DOCS = join(ROOT, "docs");

/** Files git ignores. Falls back to an empty set if git isn't available. */
function gitIgnoredSet(): Set<string> {
	try {
		const out = execFileSync("git", ["ls-files", "-z", "--others", "--ignored", "--exclude-standard", "docs"], {
			cwd: ROOT,
			encoding: "utf8",
			maxBuffer: 16 * 1024 * 1024,
		});
		return new Set(out.split("\0").filter(Boolean));
	} catch {
		return new Set();
	}
}

function walk(dir: string, acc: string[] = []): string[] {
	if (!existsSync(dir)) return acc;
	for (const name of readdirSync(dir)) {
		if (name.startsWith(".")) continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, acc);
		else acc.push(full);
	}
	return acc;
}

const str = (v: unknown): string | null =>
	typeof v === "string" ? v : v == null ? null : String(v);

const arr = (v: unknown): string[] =>
	Array.isArray(v) ? v.map((x) => String(x)) : v == null ? [] : [String(v)];

export const GET: APIRoute = async () => {
	const ignored = gitIgnoredSet();
	const files = walk(DOCS)
		.map((f) => relative(ROOT, f).replace(/\\/g, "/"))
		.filter((p) => !isExcluded(p))
		.filter((p) => !ignored.has(p))
		.sort();

	const docs: Array<DocRecord & { body: string }> = [];

	for (const path of files) {
		const raw = readFileSync(join(ROOT, path), "utf8");
		const { frontmatter, body } = splitFrontmatter(raw);
		const title = extractTitle(body, path);

		if (frontmatter === null) {
			docs.push({
				id: null, type: "unknown", status: "unknown", title, path,
				tags: [], links: [], owner: null, updated: null,
				unindexed: true, error: null,
				section: sectionFor("unknown", path, false),
				body,
			});
			continue;
		}

		let fm: Record<string, unknown> = {};
		let error: string | null = null;
		try {
			// js-yaml v4 `load()` IS the safe API — DEFAULT_SCHEMA rejects type-
			// constructing tags (verified: `!!js/function` throws "unknown tag").
			// `safeLoad` was deprecated in v4 for exactly this reason. Do not
			// "fix" this to safeLoad; that advice is about Python's PyYAML.
			//
			// NOTE: js-yaml is currently a TRANSITIVE dep (via Astro, which uses it
			// for frontmatter). It is not declared in package.json. If an Astro
			// upgrade ever drops it, this build breaks — declare it explicitly then.
			fm = (yaml.load(frontmatter) as Record<string, unknown>) ?? {};
		} catch (e) {
			error = e instanceof Error ? e.message.split("\n")[0] : "unparseable frontmatter";
		}

		const type = str(fm.type) ?? "unknown";
		const deliveryRaw = str(fm.delivery);
		docs.push({
			id: str(fm.id),
			type,
			status: str(fm.status) ?? "unknown",
			title,
			path,
			tags: arr(fm.tags),
			links: arr(fm.links),
			owner: str(fm.owner),
			// `updated` may deserialize to a Date if a doc forgot to quote it.
			updated: fm.updated instanceof Date
				? fm.updated.toISOString().slice(0, 10)
				: str(fm.updated),
			delivery: deliveryRaw === "shipped" || deliveryRaw === "planned" ? deliveryRaw : null,
			error,
			unindexed: false,
			section: sectionFor(type, path, true),
			body,
		});
	}

	const byId = new Map(docs.filter((d) => d.id).map((d) => [d.id as string, d.path]));
	const summary = {
		total: docs.length,
		indexed: docs.filter((d) => !d.unindexed).length,
		needsFrontmatter: docs.filter((d) => d.unindexed).length,
		parseErrors: docs.filter((d) => d.error).length,
		danglingLinks: docs.flatMap((d) =>
			d.links.filter((l) => !byId.has(l)).map((l) => ({ from: d.id ?? d.path, to: l }))
		),
		generatedAt: new Date().toISOString().slice(0, 10),
	};

	return new Response(JSON.stringify({ sections: SECTIONS, docs, summary }), {
		headers: { "Content-Type": "application/json" },
	});
};
