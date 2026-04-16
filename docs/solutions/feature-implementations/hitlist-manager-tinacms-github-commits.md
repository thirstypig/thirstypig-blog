---
title: "Hit List Manager: TinaCMS Screen Plugin with Direct GitHub API Commits"
date: 2026-04-16
category: feature-implementations
tags:
  - tina-cms
  - screen-plugin
  - github-api
  - content-collection
  - yaml-data
  - astro
  - client-side-auth
  - localstorage
  - optimistic-ui
components_affected:
  - tina/HitListManager.tsx
  - tina/config.ts
  - src/content.config.ts
  - src/data/places-hitlist.yaml
  - src/pages/places-hitlist.json.ts
  - src/pages/hitlist.astro
  - vercel.json
  - package.json
status: implemented
---

# Hit List Manager: TinaCMS Screen Plugin with Direct GitHub API Commits

## Overview

Built a TinaCMS Screen Plugin that lets the site owner add new restaurant entries to a static YAML file **from any device** — including a phone browser — without breaking the site's fully-static architecture. The plugin is a React form that commits new entries to GitHub via the REST API directly from the browser, using a personal access token stored in `localStorage`. Vercel auto-rebuilds on push and the entry appears on the public `/hitlist` page within about a minute.

The same pattern works for any structured data file a static site needs to mutate from an admin UI.

## Problem

- **Site is fully static** (Astro `output: 'static'` via Vercel, no SSR adapter). Adding a server-side form endpoint would require switching to hybrid/server mode — a big architectural change for one small feature.
- **Data lives in a YAML file** (`src/data/places-hitlist.yaml`) registered as an Astro content collection. Every edit had to go through a text editor and a git push.
- **Editing from a phone was painful** — opening a YAML file on mobile, matching indentation, avoiding syntax errors, all while on a small keyboard.
- **TinaCMS admin was already present** for markdown post editing, but TinaCMS's built-in collections editor is designed for markdown files, not arbitrary YAML data.

Two rejected alternatives:

1. **Serverless function on Vercel** — adds new infrastructure, a new env var secret, a new deploy surface. Too much for a single-user personal tool.
2. **Obsidian Git + markdown-to-YAML sync** — deferred as a future Phase 4. Obsidian Git on iOS uses `isomorphic-git`, which crashes on large repos (the thirstypig `.git` is 1.6 GB).

## Solution

A TinaCMS Screen Plugin (`tina/HitListManager.tsx`) that:

1. Loads the current list from the public `/places-hitlist.json` endpoint for the table view.
2. Shows an entry form (name, neighborhood, city, priority, notes, 6 link types, tags).
3. On submit:
   - GET current YAML file via GitHub REST API (`/repos/{owner}/{repo}/contents/{path}`).
   - Parse YAML with the `yaml` npm package (already a transitive dep).
   - Validate the on-disk shape (array of entries with `id` + `name`).
   - Append the new entry (with auto-generated slug, de-duplicated if collision).
   - `PUT` the updated content back with the file's SHA and a commit message.
4. Stores a fine-grained GitHub PAT in `localStorage` (browser-local, device-local).
5. Updates the UI optimistically — new entry appears in the table immediately without waiting for the rebuild.

### Architectural flow

```
User submits form in /admin
    ↓
HitListManager fetches current YAML from GitHub API
    ↓
parse() → validate shape → append entry → stringify()
    ↓
PUT base64-encoded content + sha → GitHub creates a commit
    ↓
Webhook triggers Vercel rebuild (~60s)
    ↓
New entry live on /hitlist
```

### Plugin registration (`tina/config.ts`)

```typescript
import HitListManager, { HitListIcon } from "./HitListManager";

// Inside cmsCallback:
cms.plugins.add({
  __type: "screen",
  name: "Hit List Manager",
  Component: HitListManager,
  Icon: HitListIcon,
  layout: "fullscreen",
});
```

### Key helper: UTF-8 safe base64 encoding

The GitHub Contents API requires base64-encoded content. Naïve `btoa()` breaks on non-Latin characters (e.g., Chinese restaurant names like `川山甲`). The classic `btoa(unescape(encodeURIComponent(x)))` pattern works but `unescape` is a deprecated global.

Modern replacement:

```typescript
function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
```

### Key helper: Slug collision handling

```typescript
function formToEntry(form: FormState, existingIds: Set<string>): HitListEntry {
  let id = slugify(form.name);
  if (existingIds.has(id)) {
    let n = 2;
    while (existingIds.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  // ... build rest of entry
}
```

### GitHub API calls

```typescript
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
  if (!resp.ok) throw new Error(`GitHub PUT failed: ${resp.status} ${await resp.text()}`);
}
```

### Runtime YAML shape validation

Before trusting the parsed content, verify it matches the expected shape. Prevents the manager from silently overwriting a hand-corrupted file:

```typescript
const parsed = parse(content);
const existing: HitListEntry[] = parsed === null || parsed === undefined ? [] : parsed;
if (!Array.isArray(existing)) {
  throw new Error("places-hitlist.yaml is not a list — refusing to overwrite.");
}
for (const item of existing) {
  if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.name !== "string") {
    throw new Error(`Existing entry missing required fields (id, name): ${JSON.stringify(item)}`);
  }
}
```

### Optimistic UI update

