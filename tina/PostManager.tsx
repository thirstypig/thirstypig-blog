import React, { useState, useEffect, useMemo } from "react";

// Icon for sidebar
export const PostManagerIcon = () => (
  <span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F4DD;</span>
);

interface PostRow {
  id: string;
  title: string;
  date: string;
  categories: string[];
  location: string;
  city: string;
  hasCoords: boolean;
  draft: boolean;
  hasHero: boolean;
  hasGallery: boolean;
  hasImages: boolean;
  source: string;
}

interface AdminData {
  posts: PostRow[];
  categories: string[];
  cities: string[];
}

type SortField = "title" | "date" | "location" | "city" | "draft";
type SortDir = "asc" | "desc";
type DraftFilter = "all" | "draft" | "live";
type ImageFilter = "all" | "has" | "none";

const PAGE_SIZE = 50;

// --- Styles ---

const s = {
  container: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: "24px 24px 80px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
    color: "#9ca3af",
    marginTop: 4,
  } as React.CSSProperties,

  filtersRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
    marginBottom: 16,
    alignItems: "center",
  } as React.CSSProperties,

  select: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    color: "#374151",
    background: "#fff",
    minWidth: 140,
  } as React.CSSProperties,

  searchInput: {
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    color: "#374151",
    flex: 1,
    minWidth: 180,
    maxWidth: 300,
  } as React.CSSProperties,

  badge: (color: string, bg: string) => ({
    display: "inline-block",
    padding: "1px 7px",
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
    color,
    background: bg,
    marginRight: 4,
    marginBottom: 2,
    whiteSpace: "nowrap" as const,
  }),

  table: {
    width: "100%",
    fontSize: 13,
    borderCollapse: "collapse" as const,
  } as React.CSSProperties,

  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #e5e7eb",
    color: "#6b7280",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    cursor: "pointer",
    userSelect: "none" as const,
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  td: {
    padding: "7px 10px",
    borderBottom: "1px solid #f3f4f6",
    color: "#374151",
    verticalAlign: "top" as const,
  } as React.CSSProperties,

  link: {
    color: "#2563eb",
    textDecoration: "none",
  } as React.CSSProperties,

  pagination: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    fontSize: 13,
    color: "#6b7280",
  } as React.CSSProperties,

  pageBtn: (active: boolean) => ({
    padding: "4px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: active ? "#fff" : "#f3f4f6",
    color: active ? "#374151" : "#9ca3af",
    cursor: active ? "pointer" : "default",
    fontSize: 13,
  }),

  clearBtn: {
    padding: "6px 12px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    background: "#fff",
    color: "#6b7280",
    cursor: "pointer",
    fontSize: 12,
  } as React.CSSProperties,

  countBar: {
    display: "flex",
    gap: 16,
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 12,
  } as React.CSSProperties,
};

// --- Sub-components ---

