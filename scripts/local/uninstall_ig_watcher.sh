#!/usr/bin/env bash
# Cleanly remove the IG watcher launchd agent.

set -uo pipefail

LABEL="com.thirstypig.ig-watcher"
PLIST_DEST="$HOME/Library/LaunchAgents/com.thirstypig.ig-watcher.plist"

echo "Uninstalling IG watcher"

if launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null; then
    echo "  unloaded agent"
else
    echo "  agent was not loaded"
fi

if [ -f "$PLIST_DEST" ]; then
    rm "$PLIST_DEST"
    echo "  removed plist"
else
    echo "  plist was not present"
fi

echo "Done. (Logs at ~/Library/Logs/thirstypig-ig-watcher.log left in place.)"
