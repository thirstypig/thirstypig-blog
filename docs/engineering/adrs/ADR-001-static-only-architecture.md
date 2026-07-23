---
id: ADR-001
type: adr
status: active
phase: null
owner: james
tags: [build-deploy, admin]
links: [DOC-002, DOC-007]
updated: "2026-07-23"
---

# ADR-001 — Static-only architecture, with admin writes via the GitHub API

> **ADRs are for big, costly-to-reverse decisions** — the ones where changing your mind
> means rewriting a subsystem. Small calls ("use `sed` instead of `yaml.dump` for this
> migration") go in `decision-log.md` (DOC-009) as a one-liner instead.
>
> Retroactive: this decision predates the doc. Claims are tagged **[intended]** /
> **[inferred]** / **[unknown]**.

**Status:** active — recorded in CLAUDE.md as fixed and explicitly not open for
re-litigation.

---

## Context
<!-- Prompt-to-self: what forces were in play? Constraints, not preferences. -->

- A personal food-blog archive: **2,127 markdown posts**, 722 MB of committed WebP images,
  one maintainer, no team, no deadline. **[intended]**
- Content must be **editable from a browser** — including from an iPad — not only from a
  terminal. TinaCMS is the admin surface. **[inferred]** from the admin surfaces built.
- Two lists (Hit List, Bucket List) need genuine read/write from that admin, not just
  read. **[intended]** — both managers exist and both write.
- **No appetite to run or pay for a server**, database, or auth provider for what is
  fundamentally a static publication. **[inferred]** — no such dependency was ever added.
- One piece of data must be readable by **another origin** (jameschang.co). **[intended]**
  — there's a dedicated CORS header for `/places-hitlist.json` in `vercel.json`.

## Decision
<!-- Prompt-to-self: state it in one sentence, in the active voice. -->

**Ship a fully static site, and make admin writes by committing to GitHub directly from
the browser** — no backend, no database, no server-side session.

Concretely:

1. Astro builds to static output; Vercel serves `dist/`. No SSR adapter, no serverless
   functions. `astro.config.mjs` declares no `output` mode, so it stays static.
2. "API endpoints" are **build-time generated JSON files** (`src/pages/*.json.ts`) — nine
   of them. They run at build, not per request.
3. Admin writes go through the **GitHub Contents API** from the browser, via
   `tina/_shared/github-contents.ts`, using a personal access token the user pastes in.
4. A commit triggers a Vercel rebuild. **The rebuild is the write path.**

## Consequences

### What this buys

- **No server to run, secure, patch, or pay for.** The whole surface is static files.
- **Git is the database.** Every content change is a commit — full history, diffable,
  revertable, with no backup strategy to design.
- **No runtime secrets in the site.** Google Places keys live in scripts run offline; the
  browser never holds a service key. The admin PAT is the user's own.
- **Cross-origin read is a header, not a service.** `/places-hitlist.json` is exposed to
  jameschang.co with `Access-Control-Allow-Origin` — no API to build.

### What this costs

- **Every admin write costs a full rebuild.** Image-heavy deploys run **~10 minutes**.
  There is no "save and see it instantly" — the edit-to-live latency is a deploy cycle.
- **Concurrency is optimistic and manual.** `githubPut` sends the file's `sha`; GitHub
  returns **409** on a conflicting edit, surfaced as `ShaConflictError` — "Reload to fetch
  the latest sha and retry." No merge, no retry loop. Acceptable at one user; it would not
  survive two. **[inferred]**
- **Auth is "do you hold a valid PAT."** There are no roles, no audit trail beyond commit
  authorship, no revocation beyond rotating the token.
- **The repo carries 722 MB of images**, because there's no object store. This is the
  direct cause of the 10-minute deploys.

### Invariants — do not break these

These are load-bearing. `github-contents.ts` exists specifically so the fixes live in one
place; changing that flow means re-checking all four.

| # | Invariant | Why it exists |
|---|---|---|
| I1 | **UTF-8 encode/decode explicitly** (`utf8ToBase64` / `base64ToUtf8`) | `atob`/`btoa` are Latin-1 only. Every `é`, `í`, or `川` corrupts on round-trip without this — and this archive is full of Chinese venue names. **[intended]**, stated in the file's comment. |
| I2 | **Force YAML quoting on write** | js-yaml (YAML 1.1) is the authoritative consumer and is strict. Unquoted values silently change type — the same bare-date trap that bit `updated:` in DOC-001. |
| I3 | **Send the `sha` on every PUT** | It's the only concurrency control. Dropping it turns a 409 into a silent overwrite. |
| I4 | **Sanitize commit messages** (`safeForCommitMessage`) | Strips `\r\n\t` and caps at 80 chars. Without it, a newline in a post title could **inject additional commit-message lines**, including fake `Co-Authored-By:` trailers. |

### Known security gaps — stated honestly

- **The PAT lives in `sessionStorage`,** readable by any script running on `/admin`. The
  mitigations are real but partial: session-scoped (dies with the tab), a strict CSP
  pinning `connect-src` to a known host list, `frame-ancestors 'none'`, and
  `X-Robots-Tag: noindex`.
- **That CSP allows `script-src 'unsafe-inline'`**, which materially weakens it as an XSS
  defense — and XSS is precisely the attack that would read the PAT. TinaCMS likely
  requires it. **[unknown]** — has an attempt been made to remove it, or is it inherited?
- Blast radius is bounded: the token is the user's own, scoped to Contents R+W on two
  repos, and there is a single admin user.

## Alternatives considered

| Option | Why not |
|---|---|
| SSR + database | Reintroduces a server, a bill, and a backup story for a site whose content is already a git repo. **[inferred]** |
| Serverless function to proxy writes | Would hide the PAT server-side — a genuine security win — but adds a deployment target and a secret to manage. **[unknown]** whether this was ever weighed. |
| Tina Cloud for content writes | In use for post editing; the two list managers bypass it. **[unknown]** — why? Possibly schema fit, possibly cost. |

## Revisit if

- A second person needs write access (I3's optimistic locking will not hold).
- Deploy time becomes intolerable — the fix is moving images out of git, not abandoning
  static.
- The comments system (RM-003) lands, since comments are inherently runtime writes and may
  be what finally forces a backend.