function SortArrow({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
  return <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
}

function CategoryBadges({ categories }: { categories: string[] }) {
  if (!categories.length) return <span style={{ color: "#d1d5db" }}>—</span>;
  const shown = categories.slice(0, 3);
  return (
    <div>
      {shown.map(c => (
        <span key={c} style={s.badge("#92400e", "#fef3c7")}>{c}</span>
      ))}
      {categories.length > 3 && (
        <span style={{ fontSize: 11, color: "#9ca3af" }}>+{categories.length - 3}</span>
      )}
    </div>
  );
}

function ImageStatus({ hasHero, hasGallery }: { hasHero: boolean; hasGallery: boolean }) {
  if (hasHero && hasGallery) return <span style={s.badge("#065f46", "#d1fae5")}>hero + gallery</span>;
  if (hasHero) return <span style={s.badge("#065f46", "#d1fae5")}>hero</span>;
  if (hasGallery) return <span style={s.badge("#1e40af", "#dbeafe")}>gallery only</span>;
  return <span style={s.badge("#991b1b", "#fee2e2")}>none</span>;
}

function DraftBadge({ draft }: { draft: boolean }) {
  if (draft) return <span style={s.badge("#991b1b", "#fee2e2")}>draft</span>;
  return <span style={s.badge("#065f46", "#d1fae5")}>live</span>;
}

// --- Main Component ---

export default function PostManager() {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [draftFilter, setDraftFilter] = useState<DraftFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [imageFilter, setImageFilter] = useState<ImageFilter>("all");

  // Sort
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Pagination
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/posts-admin.json")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message));
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    if (!data) return [];
    let rows = data.posts;

    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q)
      );
    }
    if (draftFilter === "draft") rows = rows.filter(p => p.draft);
    if (draftFilter === "live") rows = rows.filter(p => !p.draft);
    if (categoryFilter) rows = rows.filter(p => p.categories.includes(categoryFilter));
    if (cityFilter) rows = rows.filter(p => p.city === cityFilter);
    if (imageFilter === "has") rows = rows.filter(p => p.hasImages);
    if (imageFilter === "none") rows = rows.filter(p => !p.hasImages);

    // Sort
    rows = [...rows].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title": cmp = a.title.localeCompare(b.title); break;
        case "date": cmp = a.date.localeCompare(b.date); break;
        case "location": cmp = a.location.localeCompare(b.location); break;
        case "city": cmp = a.city.localeCompare(b.city); break;
        case "draft": cmp = (a.draft ? 1 : 0) - (b.draft ? 1 : 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return rows;
  }, [data, search, draftFilter, categoryFilter, cityFilter, imageFilter, sortField, sortDir]);

  // Reset page when filters change
  useEffect(() => { setPage(0); }, [search, draftFilter, categoryFilter, cityFilter, imageFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
  };

  const hasFilters = search || draftFilter !== "all" || categoryFilter || cityFilter || imageFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setDraftFilter("all");
    setCategoryFilter("");
    setCityFilter("");
    setImageFilter("all");
  };

  if (error) {
    return (
      <div style={{ ...s.container, textAlign: "center", paddingTop: 80 }}>
        <p style={{ fontSize: 18, color: "#6b7280" }}>Post data not available.</p>
        <p style={{ fontSize: 14, color: "#9ca3af" }}>Run a build to generate the data. ({error})</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ ...s.container, textAlign: "center", paddingTop: 80 }}>
        <p style={{ fontSize: 16, color: "#6b7280" }}>Loading posts...</p>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <h1 style={s.title}>Post Manager</h1>
        <div style={s.subtitle}>{data.posts.length.toLocaleString()} total posts</div>
      </div>

      {/* Filters */}
      <div style={s.filtersRow}>
        <input
          type="text"
          placeholder="Search title, location, city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={s.searchInput}
        />

        <select value={draftFilter} onChange={e => setDraftFilter(e.target.value as DraftFilter)} style={s.select}>
          <option value="all">All statuses</option>
          <option value="live">Live only</option>
          <option value="draft">Drafts only</option>
        </select>

        <select value={imageFilter} onChange={e => setImageFilter(e.target.value as ImageFilter)} style={s.select}>
          <option value="all">All images</option>
          <option value="has">Has images</option>
          <option value="none">No images</option>
        </select>

        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={s.select}>
          <option value="">All categories</option>
          {data.categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)} style={s.select}>
          <option value="">All cities</option>
          {data.cities.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {hasFilters && (
          <button onClick={clearFilters} style={s.clearBtn}>Clear filters</button>
        )}
      </div>

      {/* Count bar */}
      <div style={s.countBar}>
        <span>
          Showing <strong style={{ color: "#111827" }}>{filtered.length.toLocaleString()}</strong> of {data.posts.length.toLocaleString()}
        </span>
        {draftFilter === "all" && (
          <>
            <span>
              <strong style={{ color: "#065f46" }}>{data.posts.filter(p => !p.draft).length.toLocaleString()}</strong> live
            </span>
            <span>
              <strong style={{ color: "#991b1b" }}>{data.posts.filter(p => p.draft).length.toLocaleString()}</strong> drafts
            </span>
          </>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th} onClick={() => toggleSort("title")}>
                Title <SortArrow field="title" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={s.th} onClick={() => toggleSort("date")}>
                Date <SortArrow field="date" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={s.th}>Categories</th>
              <th style={s.th} onClick={() => toggleSort("location")}>
                Location <SortArrow field="location" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={s.th} onClick={() => toggleSort("city")}>
                City <SortArrow field="city" sortField={sortField} sortDir={sortDir} />
              </th>
              <th style={s.th}>Images</th>
              <th style={s.th} onClick={() => toggleSort("draft")}>
                Status <SortArrow field="draft" sortField={sortField} sortDir={sortDir} />
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map(p => (
              <tr key={p.id} style={p.draft ? { opacity: 0.7 } : undefined}>
                <td style={{ ...s.td, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <a
                    href={`/admin#/collections/edit/post/${p.id}`}
                    target="_blank"
                    rel="noopener"
                    style={s.link}
                    title={p.title}
                  >
                    {p.title}
                  </a>
                </td>
                <td style={{ ...s.td, whiteSpace: "nowrap" }}>{p.date}</td>
                <td style={s.td}><CategoryBadges categories={p.categories} /></td>
                <td style={{ ...s.td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.location || <span style={{ color: "#d1d5db" }}>—</span>}
                </td>
                <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                  {p.city ? (
                    <span>
                      {p.city}
                      {p.hasCoords && <span title="Has GPS" style={{ marginLeft: 4 }}>📍</span>}
                    </span>
                  ) : (
                    <span style={{ color: "#d1d5db" }}>—</span>
                  )}
                </td>
                <td style={s.td}><ImageStatus hasHero={p.hasHero} hasGallery={p.hasGallery} /></td>
                <td style={s.td}><DraftBadge draft={p.draft} /></td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...s.td, textAlign: "center", padding: 32, color: "#9ca3af" }}>
                  No posts match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={s.pagination}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={s.pageBtn(page > 0)}
          >
            ← Previous
          </button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={s.pageBtn(page < totalPages - 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
