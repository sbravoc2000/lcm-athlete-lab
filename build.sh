#!/bin/bash
# Genera: dist/index.html + styles.css + app.js (modular) y dist/LCM_Athlete_Lab.html (archivo único)
set -e
cd "$(dirname "$0")"
mkdir -p dist
cat src/js/*.js > dist/app.js
cp src/styles.css dist/styles.css
HEAD='<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="color-scheme" content="dark"><title>LCM Athlete Lab</title>'
CSP='<meta http-equiv="Content-Security-Policy" content="default-src '"'"'none'"'"'; script-src '"'"'unsafe-inline'"'"'; style-src '"'"'unsafe-inline'"'"'; img-src data: blob:; media-src data: blob:; frame-src blob:; connect-src '"'"'none'"'"'; form-action '"'"'none'"'"'; base-uri '"'"'none'"'"'">'
{ echo "$HEAD"; echo '<link rel="stylesheet" href="styles.css"></head><body><noscript>Se requiere JavaScript.</noscript><script src="app.js"></script></body></html>'; } > dist/index.html
{ echo "$HEAD$CSP<style>"; cat src/styles.css; echo '</style></head><body><noscript>Se requiere JavaScript.</noscript><script>'; cat dist/app.js; echo '</script></body></html>'; } > dist/LCM_Athlete_Lab.html
node -e "new Function(require('fs').readFileSync('dist/app.js','utf8'))" && echo "JS OK"
ls -la dist

cp dist/LCM_Athlete_Lab.html index.html 2>/dev/null \&\& echo "index.html actualizado"
