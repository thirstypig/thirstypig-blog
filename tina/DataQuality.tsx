import React, { useState, useEffect, useMemo } from "react";

// Sidebar icon — flag glyph
export const DataQualityIcon = () => (
	<span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F6A9;</span>
);

// ---------------------------------------------------------------------------
// Cleanup screen — surfaces data-quality issues in venues.yaml + posts.
//
// Backed by /data-quality.json (build-time detection at
// src/pages/data-quality.json.ts). Two issue classes:
//
//   1. Duplicate venues — venues.yaml entries sharing a place_id
//   2. Suspect posts   — title vs location field disagrees (Jaccard-based)
//
// Auto-derived "open" status — issue is open if it still fires in the
// freshest build. Fixing the underlying data + redeploying makes it
// disappear from the list. No persistent dismissal state.
// ---------------------------------------------------------------------------

interface DuplicateVenue {
	placeId: string;
	keys: string[];
	names: string[];
	city: string;
}

interface SuspectPost {
	id: string;
	slug: string;
	title: string;
	location: string;
	city: string;
	placeId: string;
	jaccard: {
		slugTitle: number;
		slugLocation: number;
		titleLocation: number;
	};
	worstPair: "slugTitle" | "slugLocation" | "titleLocation";
	worstScore: number;
}

interface DataQualityReport {
	generatedAt: string;
	thresholds: { suspectJaccard: number };
	duplicateVenues: DuplicateVenue[];
	suspectPosts: SuspectPost[];
}

