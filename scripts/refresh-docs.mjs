#!/usr/bin/env node
/**
 * refresh-docs.mjs — regenerate the LIVING docs from real repo data.
 *
 * Writes:
 *   docs/under-the-hood/stats.md          (6a)
 *   docs/under-the-hood/costs.md          (6b)  ← inputs: docs/costs.config.json
 *   docs/under-the-hood/system-status.md  (6c)
 *   README.md + CLAUDE.md status snippet  (6d)  ← between DOCS:STATUS markers
 *
 * Run it before every push:  npm run docs:refresh
 * Or wire `--check` into a pre-push hook to fail on staleness.
 *
 * Design notes:
 *  - File walking uses `git ls-files`, which respects .gitignore exactly. Parsing
 *    .gitignore by hand gets negation patterns and directory rules subtly wrong.
 *  - Nothing here reads a secret VALUE. system-status.md reports presence only.
 *  - Every count is asserted. A generator that silently emits zeros is the
 *    silent-success failure this project keeps hitting.
 */

import fs from "node:fs";
import path from "node:path";
// execFileSync (argv array), not execSync (shell string): no shell is spawned, so
// nothing here can ever be shell-injected even if an argument later becomes dynamic.
import { execFileSync } from "node:child_process";

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const ROOT = process.cwd();
const P = (...s) => path.join(ROOT, ...s);
const CHECK = process.argv.includes("--check");

const GEN_HEADER = (script) =>
  `<!-- GENERATED FILE — do not hand-edit.\n     Regenerate with: npm run docs:refresh  (${script})\n     Hand edits are lost silently. -->`;

const today = () => new Date().toISOString().slice(0, 10);

const fm = (id, type, tags) =>
  [
    "---",
    `id: ${id}`,
    `type: ${type}`,
    "status: active",
    "phase: null",
    "owner: james",
    `tags: [${tags.join(", ")}]`,
    "links: [DOC-001]",
    `updated: "${today()}"`,
    "---",
  ].join("\n");

// ── repo facts ───────────────────────────────────────────────────────

function trackedFiles() {
  // git ls-files respects .gitignore by construction.
  //
  // -z is REQUIRED, not a nicety. Without it git applies core.quotePath and emits
  // non-ASCII paths as C-style quoted strings:
  //     "src/content/posts/2007-04-09-bellagio-\351\271\277\346\270\257...md"
  // That path does not end in ".md", so every CJK-named file silently drops out of
  // the counts. This repo has 227 of them — a fifth of the archive — and the failure
  // is invisible: the numbers just come out low. -z emits raw bytes, NUL-separated.
  return git("ls-files", "-z").split("\0").filter(Boolean);
}

const CODE_EXT = {
  ".ts": "TypeScript", ".tsx": "TypeScript (React)", ".mjs": "JavaScript (ESM)",
  ".js": "JavaScript", ".astro": "Astro", ".py": "Python", ".css": "CSS",
  ".md": "Markdown", ".json": "JSON", ".yaml": "YAML", ".yml": "YAML",
};

function locByType(files) {
  const acc = new Map();
  for (const f of files) {
    const ext = path.extname(f);
    const label = CODE_EXT[ext];
    if (!label) continue;
    let lines = 0;
    try {
      const abs = P(f);
      if (!fs.existsSync(abs)) continue;
      if (fs.statSync(abs).size > 4 * 1024 * 1024) continue; // skip huge data blobs
      lines = fs.readFileSync(abs, "utf8").split("\n").length;
    } catch { continue; }
    const cur = acc.get(label) ?? { files: 0, lines: 0 };
    cur.files += 1; cur.lines += lines;
    acc.set(label, cur);
  }
  return [...acc.entries()].sort((a, b) => b[1].lines - a[1].lines);
}

function routeCounts(files) {
  const pages = files.filter((f) => f.startsWith("src/pages/"));
  const isEndpoint = (f) => /\.(json|xml)\.(ts|js)$/.test(f);
  const isDynamic = (f) => /\[.+\]/.test(path.basename(f));
  return {
    total: pages.length,
    endpoints: pages.filter(isEndpoint).length,
    dynamic: pages.filter((f) => isDynamic(f) && !isEndpoint(f)).length,
    static: pages.filter((f) => !isDynamic(f) && !isEndpoint(f)).length,
  };
}

// ── docs index ───────────────────────────────────────────────────────

