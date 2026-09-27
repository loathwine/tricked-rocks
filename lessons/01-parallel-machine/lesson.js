/* EP 01 · THE PARALLEL MACHINE — lesson logic */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const { SCENE, MATRIX, SCENE_W: W, SCENE_H: H } = window.PX;
  const P = W * H; // 576 pixels

  // ---------- persistent progress (per-viewer convenience only) ----------
  const KEY = "tr-ep01";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { saved = {}; }
  const save = (patch) => {
    Object.assign(saved, patch);
    try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {}
  };

  // ======================================================================
  //  ACT CONTROLLER
  // ======================================================================
  const acts = $$(".act");
  const onEnter = {};
  const onLeave = {};
  const inits = {};
  const started = new Set();
  let current = -1;
  let maxReached = clamp(saved.maxAct || 0, 0, acts.length - 1);

  const pipsEl = $("#pips");
  acts.forEach((a, i) => {
    const b = document.createElement("button");
    b.className = "pip";
    b.title = a.dataset.title;
    b.setAttribute("aria-label", `Act ${i}: ${a.dataset.title}`);
    b.addEventListener("click", () => { if (i <= maxReached) go(i); });
    pipsEl.appendChild(b);
  });

  function go(n) {
    n = clamp(n, 0, acts.length - 1);
    if (n === current) return;
    if (current >= 0 && onLeave[current]) onLeave[current]();
    acts.forEach((a, i) => a.classList.toggle("active", i === n));
    current = n;
    maxReached = Math.max(maxReached, n);
    save({ maxAct: maxReached });
    $$(".pip").forEach((p, i) => {
      p.classList.toggle("current", i === n);
      p.classList.toggle("done", i <= maxReached && i !== n);
    });
    $("#act-label").textContent = `${n} / ${acts.length - 1} · ${acts[n].dataset.title.toUpperCase()}`;
    $("#prev-act").disabled = n === 0;
    $("#skip-act").style.visibility = n === acts.length - 1 ? "hidden" : "visible";
    $("#skip-act").textContent = n < maxReached ? "NEXT ▶" : "SKIP ▶";
    $("#act-nav").style.display = n === 0 ? "none" : "";
    window.scrollTo({ top: 0 });
    if (!started.has(n)) { started.add(n); inits[n] && inits[n](); }
    onEnter[n] && onEnter[n]();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-next]");
    if (b) { SFX.click(); go(current + 1); }
  });
  $("#prev-act").addEventListener("click", () => { SFX.click(); go(current - 1); });
  $("#skip-act").addEventListener("click", () => { SFX.click(); go(current + 1); });

  const soundBtn = $("#sound-toggle");
  const syncSound = () => {
    soundBtn.textContent = SFX.muted ? "♪ OFF" : "♪ ON";
    soundBtn.setAttribute("aria-pressed", String(!SFX.muted));
  };
  soundBtn.addEventListener("click", () => { SFX.setMuted(!SFX.muted); syncSound(); SFX.click(); });
  syncSound();
  document.addEventListener("pointerdown", () => SFX.unlock(), { once: true });

  // rAF helper bound to an act: stops automatically when the act is left
  function actLoop(actIndex, fn) {
    let last = performance.now();
    let alive = true;
    function frame(now) {
      if (!alive || current !== actIndex) return;
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      if (fn(dt, now) === false) return;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    return () => { alive = false; };
  }

  // ======================================================================
  //  PIXEL SCREEN HELPERS
  // ======================================================================
  function makeScreen(canvas) {
    const ctx = canvas.getContext("2d");
    const img = ctx.createImageData(canvas.width, canvas.height);
    const d = img.data;
    return {
      set(i, c) { const o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; },
      flush() { ctx.putImageData(img, 0, 0); },
    };
  }
  const BG = [[15, 13, 32], [19, 17, 40]];
  const bgAt = (i) => BG[((i % W) + Math.floor(i / W)) % 2];
  const CPU_C = [[255, 171, 64]];
  const GPU_C = [[61, 245, 196]];

  // ======================================================================
  //  SCHEDULER — hand out pixels to units as they become free
  //  unit: { lanes, stepTicks }   → every pixel takes S steps
  // ======================================================================
  function schedule(units, total, S) {
    const start = new Float64Array(total), end = new Float64Array(total);
    const unitOf = new Int16Array(total), stepT = new Float64Array(total);
    const free = units.map(() => 0);
    const batches = units.map(() => []);
    let next = 0;
    if (!units.length) return { start, end, unitOf, stepT, batches, total: Infinity };
    while (next < total) {
      let u = 0;
      for (let k = 1; k < units.length; k++) if (free[k] < free[u]) u = k;
      const n = Math.min(units[u].lanes, total - next);
      const t0 = free[u], t1 = t0 + S * units[u].stepTicks;
      for (let l = 0; l < n; l++, next++) {
        start[next] = t0; end[next] = t1; unitOf[next] = u; stepT[next] = units[u].stepTicks;
      }
      batches[u].push({ t0, t1, n });
      free[u] = t1;
    }
    let max = 0;
    for (let i = 0; i < total; i++) if (end[i] > max) max = end[i];
    return { start, end, unitOf, stepT, batches, total: max };
  }

  // in-progress pixels hold one steady worker color (no blinking), then snap to their result
  function drawSched(scr, sch, image, t, colors) {
    for (let i = 0; i < P; i++) {
      if (t >= sch.end[i]) scr.set(i, image[i]);
      else if (t >= sch.start[i]) scr.set(i, colors[0]);
      else scr.set(i, bgAt(i));
    }
    scr.flush();
  }

  /**
   * Race two schedules on the same clock. The "you" side always takes ~2.6s,
   * the reference runs at the same tick rate, so the gap is felt.
   */
  function race({ actIndex, image, ref, you, onFrame, onYouDone, onRefDone }) {
    const refScr = makeScreen(ref.canvas), youScr = makeScreen(you.canvas);
    const rate = you.sched.total / 3.2;
    let t = 0, mult = 1, youDone = false, refDone = false, lastWave = -1;
    const stop = actLoop(actIndex, (dt) => {
      t += dt * rate * mult;
      const ty = Math.min(t, you.sched.total), tr = Math.min(t, ref.sched.total);
      drawSched(refScr, ref.sched, image, tr, CPU_C);
      drawSched(youScr, you.sched, image, ty, you.colors || GPU_C);
      ref.bar.style.width = (100 * tr) / ref.sched.total + "%";
      you.bar.style.width = (100 * ty) / you.sched.total + "%";
      ref.label.textContent = fmt(tr);
      you.label.textContent = fmt(ty);
      const wave = Math.floor(ty / (you.waveTicks || 16));
      if (!youDone && wave !== lastWave) { lastWave = wave; SFX.tick(); }
      if (!youDone && onFrame) onFrame(ty);
      if (!youDone && t >= you.sched.total) { youDone = true; onYouDone && onYouDone(); }
      if (!refDone && t >= ref.sched.total) { refDone = true; onRefDone && onRefDone(); }
      return !(youDone && refDone);
    });
    return { fastForward() { mult *= 30; }, stop };
  }

  const speedup = (a, b) => { const r = a / b; return r < 10 ? r.toFixed(1).replace(/\.0$/, "") : fmt(r); };

  // ======================================================================
  //  YOUR DISPLAY — real pixel count and a measured refresh rate
  // ======================================================================
  const OPS_PX = 1000; // "hundreds to thousands" of steps per pixel in a modern game
  const dpr = window.devicePixelRatio || 1;
  const DISPLAY = { w: Math.round(screen.width * dpr), h: Math.round(screen.height * dpr), hz: 60 };
  DISPLAY.px = DISPLAY.w * DISPLAY.h;
  const words = (n) => n >= 1e12 ? `${+(n / 1e12).toPrecision(2)} trillion` : n >= 1e9 ? `${+(n / 1e9).toPrecision(2)} billion` : `${+(n / 1e6).toPrecision(2)} million`;
  const fpsText = (f) => f < 1 ? f.toFixed(2) : f < 10 ? f.toFixed(1) : fmt(f);
  const cpuFps = (ghz) => (ghz * 1e9) / (DISPLAY.px * OPS_PX);
  function applyDisplay() {
    const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
    set("#hook-px", fmt(DISPLAY.px));
    set("#hook-hz", DISPLAY.hz);
    set("#pb-px", fmt(DISPLAY.px));
    set("#pb-res", `pixels (${DISPLAY.w}×${DISPLAY.h})`);
    set("#pb-steps", words(DISPLAY.px * OPS_PX));
    set("#pb-fps", `${fpsText(cpuFps(4))} frame${cpuFps(4) === 1 ? "" : "s"} per second`);
    set("#pb-hz", DISPLAY.hz);
    set("#z-px", words(DISPLAY.px).replace(/^([\d.]+) million$/, "$1 million"));
    set("#z-hz", DISPLAY.hz);
  }
  // Measure the refresh rate from frame timing (there is no web API for it).
  // Heavy animation can make the browser drop frames, so measure for ~0.7 s while the
  // page is still, and hold the hook animation until then. Use a low percentile:
  // frames can arrive late, but never faster than the display refreshes.
  const COMMON_HZ = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240, 360];
  const snapHz = (raw) => COMMON_HZ.reduce((b, c) => (Math.abs(c - raw) < Math.abs(b - raw) ? c : b));
  function measureFps(ms) {
    return new Promise((resolve) => {
      const gaps = [];
      let last = null, t0 = null;
      function f(t) {
        if (t0 === null) t0 = t;
        if (last !== null) gaps.push(t - last);
        last = t;
        if (t - t0 < ms || gaps.length < 10) return requestAnimationFrame(f);
        const g = gaps.slice().sort((x, y) => x - y);
        resolve({ raw: 1000 / g[Math.floor(g.length * 0.2)], avg: (1000 * gaps.length) / (t - t0), frames: gaps.length });
      }
      requestAnimationFrame(f);
    });
  }
  const hzReady = measureFps(700).then((m) => {
    // headless or throttled tabs can under-report; real displays are at least 60 Hz
    DISPLAY.hz = Math.max(60, snapHz(m.raw));
    console.info(`[tricked-rocks] measured refresh: ${m.raw.toFixed(1)} fps (${m.frames} frames, still page) → showing ${DISPLAY.hz} Hz`);
  });
  applyDisplay();
  hzReady.then(applyDisplay);

  // ======================================================================
  //  ACT 0 · HOOK
  // ======================================================================
  inits[0] = () => {
    const lines = $$("#hook-lines .hl");
    const cta = $("#hook-cta");
    const counter = $("#hook-counter");
    const timers = [];
    let skipped = false;
    const target = () => DISPLAY.px * DISPLAY.hz * OPS_PX;
    const showAll = () => {
      skipped = true;
      timers.forEach(clearTimeout);
      lines.forEach((l) => l.classList.add("show"));
      counter.textContent = fmt(target());
      cta.classList.add("show");
    };
    const at = [300, 1700, 3100, 4500, 7000];
    lines.forEach((l, i) => timers.push(setTimeout(() => {
      l.classList.add("show");
      SFX.reveal();
      if (i === 3) countUp();
    }, at[i])));
    timers.push(setTimeout(() => cta.classList.add("show"), 8200));
    function countUp() {
      const t0 = performance.now();
      (function f(now) {
        if (skipped) return;
        const k = clamp((now - t0) / 1800, 0, 1);
        counter.textContent = fmt(target() * ease(k));
        if (k < 1) requestAnimationFrame(f);
      })(t0);
    }
    $('.act[data-act="0"]').addEventListener("click", (e) => { if (!e.target.closest("button")) showAll(); });
  };

  onEnter[0] = () => {
    // a wave of "computation" sweeps the screen, over and over
    const cv = $("#hook-canvas");
    const ctx = cv.getContext("2d");
    const HW = cv.width, HH = cv.height;
    const img = ctx.createImageData(HW, HH);
    let phase = 0, measured = false;
    hzReady.then(() => { measured = true; });
    actLoop(0, (dt) => {
      if (!measured) return;
      phase += dt * 0.35;
      const front = (phase % 1.25) * (HW + HH) * 1.1 - 10;
      for (let y = 0; y < HH; y++)
        for (let x = 0; x < HW; x++) {
          const base = SCENE[Math.floor(y / 3) * W + Math.floor(x / 3)];
          const d = front - (x + y * 0.8);
          const o = (y * HW + x) * 4;
          let r, g, b;
          if (d < 0) { r = base[0] * 0.18; g = base[1] * 0.18; b = base[2] * 0.22; }
          else if (d < 5) {
            const k = d / 5;
            r = 61 + (base[0] - 61) * k; g = 245 + (base[1] - 245) * k; b = 196 + (base[2] - 196) * k;
            if ((x * 3 + y * 7 + Math.floor(phase * 30)) % 5 === 0) { r = g = b = 255; }
          } else { const f = Math.max(0.5, 1 - (d - 5) / 220); r = base[0] * f; g = base[1] * f; b = base[2] * f; }
          img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
        }
      ctx.putImageData(img, 0, 0);
    });
  };

  // ======================================================================
  //  ACT 1 · ONE BRILLIANT WORKER — plus a step-by-step pixel debugger
  // ======================================================================
  const STEPS = PX.STEPS;
  const S1 = STEPS.length;
  const TRACE = Array.from({ length: P }, (_, i) => PX.trace(i % W, Math.floor(i / W)));
  const EXAMPLE = 0; // start debugging at the top-left pixel, like the CPU does

  // floating tooltip with the code of a helper function
  const tip = document.createElement("pre");
  tip.className = "code-tip";
  tip.hidden = true;
  document.body.appendChild(tip);
  function showTip(el) {
    tip.textContent = PX.FN_CODE[el.dataset.fn] || "";
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    tip.style.left = clamp(r.left, 8, innerWidth - tw - 8) + "px";
    tip.style.top = r.bottom + 8 + "px";
  }
  document.addEventListener("pointerover", (e) => { const f = e.target.closest(".fn"); if (f) showTip(f); });
  document.addEventListener("pointerout", (e) => { if (e.target.closest(".fn")) tip.hidden = true; });
  document.addEventListener("scroll", () => { tip.hidden = true; }, { passive: true });

  const swatch = (c) => `<span class="sw" style="--c:${c}"></span>`;
  function stepValue(i, k) {
    const st = STEPS[k], s = TRACE[i][k];
    if (k === S1 - 1) return `→ ${swatch(s.color)}<span class="out">${s.color}</span>`;
    if (st.cond) return s.took ? `true → ${swatch(s.color)}` : `false, skip`;
    const v = st.show(s);
    return v.color ? `→ ${swatch(v.color)}` : `→ ${v.num}`;
  }

  function drawViz(ctx, viz, i) {
    const x = i % W, y = Math.floor(i / W), Z = 10;
    const cx = x * Z + 5, cy = y * Z + 5;
    const sx = PX.K.SUN_X * Z + 5, sy = PX.K.SUN_Y * Z + 5;
    const label = (text, lx, ly, color = "#ffe066") => {
      ctx.font = "bold 9px JetBrains Mono, monospace";
      const w = ctx.measureText(text).width + 6;
      lx = clamp(lx, 1, 320 - w - 1); ly = clamp(ly, 1, 180 - 13);
      ctx.fillStyle = "rgba(11,10,23,.85)"; ctx.fillRect(lx, ly, w, 12);
      ctx.fillStyle = color; ctx.fillText(text, lx + 3, ly + 9);
    };
    // a condition exactly as the code writes it, then with the values filled in, then the result
    const cond = (expr, a, op, b, ok) => `${expr}  →  ${a} ${op} ${b}  →  ${ok ? "true" : "false"}`;
    ctx.lineWidth = 1.5;
    if (viz === "sky") {
      ctx.fillStyle = "rgba(255,255,255,.14)"; ctx.fillRect(0, y * Z, 320, Z);
      label(`skyColor(${x}, ${y}): band ${Math.min(9, Math.floor((y / PX.K.SEA) * 10))}`, cx + 10, y * Z - 13);
    } else if (viz === "dist" || viz === "sun") {
      if (viz === "sun") {
        ctx.setLineDash([3, 3]); ctx.strokeStyle = "#ffe066";
        ctx.beginPath(); ctx.arc(sx, sy, PX.K.SUN_R * Z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        label("SUN_R = 4.2", sx + PX.K.SUN_R * Z + 3, sy - 6);
      }
      ctx.strokeStyle = "#ffe066";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sx, sy); ctx.stroke();
      ctx.fillStyle = "#ffe066"; ctx.fillRect(sx - 2, sy - 2, 4, 4); ctx.fillRect(cx - 2, cy - 2, 4, 4);
      const d = TRACE[i][1].d;
      label(viz === "sun" ? cond("d < SUN_R", d.toFixed(1), "<", "4.2", d < PX.K.SUN_R) : `d = ${d.toFixed(1)}`, (cx + sx) / 2 - 20, (cy + sy) / 2 - 14);
      if (viz === "dist") label("SUN = (20, 8)", sx + 6, sy - 16);
    } else if (viz === "mtn" || viz === "rock") {
      ctx.fillStyle = "rgba(255,77,141,.22)";
      for (let c = 0; c < W; c++) {
        const h = PX.mountainHeight(c);
        if (viz === "rock") ctx.fillRect(c * Z, h * Z, Z, 180 - h * Z);
      }
      ctx.strokeStyle = "#ff4d8d"; ctx.beginPath();
      for (let c = 0; c < W; c++) { const h = PX.mountainHeight(c); ctx.lineTo(c * Z, h * Z); ctx.lineTo(c * Z + Z, h * Z); }
      ctx.stroke();
      const h = PX.mountainHeight(x);
      ctx.strokeStyle = "#ffe066"; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, 180); ctx.stroke(); ctx.setLineDash([]);
      label(viz === "mtn" ? `mountainHeight(${x})  →  ${h}` : cond("y ≥ h", y, "≥", h, y >= h), cx + 6, h * Z - 16);
    } else if (viz === "sea") {
      ctx.fillStyle = "rgba(123,134,255,.2)"; ctx.fillRect(0, PX.K.SEA * Z, 320, 180);
      ctx.strokeStyle = "#7b86ff"; ctx.beginPath(); ctx.moveTo(0, PX.K.SEA * Z); ctx.lineTo(320, PX.K.SEA * Z); ctx.stroke();
      label(cond("y ≥ SEA", y, "≥", PX.K.SEA, y >= PX.K.SEA), 4, PX.K.SEA * Z - 15, "#c9ceff");
    } else if (viz === "glint") {
      ctx.strokeStyle = "#ffc46e";
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) if (PX.isGlint(xx, yy)) ctx.strokeRect(xx * Z + 1, yy * Z + 1, Z - 2, Z - 2);
      label(`isGlint(${x}, ${y})  →  ${TRACE[i][6].took}`, cx + 8, cy - 16);
    } else if (viz === "ret") {
      label(`return ${TRACE[i][S1 - 1].color}`, cx + 8, cy - 16, "#3df5c4");
    }
    // the pixel we're looking at
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.strokeRect(x * Z, y * Z, Z, Z);
  }

  inits[1] = () => {
    const rec = $("#cpu-recipe");
    rec.innerHTML = STEPS.map((st, k) => `<li data-k="${k}"><span class="code">${st.code}</span><span class="val"></span></li>`).join("");
    const lis = $$("li", rec);
    PX.drawSprite($("#cpu-sprite").getContext("2d"), PX.SPRITES.cpu, PX.PAL_CPU);

    const scr = makeScreen($("#cpu-canvas"));
    const ovCv = $("#cpu-overlay");
    const ov = ovCv.getContext("2d");
    const total = P * S1;
    let t = 0, playing = false, speed = 3, lastStep = -1, revealed = !!saved.cpuDone;
    let dbg = null;       // { i, k } when the learner is inspecting a pixel
    let hover = -1;       // recipe line under the pointer

    const cpuFocus = () => (t > 0 && t < total ? { i: Math.floor(t / S1), k: Math.floor(t) % S1 } : null);
    const focus = () => dbg || cpuFocus();
    const detailed = () => !!dbg || speed <= 3 || !playing;

    function draw() {
      const cur = Math.floor(t / S1);
      const ghost = !!dbg || hover >= 0; // show a faint preview of the finished picture for context
      for (let i = 0; i < P; i++) {
        if (i < cur || t >= total) scr.set(i, SCENE[i]);
        else if (i === cur && !dbg) scr.set(i, PX.hex(TRACE[i][Math.floor(t) % S1].color));
        else if (ghost) { const c = SCENE[i]; scr.set(i, [c[0] * 0.3 + 6, c[1] * 0.3 + 5, c[2] * 0.3 + 14]); }
        else scr.set(i, bgAt(i));
      }
      if (dbg) scr.set(dbg.i, PX.hex(TRACE[dbg.i][dbg.k].color));
      scr.flush();

      const f = focus();
      const show = f && detailed();
      lis.forEach((l, k) => {
        const past = show && k <= f.k;
        l.classList.toggle("on", !!f && k === f.k && (t < total || dbg));
        l.classList.toggle("skip", !!past && !!STEPS[k].cond && !TRACE[f.i][k].took);
        l.querySelector(".val").innerHTML = past ? stepValue(f.i, k) : "";
      });
      $("#dbg-where").textContent = f ? `(x = ${f.i % W}, y = ${Math.floor(f.i / W)})` : "";
      $("#cpu-pixel").textContent = Math.min(P, cur + (t >= total || t === 0 ? 0 : 1));
      $("#cpu-steps").textContent = fmt(Math.floor(t));
      $("#cpu-status").textContent = dbg ? `debugger: pixel (${dbg.i % W}, ${Math.floor(dbg.i / W)}), step ${dbg.k + 1} of 8`
        : t >= total ? `done: ${fmt(total)} steps, one at a time`
        : playing ? `painting pixel ${cur + 1} of 576` : t > 0 ? "paused" : "waiting…";

      ov.clearRect(0, 0, ovCv.width, ovCv.height);
      const vk = hover >= 0 ? hover : show ? f.k : -1;
      if (vk >= 0) drawViz(ov, STEPS[vk].viz, f ? f.i : EXAMPLE);
      else if (f) { ov.strokeStyle = "#fff"; ov.lineWidth = 2; ov.strokeRect((f.i % W) * 10, Math.floor(f.i / W) * 10, 10, 10); }
    }

    function loop() {
      actLoop(1, (dt) => {
        if (!playing) return false;
        t = Math.min(total, t + dt * speed);
        const s = Math.floor(t);
        if (s !== lastStep) {
          if (speed <= 3) SFX.step(s % S1);
          else if (speed <= 40 && s % S1 === 0) SFX.tick();
          lastStep = s;
        }
        draw();
        if (t >= total) { playing = false; setPlay(); finished(); return false; }
      });
    }
    function setPlay() { $("#cpu-play").textContent = playing ? "❚❚ PAUSE" : t >= total ? "▶ AGAIN" : "▶ PLAY"; }
    function finished() {
      SFX.success();
      save({ cpuDone: true });
      if (!revealed) {
        revealed = true;
        const r = $("#cpu-problem");
        r.hidden = false;
        setTimeout(() => r.scrollIntoView({ behavior: "smooth", block: "start" }), 400);
      }
    }
    $("#cpu-play").addEventListener("click", () => {
      SFX.click();
      dbg = null;
      if (t >= total) t = 0;
      playing = !playing;
      setPlay();
      if (playing) loop();
      draw();
    });
    $("#cpu-reset").addEventListener("click", () => { SFX.click(); playing = false; dbg = null; t = 0; setPlay(); draw(); });
    $$("#cpu-speed button").forEach((b) => b.addEventListener("click", () => {
      SFX.click();
      speed = +b.dataset.speed;
      $$("#cpu-speed button").forEach((x) => x.classList.toggle("on", x === b));
    }));

    // --- debugger ---
    const inspect = (i, k) => { playing = false; setPlay(); dbg = { i: (i + P) % P, k }; SFX.step(k); draw(); };
    $("#cpu-canvas").addEventListener("click", (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      const x = clamp(Math.floor(((e.clientX - r.left) / r.width) * W), 0, W - 1);
      const y = clamp(Math.floor(((e.clientY - r.top) / r.height) * H), 0, H - 1);
      inspect(y * W + x, 0);
      $("#dbg-hint").textContent = "Press STEP ▶ to run the next line.";
    });
    $("#dbg-next").addEventListener("click", () => {
      const f = focus() || { i: EXAMPLE, k: -1 };
      if (!dbg && !cpuFocus()) return inspect(f.i, 0);
      f.k + 1 < S1 ? inspect(f.i, f.k + 1) : inspect(f.i + 1, 0);
    });
    $("#dbg-prev").addEventListener("click", () => {
      const f = focus() || { i: EXAMPLE, k: 0 };
      f.k > 0 ? inspect(f.i, f.k - 1) : inspect(f.i - 1, S1 - 1);
    });
    lis.forEach((l, k) => {
      l.addEventListener("pointerenter", () => { hover = k; draw(); });
      l.addEventListener("pointerleave", () => { hover = -1; draw(); });
    });

    if (revealed) $("#cpu-problem").hidden = false;
    draw();
    onLeave[1] = () => { playing = false; setPlay(); tip.hidden = true; };

    initOverclock();
  };

  function initOverclock() {
    const cv = $("#oc-canvas");
    const ctx = cv.getContext("2d");
    const slider = $("#oc-slider");
    const chipBox = $(".oc-chip");
    let ghz = 4, melted = false, smoke = [];

    function update() {
      ghz = +slider.value;
      const watts = 100 * Math.pow(ghz / 4, 3);
      const fps = cpuFps(ghz);
      $("#oc-ghz").textContent = ghz.toFixed(1);
      $("#oc-fps").textContent = fpsText(fps);
      $("#oc-watts").textContent = fmt(watts) + " W";
      const heat = $("#oc-heat");
      heat.style.width = clamp(watts / 6, 4, 100) + "%";
      heat.style.background = watts < 200 ? "var(--cpu)" : watts < 400 ? "var(--hot)" : "var(--bad)";
      const msg = $("#oc-msg");
      const nowMelt = ghz >= 6.6;
      if (nowMelt && !melted) { SFX.boom(); save({ melted: true }); }
      melted = nowMelt;
      chipBox.classList.toggle("shake", ghz >= 5.8);
      if (melted) msg.innerHTML = `<span class="hot">THERMAL SHUTDOWN.</span> ${fmt(watts)} W is more than a space heater. Even at this speed your screen would get ${fpsText(fps)} frames per second. It wants ${DISPLAY.hz}.`;
      else if (ghz >= 5.6) msg.innerHTML = `Record territory. Power grows with roughly the <b class="gold">cube</b> of clock speed.`;
      else if (ghz >= 4.7) msg.innerHTML = `Getting hot. This is where the fastest CPUs actually top out.`;
      else if (ghz >= 3) msg.textContent = "A normal desktop CPU. Drag the slider →";
      else msg.textContent = "Cooler… and even slower frames.";
    }
    slider.addEventListener("input", update);
    update();

    onEnter[1] = () => actLoop(1, (dt, now) => {
      ctx.clearRect(0, 0, 48, 48);
      const heat = clamp((ghz - 4) / 2.6, 0, 1);
      // glow
      if (heat > 0) {
        ctx.fillStyle = `rgba(255,77,90,${0.12 + heat * 0.25 + Math.sin(now / 90) * 0.05 * heat})`;
        ctx.fillRect(4, 4, 40, 40);
      }
      PX.drawSprite(ctx, PX.SPRITES.cpu, melted
        ? { o: "#5a4a2a", A: "#3a0d10", a: "#7a1a1a", B: "#5a1414", b: "#a02222", W: "#1a0505", g: "#ff4d8d" }
        : PX.PAL_CPU, 8, 8, 2);
      if (heat > 0.3) {
        ctx.fillStyle = `rgba(255,90,60,${(heat - 0.3) * 0.6})`;
        ctx.fillRect(12, 12, 24, 24);
      }
      // smoke & sparks
      if (heat > 0.55 && Math.random() < heat * 0.6) smoke.push({ x: 12 + Math.random() * 24, y: 12 + Math.random() * 10, v: 6 + Math.random() * 10, life: 1 });
      smoke = smoke.filter((p) => (p.life -= dt * 0.9) > 0);
      smoke.forEach((p) => {
        p.y -= p.v * dt; p.x += Math.sin(now / 200 + p.v) * 0.2;
        ctx.fillStyle = melted && p.life > 0.7 ? "#ffb35c" : `rgba(160,150,190,${p.life * 0.7})`;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.life > 0.6 ? 2 : 1, p.life > 0.6 ? 2 : 1);
      });
    });
  }

  // ======================================================================
  //  ACT 2 · BUILD A CHIP
  // ======================================================================
  const TOOLS = {
    cpu: { w: 4, h: 4, name: "CPU CORE", desc: "A brilliant worker with its own brain. 1 math unit, full speed.", size: "4×4" },
    ctrl: { w: 2, h: 1, name: "CONTROL UNIT", desc: "Reads the recipe and shouts each step to every ALU in its row. Does no math.", size: "2×1" },
    alu: { w: 1, h: 1, name: "ALU", desc: "A simple math unit that only does what it's told. Half speed. Drag to paint.", size: "1×1" },
  };
  const LEVELS = [
    {
      label: "LEVEL 1", title: "Hire more workers",
      brief: 'You have <b>64 tiles</b> of silicon. A <b class="cpu">CPU core</b> takes 16. One core needs <b>4,608 ticks</b> for our frame. The deadline is <b class="gold">1,200 ticks</b>.',
      tools: ["cpu"], target: 1200, stars: [1152, 1152, 1200],
    },
    {
      label: "LEVEL 2", title: "Share one brain",
      brief: 'A <b style="color:var(--sky)">control unit</b> reads the recipe and shouts each step to every <b class="gpu">ALU</b> in its <b>row</b>. ALUs are tiny, but run at <b>half</b> a CPU core\'s speed. New deadline: <b class="gold">240 ticks</b>, that\'s 19× faster than one CPU core.',
      tools: ["cpu", "ctrl", "alu"], target: 240, stars: [192, 208, 240],
    },
  ];
  const DIE = 8;

  inits[2] = () => {
    const die = $("#die");
    const cells = [];
    for (let y = 0; y < DIE; y++)
      for (let x = 0; x < DIE; x++) {
        const c = document.createElement("div");
        c.className = "cell";
        die.appendChild(c);
        cells.push(c);
      }
    const occ = new Array(DIE * DIE).fill(null);
    let parts = [];
    let tool = "cpu";
    let level = 0;
    let running = false;
    let raceCtl = null;
    let resetDieFn = () => {};
    const stopRace = () => { if (raceCtl) raceCtl.stop(); resetDieFn(); };

    // ----- palette -----
    function buildPalette() {
      const lv = LEVELS[level];
      $("#palette").innerHTML = Object.entries(TOOLS).map(([k, t]) => {
        const locked = !lv.tools.includes(k);
        const col = k === "cpu" ? "var(--cpu)" : k === "ctrl" ? "var(--sky)" : "var(--gpu)";
        return `<button class="tool ${locked ? "locked" : ""}" data-tool="${k}" ${locked ? "disabled" : ""}>
          <span class="ico"><i style="width:${t.w * 12}px;height:${t.h * 12}px;background:${col}"></i></span>
          <span><b>${t.name}</b><span class="tool-size">${t.size} · ${t.w * t.h} tile${t.w * t.h > 1 ? "s" : ""}</span><br>${locked ? "🔒 locked" : t.desc}</span>
        </button>`;
      }).join("");
      $$(".tool").forEach((b) => b.addEventListener("click", () => { SFX.click(); selectTool(b.dataset.tool); }));
      selectTool(lv.tools[lv.tools.length - 1]);
    }
    function selectTool(k) {
      tool = k;
      $$(".tool").forEach((b) => b.classList.toggle("sel", b.dataset.tool === k));
    }

    // ----- placement -----
    const anchor = (x, y, t) => [clamp(x - Math.floor((t.w - 1) / 2), 0, DIE - t.w), clamp(y - Math.floor((t.h - 1) / 2), 0, DIE - t.h)];
    function fits(ax, ay, t) {
      for (let y = ay; y < ay + t.h; y++) for (let x = ax; x < ax + t.w; x++) if (occ[y * DIE + x] !== null) return false;
      return true;
    }
    function place(ax, ay, type) {
      const t = TOOLS[type];
      const el = document.createElement("div");
      el.className = `part ${type}-part pop`;
      Object.assign(el.style, { left: `${(ax / DIE) * 100}%`, top: `${(ay / DIE) * 100}%`, width: `${(t.w / DIE) * 100}%`, height: `${(t.h / DIE) * 100}%` });
      el.innerHTML = type === "cpu" ? `<span>CPU</span><span class="alu-dot"></span>` : type === "ctrl" ? "CTRL" : "";
      die.appendChild(el);
      const p = { id: Math.random(), type, x: ax, y: ay, w: t.w, h: t.h, el };
      parts.push(p);
      for (let y = ay; y < ay + t.h; y++) for (let x = ax; x < ax + t.w; x++) occ[y * DIE + x] = p;
      return p;
    }
    function removePart(p) {
      p.el.remove();
      parts = parts.filter((q) => q !== p);
      for (let i = 0; i < occ.length; i++) if (occ[i] === p) occ[i] = null;
    }
    function clearAll() { parts.slice().forEach(removePart); }

    function cellFromEvent(e) {
      const r = die.getBoundingClientRect();
      const x = Math.floor(((e.clientX - r.left) / r.width) * DIE);
      const y = Math.floor(((e.clientY - r.top) / r.height) * DIE);
      if (x < 0 || y < 0 || x >= DIE || y >= DIE) return null;
      return [x, y];
    }
    function clearGhost() { cells.forEach((c) => c.classList.remove("ghost-ok", "ghost-bad")); }
    function ghost(x, y) {
      clearGhost();
      if (occ[y * DIE + x]) return;
      const t = TOOLS[tool];
      const [ax, ay] = anchor(x, y, t);
      const ok = fits(ax, ay, t);
      for (let yy = ay; yy < ay + t.h; yy++) for (let xx = ax; xx < ax + t.w; xx++) cells[yy * DIE + xx].classList.add(ok ? "ghost-ok" : "ghost-bad");
    }

    let paint = null; // "place" | "erase"
    function act(x, y, first) {
      const hit = occ[y * DIE + x];
      if (first) paint = hit ? "erase" : "place";
      if (paint === "erase" && hit) { removePart(hit); SFX.remove(); refresh(); return; }
      if (paint === "place" && !hit) {
        const t = TOOLS[tool];
        const [ax, ay] = anchor(x, y, t);
        if (fits(ax, ay, t)) { place(ax, ay, tool); SFX.place(); refresh(); }
        else if (first) SFX.deny();
      }
    }
    die.addEventListener("pointerdown", (e) => {
      if (running) return;
      const c = cellFromEvent(e);
      if (!c) return;
      die.setPointerCapture(e.pointerId);
      act(c[0], c[1], true);
      ghost(c[0], c[1]);
    });
    die.addEventListener("pointermove", (e) => {
      if (running) return;
      const c = cellFromEvent(e);
      if (!c) { clearGhost(); return; }
      if (paint && (tool !== "cpu" || paint === "erase")) act(c[0], c[1], false);
      ghost(c[0], c[1]);
    });
    const end = () => { paint = null; };
    die.addEventListener("pointerup", end);
    die.addEventListener("pointercancel", end);
    die.addEventListener("pointerleave", () => { if (!paint) clearGhost(); });

    // ----- turn the layout into working units -----
    function units() {
      const us = [];
      parts.filter((p) => p.type === "cpu").sort((a, b) => a.y - b.y || a.x - b.x)
        .forEach((p) => us.push({ kind: "cpu", lanes: 1, stepTicks: 1, part: p }));
      const idle = [], lonelyCtrl = [], dupCtrl = [];
      for (let y = 0; y < DIE; y++) {
        const ctrls = parts.filter((p) => p.type === "ctrl" && p.y === y).sort((a, b) => a.x - b.x);
        const alus = parts.filter((p) => p.type === "alu" && p.y === y).sort((a, b) => a.x - b.x);
        if (ctrls.length && alus.length) us.push({ kind: "row", lanes: alus.length, stepTicks: 2, ctrl: ctrls[0], alus });
        if (!ctrls.length) idle.push(...alus);
        if (ctrls.length && !alus.length) lonelyCtrl.push(...ctrls);
        if (ctrls.length > 1) dupCtrl.push(...ctrls.slice(1));
      }
      return { us, idle, lonelyCtrl, dupCtrl };
    }

    function refresh() {
      const { us, idle, lonelyCtrl, dupCtrl } = units();
      const used = occ.filter(Boolean).length;
      const workers = us.reduce((s, u) => s + u.lanes, 0);
      $("#spec-used").textContent = `${used} / 64`;
      $("#spec-workers").textContent = workers;
      parts.forEach((p) => p.el.classList.toggle("idle", idle.includes(p) || lonelyCtrl.includes(p) || dupCtrl.includes(p)));
      let w = "";
      if (!parts.length) w = level === 0 ? "Pick CPU CORE and click the die." : "Try a CONTROL UNIT, then paint ALUs in the same row.";
      else if (idle.length) w = `${idle.length} ALU${idle.length > 1 ? "s have" : " has"} no control unit in its row. Nobody tells them what to do.`;
      else if (lonelyCtrl.length) w = "A control unit with no ALUs in its row is shouting at nobody.";
      else if (dupCtrl.length) w = "One control unit per row is enough. The extra one is wasted silicon.";
      $("#spec-warn").textContent = w;
      $("#run-btn").disabled = !us.length || running;
    }

    // ----- levels -----
    // once level 1 is beaten, let the learner jump between levels
    function renderTabs(active = level) {
      const tabs = $("#lvl-tabs");
      tabs.hidden = !saved.l1;
      tabs.innerHTML = LEVELS.map((l, i) => `<button class="btn ghost small ${i === active ? "on" : ""}" data-lvl="${i}">${l.label}${i === 0 && saved.l1 ? " ✓" : ""}${i === 1 && saved.workers ? " ✓" : ""}</button>`).join("");
      $$("[data-lvl]", tabs).forEach((b) => b.addEventListener("click", () => {
        SFX.click(); stopRace(); running = false;
        loadLevel(+b.dataset.lvl);
      }));
    }

    function loadLevel(i) {
      level = i;
      const lv = LEVELS[i];
      $("#lvl-label").textContent = lv.label;
      $("#lvl-title").textContent = lv.title;
      $("#lvl-brief").innerHTML = lv.brief;
      $("#spec-target").textContent = `${fmt(lv.target)} ticks`;
      renderTabs();
      clearAll();
      buildPalette();
      $("#race").hidden = true;
      $("#result").hidden = true;
      $("#insight").hidden = true;
      $("#lockstep").hidden = true;
      $(".builder").hidden = false;
      refresh();
    }

    // ----- run the race -----
    function run() {
      if (running) return;
      const { us } = units();
      if (!us.length) return;
      running = true;
      refresh();
      SFX.whoosh();
      const lv = LEVELS[level];
      const you = schedule(us, P, S1);
      const ref = schedule([{ lanes: 1, stepTicks: 1 }], P, S1);
      $("#race").hidden = false;
      $("#result").hidden = true;
      const workers = us.reduce((s, u) => s + u.lanes, 0);
      $("#race .you .tag").textContent = `YOUR CHIP · ${workers} WORKER${workers > 1 ? "S" : ""}`;
      $("#race").scrollIntoView({ behavior: "smooth", block: "center" });

      const ptr = us.map(() => 0);
      const animDie = (t) => {
        us.forEach((u, k) => {
          const bs = you.batches[k];
          while (ptr[k] < bs.length && bs[ptr[k]].t1 <= t) ptr[k]++;
          const b = bs[ptr[k]];
          const active = b && b.t0 <= t && t < b.t1;
          // calm visuals: a steady glow while working + a thin progress bar through the 8 steps
          const prog = active ? (t - b.t0) / (b.t1 - b.t0) : 0;
          if (u.kind === "cpu") {
            u.part.el.classList.toggle("busy", active);
            u.part.el.style.setProperty("--p", prog);
          } else {
            u.ctrl.el.classList.toggle("busy", active);
            u.ctrl.el.style.setProperty("--p", prog);
            u.alus.forEach((a, l) => a.el.classList.toggle("busy", active && l < b.n));
          }
        });
      };
      const resetDie = resetDieFn = () => us.forEach((u) => {
        if (u.kind === "cpu") { u.part.el.classList.remove("busy"); u.part.el.style.setProperty("--p", 0); }
        else { u.ctrl.el.classList.remove("busy"); u.ctrl.el.style.setProperty("--p", 0); u.alus.forEach((a) => a.el.classList.remove("busy")); }
      });

      raceCtl = race({
        actIndex: 2, image: SCENE,
        ref: { canvas: $("#race-ref"), bar: $("#race-ref-bar"), label: $("#race-ref-t"), sched: ref },
        you: { canvas: $("#race-you"), bar: $("#race-you-bar"), label: $("#race-you-t"), sched: you, waveTicks: us.some((u) => u.kind === "row") ? 2 * S1 : S1 },
        onFrame: animDie,
        onYouDone: () => { resetDie(); showResult(you.total, ref.total, lv, us); },
        onRefDone: () => { const ff = $("#ff-btn"); if (ff) ff.remove(); running = false; refresh(); },
      });
    }

    function showResult(tYou, tRef, lv, us) {
      const box = $("#result");
      const ok = tYou <= lv.target;
      const stars = ok ? lv.stars.filter((s) => tYou <= s).length : 0;
      const x = speedup(tRef, tYou);
      box.hidden = false;
      box.classList.toggle("fail", !ok);
      const starHtml = [0, 1, 2].map((i) => `<span class="${i < stars ? "" : "off"}">★</span>`).join("");
      const ff = `<button class="btn ghost small" id="ff-btn">⏩ LET THE CPU FINISH</button>`;
      if (!ok) {
        SFX.fail();
        const hasCpu = us.some((u) => u.kind === "cpu");
        const hint = level === 0 ? "Four 4×4 cores tile an 8×8 die perfectly."
          : hasCpu ? "A CPU core spends 16 tiles on a single math unit. What if those tiles were ALUs instead?"
          : $("#spec-warn").textContent || "Every row can hold 1 control unit + 6 ALUs.";
        box.innerHTML = `<p class="headline" style="color:var(--bad)">DEADLINE MISSED</p>
          <p>Your chip took <b>${fmt(tYou)}</b> ticks. The deadline was <b>${fmt(lv.target)}</b>.</p>
          <p class="muted">Hint: ${hint}</p>
          <div class="controls"><button class="btn cpu-btn" id="retry-btn">↺ BACK TO THE DRAWING BOARD</button>${ff}</div>`;
      } else {
        SFX.fanfare();
        const workers = us.reduce((s, u) => s + u.lanes, 0);
        if (level === 0) {
          save({ l1: tYou });
          box.innerHTML = `<div class="stars">${starHtml}</div>
            <p class="headline gpu">${x}× FASTER</p>
            <p>Your chip: <b>${fmt(tYou)}</b> ticks · one CPU core: <b>${fmt(tRef)}</b> ticks.</p>
            <p>That's a <b class="cpu">multi-core CPU</b>, like the one in your laptop. But to paint your real screen ${DISPLAY.hz} times a second, you'd need about <b>${fmt(Math.max(2, DISPLAY.hz / (4 * cpuFps(4))))}×</b> more, and you're out of silicon.</p>
            <div class="controls"><button class="btn" id="to-insight">▶ LOOK INSIDE A CORE</button>${ff}</div>`;
        } else {
          save({ chip: us.map((u) => ({ lanes: u.lanes, stepTicks: u.stepTicks })), workers, speedup: tRef / tYou, stars: Math.max(stars, saved.stars || 0) });
          const vsFour = speedup(1152, tYou);
          box.innerHTML = `<div class="stars">${starHtml}</div>
            <p class="headline gpu">${x}× FASTER</p>
            <p>Your chip: <b>${fmt(tYou)}</b> ticks · one CPU core: <b>${fmt(tRef)}</b> ticks.</p>
            <p>Same 64 tiles as four CPU cores, and <b class="gold">${vsFour}× faster</b> than them. You traded brains for muscle: <b class="gpu">${workers}</b> workers, all following one shared recipe.</p>
            ${stars < 3 ? `<p class="muted">Want ★★★? Get the frame done in 192 ticks.</p>` : ""}
            <div class="controls"><button class="btn" data-next>▶ WHAT DID I JUST BUILD?</button>
            ${stars < 3 ? `<button class="btn ghost" id="retry-btn">↺ TRY FOR ★★★</button>` : ""}${ff}</div>`;
        }
      }
      const ffBtn = $("#ff-btn");
      if (ffBtn) ffBtn.addEventListener("click", () => { SFX.whoosh(); raceCtl.fastForward(); ffBtn.remove(); });
      const retry = $("#retry-btn");
      if (retry) retry.addEventListener("click", () => {
        SFX.click(); stopRace(); running = false; $("#race").hidden = true; refresh();
        $(".builder").scrollIntoView({ behavior: "smooth", block: "center" });
      });
      const ti = $("#to-insight");
      if (ti) ti.addEventListener("click", () => { SFX.click(); stopRace(); running = false; showInsight(); });
    }

    function showInsight() {
      $("#race").hidden = true;
      $(".builder").hidden = true;
      const ins = $("#insight");
      ins.hidden = false;
      $("#lvl-label").textContent = "INTERMISSION";
      $("#lvl-title").textContent = "Where did the silicon go?";
      renderTabs(-1);
      $("#lvl-brief").innerHTML = "Four cores, and the die is full. Let's X-ray one of them.";
      const layout = "BBBCBBBCBBBCCCCA";
      const xr = $("#core-xray");
      xr.innerHTML = layout.split("").map((c) => `<i class="${c === "B" ? "brain" : c === "C" ? "cache" : "alu"}">${c === "A" ? "ALU" : ""}</i>`).join("");
      if (!$(".xray-legend")) xr.insertAdjacentHTML("afterend", `<div class="xray-legend">
        <span style="--c:#ff7d6b">brain / control</span><span style="--c:#b58cff">cache memory</span><span style="--c:var(--gpu)">ALU: the math</span></div>`);
      $$("i", xr).forEach((c, i) => setTimeout(() => { c.classList.add("show"); SFX.tick(); }, 200 + i * 70));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    $("#insight-go").addEventListener("click", () => { SFX.reveal(); showLockstep(); });
    $("#ls-go").addEventListener("click", () => { SFX.reveal(); loadLevel(1); window.scrollTo({ top: 0, behavior: "smooth" }); });

    // ----- lockstep explainer: one control unit, six ALUs, six different pixels -----
    const LS_Y = 9, LS_X0 = 14, LS_N = 6;
    const lanes = Array.from({ length: LS_N }, (_, l) => TRACE[LS_Y * W + LS_X0 + l]);
    let lsK = -1, lsAuto = null;
    function showLockstep() {
      $("#insight").hidden = true;
      $(".builder").hidden = true;
      $("#race").hidden = true;
      $("#lockstep").hidden = false;
      $("#lvl-label").textContent = "INTERMISSION";
      $("#lvl-title").textContent = "One brain, many hands";
      $("#lvl-brief").innerHTML = "Before you build it: how can <b>one</b> instruction paint <b>six different</b> pixels?";
      const mini = makeScreen($("#ls-mini"));
      for (let i = 0; i < P; i++) mini.set(i, SCENE[i]);
      mini.flush();
      Object.assign($("#ls-box").style, { left: `${(LS_X0 / W) * 100}%`, top: `${(LS_Y / H) * 100}%`, width: `${(LS_N / W) * 100}%`, height: `${(1 / H) * 100}%` });
      lsK = -1;
      renderLanes();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    function renderLanes() {
      const st = lsK >= 0 ? STEPS[lsK] : null;
      $("#ls-instr").innerHTML = st ? st.code : "load your own x, y";
      $("#ls-stepno").textContent = `step ${lsK + 1} / 8`;
      $("#ls-lanes").innerHTML = lanes.map((tr, l) => {
        const s = lsK >= 0 ? tr[lsK] : { x: LS_X0 + l, y: LS_Y, color: null };
        const masked = st && st.cond && !s.took;
        const reg = (name, v, key) => `<div class="reg ${st && key && lsK === key ? "fresh" : ""}"><span>${name}</span><b>${v}</b></div>`;
        return `<div class="lane ${masked ? "masked" : ""}" data-lane="${l}">
          <div class="lane-h"><span class="pixel">ALU ${l + 1}</span><span class="lane-px" style="background:${s.color || "#0f0d20"}"></span></div>
          ${reg("x", s.x)}${reg("y", s.y)}
          ${reg("d", s.d != null ? s.d.toFixed(1) : "—", 1)}${reg("h", s.h != null ? s.h : "—", 3)}
          <div class="reg ${st && s.took && [0, 2, 4, 5, 6].includes(lsK) ? "fresh" : ""}"><span>color</span><b>${s.color ? `<span class="sw" style="--c:${s.color}"></span>` : "—"}</b></div>
          <div class="lane-s">${!st ? "ready" : masked ? "✗ false: sits out" : st.cond ? "✓ true: does it" : "✓ does it"}</div>
        </div>`;
      }).join("");
      const done = lsK >= S1 - 1;
      $("#ls-step").disabled = done;
      $("#ls-go").hidden = !done;
      $("#ls-note").hidden = lsK < 2;
    }
    function lsStep() {
      if (lsK >= S1 - 1) { clearInterval(lsAuto); lsAuto = null; $("#ls-auto").textContent = "AUTO"; return; }
      lsK++;
      SFX.step(lsK);
      renderLanes();
      if (lsK === S1 - 1) { SFX.success(); clearInterval(lsAuto); lsAuto = null; $("#ls-auto").textContent = "↺ AGAIN"; }
    }
    // hovering an ALU card points at the pixel it is working on
    const lsPx = $("#ls-px");
    Object.assign(lsPx.style, { top: `${(LS_Y / H) * 100}%`, width: `${100 / W}%`, height: `${100 / H}%` });
    $("#ls-lanes").addEventListener("pointerover", (e) => {
      const card = e.target.closest(".lane");
      if (!card) return;
      lsPx.style.left = `${((LS_X0 + +card.dataset.lane) / W) * 100}%`;
      lsPx.hidden = false;
      $(".ls-where").classList.add("pointing");
      $$(".lane").forEach((c) => c.classList.toggle("pointed", c === card));
    });
    $("#ls-lanes").addEventListener("pointerleave", () => {
      lsPx.hidden = true;
      $(".ls-where").classList.remove("pointing");
      $$(".lane").forEach((c) => c.classList.remove("pointed"));
    });
    $("#ls-step").addEventListener("click", lsStep);
    $("#ls-auto").addEventListener("click", () => {
      if (lsAuto) { clearInterval(lsAuto); lsAuto = null; $("#ls-auto").textContent = "AUTO"; return; }
      if (lsK >= S1 - 1) { lsK = -1; renderLanes(); }
      $("#ls-auto").textContent = "❚❚ PAUSE";
      lsAuto = setInterval(lsStep, 1100);
    });
    $("#run-btn").addEventListener("click", run);
    $("#clear-btn").addEventListener("click", () => { if (running) return; SFX.remove(); clearAll(); refresh(); });

    onLeave[2] = () => {
      stopRace();
      if (running) { running = false; $("#race").hidden = true; refresh(); }
    };

    loadLevel(saved.l1 ? 1 : 0);
  };

  // ======================================================================
  //  ACT 3 · ZOOM OUT
  // ======================================================================
  inits[3] = () => {
    const cv = $("#zoom-canvas");
    // world: 16×8 blocks, each block = 2 control cols + 16 ALU cols × 8 rows = 128 ALUs
    const BW = 18, BH = 8, GAP = 2, NX = 16, NY = 8;
    const WW = NX * BW + (NX + 1) * GAP, WH = NY * BH + (NY + 1) * GAP;
    cv.width = WW * 2; cv.height = WH * 2;
    cv.style.aspectRatio = `${WW} / ${WH}`;
    const ctx = cv.getContext("2d");
    const home = { bx: 7, by: 3 };
    const yourWorkers = saved.workers || 48;
    const perRow = Math.max(1, Math.round(yourWorkers / 8));
    let z = 0; // 0 = your chip filling the view, 1 = full die
    let lit = 0; // how many blocks are powered
    let zooming = false, done = false;

    const blockOrder = [];
    for (let by = 0; by < NY; by++) for (let bx = 0; bx < NX; bx++) blockOrder.push({ bx, by, d: Math.hypot(bx - home.bx, (by - home.by) * 2) });
    blockOrder.sort((a, b) => a.d - b.d);
    const litSet = new Set();

    function draw(now) {
      const full = cv.width / WW;
      const close = cv.height / (BH + GAP * 2);
      const scale = close * Math.pow(full / close, ease(z));
      const cx0 = GAP + home.bx * (BW + GAP) + BW / 2, cy0 = GAP + home.by * (BH + GAP) + BH / 2;
      const cx = cx0 + (WW / 2 - cx0) * ease(z), cy = cy0 + (WH / 2 - cy0) * ease(z);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#07060f";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.setTransform(scale, 0, 0, scale, cv.width / 2 - cx * scale, cv.height / 2 - cy * scale);
      ctx.fillStyle = "#15122b";
      ctx.fillRect(0, 0, WW, WH);
      const t = now / 1000;
      for (let by = 0; by < NY; by++)
        for (let bx = 0; bx < NX; bx++) {
          const ox = GAP + bx * (BW + GAP), oy = GAP + by * (BH + GAP);
          const isHome = bx === home.bx && by === home.by;
          const on = isHome || litSet.has(by * NX + bx);
          for (let r = 0; r < BH; r++) {
            // control unit: 2 columns
            ctx.fillStyle = on ? "#7b86ff" : "#1f1b3d";
            ctx.fillRect(ox, oy + r, 2, 1);
            for (let c = 0; c < 16; c++) {
              let col = "#1b1836";
              const active = isHome && !done && z === 0 ? c < perRow : on;
              if (active) {
                // lockstep: every unit in a 32-wide group flashes together
                const warp = Math.floor((r * 16 + c) / 32);
                const pulse = Math.sin(t * 6 - (bx + by * 1.7) * 0.6 - warp * 0.9) > 0.2;
                col = pulse ? "#b8fff0" : "#3df5c4";
              }
              ctx.fillStyle = col;
              ctx.fillRect(ox + 2 + c + 0.08, oy + r + 0.08, 0.84, 0.84);
            }
          }
          if (isHome && z < 0.35) {
            ctx.strokeStyle = "#ffe066";
            ctx.lineWidth = 0.18;
            ctx.strokeRect(ox - 0.4, oy - 0.4, BW + 0.8, BH + 0.8);
          }
        }
    }

    onEnter[3] = () => actLoop(3, (dt, now) => { draw(now); });
    $("#zoom-count").textContent = fmt(yourWorkers);

    $("#zoom-btn").addEventListener("click", () => {
      if (zooming) return;
      zooming = true;
      $("#zoom-btn").disabled = true;
      SFX.whoosh();
      const stages = [
        { at: 0, tag: "ONE GPU BLOCK", count: 128, cap: "one block (an 'SM')" },
        { at: 1400, tag: "A FULL GPU", count: 16384, cap: "128 blocks, in lockstep groups of 32" },
      ];
      done = true;
      $("#zoom-tag").textContent = stages[0].tag;
      $("#zoom-caption").textContent = stages[0].cap;
      countTo(yourWorkers, 128, 900);
      setTimeout(() => {
        $("#zoom-tag").textContent = stages[1].tag;
        $("#zoom-caption").textContent = stages[1].cap;
        const t0 = performance.now();
        (function f(now) {
          const k = clamp((now - t0) / 3200, 0, 1);
          z = k;
          const want = Math.floor(ease(clamp(k * 1.25, 0, 1)) * blockOrder.length);
          while (lit < want) { const b = blockOrder[lit++]; litSet.add(b.by * NX + b.bx); if (lit % 6 === 0) SFX.tick(); }
          $("#zoom-count").textContent = fmt(128 * Math.max(1, lit));
          if (k < 1) requestAnimationFrame(f);
          else {
            $("#zoom-count").textContent = "16,384";
            $("#zoom-btn").hidden = true;
            SFX.fanfare();
            $("#zoom-compare").hidden = false;
            $("#zoom-next").hidden = false;
            setTimeout(() => $("#zoom-compare").scrollIntoView({ behavior: "smooth", block: "center" }), 300);
          }
        })(t0);
      }, stages[1].at);
    });

    function countTo(a, b, ms) {
      const t0 = performance.now();
      (function f(now) {
        const k = clamp((now - t0) / ms, 0, 1);
        $("#zoom-count").textContent = fmt(a + (b - a) * ease(k));
        if (k < 1) requestAnimationFrame(f);
      })(t0);
    }
  };

  // ======================================================================
  //  ACT 4 · AI
  // ======================================================================
  inits[4] = () => {
    const N = 6;
    const mk = (id, clickable) => {
      const el = $(id);
      el.style.gridTemplateColumns = `repeat(${N}, auto)`;
      el.innerHTML = Array.from({ length: N * N }, (_, i) => `<i data-i="${i}" style="--v:${(0.2 + Math.random() * 0.8).toFixed(2)}"></i>`).join("");
      return $$("i", el);
    };
    const A = mk("#mm-a"), B = mk("#mm-b"), C = mk("#mm-c", true);
    const light = (i) => {
      const r = Math.floor(i / N), c = i % N;
      [...A, ...B, ...C].forEach((x) => x.classList.remove("lit"));
      if (i < 0) return;
      for (let k = 0; k < N; k++) { A[r * N + k].classList.add("lit"); B[k * N + c].classList.add("lit"); }
      C[i].classList.add("lit");
    };
    C.forEach((cell, i) => {
      cell.addEventListener("pointerenter", () => { light(i); SFX.tick(); });
      cell.addEventListener("click", () => light(i));
    });
    $("#mm-c").addEventListener("pointerleave", () => light(-1));
    // gentle auto-demo so the idea lands even without hovering
    let demo = 0;
    const demoTimer = setInterval(() => {
      if (current !== 4) return;
      if ($("#mm-c").matches(":hover")) return;
      light(demo); demo = (demo + 7) % (N * N);
    }, 900);

    const S = 16;
    const chip = saved.chip && saved.chip.length ? saved.chip : Array.from({ length: 8 }, () => ({ lanes: 6, stepTicks: 2 }));
    const workers = chip.reduce((s, u) => s + u.lanes, 0);
    $("#ai-lanes").textContent = workers;
    let ctl = null;
    $("#ai-run").addEventListener("click", () => {
      if (ctl) ctl.stop();
      SFX.whoosh();
      $("#ai-run").disabled = true;
      const you = schedule(chip, P, S);
      const ref = schedule([{ lanes: 1, stepTicks: 1 }], P, S);
      ctl = race({
        actIndex: 4, image: MATRIX,
        ref: { canvas: $("#ai-ref"), bar: $("#ai-ref-bar"), label: $("#ai-ref-t"), sched: ref },
        you: { canvas: $("#ai-you"), bar: $("#ai-you-bar"), label: $("#ai-you-t"), sched: you, waveTicks: 2 * S },
        onYouDone: () => {
          SFX.fanfare();
          const x = speedup(ref.total, you.total);
          save({ aiSpeedup: ref.total / you.total });
          const res = $("#ai-result");
          res.hidden = false;
          res.innerHTML = `<p class="headline gpu">${x}× FASTER</p>
            <p>Same chip, different recipe. Pixels or neurons, it doesn't care: <b class="gold">lots of independent math, same steps</b>. That's the whole trick.</p>
            <div class="controls"><button class="btn ghost small" id="ai-ff">⏩ LET THE CPU FINISH</button></div>`;
          $("#ai-ff").addEventListener("click", (e) => { ctl.fastForward(); e.target.remove(); });
          const sp = $("#scale-panel");
          sp.hidden = false;
          setTimeout(() => {
            sp.scrollIntoView({ behavior: "smooth", block: "start" });
            $$("#scale-bars .fill").forEach((f, i) => setTimeout(() => { f.style.width = f.dataset.w + "%"; SFX.reveal(); }, 500 + i * 900));
          }, 1200);
        },
        onRefDone: () => { $("#ai-run").disabled = false; $("#ai-run").textContent = "↺ RUN AGAIN"; const f = $("#ai-ff"); if (f) f.remove(); },
      });
    });
    onLeave[4] = () => { if (ctl) { ctl.stop(); $("#ai-run").disabled = false; } };
    void demoTimer;
  };

  // ======================================================================
  //  ACT 5 · CPU OR GPU?
  // ======================================================================
  const JOBS = [
    { job: "Color all 8 million pixels of a video-game frame.", a: "gpu",
      why: "Same recipe, 8 million times, and no pixel waits for another. Perfect for an army." },
    { job: "Follow a treasure map where every clue tells you where the next clue is.", a: "cpu",
      why: "Each step needs the previous answer, so only one worker can ever be busy. The CPU is the faster single worker." },
    { job: "Brighten every photo in a 10,000-photo album.", a: "gpu",
      why: "Every pixel of every photo, same math, all independent. Army time." },
    { job: "React when you click: which button was it, which menu is open, is it allowed, what's next…", a: "cpu",
      why: "A twisty chain of decisions, one after another. The CPU's big brain predicts the branches and races through." },
    { job: "Train a neural network.", a: "gpu",
      why: "Trillions of independent multiply-adds, over and over. This is why AI runs on GPUs." },
    { job: "Run the operating system: files, network, keyboard, a hundred little programs.", a: "cpu",
      why: "Many different, unpredictable little tasks. You want a smart manager, not an army doing one recipe." },
  ];
  inits[5] = () => {
    let score = 0, answered = 0;
    $("#cards").innerHTML = JOBS.map((j, i) => `
      <div class="card" data-i="${i}">
        <span class="job-ico">JOB ${String(i + 1).padStart(2, "0")}</span>
        <p class="job">${j.job}</p>
        <div class="pick">
          <button class="btn cpu-btn small" data-pick="cpu">CPU</button>
          <button class="btn small" data-pick="gpu">GPU</button>
        </div>
        <span class="verdict"></span>
        <p class="why">${j.why}</p>
      </div>`).join("");
    $$(".card").forEach((card) => card.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pick]");
      if (!b || card.classList.contains("answered")) return;
      const j = JOBS[+card.dataset.i];
      const right = b.dataset.pick === j.a;
      card.classList.add("answered", right ? "right" : "wrong");
      if (!right) card.classList.add("bump");
      card.querySelector(".verdict").textContent = right ? `✓ ${j.a.toUpperCase()}, CORRECT` : `✗ IT'S THE ${j.a.toUpperCase()}`;
      right ? SFX.success() : SFX.deny();
      if (right) score++;
      answered++;
      $("#sort-score").textContent = `${score} / ${JOBS.length}`;
      if (answered === JOBS.length) {
        save({ sortScore: score });
        $("#sort-next").hidden = false;
        setTimeout(() => $("#sort-next").scrollIntoView({ behavior: "smooth", block: "center" }), 600);
      }
    }));
  };

  // ======================================================================
  //  ACT 6 · WHY SO EXPENSIVE
  // ======================================================================
  inits[6] = () => {
    const open = new Set();
    $$(".cost").forEach((c) => c.addEventListener("click", () => {
      if (open.has(c.dataset.i)) return;
      open.add(c.dataset.i);
      c.classList.add("open");
      SFX.reveal();
      if (open.size === 4) {
        $("#cost-next").hidden = false;
        setTimeout(() => $("#cost-next").scrollIntoView({ behavior: "smooth", block: "center" }), 500);
      }
    }));
  };

  // ======================================================================
  //  ACT 7 · FINALE — sand → crystal → wafer → chip → thinking
  // ======================================================================
  inits[7] = () => {
    $("#replay").addEventListener("click", () => {
      try { localStorage.removeItem(KEY); } catch (e) {}
      location.reload();
    });
  };

  onEnter[7] = () => {
    const cv = $("#finale-canvas");
    const ctx = cv.getContext("2d");
    const FW = cv.width, FH = cv.height;
    const lines = $$("#finale-lines .fl");
    lines.forEach((l) => l.classList.remove("show"));
    $("#finale-card").hidden = true;
    let stage = 0, shown = 0;
    const t0 = performance.now();
    const btn = $("#finale-next");
    btn.hidden = false;
    btn.textContent = "▶ CONTINUE";
    const reveal = () => {
      if (shown < lines.length) {
        const i = shown++;
        lines[i].classList.add("show"); stage = i;
        i === lines.length - 1 ? SFX.fanfare() : SFX.reveal();
        if (shown === lines.length) btn.textContent = "▶ WHAT YOU DID TODAY";
        // the button sits right under the newest line; keep both in view
        requestAnimationFrame(() => btn.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      } else { btn.hidden = true; showCard(); }
    };
    btn.onclick = reveal;
    const first = setTimeout(() => { if (current === 7 && shown === 0) reveal(); }, 500);
    onLeave[7] = () => clearTimeout(first);

    // deterministic sand grains
    const grains = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) {
      const x = (rnd() + rnd() + rnd()) / 3;
      const hmax = 1 - Math.abs(x - 0.5) * 2;
      grains.push({ x: 20 + x * 120, y: FH - 6 - rnd() * hmax * 34, c: ["#d9b77a", "#c49a5a", "#e8cf98", "#b7894d"][Math.floor(rnd() * 4)] });
    }
    let stageT = 0, lastStage = -1;

    actLoop(7, (dt, now) => {
      const t = (now - t0) / 1000;
      if (stage !== lastStage) { lastStage = stage; stageT = 0; }
      stageT += dt;
      const k = clamp(stageT / 1.6, 0, 1);
      ctx.fillStyle = "#07060f";
      ctx.fillRect(0, 0, FW, FH);
      // stars
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = (i * 13 + Math.floor(t * 2)) % 9 === 0 ? "#ecebff" : "#2d2856";
        ctx.fillRect((i * 97 + (i * i * 31) % 17) % FW, (i * 53 + (i * 7) % 11) % 28, 1, 1);
      }
      const cx = FW / 2, cy = FH / 2;
      if (stage === 0) {
        grains.forEach((g, i) => {
          ctx.fillStyle = (i + Math.floor(t * 8)) % 97 === 0 ? "#fff3b0" : g.c;
          ctx.fillRect(Math.round(g.x), Math.round(g.y), 1, 1);
        });
      } else if (stage === 1) {
        // sand rises into a glowing crystal ingot
        const hh = 50 * ease(k);
        grains.forEach((g, i) => {
          const tx = cx - 8 + (i % 16), ty = FH - 8 - (i / 16) % 50;
          const x = g.x + (tx - g.x) * ease(k), y = g.y + (ty - g.y) * ease(k);
          if (k < 1) { ctx.fillStyle = g.c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
        });
        ctx.fillStyle = "rgba(123,134,255,.15)";
        ctx.fillRect(cx - 12, FH - 10 - hh, 24, hh + 4);
        for (let y = 0; y < hh; y++) {
          for (let x = -8; x < 8; x++) {
            const shade = x < -5 ? "#6d74a8" : x < -2 ? "#aab2dc" : x < 2 ? "#dfe4ff" : x < 5 ? "#aab2dc" : "#6d74a8";
            ctx.fillStyle = shade;
            ctx.fillRect(cx + x, FH - 8 - y, 1, 1);
          }
        }
      } else if (stage === 2) {
        // a wafer, printed by a sweeping beam of light
        const R = 30;
        const beam = ((t * 0.7) % 1) * (R * 2 + 10) - R - 5;
        for (let y = -R; y <= R; y++)
          for (let x = -R; x <= R; x++) {
            if (x * x + y * y > R * R) continue;
            let c = (x + y) % 2 ? "#aab2dc" : "#b8c0e6";
            const dieX = Math.floor((x + R) / 6), dieY = Math.floor((y + R) / 6);
            const inGrid = (x + R) % 6 !== 0 && (y + R) % 6 !== 0;
            const printed = x < beam + (k < 1 ? -R * 2 * (1 - k) : 0) && inGrid;
            if (printed) c = ["#7b86ff", "#ff4d8d", "#3df5c4", "#ffe066"][(dieX * 3 + dieY) % 4];
            if (!inGrid) c = "#8a92c0";
            ctx.fillStyle = c;
            ctx.fillRect(cx + x, cy + y, 1, 1);
          }
        ctx.fillStyle = "rgba(181,140,255,.55)";
        ctx.fillRect(Math.round(cx + beam), cy - R - 4, 2, R * 2 + 8);
      } else {
        // the chip, alive
        const sx = stage === 4 ? 40 : cx, s = 34;
        const pulse = (t * 1.5) % 1;
        // traces
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          for (let r = s / 2 + 3; r < s / 2 + 3 + 26; r++) {
            const x = Math.round(sx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.9);
            const on = Math.abs((r - s / 2 - 3) / 26 - pulse) < 0.08;
            ctx.fillStyle = on ? "#3df5c4" : "#1f2a3d";
            ctx.fillRect(x, y, 1, 1);
          }
        }
        ctx.fillStyle = "#c9a44a";
        for (let i = 0; i < s; i += 3) {
          ctx.fillRect(sx - s / 2 + i, cy - s / 2 - 2, 2, 2); ctx.fillRect(sx - s / 2 + i, cy + s / 2, 2, 2);
          ctx.fillRect(sx - s / 2 - 2, cy - s / 2 + i, 2, 2); ctx.fillRect(sx + s / 2, cy - s / 2 + i, 2, 2);
        }
        ctx.fillStyle = "#15122b";
        ctx.fillRect(sx - s / 2, cy - s / 2, s, s);
        for (let y = 0; y < 14; y++)
          for (let x = 0; x < 14; x++) {
            const w = Math.sin(t * 6 - (x + y) * 0.5) > 0.3;
            ctx.fillStyle = w ? "#b8fff0" : "#3df5c4";
            ctx.fillRect(sx - 14 + x * 2, cy - 14 + y * 2, 1, 1);
          }
        if (stage === 4) {
          // …and it paints a world
          const ox = 78, oy = cy - 18;
          ctx.fillStyle = "#2d2856";
          ctx.fillRect(ox - 2, oy - 2, 68, 40);
          const reveal = ease(k) * P;
          for (let i = 0; i < P; i++) {
            const c = i < reveal ? SCENE[i] : [15, 13, 32];
            ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
            ctx.fillRect(ox + (i % W) * 2, oy + Math.floor(i / W) * 2, 2, 2);
          }
        }
      }
    });
  };

  function showCard() {
    const a = [];
    a.push(`Painted 576 pixels with a single CPU core: <b>4,608 steps</b>, one at a time.`);
    if (saved.melted) a.push(`Overclocked a CPU until it <b class="hot">melted</b>, and hit the power wall.`);
    if (saved.l1) a.push(`Built a <b class="cpu">4-core CPU</b> and went 4× faster.`);
    if (saved.workers) a.push(`Invented the <b class="gpu">GPU</b>: ${saved.workers} workers sharing one recipe, <b class="gold">${speedup(saved.speedup, 1)}× faster</b> than a CPU core on the same silicon ${"★".repeat(saved.stars || 0)}`);
    if (saved.aiSpeedup) a.push(`Ran a neural-network layer <b class="gold">${speedup(saved.aiSpeedup, 1)}× faster</b> on your own chip.`);
    if (saved.sortScore != null) a.push(`Sorted jobs between CPU and GPU: <b>${saved.sortScore} / 6</b>.`);
    a.push(`Learned why a GPU costs as much as a car.`);
    $("#achievements").innerHTML = a.map((x) => `<li><span>${x}</span></li>`).join("");
    $("#finale-card").hidden = false;
    $("#finale-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------- boot ----------
  const hashAct = parseInt((location.hash.match(/act=(\d+)/) || [])[1], 10);
  go(Number.isFinite(hashAct) ? hashAct : 0);
})();
