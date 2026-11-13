#!/bin/sh
# Makes mac/AppIcon.icns from mac/icon.svg. Run after changing the drawing;
# the result is kept in the repo so a build needs no drawing tools.
# Needs rsvg-convert (brew install librsvg).
set -e
cd "$(dirname "$0")"
SET="$(mktemp -d)/AppIcon.iconset"
mkdir -p "$SET"
for size in 16 32 128 256 512; do
  rsvg-convert -w "$size" -h "$size" icon.svg -o "$SET/icon_${size}x${size}.png"
  rsvg-convert -w "$((size * 2))" -h "$((size * 2))" icon.svg -o "$SET/icon_${size}x${size}@2x.png"
done
iconutil -c icns "$SET" -o AppIcon.icns
echo mac/AppIcon.icns
