#!/usr/bin/env bash
# Triggered by launchd whenever ~/Downloads changes. Looks for an Instagram
# data export ZIP (instagram-*.zip or meta-*.zip), runs the import pipeline
# locally, commits the new posts, and pushes — without uploading the raw ZIP
# anywhere. The ZIP never leaves this machine.
#
# Idempotent: processed files are moved to ~/Downloads/.imported/ so the
# watcher won't re-process them when launchd refires on the move event.

set -uo pipefail

DOWNLOADS="$HOME/Downloads"
IMPORTED="$DOWNLOADS/.imported"
LOG="$HOME/Library/Logs/thirstypig-ig-watcher.log"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

mkdir -p "$IMPORTED"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
}

notify() {
    osascript -e "display notification \"$1\" with title \"Thirsty Pig IG Sync\"" 2>/dev/null || true
}

find_candidate() {
    find "$DOWNLOADS" -maxdepth 1 -type f \
        \( -name "instagram-*.zip" -o -name "meta-*.zip" \) \
        2>/dev/null | head -1
}

is_stable() {
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
    [ -z "$file" ] && exit 0  # silent: no matching file

    log "Found candidate: $file"

    if ! is_stable "$file"; then
        log "Still downloading; will retry on next watcher fire"
        exit 0
    fi

    local basename_f size_mb
    basename_f=$(basename "$file")
    size_mb=$(($(stat -f %z "$file") / 1024 / 1024))
    log "Processing $basename_f (${size_mb}MB) locally"
    notify "Processing $basename_f (${size_mb}MB)..."

    # Run the import pipeline from the repo root
    cd "$REPO_ROOT"

    if ! python3 scripts/instagram/sync_pipeline.py "$file" >> "$LOG" 2>&1; then
        log "ERROR: sync_pipeline.py failed (see lines above in this log)"
        notify "Import failed. See $LOG"
        exit 1
    fi

    # Commit and push any new posts/images
    git add src/content/posts/ public/images/posts/ public/videos/posts/ logs/ 2>> "$LOG"
    if git diff --staged --quiet; then
        log "No new posts imported from $basename_f"
        notify "No new posts found in $basename_f."
    else
        local posts_added images_added
        posts_added=$(git diff --staged --name-only -- src/content/posts/ | wc -l | tr -d ' ')
        images_added=$(git diff --staged --name-only -- public/images/ | wc -l | tr -d ' ')
        git commit -m "Auto-import Instagram posts: ${posts_added} posts, ${images_added} images" >> "$LOG" 2>&1
        for i in 1 2 3; do
            if git pull --rebase origin main >> "$LOG" 2>&1 && git push >> "$LOG" 2>&1; then
                log "Pushed: ${posts_added} new posts, ${images_added} new images"
                notify "Imported ${posts_added} posts, ${images_added} images. Deploying…"
                break
            fi
            log "Push attempt $i failed, retrying..."
            sleep 3
        done
    fi

    mv "$file" "$IMPORTED/"
    log "Moved $basename_f to $IMPORTED/"
}

main
