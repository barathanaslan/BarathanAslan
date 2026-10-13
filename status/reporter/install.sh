#!/bin/bash
# Installs report.py as a LaunchAgent on the Mac mini: one report every two
# minutes, starting at login. Re-run after moving the repository.
# Remove with: launchctl bootout gui/$(id -u)/com.barathan.barathan98-status
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
LABEL="com.barathan.barathan98-status"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
TOKEN="$HOME/.config/barathan98-status/token"

if [ ! -s "$TOKEN" ]; then
    echo "Missing $TOKEN (mode 600). It must match the Worker's REPORT_TOKEN secret." >&2
    exit 1
fi

chmod 600 "$TOKEN"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>$HERE/report.py</string>
    </array>
    <key>StartInterval</key><integer>120</integer>
    <key>RunAtLoad</key><true/>
    <key>ProcessType</key><string>Background</string>
    <key>LowPriorityIO</key><true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:$HOME/bin</string>
    </dict>
    <key>StandardErrorPath</key><string>$HOME/Library/Logs/barathan98-status.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
sleep 1   # bootstrap right after bootout can fail with "Bootstrap failed: 5"
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Installed $LABEL"
