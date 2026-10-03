#!/usr/bin/env bash
# Mix narration + sound bed and mux with the rendered video.   usage: ./mux.sh [outdir] [name]
set -euo pipefail
cd "$(dirname "$0")"
OUT=${1:-out}; NAME=${2:-ep01-the-parallel-machine}
ffmpeg -v error -y -i "$OUT/voice.wav" -i "$OUT/sfx.wav" -filter_complex \
  "[1:a]volume=0.35[s];[0:a][s]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000" \
  -ac 2 "$OUT/mix.wav"
ffmpeg -v error -y -i "$OUT/video_only.mp4" -i "$OUT/mix.wav" -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/$NAME.mp4"
echo "wrote $OUT/$NAME.mp4"
