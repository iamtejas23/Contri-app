#!/usr/bin/env bash
set -Eeuo pipefail

# Build a signed Android APK locally and publish only the APK + checksum
# as assets on a GitHub Release. This script never pushes application source.

ROOT_DIR="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Run this script from inside the Contri Git repository." >&2
  exit 1
}
cd "$ROOT_DIR"

TAG="${1:-}"
if [[ ! "$TAG" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  echo "Usage: bash scripts/release-android.sh vX.Y.Z" >&2
  exit 1
fi

MAJOR="${BASH_REMATCH[1]}"
MINOR="${BASH_REMATCH[2]}"
PATCH="${BASH_REMATCH[3]}"
if (( MINOR > 999 || PATCH > 999 )); then
  echo "Minor and patch version components must be <= 999." >&2
  exit 1
fi
VERSION_CODE=$((MAJOR * 1000000 + MINOR * 1000 + PATCH + 1))
if (( VERSION_CODE > 2100000000 )); then
  echo "This version maps to an Android versionCode above the supported limit." >&2
  exit 1
fi
VERSION="${TAG#v}"

if ! git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  echo "Tag $TAG does not exist locally. Create it after committing the release source." >&2
  exit 1
fi
TAG_COMMIT="$(git rev-list -n 1 "$TAG")"
HEAD_COMMIT="$(git rev-parse HEAD)"
if [[ "$TAG_COMMIT" != "$HEAD_COMMIT" ]]; then
  echo "The tag $TAG must point to the current HEAD ($HEAD_COMMIT)." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before releasing." >&2
  exit 1
fi

command -v gh >/dev/null || { echo "GitHub CLI (gh) is required. Install it first." >&2; exit 1; }
gh auth status >/dev/null
if gh release view "$TAG" >/dev/null 2>&1; then
  echo "A GitHub Release already exists for $TAG; refusing to overwrite it." >&2
  exit 1
fi

for name in ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing environment variable: $name" >&2
    exit 1
  fi
done
if [[ ! -f "$ANDROID_KEYSTORE_PATH" ]]; then
  echo "Keystore not found at ANDROID_KEYSTORE_PATH." >&2
  exit 1
fi
if [[ ! -s android/app/google-services.json ]]; then
  echo "Missing android/app/google-services.json. Add your local Firebase Android client config (it must remain gitignored)." >&2
  exit 1
fi
if [[ ! -f .env ]]; then
  echo "Missing .env. Configure the required VITE_FIREBASE_* client values before building." >&2
  exit 1
fi

echo "==> Installing locked web dependencies"
npm ci

echo "==> Building web app"
npm run build

echo "==> Syncing Capacitor Android project"
npx cap sync android

echo "==> Building signed APK for $TAG (versionCode $VERSION_CODE)"
(
  cd android
  ./gradlew --no-daemon assembleRelease \
    "-PCONTRI_VERSION_NAME=$VERSION" \
    "-PCONTRI_VERSION_CODE=$VERSION_CODE"
)

APK="android/app/build/outputs/apk/release/app-release.apk"
if [[ ! -s "$APK" ]]; then
  echo "Release APK was not generated at $APK." >&2
  exit 1
fi

APKSIGNER="$(find "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}/build-tools" -type f -name apksigner 2>/dev/null | sort -V | tail -n 1)"
if [[ -z "$APKSIGNER" ]]; then
  echo "Could not find Android apksigner in the installed SDK build-tools." >&2
  exit 1
fi
"$APKSIGNER" verify --verbose "$APK"

RELEASE_DIR="dist/releases/$TAG"
mkdir -p "$RELEASE_DIR"
RELEASE_APK="$RELEASE_DIR/Contri-$TAG.apk"
CHECKSUM="$RELEASE_APK.sha256"
cp "$APK" "$RELEASE_APK"
(
  cd "$RELEASE_DIR"
  sha256sum "Contri-$TAG.apk" > "Contri-$TAG.apk.sha256"
)

echo "==> Publishing tag and release assets"
REMOTE_TAG="$(git ls-remote --tags origin "refs/tags/$TAG" "refs/tags/$TAG^{}" | awk 'NR==1 {print $1}')"
if [[ -n "$REMOTE_TAG" && "$REMOTE_TAG" != "$TAG_COMMIT" ]]; then
  echo "Remote tag $TAG points to a different commit. Refusing to publish." >&2
  exit 1
fi
if [[ -z "$REMOTE_TAG" ]]; then
  git push origin "$TAG"
fi

gh release create "$TAG" "$RELEASE_APK" "$CHECKSUM" \
  --title "Contri $TAG" \
  --generate-notes

echo
echo "Release published successfully: $TAG"
echo "APK: $RELEASE_APK"
echo "SHA-256: $CHECKSUM"
echo "Release page: $(gh release view "$TAG" --json url --jq .url)"
