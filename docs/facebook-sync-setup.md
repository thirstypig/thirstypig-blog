# Facebook Page → Site auto-sync

Sync new posts from facebook.com/thirstypig to thirstypig.com automatically,
hourly, via GitHub Actions and the Facebook Graph API.

Because Instagram cross-posts to the Facebook Page, this effectively gives
Instagram → Site too — through the only Meta API path that's still free for
personal use.

## One-time setup (~15 minutes)

### 1. Create a Facebook App

You should already have done this if you're reading this. If not:

- Sign in at [developers.facebook.com](https://developers.facebook.com) with
  the same FB account that admins facebook.com/thirstypig
- [Create App](https://developers.facebook.com/apps): Use case "Other", App
  type **Business**, name `Thirsty Pig Sync`
- Keep it in **Development mode** — do NOT submit for App Review

### 2. Set the Privacy Policy URL

Meta requires this in App Settings → Basic. Use:

```
https://thirstypig.com/privacy
```

### 3. Export App credentials locally

In a terminal:

```bash
export FB_APP_ID="824631097366049"   # your App ID — public, OK to commit
export FB_APP_SECRET="..."           # your App Secret — keep local, never paste in chat
```

These only need to live in your shell long enough to run the token helper
(below). They are NOT used by the running sync workflow — that only needs the
Page Access Token.

### 4. Get a short-lived USER token from Graph API Explorer

- Visit [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
- Select your app from the top-right dropdown
- Permissions: add `pages_show_list` and `pages_read_engagement`
- Click **Generate Access Token** — authorize when prompted
- Copy the token (it's a short-lived USER token, ~1 hour)

### 5. Run the token helper

```bash
cd ~/Projects/thirstypig
python3 scripts/facebook/generate_token.py
```

It will:

1. Prompt you to paste the short-lived USER token (input is hidden — `getpass`)
2. Exchange it for a long-lived USER token (~60 days)
3. Use that to fetch your Page's never-expiring Page Access Token
4. Offer to set `FB_PAGE_ID` and `FB_PAGE_TOKEN` as GitHub secrets via `gh`

The Page Access Token never expires when issued from a long-lived user token to
a Page admin. You only run this helper once.

### 6. Verify secrets are set

```bash
gh secret list
```

You should see `FB_PAGE_ID` and `FB_PAGE_TOKEN`.

### 7. Test the workflow manually

```bash
gh workflow run facebook-sync.yml
gh run watch
```

If new FB posts exist that aren't already in the repo, the workflow will commit
them under `src/content/posts/` with filenames like `2026-04-27-fb-{post_id}.md`,
download images to `public/images/posts/`, and Vercel will auto-deploy.

### 8. Hourly cron is already enabled

Once you confirm a manual `workflow_dispatch` run works, no further action is
needed. The workflow runs at `:15` every hour automatically.

## How it works

- `scripts/facebook/sync_fb_pipeline.py` — fetches the most recent 25 posts via
  `GET /v22.0/{page-id}/posts`, parses out images (full carousel support via
  `attachments.subattachments`), downloads any that aren't already on disk,
  and writes Astro markdown.
- Idempotent: posts already on disk (matched by FB post ID in the filename)
  are skipped, so the workflow can run hourly without dupes.
- Auto-publishes: `draft: false`. If a typo gets posted, edit or delete via
  TinaCMS at `/admin`.

## Maintenance

### Token rotation

Page Access Tokens issued from a long-lived USER token to an admin do not
expire. But if you ever revoke the app's permissions, change your password
significantly, or Meta forces a session reset, the token may invalidate. To
rotate: re-run `scripts/facebook/generate_token.py` with a fresh short-lived
USER token.

### If the workflow starts failing

Check `gh run list --workflow=facebook-sync.yml` for recent runs. Common
causes:

- Token expired (re-run the helper)
- Meta changed required permissions (check Graph API changelog)
- Rate limiting (very unlikely for hourly polling on a single Page)

### Removing a syndicated post

The cleanest way: delete the markdown file at
`src/content/posts/YYYY-MM-DD-fb-{post_id}.md` and commit. The post won't
re-import on the next sync because `write_post` only checks for filename
existence locally — it doesn't track "already deleted" state. If you want to
permanently exclude a specific FB post ID from re-import, leave a stub file at
that filename with `draft: true` instead of deleting.
