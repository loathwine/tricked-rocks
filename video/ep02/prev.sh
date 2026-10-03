#!/usr/bin/env bash
# Render preview stills at given fractions of each segment and tile them into prev/sheet.png
#   ./prev.sh [ids...]   (default: all segments)
set -euo pipefail
cd "$(dirname "$0")"
TS=$(python3 -c "
import json,sys;tl=json.load(open('timeline.json')); ids=sys.argv[1:]
print(' '.join(f\"{s['t0']+(s['t1']-s['t0'])*f:.2f}\" for s in tl if not ids or s['id'] in ids for f in (0.35,0.85)))" "$@")
( cd ../.. && exec python3 -m http.server 8765 >/dev/null 2>&1 ) & SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
rm -rf prev
nix shell nixpkgs#nodejs nixpkgs#chromium -c node render.mjs stills prev $TS
nix shell nixpkgs#ffmpeg -c ffmpeg -v error -y -pattern_type glob -i 'prev/t*.png' -vf "scale=640:-1,tile=4x7" prev/sheet%d.png
