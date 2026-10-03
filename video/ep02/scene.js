/* EP 02 · THE SWITCH — full video, drawn deterministically.
   window.TIMELINE = [{ id, scene, t0, t1, speech }]  (seconds; built by build.py from the narration clips)
   window.renderFrame(t) draws the frame at time t.
   This file is the engine and shared drawing kit; scenes live in scenes-*.js and register on TR.SC. */
(function () {
  "use strict";
  const cv = document.getElementById("c"), ctx = cv.getContext("2d");
  const W = 1920, H = 1080;
  const LO_W = 240, LO_H = 135;
  const lo = document.createElement("canvas"); lo.width = LO_W; lo.height = LO_H;
  const lx = lo.getContext("2d");

  const C = { bg: "#07060f", panel: "#17142e", ink: "#ecebff", muted: "#9a95c4", dim: "#5f5a8f", cpu: "#ffab40", cpuDeep: "#b8620f",
    gpu: "#3df5c4", gpuDeep: "#11917b", gold: "#ffe066", hot: "#ff4d8d", sky: "#7b86ff", line: "#2d2856", bad: "#ff5a5a",
    cache: "#b58cff", wire: "#5f5a8f", live: "#c9a44a", e: "#7bdcff", stage: "#0e0c1e", copper: "#c87533" };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const lerp = (a, b, k) => a + (b - a) * k;
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const hexA = (h, a) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;
  // deterministic noise: the same i always gives the same number in [0, 1)
  const hash = (i) => { let x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function text(str, x, y, size, color, o = {}) {
    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
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
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const circle = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const ring = (x, y, r, c, w = 3) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); };
  function poly(pts, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = "miter"; ctx.lineCap = "square";
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  }
  function glow(x, y, r, color, a) {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, r * 0.05, x, y, r);
    g.addColorStop(0, hexA(color, a)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }

  const STARS = Array.from({ length: 150 }, (_, i) => ({ x: hash(i) * W, y: hash(i + 500) * H, s: hash(i + 900) < 0.2 ? 4 : 2, p: hash(i + 1300) * 6 }));
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
  function panel(x, y, w, h, border = C.line, fill = C.stage) {
    rect(x, y, w, h, fill);
    ctx.strokeStyle = border; ctx.lineWidth = 4; ctx.strokeRect(x, y, w, h);
  }
  // a caption chip in the lower left (or anywhere)
  function tag(str, lt, from = 0.3, y = 1010, color = "#e8d8b0", x = 80) {
    if (lt < from) return;
    const a = seg(lt, from, from + 0.6);
    ctx.font = "34px Silkscreen";
    rect(x - 24, y - 30, ctx.measureText(str).width + 48, 60, `rgba(7,6,15,${0.75 * a})`);
    text(str, x, y, 34, color, { align: "left", alpha: a });
  }
  // a title line that fades in at `from` (seconds into the scene)
  const title = (str, lt, from, y, size, color, o = {}) => text(str, o.x ?? W / 2, y, size, color, { alpha: seg(lt, from, from + 0.6) * (o.alpha ?? 1), ...o });
  // the lesson's notation: electrons are cyan dots marked −, holes are pink rings marked +
  function electron(x, y, r = 9, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    circle(x, y, r, C.e);
    ctx.fillStyle = C.stage; ctx.fillRect(x - r * 0.55, y - r * 0.09, r * 1.1, r * 0.18);
    ctx.restore();
  }
  function hole(x, y, r = 10, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    ring(x, y, r, C.hot, Math.max(2, r * 0.22));
    ctx.fillStyle = C.hot; ctx.fillRect(x - r * 0.55, y - r * 0.09, r * 1.1, r * 0.18); ctx.fillRect(x - r * 0.09, y - r * 0.55, r * 0.18, r * 1.1);
    ctx.restore();
  }
  // a battery standing upright: + cap on top. x,y = centre
  function battery(x, y, w = 70, h = 120, label) {
    rect(x - w * 0.16, y - h / 2 - 12, w * 0.32, 12, C.live);
    rect(x - w / 2, y - h / 2, w, h, "#2a2450");
    ctx.strokeStyle = C.cache; ctx.lineWidth = 4; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
    rect(x - w / 2, y - h / 2, w, h * 0.22, C.cache);
    mono("+", x, y - h / 2 + h * 0.11, h * 0.2, C.stage);
    mono("−", x, y + h / 2 - h * 0.14, h * 0.22, "#c9ceff");
    if (label) text(label, x, y + h / 2 + 34, 26, C.muted);
  }
  // a bulb: glass circle, base below. b = brightness 0..1
  function bulb(x, y, r, b, label) {
    if (b > 0.01) glow(x, y, r * 4, C.gold, 0.7 * b);
    circle(x, y, r, b > 0.01 ? `rgb(255,${190 + 34 * b | 0},${70 + 40 * b | 0})` : "#1f1b3d");
    ring(x, y, r, "#9a95c4", 4);
    rect(x - r * 0.45, y + r * 0.85, r * 0.9, r * 0.6, "#8a92c0");
    if (label) text(label, x, y + r * 2.1, 26, C.muted);
  }
  // a knife switch from (x1,y) to (x2,y). closed 0..1
  function knife(x1, x2, y, closed, color = C.cpu) {
    const len = x2 - x1, a = lerp(-0.6, 0, closed);
    ctx.strokeStyle = color; ctx.lineWidth = 12; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x1 + len * Math.cos(a), y + len * Math.sin(a)); ctx.stroke(); ctx.lineCap = "butt";
    circle(x1, y, 11, color); circle(x2, y, 9, C.wire);
  }
  // electrons drifting along a polyline. dir = +1 runs from the first point to the last
  function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function pathAt(pts, u) {
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], l = Math.hypot(x2 - x1, y2 - y1);
      if (u <= l) return [lerp(x1, x2, u / l), lerp(y1, y2, u / l)];
      u -= l;
    }
    return pts[pts.length - 1];
  }
  function flowDots(pts, t, speed = 120, gap = 46, r = 8, alpha = 1) {
    const L = pathLen(pts), off = ((t * speed) % gap + gap) % gap;
    for (let u = off; u < L; u += gap) { const [x, y] = pathAt(pts, u); electron(x, y, r, alpha); }
  }
  const wireCol = (live) => (live ? C.live : C.wire);
  function blitLo() { ctx.imageSmoothingEnabled = false; ctx.drawImage(lo, 0, 0, W, H); }
  const fadeOut = (lt, d, len = 0.8) => { const k = seg(lt, d - len, d); if (k > 0) rect(0, 0, W, H, `rgba(0,0,0,${k})`); };

  const SC = {};
  window.TR = { ctx, W, H, lo, lx, LO_W, LO_H, C, clamp, seg, easeOut, easeInOut, lerp, fmt, hexA, hash, text, body, mono, typed, rect, circle, ring,
    poly, glow, background, panel, tag, title, electron, hole, battery, bulb, knife, pathLen, pathAt, flowDots, wireCol, blitLo, fadeOut, SC };

  // ------------------------------------------------------------------ frame
  const ACT_STARTS = new Set(["e1", "d1", "r1", "t1", "s1", "x1", "w1", "f1"]);
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
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    const dip = ACT_STARTS.has(s.id) ? 1 - seg(lt, 0, 0.35) : 0;
    const start = 1 - seg(t, 0, 0.5);
    const a = Math.max(dip, start);
    if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fillRect(0, 0, W, H); }
  };
  window.sceneReady = Promise.all(["40px Silkscreen", "30px 'JetBrains Mono'", "500 30px 'Space Grotesk'"].map((f) => document.fonts.load(f))).then(() => true);
})();
