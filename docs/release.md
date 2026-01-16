# Release Guide

## Files required by Obsidian

A release must include the following files in the plugin folder:

- `manifest.json`
- `main.js`
- `styles.css`

## Build and package

```sh
npm install
npm run build
mkdir -p release/lifeplanner
cp build/main.js release/lifeplanner/main.js
cp manifest.json styles.css release/lifeplanner/
cd release
zip -r lifeplanner.zip lifeplanner
```

## User install

1. Download `lifeplanner.zip` from the GitHub Release.
2. Extract to `.obsidian/plugins/lifeplanner/`.
3. Restart Obsidian or reload plugins.
