---
status: pending
priority: p1
issue_id: "005"
tags:
  - code-review
  - security
  - privacy
  - personal-data
dependencies: []
---

# IG data exports become publicly downloadable via GitHub releases

## Problem Statement

The Instagram sync pipeline uploads the user's full IG data export ZIP as a GitHub release attachment via `gh release create` (`scripts/local/ig_watcher.sh:71-78` and `.github/workflows/instagram-sync.yml`). The `thirstypig/thirstypig-blog` repo is **public** on GitHub, which means:

1. Every release attachment is **world-readable** at a permanent URL
2. An IG data export contains: **direct messages**, **follower/following lists**, **login history**, **stories archive**, **liked posts**, **profile metadata**, sometimes **search history**
3. Anyone who knows or guesses the release tag URL (`https://github.com/thirstypig/thirstypig-blog/releases/download/ig-2026-05-04-1422/...`) can download the entire export

The user has explicitly accepted that other privacy compromises are minor (read-only API tokens for public Page data), but this is qualitatively different — DMs and follower data are not public on Instagram itself.

## Findings

- Pipeline uploads ZIPs as release attachments: `scripts/local/ig_watcher.sh:71-78`, `.github/workflows/instagram-sync.yml:67-83`
- IG export ZIP file structure (per Meta's documentation): includes `messages/`, `connections/followers_and_following/`, `security_and_login_information/login_activity/`
- Repo is public (visible at github.com/thirstypig/thirstypig-blog without authentication)
- Discovered by security-sentinel during /ce:review

## Proposed Solutions

### Option A: Make the repo private

- Pros: simplest; makes all release attachments authenticated-only
- Cons: loses public-blog-as-source-code transparency; Vercel deploys still work but contributors / readers lose visibility
- Effort: Small (one click in GitHub settings)
- Risk: Low

### Option B: Switch storage from public release to private gist or private bucket

- Pros: keeps repo public, isolates the sensitive ZIP
- Cons: requires a different upload path (gh gist create, or rclone to S3); workflow needs creds
- Effort: Medium
- Risk: Low

### Option C: Don't store the ZIP at all — process inline, then discard

- Pros: no persistent sensitive data anywhere
- Cons: requires a self-hosted runner that reads `~/Downloads` directly (no upload step), since GitHub Actions can't read the user's Mac
- Effort: Medium-Large
- Risk: Medium (more moving parts)

### Option D: Strip sensitive directories from the ZIP before uploading

- Pros: keeps the public-release flow; minimizes data leak
- Cons: incomplete protection (an ZIP audit is fragile across Meta format changes); still leaks any new categories Meta adds
- Effort: Medium
- Risk: Medium-High (silent breakage when Meta's format changes)

## Recommended Action

_To be filled during triage_

## Technical Details

Affected files:
- `scripts/local/ig_watcher.sh` — local upload step
- `.github/workflows/instagram-sync.yml` — release-triggered import

Affected behavior: every IG export creates a permanent, world-readable URL containing the user's DMs, follower data, and login history.

## Acceptance Criteria

- [ ] Either repo is private, or release attachments are not publicly downloadable, or pipeline doesn't store the raw ZIP at any persistent URL
- [ ] Existing release attachments from prior tests (if any) audited and deleted
- [ ] Privacy page (#004) updated to mention or omit this pipeline accordingly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Discovered during /ce:review | I focused on protecting the API tokens but didn't think about the export ZIP itself being the sensitive payload. The token leak was minor; the data it would have fetched is the actual blast radius. |

## Resources

- [Meta IG export contents](https://help.instagram.com/181231772500920) — what's actually in a download
- `.github/workflows/instagram-sync.yml`
- `scripts/local/ig_watcher.sh`
