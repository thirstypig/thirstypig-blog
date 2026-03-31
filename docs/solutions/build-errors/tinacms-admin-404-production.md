---
title: "TinaCMS Admin 404 in Production (Vercel)"
date: 2026-03-31
category: build-errors
tags:
  - tina-cms
  - vercel
  - build
  - production
  - admin
components_affected:
  - tina/config.ts
  - tina/LocationLookup.tsx
  - package.json
  - public/admin/
status: resolved
---

# TinaCMS Admin 404 in Production (Vercel)

## Problem

`https://thirstypig.com/admin/index.html` returned a 404 in production, even though the admin worked perfectly during local development with `npm run dev`.

## Symptoms

- Production: `HTTP 404 Not Found` at `/admin/index.html`
- Local dev: Admin loads fine at `localhost:4321/admin/index.html`
- Vercel build logs showed no obvious error (failures were silenced)

## Root Cause

Three compounding issues:

### 1. `tinacms build` failing silently

The build script was:
```json
"build": "npx tinacms build || true && astro build"
```

The `|| true` swallowed any `tinacms build` failure, so Astro would build without the admin assets. The `public/admin/index.html` committed to git was the **dev-mode stub** pointing to `localhost:4001`, not the production build.

### 2. LocationLookup.tsx importing a gitignored file

```tsx
import googleConfig from "./google-places-config.json";
```

This file contains the Google Places API key and is gitignored. On Vercel, the file doesn't exist, causing `tinacms build` (which uses esbuild) to fail with:
```
Could not resolve "./google-places-config.json"
```

### 3. Tina Cloud indexing timeout

Even with valid credentials, `tinacms build` waits for Tina Cloud to finish indexing all posts. With 2,120 posts, this exceeded the build timeout. The `--skip-cloud-checks` flag bypasses this wait.

## Solution

### Fix 1: Build script — remove silent failure, add skip flag

```json
"build": "npx tinacms build --skip-cloud-checks && astro build"
```

- Removed `|| true` so build failures are visible
- Added `--skip-cloud-checks` to bypass Tina Cloud indexing wait
- Changed to `&&` so Astro only builds if TinaCMS succeeds

### Fix 2: LocationLookup.tsx — handle missing config file

Replaced the hard import with Vite's `import.meta.glob()` which returns an empty object when the file doesn't exist:

```tsx
// Before (breaks when file missing):
import googleConfig from "./google-places-config.json";
const GOOGLE_API_KEY = googleConfig?.apiKey || "";

// After (graceful when file missing):
const GOOGLE_API_KEY = (() => {
  try {
    const modules = import.meta.glob("./google-places-config.json", { eager: true });
    const config = Object.values(modules)[0];
    return config?.apiKey || "";
  } catch {
    return "";
  }
})();
```

### Fix 3: Tina Cloud environment variables

Three env vars must be set in Vercel (Settings → Environment Variables → Production):
- `TINA_CLIENT_ID` — from app.tina.io project settings
- `TINA_TOKEN` — content token from app.tina.io
- `TINA_SEARCH_TOKEN` — search indexer token from app.tina.io

## Investigation Steps

1. Checked `curl -sI https://thirstypig.com/admin/index.html` → 404
2. Inspected `dist/admin/index.html` locally → was the dev-mode stub pointing to `localhost:4001`
3. Ran `npx tinacms build` locally → "Missing clientId, token" error
4. Set credentials → "Branch 'main' is not on TinaCloud" error
5. Confirmed branch was indexed on Tina Cloud dashboard
6. Retried → "Checking indexing process" hung indefinitely
7. Tried `--skip-cloud-checks` → "indexerToken not configured" error
8. Set `TINA_SEARCH_TOKEN` → "Could not resolve google-places-config.json" error
9. Fixed LocationLookup import → build succeeded

## Prevention

- **Never use `|| true`** in build scripts for critical build steps — it hides real errors
- **Never hard-import gitignored files** — use conditional imports (`import.meta.glob`, dynamic `require` with try/catch, or env vars)
- **Document required env vars** — maintain a list of all required Vercel environment variables
- **Test production builds locally** before deploying: `npx tinacms build --skip-cloud-checks && astro build`

## Required Vercel Environment Variables

| Variable | Source | Purpose |
|----------|--------|---------|
| `TINA_CLIENT_ID` | app.tina.io → Project → Overview | TinaCMS authentication |
| `TINA_TOKEN` | app.tina.io → Project → Tokens | Content API access |
| `TINA_SEARCH_TOKEN` | app.tina.io → Project → Tokens | Search index upload |
| `PUBLIC_ADSENSE_PUB_ID` | Google AdSense (optional) | Ad slots activation |

## Related

- [Stats Dashboard & Batch Enrichment](../feature-implementations/stats-dashboard-and-batch-enrichment.md) — The session where this was discovered and fixed
- [TinaCMS docs: What is Tina Cloud](https://tina.io/docs/r/what-is-tinacloud/) — Official setup guide