The public JSON endpoint is pre-rendered at build time, so it will return stale data for ~60 seconds after the commit. A `setTimeout(loadList, 3000)` refetch was the first naive attempt and gave the impression the save had failed.

Correct approach: build the display shape from the newly-committed entry and push it into local state immediately. The user sees their entry in the table the moment the GitHub PUT resolves.

```typescript
await githubPut(token, yaml, sha, commitMsg);

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
```

### Token handling

- Stored in `localStorage` under key `hitlist-github-pat`
- `type="password"` on input so it doesn't land in browser history
- Masked display shows only the public prefix `github_pat_` — never the secret suffix
- User can clear the token with a `(change)` button that removes it and re-shows the setup card

### Responsive layout

TinaCMS admin runs at full viewport width and was designed for desktop. For the form to work on mobile, the row style needs `flexWrap` and each field needs a `flex-basis + minWidth`:

```typescript
row: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" as const },
field: { flex: "1 1 200px", minWidth: 160, display: "flex", flexDirection: "column" },
```

On a 375px phone, fields stack naturally into single-column. On desktop, 2-4 fields fit per row.

## Security considerations

| Concern | Mitigation |
|---------|-----------|
| XSS exfiltrates token from localStorage | TinaCMS admin is gated by TinaCloud auth. Site is first-party. Token is fine-grained and scoped to one repo. Worst-case attacker can commit to that one repo only. |
| Token leaks in screenshot | Masked display shows only the public `github_pat_` prefix |
| Token accidentally pasted into chat | Input is `type="password"` so it can't be autofilled into wrong field |
| File corruption from unexpected YAML shape | Runtime schema check before mutation |
| Concurrent edits from two tabs | Second PUT hits HTTP 409 (stale SHA). Error surfaces to user. Single-user tool so near-zero risk. |

## Setup: Create the GitHub token

1. Go to https://github.com/settings/personal-access-tokens/new
2. Resource owner: **thirstypig** (or your org)
3. Repository access: **Only select repositories** → the repo containing the YAML file
4. Permissions → **Repository permissions** → **Contents: Read and write**
5. Nothing else. No workflow, no admin:repo_hook.
6. Generate, copy the `github_pat_...` token
7. Paste into the Hit List Manager on first use

## Pitfalls avoided

- **Deprecated `unescape()`** — use `TextEncoder` based helper for UTF-8 safety.
- **`setTimeout`-based refetch after commit** — fetches stale data because Vercel rebuilds take ~60s. Use optimistic UI update instead.
- **`bg-white` inside dark-mode containers** — use themed CSS variables so the card auto-themes. (Not directly related to the form but worth flagging from the same session.)
- **Trusting parsed YAML shape** — always validate before mutating, especially for files that can be hand-edited.
- **CORS headers in pre-rendered endpoints** — Astro discards `Response` headers during static build. CORS must be configured in `vercel.json`, not in the endpoint code.

## When to use this pattern

✅ Use this approach when:
- The site is fully static and must stay that way.
- You already have a client-side auth-gated admin (e.g. TinaCloud).
- The data file is small and infrequently edited.
- You're the only editor (or the very small team of trusted editors all have their own tokens).

❌ Don't use it when:
- You need server-side validation that users can't bypass.
- Multiple untrusted users need to submit data.
- The data file is large enough that round-tripping it on every write is wasteful.
- You need audit trails beyond git history.

For the untrusted-users case, a Vercel serverless function with a server-side token is the right answer. But it's genuinely more infrastructure.

## Verification

After PR merge and Vercel deploy:
1. Navigate to `/admin` → Hit List Manager appears in sidebar (🎯 icon)
2. Paste a freshly-generated fine-grained PAT into the token field
3. Fill in form (name + city required), click **Add to Hit List**
4. Success banner appears: "Saved [name] to hit list..."
5. New row appears immediately in the "Current Hit List" table below (optimistic)
6. Wait ~60s for Vercel rebuild
7. Visit `/hitlist` — new entry is live
8. Check `git log` — commit message is `Add [name] to hit list`

## Related solutions

- [Content Stats Dashboard & Batch Post Enrichment](../feature-implementations/stats-dashboard-and-batch-enrichment.md) — TinaCMS Screen Plugin pattern with build-time JSON endpoint. HitListManager follows this template.
- [Broken Images Bulk Cleanup & Post Manager](../content-management/broken-images-bulk-cleanup-and-post-manager.md) — PostManager screen plugin; same architecture (static JSON endpoint + React screen with filtering).
- [Google Places Migration](../api-migration/google-places-migration-and-data-repair.md) — CORS and client-side API call patterns. Key insight: browser REST calls to GitHub work fine (GitHub sets CORS for `api.github.com`), unlike Google Places which requires the JS SDK.
- [TinaCMS Admin 404 in Production](../build-errors/tinacms-admin-404-production.md) — the three required Vercel env vars (`TINA_CLIENT_ID`, `TINA_TOKEN`, `TINA_SEARCH_TOKEN`) that also apply here.

## PRs

- #27 — Initial rename Wishlist → Hit List + HitListManager creation
- #28 — P2 polish: type mismatch fix, mobile layout, optimistic UI update
- #29 — P3 cleanup: modern encoding, tighter token display, runtime YAML validation
