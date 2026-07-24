import React, { useState, useEffect, useMemo } from "react";
import { renderMarkdown } from "../src/utils/markdown-lite";
import {
	groupBySection,
	matchesQuery,
	type DocRecord,
	type SectionMeta,
} from "../src/utils/doc-index";

export const AdminDocsIcon = () => (
	<span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F4D6;</span>
);

// ---------------------------------------------------------------------------
// Docs board for thirstypig.com.
//
// Renders the repo's markdown docs as a browsable knowledge base. It reads
// /docs-admin.json (built by src/pages/docs-admin.json.ts), which auto-walks
// docs/ at build time — nothing here needs a manual whitelist, so a new doc
// appears the moment it's committed.
//
// The viewer reads METADATA, never filenames: id/type/status come from
// frontmatter, and the title is the first H1 with code fences stripped first.
// Sections are the QUESTION a reader is asking, not the folder a file sits in.
//
// Runs inside its own iframe, so Tailwind is unavailable — inline styles only,
// mirroring the cream/ink/amber tokens from src/styles/global.css.
//
// Doc bodies are rendered by src/utils/markdown-lite.ts, which escapes input
// BEFORE any markdown transform. That is what makes dangerouslySetInnerHTML
// acceptable here; see markdown-lite.test.ts for the adversarial cases.
// ---------------------------------------------------------------------------

interface DocsPayload {
	sections: SectionMeta[];
	docs: Array<DocRecord & { body: string }>;
	summary: {
		total: number;
		indexed: number;
		needsFrontmatter: number;
		parseErrors: number;
		danglingLinks: Array<{ from: string; to: string }>;
		generatedAt: string;
	};
}

const C = {
	cream: "#F5EFE3",
	creamDark: "#E9DFC9",
	border: "#d6c9a8",
	ink: "#1A1A1A",
	stone: "#655F5B",
	amber: "#B45309",
	red: "#B91C1C",
	green: "#15803D",
	blue: "#1D4ED8",
};

const s = {
	root: {
		display: "flex",
		minHeight: "100vh",
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		color: "#1f2937",
		background: C.cream,
	} as React.CSSProperties,

	sidebar: {
		width: 320,
		flexShrink: 0,
		background: C.creamDark,
		borderRight: `1px solid ${C.border}`,
		padding: "20px 0 40px",
		maxHeight: "100vh",
		overflowY: "auto",
	} as React.CSSProperties,

	searchWrap: { padding: "0 16px 16px" } as React.CSSProperties,

	search: {
		width: "100%",
		boxSizing: "border-box" as const,
		padding: "8px 10px",
		fontSize: 14,
		fontFamily: "inherit",
		border: `1px solid ${C.border}`,
		borderRadius: 6,
		background: C.cream,
		color: C.ink,
	} as React.CSSProperties,

	sectionHead: {
		padding: "14px 16px 2px",
		fontSize: 12,
		fontWeight: 700,
		textTransform: "uppercase" as const,
		letterSpacing: 0.5,
		color: C.stone,
	} as React.CSSProperties,

	sectionBlurb: {
		padding: "0 16px 8px",
		fontSize: 11,
		lineHeight: 1.4,
		color: C.stone,
		opacity: 0.85,
	} as React.CSSProperties,

	navItem: (active: boolean) =>
		({
			display: "flex",
			alignItems: "center",
			gap: 6,
			width: "100%",
			textAlign: "left" as const,
			padding: "7px 16px",
			background: active ? C.cream : "transparent",
			border: "none",
			borderLeft: active ? `3px solid ${C.amber}` : "3px solid transparent",
			color: active ? C.ink : "#374151",
			fontSize: 13,
			fontWeight: active ? 600 : 400,
			cursor: "pointer",
			fontFamily: "inherit",
			lineHeight: 1.3,
		}) as React.CSSProperties,

	navTitle: {
		flex: 1,
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap" as const,
	} as React.CSSProperties,

	main: { flex: 1, padding: "32px 40px 80px", maxWidth: 900, overflowX: "auto" } as React.CSSProperties,

	metaBar: {
		display: "flex",
		flexWrap: "wrap" as const,
		gap: 8,
		alignItems: "center",
		paddingBottom: 16,
		marginBottom: 24,
		borderBottom: `1px solid ${C.border}`,
	} as React.CSSProperties,

	badge: (bg: string, fg = "#fff") =>
		({
			display: "inline-block",
			padding: "2px 8px",
			borderRadius: 999,
			fontSize: 11,
			fontWeight: 600,
			background: bg,
			color: fg,
			whiteSpace: "nowrap" as const,
		}) as React.CSSProperties,

	path: { fontSize: 11, color: C.stone, fontFamily: "ui-monospace, monospace" } as React.CSSProperties,

	empty: { color: C.stone, fontSize: 14, padding: "40px 0" } as React.CSSProperties,

	banner: (bg: string, border: string) =>
		({
			padding: "10px 14px",
			borderRadius: 6,
			background: bg,
			border: `1px solid ${border}`,
			fontSize: 13,
			marginBottom: 16,
		}) as React.CSSProperties,
};

