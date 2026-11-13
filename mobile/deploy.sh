#!/bin/sh
# Development aid: build the web bundle and the iOS app, install on the simulator.
set -e
cd "$(dirname "$0")"
UDID=$(cat .sim-udid)
npx tsc --noEmit
PENCIL_CTEC_BYPASS="${PENCIL_CTEC_BYPASS:-}" npx vite build >/dev/null
npx cap copy ios >/dev/null
(cd ios/App && xcodebuild -project App.xcodeproj -scheme App -configuration Debug -destination "id=$UDID" -derivedDataPath ../../.derived build 2>&1 | grep -E "error:|BUILD")
xcrun simctl install "$UDID" .derived/Build/Products/Debug-iphonesimulator/App.app
