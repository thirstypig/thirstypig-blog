import React, { useState, useEffect } from "react";

export const TestingIcon = () => (
	<span style={{ fontSize: 16, lineHeight: 1 }}>&#x2705;</span>
);

interface TestEntry {
	file: string;
	kind: "unit" | "e2e";
	covers: string;
	assertions: number;
	status: "passing" | "failing" | "untested" | "missing";
}

interface LatestRun {
	status: "passing" | "failing" | "untested";
	conclusion: string | null;
	runNumber: number | null;
	url: string | null;
	finishedAt: string | null;
}

interface TestingData {
	generatedAt: string;
	tests: TestEntry[];
	summary: {
		total: number;
		unit: number;
		e2e: number;
		totalAssertions: number;
		missing: number;
		undocumented: number;
	};
	latestRun: LatestRun;
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
			status === "failing" ? "#991b1b" :
			status === "missing" ? "#7c2d12" : "#6b7280",
		background:
			status === "passing" ? "#d1fae5" :
			status === "failing" ? "#fee2e2" :
			status === "missing" ? "#fed7aa" : "#f3f4f6",
	}),

	ciCard: (status: LatestRun["status"]) => ({
		marginBottom: 24,
		padding: "14px 18px",
		borderRadius: 8,
		border: "1px solid",
		borderColor:
			status === "passing" ? "#a7f3d0" :
			status === "failing" ? "#fca5a5" : "#e5e7eb",
		background:
			status === "passing" ? "#ecfdf5" :
			status === "failing" ? "#fef2f2" : "#f9fafb",
		display: "flex",
		alignItems: "center",
		gap: 16,
	}),

	ciDot: (status: LatestRun["status"]) => ({
		width: 10,
		height: 10,
		borderRadius: 9999,
		background:
			status === "passing" ? "#10b981" :
			status === "failing" ? "#ef4444" : "#9ca3af",
		flexShrink: 0,
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

	driftNote: {
		marginTop: 16,
		padding: 12,
		background: "#fef2f2",
		borderLeft: "3px solid #dc2626",
		borderRadius: 6,
		fontSize: 13,
		color: "#7f1d1d",
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
					Test inventory for The Thirsty Pig. Auto-derived at build time:{" "}
					{new Date(data.generatedAt).toLocaleString()}
				</div>
			</div>

			{/* Latest CI run card */}
			<div style={s.ciCard(data.latestRun.status)}>
				<div style={s.ciDot(data.latestRun.status)} aria-hidden="true" />
				<div style={{ flex: 1 }}>
					<div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
						Latest CI run:{" "}
						{data.latestRun.status === "passing" && "✓ All tests passing on main"}
						{data.latestRun.status === "failing" && "✗ Tests failing on main — check the workflow"}
						{data.latestRun.status === "untested" && "Status unknown (run in progress or API unreachable)"}
					</div>
					{data.latestRun.url && (
						<div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
							Run #{data.latestRun.runNumber}
							{data.latestRun.finishedAt && ` · ${new Date(data.latestRun.finishedAt).toLocaleString()}`}
							{" · "}
							<a href={data.latestRun.url} target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb" }}>
								view run →
							</a>
						</div>
					)}
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

			{data.summary.missing > 0 && (
				<div style={s.driftNote}>
					<strong>⚠️ Drift detected:</strong> {data.summary.missing} file(s) are documented in metadata but don't exist on disk. Check the Status column for entries marked <em>missing</em>.
				</div>
			)}
			{data.summary.undocumented > 0 && (
				<div style={s.driftNote}>
					<strong>📝 Undocumented tests:</strong> {data.summary.undocumented} test file(s) exist on disk but have no description. Add an entry in <code>src/pages/tests-admin.json.ts</code> metadata.
				</div>
			)}
		</div>
	);
}