function readFrontmatter(abs) {
  const raw = fs.readFileSync(abs, "utf8");
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const block = m[1];
  const get = (k) => block.match(new RegExp(`^${k}:\\s*(.*)$`, "m"))?.[1]?.trim();
  const id = get("id");
  if (!id) return null;
  // Strip fenced code before matching the H1, or a `# comment` inside a bash
  // block becomes the title. README.md and docs/testing.md both trip this.
  const body = raw.slice(m[0].length).replace(/```[\s\S]*?```/g, "");
  const h1 = body.split("\n").find((l) => /^# /.test(l))?.replace(/^# /, "").trim();
  return {
    id,
    type: get("type") ?? "?",
    status: get("status") ?? "?",
    title: h1 || path.basename(abs, ".md").replace(/[-_]/g, " "),
    path: path.relative(ROOT, abs),
  };
}

function indexDocs() {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "_templates") walk(p); continue; }
      if (!e.name.endsWith(".md")) continue;
      const rec = readFrontmatter(p);
      if (rec) out.push(rec);
    }
  };
  walk(P("docs"));
  return out;
}

// ── roadmap / todos ──────────────────────────────────────────────────

function parseRows(file, prefix) {
  if (!fs.existsSync(file)) return [];
  const rows = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    const idCell = cells[1] ?? "";
    const id = idCell.match(new RegExp(`${prefix}-\\d+`))?.[0];
    if (!id) continue;
    const title = (cells[2] ?? "").replace(/\*\*/g, "").replace(/<!--[\s\S]*?-->/g, "").trim();
    rows.push({ id, title });
  }
  return rows;
}

// ── env / services ───────────────────────────────────────────────────

const SERVICES = [
  { name: "Tina Cloud (admin CMS)", keys: ["TINA_CLIENT_ID", "TINA_TOKEN", "TINA_SEARCH_TOKEN"] },
  { name: "Google Places API",      keys: ["TINA_PUBLIC_GOOGLE_PLACES_API_KEY"] },
  { name: "Google Analytics 4",     keys: ["PUBLIC_GA4_ID"] },
  { name: "Google AdSense",         keys: ["PUBLIC_ADSENSE_PUB_ID", "PUBLIC_ADSENSE_SLOT_TOP", "PUBLIC_ADSENSE_SLOT_INARTICLE", "PUBLIC_ADSENSE_SLOT_BOTTOM"] },
  { name: "GitHub (admin writes)",  keys: ["GITHUB_BRANCH"] },
];

/** Presence only. This function must never return or log a secret value. */
function envPresence() {
  const present = new Set(Object.keys(process.env).filter((k) => process.env[k]));
  for (const f of [".env", ".env.local", ".env.production"]) {
    const abs = P(f);
    if (!fs.existsSync(abs)) continue;
    for (const line of fs.readFileSync(abs, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && m[2].trim() !== "") present.add(m[1]);
    }
  }
  return present;
}

function lastDeploy() {
  try {
    const sha = git("rev-parse", "--short", "HEAD").trim();
    const when = git("log", "-1", "--format=%cI").trim();
    const branch = git("rev-parse", "--abbrev-ref", "HEAD").trim();
    return { sha, when: when.slice(0, 10), branch };
  } catch { return null; }
}

// ── renderers ────────────────────────────────────────────────────────

