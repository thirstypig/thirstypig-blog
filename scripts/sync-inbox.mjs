#!/usr/bin/env node
/**
 * sync-inbox.mjs — regenerate docs/INBOX.md from the comment store.
 *
 * Reads open + in_review comments and writes a grouped, sorted inbox so a future
 * session picks them up instead of losing them in a chat scrollback.
 *
 * Ordering is deliberate:
 *   1. change_request  — the only kind that implies work, so it goes on top
 *   2. question        — needs an answer, then the answer goes into the doc
 *   3. note            — for the record
 * Newest first within each group.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO(james): point this at a real source.
 *
 * There is no database, and that is deliberate — see ADR-001 (static-only). The
 * stack-consistent path is the one this repo already uses for browser writes:
 * have the admin board append to docs/_comments.json through the GitHub Contents
 * API, exactly like HitListManager does via tina/_shared/github-contents.ts.
 *
 * If that happens, keep the invariants from ADR-001 intact:
 *   I1  UTF-8 encode/decode explicitly (never bare atob/btoa)
 *   I3  send the file sha on every PUT, or a 409 becomes a silent overwrite
 *   I4  sanitize anything that reaches a commit message
 *
 * Alternatives if that proves awkward: GitHub Issues with a label, or a TinaCMS
 * collection. Both reintroduce a sync step this file would then own.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Usage:  node scripts/sync-inbox.mjs [--check]
 *         --check  exit 1 if INBOX.md is stale, write nothing (for CI / pre-push)
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const COMMENTS = path.join(ROOT, "docs/_comments.json");
const INBOX = path.join(ROOT, "docs/INBOX.md");
const DOCS_DIR = path.join(ROOT, "docs");

const KIND_ORDER = ["change_request", "question", "note"];
const KIND_LABEL = {
  change_request: "Change requests",
  question: "Questions",
  note: "Notes",
};
const KIND_BLURB = {
  change_request: "Something is wrong or missing. These imply work.",
  question: "Needs an answer — and the answer belongs in the doc, not just in a reply.",
  note: "For the record. Resolve once acknowledged.",
};
const OPEN_STATUSES = ["open", "in_review"];

/** Collect every doc ID that actually exists, so we can flag comments on missing docs. */
function collectDocIds(dir) {
  const ids = new Map();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name !== "_templates") walk(p);
      } else if (e.name.endsWith(".md")) {
        const raw = fs.readFileSync(p, "utf8");
        const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
        if (!m) continue;
        const id = m[1].match(/^id:\s*(\S+)/m)?.[1];
        if (id) ids.set(id, path.relative(ROOT, p));
      }
    }
  };
  walk(dir);
  return ids;
}

function fmtDate(iso) {
  // Keep it a plain date string. Never construct a Date and re-serialize —
  // that reintroduces the timestamp drift documented in DOC-001.
  return String(iso).slice(0, 10);
}