type Tab = "summary" | "duplicates" | "posts";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = {
	container: {
		maxWidth: 1200,
		margin: "0 auto",
		padding: "24px 24px 80px",
		fontFamily:
			'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		color: "#1f2937",
	} as React.CSSProperties,

	header: {
		marginBottom: 20,
		borderBottom: "1px solid #e5e7eb",
		paddingBottom: 16,
	} as React.CSSProperties,

	title: {
		fontSize: 24,
		fontWeight: 700,
		margin: 0,
		color: "#111827",
	} as React.CSSProperties,

	subtitle: {
		fontSize: 13,
		color: "#6b7280",
		marginTop: 4,
	} as React.CSSProperties,

	tabs: {
		display: "flex",
		gap: 4,
		marginBottom: 20,
		borderBottom: "1px solid #e5e7eb",
	} as React.CSSProperties,

	tab: (active: boolean) =>
		({
			padding: "10px 16px",
			background: "transparent",
			border: "none",
			borderBottom: active
				? "2px solid #B45309"
				: "2px solid transparent",
			color: active ? "#1A1A1A" : "#6b7280",
			fontSize: 14,
			fontWeight: active ? 600 : 400,
			cursor: "pointer",
			fontFamily: "inherit",
		}) as React.CSSProperties,

	filtersRow: {
		display: "flex",
		gap: 12,
		flexWrap: "wrap" as const,
		marginBottom: 16,
		alignItems: "center",
		fontSize: 13,
		color: "#374151",
	} as React.CSSProperties,

	select: {
		padding: "6px 10px",
		borderRadius: 6,
		border: "1px solid #d1d5db",
		fontSize: 13,
		color: "#374151",
		background: "#fff",
	} as React.CSSProperties,

	input: {
		padding: "6px 10px",
		borderRadius: 6,
		border: "1px solid #d1d5db",
		fontSize: 13,
		minWidth: 200,
	} as React.CSSProperties,

	table: {
		width: "100%",
		borderCollapse: "collapse" as const,
		fontSize: 13,
	} as React.CSSProperties,

	th: {
		textAlign: "left" as const,
		padding: "10px 8px",
		borderBottom: "1px solid #e5e7eb",
		fontSize: 11,
		fontWeight: 600,
		textTransform: "uppercase" as const,
		letterSpacing: 0.5,
		color: "#6b7280",
		whiteSpace: "nowrap" as const,
	} as React.CSSProperties,

	td: {
		padding: "10px 8px",
		borderBottom: "1px solid #f3f4f6",
		verticalAlign: "top" as const,
	} as React.CSSProperties,

	severityBadge: (score: number) => {
		const bg =
			score === 0 ? "#fee2e2" : score < 0.15 ? "#fef3c7" : "#fef9c3";
		const fg =
			score === 0 ? "#991b1b" : score < 0.15 ? "#92400e" : "#854d0e";
		return {
			display: "inline-block",
			padding: "2px 8px",
			borderRadius: 4,
			background: bg,
			color: fg,
			fontWeight: 600,
			fontSize: 11,
			fontFamily: "ui-monospace, SFMono-Regular, monospace",
		} as React.CSSProperties;
	},

	code: {
		fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', monospace",
		fontSize: 12,
		color: "#475569",
		background: "#f1f5f9",
		padding: "1px 6px",
		borderRadius: 3,
		wordBreak: "break-all" as const,
	} as React.CSSProperties,

	link: {
		color: "#B45309",
		textDecoration: "none",
		fontSize: 12,
		fontWeight: 600,
	} as React.CSSProperties,

	summaryCard: {
		display: "inline-block",
		marginRight: 24,
		marginBottom: 16,
		minWidth: 200,
	} as React.CSSProperties,

	summaryNum: {
		fontSize: 36,
		fontWeight: 700,
		color: "#1A1A1A",
		display: "block",
		lineHeight: 1.1,
	} as React.CSSProperties,

	summaryLabel: {
		fontSize: 12,
		color: "#6b7280",
		textTransform: "uppercase" as const,
		letterSpacing: 0.5,
	} as React.CSSProperties,

	pagination: {
		display: "flex",
		gap: 8,
		marginTop: 20,
		alignItems: "center",
		fontSize: 13,
	} as React.CSSProperties,

	button: {
		padding: "6px 12px",
		borderRadius: 6,
		border: "1px solid #d1d5db",
		background: "#fff",
		cursor: "pointer",
		fontSize: 13,
		color: "#374151",
	} as React.CSSProperties,

	loading: {
		padding: 40,
		textAlign: "center" as const,
		color: "#6b7280",
	} as React.CSSProperties,

	error: {
		padding: 16,
		background: "#fef2f2",
		border: "1px solid #fecaca",
		borderRadius: 6,
		color: "#991b1b",
		marginBottom: 20,
	} as React.CSSProperties,

	helpBox: {
		background: "#fffbea",
		border: "1px solid #fde68a",
		borderLeft: "4px solid #B45309",
		padding: "12px 16px",
		borderRadius: 4,
		marginBottom: 20,
		fontSize: 13,
		lineHeight: 1.5,
		color: "#374151",
	} as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

const SummarySection = ({ data }: { data: DataQualityReport }) => (
	<>
		<div style={s.helpBox}>
			<strong>What this is.</strong> Auto-detected data-quality
			issues. Issues disappear from the list when the underlying data
			is fixed and the site rebuilds. No "dismiss" button — fix the
			data, redeploy, gone.
		</div>
		<div>
			<div style={s.summaryCard}>
				<span style={s.summaryNum}>{data.duplicateVenues.length}</span>
				<span style={s.summaryLabel}>Duplicate venue groups</span>
			</div>
			<div style={s.summaryCard}>
				<span style={s.summaryNum}>{data.suspectPosts.length}</span>
				<span style={s.summaryLabel}>Suspect posts</span>
			</div>
			<div style={s.summaryCard}>
				<span style={s.summaryNum}>
					{data.suspectPosts.filter((p) => p.worstScore === 0).length}
				</span>
				<span style={s.summaryLabel}>Posts at zero overlap</span>
			</div>
		</div>
		<p style={{ ...s.subtitle, marginTop: 20 }}>
			Generated{" "}
			{new Date(data.generatedAt).toLocaleString(undefined, {
				dateStyle: "medium",
				timeStyle: "short",
			})}
			. Threshold: Jaccard &lt; {data.thresholds.suspectJaccard} flags
			a post.
		</p>
	</>
);

const DuplicatesTable = ({ rows }: { rows: DuplicateVenue[] }) => {
	if (rows.length === 0) {
		return (
			<p style={{ color: "#6b7280", fontStyle: "italic" }}>
				No duplicate venue groups. ✨
			</p>
		);
	}
	return (
		<>
			<div style={s.helpBox}>
				<strong>What you're looking at.</strong> Each group below is
				one Google place that has multiple keys in{" "}
				<code style={s.code}>scripts/venue-tags/venues.yaml</code>.
				Doesn't break tag rendering (publish.py collapses by
				place_id), but bloats the curator pool.{" "}
				<strong>To fix:</strong> pick one canonical key per group,
				delete the others from venues.yaml, and run{" "}
				<code style={s.code}>sync_post_placeids.py --apply</code> to
				re-tag any posts that pointed to deleted keys.
			</div>
			<table style={s.table}>
				<thead>
					<tr>
						<th style={s.th}>place_id</th>
						<th style={s.th}>City</th>
						<th style={s.th}>Aliases</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((r) => (
						<tr key={r.placeId}>
							<td style={s.td}>
								<code style={s.code}>{r.placeId}</code>
							</td>
							<td style={s.td}>{r.city || "—"}</td>
							<td style={s.td}>
								{r.keys.map((k, i) => (
									<div key={k} style={{ marginBottom: 2 }}>
										<code style={s.code}>{k}</code>
										{r.names[i] && r.names[i] !== r.names[0] ? (
											<span
												style={{
													color: "#6b7280",
													marginLeft: 6,
													fontSize: 12,
												}}
											>
												— {r.names[i]}
											</span>
										) : null}
									</div>
								))}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
};

const PAGE_SIZE = 25;

const SuspectsTable = ({ rows }: { rows: SuspectPost[] }) => {
	const [search, setSearch] = useState("");
	const [cityFilter, setCityFilter] = useState("all");
	const [severityFilter, setSeverityFilter] = useState<
		"all" | "zero" | "low" | "mid"
	>("all");
	const [page, setPage] = useState(0);

	const cities = useMemo(() => {
		const cs = new Set<string>();
		for (const r of rows) if (r.city) cs.add(r.city);
		return Array.from(cs).sort();
	}, [rows]);

	const filtered = useMemo(() => {
		const q = search.trim().toLowerCase();
		return rows.filter((r) => {
			if (severityFilter === "zero" && r.worstScore !== 0) return false;
			if (
				severityFilter === "low" &&
				(r.worstScore === 0 || r.worstScore >= 0.2)
			)
				return false;
			if (severityFilter === "mid" && r.worstScore < 0.2) return false;
			if (cityFilter !== "all" && r.city !== cityFilter) return false;
			if (
				q &&
				!r.title.toLowerCase().includes(q) &&
				!r.location.toLowerCase().includes(q) &&
				!r.slug.toLowerCase().includes(q)
			)
				return false;
			return true;
		});
	}, [rows, search, cityFilter, severityFilter]);

	useEffect(() => {
		setPage(0);
	}, [search, cityFilter, severityFilter]);

	const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
	const pageRows = filtered.slice(
		page * PAGE_SIZE,
		(page + 1) * PAGE_SIZE,
	);

	if (rows.length === 0) {
		return (
			<p style={{ color: "#6b7280", fontStyle: "italic" }}>
				No suspect posts. ✨
			</p>
		);
	}

	return (
		<>
			<div style={s.helpBox}>
				<strong>What this flags.</strong> Posts where the{" "}
				<code style={s.code}>title</code> and{" "}
				<code style={s.code}>location</code> frontmatter fields
				disagree on tokens — a strong signal that one of them was
				contaminated during enrichment.{" "}
				<strong>To fix:</strong> click "Edit" to open the post in
				TinaCMS, decide which field is correct, and overwrite the
				wrong one (or remove the placeId if neither is right).
			</div>
			<div style={s.filtersRow}>
				<input
					type="search"
					placeholder="Search title / location / slug..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					style={s.input}
				/>
				<select
					value={severityFilter}
					onChange={(e) =>
						setSeverityFilter(
							e.target.value as typeof severityFilter,
						)
					}
					style={s.select}
				>
					<option value="all">All severities</option>
					<option value="zero">Zero overlap (worst)</option>
					<option value="low">Low (0 – 0.2)</option>
					<option value="mid">Borderline (0.2 – threshold)</option>
				</select>
				<select
					value={cityFilter}
					onChange={(e) => setCityFilter(e.target.value)}
					style={s.select}
				>
					<option value="all">All cities</option>
					{cities.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
				<span style={{ marginLeft: "auto", color: "#6b7280" }}>
					{filtered.length} of {rows.length}
				</span>
			</div>
			<table style={s.table}>
				<thead>
					<tr>
						<th style={s.th}>Score</th>
						<th style={s.th}>Title</th>
						<th style={s.th}>Location</th>
						<th style={s.th}>City</th>
						<th style={s.th}></th>
					</tr>
				</thead>
				<tbody>
					{pageRows.map((p) => (
						<tr key={p.id}>
							<td style={s.td}>
								<span style={s.severityBadge(p.worstScore)}>
									{p.worstScore.toFixed(2)}
								</span>
							</td>
							<td style={s.td}>
								<div style={{ fontWeight: 500 }}>{p.title}</div>
								<div
									style={{
										fontSize: 11,
										color: "#9ca3af",
										marginTop: 2,
									}}
								>
									{p.slug}
								</div>
							</td>
							<td style={s.td}>{p.location || "—"}</td>
							<td style={s.td}>{p.city || "—"}</td>
							<td style={s.td}>
								<a
									href={`/admin#/collections/edit/post/${p.id}`}
									style={s.link}
									target="_blank"
									rel="noopener noreferrer"
								>
									Edit →
								</a>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{totalPages > 1 ? (
				<div style={s.pagination}>
					<button
						type="button"
						style={s.button}
						onClick={() => setPage((p) => Math.max(0, p - 1))}
						disabled={page === 0}
					>
						‹ Prev
					</button>
					<span style={{ color: "#6b7280" }}>
						Page {page + 1} of {totalPages}
					</span>
					<button
						type="button"
						style={s.button}
						onClick={() =>
							setPage((p) => Math.min(totalPages - 1, p + 1))
						}
						disabled={page === totalPages - 1}
					>
						Next ›
					</button>
				</div>
			) : null}
		</>
	);
};

// ---------------------------------------------------------------------------
// Top-level component
// ---------------------------------------------------------------------------

const DataQuality = () => {
	const [data, setData] = useState<DataQualityReport | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [tab, setTab] = useState<Tab>("summary");

	useEffect(() => {
		fetch("/data-quality.json")
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json();
			})
			.then(setData)
			.catch((e) => setError(String(e)));
	}, []);

	if (error) {
		return (
			<div style={s.container}>
				<div style={s.error}>
					Failed to load /data-quality.json: {error}
				</div>
			</div>
		);
	}

	if (!data) {
		return <div style={s.loading}>Loading…</div>;
	}

	return (
		<div style={s.container}>
			<header style={s.header}>
				<h1 style={s.title}>Cleanup</h1>
				<p style={s.subtitle}>
					Auto-detected data-quality issues across venues.yaml and
					post frontmatter.
				</p>
			</header>

			<nav style={s.tabs} role="tablist" aria-label="Cleanup sections">
				<button
					type="button"
					role="tab"
					aria-selected={tab === "summary"}
					style={s.tab(tab === "summary")}
					onClick={() => setTab("summary")}
				>
					Summary
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === "duplicates"}
					style={s.tab(tab === "duplicates")}
					onClick={() => setTab("duplicates")}
				>
					Duplicate venues ({data.duplicateVenues.length})
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={tab === "posts"}
					style={s.tab(tab === "posts")}
					onClick={() => setTab("posts")}
				>
					Suspect posts ({data.suspectPosts.length})
				</button>
			</nav>

			{tab === "summary" ? <SummarySection data={data} /> : null}
			{tab === "duplicates" ? (
				<DuplicatesTable rows={data.duplicateVenues} />
			) : null}
			{tab === "posts" ? (
				<SuspectsTable rows={data.suspectPosts} />
			) : null}
		</div>
	);
};

export default DataQuality;