function renderStats(files, docs, roadmap, todos) {
  const loc = locByType(files);
  const routes = routeCounts(files);
  const posts = files.filter((f) => f.startsWith("src/content/posts/") && f.endsWith(".md")).length;
  const chips = fs.existsSync(P("public/venue-tags"))
    ? fs.readdirSync(P("public/venue-tags")).filter((f) => f.endsWith(".json")).length : 0;

  const byType = new Map(), byStatus = new Map();
  for (const d of docs) {
    byType.set(d.type, (byType.get(d.type) ?? 0) + 1);
    byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);
  }

  const L = [];
  L.push(fm("DOC-013", "stats", ["docs-system"]), "", GEN_HEADER("scripts/refresh-docs.mjs"), "");
  L.push("# Stats", "");
  L.push("> **LOC is a rough vanity signal, tracked for reference — real progress is");
  L.push("> features and phases shipped, not lines written.** A refactor that deletes 2,000");
  L.push("> lines is progress. Read the content and docs counts below as the meaningful ones.", "");
  L.push(`Generated ${today()} from \`git ls-files\` (so .gitignore is respected exactly).`, "");

  L.push("## Content", "");
  L.push("| Thing | Count |", "|---|---|");
  L.push(`| Post markdown files | ${posts} |`);
  L.push(`| Published venue chip JSONs | ${chips} |`);
  L.push(`| Tracked files (all) | ${files.length} |`, "");

  L.push("## Routes", "");
  L.push("| Kind | Count |", "|---|---|");
  L.push(`| Static pages | ${routes.static} |`);
  L.push(`| Dynamic routes | ${routes.dynamic} |`);
  L.push(`| Build-time JSON/XML endpoints | ${routes.endpoints} |`);
  L.push(`| **Total files in src/pages** | **${routes.total}** |`, "");

  L.push("## Lines of code by type", "");
  L.push("| Type | Files | Lines |", "|---|---:|---:|");
  for (const [label, v] of loc) L.push(`| ${label} | ${v.files} | ${v.lines.toLocaleString("en-US")} |`);
  L.push("");

  L.push("## Docs", "");
  L.push(`**${docs.length} indexed** (frontmatter present; \`_templates/\` excluded).`, "");
  L.push("| Type | Count |", "|---|---:|");
  for (const [t, n] of [...byType].sort((a, b) => b[1] - a[1])) L.push(`| ${t} | ${n} |`);
  L.push("", "| Status | Count |", "|---|---:|");
  for (const [s, n] of [...byStatus].sort((a, b) => b[1] - a[1])) L.push(`| ${s} | ${n} |`);
  L.push("");

  L.push("## Phase and shipped features", "");
  L.push("**Current phase: none defined.** Every doc carries `phase: null`, and no phase");
  L.push("list exists in the repo. This is reported as-is rather than invented.", "");
  L.push("<!-- TODO(james): if you want phases tracked, define them in roadmap.md and set");
  L.push("     `phase:` on the relevant docs. Otherwise delete this section. -->", "");
  L.push(`Roadmap items (macro): **${roadmap.length}** · To-dos (micro): **${todos.length}**`, "");
  L.push("Per-row status is not yet tracked — roadmap and to-do rows have IDs but no");
  L.push("`status` column, so \"shipped\" cannot be computed. The doc-level `status` counts", "");
  L.push("above are the closest available signal.", "");
  return L.join("\n");
}

