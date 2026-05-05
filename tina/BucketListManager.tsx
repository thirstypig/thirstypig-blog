import React, { useState, useEffect, useRef } from "react";

export const BucketListIcon = () => (
  <span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F5FB;</span>
);

// CROSS-REPO: this admin lives in thirstypig.com but writes to jameschang.co.
// PAT must have Contents: Read+Write on thirstypig/jameschang.co.
const REPO_OWNER = "thirstypig";
const REPO_NAME = "jameschang.co";
const FILE_PATH = "bucketlist.json";
const PUBLIC_URL = "https://jameschang.co/bucketlist/";
const PUBLIC_JSON = "https://jameschang.co/bucketlist.json";
const TOKEN_KEY = "bucketlist-github-pat";

type Priority = "high" | "medium" | "low" | null;
type Difficulty = "easy" | "hard" | null;
type Status = "todo" | "done";

interface BucketListItem {
  id: string;
  title: string;
  note: string;
  status: Status;
  completed_date: string | null;
  priority: Priority;
  difficulty: Difficulty;
}

interface BucketListData {
  items: BucketListItem[];
  last_updated: string;
}

const PRI_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

// ── Styles (same vocabulary as HitListManager) ────────────────────
const s = {
  container: {
    maxWidth: 1000,
    margin: "0 auto",
    padding: "24px 24px 80px",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#1f2937",
  } as React.CSSProperties,
  header: {
    marginBottom: 16,
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 16,
  } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, margin: 0, color: "#111827" } as React.CSSProperties,
  subtitle: { fontSize: 13, color: "#9ca3af", marginTop: 4 } as React.CSSProperties,
  banner: {
    background: "#fef3c7",
    border: "1px solid #fcd34d",
    color: "#78350f",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 1.5,
  } as React.CSSProperties,
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
  row: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" as const } as React.CSSProperties,
  field: { flex: "1 1 200px", minWidth: 160, display: "flex", flexDirection: "column" as const } as React.CSSProperties,
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
    minHeight: 50,
    resize: "vertical" as const,
  } as React.CSSProperties,
  radioGroup: { display: "flex", gap: 12, alignItems: "center" } as React.CSSProperties,
  radioLabel: { display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" } as React.CSSProperties,
  btn: (primary: boolean, disabled?: boolean) => ({
    padding: "8px 14px",
    borderRadius: 6,
    border: primary ? "none" : "1px solid #d1d5db",
    background: disabled ? "#d1d5db" : primary ? "#0f766e" : "#fff",
    color: primary ? "#fff" : "#374151",
    fontSize: 13,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  }) as React.CSSProperties,
  iconBtn: (disabled?: boolean) => ({
    padding: "4px 8px",
    border: "1px solid #d1d5db",
    background: "#fff",
    borderRadius: 4,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "#d1d5db" : "#374151",
    fontFamily: "inherit",
  }) as React.CSSProperties,
  message: (type: "success" | "error" | "info") => ({
    padding: "10px 12px",
    borderRadius: 6,
    fontSize: 13,
    marginBottom: 12,
    background: type === "success" ? "#d1fae5" : type === "error" ? "#fee2e2" : "#dbeafe",
    color: type === "success" ? "#065f46" : type === "error" ? "#991b1b" : "#1e40af",
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
  td: { padding: "8px 10px", borderBottom: "1px solid #f3f4f6", color: "#374151", verticalAlign: "top" as const } as React.CSSProperties,
  chip: (color: string, bg: string) => ({
    display: "inline-block",
    padding: "1px 7px",
    borderRadius: 9999,
    fontSize: 11,
    fontWeight: 500,
    color,
    background: bg,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
  }) as React.CSSProperties,
  helpText: { fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.5 } as React.CSSProperties,
  link: { color: "#2563eb", textDecoration: "none" } as React.CSSProperties,
};

const PRI_CHIP: Record<string, React.CSSProperties> = {
  high: s.chip("#92400e", "#fef3c7"),
  medium: s.chip("#374151", "#f3f4f6"),
  low: s.chip("#1e40af", "#dbeafe"),
};
const DIFF_CHIP: Record<string, React.CSSProperties> = {
  easy: s.chip("#065f46", "#d1fae5"),
  hard: s.chip("#991b1b", "#fee2e2"),
};

// ── Encoding helpers (UTF-8 safe round trip) ──────────────────────
function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// ── GitHub Contents API ───────────────────────────────────────────
async function githubGet(token: string) {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (!resp.ok) throw new Error(`GitHub GET failed: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  return { content: base64ToUtf8(data.content), sha: data.sha as string };
}

async function githubPut(token: string, newContent: string, sha: string, message: string) {
  const b64 = utf8ToBase64(newContent);
  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content: b64, sha, branch: "main" }),
    }
  );
  if (!resp.ok) throw new Error(`GitHub PUT failed: ${resp.status} ${resp.statusText}`);
  const result = await resp.json();
  return result.content.sha as string; // new sha for next write
}

// ── Slug helper ───────────────────────────────────────────────────
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "item";
}

function uniqueId(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// ── Form state for new entries / edits ───────────────────────────
interface FormState {
  title: string;
  note: string;
  priority: Priority;
  difficulty: Difficulty;
}
const emptyForm: FormState = { title: "", note: "", priority: "medium", difficulty: null };

// ── Component ─────────────────────────────────────────────────────
export default function BucketListManager() {
  const [items, setItems] = useState<BucketListItem[]>([]);
  const [sha, setSha] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const dismissTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Auto-dismiss success messages after 6s.
  useEffect(() => {
    if (message?.type !== "success") return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => setMessage(null), 6000);
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [message]);

  // Initial load.
  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) {
      setToken(saved);
      reload(saved);
    } else {
      setShowTokenForm(true);
      // Read-only fallback so the user sees existing items even pre-token.
      loadPublicReadOnly();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPublicReadOnly() {
    setLoading(true);
    try {
      const resp = await fetch(PUBLIC_JSON);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as BucketListData;
      setItems(data.items || []);
    } catch (e) {
      setMessage({ type: "error", text: `Read-only load failed: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  async function reload(activeToken?: string) {
    const t = activeToken || token;
    if (!t) {
      loadPublicReadOnly();
      return;
    }
    setLoading(true);
    try {
      const { content, sha: newSha } = await githubGet(t);
      const data = JSON.parse(content) as BucketListData;
      setItems(data.items || []);
      setSha(newSha);
    } catch (e) {
      setMessage({ type: "error", text: `Failed to load from GitHub: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  }

  function saveToken() {
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    sessionStorage.setItem(TOKEN_KEY, trimmed);
    setToken(trimmed);
    setTokenInput("");
    setShowTokenForm(false);
    setMessage({ type: "success", text: "Token saved for this session." });
    reload(trimmed);
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setShowTokenForm(true);
  }

  // Commit a new items array. Used by every mutation (add / edit / delete /
  // toggle / reorder) so the GitHub PUT logic lives in exactly one place.
  async function commit(nextItems: BucketListItem[], message: string) {
    if (!token) {
      setMessage({ type: "error", text: "Add a GitHub token first." });
      setShowTokenForm(true);
      return;
    }
    setSubmitting(true);
    setMessage({ type: "info", text: "Saving…" });
    try {
      const payload: BucketListData = {
        items: nextItems,
        last_updated: new Date().toISOString(),
      };
      const newSha = await githubPut(token, JSON.stringify(payload, null, 2) + "\n", sha, message);
      setItems(nextItems);
      setSha(newSha);
      setMessage({ type: "success", text: `Saved · ${message} · live in ~60s on jameschang.co/bucketlist/` });
    } catch (e) {
      setMessage({ type: "error", text: `Save failed: ${(e as Error).message} · try reloading to fetch a fresh sha.` });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Mutations ───────────────────────────────────────────────────
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) {
      setMessage({ type: "error", text: "Title is required." });
      return;
    }
    const existingIds = new Set(items.map(i => i.id));
    const id = uniqueId(slugify(title), existingIds);
    const newItem: BucketListItem = {
      id,
      title,
      note: form.note.trim(),
      status: "todo",
      completed_date: null,
      priority: form.priority,
      difficulty: form.difficulty,
    };
    await commit([...items, newItem], `Add "${title}" to bucket list`);
    setForm(emptyForm);
  }

  function startEdit(item: BucketListItem) {
    setEditingId(item.id);
    setEditForm({
      title: item.title,
      note: item.note,
      priority: item.priority,
      difficulty: item.difficulty,
    });
  }
  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }
  async function saveEdit(id: string) {
    const title = editForm.title.trim();
    if (!title) {
      setMessage({ type: "error", text: "Title is required." });
      return;
    }
    const next = items.map(i =>
      i.id === id
        ? {
            ...i,
            title,
            note: editForm.note.trim(),
            priority: editForm.priority,
            difficulty: editForm.difficulty,
          }
        : i
    );
    await commit(next, `Edit "${title}" in bucket list`);
    cancelEdit();
  }

  async function toggleDone(item: BucketListItem) {
    const nowIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const next = items.map(i =>
      i.id === item.id
        ? {
            ...i,
            status: (i.status === "todo" ? "done" : "todo") as Status,
            completed_date: i.status === "todo" ? nowIso : null,
          }
        : i
    );
    await commit(
      next,
      item.status === "todo" ? `Mark "${item.title}" done` : `Reopen "${item.title}"`
    );
  }

  async function handleDelete(item: BucketListItem) {
    if (!confirm(`Delete "${item.title}" from the bucket list?`)) return;
    const next = items.filter(i => i.id !== item.id);
    await commit(next, `Remove "${item.title}" from bucket list`);
  }

  async function move(id: string, dir: -1 | 1) {
    // Only allow reordering within items of the same status (todo/done) since
    // the public render groups by status.
    const target = items.find(i => i.id === id);
    if (!target) return;
    const peers = items.filter(i => i.status === target.status);
    const peerIdx = peers.findIndex(i => i.id === id);
    const swapPeer = peers[peerIdx + dir];
    if (!swapPeer) return;
    const swapIdx = items.findIndex(i => i.id === swapPeer.id);
    const targetIdx = items.findIndex(i => i.id === id);
    const next = [...items];
    [next[targetIdx], next[swapIdx]] = [next[swapIdx], next[targetIdx]];
    await commit(next, `Reorder "${target.title}"`);
  }

  // Sort for display: status first (todo over done), then by priority, then by array order.
  const sortedItems = [...items]
    .map((item, idx) => ({ item, idx }))
    .sort((a, b) => {
      if (a.item.status !== b.item.status) return a.item.status === "todo" ? -1 : 1;
      const pa = PRI_RANK[a.item.priority || ""] ?? 99;
      const pb = PRI_RANK[b.item.priority || ""] ?? 99;
      if (pa !== pb) return pa - pb;
      return a.idx - b.idx;
    })
    .map(x => x.item);

  const tokenMasked = token ? `${token.slice(0, 11)}…` : "(not set)";
  const todoCount = items.filter(i => i.status === "todo").length;
  const doneCount = items.filter(i => i.status === "done").length;

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={s.title}>Bucket List Manager</h1>
        <div style={s.subtitle}>
          {todoCount} to do · {doneCount} done · sorted by priority within status
        </div>
      </div>

      <div style={s.banner}>
        <strong>Cross-repo write:</strong> this manager edits{" "}
        <a href={`https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/main/${FILE_PATH}`} target="_blank" rel="noopener noreferrer" style={s.link}>
          {REPO_OWNER}/{REPO_NAME}/{FILE_PATH}
        </a>{" "}
        — changes go live within ~60s at{" "}
        <a href={PUBLIC_URL} target="_blank" rel="noopener noreferrer" style={s.link}>
          {PUBLIC_URL}
        </a>{" "}
        and on the top-5 teaser at{" "}
        <a href="https://jameschang.co/now/" target="_blank" rel="noopener noreferrer" style={s.link}>
          jameschang.co/now
        </a>
        .
      </div>

      {message && <div style={s.message(message.type)}>{message.text}</div>}

      {/* Token setup */}
      {showTokenForm ? (
        <div style={s.card}>
          <div style={s.cardTitle}>GitHub Token Required</div>
          <p style={s.helpText}>
            Paste a fine-grained PAT scoped to <strong>{REPO_OWNER}/{REPO_NAME}</strong> with{" "}
            <strong>Contents: Read and write</strong>. Stored in sessionStorage and cleared when this tab closes.
          </p>
          <p style={s.helpText}>
            Create one at{" "}
            <a
              href={`https://github.com/settings/personal-access-tokens/new`}
              target="_blank"
              rel="noopener noreferrer"
              style={s.link}
            >
              github.com/settings/personal-access-tokens/new
            </a>
            .
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
          {" · "}
          <button
            onClick={() => reload()}
            style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontSize: 12 }}
          >
            (reload from GitHub)
          </button>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} style={s.card}>
        <div style={s.cardTitle}>Add to Bucket List</div>

        <div style={s.row}>
          <div style={{ ...s.field, flex: "2 1 300px" }}>
            <label style={s.label}>Title *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              style={s.input}
              placeholder="e.g., Hike the Inca Trail"
            />
          </div>
        </div>
        <div style={s.row}>
          <div style={{ ...s.field, flex: "1 1 100%" }}>
            <label style={s.label}>Note (optional)</label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              style={s.textarea}
              placeholder="Optional one-liner shown next to the title."
            />
          </div>
        </div>
        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Priority</label>
            <div style={s.radioGroup}>
              {(["high", "medium", "low"] as const).map(p => (
                <label key={p} style={s.radioLabel}>
                  <input
                    type="radio"
                    name="new-priority"
                    checked={form.priority === p}
                    onChange={() => setForm(f => ({ ...f, priority: p }))}
                  />
                  {p}
                </label>
              ))}
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Difficulty</label>
            <div style={s.radioGroup}>
              {(["easy", "hard"] as const).map(d => (
                <label key={d} style={s.radioLabel}>
                  <input
                    type="radio"
                    name="new-difficulty"
                    checked={form.difficulty === d}
                    onChange={() => setForm(f => ({ ...f, difficulty: d }))}
                  />
                  {d}
                </label>
              ))}
              <label style={s.radioLabel}>
                <input
                  type="radio"
                  name="new-difficulty"
                  checked={form.difficulty === null}
                  onChange={() => setForm(f => ({ ...f, difficulty: null }))}
                />
                unset
              </label>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button type="submit" style={s.btn(true, submitting || !form.title.trim())} disabled={submitting || !form.title.trim()}>
            {submitting ? "Saving…" : "Add to bucket list"}
          </button>
        </div>
      </form>

      {/* Items table */}
      <div style={s.card}>
        <div style={s.cardTitle}>Current items</div>
        {loading ? (
          <div style={s.helpText}>Loading…</div>
        ) : sortedItems.length === 0 ? (
          <div style={s.helpText}>No items yet. Add one above.</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Order</th>
                <th style={s.th}>Title</th>
                <th style={s.th}>Priority</th>
                <th style={s.th}>Difficulty</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Done</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map(item => {
                const isEditing = editingId === item.id;
                return (
                  <tr key={item.id} style={item.status === "done" ? { opacity: 0.6 } : undefined}>
                    <td style={s.td}>
                      <button
                        onClick={() => move(item.id, -1)}
                        disabled={submitting}
                        style={s.iconBtn(submitting)}
                        title="Move up within priority"
                      >
                        ↑
                      </button>{" "}
                      <button
                        onClick={() => move(item.id, 1)}
                        disabled={submitting}
                        style={s.iconBtn(submitting)}
                        title="Move down within priority"
                      >
                        ↓
                      </button>
                    </td>
                    <td style={s.td}>
                      {isEditing ? (
                        <>
                          <input
                            type="text"
                            value={editForm.title}
                            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                            style={{ ...s.input, width: "100%", marginBottom: 6 }}
                          />
                          <textarea
                            value={editForm.note}
                            onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                            style={{ ...s.textarea, width: "100%", minHeight: 40 }}
                            placeholder="Note"
                          />
                        </>
                      ) : (
                        <>
                          <strong>{item.title}</strong>
                          {item.note && <div style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>{item.note}</div>}
                        </>
                      )}
                    </td>
                    <td style={s.td}>
                      {isEditing ? (
                        <select
                          value={editForm.priority || ""}
                          onChange={e =>
                            setEditForm(f => ({ ...f, priority: (e.target.value || null) as Priority }))
                          }
                          style={s.input}
                        >
                          <option value="">unset</option>
                          <option value="high">high</option>
                          <option value="medium">medium</option>
                          <option value="low">low</option>
                        </select>
                      ) : item.priority ? (
                        <span style={PRI_CHIP[item.priority]}>{item.priority}</span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                    <td style={s.td}>
                      {isEditing ? (
                        <select
                          value={editForm.difficulty || ""}
                          onChange={e =>
                            setEditForm(f => ({ ...f, difficulty: (e.target.value || null) as Difficulty }))
                          }
                          style={s.input}
                        >
                          <option value="">unset</option>
                          <option value="easy">easy</option>
                          <option value="hard">hard</option>
                        </select>
                      ) : item.difficulty ? (
                        <span style={DIFF_CHIP[item.difficulty]}>{item.difficulty}</span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>
                    <td style={s.td}>{item.status}</td>
                    <td style={s.td}>{item.completed_date || <span style={{ color: "#9ca3af" }}>—</span>}</td>
                    <td style={s.td}>
                      {isEditing ? (
                        <>
                          <button onClick={() => saveEdit(item.id)} disabled={submitting} style={s.btn(true, submitting)}>
                            Save
                          </button>{" "}
                          <button onClick={cancelEdit} disabled={submitting} style={s.btn(false, submitting)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(item)} disabled={submitting} style={s.iconBtn(submitting)}>
                            Edit
                          </button>{" "}
                          <button onClick={() => toggleDone(item)} disabled={submitting} style={s.iconBtn(submitting)}>
                            {item.status === "todo" ? "Mark done" : "Reopen"}
                          </button>{" "}
                          <button
                            onClick={() => handleDelete(item)}
                            disabled={submitting}
                            style={{ ...s.iconBtn(submitting), color: "#991b1b" }}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
