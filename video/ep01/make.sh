#!/usr/bin/env bash
# One-shot build of a video version: narration → trim → timeline/audio → render → mux.
#   ./make.sh main     → out/ep01-the-parallel-machine.mp4
#   ./make.sh short    → out_short/ep01-short-where-chips-come-from.mp4   (wordless)
#   ./make.sh alt      → out_alt/ep01-the-parallel-machine-wordless-ending.mp4
set -euo pipefail
cd "$(dirname "$0")"
case "${1:-main}" in
  main)  NARR=narration.json;       OUT=out;       TL=timeline.json;       NAME=ep01-the-parallel-machine ;;
  short) NARR=narration_short.json; OUT=out_short; TL=timeline_short.json; NAME=ep01-short-where-chips-come-from ;;
  alt)   NARR=narration_alt.json;   OUT=out_alt;   TL=timeline_alt.json;   NAME=ep01-the-parallel-machine-wordless-ending ;;
  *) echo "usage: $0 main|short|alt"; exit 1 ;;
esac
./tts.sh                                                  # only generates lines that don't exist yet
nix shell nixpkgs#ffmpeg -c ./trim.sh
nix-shell -p "python3.withPackages(ps: [ps.numpy])" --run "python3 build.py $NARR $OUT $TL"
( cd ../.. && exec python3 -m http.server 8765 >/dev/null 2>&1 ) & SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
TIMELINE=$TL nix shell nixpkgs#nodejs nixpkgs#chromium nixpkgs#ffmpeg -c node render.mjs frames "$OUT/video_only.mp4" 30
nix shell nixpkgs#ffmpeg -c ./mux.sh "$OUT" "$NAME"
