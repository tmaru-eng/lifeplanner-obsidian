#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="lifeplanner"
VAULT_ROOT="${OBSIDIAN_VAULT_DIR:-$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian}"
DESKTOP_PLUGIN_DIR="${VAULT_ROOT}/.obsidian.desktop/plugins/${PLUGIN_ID}"
MOBILE_PLUGIN_DIR="${VAULT_ROOT}/.obsidian.mobile/plugins/${PLUGIN_ID}"
RELEASE_DIR="release/${PLUGIN_ID}"
RELEASE_ZIP="release/${PLUGIN_ID}.zip"

npm install
npm run build

mkdir -p "${RELEASE_DIR}"
cp manifest.json "${RELEASE_DIR}/manifest.json"
cp build/main.js "${RELEASE_DIR}/main.js"
cp styles.css "${RELEASE_DIR}/styles.css"

mkdir -p "release"
cd release
zip -r "${PLUGIN_ID}.zip" "${PLUGIN_ID}"
cd - >/dev/null

mkdir -p "${DESKTOP_PLUGIN_DIR}"
cp manifest.json "${DESKTOP_PLUGIN_DIR}/manifest.json"
cp build/main.js "${DESKTOP_PLUGIN_DIR}/main.js"
cp styles.css "${DESKTOP_PLUGIN_DIR}/styles.css"

mkdir -p "${DESKTOP_PLUGIN_DIR}/templates"
cp src/templates/sheets/*.md "${DESKTOP_PLUGIN_DIR}/templates/"

if [[ -d "${VAULT_ROOT}/.obsidian.mobile" ]]; then
  mkdir -p "${MOBILE_PLUGIN_DIR}"
  cp manifest.json "${MOBILE_PLUGIN_DIR}/manifest.json"
  cp build/main.js "${MOBILE_PLUGIN_DIR}/main.js"
  cp styles.css "${MOBILE_PLUGIN_DIR}/styles.css"
  mkdir -p "${MOBILE_PLUGIN_DIR}/templates"
  cp src/templates/sheets/*.md "${MOBILE_PLUGIN_DIR}/templates/"
  printf "Deployed to %s\n" "${MOBILE_PLUGIN_DIR}"
fi

printf "Deployed to %s\n" "${DESKTOP_PLUGIN_DIR}"
printf "Release package: %s\n" "${RELEASE_ZIP}"
