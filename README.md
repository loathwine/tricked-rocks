# Tricked Rocks

Interactive lessons (plus videos) on how computers really work, from sand to AI.

## Run locally

It's plain HTML, CSS and JS with no build step. You can open `index.html` directly, or serve it:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

Jump straight to an act while developing: `lessons/01-parallel-machine/#act=2`.
The hook and Act 1 use the viewer's real screen resolution (`screen × devicePixelRatio`) and a measured refresh rate (minimum 60), with about 1,000 steps per pixel.
Progress is kept in `localStorage` under `tr-ep01`. The finale's **Replay** button clears it.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo.
2. Go to **Settings → Pages → Build and deployment**, choose **Deploy from a branch**, then pick `main` and `/ (root)`.
3. The site will be at `https://<user>.github.io/<repo>/`.

## Layout

```
index.html                      series home + roadmap
assets/css/base.css             shared theme ("Phosphor" palette, pixel buttons)
assets/js/sfx.js                chiptune sound effects (WebAudio, no files)
assets/js/pixel.js              sprites + the 32×18 sunset scene
lessons/01-parallel-machine/    EP 01, 8 acts: hook → CPU → build a chip → zoom out → AI → CPU or GPU? → cost → finale
```

## EP 01 simulation model

This is deliberately simple, so the core idea stays visible:

- A frame is 32×18 = 576 pixels. Each pixel runs `renderPixel(x, y) → color`, an 8-step recipe (`assets/js/pixel.js` `STEPS`). The picture is computed by exactly the code the lesson shows, so the debugger's values are real.
- `renderPixel` is pure from the outside: it depends only on its own `x, y` and on shared constants (`SUN`, `SUN_R`, `SEA`), and it returns one color.
- **CPU core**: 4×4 tiles, 1 math unit, 1 step per tick.
- **Control unit**: 2×1 tiles. It drives every ALU in its row, all running the same step (SIMD). Each ALU holds its own x, y in registers. When an `if` is false for an ALU, that ALU sits the step out.
- **ALU**: 1×1 tile, 2 ticks per step (GPUs clock lower than CPUs).
- Pixels are handed out in scanline order to whichever unit is free next.

Level 2's optimum is 8 rows × (1 control unit + 6 ALUs) = 48 lanes → 12 batches × 16 ticks = **192 ticks**, compared with 4,608 for one CPU core (24×).
