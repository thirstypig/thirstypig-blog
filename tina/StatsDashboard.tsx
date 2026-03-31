import React, { useState, useEffect } from "react";

// Icon for sidebar
export const StatsIcon = () => (
  <span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F4CA;</span>
);

interface PostRow {
  id: string;
  title: string;
  date: string;
  city: string;
  source: string;
}

interface Stats {
  generatedAt: string;
  totalPosts: number;
  postsByYear: { year: number; count: number }[];
  postsBySource: { key: string; count: number }[];
  topCities: { key: string; count: number }[];
  topCategories: { key: string; count: number }[];
  topTags: { key: string; count: number }[];
  gpsStats: { withCoords: number; withCity: number; total: number };
  imageStats: { withHero: number; withGallery: number; withAny: number; without: number };
  uniqueVenues: number;
  closedVenues: number;
  recentPosts: PostRow[];
  uncategorizedPosts: PostRow[];
  cuisineCount: number;
}

// --- Styles ---

const styles = {
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

  bigNumber: {
    fontSize: 48,
    fontWeight: 800,
    color: "#2563eb",
    lineHeight: 1.1,
  } as React.CSSProperties,

  bigLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  } as React.CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
    gap: 20,
    marginTop: 24,
  } as React.CSSProperties,

  card: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "20px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  } as React.CSSProperties,

  cardFull: {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "20px 24px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    gridColumn: "1 / -1",
  } as React.CSSProperties,

  cardTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 14,
    margin: 0,
    paddingBottom: 10,
    borderBottom: "1px solid #f3f4f6",
  } as React.CSSProperties,

  barRow: {
    display: "flex",
    alignItems: "center",
    marginBottom: 6,
    fontSize: 13,
  } as React.CSSProperties,

  barLabel: {
    width: 110,
    flexShrink: 0,
    color: "#4b5563",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } as React.CSSProperties,

  barTrack: {
    flex: 1,
    height: 18,
    background: "#f3f4f6",
    borderRadius: 4,
    overflow: "hidden",
    marginLeft: 8,
    marginRight: 8,
  } as React.CSSProperties,

  barCount: {
    width: 44,
    textAlign: "right" as const,
    fontWeight: 600,
    color: "#374151",
    fontSize: 12,
    flexShrink: 0,
  } as React.CSSProperties,

  statRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 0",
    borderBottom: "1px solid #f9fafb",
    fontSize: 14,
  } as React.CSSProperties,

  pctBar: {
    height: 8,
    background: "#f3f4f6",
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 6,
  } as React.CSSProperties,

  table: {
    width: "100%",
    fontSize: 13,
    borderCollapse: "collapse" as const,
  },

  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #e5e7eb",
    color: "#6b7280",
    fontWeight: 600,
    fontSize: 12,
    textTransform: "uppercase" as const,
    letterSpacing: "0.03em",
  },

  td: {
    padding: "7px 10px",
    borderBottom: "1px solid #f3f4f6",
    color: "#374151",
  },
};

// --- Sub-components ---