const STATUS_COLOR: Record<string, string> = {
	active: C.green,
	draft: C.stone,
	locked: C.blue,
	done: "#4B5563",
	deprecated: C.red,
	unknown: "#9CA3AF",
};

/** PRDs get an extra shipped/planned badge — status alone doesn't say it. */
function deliveryBadge(doc: DocRecord): { label: string; color: string } | null {
	if (doc.type !== "prd") return null;
	if (doc.delivery === "shipped") return { label: "shipped", color: C.green };
	if (doc.delivery === "planned") return { label: "planned", color: C.amber };
	return { label: "delivery unset", color: "#9CA3AF" };
}

const docStyles = `
.docbody { font-size: 15px; line-height: 1.65; color: #1f2937; }
.docbody h1 { font-size: 28px; margin: 0 0 16px; color: ${C.ink}; }
.docbody h2 { font-size: 20px; margin: 32px 0 10px; color: ${C.ink}; border-bottom: 1px solid ${C.border}; padding-bottom: 5px; }
.docbody h3 { font-size: 16px; margin: 24px 0 8px; color: ${C.ink}; }
.docbody h4 { font-size: 14px; margin: 18px 0 6px; color: ${C.stone}; text-transform: uppercase; letter-spacing: .04em; }
.docbody p { margin: 0 0 12px; }
.docbody ul, .docbody ol { margin: 0 0 12px; padding-left: 22px; }
.docbody li { margin-bottom: 4px; }
.docbody li.task { list-style: none; margin-left: -18px; }
.docbody code { background: ${C.creamDark}; padding: 1px 5px; border-radius: 3px; font-size: 13px; font-family: ui-monospace, monospace; }
.docbody pre { background: ${C.creamDark}; padding: 12px 14px; border-radius: 6px; overflow-x: auto; margin: 0 0 14px; border: 1px solid ${C.border}; }
.docbody pre code { background: none; padding: 0; font-size: 12.5px; line-height: 1.5; }
.docbody blockquote { margin: 0 0 14px; padding: 10px 16px; border-left: 3px solid ${C.amber}; background: rgba(180,83,9,.06); }
.docbody blockquote p:last-child { margin-bottom: 0; }
.docbody table { border-collapse: collapse; width: 100%; margin: 0 0 16px; font-size: 13.5px; display: block; overflow-x: auto; }
.docbody th, .docbody td { border: 1px solid ${C.border}; padding: 6px 10px; text-align: left; vertical-align: top; }
.docbody th { background: ${C.creamDark}; font-weight: 600; }
.docbody hr { border: none; border-top: 1px solid ${C.border}; margin: 24px 0; }
.docbody a { color: ${C.amber}; }
`;

