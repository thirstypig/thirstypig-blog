import React, { useState, useEffect } from "react";
import { parse, stringify } from "yaml";

export const HitListIcon = () => (
  <span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F3AF;</span>
);

const REPO_OWNER = "thirstypig";
const REPO_NAME = "thirstypig-blog";
const FILE_PATH = "src/data/places-hitlist.yaml";
const TOKEN_KEY = "hitlist-github-pat";

interface HitListEntry {
  id: string;
  name: string;
  neighborhood?: string;
  city: string;
  priority: number;
  date_added: string;
  notes?: string;
  links: Record<string, string | null>;
  tags: string[];
}

interface FormState {
  name: string;
  neighborhood: string;
  city: string;
  priority: number;
  notes: string;
  yelp: string;
  google: string;
  instagram: string;
  resy: string;
  opentable: string;
  website: string;
  tags: string;
}

const emptyForm: FormState = {
  name: "",
  neighborhood: "",
  city: "",
  priority: 2,
  notes: "",
  yelp: "",
  google: "",
  instagram: "",
  resy: "",
  opentable: "",
  website: "",
  tags: "",
};

const s = {
  container: {
    maxWidth: 900,
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
  title: { fontSize: 24, fontWeight: 700, margin: 0, color: "#111827" } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "#9ca3af", marginTop: 4 } as React.CSSProperties,
  card: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    padding: 20,
    marginBottom: 20,
  } as React.CSSProperties,
  cardTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#374151",
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    marginBottom: 16,
  } as React.CSSProperties,
  row: { display: "flex", gap: 12, marginBottom: 12 } as React.CSSProperties,
  field: { flex: 1, display: "flex", flexDirection: "column" as const } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 4 } as React.CSSProperties,
  input: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    color: "#374151",
    background: "#fff",
    fontFamily: "inherit",
  } as React.CSSProperties,
  textarea: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    color: "#374151",
    background: "#fff",
    fontFamily: "inherit",
    minHeight: 60,
    resize: "vertical" as const,
  } as React.CSSProperties,
  select: {
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid #d1d5db",
    fontSize: 13,
    color: "#374151",
    background: "#fff",
    fontFamily: "inherit",
  } as React.CSSProperties,
  btn: (primary: boolean, disabled?: boolean) => ({
    padding: "10px 18px",
    borderRadius: 6,
    border: primary ? "none" : "1px solid #d1d5db",
    background: disabled ? "#d1d5db" : primary ? "#b45309" : "#fff",
    color: primary ? "#fff" : "#374151",
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  }) as React.CSSProperties,
  message: (type: "success" | "error" | "info") => ({
    padding: "10px 12px",
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
    background:
      type === "success" ? "#d1fae5" : type === "error" ? "#fee2e2" : "#dbeafe",
    color:
      type === "success" ? "#065f46" : type === "error" ? "#991b1b" : "#1e40af",
  }) as React.CSSProperties,
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 } as React.CSSProperties,
  th: {
    textAlign: "left" as const,
    padding: "8px 10px",
    borderBottom: "2px solid #e5e7eb",
    color: "#6b7280",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase" as const,
  } as React.CSSProperties,
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid #f3f4f6",
    color: "#374151",
  } as React.CSSProperties,
  badge: (priority: number) => ({
    display: "inline-block",
    padding: "1px 7px",
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
    color: priority === 1 ? "#92400e" : priority === 3 ? "#1e40af" : "#374151",
    background: priority === 1 ? "#fef3c7" : priority === 3 ? "#dbeafe" : "#f3f4f6",
  }) as React.CSSProperties,
  helpText: { fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 } as React.CSSProperties,
  link: { color: "#2563eb", textDecoration: "none" } as React.CSSProperties,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function formToEntry(form: FormState, existingIds: Set<string>): HitListEntry {
  let id = slugify(form.name);
  if (existingIds.has(id)) {
    let n = 2;
    while (existingIds.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  const today = new Date().toISOString().split("T")[0];

  const links: Record<string, string> = {};
  if (form.yelp.trim()) links.yelp = form.yelp.trim();
  if (form.google.trim()) links.google = form.google.trim();
  if (form.instagram.trim()) links.instagram = form.instagram.trim();
  if (form.resy.trim()) links.resy = form.resy.trim();
  if (form.opentable.trim()) links.opentable = form.opentable.trim();
  if (form.website.trim()) links.website = form.website.trim();

  const tags = form.tags
    .split(",")
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  const entry: HitListEntry = {
    id,
    name: form.name.trim(),
    city: form.city.trim(),
    priority: form.priority,
    date_added: today,
    links,
    tags,
  };

  if (form.neighborhood.trim()) entry.neighborhood = form.neighborhood.trim();
  if (form.notes.trim()) entry.notes = form.notes.trim();

  return entry;
}

async function githubGet(token: string) {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!resp.ok) throw new Error(`GitHub GET failed: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  const content = atob(data.content.replace(/\n/g, ""));
  return { content, sha: data.sha as string };
}

async function githubPut(token: string, newContent: string, sha: string, message: string) {
  const b64 = btoa(unescape(encodeURIComponent(newContent)));
  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content: b64, sha }),
    }
  );
  if (!resp.ok) throw new Error(`GitHub PUT failed: ${resp.status} ${await resp.text()}`);
}

export default function HitListManager() {
  const [items, setItems] = useState<HitListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY);
    if (saved) setToken(saved);
    else setShowTokenForm(true);
    loadList();
  }, []);

  async function loadList() {
    setLoading(true);
    try {
      const resp = await fetch("/places-hitlist.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setItems(data.items || []);
    } catch (e) {
      setMessage({ type: "error", text: `Failed to load hit list: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  function saveToken() {
    if (!tokenInput.trim()) return;
    localStorage.setItem(TOKEN_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
    setTokenInput("");
    setShowTokenForm(false);
    setMessage({ type: "success", text: "Token saved. You can now add places to your hit list." });
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setShowTokenForm(true);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      setMessage({ type: "error", text: "Please add your GitHub token first." });
      setShowTokenForm(true);
      return;
    }
    if (!form.name.trim() || !form.city.trim()) {
      setMessage({ type: "error", text: "Name and city are required." });
      return;
    }

    setSubmitting(true);
    setMessage({ type: "info", text: "Saving to GitHub..." });

    try {
      const { content, sha } = await githubGet(token);
      const existing = (parse(content) || []) as HitListEntry[];
      const existingIds = new Set(existing.map(e => e.id));
      const newEntry = formToEntry(form, existingIds);
      existing.push(newEntry);

      const yaml = stringify(existing, { lineWidth: 0 });
      const commitMsg = `Add ${newEntry.name} to hit list`;

      await githubPut(token, yaml, sha, commitMsg);

      setMessage({
        type: "success",
        text: `Saved "${newEntry.name}" to hit list. Vercel is rebuilding now — it will appear on /hitlist in about a minute.`,
      });
      setForm(emptyForm);
      setTimeout(loadList, 3000);
    } catch (e) {
      setMessage({ type: "error", text: `Failed to save: ${(e as Error).message}` });
    } finally {
      setSubmitting(false);
    }
  }

  const tokenMasked = token ? `${token.slice(0, 8)}…${token.slice(-4)}` : "(not set)";

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={s.title}>Hit List Manager</h1>
        <div style={s.subtitle}>
          {items.length} places on the list · Add new restaurants and commit directly to the repo
        </div>
      </div>

      {message && <div style={s.message(message.type)}>{message.text}</div>}

      {/* Token setup */}
      {showTokenForm ? (
        <div style={s.card}>
          <div style={s.cardTitle}>GitHub Token Required</div>
          <p style={s.helpText}>
            To commit new entries, paste a GitHub fine-grained personal access token below.
            The token is stored in your browser's localStorage (only on this device).
          </p>
          <p style={s.helpText}>
            Create one at:{" "}
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noopener noreferrer"
              style={s.link}
            >
              github.com/settings/personal-access-tokens/new
            </a>
            <br />
            Scope: <strong>Only select repositories → thirstypig-blog</strong>.
            Permission: <strong>Repository permissions → Contents → Read and write</strong>.
          </p>
          <div style={{ ...s.row, marginTop: 12 }}>
            <input
              type="password"
              placeholder="github_pat_..."
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              style={{ ...s.input, flex: 1 }}
            />
            <button onClick={saveToken} style={s.btn(true)} disabled={!tokenInput.trim()}>
              Save Token
            </button>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
          Token: {tokenMasked}{" "}
          <button
            onClick={clearToken}
            style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 12 }}
          >
            (change)
          </button>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleSubmit} style={s.card}>
        <div style={s.cardTitle}>Add to Hit List</div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => updateForm("name", e.target.value)}
              style={s.input}
              placeholder="Sushi Onodera"
              required
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Neighborhood</label>
            <input
              type="text"
              value={form.neighborhood}
              onChange={e => updateForm("neighborhood", e.target.value)}
              style={s.input}
              placeholder="Beverly Hills"
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>City *</label>
            <input
              type="text"
              value={form.city}
              onChange={e => updateForm("city", e.target.value)}
              style={s.input}
              placeholder="Los Angeles"
              required
            />
          </div>
          <div style={{ ...s.field, flex: "0 0 120px" }}>
            <label style={s.label}>Priority</label>
            <select
              value={form.priority}
              onChange={e => updateForm("priority", Number(e.target.value))}
              style={s.select}
            >
              <option value={1}>1 – Must Try</option>
              <option value={2}>2 – Want to Try</option>
              <option value={3}>3 – Curious</option>
            </select>
          </div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Notes</label>
            <textarea
              value={form.notes}
              onChange={e => updateForm("notes", e.target.value)}
              style={s.textarea}
              placeholder="Omakase, reservations 2 weeks out, splurge"
            />
          </div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Yelp URL</label>
            <input
              type="url"
              value={form.yelp}
              onChange={e => updateForm("yelp", e.target.value)}
              style={s.input}
              placeholder="https://www.yelp.com/biz/..."
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Google Maps URL</label>
            <input
              type="url"
              value={form.google}
              onChange={e => updateForm("google", e.target.value)}
              style={s.input}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Instagram URL</label>
            <input
              type="url"
              value={form.instagram}
              onChange={e => updateForm("instagram", e.target.value)}
              style={s.input}
              placeholder="https://www.instagram.com/..."
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Website</label>
            <input
              type="url"
              value={form.website}
              onChange={e => updateForm("website", e.target.value)}
              style={s.input}
              placeholder="https://..."
            />
          </div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Resy URL</label>
            <input
              type="url"
              value={form.resy}
              onChange={e => updateForm("resy", e.target.value)}
              style={s.input}
              placeholder="https://resy.com/..."
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>OpenTable URL</label>
            <input
              type="url"
              value={form.opentable}
              onChange={e => updateForm("opentable", e.target.value)}
              style={s.input}
              placeholder="https://www.opentable.com/..."
            />
          </div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tags}
              onChange={e => updateForm("tags", e.target.value)}
              style={s.input}
              placeholder="sushi, omakase, splurge"
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button type="submit" disabled={submitting} style={s.btn(true, submitting)}>
            {submitting ? "Saving..." : "Add to Hit List"}
          </button>
        </div>
      </form>

      {/* Current list */}
      <div style={s.card}>
        <div style={s.cardTitle}>Current Hit List</div>
        {loading ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Loading...</p>
        ) : items.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>No places yet. Add one above.</p>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Name</th>
                <th style={s.th}>Location</th>
                <th style={s.th}>Priority</th>
                <th style={s.th}>Added</th>
                <th style={s.th}>Tags</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={s.td}>{item.name}</td>
                  <td style={s.td}>
                    {item.neighborhood ? `${item.neighborhood}, ${item.city}` : item.city}
                  </td>
                  <td style={s.td}>
                    <span style={s.badge(item.priority)}>
                      {item.priority === 1 ? "Must Try" : item.priority === 3 ? "Curious" : "Want to Try"}
                    </span>
                  </td>
                  <td style={s.td}>{(item as any).dateAdded || item.date_added}</td>
                  <td style={s.td}>{item.tags.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
