#!/bin/sh
# Minify the readable sources in src/ into assets/. Needs Node (esbuild is fetched by npx).
set -e
cd "$(dirname "$0")/.."
npx --yes esbuild@0.21.5 src/app.js --minify --target=es2019 --outfile=assets/app.js
npx --yes esbuild@0.21.5 src/main.css --minify --outfile=assets/main.css