const AdminDocs = () => {
	const [data, setData] = useState<DocsPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [activePath, setActivePath] = useState<string | null>(null);
	const [query, setQuery] = useState("");

	useEffect(() => {
		fetch("/docs-admin.json")
			.then((r) => {
				if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
				return r.json();
			})
			.then((d: DocsPayload) => {
				setData(d);
				const first = d.docs.find((x) => x.id === "DOC-001") ?? d.docs[0];
				setActivePath(first?.path ?? null);
			})
			.catch((e) => setError(String(e.message ?? e)));
	}, []);

	const filtered = useMemo(
		() => (data ? data.docs.filter((d) => matchesQuery(d, query)) : []),
		[data, query]
	);
	const groups = useMemo(() => groupBySection(filtered), [filtered]);
	const active = useMemo(
		() => data?.docs.find((d) => d.path === activePath) ?? null,
		[data, activePath]
	);

	const html = useMemo(() => (active ? renderMarkdown(active.body) : ""), [active]);

	if (error) {
		return (
			<div style={{ ...s.root, padding: 40 }}>
				<div>
					<h2 style={{ color: C.red }}>Couldn't load the docs index</h2>
					<p style={{ fontSize: 14 }}>
						<code>/docs-admin.json</code> returned: {error}
					</p>
					<p style={{ fontSize: 13, color: C.stone }}>
						It's generated at build time by <code>src/pages/docs-admin.json.ts</code>. In dev,
						run a build first, or check that the file exists.
					</p>
				</div>
			</div>
		);
	}

	if (!data) return <div style={{ ...s.root, padding: 40 }}>Loading docs…</div>;

	return (
		<div style={s.root}>
			<style>{docStyles}</style>

			<nav style={s.sidebar}>
				<div style={s.searchWrap}>
					<input
						style={s.search}
						placeholder="Search title, id, path, tag…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						aria-label="Search docs"
					/>
					<div style={{ fontSize: 11, color: C.stone, paddingTop: 6 }}>
						{filtered.length} of {data.summary.total} docs
					</div>
				</div>

				{groups.length === 0 && (
					<div style={{ ...s.sectionBlurb, paddingTop: 12 }}>No docs match “{query}”.</div>
				)}

				{groups.map(({ meta, docs }) => (
					<div key={meta.id}>
						<div style={s.sectionHead}>
							{meta.emoji} {meta.label} ({docs.length})
						</div>
						<div style={s.sectionBlurb}>{meta.blurb}</div>
						{docs.map((d) => (
							<button
								key={d.path}
								style={s.navItem(d.path === activePath)}
								onClick={() => setActivePath(d.path)}
								title={`${d.title}${d.id ? ` — ${d.id}` : ""}\n${d.path}`}
							>
								<span style={s.navTitle}>{d.title}</span>
								{d.error && <span title="frontmatter parse error">⚠️</span>}
							</button>
						))}
					</div>
				))}
			</nav>

			<main style={s.main}>
				{!active && <div style={s.empty}>Select a doc.</div>}

				{active && (
					<>
						<div style={s.metaBar}>
							{active.id && <span style={s.badge(C.ink)}>{active.id}</span>}
							<span style={s.badge(C.creamDark, C.ink)}>{active.type}</span>
							<span style={s.badge(STATUS_COLOR[active.status] ?? "#9CA3AF")}>
								{active.status}
							</span>
							{(() => {
								const d = deliveryBadge(active);
								return d ? <span style={s.badge(d.color)}>{d.label}</span> : null;
							})()}
							{active.tags.map((t) => (
								<span key={t} style={s.badge("rgba(180,83,9,.15)", C.amber)}>
									{t}
								</span>
							))}
							<span style={{ flex: 1 }} />
							{active.updated && (
								<span style={s.path}>updated {active.updated}</span>
							)}
						</div>

						<div style={{ ...s.path, marginTop: -12, marginBottom: 16 }}>{active.path}</div>

						{active.error && (
							<div style={s.banner("rgba(185,28,28,.08)", C.red)}>
								<strong>⚠️ Frontmatter could not be parsed:</strong> {active.error}
								<br />
								This doc is shown, but it can't be filtered or linked until the YAML is
								fixed.
							</div>
						)}

						{active.unindexed && (
							<div style={s.banner("rgba(180,83,9,.08)", C.amber)}>
								<strong>No frontmatter.</strong> This doc has no <code>id</code>,{" "}
								<code>type</code>, or <code>status</code>, so it can't be filtered,
								linked, or grouped by intent. Add a block per{" "}
								<code>docs/README-DOCS.md</code>.
							</div>
						)}

						{active.links.length > 0 && (
							<div style={{ fontSize: 13, marginBottom: 18, color: C.stone }}>
								Related:{" "}
								{active.links.map((l, i) => {
									const target = data.docs.find((d) => d.id === l);
									return (
										<React.Fragment key={l}>
											{i > 0 && " · "}
											{target ? (
												<button
													onClick={() => setActivePath(target.path)}
													style={{
														background: "none",
														border: "none",
														padding: 0,
														color: C.amber,
														cursor: "pointer",
														font: "inherit",
													}}
													title={target.title}
												>
													{l}
												</button>
											) : (
												<span title="no doc with this id" style={{ color: C.red }}>
													{l} (missing)
												</span>
											)}
										</React.Fragment>
									);
								})}
							</div>
						)}

						{/* Safe: markdown-lite escapes input before transforming. See its tests. */}
						<div className="docbody" dangerouslySetInnerHTML={{ __html: html }} />
					</>
				)}

				<div
					style={{
						marginTop: 48,
						paddingTop: 16,
						borderTop: `1px solid ${C.border}`,
						fontSize: 12,
						color: C.stone,
					}}
				>
					Index built {data.summary.generatedAt} · {data.summary.indexed} indexed ·{" "}
					{data.summary.needsFrontmatter} need frontmatter · {data.summary.parseErrors} parse
					error(s) · {data.summary.danglingLinks.length} dangling link(s). Regenerate with a
					build; run <code>npm run docs:refresh</code> before pushing.
				</div>
			</main>
		</div>
	);
};

export default AdminDocs;
