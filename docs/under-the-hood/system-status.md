---
id: DOC-015
type: status
status: active
phase: null
owner: james
tags: [build-deploy, admin]
links: [DOC-001]
updated: "2026-07-24"
---

<!-- GENERATED FILE — do not hand-edit.
     Regenerate with: npm run docs:refresh  (scripts/refresh-docs.mjs)
     Hand edits are lost silently. -->

# System status

**Configuration presence only — no health checks, no secret values.** This page
reports whether a key is *set*, never what it contains.

## Last commit

| | |
|---|---|
| Commit | `97b9c344` |
| Date | 2026-07-24 |
| Branch | `feat/docs-board` |

<!-- This is the last local commit, NOT a confirmed Vercel deploy. Reading real
     deploy state needs the Vercel API and a token; deliberately not wired. -->

## External services

| Service | Env key | Configured |
|---|---|:--:|
| Tina Cloud (admin CMS) | `TINA_CLIENT_ID` | ❌ |
|  | `TINA_TOKEN` | ❌ |
|  | `TINA_SEARCH_TOKEN` | ❌ |
| Google Places API | `TINA_PUBLIC_GOOGLE_PLACES_API_KEY` | ❌ |
| Google Analytics 4 | `PUBLIC_GA4_ID` | ✅ |
| Google AdSense | `PUBLIC_ADSENSE_PUB_ID` | ✅ |
|  | `PUBLIC_ADSENSE_SLOT_TOP` | ✅ |
|  | `PUBLIC_ADSENSE_SLOT_INARTICLE` | ✅ |
|  | `PUBLIC_ADSENSE_SLOT_BOTTOM` | ✅ |
| GitHub (admin writes) | `GITHUB_BRANCH` | ❌ |

❌ is not necessarily a problem — `.env` is gitignored, so a key set only in the
Vercel dashboard reads as absent when this runs locally. Run it in CI to see the
deployed picture.

## FUTURE: real health checks

Dormant until there are paying users or an uptime obligation. Ping-based checks
cost API quota and add a failure mode of their own; not worth it yet.

```
// FUTURE: per-service health check
// | Service | Endpoint | Latency | Uptime 30d | Last checked |
// |---------|----------|---------|------------|--------------|
// | Google Places | places.googleapis.com | --ms | --% | -- |
// | Tina Cloud    | content.tinajs.io     | --ms | --% | -- |
// | GitHub API    | api.github.com        | --ms | --% | -- |
//
// Implementation sketch: HEAD request per service, record ms, append to a
// rolling JSON log, compute uptime from the log. Needs a scheduled runner —
// there is no server (ADR-001), so it would be a GitHub Action on a cron.
```

