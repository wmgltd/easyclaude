#!/usr/bin/env bash
# Downloads the Windows zellij binary into build/win/zellij.exe.
# Runs both locally (for npm run dist:win) and inside the Windows CI workflow.
set -euo pipefail

ZELLIJ_VERSION="${ZELLIJ_VERSION:-0.44.2}"
TARGET_DIR="build/win"
TARGET_FILE="${TARGET_DIR}/zellij.exe"

mkdir -p "$TARGET_DIR"

if [ -f "$TARGET_FILE" ]; then
  echo "zellij.exe already present at $TARGET_FILE — skipping download."
  exit 0
fi

URL="https://github.com/zellij-org/zellij/releases/download/v${ZELLIJ_VERSION}/zellij-no-web-x86_64-pc-windows-msvc.zip"
TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT

echo "Downloading Zellij ${ZELLIJ_VERSION} for Windows..."
curl -fsSL -o "$TMP/zellij.zip" "$URL"

echo "Extracting..."
unzip -q "$TMP/zellij.zip" -d "$TMP"

cp "$TMP/zellij.exe" "$TARGET_FILE"
echo "✓ $TARGET_FILE ($(du -h "$TARGET_FILE" | cut -f1))"