function BarChart({ data, color = "#3b82f6", labelWidth }: {
  data: { key: string; count: number }[];
  color?: string;
  labelWidth?: number;
}) {
  const max = Math.max(...data.map(d => d.count), 1);
  const lw = labelWidth || 110;
  return (
    <div>
      {data.map(d => (
        <div key={d.key} style={styles.barRow}>
          <div style={{ ...styles.barLabel, width: lw }} title={d.key}>{d.key}</div>
          <div style={styles.barTrack}>
            <div style={{
              width: `${(d.count / max) * 100}%`,
              height: "100%",
              background: color,
              borderRadius: 4,
              minWidth: 2,
              transition: "width 0.3s ease",
            }} />
          </div>
          <div style={styles.barCount}>{d.count.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function YearChart({ data }: { data: { year: number; count: number }[] }) {
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      {data.map(d => (
        <div key={d.year} style={styles.barRow}>
          <div style={{ ...styles.barLabel, width: 50, fontWeight: 500 }}>{d.year}</div>
          <div style={styles.barTrack}>
            <div style={{
              width: `${(d.count / max) * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, #3b82f6, #6366f1)",
              borderRadius: 4,
              minWidth: 2,
              transition: "width 0.3s ease",
            }} />
          </div>
          <div style={styles.barCount}>{d.count.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function PercentStat({ label, value, total, color = "#3b82f6" }: {
  label: string;
  value: number;
  total: number;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <span style={{ color: "#4b5563" }}>{label}</span>
        <span style={{ fontWeight: 600, color: "#374151" }}>
          {value.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div style={styles.pctBar}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 4,
          transition: "width 0.3s ease",
        }} />
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  "thirstypig.com": "thirstypig.com",
  "thethirstypig.com": "thethirstypig.com",
  "blog.thethirstypig.com": "blog.thethirstypig",
  new: "New",
  unknown: "Unknown",
};

// --- Main Component ---

export default function StatsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/stats.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setStats)
      .catch(e => setError(e.message));
  }, []);

  if (error) {
    return (
      <div style={{ ...styles.container, textAlign: "center", paddingTop: 80 }}>
        <p style={{ fontSize: 18, color: "#6b7280" }}>
          Stats data not available.
        </p>
        <p style={{ fontSize: 14, color: "#9ca3af" }}>
          Run a build to generate stats. ({error})
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ ...styles.container, textAlign: "center", paddingTop: 80 }}>
        <p style={{ fontSize: 16, color: "#6b7280" }}>Loading stats...</p>
      </div>
    );
  }

  const generated = new Date(stats.generatedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={styles.title}>Content Stats</h1>
            <div style={styles.subtitle}>Generated {generated}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={styles.bigNumber}>{stats.totalPosts.toLocaleString()}</div>
            <div style={styles.bigLabel}>total posts</div>
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ display: "flex", gap: 32, marginTop: 16, fontSize: 14, color: "#6b7280" }}>
          <span><strong style={{ color: "#374151" }}>{stats.uniqueVenues.toLocaleString()}</strong> venues</span>
          <span><strong style={{ color: "#374151" }}>{stats.gpsStats.withCoords.toLocaleString()}</strong> GPS-geocoded</span>
          <span><strong style={{ color: "#374151" }}>{stats.topCities.length}</strong> cities</span>
          <span><strong style={{ color: "#374151" }}>{stats.closedVenues}</strong> closed</span>
        </div>
      </div>

      {/* Posts by Year — hero chart */}
      <div style={styles.cardFull}>
        <h3 style={styles.cardTitle}>Posts by Year</h3>
        <YearChart data={stats.postsByYear} />
      </div>

      {/* Grid of stat cards */}
      <div style={styles.grid}>
        {/* Source Breakdown */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>By Source</h3>
          <BarChart
            data={stats.postsBySource.map(d => ({ ...d, key: SOURCE_LABELS[d.key] || d.key }))}
            color="#8b5cf6"
          />
        </div>

        {/* Top Cities */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Cities</h3>
          <BarChart data={stats.topCities} color="#059669" />
        </div>

        {/* Data Coverage */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Data Coverage</h3>
          <PercentStat label="GPS Coordinates" value={stats.gpsStats.withCoords} total={stats.gpsStats.total} color="#3b82f6" />
          <PercentStat label="City Assigned" value={stats.gpsStats.withCity} total={stats.gpsStats.total} color="#6366f1" />
          <PercentStat label="Has Hero Image" value={stats.imageStats.withHero} total={stats.totalPosts} color="#8b5cf6" />
          <PercentStat label="Has Image Gallery" value={stats.imageStats.withGallery} total={stats.totalPosts} color="#a855f7" />
        </div>

        {/* Top Categories (Cuisine) */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Categories (Cuisine)</h3>
          <PercentStat
            label="Cuisine Assigned"
            value={stats.cuisineCount}
            total={stats.totalPosts}
            color="#d97706"
          />
          {stats.topCategories.length > 0 ? (
            <BarChart data={stats.topCategories} color="#d97706" />
          ) : (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>No categories yet</p>
          )}
        </div>

        {/* Top Tags */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Top Tags</h3>
          {stats.topTags.length > 0 ? (
            <BarChart data={stats.topTags} color="#0891b2" />
          ) : (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>No tags yet</p>
          )}
        </div>

        {/* Needs Attention: Uncategorized Posts */}
        {stats.uncategorizedPosts && stats.uncategorizedPosts.length > 0 && (
          <div style={{
            ...styles.cardFull,
            borderColor: "#f59e0b",
            borderWidth: 2,
          }}>
            <h3 style={{ ...styles.cardTitle, color: "#b45309" }}>
              Needs Attention: {stats.uncategorizedPosts.length} Uncategorized Posts
            </h3>
            <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12, marginTop: -4 }}>
              These posts have no cuisine assigned. Assign a cuisine (e.g. Japanese, Mexican) or a non-food category (Travel, Baseball, etc.)
            </p>
            <div style={{ maxHeight: 400, overflowY: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Title</th>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>City</th>
                    <th style={styles.th}>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.uncategorizedPosts.map(p => (
                    <tr key={p.id}>
                      <td style={{ ...styles.td, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <a
                          href={`/admin#/collections/post/src/content/posts/${p.id}.md`}
                          target="_blank"
                          rel="noopener"
                          style={{ color: "#2563eb", textDecoration: "none" }}
                        >
                          {p.title}
                        </a>
                      </td>
                      <td style={{ ...styles.td, whiteSpace: "nowrap" }}>{p.date}</td>
                      <td style={styles.td}>{p.city}</td>
                      <td style={styles.td}>{SOURCE_LABELS[p.source] || p.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent Posts */}
        <div style={styles.cardFull}>
          <h3 style={styles.cardTitle}>Recent Posts</h3>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Date</th>
                <th style={styles.th}>City</th>
                <th style={styles.th}>Source</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentPosts.map(p => (
                <tr key={p.id}>
                  <td style={{ ...styles.td, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title}
                  </td>
                  <td style={{ ...styles.td, whiteSpace: "nowrap" }}>{p.date}</td>
                  <td style={styles.td}>{p.city}</td>
                  <td style={styles.td}>{SOURCE_LABELS[p.source] || p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
