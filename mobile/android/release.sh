#!/bin/sh
# Builds the signed Android release: an .aab for Google Play and an .apk to
# hand out directly. Needs the release key described in app/build.gradle.
set -e
cd "$(dirname "$0")/.."
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export PENCIL_ANDROID_KEYSTORE="${PENCIL_ANDROID_KEYSTORE:-$HOME/.pencil-signing/android-keystore.properties}"
unset PENCIL_CTEC_BYPASS VITE_SYNC_URL
npx tsc --noEmit
npx vite build >/dev/null
npx cap copy android >/dev/null
(cd android && ./gradlew -q bundleRelease assembleRelease)
ls android/app/build/outputs/bundle/release/*.aab android/app/build/outputs/apk/release/*.apk
