// Fetches webmentions from webmention.io at build time and writes a normalized
// cache to src/data/webmentions.json, consumed by src/components/Webmentions.astro.
//
// Why build-time (not runtime): keeps the rendered site fully static, so
// webmention display adds zero third-party scripts or runtime requests per
// page view — consistent with the rest of the data pipeline (map.json.ts,
// posts-admin.json.ts, stats.json.ts).
//
// Why graceful fallback: network flakes or webmention.io downtime must not
// break the Astro build. If the API is unreachable, the existing cache is
// preserved (or an empty file is seeded on first-run failure).
//
// JF2 reference: https://www.w3.org/TR/jf2/
// webmention.io reader API: https://github.com/aaronpk/webmention.io#api

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DOMAIN = "thirstypig.com";
const OUT = "src/data/webmentions.json";
const PER_PAGE = 200;
const API = "https://webmention.io/api/mentions.jf2";

const WM_PROPERTY_TO_TYPE = {
  "in-reply-to": "reply",
  "like-of": "like",
  "repost-of": "repost",
  "mention-of": "mention",
  "bookmark-of": "bookmark",
};

async function fetchPage(page) {
  const url = `${API}?domain=${DOMAIN}&per-page=${PER_PAGE}&page=${page}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`webmention.io ${res.status} on page ${page}`);
  return res.json();
}

function normalize(entry) {
  const type = WM_PROPERTY_TO_TYPE[entry["wm-property"]] || "mention";
  return {
    id: entry["wm-id"],
    target: entry["wm-target"],
    source: entry["wm-source"] || entry.url,
    type,
    author: {
      name: entry.author?.name || null,
      url: entry.author?.url || null,
      photo: entry.author?.photo || null,
    },
    content: entry.content?.text || null,
    published: entry.published || entry["wm-received"] || null,
  };
}

function loadExisting() {
  if (!existsSync(OUT)) return null;
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return null;
  }
}

function writeOut(data) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n");
}

async function main() {
  const mentions = [];
  let page = 0;
  while (true) {
    const body = await fetchPage(page);
    const children = body.children || [];
    if (children.length === 0) break;
    for (const e of children) {
      if (e["wm-private"]) continue;
      mentions.push(normalize(e));
    }
    if (children.length < PER_PAGE) break;
    page++;
  }

  writeOut({ fetchedAt: new Date().toISOString(), mentions });
  console.log(`Webmentions fetched: ${mentions.length} from ${DOMAIN}`);
}

try {
  await main();
} catch (err) {
  const existing = loadExisting();
  if (existing) {
    console.warn(`Webmention fetch failed (${err.message}) — reusing cached ${existing.mentions?.length ?? 0} entries`);
  } else {
    writeOut({ fetchedAt: null, mentions: [] });
    console.warn(`Webmention fetch failed (${err.message}) — seeded empty cache`);
  }
}
