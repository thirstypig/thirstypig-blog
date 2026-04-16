// Schema-aware validator for src/data/places-hitlist.yaml. Runs before build so
// a bad admin commit gets caught locally, not at the Astro content-collection
// step where errors are harder to trace. Mirrors the Zod schema in
// src/content.config.ts but without the Astro dependency graph.
//
// Uses js-yaml because Astro's file() loader uses js-yaml (YAML 1.1 semantics).
// The yaml npm package (YAML 1.2 core) and js-yaml disagree on bare ISO dates:
// js-yaml parses `2026-04-16` as a Date via !!timestamp; yaml v2 keeps it as a
// string. If this validator used the yaml package, it would pass files that
// then fail Astro's schema — exactly the bug class it's meant to catch.

import { readFileSync } from "node:fs";
import yaml from "js-yaml";

const FILE = process.argv[2] || "src/data/places-hitlist.yaml";
const raw = readFileSync(FILE, "utf8");

let data;
try {
  data = yaml.load(raw);
} catch (e) {
  console.error(`${FILE}: YAML parse failed — ${e.message}`);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error(`${FILE}: top-level must be a list, got ${typeof data}`);
  process.exit(1);
}

const errors = [];
const seen = new Set();

for (let i = 0; i < data.length; i++) {
  const e = data[i];
  const at = `entry[${i}]${e?.id ? ` (id=${e.id})` : ""}`;

  if (!e || typeof e !== "object") {
    errors.push(`${at}: not an object`);
    continue;
  }

  for (const field of ["id", "name", "city", "date_added"]) {
    if (typeof e[field] !== "string" || e[field].length === 0) {
      errors.push(`${at}: ${field} must be a non-empty string, got ${typeof e[field] === "object" ? e[field]?.constructor?.name || "object" : typeof e[field]}`);
    }
  }

  if (typeof e.id === "string") {
    if (seen.has(e.id)) errors.push(`${at}: duplicate id`);
    seen.add(e.id);
  }

  if (typeof e.priority !== "number" || e.priority < 1 || e.priority > 3 || !Number.isInteger(e.priority)) {
    errors.push(`${at}: priority must be an integer 1–3, got ${e.priority}`);
  }

  for (const field of ["neighborhood", "notes"]) {
    if (e[field] !== undefined && typeof e[field] !== "string") {
      errors.push(`${at}: ${field} must be a string when present, got ${typeof e[field]}`);
    }
  }

  if (e.links !== undefined) {
    if (typeof e.links !== "object" || e.links === null || Array.isArray(e.links)) {
      errors.push(`${at}: links must be an object when present`);
    } else {
      for (const [k, v] of Object.entries(e.links)) {
        if (v !== null && typeof v !== "string") {
          errors.push(`${at}: links.${k} must be a string or null, got ${typeof v}`);
        }
      }
    }
  }

  if (e.tags !== undefined) {
    if (!Array.isArray(e.tags)) {
      errors.push(`${at}: tags must be a list when present`);
    } else {
      e.tags.forEach((t, ti) => {
        if (typeof t !== "string") errors.push(`${at}: tags[${ti}] must be a string, got ${typeof t}`);
      });
    }
  }
}

if (errors.length > 0) {
  console.error(`${FILE}: ${errors.length} validation error(s)`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(`Hit List YAML valid (${data.length} entries)`);
