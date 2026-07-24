---
id: DOC-019
type: privacy
status: draft
phase: null
owner: james
tags: [ads-consent, admin, docs-system]
links: [ADR-001, DOC-017]
updated: "2026-07-23"
---

# Privacy and data handling

> ### 🔴 This one is not boilerplate
>
> This site runs **Google Analytics 4 and Google AdSense**. That makes what's collected,
> when, and on whose consent a **real disclosure obligation** under GDPR/CCPA — not a
> formality.
>
> **`src/pages/privacy.astro` is the public, legally-operative disclosure. This file is
> the internal engineering record.** If the two ever disagree, the public page is what
> you're accountable for, and the mismatch is a bug — fix it immediately.
>
> There is prior history here: an earlier version of the privacy page **drifted out of
> sync for three days**, which is why a scheduled verification routine was added to grep
> the served HTML. Treat drift as a live failure mode, not a hypothetical.

---

## What the site itself collects

**Nothing.** There is no server, no database, no user accounts, no login, no forms, no
logging (ADR-001). The site is static files on a CDN. Every item below is collected by a
**third party**, in the reader's browser, and only after opt-in.

## Consent model

`vanilla-cookieconsent` v3, bundled from npm (not a CDN). Three categories:

| Category | Default | Gates |
|---|---|---|
| `necessary` | on, read-only | nothing trackable |
| `analytics` | **OFF** | Google Analytics 4 |
| `marketing` | **OFF** | Google AdSense (3 slots/post) |

**The gating mechanism is structural, not conditional.** Both tags are emitted as
`<script type="text/plain" data-category="…">`, which browsers treat as inert data. The
consent library rewrites the type only after acceptance. Nothing loads pre-consent —
that's verifiable in the built HTML, and it's stronger than an `if (consented)` guard,
which can be bypassed by a bug in the guard.

Withdrawal stays reachable at any time via the footer **"Cookie preferences"** link.

## What each third party receives, once allowed

| Service | Trigger | What it gets | Retention |
|---|---|---|---|
| **Google Analytics 4** | `analytics` accepted | Standard GA4 web telemetry — page views, referrer, approximate geo, device/browser, a client ID cookie | **UNKNOWN** — set in the GA4 property, not in this repo |
| **Google AdSense** | `marketing` accepted | Ad-serving and personalization signals per Google's policies | **UNKNOWN** — Google-controlled |

<!-- TODO(james): fill in the GA4 data-retention setting from the GA4 admin console -->
<!-- (Admin → Data Settings → Data Retention; the choices are 2 or 14 months). Then -->
<!-- confirm src/pages/privacy.astro states the same thing. Do not guess this number. -->

**Neither is under your control once loaded.** You control *whether* they load; Google
controls what happens after. The disclosure needs to say that plainly rather than imply
you can delete data on request from your side.

## Admin-side data

| Item | Where | Lifetime |
|---|---|---|
| GitHub personal access token | Browser `sessionStorage` | **Dies when the tab closes.** `sessionStorage`, deliberately not `localStorage`. |
| Google Places API key | Local `.env` and the Vercel dashboard | Never shipped to the browser; used offline only |
| Tina Cloud tokens | Local `.env` / Vercel | — |

See RISK-003 — the PAT is protected by a CSP that still allows `script-src 'unsafe-inline'`.

## Content data — worth stating

The archive contains **the author's own** photos, captions, and location history spanning
2007–present, including GPS coordinates for ~841 venues. It is published deliberately.

Two things to be conscious of:

- **Third parties appear in the content.** Instagram `@mentions` are auto-linked, and
  photos may contain other people. That's ordinary for a public blog, but it's data about
  people who didn't consent to this specific archive.
- **Location history is inherently sensitive in aggregate.** 2,127 dated, geocoded posts
  is a detailed movement record of one person over eighteen years. Published knowingly —
  but worth naming rather than leaving implicit.

<!-- TODO(james): confirm you're comfortable with the aggregate-location point, and -->
<!-- whether any posts should be drafted for that reason. This is a judgment call, -->
<!-- not a compliance question — I'm flagging it, not recommending a change. -->

## Deletion

- **Content:** delete the markdown file, commit, redeploy. Git history retains it unless
  rewritten.
- **Analytics:** through the GA4 console. Not from this repo.
- **Reader requests:** <!-- TODO(james): does privacy.astro state a contact route for
     GDPR/CCPA requests? It has a "Contact" section — verify it says what a request
     should be sent to and what you'll do. -->

## Consistency checklist

Run this whenever anything about tracking changes:

- [ ] `src/pages/privacy.astro` names every service that can load
- [ ] Category names in the privacy page match the ones in the code (`analytics`, `marketing`)
- [ ] The footer "Cookie preferences" link still opens the preferences modal
- [ ] Built HTML shows both tags as `type="text/plain"` before consent
- [ ] This file matches the public page
