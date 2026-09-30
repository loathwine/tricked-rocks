/* EP 01 · THE PARALLEL MACHINE — full video, drawn deterministically.
   window.TIMELINE = [{ id, scene, t0, t1, speech }]  (seconds; built by build.mjs from the narration clips)
   window.renderFrame(t) draws the frame at time t. */
(function () {
  "use strict";
  const cv = document.getElementById("c"), mainCtx = cv.getContext("2d");
  let ctx = mainCtx; // swapped temporarily when rendering scene thumbnails
  const W = 1920, H = 1080;
  // low-res canvas for pixel-art animation, scaled ×8 onto the main canvas
  const LO_W = 240, LO_H = 135;
  const lo = document.createElement("canvas"); lo.width = LO_W; lo.height = LO_H;
  const lx = lo.getContext("2d");

  const C = { bg: "#07060f", panel: "#17142e", ink: "#ecebff", muted: "#9a95c4", dim: "#5f5a8f", cpu: "#ffab40", cpuDeep: "#b8620f",
    gpu: "#3df5c4", gpuDeep: "#11917b", gold: "#ffe066", hot: "#ff4d8d", sky: "#7b86ff", line: "#2d2856", bad: "#ff5a5a",
    brain: "#ff7d6b", cache: "#b58cff" };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const hexA = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  const SCENE = PX.SCENE, SW = PX.SCENE_W, SH = PX.SCENE_H, NPX = SW * SH;
  const STEPS = PX.STEPS;
  const TRACE = Array.from({ length: NPX }, (_, i) => PX.trace(i % SW, Math.floor(i / SW)));
  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

  // ------------------------------------------------------------------ helpers
  function text(str, x, y, size, color, o = {}) {
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.font = `${o.weight || ""} ${size}px ${o.font || "Silkscreen"}`.trim();
    ctx.textAlign = o.align || "center";
    ctx.textBaseline = "middle";
    if (o.glow) { ctx.shadowColor = color; ctx.shadowBlur = o.glow; }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  const body = (str, x, y, size, color, o = {}) => text(str, x, y, size, color, { font: "'Space Grotesk'", weight: 500, ...o });
  const mono = (str, x, y, size, color, o = {}) => text(str, x, y, size, color, { font: "'JetBrains Mono'", weight: 700, ...o });
  const typed = (str, k) => str.slice(0, Math.round(str.length * clamp(k, 0, 1)));
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

  const STARS = Array.from({ length: 150 }, () => ({ x: rnd() * W, y: rnd() * H, s: rnd() < 0.2 ? 4 : 2, p: rnd() * 6 }));
  function background(t, dim = 1) {
    rect(0, 0, W, H, C.bg);
    ctx.fillStyle = `rgba(123,134,255,${0.05 * dim})`;
    for (let y = 12; y < H; y += 24) for (let x = 12; x < W; x += 24) ctx.fillRect(x, y, 2, 2);
    STARS.forEach((s) => {
      const tw = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.3 + s.p));
      ctx.fillStyle = `rgba(236,235,255,${0.3 * tw * dim})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    });
  }
  // a thick pixel line in the low-res canvas
  function lineLo(g, x1, y1, x2, y2, w, color) {
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1)));
    g.fillStyle = color;
    for (let i = 0; i <= n; i++) g.fillRect(Math.round(lerp(x1, x2, i / n) - w / 2), Math.round(lerp(y1, y2, i / n) - w / 2), w, w);
  }
  function blitLo() {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(lo, 0, 0, W, H);
  }
  function panel(x, y, w, h, border = C.line) {
    rect(x, y, w, h, C.panel);
    ctx.strokeStyle = border; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
  }

  // the CPU core sprite (16×16), assembled pixel by pixel when k < 1
  const SPR = PX.SPRITES.cpu;
  const SPR_CELLS = [];
  SPR.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ".") SPR_CELLS.push({ x, y, ch, r: rnd() }); }));
  const HOT_PAL = { o: "#7a5a2a", A: "#6a1010", a: "#d02a2a", B: "#a01818", b: "#ff5a3a", W: "#300808", g: "#ff4d8d" };
  function cpuCore(t, cx, cy, S, k = 1, glow = 1, heat = 0) {
    const ox = Math.round(cx - 8 * S), oy = Math.round(cy - 8 * S);
    if (glow > 0) {
      const g = ctx.createRadialGradient(cx, cy, S * 2, cx, cy, S * 16);
      g.addColorStop(0, heat > 0.5 ? `rgba(255,70,60,${0.45 * glow})` : `rgba(255,171,64,${0.3 * glow})`);
      g.addColorStop(1, "rgba(255,171,64,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - S * 16, cy - S * 16, S * 32, S * 32);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.26, pulse = (t * 0.8 + i * 0.37) % 1;
        for (let r = 9; r < 20; r += 0.5) {
          const x = Math.round((cx + Math.cos(a) * r * S) / S) * S, y = Math.round((cy + Math.sin(a) * r * S * 0.85) / S) * S;
          ctx.fillStyle = Math.abs((r - 9) / 11 - pulse) < 0.07 ? hexA(C.gold, glow) : hexA(C.line, 0.8 * glow);
          ctx.fillRect(x, y, S * 0.5, S * 0.5);
        }
      }
    }
    const pal = heat > 0.5 ? HOT_PAL : PX.PAL_CPU;
    SPR_CELLS.forEach((c) => {
      if (c.r > k) return;
      ctx.fillStyle = k - c.r < 0.05 ? "#fff8e0" : pal[c.ch];
      ctx.fillRect(ox + c.x * S, oy + c.y * S, S, S);
    });
  }
  function gpuCore(cx, cy, s) {
    rect(cx - s, cy - s, 2 * s, 2 * s, C.gpu);
    rect(cx - s, cy + s * 0.6, 2 * s, s * 0.4, "rgba(11,10,23,.35)");
    rect(cx - s, cy - s, 2 * s, s * 0.25, "rgba(255,255,255,.35)");
  }
  function swarm(t, n, x0, y0, w, h, maxCell = 66, color = C.gpu) {
    const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / h))), rows = Math.ceil(n / cols);
    const cell = Math.min(w / cols, h / rows, maxCell), d = Math.max(2, Math.floor(cell * 0.78));
    const gx = x0 + (w - cols * cell) / 2, gy = y0 + (h - rows * cell) / 2;
    for (let i = 0; i < n; i++) {
      const lit = Math.sin(t * 9 - Math.floor(i / 32) * 0.07) > 0.55;
      ctx.fillStyle = lit ? "#c9fff1" : color;
      ctx.fillRect(Math.round(gx + (i % cols) * cell), Math.round(gy + Math.floor(i / cols) * cell), d, d);
    }
  }
  // the 32×18 sunset, cell px per pixel; state(i) → rgb string or null (empty)
  function screen(x, y, cell, state, frame = true) {
    if (frame) { rect(x - 14, y - 14, SW * cell + 28, SH * cell + 28, "#2d2856"); rect(x - 8, y - 8, SW * cell + 16, SH * cell + 16, "#0e0c1e"); }
    for (let i = 0; i < NPX; i++) {
      const c = state(i);
      ctx.fillStyle = c || (((i % SW) + Math.floor(i / SW)) % 2 ? "#0f0d20" : "#131128");
      ctx.fillRect(x + (i % SW) * cell, y + Math.floor(i / SW) * cell, cell, cell);
    }
  }
  const full = (i) => rgb(SCENE[i]);
  seed = 5;
  const ORDER = Array.from({ length: NPX }, (_, i) => i).sort(() => rnd() - 0.5);
  const RANK = new Float64Array(NPX); ORDER.forEach((p, r) => { RANK[p] = r / NPX; });

  // simple scheduler (same model as the lesson): units { lanes, stepTicks }, S steps per item
  function schedule(units, total, S) {
    const start = new Float64Array(total), end = new Float64Array(total), stepT = new Float64Array(total);
    const free = units.map(() => 0);
    let next = 0;
    while (next < total) {
      let u = 0;
      for (let k = 1; k < units.length; k++) if (free[k] < free[u]) u = k;
      const n = Math.min(units[u].lanes, total - next), t0 = free[u], t1 = t0 + S * units[u].stepTicks;
      for (let l = 0; l < n; l++, next++) { start[next] = t0; end[next] = t1; stepT[next] = units[u].stepTicks; }
      free[u] = t1;
    }
    return { start, end, stepT, total: Math.max(...end) };
  }
  const GPU_CHIP = Array.from({ length: 8 }, () => ({ lanes: 6, stepTicks: 2 }));
  const SCH_CPU = schedule([{ lanes: 1, stepTicks: 1 }], NPX, 8), SCH_GPU = schedule(GPU_CHIP, NPX, 8);
  const schedState = (sch, t, lane) => (i) => (t >= sch.end[i] ? full(i) : t >= sch.start[i] ? lane : null);

  // the die: 8×8 tiles; parts = [{type, x, y, w, h}]
  function die(x, y, tile, parts, o = {}) {
    const n = 8, s = n * tile;
    // gold pins
    for (let i = 0; i < s; i += tile / 2) {
      rect(x + i + tile * 0.15, y - tile * 0.35, tile * 0.2, tile * 0.18, "#c9a44a");
      rect(x + i + tile * 0.15, y + s + tile * 0.17, tile * 0.2, tile * 0.18, "#c9a44a");
      rect(x - tile * 0.35, y + i + tile * 0.15, tile * 0.18, tile * 0.2, "#c9a44a");
      rect(x + s + tile * 0.17, y + i + tile * 0.15, tile * 0.18, tile * 0.2, "#c9a44a");
    }
    rect(x - 6, y - 6, s + 12, s + 12, "#2f2a5c");
    rect(x, y, s, s, "#0e0c1e");
    ctx.fillStyle = "rgba(123,134,255,.14)";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) ctx.fillRect(x + c * tile + tile / 2 - 2, y + r * tile + tile / 2 - 2, 4, 4);
    parts.forEach((p) => {
      const pop = p.pop ?? 1;
      if (pop <= 0) return;
      const sc = pop < 1 ? 0.6 + 0.4 * easeOut(pop) : 1;
      const w = p.w * tile - 6, h = p.h * tile - 6;
      const px = x + p.x * tile + 3 + (w * (1 - sc)) / 2, py = y + p.y * tile + 3 + (h * (1 - sc)) / 2;
      const col = p.type === "cpu" ? C.cpu : p.type === "ctrl" ? C.sky : C.gpu;
      rect(px, py, w * sc, h * sc, p.lit ? "#e8fff8" : col);
      rect(px, py, w * sc, 5, "rgba(255,255,255,.3)");
      if (p.type === "cpu") { rect(px + w * 0.39, py + h * 0.39, w * 0.22, h * 0.22, C.gpu); text("CPU", px + w / 2, py + h * 0.22, tile * 0.32, "#0b0a17"); }
      if (p.type === "ctrl") text(p.label || "CTRL", px + w / 2, py + h / 2, tile * 0.26, "#0b0a17");
    });
  }
  const FOUR_CPUS = [[0, 0], [4, 0], [0, 4], [4, 4]].map(([x, y]) => ({ type: "cpu", x, y, w: 4, h: 4 }));
  const GPU_PARTS = [];
  for (let r = 0; r < 8; r++) { GPU_PARTS.push({ type: "ctrl", x: 0, y: r, w: 2, h: 1 }); for (let c = 2; c < 8; c++) GPU_PARTS.push({ type: "alu", x: c, y: r, w: 1, h: 1 }); }

  function bigTitle(lines, k, y = H / 2) {
    lines.forEach((l, i) => text(l.t, W / 2, y + (i - (lines.length - 1) / 2) * l.lh, l.size, l.color, { alpha: seg(k, i * 0.15, i * 0.15 + 0.4), glow: l.glow }));
  }

  // ------------------------------------------------------------------ scenes
  // Each scene: (lt, d, t, s) → lt = local time, d = segment duration, t = global time, s = segment
  const SC = {};

  // ---- COLD OPEN ----
  SC.screen = (lt, d, t) => {
    background(t);
    const cell = 36, x = (W - SW * cell) / 2, y = 150;
    const sweep = (t * 1.8) % 1; // redraw sweep, slowed down for the eye
    screen(x, y, cell, (i) => {
      const row = Math.floor(i / SW) / SH;
      const c = SCENE[i], f = Math.abs(row - sweep) < 0.06 ? 1.6 : 1;
      return `rgb(${Math.min(255, c[0] * f)},${Math.min(255, c[1] * f)},${Math.min(255, c[2] * f)})`;
    });
    mono(typed("≈ 2,000,000 PIXELS", seg(lt, d * 0.25, d * 0.45)), W / 2 - 330, 900, 52, C.gold);
    mono(typed("× 60 PER SECOND", seg(lt, d * 0.62, d * 0.8)), W / 2 + 330, 900, 52, C.gpu);
  };

  SC.calc = (lt, d, t) => {
    background(t);
    const zin = easeInOut(seg(lt, 0, d * 0.25)), zout = easeInOut(seg(lt, d * 0.42, d * 0.56));
    const z = zin * (1 - zout);
    const base = 30, pi = 9 * SW + 12, px = pi % SW, py = Math.floor(pi / SW);
    const cell = lerp(base, 300, z);
    const bx = (W - SW * base) / 2, by = 430 - (SH * base) / 2;
    const pcx = lerp(bx + (px + 0.5) * base, W / 2, z), pcy = lerp(by + (py + 0.5) * base, 430, z);
    const x = pcx - (px + 0.5) * cell, y = pcy - (py + 0.5) * cell;
    const fillK = seg(lt, d * 0.56, d * 0.95); // the whole frame computing, many pixels at once
    const zoomedOut = lt > d * 0.42;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 850); ctx.clip();
    screen(x, y, cell, (i) => {
      if (!zoomedOut) return full(i);
      if (i === pi) return full(i);
      if (RANK[i] < fillK) return fillK - RANK[i] < 0.04 && fillK < 1 ? "#b8fff0" : full(i);
      return null;
    }, z < 0.02);
    ctx.restore();
    if (z > 0.02) { ctx.strokeStyle = C.ink; ctx.lineWidth = 6; ctx.strokeRect(pcx - cell / 2, pcy - cell / 2, cell, cell); }
    const glyphs = ["×", "+", "÷", "−", "√", "sin", "×", "+"];
    const n = Math.floor(seg(lt, d * 0.2, d * 0.35) * 80 * (1 - zout));
    for (let i = 0; i < n; i++) {
      const a2 = i * 2.39, r = 200 + ((t * 120 + i * 37) % 420);
      mono(glyphs[i % glyphs.length], W / 2 + Math.cos(a2) * r, 430 + Math.sin(a2) * r * 0.6, 34, C.gold, { alpha: 0.25 + 0.6 * (1 - r / 620) });
    }
    if (!zoomedOut) mono(typed("≈ 1,000 CALCULATIONS · FOR ONE PIXEL", seg(lt, d * 0.12, d * 0.32)), W / 2, 930, 46, C.ink);
    else {
      if (fillK > 0) mono(fmt(2e9 * easeInOut(fillK)), W / 2, 920, 90, C.gold, { glow: 16 * fillK });
      text("CALCULATIONS · FOR ONE FRAME", W / 2, 1010, 34, C.muted, { alpha: seg(lt, d * 0.56, d * 0.66) });
    }
  };

  // VHS rewind: the picture tears and rolls, sepia creeps in, the year spins back
  SC.rewind = (lt, d, t) => {
    background(t);
    const k = seg(lt, d * 0.3, d * 0.97), e = easeInOut(k);
    const year = Math.round(lerp(2026, 1944, e));
    const cell = 30, x0 = (W - SW * cell) / 2, y0 = 430 - (SH * cell) / 2;
    const shake = k > 0 && k < 1 ? 1 : 0;
    for (let r = 0; r < SH; r++) {
      const off = shake * (Math.sin(r * 1.7 + t * 40) * 30 + (((r * 97 + Math.floor(t * 24) * 13) % 7) - 3) * 12) * Math.sin(k * Math.PI);
      for (let c = 0; c < SW; c++) {
        const col = SCENE[r * SW + c], lum = col[0] * 0.3 + col[1] * 0.59 + col[2] * 0.11;
        const sr = lerp(col[0], lum * 1.15 + 20, e), sg = lerp(col[1], lum * 0.95 + 8, e), sb = lerp(col[2], lum * 0.7, e);
        rect(x0 + c * cell + off, y0 + r * cell, cell, cell, `rgb(${sr | 0},${sg | 0},${sb | 0})`);
      }
    }
    if (shake) {
      // tracking bands and noise
      for (let b = 0; b < 3; b++) {
        const by = ((t * 0.9 + b * 0.37) % 1) * H;
        for (let i = 0; i < 90; i++) rect((i * 211 + Math.floor(t * 60) * 37) % W, by + ((i * 13) % 26), 20 + (i % 5) * 16, 3, `rgba(236,235,255,${0.25 + (i % 3) * 0.15})`);
      }
      for (let i = 0; i < 260; i++) rect((i * 7919 + Math.floor(t * 30) * 104729) % W, (i * 104729 + Math.floor(t * 30) * 7919) % H, 3, 3, "rgba(255,255,255,.35)");
      if (Math.floor(t * 2.5) % 2 === 0) text("◀◀ REWIND", 80, 70, 44, C.ink, { align: "left" });
    }
    mono(String(year), W / 2, 930, 120, k > 0 ? "#e8d8b0" : C.ink, { glow: 12 });
  };

  // a person at a desk with a mechanical calculator (drawn in the low-res canvas)
  function person(g, x, y, shirt = "#b58cff", hair = "#3a2a1a") {
    g.fillStyle = hair; g.fillRect(x + 1, y, 4, 2);
    g.fillStyle = "#f0c8a0"; g.fillRect(x + 1, y + 1, 4, 3);
    g.fillStyle = hair; g.fillRect(x + 1, y + 1, 1, 1);
    g.fillStyle = shirt; g.fillRect(x, y + 4, 6, 4);
  }
  SC.human = (lt, d, t) => {
    const g = lx, fast = t * 7;
    g.fillStyle = "#1a1216"; g.fillRect(0, 0, LO_W, LO_H);
    // wall, window blinds, clock
    g.fillStyle = "#231a1d"; g.fillRect(0, 0, LO_W, 92);
    g.fillStyle = "#2e2226"; for (let y = 8; y < 60; y += 5) g.fillRect(150, y, 60, 3);
    const cx = 205, cy = 24; g.fillStyle = "#e8e0c8"; for (let a = 0; a < 6.28; a += 0.2) g.fillRect(Math.round(cx + Math.cos(a) * 11), Math.round(cy + Math.sin(a) * 11), 1, 1);
    const ha = t * 6.28 - 1.57; for (let r = 0; r < 9; r++) { g.fillStyle = "#ff5a5a"; g.fillRect(Math.round(cx + Math.cos(ha) * r), Math.round(cy + Math.sin(ha) * r), 1, 1); }
    // stacks of finished sheets
    g.fillStyle = "#d8cfb4"; for (let i = 0; i < 9; i++) g.fillRect(8, 90 - i * 2, 34, 2);
    g.fillStyle = "#b8ad90"; for (let i = 0; i < 9; i++) g.fillRect(8, 91 - i * 2, 34, 1);
    // the person: big, hunched, sweating
    const bob = Math.round(Math.sin(fast * 0.9) * 0.6);
    g.fillStyle = "#5a3f6a"; g.fillRect(58, 72 + bob, 64, 30);             // shirt
    g.fillStyle = "#4a3258"; g.fillRect(58, 72 + bob, 64, 3);
    g.fillStyle = "#e8b890"; g.fillRect(84, 64 + bob, 12, 9);              // neck
    g.fillStyle = "#f0c8a0"; g.fillRect(72, 30 + bob, 36, 36);             // head
    g.fillStyle = "#2a1a10"; g.fillRect(70, 24 + bob, 40, 11); g.fillRect(70, 30 + bob, 5, 18); g.fillRect(105, 30 + bob, 5, 14); // hair
    g.fillStyle = "#2a1a10"; g.fillRect(79, 43 + bob, 7, 2); g.fillRect(94, 43 + bob, 7, 2);           // worried brows, tilted
    g.fillRect(79, 42 + bob, 2, 1); g.fillRect(99, 42 + bob, 2, 1);
    g.fillStyle = "#1a1010"; g.fillRect(81, 48 + bob, 4, 2); g.fillRect(95, 48 + bob, 4, 2);           // eyes, looking down
    g.fillStyle = "#c0806a"; g.fillRect(86, 58 + bob, 9, 2); g.fillRect(85, 57 + bob, 2, 1); g.fillRect(94, 57 + bob, 2, 1); // grimace
    g.fillStyle = "#e0a890"; g.fillRect(74, 52 + bob, 4, 2); g.fillRect(102, 52 + bob, 4, 2);         // flushed cheeks
    for (let i = 0; i < 4; i++) { // sweat drops
      const p = (t * 0.7 + i * 0.29) % 1, sx = [75, 104, 80, 101][i], sy = 34 + p * 26;
      g.fillStyle = `rgba(159,216,255,${1 - p})`; g.fillRect(sx, Math.round(sy + bob), 2, 3); g.fillRect(sx, Math.round(sy + 3 + bob), 1, 1);
    }
    // desk, paper with frantic scribbles
    g.fillStyle = "#4a2e1c"; g.fillRect(0, 100, LO_W, 35); g.fillStyle = "#5a3a24"; g.fillRect(0, 100, LO_W, 2);
    g.fillStyle = "#efe7cf"; g.fillRect(48, 104, 70, 28);
    // they face us, so the page is upside down for us: they start at the edge nearest the camera
    // and write from their left to their right (our right to left), with their right hand (on our left)
    const written = lt * 22; // characters written
    const colX = (c) => 51 + (15 - c) * 4, rowY = (r) => 107 + (5 - r) * 4;
    g.fillStyle = "#3a3040";
    for (let r = 0; r < 6; r++) for (let c = 0; c < 16; c++) { const idx = r * 16 + c; if (idx < written % 96) g.fillRect(colX(c), rowY(r), ((idx * 7) % 3) + 1, 2); }
    const cur = Math.floor(written % 96), hx = colX(cur % 16), hy = rowY(Math.floor(cur / 16));
    lineLo(g, 114, 84 + bob, 112, 102, 5, "#5a3f6a"); g.fillStyle = "#e8b890"; g.fillRect(109, 101, 7, 5);  // their left hand holds the sheet
    lineLo(g, 64, 80 + bob, hx - 4, hy - 3, 5, "#5a3f6a");                                              // writing arm, from their right shoulder
    g.fillStyle = "#e8b890"; g.fillRect(hx - 6, hy - 6, 7, 6);                                            // hand
    g.fillStyle = "#e0c060"; g.fillRect(hx, hy - 3, 2, 5);                                                // pencil tip on the page
    // the mechanical calculator, crank spinning
    g.fillStyle = "#3a3a44"; g.fillRect(132, 96, 58, 18); g.fillStyle = "#56566a"; g.fillRect(134, 98, 54, 4);
    for (let i = 0; i < 8; i++) { g.fillStyle = (Math.floor(fast * 2) + i) % 3 === 0 ? "#fff3b0" : "#9a9280"; g.fillRect(136 + i * 6, 99, 4, 2); }
    for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) { g.fillStyle = "#c9c2a8"; g.fillRect(136 + i * 6, 105 + r * 4, 4, 3); }
    const cr = fast * 1.4; g.fillStyle = "#c9a44a"; g.fillRect(Math.round(194 + Math.cos(cr) * 4), Math.round(100 + Math.sin(cr) * 4), 3, 3); g.fillRect(191, 98, 3, 6);
    // lamp light, slight flicker
    const lg = g.createRadialGradient(100, 70, 4, 100, 70, 110); lg.addColorStop(0, `rgba(255,200,120,${0.22 + 0.03 * Math.sin(t * 17)})`); lg.addColorStop(1, "rgba(255,200,120,0)");
    g.fillStyle = lg; g.fillRect(0, 0, LO_W, LO_H);
    blitLo();
    const v = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 1150); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.7)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    text(typed("1944 · \"COMPUTER\" WAS A JOB TITLE", seg(lt, 0.2, d * 0.3)), W / 2, 90, 42, "#e8d8b0");
    if (lt > d * 0.45 && lt < d * 0.78) { mono("+  ≈ 1–2 s", 1480, 470, 40, "#e8d8b0", { align: "left", alpha: seg(lt, d * 0.45, d * 0.5) }); mono("×  ≈ 10–20 s", 1480, 530, 40, "#e8d8b0", { align: "left", alpha: seg(lt, d * 0.55, d * 0.6) }); }
    if (lt > d * 0.78) {
      const k = seg(lt, d * 0.78, d * 0.88);
      panel(W / 2 - 440, 920, 880, 110, "#6b5a3a");
      mono("≈ 1 CALCULATION / 5 SECONDS", W / 2, 975, 48, C.gold, { alpha: k });
    }
  };

  // A rough world map, rasterised once from simple outlines (lon, lat) of the landmasses.
  const LANDS = [
    [[-168,66],[-162,70],[-140,70],[-125,72],[-95,72],[-80,68],[-62,60],[-55,52],[-66,45],[-76,38],[-81,31],[-80,25],[-82,28],[-90,29],[-97,26],[-97,21],[-88,21],[-87,15],[-83,9],[-78,8],[-86,12],[-92,15],[-105,20],[-110,23],[-117,32],[-124,40],[-124,48],[-130,55],[-140,60],[-152,58],[-165,54],[-160,60]],
    [[-78,8],[-72,12],[-62,10],[-51,4],[-35,-6],[-39,-15],[-41,-22],[-48,-26],[-58,-35],[-62,-39],[-65,-45],[-68,-52],[-72,-54],[-75,-47],[-73,-38],[-71,-30],[-70,-18],[-76,-14],[-81,-5],[-80,1]],
    [[-72,78],[-60,82],[-30,83],[-18,77],[-20,70],[-40,62],[-48,60],[-55,65],[-68,76]],
    [[-10,36],[-9,43],[-2,44],[-5,48],[2,51],[8,54],[5,58],[10,63],[20,70],[30,71],[45,68],[60,70],[70,73],[90,76],[110,77],[140,73],[160,70],[180,68],[180,65],[170,60],[160,58],[156,51],[142,54],[140,46],[132,42],[127,35],[122,31],[121,25],[110,20],[108,11],[104,1],[100,7],[98,15],[94,17],[91,22],[80,15],[77,8],[73,20],[66,25],[57,25],[52,28],[48,30],[56,24],[59,22],[52,16],[44,12],[42,16],[35,28],[34,31],[36,36],[28,36],[26,40],[22,37],[19,40],[13,45],[16,38],[12,38],[9,44],[3,43],[-1,37],[-6,36]],
    [[-17,21],[-16,12],[-12,8],[-8,4],[2,6],[9,4],[10,-1],[12,-6],[14,-17],[18,-30],[20,-35],[26,-34],[32,-29],[35,-24],[40,-15],[40,-5],[44,2],[51,11],[43,12],[37,21],[33,31],[25,32],[20,31],[11,33],[10,37],[0,36],[-6,36],[-10,30],[-13,27]],
    [[114,-22],[114,-34],[118,-35],[123,-34],[131,-31],[138,-35],[141,-38],[147,-39],[150,-37],[153,-30],[153,-25],[146,-19],[142,-11],[136,-12],[131,-11],[125,-15],[122,-18]],
    [[-5,50],[1,51],[2,53],[-2,56],[-2,58],[-6,58],[-5,55],[-3,53],[-5,52]],
    [[130,31],[135,34],[140,36],[142,40],[141,45],[139,42],[136,36],[131,34]],
    [[109,-2],[110,2],[117,7],[119,1],[116,-4]], [[95,5],[98,4],[106,-6],[102,-4]], [[131,-1],[141,-3],[150,-10],[142,-9]],
    [[44,-25],[47,-25],[50,-15],[49,-12],[44,-17]], [[166,-46],[172,-41],[178,-38],[174,-42],[168,-47]],
  ];
  const LAND = new Uint8Array(360 * 180);
  LANDS.forEach((poly) => {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    for (let lat = Math.floor(Math.min(...ys)); lat <= Math.ceil(Math.max(...ys)); lat++)
      for (let lon = Math.floor(Math.min(...xs)); lon <= Math.ceil(Math.max(...xs)); lon++) {
        const X = lon + 0.5, Y = lat + 0.5; let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside && lat > -90 && lat < 90) LAND[(89 - lat) * 360 + ((lon + 180) % 360 + 360) % 360] = 1;
      }
  });
  const isLand = (lon, lat) => lat < -68 || LAND[clamp(Math.floor(89.5 - lat), 0, 179) * 360 + (((Math.floor(lon) + 180) % 360) + 360) % 360] === 1;
  const PEOPLE_COL = ["#f0c8a0", "#b58cff", "#7b86ff", "#ff7d6b", "#3df5c4", "#ffab40", "#ff4d8d", "#c9ceff", "#e8b890"].map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  const loImg = lx.createImageData(LO_W, LO_H);
  function globe(R, lon0, lat0, alpha) {
    const d = loImg.data, D = Math.PI / 180, s0 = Math.sin(lat0 * D), c0 = Math.cos(lat0 * D), q = R * D;
    const cx = LO_W / 2, cy = LO_H / 2 + 4;
    for (let py = 0; py < LO_H; py++) for (let px = 0; px < LO_W; px++) {
      const o = (py * LO_W + px) * 4, x = (px + 0.5 - cx) / R, y = (cy - (py + 0.5)) / R, r2 = x * x + y * y;
      if (r2 > 1.09) { d[o + 3] = 0; continue; }
      if (r2 > 1) { const a = (1.09 - r2) / 0.09; d[o] = 90; d[o + 1] = 140; d[o + 2] = 255; d[o + 3] = 120 * a * alpha; continue; }
      const z = Math.sqrt(1 - r2), y2 = y * c0 + z * s0, z2 = -y * s0 + z * c0;
      const lat = Math.asin(y2) / D, lon = lon0 + Math.atan2(x, z2) / D;
      const shade = 0.45 + 0.55 * clamp(z * 0.8 + x * -0.25 + y * 0.2, 0, 1);
      let col;
      if (isLand(((lon + 540) % 360) - 180, lat)) {
        // each land cell is one little person (head + shirt) while they're big enough to see
        const cs = Math.max(1, 10 * (R / 900)), cellDeg = cs / q;
        const fu = lon / cellDeg, fv = -lat / cellDeg, cu = Math.floor(fu), cv2 = Math.floor(fv), u = fu - cu, v = fv - cv2;
        const h = Math.abs((cu * 73856093) ^ (cv2 * 19349663)) % 97;
        if (lat < -68) col = [220, 226, 240];
        else if (cs < 2.5) col = PEOPLE_COL[h % PEOPLE_COL.length];
        else if (v < 0.38 && u > 0.3 && u < 0.7) col = PEOPLE_COL[0];
        else if (v > 0.42 && u > 0.18 && u < 0.82) col = PEOPLE_COL[1 + (h % (PEOPLE_COL.length - 1))];
        else col = [26, 22, 44];
      } else col = [16, 30, 72];
      d[o] = col[0] * shade; d[o + 1] = col[1] * shade; d[o + 2] = col[2] * shade; d[o + 3] = 255 * alpha;
    }
    const tmp = globe.tmp || (globe.tmp = Object.assign(document.createElement("canvas"), { width: LO_W, height: LO_H }));
    tmp.getContext("2d").putImageData(loImg, 0, 0);
    lx.drawImage(tmp, 0, 0);
  }

  // crowd: from one person to 8 billion, zooming out until they form the Earth
  const CROWD_SHIRTS = ["#b58cff", "#7b86ff", "#ff7d6b", "#3df5c4", "#ffab40", "#ff4d8d", "#c9ceff"];
  SC.crowd = (lt, d, t) => {
    lx.fillStyle = "#07060f"; lx.fillRect(0, 0, LO_W, LO_H);
    for (let i = 0; i < 70; i++) { lx.fillStyle = (i * 13 + Math.floor(t * 2)) % 9 === 0 ? "#ecebff" : "#3d3772"; lx.fillRect((i * 97 + ((i * i * 31) % 17)) % LO_W, (i * 53 + ((i * 7) % 11)) % LO_H, 1, 1); }
    const kA = easeInOut(seg(lt, d * 0.12, d * 0.4));
    const gridA = 1 - seg(lt, d * 0.34, d * 0.44);
    if (gridA > 0) {
      const scale = lerp(6, 1.2, kA), pw = 8 * scale, ph = 10 * scale;
      const cols = Math.ceil(LO_W / pw) + 2, rows = Math.ceil(LO_H / ph) + 2, cx = LO_W / 2, cy = LO_H / 2 + 8;
      const maxR = lt < d * 0.1 ? 0 : Math.hypot(LO_W, LO_H) * seg(lt, d * 0.1, d * 0.3) + 4;
      lx.globalAlpha = gridA;
      for (let r = -Math.ceil(rows / 2); r <= Math.ceil(rows / 2); r++) for (let c = -Math.ceil(cols / 2); c <= Math.ceil(cols / 2); c++) {
        const x = cx + c * pw - pw / 2, y = cy + r * ph - ph / 2;
        if (Math.hypot(x - cx, y - cy) > maxR && !(r === 0 && c === 0)) continue;
        const h = Math.abs((c * 73856093) ^ (r * 19349663)), shirt = CROWD_SHIRTS[h % CROWD_SHIRTS.length];
        if (scale > 2) { lx.save(); lx.translate(Math.round(x), Math.round(y)); lx.scale(scale, scale); person(lx, 1, 1, shirt, h % 3 ? "#2a1a10" : "#c9a44a"); lx.restore(); }
        else { lx.fillStyle = "#f0c8a0"; lx.fillRect(Math.round(x + pw / 2 - 1), Math.round(y + 1), 2, 2); lx.fillStyle = shirt; lx.fillRect(Math.round(x + pw / 2 - 2), Math.round(y + 3), 4, 3); }
      }
      lx.globalAlpha = 1;
    }
    if (lt > d * 0.34) {
      const e = easeInOut(seg(lt, d * 0.34, d * 0.9));
      const R = 900 * Math.pow(56 / 900, e);
      globe(R, 18 + lt * 5, lerp(10, 18, e), seg(lt, d * 0.34, d * 0.44));
    }
    blitLo();
    const count = lt < d * 0.12 ? 1 : Math.min(8e9, Math.pow(10, 9.903 * easeInOut(seg(lt, d * 0.12, d * 0.9))));
    rect(W / 2 - 500, 28, 1000, 142, "rgba(7,6,15,.82)");
    mono(fmt(count), W / 2, 80, 72, C.gold, { glow: 10 });
    text("PEOPLE, CALCULATING TOGETHER", W / 2, 140, 30, C.muted);
  };

  // all of humanity vs one GPU
  SC.slideshow = (lt, d, t) => {
    background(t);
    const cell = 22, y = 250;
    const lxp = 150, rxp = W - 150 - SW * cell;
    // humanity: one frame per 2.5 s, pixels in random order
    const hp = ((lt - 0.2) / 1.25); // 2e9 calcs ÷ 8e9 people × 5 s each
    const frameN = Math.max(0, Math.floor(hp)), part = hp - frameN;
    screen(lxp, y, cell, (i) => (hp >= 0 && RANK[i] < part ? full(i) : null));
    text("ALL 8 BILLION HUMANS", lxp + (SW * cell) / 2, 190, 34, C.cpu);
    mono(`FRAME ${frameN + 1} · ${Math.round(clamp(part, 0, 1) * 100)}%`, lxp + (SW * cell) / 2, y + SH * cell + 60, 34, C.ink);
    // GPU: 60 frames per second, the sun drifts so you can see it's live
    const gf = Math.floor(lt * 60);
    const shift = Math.floor(gf / 6) % 3;
    screen(rxp, y, cell, (i) => { const c = SCENE[i]; const s = ((i % SW) + shift) % 3 === 0 && Math.floor(i / SW) >= PX.K.SEA ? 1.25 : 1; return `rgb(${Math.min(255, c[0] * s)},${Math.min(255, c[1] * s)},${Math.min(255, c[2] * s)})`; });
    text("ONE GRAPHICS CARD", rxp + (SW * cell) / 2, 190, 34, C.gpu);
    mono(`FRAME ${fmt(gf + 1)}`, rxp + (SW * cell) / 2, y + SH * cell + 60, 34, C.ink);
    if (lt > d * 0.55) mono(typed("60 FRAMES · EVERY SECOND", seg(lt, d * 0.55, d * 0.75)), W / 2, 960, 54, C.gold);
  };

  // the GPU die rises; postage-stamp outline
  function gpuDie(cx, cy, s, t, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(cx, cy, s * 0.2, cx, cy, s * 1.3); g.addColorStop(0, "rgba(61,245,196,.25)"); g.addColorStop(1, "rgba(61,245,196,0)");
    ctx.fillStyle = g; ctx.fillRect(cx - s * 1.4, cy - s * 1.4, s * 2.8, s * 2.8);
    for (let i = 0; i < s; i += 18) { rect(cx - s / 2 + i + 4, cy - s / 2 - 18, 8, 12, "#c9a44a"); rect(cx - s / 2 + i + 4, cy + s / 2 + 6, 8, 12, "#c9a44a"); rect(cx - s / 2 - 18, cy - s / 2 + i + 4, 12, 8, "#c9a44a"); rect(cx + s / 2 + 6, cy - s / 2 + i + 4, 12, 8, "#c9a44a"); }
    rect(cx - s / 2, cy - s / 2, s, s, "#15122b");
    const n = 16, c = (s - 20) / n;
    for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
      const lit = Math.sin(t * 6 - (r + q) * 0.35) > 0.35;
      rect(cx - s / 2 + 10 + q * c + 2, cy - s / 2 + 10 + r * c + 2, c - 4, c - 4, lit ? "#b8fff0" : C.gpuDeep);
    }
    ctx.restore();
  }
  SC.chip = (lt, d, t) => {
    background(t);
    const k = easeOut(seg(lt, 0, d * 0.4));
    gpuDie(W / 2, lerp(700, 480, k), 380, t, k);
    if (lt > d * 0.45) {
      const a = seg(lt, d * 0.45, d * 0.6);
      ctx.save(); ctx.globalAlpha = a; ctx.setLineDash([14, 10]); ctx.strokeStyle = C.ink; ctx.lineWidth = 4;
      ctx.strokeRect(W / 2 - 260, 480 - 300, 520, 600); ctx.restore();
      text("≈ THE SIZE OF A POSTAGE STAMP", W / 2, 900, 40, C.ink, { alpha: a });
    }
    if (lt > d * 0.75) mono("60 FPS · NO SWEAT", W / 2, 980, 36, C.gpu, { alpha: seg(lt, d * 0.75, d * 0.85) });
  };

  SC.paradox = (lt, d, t) => {
    background(t);
    cpuCore(t, 600, 470, 17, 1, 1);
    text("CPU CORE", 600, 660, 40, C.cpu);
    const gk = seg(lt, d * 0.2, d * 0.32);
    if (gk > 0) { gpuCore(1320, 470, 26 * (gk < 1 ? 1 + Math.sin(gk * Math.PI) * 0.5 : 1) * clamp(gk * 3, 0, 1)); text("GPU CORE", 1320, 580, 40, C.gpu, { alpha: gk }); }
    const kS = seg(lt, d * 0.5, d * 0.62);
    if (kS > 0) { mono(typed("~5.5 GHz", kS), 600, 740, 36, C.ink); mono(typed("~2.5 GHz", kS), 1320, 650, 36, C.ink); }
    const kD = seg(lt, d * 0.7, d * 0.8);
    if (kD > 0) {
      text("?", 1325, 370 + Math.sin(t * 7) * 8, 80, C.gold, { alpha: kD });
      mono(typed("branch prediction · out-of-order · big cache", kD), 600, 810, 22, C.muted);
      mono(typed("just math", kD), 1320, 720, 22, C.muted);
    }
  };

  SC.question = (lt, d, t, s) => {
    const speechEnd = s.speech;
    if (lt > speechEnd + 0.1) { // title card
      background(t, 0.5);
      const k = seg(lt, speechEnd + 0.1, speechEnd + 0.5);
      text("TRICKED", W / 2 - 200, H / 2 - 30, 120, C.ink, { alpha: k });
      text("ROCKS", W / 2 + 300, H / 2 - 30, 120, C.gpu, { alpha: k, glow: 16 });
      text("EP 01 · THE PARALLEL MACHINE", W / 2, H / 2 + 90, 38, C.muted, { alpha: seg(lt, speechEnd + 0.4, speechEnd + 0.8) });
      return;
    }
    background(t);
    const hit = speechEnd * 0.4;
    const k = seg(lt, 0, hit);
    const n = Math.pow(2, clamp(Math.floor(Math.pow(k, 1.6) * 14 + 1e-9), 0, 14));
    swarm(t, n, 480, 170, 1380, 760);
    cpuCore(t, 230, 880, 6, 1, 0.3);
    text("1 CPU CORE", 230, 975, 26, C.cpu);
    text(`× ${fmt(n)}`, 1860, 100, 56, C.gpu, { align: "right" });
    text("GPU CORES", 1860, 150, 24, C.muted, { align: "right" });
    if (lt > hit) {
      const q = easeOut(seg(lt, hit, hit + 0.3));
      rect(480, H / 2 - 170, 1380, 300, `rgba(7,6,15,${0.8 * q})`);
      text("HOW DOES THE", 1170, H / 2 - 80, 72, C.ink, { alpha: q });
      text("DUMBER CHIP WIN?", 1170, H / 2 + 20, 96, C.gold, { alpha: q });
      if (lt > speechEnd * 0.72) text("LET'S BUILD ONE.", 1170, H / 2 + 105, 40, C.gpu, { alpha: seg(lt, speechEnd * 0.72, speechEnd * 0.82) });
    }
  };

  // ---- ACT 1 · THE CPU ----
  const BRAIN = ["branch prediction", "out-of-order execution", "big private cache", "speculation", "register renaming"];
  SC.cpuhero = (lt, d, t) => {
    background(t);
    cpuCore(t, W / 2, 470, 22, easeOut(seg(lt, 0, 1.2)), seg(lt, 0.3, 1.2));
    text("CPU CORE", W / 2, 720, 48, C.cpu, { alpha: seg(lt, 0.8, 1.2) });
    body(typed("the brilliant worker", seg(lt, d * 0.25, d * 0.45)), W / 2, 790, 38, C.ink);
    BRAIN.forEach((b, i) => {
      const a = seg(lt, 1 + i * 0.3, 1.5 + i * 0.3);
      const ang = [-2.55, -1.95, -1.2, -0.45, 0.15][i], R = 330 + (i % 2) * 30;
      mono(b, W / 2 + Math.cos(ang) * R * 1.35, 470 + Math.sin(ang) * R * 0.75 + Math.sin(t * 1.4 + i) * 6, 26, C.muted, { alpha: a * 0.9 });
    });
    if (lt > d * 0.6) mono(typed("one step at a time · ~5,000,000,000 steps / second", seg(lt, d * 0.6, d * 0.85)), W / 2, 900, 30, C.gold);
  };

  function recipeList(x, y, k, pixel, o = {}) {
    // plain-English recipe; k = current step index (−1 none), values from the pixel's trace
    STEPS.forEach((st, i) => {
      const yy = y + i * 62;
      const on = i === k, past = k >= 0 && i < k;
      if (on) { rect(x - 16, yy - 28, 760, 56, "rgba(255,171,64,.14)"); rect(x - 16, yy - 28, 6, 56, C.cpu); }
      const skip = pixel != null && (past || on) && st.cond && !TRACE[pixel][i].took;
      mono(String(i + 1), x + 10, yy, 24, on ? C.cpu : C.dim, { align: "left" });
      body(st.plain, x + 50, yy, 30, skip ? C.dim : on ? C.ink : o.dim ? C.muted : "#c9c6ea", { align: "left" });
      if (skip) rect(x + 50, yy, ctx.measureText(st.plain).width * 0 + 520, 2, "rgba(255,90,90,.6)");
      if (pixel != null && (past || on) && !skip && TRACE[pixel][i].color && (st.cond || i === 0 || i === STEPS.length - 1)) rect(x + 690, yy - 14, 28, 28, TRACE[pixel][i].color);
    });
  }
  SC.recipe = (lt, d, t) => {
    background(t);
    const cell = 26, sx = 110, sy = 280, pix = 9 * SW + 17;
    const k = Math.min(7, Math.floor(seg(lt, d * 0.12, d * 0.95) * 8) - (lt < d * 0.12 ? 1 : 0));
    screen(sx, sy, cell, (i) => (i === pix && k >= 0 ? TRACE[pix][Math.min(k, 7)].color : ((i % 3) === 0 && lt < 0 ? null : null)));
    // highlight the pixel
    ctx.strokeStyle = C.ink; ctx.lineWidth = 4; ctx.strokeRect(sx + (pix % SW) * cell - 3, sy + Math.floor(pix / SW) * cell - 3, cell + 6, cell + 6);
    text("ONE PIXEL", sx + (SW * cell) / 2, sy - 60, 32, C.muted);
    text("THE RECIPE", 1150, 200, 36, C.cpu, { align: "left" });
    recipeList(1150, 290, k, pix);
  };

  SC.painting = (lt, d, t) => {
    background(t);
    const cell = 26, sx = 110, sy = 280;
    // accelerate: steps done grows superlinearly so it ends complete
    const p = Math.pow(seg(lt, 0.3, d * 0.95), 2.2);
    const steps = Math.floor(p * NPX * 8), cur = Math.floor(steps / 8);
    screen(sx, sy, cell, (i) => (i < cur ? full(i) : i === cur ? TRACE[i][steps % 8].color : null));
    cpuCore(t, sx + 60, sy + SH * cell + 110, 5, 1, 0.4);
    mono(`PIXEL ${fmt(Math.min(NPX, cur + 1))} / 576`, sx + 140, sy + SH * cell + 90, 30, C.cpu, { align: "left" });
    mono(`STEPS ${fmt(steps)}`, sx + 140, sy + SH * cell + 135, 30, C.ink, { align: "left" });
    text("THE RECIPE", 1150, 200, 36, C.cpu, { align: "left" });
    const rate = (8 * NPX * 2.2 * Math.pow(seg(lt, 0.3, d * 0.95), 1.2)) / (d * 0.95 - 0.3);
    recipeList(1150, 290, rate < 12 ? steps % 8 : -1, rate < 12 ? cur : null, { dim: rate >= 12 });
    if (rate >= 12) text("▶▶ ONE STEP AT A TIME, VERY FAST", 1150, 820, 26, C.gold, { align: "left" });
  };

  SC.math = (lt, d, t) => {
    background(t);
    const row = (y, a, b, color, k) => { if (k <= 0) return; mono(a, 1000, y, 72, color, { align: "right", alpha: k }); body(b, 1040, y, 38, C.muted, { align: "left", alpha: k }); };
    row(300, "2,000,000,000", "steps per frame", C.cpu, seg(lt, d * 0.18, d * 0.3));
    row(440, "÷ 4,000,000,000", "steps per second (4 GHz)", C.ink, seg(lt, d * 0.35, d * 0.48));
    if (lt > d * 0.6) { rect(420, 520, 1080, 6, C.dim); }
    row(640, "= 2", "frames per second", C.hot, seg(lt, d * 0.6, d * 0.7));
    if (lt > d * 0.8) {
      // a choppy slideshow: the image updates only twice per second
      const f = Math.floor(lt * 2) % 2;
      screen(W / 2 - 16 * 12, 780, 12, (i) => { const c = SCENE[(i + f * 3) % NPX]; return rgb(c); });
      text("SLIDESHOW", W / 2, 1040, 30, C.hot, { alpha: seg(lt, d * 0.85, d * 0.95) });
    }
  };

  const CLOCK = [[1990, 0.033], [1993, 0.066], [1995, 0.133], [1997, 0.3], [1999, 0.6], [2000, 1.0], [2001, 1.7], [2002, 3.0], [2004, 3.6], [2005, 3.8], [2008, 3.2], [2011, 3.6], [2014, 4.0], [2017, 4.5], [2020, 5.3], [2023, 6.0], [2025, 6.0]];
  SC.wall = (lt, d, t) => {
    background(t);
    const x0 = 160, x1 = 1280, y0 = 860, y1 = 200;
    // log scale: 10 MHz … 10 GHz, so the pre-2005 exponential climb and the plateau are both honest
    const X = (yr) => x0 + ((yr - 1990) / 35) * (x1 - x0), Y = (g) => y0 - ((Math.log10(g) + 2) / 3) * (y0 - y1);
    rect(x0, y0, x1 - x0, 4, C.dim); rect(x0, y1, 4, y0 - y1, C.dim);
    [1990, 2000, 2010, 2020].forEach((yr) => mono(String(yr), X(yr), y0 + 40, 26, C.muted));
    [[0.01, "10 MHz"], [0.1, "100 MHz"], [1, "1 GHz"], [10, "10 GHz"]].forEach(([g, l]) => { mono(l, x0 - 20, Y(g), 24, C.muted, { align: "right" }); rect(x0, Y(g), x1 - x0, 1, "rgba(123,134,255,.12)"); });
    mono("log scale", x1, y0 + 40, 22, C.dim, { align: "right" });
    text("FASTEST CPU CLOCK SPEED", x0, 140, 34, C.cpu, { align: "left" });
    const upTo = lerp(1990, 2025, easeInOut(seg(lt, d * 0.08, d * 0.62)));
    ctx.strokeStyle = C.cpu; ctx.lineWidth = 8; ctx.beginPath();
    CLOCK.forEach(([yr, g], i) => { if (yr > upTo && i > 0) return; i === 0 ? ctx.moveTo(X(yr), Y(g)) : ctx.lineTo(X(yr), Y(g)); });
    ctx.stroke();
    if (upTo > 2005) {
      const a = seg(lt, d * 0.35, d * 0.45);
      rect(X(2005) - 10, y1, 20, y0 - y1, hexA(C.bad, 0.35 * a));
      text("THE POWER WALL", X(2005) + 30, y1 + 30, 30, C.bad, { align: "left", alpha: a });
    }
    if (lt > d * 0.55) mono(typed("POWER ∝ CLOCK³", seg(lt, d * 0.55, d * 0.68)), 1600, 300, 52, C.gold);
    const heat = seg(lt, d * 0.72, d * 0.92);
    cpuCore(t, 1600, 600, 10, 1, 0.6 + heat, heat);
    if (heat > 0.3) for (let i = 0; i < 18; i++) { const p = (t * 0.6 + i * 0.13) % 1; rect(1560 + ((i * 37) % 90), 520 - p * 260, 10, 10, `rgba(160,150,190,${(1 - p) * 0.6 * heat})`); }
    if (heat > 0.6) text("TOO HOT", 1600, 780, 44, C.bad, { alpha: seg(lt, d * 0.85, d * 0.92) });
  };

  // ---- ACT 2 · MORE WORKERS ----
  SC.multicore = (lt, d, t) => {
    background(t);
    const tile = 90, x = 260, y = 180;
    const parts = FOUR_CPUS.map((p, i) => ({ ...p, pop: seg(lt, d * (0.4 + i * 0.1), d * (0.46 + i * 0.1)) }));
    die(x, y, tile, parts);
    const n = parts.filter((p) => p.pop > 0.5).length;
    text("64 TILES OF SILICON", x + 360, y - 60, 30, C.muted);
    if (n > 0) { mono(`${n}×`, 1450, 460, 200, C.gpu, { glow: 20 }); text("FASTER", 1450, 620, 50, C.ink); }
  };

  SC.outofsilicon = (lt, d, t) => {
    background(t);
    const z = easeInOut(seg(lt, d * 0.72, d * 0.98));
    ctx.save();
    ctx.translate(lerp(0, -260 * 5 + 200, z), lerp(0, -180 * 5 + 100, z));
    ctx.scale(lerp(1, 5, z), lerp(1, 5, z));
    die(260, 180, 90, FOUR_CPUS);
    ctx.restore();
    if (z < 0.2) {
      mono("NEED ≈ 100×", 1450, 380, 90, C.gold, { alpha: seg(lt, d * 0.05, d * 0.18) * (1 - z * 5) });
      const s = seg(lt, d * 0.3, d * 0.38);
      if (s > 0) {
        ctx.save(); ctx.translate(620, 540); ctx.rotate(-0.18); ctx.scale(lerp(1.6, 1, easeOut(s)), lerp(1.6, 1, easeOut(s)));
        ctx.globalAlpha = s * (1 - z * 5);
        ctx.strokeStyle = C.bad; ctx.lineWidth = 10; ctx.strokeRect(-380, -80, 760, 160);
        text("OUT OF SILICON", 0, 0, 80, C.bad);
        ctx.restore();
      }
    }
  };

  SC.xray = (lt, d, t) => {
    background(t);
    const layout = "BBBCBBBCBBBCCCCA", tile = 150, x = 260, y = 240;
    rect(x - 10, y - 10, tile * 4 + 10, tile * 4 + 10, C.cpuDeep);
    [...layout].forEach((c, i) => {
      const a = seg(lt, 0.2 + i * 0.12, 0.45 + i * 0.12);
      if (a <= 0) return;
      const col = c === "B" ? C.brain : c === "C" ? C.cache : C.gpu;
      const pulse = c === "A" && lt > d * 0.7 ? 0.5 + 0.5 * Math.sin(t * 8) : 0;
      ctx.globalAlpha = a;
      rect(x + (i % 4) * tile, y + Math.floor(i / 4) * tile, tile - 10, tile - 10, pulse ? "#b8fff0" : col);
      ctx.globalAlpha = 1;
    });
    text("INSIDE ONE CPU CORE", x + tile * 2 - 5, y - 70, 34, C.cpu);
    const lab = (k, y2, color, t1, t2) => { const a = seg(lt, d * k, d * (k + 0.08)); if (a <= 0) return; rect(960, y2 - 26, 16, 16, color); text(t1, 1000, y2 - 18, 36, color, { align: "left", alpha: a }); body(t2, 1000, y2 + 30, 30, C.muted, { align: "left", alpha: a }); };
    lab(0.12, 330, C.brain, "BRAIN", "predicts branches, reorders instructions");
    lab(0.5, 520, C.cache, "CACHE", "a private stash of memory");
    lab(0.72, 710, C.gpu, "ALU: THE MATH", "1 tile out of 16");
  };

  SC.insight = (lt, d, t) => {
    background(t);
    const cols = 12, rows = 6, cw = 130, chh = 120, ox = (W - cols * cw) / 2 + 10, oy = 170;
    const n = Math.floor(seg(lt, 0, d * 0.4) * cols * rows);
    for (let i = 0; i < n; i++) {
      const x = ox + (i % cols) * cw, y = oy + Math.floor(i / cols) * chh;
      rect(x, y, 100, 90, C.cpuDeep);
      const sync = lt > d * 0.45 && Math.sin(t * 6) > 0;
      rect(x + 6, y + 6, 60, 50, sync ? "#ffb8a8" : C.brain);
      rect(x + 72, y + 6, 22, 50, C.cache);
      rect(x + 40, y + 62, 22, 22, C.gpu);
    }
    if (lt > d * 0.3) mono(typed("SAME RECIPE × 576", seg(lt, d * 0.3, d * 0.45)), W / 2, 110, 44, C.gold);
    if (lt > d * 0.62) {
      const k = seg(lt, d * 0.62, d * 0.75);
      rect(0, 860, W, 220, hexA(C.bg, 0.9 * k));
      text("WHY DOES EVERY WORKER", W / 2, 920, 56, C.ink, { alpha: k });
      text("NEED ITS OWN BRAIN?", W / 2, 1000, 64, C.brain, { alpha: k });
    }
  };

  // ---- ACT 3 · SHARE ONE BRAIN ----
  SC.rows = (lt, d, t) => {
    background(t);
    const tile = 90, x = 260, y = 180;
    const parts = GPU_PARTS.map((p, i) => {
      const r = p.y, idx = p.type === "ctrl" ? 0 : p.x - 1;
      const at = r === 0 ? d * 0.12 + idx * d * 0.04 : d * 0.45 + r * d * 0.035 + idx * 0.02;
      const shout = lt > d * 0.7 && p.type === "alu" && Math.abs(((t * 1.6) % 1) * 8 - p.x) < 0.8;
      return { ...p, pop: seg(lt, at, at + 0.25), lit: shout, label: p.type === "ctrl" && lt > d * 0.7 && ((t * 1.6) % 1) < 0.3 ? "STEP!" : "CTRL" };
    });
    die(x, y, tile, parts);
    const a1 = seg(lt, d * 0.12, d * 0.22), a2 = seg(lt, d * 0.3, d * 0.4);
    rect(1100, 330, 18, 18, C.sky); text("CONTROL UNIT", 1140, 340, 38, C.sky, { align: "left", alpha: a1 }); body("reads the recipe, shouts each step", 1140, 392, 30, C.muted, { align: "left", alpha: a1 });
    rect(1100, 520, 18, 18, C.gpu); text("ALU × 6 PER ROW", 1140, 530, 38, C.gpu, { align: "left", alpha: a2 }); body("simple math units, no brain", 1140, 582, 30, C.muted, { align: "left", alpha: a2 });
  };

  SC.lanes = (lt, d, t) => {
    background(t);
    const LY = 9, LX = 14;
    const k = Math.min(7, Math.floor(seg(lt, d * 0.1, d * 0.97) * 8) - (lt < d * 0.1 ? 1 : 0));
    // mini screen with the 6 pixels
    const cell = 12, sx = 120, sy = 90;
    screen(sx, sy, cell, full);
    ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.strokeRect(sx + LX * cell - 2, sy + LY * cell - 2, 6 * cell + 4, cell + 4);
    // control unit
    panel(640, 80, 1160, 150, C.sky);
    text("CONTROL UNIT SHOUTS", 680, 120, 22, C.sky, { align: "left" });
    body(k >= 0 ? STEPS[k].plain : "Everyone: load your own x, y", 680, 180, 44, C.ink, { align: "left" });
    // six lanes
    for (let l = 0; l < 6; l++) {
      const tr = TRACE[LY * SW + LX + l], s = k >= 0 ? tr[k] : { x: LX + l, y: LY, color: null, took: true };
      const masked = k >= 0 && STEPS[k].cond && !s.took;
      const x = 120 + l * 290, y = 330;
      ctx.globalAlpha = masked ? 0.35 : 1;
      panel(x, y, 260, 560, masked ? C.line : C.gpuDeep);
      text(`ALU ${l + 1}`, x + 24, y + 40, 26, C.gpu, { align: "left" });
      rect(x + 180, y + 18, 56, 56, s.color || "#0f0d20");
      const regs = [["x", s.x], ["y", s.y], ["d", s.d != null ? s.d.toFixed(1) : "—"], ["h", s.h != null ? s.h : "—"]];
      regs.forEach(([n, v], i) => { mono(n, x + 28, y + 140 + i * 70, 30, C.muted, { align: "left" }); mono(String(v), x + 232, y + 140 + i * 70, 34, C.ink, { align: "right" }); });
      mono("my notepad", x + 130, y + 440, 20, C.dim);
      mono(k < 0 ? "ready" : masked ? "sits out" : "does it", x + 130, y + 500, 26, masked ? C.bad : C.gpu);
      ctx.globalAlpha = 1;
    }
    mono(typed("SAME INSTRUCTION · DIFFERENT DATA", seg(lt, d * 0.3, d * 0.45)), W / 2, 980, 40, C.gold);
  };

  SC.race = (lt, d, t, s) => {
    background(t);
    const r0 = s.speech * 0.4, dur = 3.0;
    const k = seg(lt, r0, r0 + dur), tick = k * SCH_GPU.total;
    const cell = 24, y = 250, lx0 = 120, rx0 = W - 120 - SW * cell;
    screen(lx0, y, cell, schedState(SCH_CPU, tick, C.cpu));
    screen(rx0, y, cell, schedState(SCH_GPU, tick, C.gpu));
    text("1 CPU CORE", lx0 + (SW * cell) / 2, 190, 36, C.cpu);
    text("YOUR CHIP · 48 WORKERS", rx0 + (SW * cell) / 2, 190, 36, C.gpu);
    mono(`${fmt(Math.min(tick, SCH_CPU.total))} ticks`, lx0 + (SW * cell) / 2, y + SH * cell + 60, 34, C.ink);
    mono(`${fmt(Math.min(tick, SCH_GPU.total))} ticks`, rx0 + (SW * cell) / 2, y + SH * cell + 60, 34, C.ink);
    if (lt > r0 + dur + 0.2) {
      const q = easeOut(seg(lt, r0 + dur + 0.2, r0 + dur + 0.5));
      rect(0, 830, W, 250, hexA(C.bg, 0.92 * q));
      text("24× FASTER", W / 2, 940, lerp(160, 120, q), C.gpu, { alpha: q, glow: 24 });
      mono("same silicon as 4 CPU cores", W / 2, 1030, 30, C.muted, { alpha: q });
    }
  };

  SC.invented = (lt, d, t) => {
    background(t);
    die(160, 250, 70, GPU_PARTS.map((p) => ({ ...p, lit: p.type === "alu" && Math.sin(t * 6 - p.y * 0.4) > 0.6 })));
    const a = seg(lt, d * 0.12, d * 0.3);
    text("YOU JUST INVENTED", 1270, 330, 62, C.ink, { alpha: a });
    text("THE GPU", 1270, 440, 130, C.gpu, { alpha: seg(lt, d * 0.2, d * 0.35), glow: 22 });
    if (lt > d * 0.55) {
      text("SIMD", 1270, 640, 110, C.gold, { alpha: seg(lt, d * 0.55, d * 0.62) });
      body(typed("Single Instruction, Multiple Data", seg(lt, d * 0.65, d * 0.9)), 1270, 740, 44, C.ink);
    }
  };

  SC.scale = (lt, d, t) => {
    background(t);
    const BW = 18, BH = 8, GAP = 2, NX = 16, NY = 8, WW = NX * BW + (NX + 1) * GAP, WH = NY * BH + (NY + 1) * GAP;
    const z = easeInOut(seg(lt, d * 0.05, d * 0.5));
    const vw = 1700, vh = 760, full_ = vw / WW, close = vh / (BH + GAP * 2);
    const sc = close * Math.pow(full_ / close, z);
    const hx = GAP + 7 * (BW + GAP) + BW / 2, hy = GAP + 3 * (BH + GAP) + BH / 2;
    const cx = lerp(hx, WW / 2, z), cy = lerp(hy, WH / 2, z);
    ctx.save(); ctx.beginPath(); ctx.rect(110, 140, vw, vh); ctx.clip();
    ctx.translate(110 + vw / 2 - cx * sc, 140 + vh / 2 - cy * sc); ctx.scale(sc, sc);
    rect(0, 0, WW, WH, "#15122b");
    const litBlocks = Math.floor(easeOut(seg(lt, d * 0.1, d * 0.55)) * 128);
    for (let by = 0; by < NY; by++) for (let bx = 0; bx < NX; bx++) {
      const ox = GAP + bx * (BW + GAP), oy = GAP + by * (BH + GAP);
      const dist = Math.hypot(bx - 7, (by - 3) * 2);
      const on = (bx === 7 && by === 3) || dist * 9 < litBlocks;
      for (let r = 0; r < BH; r++) {
        ctx.fillStyle = on ? C.sky : "#1f1b3d"; ctx.fillRect(ox, oy + r, 2, 1);
        for (let c = 0; c < 16; c++) {
          const warp = Math.floor((r * 16 + c) / 32);
          ctx.fillStyle = on ? (Math.sin(t * 6 - (bx + by * 1.7) * 0.6 - warp * 0.9) > 0.2 ? "#b8fff0" : C.gpu) : "#1b1836";
          ctx.fillRect(ox + 2 + c + 0.08, oy + r + 0.08, 0.84, 0.84);
        }
      }
    }
    ctx.restore();
    const count = Math.round(lerp(128, 16384, easeOut(seg(lt, d * 0.1, d * 0.55))));
    mono(fmt(count), 110, 80, 60, C.gpu, { align: "left" });
    text("MATH UNITS", 110 + 300, 84, 30, C.muted, { align: "left" });
    if (lt > d * 0.7) mono(typed("≈ 80,000,000,000,000 CALCULATIONS / SECOND", seg(lt, d * 0.7, d * 0.9)), W / 2, 980, 44, C.gold);
  };

  // ---- ACT 4 · AI ----
  SC.neural = (lt, d, t) => {
    background(t);
    const layers = [6, 8, 8, 4], xs = [360, 760, 1160, 1560];
    const m = easeInOut(seg(lt, d * 0.62, d * 0.85));
    const pos = (li, ni) => [xs[li], 540 + (ni - (layers[li] - 1) / 2) * 100];
    ctx.lineWidth = 3;
    layers.forEach((n, li) => { if (li === layers.length - 1) return; for (let a = 0; a < n; a++) for (let b = 0; b < layers[li + 1]; b++) {
      const [x1, y1] = pos(li, a), [x2, y2] = pos(li + 1, b);
      const pulse = (t * 0.9 - li * 0.3 + (a + b) * 0.01) % 1;
      ctx.strokeStyle = hexA(pulse < 0.2 ? C.gold : C.sky, (pulse < 0.2 ? 0.5 : 0.12) * (1 - m));
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    } });
    layers.forEach((n, li) => { for (let a = 0; a < n; a++) { const [x, y] = pos(li, a); rect(x - 18, y - 18, 36, 36, li === 0 ? C.sky : li === 3 ? C.gpu : C.hot); } });
    if (m > 0) {
      rect(0, 0, W, H, hexA(C.bg, 0.85 * m));
      const g = (x, y, n, rows, col) => { for (let r = 0; r < rows; r++) for (let c = 0; c < n; c++) rect(x + c * 34, y + r * 34, 30, 30, hexA(col, 0.3 + (((r * 7 + c * 13) % 10) / 10) * 0.6)); };
      ctx.globalAlpha = m;
      g(260, 360, 6, 6, C.sky); text("×", 580, 460, 80, C.dim); g(660, 360, 6, 6, C.hot); text("=", 980, 460, 80, C.dim); g(1060, 360, 6, 6, C.gpu);
      ctx.globalAlpha = 1;
      text("MATRIX MULTIPLICATION", W / 2, 800, 60, C.gold, { alpha: m });
    }
    text("A NEURAL NETWORK", W / 2, 110, 40, C.ink, { alpha: 1 - m });
  };

  // matmul race, same layout as the lesson
  const MS = 16, MM = 24;
  seed = 11;
  const MA = Array.from({ length: MM }, () => Array.from({ length: MS }, rnd));
  const MB = Array.from({ length: MS }, () => Array.from({ length: MM }, rnd));
  const MCv = []; for (let i = 0; i < MM; i++) for (let j = 0; j < MM; j++) { let s = 0; for (let k = 0; k < MS; k++) s += MA[i][k] * MB[k][j]; MCv.push(s); }
  const mMin = Math.min(...MCv), mMax = Math.max(...MCv), HEAT = ["#1f2a6b", "#1e5a8a", "#169e93", "#3df5c4", "#b8ffe9"];
  const MCC = MCv.map((v) => HEAT[Math.min(4, Math.floor(((v - mMin) / (mMax - mMin)) * 5))]);
  const MSCH_CPU = schedule([{ lanes: 1, stepTicks: 1 }], MM * MM, MS), MSCH_GPU = schedule(GPU_CHIP, MM * MM, MS);
  function matmul(x0, y0, CELL, sch, t, lane) {
    const OX = x0 + MS * CELL + CELL, OY = y0 + MS * CELL + CELL;
    const rows = new Set(), cols = new Set(); let k = -1;
    for (let c = 0; c < MM * MM; c++) if (t >= sch.start[c] && t < sch.end[c]) { rows.add(Math.floor(c / MM)); cols.add(c % MM); k = Math.floor((t - sch.start[c]) / sch.stepT[c]); }
    for (let i = 0; i < MM; i++) for (let q = 0; q < MS; q++) { const on = rows.has(i); ctx.fillStyle = on && q === k ? C.gold : hexA(on ? "#a0aaff" : C.sky, on ? 0.9 : 0.18 + MA[i][q] * 0.3); ctx.fillRect(x0 + q * CELL, OY + i * CELL, CELL - 2, CELL - 2); }
    for (let q = 0; q < MS; q++) for (let j = 0; j < MM; j++) { const on = cols.has(j); ctx.fillStyle = on && q === k ? C.gold : hexA(on ? "#ff78aa" : C.hot, on ? 0.9 : 0.18 + MB[q][j] * 0.3); ctx.fillRect(OX + j * CELL, y0 + q * CELL, CELL - 2, CELL - 2); }
    for (let c = 0; c < MM * MM; c++) { ctx.fillStyle = t >= sch.end[c] ? MCC[c] : t >= sch.start[c] ? lane : "#131128"; ctx.fillRect(OX + (c % MM) * CELL, OY + Math.floor(c / MM) * CELL, CELL - 2, CELL - 2); }
    mono("B weights ↑", x0 + 10, y0 + 20, 20, C.muted, { align: "left" });
    mono("← A inputs", x0 + 10, y0 + 50, 20, C.muted, { align: "left" });
    let busy = 0; for (let c = 0; c < MM * MM; c++) if (t >= sch.start[c] && t < sch.end[c]) busy++;
    mono(`${busy} cell${busy === 1 ? "" : "s"} at once`, x0 + 10, y0 + 100, 22, C.gold, { align: "left" });
  }
  SC.matmul = (lt, d, t) => {
    background(t);
    const tick = seg(lt, d * 0.25, d * 0.92) * MSCH_GPU.total;
    matmul(120, 170, 17, MSCH_CPU, tick, C.cpu);
    matmul(1040, 170, 17, MSCH_GPU, tick, C.gpu);
    text("1 CPU CORE", 120 + 340, 110, 34, C.cpu);
    text("GPU · 48 WORKERS", 1040 + 340, 110, 34, C.gpu);
    mono("answer = row × column, multiplied and summed", W / 2, 1010, 30, C.ink, { alpha: seg(lt, 0.3, 1.2) });
  };

  const DINO = ["....gggg", "....gxgg", "....gggg", "g..ggg..", "gggggggg", ".gggggg.", "..g..g..", "..g..g.."];
  SC.training = (lt, d, t) => {
    background(t);
    mono("≈ 20,000,000,000,000,000,000,000,000", W / 2, 150, 50, C.gold, { alpha: seg(lt, 0.2, 0.8) });
    text("OPERATIONS TO TRAIN A GPT-4-CLASS AI MODEL", W / 2, 220, 30, C.muted, { alpha: seg(lt, 0.4, 1) });
    const bars = [
      { l: "1 CPU CORE", v: "≈ 60 MILLION YEARS", w: 1.0, c: C.cpu, at: 0.32 },
      { l: "1 AI GPU", v: "≈ 1,600 YEARS", w: 0.7, c: C.gpu, at: 0.55 },
      { l: "25,000 GPUs", v: "≈ 3 WEEKS", w: 0.41, c: C.gpu, at: 0.8 },
    ];
    bars.forEach((b, i) => {
      const k = easeOut(seg(lt, d * b.at, d * b.at + 1.0));
      if (k <= 0) return;
      const y = 380 + i * 190;
      text(b.l, 120, y, 34, b.c, { align: "left", alpha: k });
      rect(520, y - 30, 900 * b.w * k, 60, b.c);
      mono(b.v, 520 + 900 * b.w * k + 30, y, 36, C.ink, { align: "left", alpha: k });
      if (i === 0 && k > 0.9) { ctx.fillStyle = "#6ad17a"; DINO.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== ".") { ctx.fillStyle = ch === "x" ? C.bg : "#6ad17a"; ctx.fillRect(1500 + rx * 10, y - 130 + ry * 10, 10, 10); } })); }
    });
    mono("log scale · rough estimates", W / 2, 1020, 24, C.dim);
  };

  // ---- ACT 5 · CPUs STILL MATTER ----
  SC.chain = (lt, d, t) => {
    background(t);
    const N = 10, pts = Array.from({ length: N }, (_, i) => [220 + i * 165, 330 + Math.sin(i * 1.3) * 90]);
    ctx.setLineDash([12, 10]); ctx.strokeStyle = C.dim; ctx.lineWidth = 4; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); ctx.setLineDash([]);
    const hop = seg(lt, d * 0.25, d * 0.9) * (N - 1), at = Math.floor(hop), f = hop - at;
    pts.forEach(([x, y], i) => { text(i <= at ? "✓" : "X", x, y, 44, i <= at ? C.gpu : C.hot); });
    const [ax, ay] = pts[Math.min(at, N - 1)], [bx, by] = pts[Math.min(at + 1, N - 1)];
    cpuCore(t, lerp(ax, bx, easeInOut(f)), lerp(ay, by, easeInOut(f)) - 70 - Math.sin(f * Math.PI) * 40, 3, 1, 0.4);
    text("EACH CLUE NEEDS THE PREVIOUS ONE", W / 2, 140, 34, C.ink, { alpha: seg(lt, d * 0.1, d * 0.2) });
    // the idle army
    for (let r = 0; r < 5; r++) for (let c = 0; c < 36; c++) rect(260 + c * 40, 640 + r * 40, 26, 26, hexA(C.gpu, 0.22));
    if (lt > d * 0.45) { const z = Math.floor(t * 1.5) % 3; mono("z".repeat(z + 1), 1700, 620, 40, C.muted, { align: "left" }); text("16,000 WORKERS, WAITING", W / 2, 880, 34, C.gpuDeep, { alpha: seg(lt, d * 0.45, d * 0.55) }); }
    if (lt > d * 0.8) text("→ ONE BRILLIANT WORKER WINS", W / 2, 980, 40, C.cpu, { alpha: seg(lt, d * 0.8, d * 0.88) });
  };

  SC.team = (lt, d, t) => {
    background(t);
    cpuCore(t, 480, 480, 16, 1, 1);
    text("CPU", 480, 700, 64, C.cpu, { alpha: seg(lt, d * 0.3, d * 0.45) });
    body("the manager", 480, 770, 40, C.ink, { alpha: seg(lt, d * 0.35, d * 0.5) });
    swarm(t, 2048, 1060, 250, 700, 420, 66);
    text("GPU", 1410, 750, 64, C.gpu, { alpha: seg(lt, d * 0.6, d * 0.72) });
    body("the army", 1410, 820, 40, C.ink, { alpha: seg(lt, d * 0.65, d * 0.8) });
  };

  // ---- ACT 6 · COST ----
  SC.cost = (lt, d, t) => {
    background(t);
    const p1 = seg(lt, d * 0.08, d * 0.2), p2 = seg(lt, d * 0.3, d * 0.42), p3 = seg(lt, d * 0.5, d * 0.62);
    // price tag
    if (p1 > 0) {
      ctx.save(); ctx.translate(360, 330); ctx.rotate(Math.sin(t * 2) * 0.06);
      ctx.globalAlpha = p1; rect(-190, -80, 380, 160, C.gold); rect(-170, -60, 30, 30, C.bg);
      mono("$30,000", 20, 0, 70, C.bg); ctx.restore();
      body("≈ the price of a car", 360, 470, 34, C.muted, { alpha: p1 });
    }
    if (p2 > 0) { gpuDie(960, 330, 240, t, p2); mono("80,000,000,000", 960, 540, 46, C.ink, { alpha: p2 }); text("TRANSISTORS", 960, 590, 28, C.muted, { alpha: p2 }); }
    if (p3 > 0) {
      // EUV: tin droplets fall, a laser hits each one → a flash of extreme-ultraviolet light
      const bx = 1560, by = 330;
      ctx.globalAlpha = p3;
      rect(bx - 200, by - 170, 400, 340, "#0e0c1e");
      const fall = (t * 3) % 1;
      for (let i = 0; i < 4; i++) { const y = by - 150 + ((fall + i * 0.25) % 1) * 300; rect(bx - 6, y, 12, 12, "#c9c9d8"); }
      rect(bx - 200, by - 2, 190, 4, C.hot);
      if (fall > 0.45 && fall < 0.6) { const g = ctx.createRadialGradient(bx, by, 4, bx, by, 150); g.addColorStop(0, "rgba(200,160,255,.9)"); g.addColorStop(1, "rgba(181,140,255,0)"); ctx.fillStyle = g; ctx.fillRect(bx - 160, by - 160, 320, 320); }
      ctx.globalAlpha = 1;
      text("MOLTEN TIN + LASER", bx, by + 210, 28, C.cache, { alpha: p3 });
      mono(typed("50,000× / SECOND", seg(lt, d * 0.75, d * 0.9)), bx, by + 260, 34, C.gold);
    }
    if (lt > d * 0.62) body(typed("printed with extreme-ultraviolet light", seg(lt, d * 0.62, d * 0.78)), W / 2, 820, 44, C.ink);
  };

  // ---- FINALE ----
  const GRAINS = []; seed = 21;
  for (let i = 0; i < 1400; i++) { const x = (rnd() + rnd() + rnd()) / 3, h = 1 - Math.abs(x - 0.5) * 2; GRAINS.push({ x: 40 + x * 160, y: LO_H - 8 - rnd() * h * 50, c: ["#d9b77a", "#c49a5a", "#e8cf98", "#b7894d"][Math.floor(rnd() * 4)] }); }
  function loStars(t) { lx.fillStyle = "#07060f"; lx.fillRect(0, 0, LO_W, LO_H); for (let i = 0; i < 60; i++) { lx.fillStyle = (i * 13 + Math.floor(t * 2)) % 9 === 0 ? "#ecebff" : "#2d2856"; lx.fillRect((i * 97 + ((i * i * 31) % 17)) % LO_W, (i * 53 + ((i * 7) % 11)) % 50, 1, 1); } }
  SC.sand = (lt, d, t) => {
    loStars(t);
    const cx = LO_W / 2, cy = LO_H / 2 + 5;
    const stage = lt < d * 0.22 ? 0 : lt < d * 0.55 ? 1 : 2;
    if (stage === 0) GRAINS.forEach((g, i) => { lx.fillStyle = (i + Math.floor(t * 8)) % 97 === 0 ? "#fff3b0" : g.c; lx.fillRect(Math.round(g.x), Math.round(g.y), 1, 1); });
    else if (stage === 1) {
      const k = easeOut(seg(lt, d * 0.22, d * 0.45)), hh = 70 * k;
      GRAINS.forEach((g, i) => { if (k >= 1) return; const tx = cx - 10 + (i % 20), ty = LO_H - 10 - (i / 20) % 70; lx.fillStyle = g.c; lx.fillRect(Math.round(lerp(g.x, tx, k)), Math.round(lerp(g.y, ty, k)), 1, 1); });
      lx.fillStyle = "rgba(123,134,255,.15)"; lx.fillRect(cx - 16, LO_H - 12 - hh, 32, hh + 4);
      for (let y = 0; y < hh; y++) for (let x = -10; x < 10; x++) { lx.fillStyle = x < -6 ? "#6d74a8" : x < -2 ? "#aab2dc" : x < 3 ? "#dfe4ff" : x < 7 ? "#aab2dc" : "#6d74a8"; lx.fillRect(cx + x, LO_H - 10 - y, 1, 1); }
    } else {
      const R = 44, k = seg(lt, d * 0.55, d * 0.95), beam = -R - 5 + k * (R * 2 + 10);
      for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
        if (x * x + y * y > R * R) continue;
        const inGrid = (x + R) % 8 !== 0 && (y + R) % 8 !== 0;
        let c = !inGrid ? "#8a92c0" : (x + y) % 2 ? "#aab2dc" : "#b8c0e6";
        if (inGrid && x < beam) c = ["#7b86ff", "#ff4d8d", "#3df5c4", "#ffe066"][(Math.floor((x + R) / 8) * 3 + Math.floor((y + R) / 8)) % 4];
        lx.fillStyle = c; lx.fillRect(cx + x, cy + y, 1, 1);
      }
      lx.fillStyle = "rgba(181,140,255,.6)"; lx.fillRect(Math.round(cx + beam), cy - R - 5, 2, R * 2 + 10);
    }
    blitLo();
    const caption = stage === 0 ? "SAND" : stage === 1 ? "99.9999999% PURE SILICON" : "80 BILLION SWITCHES, PRINTED WITH LIGHT";
    text(caption, W / 2, 110, 40, stage === 0 ? C.cpu : stage === 1 ? "#c9ceff" : C.gold, { alpha: 0.9 });
  };

  SC.alive = (lt, d, t) => {
    loStars(t);
    const cy = LO_H / 2, sx = 70, s = 44, pulse = (t * 1.5) % 1;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; for (let r = s / 2 + 4; r < s / 2 + 36; r++) { const on = Math.abs((r - s / 2 - 4) / 32 - pulse) < 0.07; lx.fillStyle = on ? "#3df5c4" : "#1f2a3d"; lx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.9), 1, 1); } }
    lx.fillStyle = "#c9a44a"; for (let i = 0; i < s; i += 3) { lx.fillRect(sx - s / 2 + i, cy - s / 2 - 2, 2, 2); lx.fillRect(sx - s / 2 + i, cy + s / 2, 2, 2); lx.fillRect(sx - s / 2 - 2, cy - s / 2 + i, 2, 2); lx.fillRect(sx + s / 2, cy - s / 2 + i, 2, 2); }
    lx.fillStyle = "#15122b"; lx.fillRect(sx - s / 2, cy - s / 2, s, s);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) { lx.fillStyle = Math.sin(t * 6 - (x + y) * 0.5) > 0.3 ? "#b8fff0" : "#3df5c4"; lx.fillRect(sx - 18 + x * 2, cy - 18 + y * 2, 1, 1); }
    const ox = 124, oy = cy - 28, reveal = easeOut(seg(lt, d * 0.3, d * 0.9)) * NPX;
    lx.fillStyle = "#2d2856"; lx.fillRect(ox - 3, oy - 3, 102, 60);
    for (let i = 0; i < NPX; i++) { const c = i < reveal ? SCENE[i] : [15, 13, 32]; lx.fillStyle = rgb(c); lx.fillRect(ox + (i % SW) * 3, oy + Math.floor(i / SW) * 3, 3, 3); }
    blitLo();
    if (lt > d * 0.55) mono("TRILLIONS OF TIMES A SECOND", W / 2, 1000, 44, C.gpu, { alpha: seg(lt, d * 0.55, d * 0.7) });
  };

  // poem lines, shown softly under the picture
  // The poem used to be drawn under the picture; it now lives only in the caption track
  // (out/captions.srt), so it isn't shown twice. Set SHOW_POEM = true to draw it again.
  const SHOW_POEM = false;
  function poemLine(s, lt) {
    if (!SHOW_POEM || !s || !s.text) return;
    const str = s.text.replace(/<[^>]+>/g, "").replace(/\.\.\./g, "…").replace(/\s+/g, " ").trim();
    const a = seg(lt, 0.2, 0.9);
    const band = ctx.createLinearGradient(0, 900, 0, H); band.addColorStop(0, "rgba(7,6,15,0)"); band.addColorStop(0.45, `rgba(7,6,15,${0.8 * a})`); band.addColorStop(1, `rgba(7,6,15,${0.9 * a})`);
    ctx.fillStyle = band; ctx.fillRect(0, 900, W, H - 900);
    body(str, W / 2, 1000, 38, "#ecebff", { alpha: 0.95 * a });
  }

  // thumbnails of earlier scenes, rendered once and cached
  const THUMBS = {};
  function thumb(id, frac) {
    const key = id + frac;
    if (THUMBS[key]) return THUMBS[key];
    const s = window.TIMELINE.find((x) => x.id === id);
    const off = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const saved = ctx; ctx = off.getContext("2d");
    const d = s.t1 - s.t0, lt = frac * d;
    try { SC[s.scene](lt, d, s.t0 + lt, s); } catch (e) {}
    ctx = saved;
    const small = Object.assign(document.createElement("canvas"), { width: 480, height: 270 });
    small.getContext("2d").drawImage(off, 0, 0, 480, 270);
    return (THUMBS[key] = small);
  }
  const REEL = [["s28", 0.55], ["s24", 0.7], ["s22", 0.7], ["s20", 0.8], ["s16", 0.85], ["s13", 0.9], ["s11", 0.7], ["s08", 0.6], ["s05b", 0.6], ["s03b", 0.5], ["crowd", 0], ["s01", 0.6]];
  SC.reflect = (lt, d, t) => {
    rect(0, 0, W, H, "#050409");
    // a strip of film running backwards through the whole story
    const fw = 520, fh = 292, gap = 40, y = 330;
    const reel = REEL.map(([id, f]) => (id === "crowd" ? ["s04", 0.85] : [id, f]));
    const off = easeInOut(seg(lt, 0, d)) * (reel.length - 2.2) * (fw + gap);
    rect(0, y - 70, W, fh + 140, "#141018");
    for (let x = -((t * 400) % 60); x < W; x += 60) { rect(x + 10, y - 50, 28, 22, "#050409"); rect(x + 10, y + fh + 28, 28, 22, "#050409"); }
    reel.forEach(([id, f], i) => {
      const x = W - fw - 120 - i * (fw + gap) + off;
      if (x > W || x + fw < 0) return;
      const img = thumb(id, f);
      ctx.drawImage(img, x, y, fw, fh);
      rect(x, y, fw, fh, `rgba(232,216,176,${0.06 + 0.18 * seg(lt, 0, d)})`);
    });
    const v = ctx.createRadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1200); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.6)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (Math.floor(t * 1.5) % 2 === 0) text("◀◀", 90, 90, 40, C.muted, { align: "left" });
    const fade = seg(lt, d - 0.8, d);
    if (fade > 0) rect(0, 0, W, H, `rgba(255,180,110,${fade * 0.9})`);
  };

  SC.beach = (lt, d, t, s) => {
    const k = seg(lt, 0, d);
    const macro = seg(lt, d * 0.5, d * 0.7);
    const g = lx;
    // wide shot: sunset over the sea, a sandy beach in front
    const sky = ["#1b1640", "#241a52", "#33206a", "#4a2a7a", "#6a3088", "#94377f", "#c24277", "#ea5f6a", "#ff8a5c", "#ffb35c"];
    for (let y = 0; y < 70; y++) { g.fillStyle = sky[Math.min(9, Math.floor((y / 70) * 10))]; g.fillRect(0, y, LO_W, 1); }
    for (let yy = -16; yy <= 16; yy++) for (let xx = -16; xx <= 16; xx++) if (xx * xx + yy * yy < 240 && 58 + yy < 70) { g.fillStyle = xx * xx + yy * yy < 120 ? "#fff3b0" : "#ffe066"; g.fillRect(168 + xx, 58 + yy, 1, 1); }
    for (let y = 70; y < 88; y++) { g.fillStyle = y % 2 ? "#1a2260" : "#23307a"; g.fillRect(0, y, LO_W, 1); }
    for (let y = 70; y < 88; y++) for (let x = 160; x < 176; x++) if ((x + y * 3 + Math.floor(t * 4)) % 5 === 0) { g.fillStyle = "#ffc46e"; g.fillRect(x - (y - 70) * 0.3, y, 1, 1); }
    for (let x = 0; x < LO_W; x++) {
      const shore = 88 + Math.round(2 * Math.sin(x * 0.05 + t * 0.8));
      g.fillStyle = "#e8e0f0"; g.fillRect(x, shore - 1, 1, 1);
      for (let y = shore; y < LO_H; y++) { const h = (x * 73 + y * 31) % 17; g.fillStyle = h === 0 ? "#fff3d0" : h < 6 ? "#c49a5a" : h < 11 ? "#d9b77a" : "#b7894d"; g.fillRect(x, y, 1, 1); }
    }
    if (macro > 0) {
      // close-up: individual grains, sparkling
      g.globalAlpha = macro;
      g.fillStyle = "#6a4a2a"; g.fillRect(0, 0, LO_W, LO_H);
      seed = 91;
      for (let i = 0; i < 90; i++) {
        const gx = rnd() * LO_W + Math.sin(t * 0.3) * 3, gy = rnd() * LO_H, r = 5 + rnd() * 9, c = ["#d9b77a", "#c49a5a", "#e8cf98", "#b7894d", "#f0dcb0"][i % 5];
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx * 1.2 + yy * yy < r * r) { g.fillStyle = xx < -r / 3 && yy < -r / 3 ? "#fff3d0" : c; g.fillRect(Math.round(gx + xx), Math.round(gy + yy), 1, 1); }
        if ((i + Math.floor(t * 3)) % 13 === 0) { g.fillStyle = "#ffffff"; g.fillRect(Math.round(gx - r / 3), Math.round(gy - r / 3), 2, 2); }
      }
      g.globalAlpha = 1;
    }
    blitLo();
    poemLine(s, lt);
  };

  SC.atoms = (lt, d, t, s) => {
    rect(0, 0, W, H, "#07060f");
    const melt = 1 - easeInOut(seg(lt, d * 0.1, d * 0.55));      // 1 = molten chaos, 0 = perfect lattice
    const sp = lerp(120, 26, easeInOut(seg(lt, d * 0.45, d * 0.95)));
    const cols = Math.ceil(W / sp) + 2, rows = Math.ceil(H / sp) + 2;
    const cx = W / 2, cy = 480;
    const c0 = Math.floor(cols / 2), r0 = Math.floor(rows / 2);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const hsh = Math.abs((c * 73856093) ^ (r * 19349663));
      const jx = (((hsh % 1000) / 1000) - 0.5) * sp * 1.4 * melt + Math.sin(t * 5 + hsh) * sp * 0.2 * melt;
      const jy = ((((hsh >> 10) % 1000) / 1000) - 0.5) * sp * 1.4 * melt + Math.cos(t * 4 + hsh) * sp * 0.2 * melt;
      const x = cx + (c - c0) * sp + jx, y = cy + (r - r0) * sp + jy;
      const center = c === c0 && r === r0;
      const impure = !center && hsh % 9 === 0 && melt > (hsh % 100) / 100;
      const rad = sp * 0.24;
      if (melt < 0.6) { ctx.strokeStyle = `rgba(61,55,114,${0.8 * (1 - melt)})`; ctx.lineWidth = Math.max(1, sp * 0.06); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sp, y); ctx.moveTo(x, y); ctx.lineTo(x, y + sp); ctx.stroke(); }
      const hot = melt;
      ctx.fillStyle = center ? `rgba(255,77,141,${0.8 + 0.2 * Math.sin(t * 6)})` : impure ? "#ff4d8d" : `rgb(${lerp(170, 255, hot) | 0},${lerp(178, 150, hot) | 0},${lerp(220, 70, hot) | 0})`;
      ctx.beginPath(); ctx.arc(x, y, center ? rad * 1.2 : rad, 0, Math.PI * 2); ctx.fill();
    }
    if (lt > d * 0.7) {
      const a = seg(lt, d * 0.7, d * 0.8);
      ctx.strokeStyle = hexA(C.gold, a); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, sp * 0.8, 0, Math.PI * 2); ctx.stroke();
      rect(W / 2 - 380, 830, 760, 100, hexA(C.bg, 0.85 * a));
      mono("1 IN 1,000,000,000", W / 2, 880, 60, C.gold, { alpha: a });
    }
    poemLine(s, lt);
  };

  SC.crystal = (lt, d, t, s) => {
    loStars(t);
    const g = lx, cx = LO_W / 2;
    const grow = easeOut(seg(lt, 0, d * 0.55)), slice = seg(lt, d * 0.55, d * 0.75), turn = easeInOut(seg(lt, d * 0.72, d * 0.98));
    // crucible of molten silicon
    g.fillStyle = "#5a2a1a"; g.fillRect(cx - 34, 112, 68, 16);
    g.fillStyle = `rgb(255,${140 + 30 * Math.sin(t * 3) | 0},60)`; g.fillRect(cx - 30, 110, 60, 4);
    // the ingot being pulled up, turning slowly
    const hh = 90 * grow, top = 110 - hh;
    g.fillStyle = "#3a3a4a"; g.fillRect(cx - 1, 0, 2, Math.max(0, top));
    for (let y = 0; y < hh; y++) {
      const wy = Math.min(14, 3 + y * 0.6);
      for (let x = -wy; x < wy; x++) {
        const u = (x / wy + 1) / 2, band = (u * 6 + t * 0.6) % 1;
        g.fillStyle = u < 0.15 || u > 0.85 ? "#6d74a8" : band < 0.2 ? "#dfe4ff" : u < 0.35 || u > 0.65 ? "#aab2dc" : "#c9d0ee";
        g.fillRect(cx + x, top + y, 1, 1);
      }
    }
    // a thin disc is cut from it and turns to face us
    if (slice > 0) {
      const sy = top + hh * 0.7;
      g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(Math.round(cx - 30 + slice * 60), Math.round(sy), 2, 1);
      if (turn > 0) {
        const R = lerp(14, 40, turn), ry = lerp(1.5, 40, turn), wx = cx + lerp(0, 60, turn), wy2 = lerp(sy, LO_H / 2, turn);
        for (let yy = -ry; yy <= ry; yy++) for (let xx = -R; xx <= R; xx++) if ((xx * xx) / (R * R) + (yy * yy) / (ry * ry) <= 1) {
          const shine = ((xx + yy + t * 20) % 30 + 30) % 30 < 3;
          g.fillStyle = shine ? "#ffffff" : (xx + yy) % 2 ? "#aab2dc" : "#b8c0e6"; g.fillRect(Math.round(wx + xx), Math.round(wy2 + yy), 1, 1);
        }
      }
    }
    blitLo();
    poemLine(s, lt);
  };

  SC.light = (lt, d, t, s) => {
    loStars(t);
    const g = lx, cx = LO_W / 2, cy = LO_H / 2 - 2, R = 44, k = seg(lt, d * 0.05, d * 0.7), beam = -R - 5 + k * (R * 2 + 10);
    for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
      if (x * x + y * y > R * R) continue;
      const inGrid = (x + R) % 8 !== 0 && (y + R) % 8 !== 0;
      let c = !inGrid ? "#8a92c0" : (x + y) % 2 ? "#aab2dc" : "#b8c0e6";
      if (inGrid && x < beam) c = ["#7b86ff", "#ff4d8d", "#3df5c4", "#ffe066"][(Math.floor((x + R) / 8) * 3 + Math.floor((y + R) / 8)) % 4];
      g.fillStyle = c; g.fillRect(cx + x, cy + y, 1, 1);
    }
    if (k < 1) {
      const gl = g.createLinearGradient(0, 0, 0, cy); gl.addColorStop(0, "rgba(181,140,255,0)"); gl.addColorStop(1, "rgba(181,140,255,.55)");
      g.fillStyle = gl; g.fillRect(Math.round(cx + beam) - 1, 0, 4, cy - R);
      g.fillStyle = "rgba(200,170,255,.8)"; g.fillRect(Math.round(cx + beam), cy - R - 5, 2, R * 2 + 10);
    }
    blitLo();
    if (lt > d * 0.62) {
      const a = seg(lt, d * 0.62, d * 0.75);
      mono("80,000,000,000", W / 2, 110, 64, C.gold, { alpha: a, glow: 10 });
      text("SWITCHES ON ONE CHIP", W / 2, 170, 28, C.muted, { alpha: a });
    }
    poemLine(s, lt);
  };

  SC.current = (lt, d, t, s) => {
    SC.alive(lt, d, t);
    // cover the old caption, then count
    rect(0, 940, W, 140, "#07060f");
    const k = seg(lt, d * 0.35, d);
    if (k > 0) mono(fmt(Math.pow(10, 3 + 10 * k) * (1 + ((t * 7) % 1))), W / 2, 110, 60, C.gpu, { glow: 10 });
    poemLine(s, lt);
  };

  // =================== the wordless ending: sand's story ===================
  function tag(str, lt, from = 0.3, y = 1010, color = "#e8d8b0") {
    if (lt < from) return;
    const a = seg(lt, from, from + 0.8);
    ctx.font = "34px Silkscreen";
    rect(56, y - 30, ctx.measureText(str).width + 48, 60, `rgba(7,6,15,${0.6 * a})`);
    text(str, 80, y, 34, color === "#1a1630" ? "#e8d8b0" : color, { align: "left", alpha: a });
  }

  SC.mountain = (lt, d, t) => {
    const g = lx, k = seg(lt, 0, d);
    const flash = Math.abs(k - 0.45) < 0.012 || Math.abs(k - 0.47) < 0.006;
    for (let y = 0; y < LO_H; y++) { const u = y / LO_H; g.fillStyle = flash ? "#c9ceff" : `rgb(${26 + u * 30 | 0},${29 + u * 30 | 0},${46 + u * 40 | 0})`; g.fillRect(0, y, LO_W, 1); }
    for (let x = 0; x < LO_W; x++) { const h = 62 + 12 * Math.sin(x * 0.05) + 6 * Math.sin(x * 0.13 + 1); g.fillStyle = "#34334a"; g.fillRect(x, h, 1, 112 - h); }
    // the granite peak, crumbling
    for (let x = 90; x < LO_W; x++) {
      const top = Math.round(18 + Math.abs(x - 168) * 0.95 + 4 * Math.sin(x * 0.3));
      for (let y = top; y < 112; y++) { const h = (x * 73 + y * 37) % 23; g.fillStyle = h === 0 ? "#9a94ab" : h < 3 ? "#4d475a" : (x + y) % 7 === 0 ? "#7a7489" : "#6b6478"; g.fillRect(x, y, 1, 1); }
    }
    g.fillStyle = "#26252f"; g.fillRect(0, 112, LO_W, 23);
    for (let x = 0; x < LO_W; x++) { const y = 120 + Math.round(2 * Math.sin(x * 0.08)); g.fillStyle = (x + Math.floor(t * 30)) % 9 < 5 ? "#3a5a9a" : "#4a6aaa"; g.fillRect(x, y, 1, 3); }
    // rock fragments break off and tumble into the stream
    for (let i = 0; i < 7; i++) {
      const t0 = d * (0.12 + i * 0.12), u = (lt - t0) / 1.6;
      if (u < 0 || u > 1) continue;
      const sx = 140 + ((i * 29) % 40), sy = 40 + ((i * 17) % 30);
      const x = sx - u * (30 + i * 4), y = sy + u * u * (80 - sy + 40);
      g.fillStyle = "#8a8499"; g.fillRect(Math.round(x), Math.round(Math.min(y, 119)), 3 - (i % 2), 3 - (i % 2));
    }
    // rain
    for (let i = 0; i < 160; i++) {
      const x = ((i * 37 + t * 60 * (1 + (i % 3) * 0.2)) % (LO_W + 20)) - 10, y = ((i * 53 + t * 220) % (LO_H + 10)) - 5;
      g.fillStyle = "rgba(170,190,255,.45)"; g.fillRect(Math.round(x), Math.round(y), 1, 3);
    }
    blitLo();
    tag("300,000,000 YEARS AGO", lt, 0.4);
    tag("RAIN AND ICE CRACK THE GRANITE", lt, d * 0.55, 1010 - 50, C.muted);
  };

  SC.river = (lt, d, t) => {
    const g = lx, k = seg(lt, 0, d);
    for (let y = 0; y < LO_H; y++) { const u = y / 100; g.fillStyle = `rgb(${22 - u * 8 | 0},${48 - u * 14 | 0},${90 - u * 24 | 0})`; g.fillRect(0, y, LO_W, 1); }
    for (let i = 0; i < 6; i++) { g.fillStyle = "rgba(160,200,255,.06)"; const x0 = ((i * 50 + t * 8) % 300) - 60; for (let y = 0; y < 100; y++) g.fillRect(Math.round(x0 + y * 0.5), y, 10, 1); }
    for (let x = 0; x < LO_W; x++) { g.fillStyle = "#6a90d0"; g.fillRect(x, 6 + Math.round(Math.sin(x * 0.1 + t * 2)), 1, 1); }
    const sandH = 6 + 20 * k, bed = LO_H - sandH;
    for (let y = Math.floor(bed); y < LO_H; y++) for (let x = 0; x < LO_W; x++) { const h = (x * 73 + y * 31) % 13; g.fillStyle = h < 3 ? "#e8cf98" : h < 7 ? "#c49a5a" : "#d9b77a"; g.fillRect(x, y, 1, 1); }
    // pebbles rolling downstream, rounding and shrinking into grains
    for (let i = 0; i < 12; i++) {
      const r0 = 7 + (i % 4) * 2, r = Math.max(1.5, r0 * (1 - 0.8 * k));
      const x = ((i * 47 + t * (14 + (i % 3) * 5)) % (LO_W + 40)) - 20, y = bed - r;
      const ang = x / r;
      const grey = [150 - k * 20, 146 - k * 5, 160 - k * 60].map((v) => v | 0);
      for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) { g.fillStyle = `rgb(${grey[0]},${grey[1]},${grey[2]})`; g.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1); }
      g.fillStyle = "#eeeaf8"; g.fillRect(Math.round(x + Math.cos(ang) * r * 0.5), Math.round(y + Math.sin(ang) * r * 0.5), 1, 1);
    }
    for (let i = 0; i < Math.floor(20 + k * 160); i++) {
      const x = ((i * 31 + t * (20 + (i % 5) * 6)) % LO_W), y = bed - 2 - ((i * 17) % 30) * k - Math.sin(t * 3 + i) * 2;
      g.fillStyle = "#e8cf98"; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    blitLo();
    tag("RIVERS GRIND IT INTO GRAINS", lt, 0.3);
    tag("MOSTLY QUARTZ: SILICON + OXYGEN", lt, d * 0.55, 1010 - 50, C.muted);
  };

  function drawDino(g, x, fy, ph) {
    const c1 = "#4f7a3a", c2 = "#8fb56a", c3 = "#34522a";
    const bob = Math.round(Math.abs(Math.sin(ph)) * 1.5), by = fy - 20 - bob;
    const leg = (dx, sw, col) => { const fx = x + dx + Math.sin(ph + sw) * 6, lift = Math.max(0, Math.cos(ph + sw)) * 3; lineLo(g, x + dx, by + 3, fx - 1, fy - 7 - lift, 4, col); lineLo(g, fx - 1, fy - 7 - lift, fx, fy - lift, 3, col); g.fillStyle = col; g.fillRect(Math.round(fx - 1), Math.round(fy - lift - 1), 5, 2); };
    leg(-3, Math.PI, c3);
    for (let i = 0; i < 18; i++) lineLo(g, x - 24 + i, by - 1 + (18 - i) * 0.12, x - 23 + i, by - 1 + (18 - i) * 0.12, Math.max(1, i / 4), c1); // tail
    for (let yy = -6; yy <= 6; yy++) for (let xx = -10; xx <= 10; xx++) if ((xx * xx) / 100 + (yy * yy) / 36 <= 1) { g.fillStyle = yy > 2 ? c2 : c1; g.fillRect(x + xx, by + yy, 1, 1); }
    lineLo(g, x + 7, by - 3, x + 10, by - 11, 5, c1);                                   // neck
    g.fillStyle = c1; g.fillRect(x + 7, by - 17, 13, 7); g.fillRect(x + 11, by - 11, 9, 2); // head, jaw
    g.fillStyle = "#111"; g.fillRect(x + 15, by - 15, 2, 2);
    g.fillStyle = "#f0ead0"; g.fillRect(x + 13, by - 11, 1, 1); g.fillRect(x + 16, by - 11, 1, 1); g.fillRect(x + 19, by - 11, 1, 1);
    g.fillStyle = c3; g.fillRect(x + 8, by + 1, 3, 1); g.fillRect(x + 10, by + 2, 1, 2); // tiny arm
    leg(1, 0, c1);
  }
  SC.dino = (lt, d, t) => {
    const g = lx, k = seg(lt, 0, d);
    const sky = ["#3b2a5a", "#6a3a6a", "#a8506a", "#e0786a", "#ffa36a", "#ffc47a"];
    for (let y = 0; y < 72; y++) { g.fillStyle = sky[Math.min(5, Math.floor((y / 72) * 6))]; g.fillRect(0, y, LO_W, 1); }
    for (let yy = -12; yy <= 12; yy++) for (let xx = -12; xx <= 12; xx++) if (xx * xx + yy * yy < 144 && 64 + yy < 72) { g.fillStyle = "#fff0b0"; g.fillRect(190 + xx, 64 + yy, 1, 1); }
    for (let y = 72; y < 84; y++) { g.fillStyle = y % 2 ? "#2a3a6a" : "#34467a"; g.fillRect(0, y, LO_W, 1); }
    for (let x = 0; x < LO_W; x++) { const top = 84 + Math.round(3 * Math.sin(x * 0.04)); for (let y = top; y < LO_H; y++) { const h = (x * 73 + y * 31) % 17; g.fillStyle = h < 3 ? "#f0d8a0" : h < 8 ? "#c8a060" : "#dcb878"; g.fillRect(x, y, 1, 1); } }
    // cycads on the left
    [[18, 84], [38, 86]].forEach(([px, py], j) => { lineLo(g, px, py, px + 1, py - 20, 3, "#3a2a1a"); for (let a = 0; a < 7; a++) { const an = -Math.PI + a * 0.52 + Math.sin(t + j) * 0.05; lineLo(g, px + 1, py - 20, px + 1 + Math.cos(an) * 14, py - 20 + Math.sin(an) * 7 + 4, 2, "#2a4a22"); } });
    // the dinosaur walks across, leaving footprints
    const dx = lerp(-40, 270, k), ph = dx * 0.26, stride = (2 * Math.PI) / 0.26;
    for (let sx = -40 + stride / 4; sx < dx - 4; sx += stride / 2) { g.fillStyle = "#a8804a"; g.fillRect(Math.round(sx), 118 + (Math.round(sx / (stride / 2)) % 2) * 3, 4, 2); }
    drawDino(g, Math.round(dx), 120, ph);
    blitLo();
    tag("66,000,000 YEARS AGO", lt, 0.4);
  };

  // little creatures and plants for the eras
  function palm(g, x, y, h, t) { lineLo(g, x, y, x + 3, y - h, 2, "#3a2a1a"); for (let a = 0; a < 6; a++) { const an = -Math.PI + a * 0.6 + Math.sin(t * 1.5 + x) * 0.05; lineLo(g, x + 3, y - h, x + 3 + Math.cos(an) * 11, y - h + Math.sin(an) * 5 + 3, 2, "#2f6a2a"); } }
  function acacia(g, x, y) { lineLo(g, x, y, x, y - 14, 2, "#4a3420"); for (let yy = -3; yy <= 2; yy++) for (let xx = -14; xx <= 14; xx++) if ((xx * xx) / 196 + (yy * yy) / 9 <= 1) { g.fillStyle = "#3a5a2a"; g.fillRect(x + xx, y - 16 + yy, 1, 1); } }
  function pine(g, x, y, h) { g.fillStyle = "#3a2a1a"; g.fillRect(x, y - 3, 2, 3); for (let i = 0; i < h; i++) { g.fillStyle = i % 4 === 0 ? "#2a4a30" : "#1f3a26"; const w = Math.round((h - i) * 0.45); g.fillRect(x + 1 - w, y - 3 - i, w * 2, 1); } }
  function horse(g, x, fy, ph) {
    const c = "#8a5a3a", dk = "#5a3a22";
    for (let i = 0; i < 4; i++) { const lx2 = x - 6 + (i % 2) * 2 + Math.floor(i / 2) * 11, sw = Math.sin(ph + i * 1.6) * 2; lineLo(g, lx2, fy - 9, lx2 + sw, fy, 2, i < 2 ? dk : c); }
    g.fillStyle = c; g.fillRect(x - 8, fy - 14, 17, 6);
    lineLo(g, x + 8, fy - 12, x + 11, fy - 19, 3, c); g.fillRect(x + 10, fy - 21, 6, 3); g.fillStyle = "#111"; g.fillRect(x + 13, fy - 21, 1, 1);
    lineLo(g, x - 8, fy - 13, x - 11, fy - 7, 1, dk);
  }
  function mammoth(g, x, fy, ph) {
    const c = "#6a4a2a", dk = "#4a3018";
    for (let i = 0; i < 4; i++) { const lx2 = x - 9 + (i % 2) * 3 + Math.floor(i / 2) * 13, sw = Math.sin(ph + i * 1.6) * 1.5; lineLo(g, lx2, fy - 10, lx2 + sw, fy, 4, i < 2 ? dk : c); }
    for (let yy = -9; yy <= 8; yy++) for (let xx = -14; xx <= 14; xx++) if ((xx * xx) / 196 + (yy * yy) / 81 <= 1) { g.fillStyle = (xx * 3 + yy * 7) % 5 === 0 ? dk : c; g.fillRect(x + xx, fy - 18 + yy, 1, 1); }
    for (let yy = -7; yy <= 7; yy++) for (let xx = -7; xx <= 7; xx++) if (xx * xx + yy * yy <= 49) { g.fillStyle = c; g.fillRect(x + 14 + xx, fy - 25 + yy, 1, 1); }
    lineLo(g, x + 19, fy - 22, x + 22, fy - 4, 3, dk);                                    // trunk
    g.fillStyle = "#f4efe0"; for (let i = 0; i < 8; i++) g.fillRect(x + 15 + i, fy - 14 + Math.round(Math.sin(i * 0.45) * 3), 1, 1); // tusk
    g.fillStyle = "#111"; g.fillRect(x + 16, fy - 27, 1, 1);
  }
  const ERAS = [
    { yrs: 56e6, label: "HOTHOUSE EARTH · JUNGLE ALMOST TO THE POLES" },
    { yrs: 34e6, label: "IT COOLS · GRASSLANDS SPREAD" },
    { yrs: 5e6, label: "DESERTS · SAND ON THE MOVE" },
    { yrs: 2.6e6, label: "THE ICE AGES BEGIN" },
    { yrs: 20000, label: "THE LAST ICE AGE · SEAS 120 M LOWER" },
    { yrs: 10000, label: "THE ICE MELTS · HUMANS SPREAD" },
  ];
  function drawEra(e, g, t, lt) {
    const sand = (x, y) => { const h = (x * 73 + y * 31) % 17; return h < 3 ? "#f0d8a0" : h < 8 ? "#c8a060" : "#dcb878"; };
    const skyGrad = (top, bot) => { for (let y = 0; y < LO_H; y++) { const u = Math.min(1, y / 90); g.fillStyle = `rgb(${lerp(top[0], bot[0], u) | 0},${lerp(top[1], bot[1], u) | 0},${lerp(top[2], bot[2], u) | 0})`; g.fillRect(0, y, LO_W, 1); } };
    const ground = (base, fn) => { for (let x = 0; x < LO_W; x++) { const top = base + Math.round(3 * Math.sin(x * 0.05)); for (let y = top; y < LO_H; y++) { g.fillStyle = fn(x, y); g.fillRect(x, y, 1, 1); } } };
    const walk = (speed, from) => from + lt * speed;
    if (e === 0) {
      skyGrad([240, 150, 100], [255, 200, 140]);
      ground(92, (x, y) => ((x * 7 + y * 13) % 9 < 2 ? "#2a5a26" : "#1f4a1f"));
      [[10, 96, 30], [40, 94, 38], [75, 97, 26], [150, 95, 34], [190, 93, 40], [225, 96, 30]].forEach(([x, y, h]) => palm(g, x, y, h, t));
      for (let i = 0; i < 30; i++) { g.fillStyle = "#3a7a2a"; g.fillRect((i * 37) % LO_W, 100 + ((i * 17) % 30), 3, 1); }
      const cx = walk(20, 60); g.fillStyle = "#6a5a4a"; g.fillRect(Math.round(cx), 117, 6, 3); g.fillRect(Math.round(cx) + 5, 116, 3, 2); g.fillStyle = "#111"; g.fillRect(Math.round(cx) + 7, 116, 1, 1);
    } else if (e === 1) {
      skyGrad([110, 160, 225], [200, 220, 240]);
      ground(90, (x, y) => ((x * 7 + y * 13) % 11 < 3 ? "#b8a050" : (x + y) % 5 === 0 ? "#8a9040" : "#c8b060"));
      for (let i = 0; i < 60; i++) { g.fillStyle = "#9aa040"; const x = (i * 41) % LO_W, y = 94 + ((i * 23) % 38); g.fillRect(x, y - 2 + Math.round(Math.sin(t * 2 + i) * 0.6), 1, 3); }
      acacia(g, 40, 98); acacia(g, 190, 96);
      horse(g, Math.round(walk(14, 90)), 120, lt * 7); horse(g, Math.round(walk(14, 60)), 124, lt * 7 + 1);
    } else if (e === 2) {
      skyGrad([200, 180, 150], [250, 230, 190]);
      for (let x = 0; x < LO_W; x++) { const top = 80 + Math.round(10 * Math.sin((x + lt * 6) * 0.03) + 4 * Math.sin(x * 0.09)); for (let y = top; y < LO_H; y++) { g.fillStyle = sand(x, y); g.fillRect(x, y, 1, 1); } }
      for (let i = 0; i < 40; i++) { const p = (lt * 0.6 + i * 0.13) % 1; g.fillStyle = "rgba(255,240,200,.6)"; g.fillRect(Math.round(((i * 53) % LO_W) + p * 30), 96 + ((i * 7) % 30), 2, 1); } // blowing sand
      const bx = 150 + Math.cos(lt * 1.2) * 30, by = 30 + Math.sin(lt * 1.2) * 8; g.fillStyle = "#3a2a2a"; g.fillRect(Math.round(bx) - 3, Math.round(by), 3, 1); g.fillRect(Math.round(bx) + 1, Math.round(by), 3, 1); g.fillRect(Math.round(bx), Math.round(by) + 1, 1, 1);
    } else if (e === 3) {
      skyGrad([150, 165, 190], [210, 220, 230]);
      ground(88, (x, y) => { const h = (x * 73 + y * 31) % 13; return h < 4 ? "#e8eef4" : h < 9 ? "#8a9088" : "#a0a89a"; });
      [[20, 92, 16], [36, 94, 12], [210, 90, 18]].forEach(([x, y, h]) => pine(g, x, y, h));
      mammoth(g, Math.round(walk(10, 90)), 122, lt * 5);
      for (let i = 0; i < 80; i++) { g.fillStyle = "rgba(255,255,255,.8)"; g.fillRect(Math.round((i * 37 + lt * 10) % LO_W), Math.round((i * 53 + lt * 25) % LO_H), 1, 1); }
    } else if (e === 4) {
      skyGrad([120, 140, 175], [190, 205, 225]);
      ground(92, (x, y) => ((x * 5 + y * 11) % 9 < 2 ? "#ffffff" : "#d8e2ee"));
      for (let x = 0; x < 150; x++) { const top = 40 + (x / 150) * 50 + Math.round(3 * Math.sin(x * 0.4)); for (let y = top; y < 96; y++) { const h = (x * 31 + y * 17) % 19; g.fillStyle = h === 0 ? "#ffffff" : h < 4 ? "#b8d0f0" : "#dce8fa"; g.fillRect(x, y, 1, 1); } }
      for (let y = 96; y < 100; y++) { g.fillStyle = "#3a5a8a"; g.fillRect(170, y, 70, 1); } // the sea, far away now
      mammoth(g, Math.round(walk(8, 150)), 124, lt * 5); mammoth(g, Math.round(walk(8, 120)), 128, lt * 5 + 2);
    } else {
      skyGrad([120, 170, 230], [210, 230, 245]);
      ground(92, (x, y) => ((x * 7 + y * 13) % 9 < 2 ? "#4a8a3a" : "#3a7a30"));
      for (let x = 0; x < LO_W; x++) { g.fillStyle = (x + Math.floor(t * 20)) % 7 < 3 ? "#4a7ac0" : "#3a6ab0"; g.fillRect(x, 106 + Math.round(2 * Math.sin(x * 0.06)), 1, 3); }
      [[12, 94, 22], [30, 96, 18], [52, 93, 24], [200, 95, 20], [222, 94, 24]].forEach(([x, y, h]) => pine(g, x, y, h));
      // a camp: a hut, a fire, two people
      g.fillStyle = "#6a4a2a"; for (let i = 0; i < 14; i++) g.fillRect(130 - i, 110 + i, i * 2 + 1, 1); g.fillStyle = "#2a1a10"; g.fillRect(128, 118, 5, 6);
      const fl = Math.sin(t * 14); g.fillStyle = "#ff8a3a"; g.fillRect(162, 122, 4, 3); g.fillStyle = "#ffe066"; g.fillRect(163, 120 + Math.round(fl), 2, 3);
      for (let i = 0; i < 8; i++) { const p = (lt * 0.5 + i * 0.12) % 1; g.fillStyle = `rgba(200,200,210,${0.5 * (1 - p)})`; g.fillRect(Math.round(163 + Math.sin(p * 6 + i) * 3), Math.round(118 - p * 40), 2, 2); }
      person(g, 150, 116, "#8a5a3a", "#2a1a10"); person(g, 172, 116, "#6a7a3a", "#3a2a1a");
    }
  }
  SC.ages = (lt, d, t) => {
    const n = ERAS.length, span = d / n;
    const i = Math.min(n - 1, Math.floor(lt / span)), local = lt - i * span;
    drawEra(i, lx, t, local);
    blitLo();
    const cross = seg(local, 0, 0.3); // a quick dissolve from the previous era
    if (i > 0 && cross < 1) { drawEra(i - 1, lx, t, span + local); ctx.save(); ctx.globalAlpha = 1 - cross; blitLo(); ctx.restore(); }
    const e = ERAS[i];
    rect(40, 925, 1100, 125, "rgba(7,6,15,.6)");
    mono(`${fmt(e.yrs)} YEARS AGO`, 80, 965, 42, "#e8d8b0", { align: "left" });
    text(e.label, 80, 1020, 28, C.muted, { align: "left" });
  };

  SC.humans = (lt, d, t) => {
    const g = lx, k = seg(lt, 0, d);
    if (k < 0.45) {
      for (let y = 0; y < 70; y++) { g.fillStyle = `rgb(${110 + y},${160 + y * 0.8 | 0},${225})`; g.fillRect(0, y, LO_W, 1); }
      for (let y = 70; y < 86; y++) { g.fillStyle = y % 2 ? "#2a5aa0" : "#3a6ab0"; g.fillRect(0, y, LO_W, 1); }
      for (let x = 0; x < LO_W; x++) for (let y = 86; y < LO_H; y++) { const h = (x * 73 + y * 31) % 17; g.fillStyle = h < 3 ? "#f0dcb0" : h < 8 ? "#d4b078" : "#e2c48e"; g.fillRect(x, y, 1, 1); }
      const u = seg(lt, 0, d * 0.45);
      const px = lerp(-20, 110, Math.min(1, u * 1.6)), kneel = seg(u, 0.62, 0.75);
      g.save(); g.translate(Math.round(px), Math.round(lerp(78, 86, kneel))); g.scale(3, lerp(3, 2.4, kneel)); person(g, 0, 0, "#ff7d6b", "#2a1a10"); g.restore();
      // bucket filling with sand
      g.fillStyle = "#3a8adf"; g.fillRect(140, 104, 14, 14); g.fillStyle = "#2a6abf"; g.fillRect(140, 104, 14, 2);
      const fill = seg(u, 0.75, 1); g.fillStyle = "#e2c48e"; g.fillRect(141, Math.round(117 - fill * 11), 12, Math.round(fill * 11));
    } else {
      g.fillStyle = "#0c0a10"; g.fillRect(0, 0, LO_W, LO_H);
      for (let x = 0; x < LO_W; x += 22) { g.fillStyle = "#1a1620"; g.fillRect(x, 0, 6, 70); }
      const glow = 0.8 + 0.2 * Math.sin(t * 9);
      g.fillStyle = "#3a2a24"; g.fillRect(70, 88, 100, 36);
      g.fillStyle = `rgb(255,${140 * glow | 0},40)`; g.fillRect(76, 86, 88, 6);
      [100, 120, 140].forEach((ex, i) => { g.fillStyle = "#555866"; g.fillRect(ex - 3, 0, 6, 86 - Math.round(4 * Math.sin(t + i))); g.fillStyle = "#ffe0a0"; g.fillRect(ex - 3, 84, 6, 3); });
      for (let i = 0; i < 40; i++) { const p = (t * 1.3 + i * 0.07) % 1; g.fillStyle = p < 0.5 ? "#ffe066" : "#ff8a3a"; g.fillRect(Math.round(80 + ((i * 37) % 80) + Math.sin(i + t) * 6), Math.round(86 - p * 60), 1, 1); }
      const lg = g.createRadialGradient(120, 88, 4, 120, 88, 90); lg.addColorStop(0, "rgba(255,140,40,.35)"); lg.addColorStop(1, "rgba(255,140,40,0)"); g.fillStyle = lg; g.fillRect(0, 0, LO_W, LO_H);
    }
    blitLo();
    if (k < 0.45) tag("TODAY", lt, 0.3); else tag("MELTED IN A FURNACE AT ~2,000 °C", lt, d * 0.5);
  };

  SC.crystal2 = (lt, d, t) => {
    SC.crystal(lt, d, t, null);
    tag("GROWN INTO ONE PERFECT CRYSTAL", lt, 0.3);
    tag("SLICED INTO WAFERS", lt, d * 0.62, 1010 - 50, C.muted);
  };

  SC.burn = (lt, d, t) => {
    const g = lx, k = seg(lt, 0, d);
    g.fillStyle = "#9aa2cc"; g.fillRect(0, 0, LO_W, LO_H);
    const beam = lerp(-20, LO_W + 20, seg(lt, 0, d * 0.75));
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) {
      const x0 = 4 + c * 34, y0 = 4 + r * 27;
      g.fillStyle = "#b8c0e6"; g.fillRect(x0, y0, 31, 24);
      for (let y = 0; y < 24; y += 2) for (let x = 0; x < 31; x++) {
        if (x0 + x > beam) continue;
        const h = ((x0 + x) * 7919 + (y0 + y) * 104729) % 11;
        if (h < 5) { g.fillStyle = h < 2 ? "#ffe066" : h < 4 ? "#3df5c4" : "#7b86ff"; g.fillRect(x0 + x, y0 + y, 1, 1); }
      }
    }
    if (beam < LO_W + 10) {
      const bg = g.createLinearGradient(beam - 10, 0, beam + 4, 0); bg.addColorStop(0, "rgba(181,140,255,0)"); bg.addColorStop(1, "rgba(200,160,255,.85)");
      g.fillStyle = bg; g.fillRect(Math.round(beam - 10), 0, 14, LO_H); g.fillStyle = "#f4ecff"; g.fillRect(Math.round(beam), 0, 2, LO_H);
    }
    // zoom into one die at the end
    const z = easeInOut(seg(lt, d * 0.72, d));
    ctx.imageSmoothingEnabled = false;
    const sw = lerp(LO_W, 34, z), sh = sw * (LO_H / LO_W), sx = lerp(0, 4 + 3 * 34 - 1, z), sy = lerp(0, 4 + 2 * 27 - 3, z);
    ctx.drawImage(lo, sx, sy, sw, sh, 0, 0, W, H);
    tag("PRINTED WITH LIGHT", lt, 0.3, 1010, "#1a1630");
  };

  SC.current2 = (lt, d, t) => {
    const g = lx, k = seg(lt, 0, d);
    g.fillStyle = "#0a0c14"; g.fillRect(0, 0, LO_W, LO_H);
    const step = 12;
    for (let y = 6; y < LO_H; y += step) { g.fillStyle = "#1c3a3a"; g.fillRect(0, y, LO_W, 1); }
    for (let x = 6; x < LO_W; x += step) { g.fillStyle = "#1c3a3a"; g.fillRect(x, 0, 1, LO_H); }
    // switches at the crossings, flipping faster and faster
    for (let y = 6; y < LO_H; y += step) for (let x = 6; x < LO_W; x += step) {
      const on = Math.sin(t * (1.2 + 3 * k) + x * 0.37 + y * 0.61) > 0.2 - k;
      g.fillStyle = on ? "#3df5c4" : "#16302e"; g.fillRect(x - 1, y - 1, 3, 3);
    }
    // electrons racing along the wires
    const n = Math.floor(16 + 110 * k);
    for (let i = 0; i < n; i++) {
      const horiz = i % 2 === 0, lane = 6 + ((i * 7) % Math.floor((horiz ? LO_H : LO_W) / step)) * step;
      const p = ((i * 0.137 + t * (0.05 + (i % 5) * 0.012)) % 1) * (horiz ? LO_W : LO_H);
      g.fillStyle = i % 7 === 0 ? "#ffe066" : "#e8fff8";
      horiz ? g.fillRect(Math.round(p), lane, 2, 1) : g.fillRect(lane, Math.round(p), 1, 2);
    }
    const surge = seg(lt, d * 0.8, d);
    if (surge > 0) { g.fillStyle = `rgba(200,255,240,${surge * 0.5})`; g.fillRect(0, 0, LO_W, LO_H); }
    blitLo();
  };

  // zoom out: chip → circuit board → phone showing the sunset → the screen dies → black mirror
  const world = Object.assign(document.createElement("canvas"), { width: 960, height: 540 });
  const wx = world.getContext("2d");
  SC.phone = (lt, d, t, sg) => {
    const mirror = !sg || sg.mirror !== false;
    const k = seg(lt, 0, d), zoom = easeInOut(seg(lt, 0, d * 0.5));
    const xray = 1 - seg(lt, d * 0.3, d * 0.45), screenOn = seg(lt, d * 0.35, d * 0.48), off = mirror && lt > d * 0.72;
    const g = wx;
    g.fillStyle = "#0b0a0e"; g.fillRect(0, 0, 960, 540);
    for (let x = 0; x < 960; x += 3) { g.fillStyle = `rgba(60,40,30,${0.25 + 0.1 * Math.sin(x * 0.07)})`; g.fillRect(x, 0, 2, 540); } // a dark wooden table
    const px = 300, py = 150, pw = 360, ph = 240; // phone lying in landscape
    g.fillStyle = "#050507"; g.fillRect(px - 12, py - 12, pw + 24, ph + 24);
    g.fillStyle = "#2a2a32"; g.fillRect(px - 12, py - 12, pw + 24, 2); g.fillRect(px - 12, py - 12, 2, ph + 24);
    if (xray > 0) {
      g.globalAlpha = xray;
      g.fillStyle = "#12382a"; g.fillRect(px, py, pw, ph);
      for (let i = 0; i < 40; i++) { g.fillStyle = "#1f5a40"; g.fillRect(px + ((i * 53) % pw), py + ((i * 29) % ph), 30, 1); g.fillRect(px + ((i * 71) % pw), py + ((i * 43) % ph), 1, 20); }
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 3 ? "#3a3a44" : "#c9a44a"; g.fillRect(px + 20 + ((i * 67) % (pw - 40)), py + 20 + ((i * 41) % (ph - 40)), 10 + (i % 3) * 6, 8); }
      // the chip, alive
      const cx = 480, cy = 270;
      g.fillStyle = "#c9a44a"; for (let i = -9; i <= 9; i += 2) { g.fillRect(cx + i, cy - 11, 1, 2); g.fillRect(cx + i, cy + 10, 1, 2); g.fillRect(cx - 11, cy + i, 2, 1); g.fillRect(cx + 10, cy + i, 2, 1); }
      g.fillStyle = "#15122b"; g.fillRect(cx - 9, cy - 9, 18, 18);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = Math.sin(t * 8 - (x + y) * 0.6) > 0.2 ? "#b8fff0" : "#3df5c4"; g.fillRect(cx - 8 + x * 2, cy - 8 + y * 2, 1, 1); }
      g.globalAlpha = 1;
    }
    if (screenOn > 0 && !off) {
      g.globalAlpha = screenOn * (1 - xray * 0.6);
      const cell = 11, ox = px + (pw - SW * cell) / 2, oy = py + (ph - SH * cell) / 2;
      g.fillStyle = "#07060f"; g.fillRect(px, py, pw, ph);
      for (let i = 0; i < NPX; i++) { g.fillStyle = full(i); g.fillRect(ox + (i % SW) * cell, oy + Math.floor(i / SW) * cell, cell, cell); }
      g.fillStyle = "#ecebff"; g.fillRect(px + 10, py + 6, 18, 2); g.fillRect(px + pw - 26, py + 6, 14, 5);
      g.globalAlpha = 1;
    }
    if (off) {
      // black mirror: the dead screen shows only a dim reflection
      g.fillStyle = "#040406"; g.fillRect(px, py, pw, ph);
      const sh = g.createLinearGradient(px, py, px + pw, py + ph); sh.addColorStop(0, "rgba(255,255,255,.06)"); sh.addColorStop(0.35, "rgba(255,255,255,0)"); sh.addColorStop(1, "rgba(255,255,255,.02)");
      g.fillStyle = sh; g.fillRect(px, py, pw, ph);
      g.fillStyle = "rgba(160,160,190,.07)";
      for (let yy = -40; yy <= 40; yy++) for (let xx = -32; xx <= 32; xx++) if ((xx * xx) / 1024 + (yy * yy) / 1600 <= 1) g.fillRect(px + pw / 2 + xx, py + 90 + yy, 1, 1);  // head
      for (let yy = 0; yy < 110; yy++) { const w = Math.min(150, 40 + yy * 2); g.fillRect(px + pw / 2 - w, py + 140 + yy, w * 2, 1); }                  // shoulders
    }
    const sw = lerp(40, 960, zoom), shh = sw * (9 / 16), sx = lerp(480 - 20, 0, zoom), sy = lerp(270 - 11.25, 0, zoom);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(world, sx, sy, sw, shh, 0, 0, W, H);
    const fade = mirror ? seg(lt, d * 0.84, d) : seg(lt, d * 0.78, d);
    if (fade > 0) rect(0, 0, W, H, `rgba(0,0,0,${fade})`);
  };

  SC.shorttitle = (lt, d, t) => {
    rect(0, 0, W, H, "#000");
    const a = seg(lt, 0.3, 1.1) * (1 - seg(lt, d - 0.7, d));
    text("WHERE DOES A CHIP", W / 2, H / 2 - 50, 84, C.ink, { alpha: a });
    text("COME FROM?", W / 2, H / 2 + 60, 84, C.gold, { alpha: seg(lt, 0.8, 1.6) * (1 - seg(lt, d - 0.7, d)) });
  };

  SC.endcard = (lt, d, t) => {
    rect(0, 0, W, H, "#000");
    const a = seg(lt, 1.0, 2.0) * (1 - seg(lt, d - 0.8, d));
    text("TRICKED", W / 2 - 170, H / 2 - 60, 96, C.ink, { alpha: a });
    text("ROCKS", W / 2 + 250, H / 2 - 60, 96, C.gpu, { alpha: a });
    text("EP 01 · THE PARALLEL MACHINE", W / 2, H / 2 + 30, 34, C.muted, { alpha: a });
    mono("build your own chip → loathwine.github.io/tricked-rocks", W / 2, H / 2 + 120, 30, C.gold, { alpha: a * seg(lt, 1.6, 2.4) });
  };

  // ---------------- thumbnails (rendered as stills, not part of the video) ----------------
  function thumbBase(t) {
    rect(0, 0, W, H, "#07060f");
    const gl = ctx.createRadialGradient(470, 560, 40, 470, 560, 620); gl.addColorStop(0, "rgba(255,171,64,.35)"); gl.addColorStop(1, "rgba(255,171,64,0)");
    ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    const gr = ctx.createRadialGradient(1420, 560, 40, 1420, 560, 760); gr.addColorStop(0, "rgba(61,245,196,.25)"); gr.addColorStop(1, "rgba(61,245,196,0)");
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
  // a crisp swarm for stills: mostly mint, a few units sparkling
  function stillSwarm(n, x0, y0, w, h) {
    const cols = Math.ceil(Math.sqrt((n * w) / h)), rows = Math.ceil(n / cols), cell = Math.min(w / cols, h / rows), dd = Math.max(2, Math.floor(cell * 0.78));
    for (let i = 0; i < n; i++) { const hh = (i * 2654435761) % 97; ctx.fillStyle = hh < 6 ? "#e8fff8" : hh < 30 ? "#6ff8d4" : C.gpu; ctx.fillRect(Math.round(x0 + (i % cols) * cell), Math.round(y0 + Math.floor(i / cols) * cell), dd, dd); }
  }
  function versus(t, top) {
    cpuCore(t, 470, 600 + top, 21, 1, 1.1);
    stillSwarm(1024, 1090, 350 + top, 760, 520);
    text("1 GENIUS", 470, 250 + top, 110, C.cpu, { glow: 30 });
    text("16,384 IDIOTS", 1420, 250 + top, 110, C.gpu, { glow: 30 });
    text("VS", 935, 600 + top, 150, C.ink, { glow: 20 });
  }
  SC.thumbA = (lt, d, t) => { thumbBase(t); versus(0.93, 60); };
  SC.thumbB = (lt, d, t) => {
    thumbBase(t); versus(0.93, 150);
    text("WHO WINS?", W / 2, 150, 150, C.gold, { glow: 30 });
  };
  SC.thumbC = (lt, d, t) => {
    rect(0, 0, W, H, "#07060f");
    stillSwarm(16384, 0, 0, W, H);
    rect(0, 250, W, 580, "rgba(7,6,15,.86)");
    text("HOW DOES THE", W / 2, 390, 120, C.ink, { glow: 10 });
    text("DUMBER CHIP WIN?", W / 2, 560, 150, C.gold, { glow: 30 });
    cpuCore(0.93, 200, 700, 7, 1, 0.8);
    text("1 CPU CORE vs 16,384 GPU CORES", W / 2 + 60, 720, 48, C.muted);
  };

  // quieter thumbnails: show the idea, not a gag
  SC.thumbD = () => {
    rect(0, 0, W, H, "#07060f");
    const cell = 46, x0 = (W - SW * cell) / 2, y0 = 70;
    const front = 8.3; // the row currently being computed, many pixels at once
    screen(x0, y0, cell, (i) => {
      const r = Math.floor(i / SW), c = i % SW, fr = front + Math.sin(c * 0.5) * 0.4;
      if (r < fr - 0.5) return full(i);
      if (r < fr + 1) return (c + r) % 3 === 0 ? "#e8fff8" : C.gpu;
      return null;
    });
    text("HOW A GRAPHICS CARD WORKS", W / 2, 1000, 60, C.ink);
  };
  SC.thumbE = () => {
    rect(0, 0, W, H, "#07060f");
    const g = ctx.createRadialGradient(560, 540, 50, 560, 540, 700); g.addColorStop(0, "rgba(61,245,196,.18)"); g.addColorStop(1, "rgba(61,245,196,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    die(130, 160, 94, GPU_PARTS.map((p) => ({ ...p, lit: p.type === "alu" && p.x === 5, label: p.type === "ctrl" ? "STEP 4" : undefined })));
    text("ONE INSTRUCTION", 1390, 450, 62, C.ink, { glow: 8 });
    text("THOUSANDS OF PIXELS", 1390, 550, 62, C.gpu, { glow: 14 });
    body("how a graphics card works", 1390, 650, 42, C.muted);
  };
  SC.thumbF = () => {
    rect(0, 0, W, H, "#07060f");
    matmul(110, 90, 22, MSCH_GPU, MSCH_GPU.total * 0.37, C.gpu);
    text("WHY AI RUNS", 1540, 480, 70, C.ink);
    text("ON GPUs", 1540, 580, 70, C.gold, { glow: 12 });
  };

  SC.tricked = (lt, d, t) => {
    background(t, 0.7);
    const k = easeOut(seg(lt, 0.1, 0.9));
    ctx.save();
    const g = ctx.createLinearGradient(W / 2 - 700, 0, W / 2 + 700, 0);
    g.addColorStop(0, C.cpu); g.addColorStop(0.4, C.hot); g.addColorStop(0.7, C.sky); g.addColorStop(1, C.gpu);
    ctx.globalAlpha = k; ctx.fillStyle = g; ctx.font = "150px Silkscreen"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("WE TRICKED ROCKS", W / 2, H / 2 - 90);
    ctx.globalAlpha = seg(lt, 0.9, 1.6); ctx.fillText("INTO THINKING.", W / 2, H / 2 + 90);
    ctx.restore();
  };

  SC.cta = (lt, d, t) => {
    background(t);
    die(170, 230, 60, GPU_PARTS.map((p) => ({ ...p, lit: p.type === "alu" && Math.sin(t * 6 - p.x * 0.5 - p.y * 0.3) > 0.6 })));
    text("BUILD YOUR OWN CHIP", 1180, 300, 56, C.ink, { alpha: seg(lt, 0.2, 0.8) });
    text("RACE A CPU", 1180, 380, 56, C.gpu, { alpha: seg(lt, 0.5, 1.1) });
    mono("loathwine.github.io/tricked-rocks", 1180, 480, 36, C.gold, { alpha: seg(lt, 0.8, 1.4) });
    body("interactive lesson · link below", 1180, 535, 30, C.muted, { alpha: seg(lt, 0.8, 1.4) });
    if (lt > d * 0.55) {
      const a = seg(lt, d * 0.55, d * 0.65);
      text("NEXT · EP 02", 1180, 700, 30, C.muted, { alpha: a });
      text("THE SWITCH", 1180, 770, 70, C.cpu, { alpha: a });
      const on = Math.floor(t * 1.2) % 2 === 0;
      ctx.globalAlpha = a; rect(1060, 840, 240, 90, "#2d2856"); rect(on ? 1190 : 1070, 850, 100, 70, on ? C.gpu : C.dim); ctx.globalAlpha = 1;
    }
    const out = seg(lt, d - 1.0, d);
    if (out > 0) rect(0, 0, W, H, `rgba(0,0,0,${out})`);
  };

  // ------------------------------------------------------------------ frame
  const ACT_STARTS = new Set(["s09", "s14", "s18", "s23", "s26", "s28", "r1", "p6", "g1", "g2", "g3", "g5", "g6", "g7", "g8", "g9"]);
  window.renderFrame = function (t) {
    const TL = window.TIMELINE;
    let s = TL[TL.length - 1];
    for (const x of TL) if (t >= x.t0 && t < x.t1) { s = x; break; }
    const lt = t - s.t0, d = s.t1 - s.t0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    try { (SC[s.scene] || ((a, b, c) => background(c)))(lt, d, t, s); }
    catch (e) { console.error(`scene ${s.id} @ ${t.toFixed(2)}s: ${e.message}`); window.__sceneErrors = (window.__sceneErrors || 0) + 1; }
    // dip to black at act changes, and fade in at the very start
    const dip = ACT_STARTS.has(s.id) ? 1 - seg(lt, 0, 0.35) : 0;
    const start = 1 - seg(t, 0, 0.5);
    const a = Math.max(dip, start);
    if (a > 0) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
  };
  window.sceneReady = Promise.all(["40px Silkscreen", "30px 'JetBrains Mono'", "500 30px 'Space Grotesk'"].map((f) => document.fonts.load(f))).then(() => true);
})();