function render(comments, docIds) {
  const openish = comments.filter((c) => OPEN_STATUSES.includes(c.status));
  const resolved = comments.filter((c) => c.status === "resolved");

  const lines = [];
  lines.push("---");
  lines.push("id: DOC-012");
  lines.push("type: status");
  lines.push("status: active");
  lines.push("phase: null");
  lines.push("owner: james");
  lines.push("tags: [docs-system]");
  lines.push("links: [DOC-001]");
  lines.push(`updated: "${new Date().toISOString().slice(0, 10)}"`);
  lines.push("---");
  lines.push("");
  lines.push("<!-- GENERATED FILE — do not hand-edit.");
  lines.push("     Regenerate with: node scripts/sync-inbox.mjs");
  lines.push("     Source of truth: docs/_comments.json -->");
  lines.push("");
  lines.push("# Inbox");
  lines.push("");
  lines.push(
    `**${openish.length} open** · ${resolved.length} resolved. ` +
      "Change requests first, then questions, then notes — newest first within each group."
  );
  lines.push("");
  lines.push(
    "Read this at the start of a session. Act on change requests, answer questions, " +
      "then write a resolution (note + link) so the item clears. A resolution without a " +
      "link is indistinguishable from having ignored it."
  );
  lines.push("");

  if (openish.length === 0) {
    lines.push("---");
    lines.push("");
    lines.push("✅ **Inbox zero.** Nothing open.");
    lines.push("");
  }

  for (const kind of KIND_ORDER) {
    const group = openish
      .filter((c) => c.kind === kind)
      .sort((a, b) => String(b.created).localeCompare(String(a.created)));
    if (group.length === 0) continue;

    lines.push("---");
    lines.push("");
    lines.push(`## ${KIND_LABEL[kind]} (${group.length})`);
    lines.push("");
    lines.push(`*${KIND_BLURB[kind]}*`);
    lines.push("");

    for (const c of group) {
      const missing = !docIds.has(c.doc);
      const docRef = missing ? `\`${c.doc}\` ⚠️ **no such doc**` : `\`${c.doc}\``;
      const badge = c.status === "in_review" ? " · 🔍 in review" : "";
      lines.push(`### ${c.id} — on ${docRef}${badge}`);
      lines.push("");
      lines.push(c.body);
      lines.push("");
      lines.push(`<sub>${c.author} · ${fmtDate(c.created)}</sub>`);
      lines.push("");
    }
  }

  if (resolved.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push(`## Recently resolved (${resolved.length})`);
    lines.push("");
    lines.push("| ID | Doc | Resolution | Link | When |");
    lines.push("|---|---|---|---|---|");
    for (const c of resolved.sort((a, b) =>
      String(b.resolution?.resolved_at ?? "").localeCompare(String(a.resolution?.resolved_at ?? ""))
    )) {
      const r = c.resolution ?? {};
      const note = (r.note ?? "⚠️ **resolved with no note**").replace(/\|/g, "\\|");
      const link = r.link ? `\`${r.link}\`` : "⚠️ **none**";
      lines.push(`| ${c.id} | \`${c.doc}\` | ${note} | ${link} | ${fmtDate(r.resolved_at ?? "")} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function main() {
  const check = process.argv.includes("--check");

  if (!fs.existsSync(COMMENTS)) {
    console.error(`✗ Missing ${path.relative(ROOT, COMMENTS)} — nothing to sync.`);
    process.exit(1);
  }

  let store;
  try {
    store = JSON.parse(fs.readFileSync(COMMENTS, "utf8"));
  } catch (err) {
    console.error(`✗ ${path.relative(ROOT, COMMENTS)} is not valid JSON: ${err.message}`);
    process.exit(1);
  }

  const comments = Array.isArray(store.comments) ? store.comments : [];

  // Count assertion. A silent-success no-op is the failure mode this project
  // keeps hitting — an empty render should be loud, not quiet.
  if (comments.length === 0) {
    console.warn("⚠️  Comment store parsed but contains 0 comments. Writing an empty inbox.");
  }

  // Integrity checks — report, don't crash.
  const problems = [];
  const seen = new Set();
  const docIds = collectDocIds(DOCS_DIR);
  for (const c of comments) {
    if (seen.has(c.id)) problems.push(`duplicate comment id: ${c.id}`);
    seen.add(c.id);
    if (!KIND_ORDER.includes(c.kind)) problems.push(`${c.id}: unknown kind "${c.kind}"`);
    if (![...OPEN_STATUSES, "resolved"].includes(c.status))
      problems.push(`${c.id}: unknown status "${c.status}"`);
    if (!docIds.has(c.doc)) problems.push(`${c.id}: references missing doc "${c.doc}"`);
    if (c.status === "resolved" && (!c.resolution?.note || !c.resolution?.link))
      problems.push(`${c.id}: resolved without a note+link`);
  }

  // Single definition of the on-disk form, so --check and the write path can
  // never disagree about a trailing newline. (They did once; --check reported
  // stale immediately after a successful write.)
  const out = render(comments, docIds) + "\n";

  if (check) {
    const current = fs.existsSync(INBOX) ? fs.readFileSync(INBOX, "utf8") : "";
    // Ignore the `updated:` line, which changes daily and would false-positive.
    const strip = (s) => s.replace(/^updated:.*$/m, "");
    if (strip(current) !== strip(out)) {
      console.error("✗ docs/INBOX.md is stale. Run: node scripts/sync-inbox.mjs");
      process.exit(1);
    }
    console.log("✓ docs/INBOX.md is up to date.");
    return;
  }

  fs.writeFileSync(INBOX, out, "utf8");

  const openish = comments.filter((c) => OPEN_STATUSES.includes(c.status)).length;
  const byKind = KIND_ORDER.map(
    (k) => `${k}=${comments.filter((c) => c.kind === k && OPEN_STATUSES.includes(c.status)).length}`
  ).join(" ");
  console.log(`✓ Wrote docs/INBOX.md — ${openish} open (${byKind}), ${comments.length} total.`);

  if (problems.length) {
    console.warn(`\n⚠️  ${problems.length} integrity problem(s):`);
    for (const p of problems) console.warn(`   · ${p}`);
  }
}

main();
