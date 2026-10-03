#!/usr/bin/env bash
# Trim leading/trailing silence from every narration clip: audio/ID.wav → audio/trim_ID.wav
cd "$(dirname "$0")"
for f in audio/*.wav; do
  case "$(basename "$f")" in trim_*) continue;; esac
  b=$(basename "$f" .wav)
  ffmpeg -v error -y -i "$f" -af "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,areverse" "audio/trim_$b.wav"
done
echo trimmed
