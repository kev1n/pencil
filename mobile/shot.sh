#!/bin/sh
# Development aid: open the simulator app on a route and save a screenshot.
#   ./shot.sh <route> <name> [seconds]
UDID=$(cat "$(dirname "$0")/.sim-udid")
xcrun simctl terminate "$UDID" nu.pencil.app 2>/dev/null
xcrun simctl launch "$UDID" nu.pencil.app -route "$1" >/dev/null
sleep "${3:-5}"
xcrun simctl io "$UDID" screenshot "/tmp/pencil-$2.png" >/dev/null 2>&1
echo "/tmp/pencil-$2.png"
