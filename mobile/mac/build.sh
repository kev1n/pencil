#!/bin/sh
# Builds Pencil.app for this Mac into mobile/mac/build/.
#   ./build.sh            development build (page inspector, launch aids)
#   ./build.sh release    the build to hand out
# A development build takes PENCIL_CTEC_BYPASS=1 like the phone builds do.
set -e
cd "$(dirname "$0")/.."
MODE="${1:-debug}"
APP=mac/build/Pencil.app

npx tsc --noEmit
if [ "$MODE" = release ]; then npx vite build >/dev/null; else PENCIL_CTEC_BYPASS="${PENCIL_CTEC_BYPASS:-}" npx vite build >/dev/null; fi

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp -R dist "$APP/Contents/Resources/dist"
cp mac/Info.plist "$APP/Contents/Info.plist"
cp mac/AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

FLAGS="-O"
[ "$MODE" = release ] || FLAGS="-Onone -D DEBUG"
# shellcheck disable=SC2086
swiftc $FLAGS -target "$(uname -m)-apple-macos13.0" -o "$APP/Contents/MacOS/Pencil" \
  mac/PencilMac.swift mac/Updater.swift ios/App/App/NUSessionCore.swift

# A development build is signed for this Mac only. A release build is signed
# with the Developer ID certificate in the login keychain, then sent to Apple
# to be checked (notarized) so it opens on other Macs without a warning. That
# step needs sign-in details saved once under the name "pencil":
#   xcrun notarytool store-credentials pencil
if [ "$MODE" = release ]; then
  codesign --force --options runtime --timestamp --sign "Developer ID Application" "$APP"
  ZIP=mac/build/Pencil.zip
  rm -f "$ZIP"
  ditto -c -k --keepParent "$APP" "$ZIP"
  xcrun notarytool submit "$ZIP" --keychain-profile pencil --wait
  xcrun stapler staple "$APP"
  rm -f "$ZIP"
  # The download: a disk image holding the app beside a shortcut to the
  # Applications folder, signed and checked by Apple like the app itself.
  # dmgbuild lays out its window (mac/dmg-settings.py, mac/dmg-background.tiff).
  DMG=mac/build/Pencil.dmg
  TOOLS="$(mktemp -d)"
  python3 -m venv "$TOOLS"
  "$TOOLS/bin/pip" install --quiet dmgbuild==1.6.7
  rm -f "$DMG"
  "$TOOLS/bin/dmgbuild" -s mac/dmg-settings.py -D app="$APP" Pencil "$DMG"
  codesign --force --timestamp --sign "Developer ID Application" "$DMG"
  xcrun notarytool submit "$DMG" --keychain-profile pencil --wait
  xcrun stapler staple "$DMG"
  echo "$DMG"
else
  codesign --force --sign - "$APP" >/dev/null 2>&1
fi
echo "$APP"
