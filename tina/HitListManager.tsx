import React, { useState, useEffect, useRef, useCallback } from "react";
import { parseDocument, visit, isScalar, isSeq, Scalar, YAMLSeq } from "yaml";
import {
  formToEntry,
  type HitListEntry,
  type HitListFormState as FormState,
} from "../src/utils/hitlist-entry";

export const HitListIcon = () => (
  <span style={{ fontSize: 16, lineHeight: 1 }}>&#x1F3AF;</span>
);

const REPO_OWNER = "thirstypig";
const REPO_NAME = "thirstypig-blog";
const FILE_PATH = "src/data/places-hitlist.yaml";
// Shared with BucketListManager so one PAT entry covers both screens.
// Same sessionStorage key, same scope guidance (Contents: R+W on both repos).
const TOKEN_KEY = "thirstypig-admin-pat";
const LEGACY_TOKEN_KEY = "hitlist-github-pat";

// Tina's Vite build replaces process.env with a literal containing TINA_PUBLIC_*
// vars. Direct property access (no optional chaining) is required.
const GOOGLE_API_KEY: string = process.env.TINA_PUBLIC_GOOGLE_PLACES_API_KEY || "";

let googleMapsLoadPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (googleMapsLoadPromise) return googleMapsLoadPromise;
  if (typeof google !== "undefined" && google.maps?.places?.Place) {
    return Promise.resolve();
  }
  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error("Failed to load Google Maps SDK"));
    };
    document.head.appendChild(script);
  });
  return googleMapsLoadPromise;
}

interface PlaceSuggestion {
  placeId: string;
  name: string;
  address: string;
  neighborhood: string;
  city: string;
  // Held to defer the Contact-tier fetchFields() call until the user picks one
  // result instead of paying it across every search hit.
  raw: google.maps.places.Place;
}

