#!/bin/sh
# Makes mac/dmg-background.tiff (the picture in the disk image's window) from
# mac/dmg-background.html. Run after changing the drawing; the result is kept
# in the repo so a build needs no drawing tools. Needs Google Chrome.
set -e
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="$(mktemp -d)"
for scale in 1 2; do
  "$CHROME" --headless --hide-scrollbars --window-size=620,400 --force-device-scale-factor="$scale" \
    --screenshot="$OUT/$scale.png" "file://$PWD/dmg-background.html" >/dev/null 2>&1
done
tiffutil -cathidpicheck "$OUT/1.png" "$OUT/2.png" -out dmg-background.tiff >/dev/null
echo mac/dmg-background.tiff