function renderCosts(cfg) {
  const a = cfg.assumptions ?? {}, u = cfg.unitCosts ?? {};
  const verify = new Set(cfg.verify ?? []);
  const V = (k, val) => (verify.has(k) ? `${val} ⚠️ VERIFY` : `${val}`);
  const money = (n) => `$${Number(n).toFixed(2)}`;

  const L = [];
  L.push(fm("DOC-014", "costs", ["docs-system", "build-deploy"]), "", GEN_HEADER("scripts/refresh-docs.mjs"), "");
  L.push("# Costs", "");
  L.push("Inputs live in `docs/costs.config.json`. Edit that, then `npm run docs:refresh`.", "");
  L.push("> **⚠️ Everything marked VERIFY is unconfirmed and currently 0.** Nothing below has");
  L.push("> been checked against an actual bill. Treat this as a *model with the numbers");
  L.push("> missing*, not a statement of what this project costs. Fill the config before");
  L.push("> showing this to anyone.", "");

  if (cfg._departures_from_spec) {
    L.push("## How this differs from a standard SaaS cost model", "");
    L.push(`**Why:** ${cfg._departures_from_spec.why}`, "");
    L.push(`**Kept:** ${cfg._departures_from_spec.kept}`, "");
    L.push(`**Changed:** ${cfg._departures_from_spec.changed}`, "");
    L.push(`**Dropped:** ${cfg._departures_from_spec.dropped}`, "");
  }

  L.push("## Assumptions", "");
  L.push("These drive every number in the table. Change them here and the table moves.", "");
  L.push("| Assumption | Value |", "|---|---|");
  L.push(`| Monthly ${a.unitLabel ?? "units"} | ${V("monthlyPageviews", (a.monthlyPageviews ?? 0).toLocaleString("en-US"))} |`);
  L.push(`| Ad impressions per ${(a.unitLabel ?? "unit").replace(/s$/, "")} | ${a.adImpressionsPerPageview ?? 0} (3 slots/post, confirmed in code) |`);
  L.push(`| ${a.unitSizeLabel ?? "API calls"} per month | ${V("placesApiCallsPerMonth", (a.placesApiCallsPerMonth ?? 0).toLocaleString("en-US"))} |`);
  L.push(`| Builds per month | ${V("buildsPerMonth", a.buildsPerMonth ?? 0)} |`);
  L.push(`| Minutes per build | ${a.deployMinutesPerBuild ?? 0} (image-heavy; confirmed) |`, "");

  L.push("## Unit costs", "");
  L.push("| Driver | Rate |", "|---|---|");
  L.push(`| AdSense revenue per 1,000 ${a.unitLabel ?? "units"} (RPM) | ${V("adsenseRpmUsd", money(u.adsenseRpmUsd ?? 0))} |`);
  L.push(`| Google Places, per call | ${V("placesApiPerCall", "$" + Number(u.placesApiPerCall ?? 0).toFixed(4))} |`);
  L.push(`| Hosting, flat per month | ${V("hostingFlatMonth", money(u.hostingFlatMonth ?? 0))} |`);
  L.push(`| Domain, per month | ${V("domainPerMonth", money(u.domainPerMonth ?? 0))} |`, "");

  L.push("## Per-tier model", "");
  L.push(`Tiers are monthly ${a.unitLabel ?? "units"}.`, "");
  L.push("| Monthly " + (a.unitLabel ?? "units") + " | Variable cost | Fixed cost | Total cost | Revenue | Margin $ | Margin % |");
  L.push("|---:|---:|---:|---:|---:|---:|---:|");
  const fixed = Number(u.hostingFlatMonth ?? 0) + Number(u.domainPerMonth ?? 0);
  for (const tier of cfg.tiers ?? []) {
    const variable = Number(a.placesApiCallsPerMonth ?? 0) * Number(u.placesApiPerCall ?? 0);
    const total = variable + fixed;
    const revenue = (tier / 1000) * Number(u.adsenseRpmUsd ?? 0);
    const margin = revenue - total;
    const pct = revenue > 0 ? ((margin / revenue) * 100).toFixed(1) + "%" : "n/a";
    L.push(`| ${tier.toLocaleString("en-US")} | ${money(variable)} | ${money(fixed)} | ${money(total)} | ${money(revenue)} | ${money(margin)} | ${pct} |`);
  }
  L.push("");
  L.push("**Margin % is `n/a` wherever revenue is 0** — a percentage of zero is undefined,");
  L.push("and printing `0.0%` or `-100%` would imply a measurement that doesn't exist.", "");

  const notes = cfg._notes ?? {};
  if (Object.keys(notes).length) {
    L.push("## Notes on each input", "");
    for (const [k, v] of Object.entries(notes)) L.push(`- **\`${k}\`** — ${v}`);
    L.push("");
  }
  return L.join("\n");
}

function renderStatus(present, deploy) {
  const L = [];
  L.push(fm("DOC-015", "status", ["build-deploy", "admin"]), "", GEN_HEADER("scripts/refresh-docs.mjs"), "");
  L.push("# System status", "");
  L.push("**Configuration presence only — no health checks, no secret values.** This page");
  L.push("reports whether a key is *set*, never what it contains.", "");

  if (deploy) {
    L.push("## Last commit", "");
    L.push("| | |", "|---|---|");
    L.push(`| Commit | \`${deploy.sha}\` |`);
    L.push(`| Date | ${deploy.when} |`);
    L.push(`| Branch | \`${deploy.branch}\` |`, "");
    L.push("<!-- This is the last local commit, NOT a confirmed Vercel deploy. Reading real");
    L.push("     deploy state needs the Vercel API and a token; deliberately not wired. -->", "");
  }

  L.push("## External services", "");
  L.push("| Service | Env key | Configured |", "|---|---|:--:|");
  for (const svc of SERVICES) {
    let first = true;
    for (const k of svc.keys) {
      L.push(`| ${first ? svc.name : ""} | \`${k}\` | ${present.has(k) ? "✅" : "❌"} |`);
      first = false;
    }
  }
  L.push("");
  L.push("❌ is not necessarily a problem — `.env` is gitignored, so a key set only in the");
  L.push("Vercel dashboard reads as absent when this runs locally. Run it in CI to see the");
  L.push("deployed picture.", "");

  L.push("## FUTURE: real health checks", "");
  L.push("Dormant until there are paying users or an uptime obligation. Ping-based checks");
  L.push("cost API quota and add a failure mode of their own; not worth it yet.", "");
  L.push("```");
  L.push("// FUTURE: per-service health check");
  L.push("// | Service | Endpoint | Latency | Uptime 30d | Last checked |");
  L.push("// |---------|----------|---------|------------|--------------|");
  L.push("// | Google Places | places.googleapis.com | --ms | --% | -- |");
  L.push("// | Tina Cloud    | content.tinajs.io     | --ms | --% | -- |");
  L.push("// | GitHub API    | api.github.com        | --ms | --% | -- |");
  L.push("//");
  L.push("// Implementation sketch: HEAD request per service, record ms, append to a");
  L.push("// rolling JSON log, compute uptime from the log. Needs a scheduled runner —");
  L.push("// there is no server (ADR-001), so it would be a GitHub Action on a cron.");
  L.push("```");
  L.push("");
  return L.join("\n");
}

