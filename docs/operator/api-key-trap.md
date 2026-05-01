# Google Cloud API key trap — "Application restrictions: Websites" with empty list

In Google Cloud Console, **"Application restrictions" must be set to None**
for server-side API key usage.

Setting it to "Websites" with an empty domain list looks identical at a
glance to "None" but **silently 403s every server-side request** with:

```
Requests from referer <empty> are blocked
```

The error message names the empty referer, not the misconfigured
restriction — slow to diagnose.

## How to recognize

If your Places API or Maps API calls succeed locally (where Chrome adds a
referer) but 403 from a server-side context (cron, GitHub Actions,
Vercel build), check this restriction first.

## Fix

Cloud Console → APIs & Services → Credentials → click the key →
**Application restrictions: None** → Save.
