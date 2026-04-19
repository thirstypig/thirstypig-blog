import React, { useState, useEffect } from "react";

export const TestingIcon = () => (
	<span style={{ fontSize: 16, lineHeight: 1 }}>&#x2705;</span>
);

interface TestEntry {
	file: string;
	kind: "unit" | "e2e";
	covers: string;
	assertions: number;
	status: "passing" | "failing" | "untested";
}

interface TestingData {
	generatedAt: string;
	tests: TestEntry[];
	summary: {
		total: number;
		unit: number;
		e2e: number;
		totalAssertions: number;
	};
}

const s = {
	container: {
		maxWidth: 1100,
		margin: "0 auto",
		padding: "32px 24px",
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		color: "#1f2937",
	} as React.CSSProperties,

	header: {
		marginBottom: 32,
		borderBottom: "1px solid #e5e7eb",
		paddingBottom: 24,
	} as React.CSSProperties,

	title: {
		fontSize: 28,
		fontWeight: 700,
		margin: 0,
		color: "#111827",
	} as React.CSSProperties,

	subtitle: {
		fontSize: 13,
		color: "#9ca3af",
		marginTop: 4,
	} as React.CSSProperties,

	summaryBar: {
		display: "flex",
		gap: 24,
		fontSize: 14,
		color: "#4b5563",
		marginBottom: 24,
	} as React.CSSProperties,

	summaryNum: {
		fontSize: 22,
		fontWeight: 700,
		color: "#111827",
	} as React.CSSProperties,

	summaryLabel: {
		display: "block",
		fontSize: 11,
		textTransform: "uppercase" as const,
		letterSpacing: "0.05em",
		color: "#6b7280",
		marginTop: 2,
	} as React.CSSProperties,

	table: {
		width: "100%",
		fontSize: 13,
		borderCollapse: "collapse" as const,
	} as React.CSSProperties,

	th: {
		textAlign: "left" as const,
		padding: "10px 12px",
		borderBottom: "2px solid #e5e7eb",
		color: "#6b7280",
		fontWeight: 600,
		fontSize: 11,
		textTransform: "uppercase" as const,
		letterSpacing: "0.04em",
	} as React.CSSProperties,

	td: {
		padding: "10px 12px",
		borderBottom: "1px solid #f3f4f6",
		color: "#374151",
		verticalAlign: "top" as const,
	} as React.CSSProperties,

	kindBadge: (kind: "unit" | "e2e") => ({
		display: "inline-block",
		padding: "2px 8px",
		borderRadius: 9999,
		fontSize: 11,
		fontWeight: 600,
		color: kind === "unit" ? "#1e40af" : "#065f46",
		background: kind === "unit" ? "#dbeafe" : "#d1fae5",
		textTransform: "uppercase" as const,
		letterSpacing: "0.04em",
	}),

	statusBadge: (status: TestEntry["status"]) => ({
		display: "inline-block",
		padding: "2px 8px",
		borderRadius: 9999,
		fontSize: 11,
		fontWeight: 600,
		color:
			status === "passing" ? "#065f46" :
			status === "failing" ? "#991b1b" : "#6b7280",
		background:
			status === "passing" ? "#d1fae5" :
			status === "failing" ? "#fee2e2" : "#f3f4f6",
	}),

	fileCode: {
		fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
		fontSize: 12,
		color: "#1f2937",
	} as React.CSSProperties,

	note: {
		marginTop: 32,
		padding: 16,
		background: "#fef3c7",
		borderLeft: "3px solid #d97706",
		borderRadius: 6,
		fontSize: 13,
		color: "#78350f",
	} as React.CSSProperties,

	cadence: {
		marginTop: 24,
		fontSize: 13,
		color: "#4b5563",
	} as React.CSSProperties,

	cadenceTable: {
		marginTop: 8,
		width: "100%",
		fontSize: 13,
	} as React.CSSProperties,
};

export default function TestingDashboard() {
	const [data, setData] = useState<TestingData | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		fetch("/tests-admin.json")
			.then(r => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json();
			})
			.then(setData)
			.catch(e => setError(e.message));
	}, []);

	if (error) {
		return (
			<div style={{ ...s.container, textAlign: "center", paddingTop: 80 }}>
				<p style={{ fontSize: 18, color: "#6b7280" }}>Test data not available.</p>
				<p style={{ fontSize: 14, color: "#9ca3af" }}>Run a build to generate the data. ({error})</p>
			</div>
		);
	}

	if (!data) {
		return (
			<div style={{ ...s.container, textAlign: "center", paddingTop: 80 }}>
				<p style={{ fontSize: 16, color: "#6b7280" }}>Loading tests...</p>
			</div>
		);
	}

	return (
		<div style={s.container}>
			<div style={s.header}>
				<h1 style={s.title}>Testing</h1>
				<div style={s.subtitle}>
					Test inventory for The Thirsty Pig. Data last generated at build time:{" "}
					{new Date(data.generatedAt).toLocaleString()}
				</div>
			</div>

			<div style={s.summaryBar}>
				<div>
					<span style={s.summaryNum}>{data.summary.total}</span>
					<span style={s.summaryLabel}>Test files</span>
				</div>
				<div>
					<span style={s.summaryNum}>{data.summary.unit}</span>
					<span style={s.summaryLabel}>Unit</span>
				</div>
				<div>
					<span style={s.summaryNum}>{data.summary.e2e}</span>
					<span style={s.summaryLabel}>E2E</span>
				</div>
				<div>
					<span style={s.summaryNum}>{data.summary.totalAssertions}</span>
					<span style={s.summaryLabel}>Assertions</span>
				</div>
			</div>

			<table style={s.table}>
				<thead>
					<tr>
						<th style={s.th}>File</th>
						<th style={s.th}>Kind</th>
						<th style={s.th}>What it covers</th>
						<th style={s.th}>Assertions</th>
						<th style={s.th}>Status</th>
					</tr>
				</thead>
				<tbody>
					{data.tests.map(t => (
						<tr key={t.file}>
							<td style={{ ...s.td, ...s.fileCode }}>{t.file}</td>
							<td style={s.td}><span style={s.kindBadge(t.kind)}>{t.kind}</span></td>
							<td style={s.td}>{t.covers}</td>
							<td style={s.td}>{t.assertions}</td>
							<td style={s.td}><span style={s.statusBadge(t.status)}>{t.status}</span></td>
						</tr>
					))}
				</tbody>
			</table>

			<div style={s.cadence}>
				<h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 8, color: "#111827" }}>Cadence</h2>
				<p>When tests run:</p>
				<ul style={{ marginTop: 8, paddingLeft: 20 }}>
					<li><strong>On every PR</strong> — both unit and E2E, via GitHub Actions (~1-3 min).</li>
					<li><strong>Locally</strong> — <code>npm run test:unit</code> is fast; <code>npm run test:e2e</code> spins up a preview server.</li>
					<li><strong>Nightly against production</strong> — <em>planned, not yet wired up</em>. Will run E2E against <code>thirstypig.com</code> at 3am PT once the suite is stable.</li>
				</ul>
			</div>

			<div style={s.note}>
				<strong>Phase 1 caveat:</strong> statuses shown above are snapshots from the last manual update to{" "}
				<code>src/pages/tests-admin.json.ts</code>, not live CI results. Phase 2 will wire real CI artifacts so this screen reflects the actual latest run.
			</div>
		</div>
	);
}