function renderSnippet(todos) {
  const next3 = todos.slice(0, 3);
  const L = [];
  L.push("<!-- DOCS:STATUS:START -->");
  L.push("<!-- Generated by `npm run docs:refresh`. Do not edit between these markers. -->");
  L.push("");
  L.push(`**Current phase:** none defined · **Updated:** ${today()}`);
  L.push("");
  L.push("**Next 3 to-dos:**");
  if (next3.length === 0) L.push("1. _(none — see docs/product/todos.md)_");
  for (const [i, t] of next3.entries()) L.push(`${i + 1}. **${t.id}** — ${t.title}`);
  L.push("");
  L.push("Full list: [roadmap](docs/product/roadmap.md) · [to-dos](docs/product/todos.md) · [docs map](docs/README-DOCS.md)");
  L.push("");
  L.push("<!-- DOCS:STATUS:END -->");
  return L.join("\n");
}

function spliceMarkers(file, snippet) {
  if (!fs.existsSync(file)) return { file, ok: false, reason: "file missing" };
  const raw = fs.readFileSync(file, "utf8");
  const re = /<!-- DOCS:STATUS:START -->[\s\S]*?<!-- DOCS:STATUS:END -->/;
  if (!re.test(raw)) return { file, ok: false, reason: "markers not found" };
  const next = raw.replace(re, snippet);
  return { file, ok: true, changed: next !== raw, content: next };
}

// ── main ─────────────────────────────────────────────────────────────

function main() {
  const files = trackedFiles();
  if (files.length === 0) throw new Error("git ls-files returned 0 files — refusing to write empty stats.");

  const docs = indexDocs();
  if (docs.length === 0) throw new Error("Indexed 0 docs — refusing to write. Expected frontmatter under docs/.");

  const roadmap = parseRows(P("docs/product/roadmap.md"), "RM");
  const todos = parseRows(P("docs/product/todos.md"), "TD");

  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(P("docs/costs.config.json"), "utf8"));
  } catch (e) {
    throw new Error(`docs/costs.config.json unreadable: ${e.message}`);
  }

  const targets = [
    [P("docs/under-the-hood/stats.md"), renderStats(files, docs, roadmap, todos) + "\n"],
    [P("docs/under-the-hood/costs.md"), renderCosts(cfg) + "\n"],
    [P("docs/under-the-hood/system-status.md"), renderStatus(envPresence(), lastDeploy()) + "\n"],
  ];

  const snippet = renderSnippet(todos);
  const splices = [spliceMarkers(P("README.md"), snippet), spliceMarkers(P("CLAUDE.md"), snippet)];

  if (CHECK) {
    let stale = [];
    for (const [f, content] of targets) {
      const cur = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
      const strip = (s) => s.replace(/^updated:.*$/m, "").replace(/^Generated .*$/m, "").replace(/\*\*Updated:\*\*.*$/m, "");
      if (strip(cur) !== strip(content)) stale.push(path.relative(ROOT, f));
    }
    for (const s of splices) if (s.ok && s.changed) stale.push(path.relative(ROOT, s.file));
    if (stale.length) {
      console.error(`✗ Stale: ${stale.join(", ")}\n  Run: npm run docs:refresh`);
      process.exit(1);
    }
    console.log("✓ Generated docs are up to date.");
    return;
  }

  for (const [f, content] of targets) {
    fs.writeFileSync(f, content, "utf8");
    console.log(`✓ ${path.relative(ROOT, f)}`);
  }
  for (const s of splices) {
    if (!s.ok) { console.warn(`⚠️  ${path.relative(ROOT, s.file)}: ${s.reason} — snippet not written`); continue; }
    fs.writeFileSync(s.file, s.content, "utf8");
    console.log(`✓ ${path.relative(ROOT, s.file)} (status snippet)`);
  }

  console.log(`\n  ${files.length} tracked files · ${docs.length} docs indexed · ${roadmap.length} roadmap · ${todos.length} to-dos`);
}

main();
