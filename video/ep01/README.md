# EP 01 video · How a graphics card works, built from scratch

A ~6 minute explainer, drawn entirely in code (pixel art on a canvas), narrated with Gemini TTS (voice: Elio).
Published: https://youtube.com/watch?v=thX1TD6q5R0 · playlist "Tricked Rocks".

## Build

```sh
./make.sh main     # → out/ep01-the-parallel-machine.mp4            (the episode)
./make.sh short    # → out_short/ep01-short-where-chips-come-from.mp4 (wordless, 1.5 min)
./make.sh alt      # → out_alt/…-wordless-ending.mp4                 (episode with the wordless ending)
```

`make.sh` runs the whole pipeline. Every step is also runnable on its own:

1. `tts.sh`: narration JSON → `audio/<id>.wav`. It only generates lines that don't exist yet, so delete a WAV to re-record it. A per-line `"style"` overrides the default delivery.
2. `trim.sh`: removes the silence around each clip → `audio/trim_<id>.wav`.
3. `build.py <narration> <outdir> <timeline>`: the timeline (scene timings follow the clip lengths), the voice track, the synthesized sound design and score (no samples), and captions.srt. Segments with `"silent": seconds` have no voice.
4. `render.mjs frames <out.mp4>` (or `stills <dir> t1 t2 …`): renders the deterministic `scene.js` with headless Chromium and pipes the frames to ffmpeg. `TIMELINE=` picks the timeline. It needs `python3 -m http.server 8765` running from the repo root.
5. `mux.sh <outdir> <name>`: mixes the voice and sound (−14 LUFS) and muxes them with the video.

Generated files (`audio/`, `out*/`, `previews*/`) are gitignored. Thumbnails are `thumbs/thumb_*.jpg`, drawn by the `thumbA`–`thumbF` scenes in `scene.js`.

## Upload

`upload.json` holds the metadata. `node ../../scripts/yt-upload.mjs upload.json main --dry-run` shows what would be uploaded. The uploader never uploads an entry twice (`upload-log.json`), always uploads as private, and adds captions and the playlist. For OAuth setup, see the top of `scripts/yt-upload.mjs`; credentials live in `secrets/` (gitignored).
