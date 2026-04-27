#!/usr/bin/env bash
# Triggered by launchd whenever ~/Downloads changes. Looks for an Instagram
# data export ZIP (instagram-*.zip or meta-*.zip) and uploads it as a GitHub
# release in thirstypig/thirstypig-blog. The existing instagram-sync.yml
# workflow auto-triggers on the release and imports new posts.
#
# Idempotent: processed files are moved to ~/Downloads/.imported/ so the
# watcher won't re-process them when launchd refires on the move event.

set -uo pipefail

DOWNLOADS="$HOME/Downloads"
IMPORTED="$DOWNLOADS/.imported"
LOG="$HOME/Library/Logs/thirstypig-ig-watcher.log"
REPO="thirstypig/thirstypig-blog"

mkdir -p "$IMPORTED"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
}

notify() {
    osascript -e "display notification \"$1\" with title \"Thirsty Pig IG Sync\"" 2>/dev/null || true
}

find_candidate() {
    # Newest matching file, in case multiple are present (rare).
    find "$DOWNLOADS" -maxdepth 1 -type f \
        \( -name "instagram-*.zip" -o -name "meta-*.zip" \) \
        2>/dev/null | head -1
}

is_stable() {
    # File still being downloaded? Compare size before/after a short pause.
    local f="$1"
    local size1 size2
    size1=$(stat -f %z "$f" 2>/dev/null || echo "")
    sleep 2
    size2=$(stat -f %z "$f" 2>/dev/null || echo "")
    [ -n "$size1" ] && [ "$size1" = "$size2" ]
}

main() {
    local file
    file=$(find_candidate)
    [ -z "$file" ] && exit 0  # silent: no matching file, watcher fired for something else

    log "Found candidate: $file"

    if ! is_stable "$file"; then
        log "Still downloading; will retry on next watcher fire"
        exit 0
    fi

    if ! command -v gh >/dev/null 2>&1; then
        log "ERROR: gh CLI not found in PATH"
        notify "gh CLI not found. Run: brew install gh"
        exit 1
    fi

    if ! gh auth status >/dev/null 2>&1; then
        log "ERROR: gh not authenticated"
        notify "gh not authenticated. Run: gh auth login"
        exit 1
    fi

    local tag size_mb basename_f
    tag="ig-$(date +%Y-%m-%d-%H%M)"
    size_mb=$(($(stat -f %z "$file") / 1024 / 1024))
    basename_f=$(basename "$file")

    log "Creating release $tag with $basename_f (${size_mb}MB)"
    notify "Uploading $basename_f (${size_mb}MB)..."

    if gh release create "$tag" "$file" \
        --repo "$REPO" \
        --title "Instagram data export $(date +%Y-%m-%d)" \
        --notes "Automated upload via local IG watcher (scripts/local/ig_watcher.sh)." \
        >> "$LOG" 2>&1; then
        log "Release $tag created"
        mv "$file" "$IMPORTED/"
        log "Moved $basename_f to $IMPORTED/"
        notify "Release $tag created. Sync workflow now running on GitHub."
    else
        log "ERROR: gh release create failed (see lines above in this log)"
        notify "Release upload failed. See $LOG"
        exit 1
    fi
}

main
