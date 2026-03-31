---
status: pending
priority: p2
issue_id: "001"
tags:
  - tina-cms
  - cors
  - production
  - code-review
dependencies: []
---

# TinaCMS CORS Errors on Production Admin

## Problem Statement

The TinaCMS admin at `https://thirstypig.com/admin/index.html` shows CORS errors when trying to authenticate with Tina Cloud. The admin loads but cannot fetch user/billing/project data from `identity.tinajs.io`.

## Findings

Console errors on production admin:

```
Access to fetch at 'https://identity.tinajs.io/v2/apps/85a9cd77.../billing/state'
from origin 'https://thirstypig.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

Affected endpoints:
- `identity.tinajs.io/.../billing/state`
- `identity.tinajs.io/.../currentUser`
- `identity.tinajs.io/.../` (project info)

The admin still loads and functions in "local mode" but Tina Cloud authentication and cloud-based editing won't work until this is resolved.

## Proposed Solutions

### Option A: Add allowed origin in Tina Cloud (Recommended)

1. Go to [app.tina.io/projects/85a9cd77-b752-4500-a6a1-7952cca428d5/configuration](https://app.tina.io/projects/85a9cd77-b752-4500-a6a1-7952cca428d5/configuration)
2. Look for "Allowed Origins" or "Site URLs" setting
3. Add `https://thirstypig.com`
4. Save and redeploy

- **Pros:** Correct fix, enables full Tina Cloud features
- **Cons:** None
- **Effort:** Small (5 minutes)
- **Risk:** Low

### Option B: Use Tina Cloud self-hosted auth

If Tina Cloud doesn't have an allowed origins setting, the alternative is to configure a custom auth provider or use the Tina Cloud dashboard directly for editing.

- **Pros:** Works around CORS
- **Cons:** More complex setup
- **Effort:** Medium
- **Risk:** Low

## Recommended Action

_To be filled during triage_

## Technical Details

**Affected files:** None (configuration change in Tina Cloud dashboard)
**Affected components:** TinaCMS admin authentication on production

## Acceptance Criteria

- [ ] `https://thirstypig.com/admin/index.html` loads without CORS errors
- [ ] TinaCMS can authenticate with Tina Cloud
- [ ] Admin shows user info instead of "local mode" warning

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-03-31 | Identified CORS errors in production console | `identity.tinajs.io` rejects requests from `thirstypig.com` origin |

## Resources

- [Tina Cloud project settings](https://app.tina.io/projects/85a9cd77-b752-4500-a6a1-7952cca428d5/configuration)
- [TinaCMS docs: Self-hosted auth](https://tina.io/docs/self-hosted/overview/)
