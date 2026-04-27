#!/usr/bin/env bash
# Install the IG watcher launchd agent for the current user.
# Idempotent — safe to re-run after pulling updates.

set -euo pipefail

REPO_PATH="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_TEMPLATE="$REPO_PATH/scripts/local/com.thirstypig.ig-watcher.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.thirstypig.ig-watcher.plist"
HANDLER="$REPO_PATH/scripts/local/ig_watcher.sh"
LABEL="com.thirstypig.ig-watcher"

echo "Installing IG watcher launchd agent"
echo "  repo:    $REPO_PATH"
echo "  plist:   $PLIST_DEST"
echo "  handler: $HANDLER"
echo

if ! command -v gh >/dev/null 2>&1; then
    echo "[error] gh CLI not installed. Run: brew install gh"
    exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
    echo "[error] gh not authenticated. Run: gh auth login"
    exit 1
fi

chmod +x "$HANDLER"

mkdir -p "$(dirname "$PLIST_DEST")"
mkdir -p "$HOME/Library/Logs"

# Substitute paths into the plist template.
sed -e "s|{{HOME}}|$HOME|g" -e "s|{{REPO_PATH}}|$REPO_PATH|g" \
    "$PLIST_TEMPLATE" > "$PLIST_DEST"
echo "wrote plist"

# Unload first if already present (so re-runs pick up changes).
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

# Load.
launchctl bootstrap "gui/$(id -u)" "$PLIST_DEST"
echo "loaded agent"

# Verify.
if launchctl list | grep -q "$LABEL"; then
    echo
    echo "Done. The watcher is running."
    echo
    echo "Test it:"
    echo "  touch ~/Downloads/instagram-test.zip"
    echo "  tail -f ~/Library/Logs/thirstypig-ig-watcher.log"
    echo "  rm ~/Downloads/instagram-test.zip   # cleanup before real export"
    echo
    echo "(The fake test will fail at gh release create — expected. Real exports succeed.)"
    echo
    # Run handler once now in case there's already a matching file in Downloads.
    bash "$HANDLER" || true
else
    echo "[error] agent didn't load. See $HOME/Library/Logs/thirstypig-ig-watcher.log"
    exit 1
fi
