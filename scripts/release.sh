#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local — copy .env.example to .env.local and fill in your Apple credentials." >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source .env.local
set +a

required=(CSC_NAME APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID)
for var in "${required[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing $var in .env.local" >&2
    exit 1
  fi
done

if [[ -z "${GH_TOKEN:-}" ]]; then
  if command -v gh >/dev/null 2>&1; then
    GH_TOKEN="$(gh auth token 2>/dev/null || true)"
    export GH_TOKEN
  fi
fi
if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Missing GH_TOKEN — run 'gh auth login' or set it in .env.local" >&2
  exit 1
fi

echo "→ Building with code signing + notarization (notarization may take several minutes)…"
echo "  Identity: $CSC_NAME"
echo "  Team: $APPLE_TEAM_ID"

npm run build
npx electron-builder --mac --publish always