// Shape returned by /places-hitlist.json (camelCase, no null link values)
interface HitListDisplayItem {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  priority: number;
  dateAdded: string;
  notes: string;
  links: Record<string, string>;
  tags: string[];
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
  placeId: "",
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

// Decode base64 as UTF-8. `atob` returns a Latin-1 binary string; naively using
// it as text corrupts any multi-byte char (é, í, 川…) on every round-trip.
function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function githubGet(token: string) {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  // Avoid interpolating resp.text() into the error — it surfaces in the UI and,
  // while GitHub doesn't echo the Authorization header today, a response body
  // is a fragile place to guard token leaks. resp.statusText is predictable.
  if (!resp.ok) throw new Error(`GitHub GET failed: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  return { content: base64ToUtf8(data.content), sha: data.sha as string };
}

// UTF-8 safe string → base64 (replaces the deprecated unescape() pattern)
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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
      body: JSON.stringify({ message, content: b64, sha }),
    }
  );
  if (!resp.ok) throw new Error(`GitHub PUT failed: ${resp.status} ${resp.statusText}`);
}

interface SelectedPlace {
  name: string;
  neighborhood: string;
  city: string;
  placeId: string;
  website: string;
  googleMapsUrl: string;
}

function NameAutocomplete(props: {
  value: string;
  onChange: (val: string) => void;
  onSelect: (place: SelectedPlace) => void;
}) {
  const { value, onChange, onSelect } = props;
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!GOOGLE_API_KEY) {
      // No key configured — degrade silently to a plain text input. The error
      // is still surfaced as helper text so the operator can fix it.
      setError("No Google Places key set (TINA_PUBLIC_GOOGLE_PLACES_API_KEY) — autocomplete disabled.");
      return;
    }
    loadGoogleMaps()
      .then(() => setReady(true))
      .catch(e => setError(String(e)));
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const search = useCallback(async (query: string) => {
    if (query.length < 3 || !ready) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError("");
    try {
      const { Place } = google.maps.places;
      const { places } = await Place.searchByText({
        textQuery: query,
        // Keep this list lean — anything beyond Basic data tier multiplies cost
        // by the result count. Contact fields (websiteURI, googleMapsURI) are
        // fetched lazily on the row the user actually selects.
        fields: ["id", "displayName", "formattedAddress", "addressComponents"],
        locationBias: new google.maps.Circle({
          center: { lat: 34.0522, lng: -118.2437 },
          radius: 50000,
        }),
        maxResultCount: 5,
        language: "en",
      });
      const mapped: PlaceSuggestion[] = (places || []).map((place) => {
        const components = place.addressComponents || [];
        const findType = (...types: string[]) =>
          components.find((c) => types.some((t) => c.types?.includes(t)));
        const neighborhood =
          findType("neighborhood")?.longText ||
          findType("sublocality_level_1", "sublocality")?.longText ||
          "";
        const city = findType("locality")?.longText || "";
        return {
          placeId: place.id || "",
          name: place.displayName || "",
          address: place.formattedAddress || "",
          neighborhood,
          city,
          raw: place,
        };
      });
      setResults(mapped);
      setShowResults(mapped.length > 0);
      if (inputRef.current && mapped.length > 0) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("ZERO_RESULTS") || msg.includes("not find")) {
        setResults([]);
      } else {
        setError(`Google Places: ${msg}`);
      }
    } finally {
      setSearching(false);
    }
  }, [ready]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => search(val), 400);
  };

  const handlePick = async (suggestion: PlaceSuggestion) => {
    setShowResults(false);
    setResults([]);
    let website = "";
    let googleMapsUrl = "";
    try {
      // One Contact-tier call for the picked place — gives us website + canonical
      // Google Maps URL without paying it across every search result.
      await suggestion.raw.fetchFields({ fields: ["websiteURI", "googleMapsURI"] });
      website = suggestion.raw.websiteURI || "";
      googleMapsUrl = suggestion.raw.googleMapsURI || "";
    } catch {
      // Non-fatal — operator can paste the URLs manually.
    }
    onSelect({
      name: suggestion.name,
      neighborhood: suggestion.neighborhood,
      city: suggestion.city,
      placeId: suggestion.placeId,
      website,
      googleMapsUrl,
    });
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (results.length > 0) setShowResults(true);
          if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
          }
        }}
        onBlur={() => setTimeout(() => setShowResults(false), 200)}
        style={s.input}
        placeholder={ready ? "Type to search Google Places..." : "Sushi Onodera"}
        required
      />
      {searching && (
        <span style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Searching…</span>
      )}
      {error && (
        <p style={{ fontSize: 11, color: "#b91c1c", margin: "4px 0 0" }}>{error}</p>
      )}
      {showResults && results.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width || "100%",
            background: "#ffffff",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            zIndex: 99999,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {results.map((r, i) => (
            <button
              key={r.placeId || i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(r)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                border: "none",
                borderBottom: i < results.length - 1 ? "1px solid #e5e7eb" : "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1.4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f3f4f6")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}>
                {r.name}
              </div>
              <div style={{ color: "#6b7280", fontSize: 12 }}>{r.address}</div>
              {(r.neighborhood || r.city) && (
                <div style={{ color: "#9ca3af", fontSize: 11, marginTop: 2 }}>
                  {[r.neighborhood, r.city].filter(Boolean).join(" · ")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HitListManager() {
  const [items, setItems] = useState<HitListDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [token, setToken] = useState<string>("");
  const [tokenInput, setTokenInput] = useState("");
  const [showTokenForm, setShowTokenForm] = useState(false);

  // Holds the pending "is the new entry live yet?" check. We keep the id so we
  // can ignore stale results if the user submits another entry before the
  // Vercel rebuild completes, and the timer so unmount cleans up.
  const liveCheckRef = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    // sessionStorage (not localStorage) so the PAT dies when the tab closes,
    // narrowing the blast radius of any XSS on /admin.
    let saved = sessionStorage.getItem(TOKEN_KEY);
    if (!saved) {
      // One-time migration from legacy key — copies forward so a user already
      // in a session doesn't have to re-enter when this rolls out.
      const legacy = sessionStorage.getItem(LEGACY_TOKEN_KEY);
      if (legacy) {
        sessionStorage.setItem(TOKEN_KEY, legacy);
        saved = legacy;
      }
    }
    if (saved) setToken(saved);
    else setShowTokenForm(true);
    loadList();
    return () => {
      if (liveCheckRef.current?.timer) clearTimeout(liveCheckRef.current.timer);
    };
  }, []);

  // Auto-dismiss success messages after 8 seconds
  useEffect(() => {
    if (message?.type !== "success") return;
    const t = setTimeout(() => setMessage(null), 8000);
    return () => clearTimeout(t);
  }, [message]);

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
    sessionStorage.setItem(TOKEN_KEY, tokenInput.trim());
    setToken(tokenInput.trim());
    setTokenInput("");
    setShowTokenForm(false);
    setMessage({ type: "success", text: "Token saved for this session. You can now add places to your hit list." });
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken("");
    setShowTokenForm(true);
  }

  // After a successful commit, wait past Vercel's typical rebuild window and
  // re-fetch /places-hitlist.json (with cache-buster). Confirming the new id
  // is live upgrades the banner to success; if it's missing after the wait,
  // point the user at the Vercel dashboard instead of leaving them guessing.
  function scheduleLiveCheck(id: string, name: string) {
    if (liveCheckRef.current?.timer) clearTimeout(liveCheckRef.current.timer);
    const timer = setTimeout(async () => {
      if (liveCheckRef.current?.id !== id) return;
      try {
        const resp = await fetch(`/places-hitlist.json?_=${Date.now()}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const live = Array.isArray(data.items) && data.items.some((i: { id?: unknown }) => i?.id === id);
        if (liveCheckRef.current?.id !== id) return;
        setMessage(
          live
            ? { type: "success", text: `✓ "${name}" is now live on /hitlist.` }
            : { type: "info", text: `Saved "${name}" but not yet live — check the Vercel dashboard if it doesn't appear soon.` }
        );
      } catch (e) {
        if (liveCheckRef.current?.id !== id) return;
        setMessage({
          type: "info",
          text: `Saved "${name}". Could not confirm live status (${(e as Error).message}).`,
        });
      }
    }, 75_000);
    liveCheckRef.current = { id, timer };
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
      // parseDocument preserves per-scalar formatting (quote style, comments) so we can
      // append a new entry without reformatting the whole file.
      const doc = parseDocument(content);
      if (!isSeq(doc.contents)) {
        throw new Error("places-hitlist.yaml is not a list — refusing to overwrite. Check the file.");
      }
      const existing = doc.toJS() as HitListEntry[];
      for (const item of existing) {
        if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.name !== "string") {
          throw new Error(`Existing entry missing required fields (id, name): ${JSON.stringify(item)}`);
        }
      }
      const existingIds = new Set(existing.map(e => e.id));
      const newEntry = formToEntry(form, existingIds);
      // Collection.add accepts an unknown value at runtime and wraps it via the
      // document's schema. The Parsed<> type narrows add()'s signature, so widen
      // to YAMLSeq to let TS accept a plain JS object here. (doc.createNode()
      // doesn't help — it returns Node, not ParsedNode, so the cast is still
      // required. The cast is the cleanest path through yaml v2's types.)
      (doc.contents as YAMLSeq).add(newEntry);

      // Force every date_added scalar to be double-quoted. Astro's file() loader
      // uses js-yaml, which parses bare ISO dates as !!timestamp → JS Date and
      // then fails the z.string() schema. Visiting every pair (not just the new
      // one) also repairs any poisoned pre-existing entries.
      visit(doc, {
        Pair(_key, pair) {
          const key = isScalar(pair.key) ? pair.key.value : null;
          if (key === "date_added" && isScalar(pair.value)) {
            pair.value.type = Scalar.QUOTE_DOUBLE;
          }
        },
      });

      const yaml = doc.toString({ lineWidth: 0 });
      const commitMsg = `Add ${newEntry.name} to hit list`;

      await githubPut(token, yaml, sha, commitMsg);

      // Optimistically show the new entry in the table (JSON endpoint won't update until rebuild)
      const displayItem: HitListDisplayItem = {
        id: newEntry.id,
        name: newEntry.name,
        neighborhood: newEntry.neighborhood || "",
        city: newEntry.city,
        priority: newEntry.priority,
        dateAdded: newEntry.date_added,
        notes: newEntry.notes || "",
        links: Object.fromEntries(
          Object.entries(newEntry.links).filter(([, v]) => v != null) as [string, string][]
        ),
        tags: newEntry.tags,
      };
      setItems(prev => [...prev, displayItem]);

      setMessage({
        type: "info",
        text: `Saved "${newEntry.name}" to GitHub. Vercel is rebuilding — checking if it's live in ~75s…`,
      });
      setForm(emptyForm);
      scheduleLiveCheck(newEntry.id, newEntry.name);
    } catch (e) {
      setMessage({ type: "error", text: `Failed to save: ${(e as Error).message}` });
    } finally {
      setSubmitting(false);
    }
  }

  // Show only the public prefix ("github_pat_") — never reveal the secret suffix
  const tokenMasked = token ? `${token.slice(0, 11)}…` : "(not set)";

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
            The token is stored in your browser's sessionStorage and is cleared when you close this tab.
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
            Scope: <strong>Only select repositories → thirstypig-blog</strong> AND <strong>jameschang.co</strong>{" "}
            (so the same token also covers the Bucket List Manager).
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
            <NameAutocomplete
              value={form.name}
              onChange={(val) =>
                // Manual edits invalidate the previously-picked place_id —
                // clear it so we don't ship a stale ChIJ id with a renamed venue.
                setForm((f) => ({ ...f, name: val, placeId: "" }))
              }
              onSelect={(place) =>
                setForm((f) => ({
                  ...f,
                  name: place.name,
                  neighborhood: place.neighborhood || f.neighborhood,
                  city: place.city || f.city,
                  // Don't clobber URLs the operator already pasted.
                  website: f.website || place.website,
                  google: f.google || place.googleMapsUrl,
                  placeId: place.placeId,
                }))
              }
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
                  <td style={s.td}>{item.dateAdded}</td>
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
