---
status: pending
priority: p2
issue_id: "008"
tags:
  - code-review
  - reliability
  - shell
  - launchd
dependencies: []
---

# IG watcher race conditions + install-time auto-publish risk

## Problem Statement

Three race / unsafety issues in `scripts/local/ig_watcher.sh` + `install_ig_watcher.sh`:

**1. Partial-archive uploads on browser-managed downloads.** Safari/Chrome write to `instagram-XXX.zip.download` (or `.crdownload`) and rename to `.zip` only when complete. By the time the file matches the `instagram-*.zip` glob, the download is already complete — but for *some* download managers / `curl` patterns, the rename happens before the final flush, and the 2-second `is_stable()` size-delta check passes on a truncated archive.

**2. Parallel handler fires.** `launchd`'s `WatchPaths` fires for any change in `~/Downloads`. With `ThrottleInterval: 5` and a 2-second sleep inside `is_stable()`, two near-simultaneous fires can both pass `find_candidate()` before either calls `mv` to `.imported/` — producing duplicate releases for the same export.

**3. Install-time auto-publish.** `install_ig_watcher.sh:59` runs `bash "$HANDLER" || true` immediately after `launchctl bootstrap`. If a stale `instagram-*.zip` is sitting in `~/Downloads` from earlier testing, install silently publishes it as a release without prompting.

## Findings

- `scripts/local/ig_watcher.sh:39-46` — `is_stable()` uses size-delta only
- `scripts/local/ig_watcher.sh:48-60` (main flow) — no lock; concurrent fires can race
- `scripts/local/install_ig_watcher.sh:59` — handler invoked unconditionally during install
- Discovered by security-sentinel during /ce:review

## Proposed Solutions

### Option A: Lockfile + sibling-file check + opt-in install scan

1. Add `flock` (or `mkdir`-as-mutex on macOS where flock isn't standard) at the top of the handler:
   ```bash
   exec 9>/tmp/thirstypig-ig-watcher.lock
   flock -n 9 || exit 0
   ```
2. In `is_stable()`, also check no `*.crdownload` or `*.download` siblings exist for the candidate basename
3. In `install_ig_watcher.sh:59`, prompt before the auto-run: "An IG zip is already in Downloads — upload it now? [y/N]"

- Pros: closes all three holes; no behavior change for the happy path
- Cons: `flock` may not be present on stock macOS (it's via Homebrew's `util-linux`); `mkdir`-mutex works everywhere
- Effort: Small (~30 min)
- Risk: Low

### Option B: Single-file polling daemon instead of WatchPaths

Replace the launchd-fires-on-any-change pattern with a polling loop that sleeps 30s between scans.

- Pros: trivially serializes; no lock needed
- Cons: regresses responsiveness; more battery use
- Effort: Small
- Risk: Low

### Option C: Move detection to mtime-based stability (file is N seconds old)

Check `mtime + 5s < now` instead of size-delta. Closes the partial-write hole if the writer doesn't `touch -a` the file post-write.

- Pros: simpler than sibling-check
- Cons: doesn't help with parallel fires
- Effort: Trivial

## Recommended Action

_To be filled during triage. Option A is recommended._

## Technical Details

Affected files:
- `scripts/local/ig_watcher.sh`
- `scripts/local/install_ig_watcher.sh`

## Acceptance Criteria

- [ ] Two simultaneous fires of the watcher cannot produce duplicate releases (test with `for i in 1 2; do bash scripts/local/ig_watcher.sh & done; wait`)
- [ ] Watcher does not upload a file that has a `.crdownload` or `.download` sibling
- [ ] Installer prompts before processing pre-existing downloads

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-04-27 | Identified during /ce:review | The "test it works" path doesn't catch races; needed an agent to think adversarially about WatchPaths semantics. |

## Resources

- `scripts/local/ig_watcher.sh`
- `scripts/local/install_ig_watcher.sh`
- [launchd WatchPaths semantics](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
