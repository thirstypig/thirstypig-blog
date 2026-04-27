# Local IG export automation

A `launchd` agent that watches `~/Downloads` for an Instagram data export ZIP
and uploads it as a GitHub release in `thirstypig/thirstypig-blog`. The
existing `instagram-sync.yml` workflow auto-triggers on the release and
imports new posts.

## What this gets you

Your weekly export goes from this:

1. Open Instagram → Settings → request data export (~5 min)
2. Wait for Meta's email (~30 min – 2 hours)
3. Click email download link → ZIP lands in `~/Downloads` (~30 sec)
4. **Open GitHub → Releases → Create new release → tag it → attach ZIP** (~3 min)
5. Wait for the workflow to run (~1 min)

To this:

1. Open Instagram → Settings → request data export (~5 min)
2. Wait for Meta's email (~30 min – 2 hours)
3. Click email download link
4. macOS notification: *"Release ig-2026-05-04-1422 created. Sync workflow now running."*

Step 4 happens automatically. You shave 3 manual minutes per export and
remove the most error-prone step (forgetting to attach the ZIP, picking the
wrong tag, etc.).

## What this can't do

- **Request the export from IG.** Meta doesn't expose an API for that. Use
  the weekly reminder routine to nudge you.
- **Wait for the email.** No way around the 30-min-to-2-hour Meta delay.
- **Run when your Mac is off / asleep.** `launchd` agents only fire while a
  user is logged in. If you download the ZIP before logging in, the watcher
  catches it on next login.

## Install (one-time)

```bash
cd ~/Projects/thirstypig
bash scripts/local/install_ig_watcher.sh
```

Pre-reqs the installer checks:

- `gh` CLI installed (`brew install gh`)
- `gh` authenticated (`gh auth login`)

The installer:

1. Substitutes your `$HOME` and repo path into the launchd plist template
2. Writes `~/Library/LaunchAgents/com.thirstypig.ig-watcher.plist`
3. Loads it via `launchctl bootstrap`
4. Runs the handler once in case a matching ZIP is already in Downloads

You should immediately see the agent listed:

```bash
launchctl list | grep ig-watcher
```

## Test it

```bash
touch ~/Downloads/instagram-test.zip
tail -f ~/Library/Logs/thirstypig-ig-watcher.log
```

You should see lines about a found candidate, then the upload failing (because
it's an empty fake ZIP — expected). Clean up:

```bash
rm ~/Downloads/instagram-test.zip
```

The first real export should succeed.

## Where things live

| Path | Purpose |
|------|---------|
| `scripts/local/ig_watcher.sh` | The handler script that runs on each fire |
| `scripts/local/com.thirstypig.ig-watcher.plist` | launchd template (paths substituted at install) |
| `scripts/local/install_ig_watcher.sh` | One-time installer |
| `scripts/local/uninstall_ig_watcher.sh` | Cleanly remove the agent |
| `~/Library/LaunchAgents/com.thirstypig.ig-watcher.plist` | The active plist (generated) |
| `~/Library/Logs/thirstypig-ig-watcher.log` | All handler output |
| `~/Downloads/.imported/` | Where processed ZIPs are moved (idempotency) |

## Uninstall

```bash
bash scripts/local/uninstall_ig_watcher.sh
```

Removes the launchd agent and its plist. Leaves the log file in place for
forensics.

## Troubleshooting

**Watcher doesn't fire.** Confirm the agent is loaded:

```bash
launchctl list | grep ig-watcher
```

If empty, re-run the installer. If still empty, check the log:

```bash
cat ~/Library/Logs/thirstypig-ig-watcher.log
```

**`gh` errors at runtime.** The script's PATH is set to
`/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin` in the plist. If your `gh`
lives elsewhere (e.g., installed via macports or a custom prefix), edit
`com.thirstypig.ig-watcher.plist`'s `EnvironmentVariables → PATH` to include
that directory, then re-run the installer.

**File detected but upload fails.** Common causes:

- gh token's `repo` scope expired → `gh auth refresh -s repo`
- Release tag conflicts (rare — tag is timestamped to the minute, but if you
  trigger twice within 60 sec you'll collide). Wait a minute and re-touch the
  ZIP, or delete the conflicting release on GitHub first.

**File still being downloaded.** The script has a 2-second size-stability
check. For VERY large exports (multi-GB) being downloaded over a slow
connection, you might see "Still downloading" repeatedly in the log until the
download completes — that's correct behavior.

## How it works

`launchd`'s `WatchPaths` directive fires the agent whenever any file system
event happens in `~/Downloads`. The handler does:

1. Glob for `instagram-*.zip` or `meta-*.zip` files
2. Verify the file is stable (size unchanged across a 2 sec pause)
3. Upload via `gh release create` with a timestamped tag (`ig-YYYY-MM-DD-HHMM`)
4. Move the source ZIP to `~/Downloads/.imported/` (so the watcher won't
   re-process it on the move event)
5. macOS notification on success or failure

Idempotency is via the move: only files in the top-level `~/Downloads` match
the glob, so once a file is moved into `.imported/`, the watcher ignores it
on subsequent fires.
