/* EP 02 · THE SWITCH — lesson logic */
(function () {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const fmt = (n) => Math.round(n).toLocaleString("en-US");

  // ---------- progress (per-viewer convenience only) ----------
  const KEY = "tr-ep02";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { saved = {}; }
  const save = (patch) => { Object.assign(saved, patch); try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) {} };

  // ======================================================================
  //  ACT CONTROLLER (same behaviour as EP 01)
  // ======================================================================
  const acts = $$(".act");
  const inits = {}, onEnter = {}, onLeave = {}, started = new Set();
  let current = -1, maxReached = clamp(saved.maxAct || 0, 0, acts.length - 1);
  acts.forEach((a, i) => {
    const b = document.createElement("button");
    b.className = "pip"; b.title = a.dataset.title;
    b.setAttribute("aria-label", `Act ${i}: ${a.dataset.title}`);
    b.addEventListener("click", () => { if (i <= maxReached) go(i); });
    $("#pips").appendChild(b);
  });
  function go(n) {
    n = clamp(n, 0, acts.length - 1);
    if (n === current) return;
    if (current >= 0 && onLeave[current]) onLeave[current]();
    acts.forEach((a, i) => a.classList.toggle("active", i === n));
    current = n;
    maxReached = Math.max(maxReached, n);
    save({ maxAct: maxReached });
    $$(".pip").forEach((p, i) => { p.classList.toggle("current", i === n); p.classList.toggle("done", i <= maxReached && i !== n); });
    $("#act-label").textContent = `${n} / ${acts.length - 1} · ${acts[n].dataset.title.toUpperCase()}`;
    $("#prev-act").disabled = n === 0;
    $("#skip-act").style.visibility = n === acts.length - 1 ? "hidden" : "visible";
    $("#skip-act").textContent = n < maxReached ? "NEXT ▶" : "SKIP ▶";
    $("#act-nav").style.display = n === 0 ? "none" : "";
    window.scrollTo({ top: 0 });
    if (!started.has(n)) { started.add(n); inits[n] && inits[n](); }
    onEnter[n] && onEnter[n]();
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-next]")) { SFX.click(); go(current + 1); } });
  $("#prev-act").addEventListener("click", () => { SFX.click(); go(current - 1); });
  $("#skip-act").addEventListener("click", () => { SFX.click(); go(current + 1); });
  const soundBtn = $("#sound-toggle");
  const syncSound = () => { soundBtn.textContent = SFX.muted ? "♪ OFF" : "♪ ON"; soundBtn.setAttribute("aria-pressed", String(!SFX.muted)); };
  soundBtn.addEventListener("click", () => { SFX.setMuted(!SFX.muted); syncSound(); SFX.click(); });
  syncSound();
  document.addEventListener("pointerdown", () => SFX.unlock(), { once: true });

  // rAF loop bound to an act: stops when the act is left or fn returns false
  function actLoop(actIndex, fn) {
    let last = performance.now(), alive = true;
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
  const reveal = (sel, scroll = true) => { const el = $(sel); if (!el || !el.hidden) return; el.hidden = false; if (scroll) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 250); };

  // ======================================================================
  //  SVG CIRCUIT HELPERS
  // ======================================================================
  const DEFS = `<defs><radialGradient id="bulbGlow"><stop offset="0" stop-color="#ffe066" stop-opacity=".75"/><stop offset="1" stop-color="#ffe066" stop-opacity="0"/></radialGradient></defs>`;
  const wire = (d, live) => `<path class="wire${live ? " live" : ""}" d="${d}"/>`;
  const flow = (d) => `<path class="flow" d="${d}"/>`;
  // a battery cell, + terminal at (x, y) on top and − at (x, y + 40) below. It pushes current out of +, around the loop, back into −.
  const battery = (x, y, label = true) => `<rect x="${x - 6}" y="${y}" width="12" height="6" fill="#c9a44a"/>
    <rect x="${x - 17}" y="${y + 6}" width="34" height="34" fill="#2a2450" stroke="#b58cff" stroke-width="3"/>
    <rect x="${x - 17}" y="${y + 6}" width="34" height="12" fill="#b58cff"/>
    <text x="${x}" y="${y + 17}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="13" fill="#0e0c1e">+</text>
    <text x="${x}" y="${y + 36}" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="15" fill="#c9ceff">−</text>
    ${label ? `<text class="label" x="${x + 26}" y="${y + 28}">BATTERY</text>` : ""}`;
  // a light bulb with its wires meeting it at (cx, cy − 28) and (cx, cy + 28)
  const bulb = (cx, cy, on, label = true) => `<circle class="glow${on ? " on" : ""}" cx="${cx}" cy="${cy - 6}" r="80"/>
    <circle class="glass${on ? " on" : ""}" cx="${cx}" cy="${cy - 6}" r="22"/>
    <path d="M${cx - 6} ${cy + 12} V${cy - 4} M${cx + 6} ${cy + 12} V${cy - 4} M${cx - 6} ${cy - 4} q6 -10 12 0" stroke="${on ? "#b8620f" : "#6a6490"}" stroke-width="2.5" fill="none"/>
    <rect x="${cx - 11}" y="${cy + 12}" width="22" height="16" fill="#8a92c0"/>
    <line x1="${cx - 11}" y1="${cy + 17}" x2="${cx + 11}" y2="${cy + 17}" stroke="#5f5a8f" stroke-width="2"/><line x1="${cx - 11}" y1="${cy + 23}" x2="${cx + 11}" y2="${cy + 23}" stroke="#5f5a8f" stroke-width="2"/>
    ${label ? `<text class="label" x="${cx + 28}" y="${cy + 4}">BULB</text>` : ""}`;
  // a knife switch in a horizontal wire from x to x + 60 at height y
  const knife = (x, y, closed, id, label) => `<g class="sw" data-sw="${id}">
    <rect x="${x - 10}" y="${y - 44}" width="80" height="60" fill="transparent"/>
    <line class="lever" x1="${x}" y1="${y}" x2="${x + 60}" y2="${y}" style="transform-origin:${x}px ${y}px;transform:rotate(${closed ? 0 : -32}deg)"/>
    <circle class="pivot" cx="${x}" cy="${y}" r="7"/><circle class="pivot" cx="${x + 60}" cy="${y}" r="5" style="fill:#5f5a8f"/>
    ${label ? `<text class="label big" x="${x + 22}" y="${y - 40}">${label}</text>` : ""}</g>`;

  // ======================================================================
  //  ACT 0 · HOOK
  // ======================================================================
  inits[0] = () => {
    const lines = $$("#hook-lines .hl"), cta = $("#hook-cta"), timers = [];
    const showAll = () => { timers.forEach(clearTimeout); lines.forEach((l) => l.classList.add("show")); cta.classList.add("show"); };
    [300, 1700, 3100, 4600, 6200].forEach((ms, i) => timers.push(setTimeout(() => { lines[i].classList.add("show"); SFX.reveal(); }, ms)));
    timers.push(setTimeout(() => cta.classList.add("show"), 7400));
    $('.act[data-act="0"]').addEventListener("click", (e) => { if (!e.target.closest("button")) showAll(); });
  };
  onEnter[0] = () => {
    // a field of tiny switches, flickering on and off
    const cv = $("#hook-canvas"), g = cv.getContext("2d");
    actLoop(0, (dt, now) => {
      const t = now / 1000;
      g.fillStyle = "#07060f"; g.fillRect(0, 0, 96, 54);
      for (let y = 1; y < 54; y += 3) for (let x = 1; x < 96; x += 4) {
        const h = (x * 73856093) ^ (y * 19349663);
        const on = Math.sin(t * (1.5 + (Math.abs(h) % 7) * 0.4) + (h % 100)) > 0.3;
        g.fillStyle = on ? "#3df5c4" : "#1f1b3d";
        g.fillRect(x, y, 2, 1);
        g.fillStyle = on ? "#b8fff0" : "#2d2856";
        g.fillRect(on ? x + 1 : x, y - 1, 1, 1);
      }
    });
  };

  // ======================================================================
  //  ACT 1 · WHAT IS ELECTRICITY?
  // ======================================================================
  inits[1] = () => {
    const cv = $("#loop"), g = cv.getContext("2d");
    const L = 110, R = 650, T = 70, B = 290, BT = 150, BB = 210, SW0 = 350, SW1 = 410, SEG0 = 300, SEG1 = 460;
    let volts = 0, closed = true, mat = "copper", meter = 0;
    const tried = new Set(), done = { pulse: false, volt: false, open: false, mats: false };
    // ---- the push demo: a long wire with a switch at one end and a bulb at the other
    const pc = $("#pulse"), pg = pc.getContext("2d");
    const X0 = 130, X1 = 650, WY = 100, NE = 32, SPN = (X1 - X0) / NE, FRONT = 330, DRIFT = 3;
    let pClosed = false, pT0 = 0;
    $("#pulse-btn").addEventListener("click", () => {
      pClosed = !pClosed; pT0 = performance.now(); SFX.click();
      $("#pulse-btn").textContent = pClosed ? "OPEN THE SWITCH" : "CLOSE THE SWITCH";
      if (pClosed) setTimeout(() => { if (pClosed) task("pulse"); }, 2400);
    });
    function drawPulse(now) {
      const t = now / 1000, el = pClosed ? (now - pT0) / 1000 : 0, front = pClosed ? Math.min(X1, X0 + el * FRONT) : X0;
      pg.fillStyle = "#0e0c1e"; pg.fillRect(0, 0, 760, 210);
      // battery and switch on the left
      pg.fillStyle = "#2a2450"; pg.strokeStyle = "#b58cff"; pg.lineWidth = 3; pg.fillRect(30, WY - 30, 40, 60); pg.strokeRect(30, WY - 30, 40, 60);
      pg.fillStyle = "#b58cff"; pg.fillRect(30, WY - 30, 40, 14); pg.fillStyle = "#0e0c1e"; pg.font = "bold 13px JetBrains Mono"; pg.textAlign = "center"; pg.fillText("+", 50, WY - 19);
      pg.strokeStyle = pClosed ? "#c9a44a" : "#5f5a8f"; pg.lineWidth = 10; pg.beginPath(); pg.moveTo(70, WY); pg.lineTo(84, WY); pg.moveTo(124, WY); pg.lineTo(X1, WY); pg.stroke();
      pg.strokeStyle = "#ffab40"; pg.lineWidth = 6; pg.lineCap = "round"; pg.beginPath(); pg.moveTo(84, WY); pclosedLever(pg, pClosed); pg.stroke(); pg.lineCap = "butt";
      // the electrons: everyone behind the push drifts a tiny bit; the push itself glows
      for (let i = 0; i < NE; i++) {
        const bx = X0 + (i + 0.5) * SPN, behind = front - bx;
        const disp = behind > 0 ? Math.min(SPN * 0.6, ((behind / FRONT) * DRIFT)) : 0;
        const inWave = pClosed && behind > 0 && behind < 46 && front < X1;
        const x = bx + disp + Math.sin(t * 9 + i) * 1.2, y = WY + Math.cos(t * 7 + i * 1.7) * 2;
        pg.fillStyle = i === 2 ? "#ff4d8d" : inWave ? "#ffe066" : "#7bdcff";
        pg.beginPath(); pg.arc(x, y, inWave ? 6 : 4.5, 0, 7); pg.fill();
        if (i === 2) { pg.fillStyle = "#ff4d8d"; pg.font = "bold 12px Silkscreen"; pg.fillText("MARKED ELECTRON", x, WY + 34); pg.fillRect(bx, WY + 14, Math.max(1, disp), 2); }
      }
      if (pClosed && front < X1) { const gw = pg.createLinearGradient(front - 60, 0, front, 0); gw.addColorStop(0, "rgba(255,224,102,0)"); gw.addColorStop(1, "rgba(255,224,102,.35)"); pg.fillStyle = gw; pg.fillRect(front - 60, WY - 18, 60, 36); }
      // the bulb at the far end
      const lit = pClosed && front >= X1;
      if (lit) { const gl = pg.createRadialGradient(X1 + 40, WY, 4, X1 + 40, WY, 80); gl.addColorStop(0, "rgba(255,224,102,.7)"); gl.addColorStop(1, "rgba(255,224,102,0)"); pg.fillStyle = gl; pg.fillRect(X1 - 40, WY - 80, 160, 160); }
      pg.fillStyle = lit ? "#ffe066" : "#1f1b3d"; pg.beginPath(); pg.arc(X1 + 40, WY, 22, 0, 7); pg.fill(); pg.strokeStyle = "#9a95c4"; pg.lineWidth = 3; pg.stroke();
      pg.fillStyle = "#9a95c4"; pg.font = "bold 13px Silkscreen"; pg.fillText("BULB", X1 + 40, WY + 44); pg.fillText("BATTERY", 50, WY + 50); pg.fillText("SWITCH", 104, WY - 30);
      // the two speeds
      pg.font = "bold 14px JetBrains Mono"; pg.textAlign = "left";
      pg.fillStyle = "#ffe066"; pg.fillText("the push: ~2/3 the speed of light", 130, 182);
      pg.fillStyle = "#ff4d8d"; pg.fillText("each electron: ~0.1 mm per second", 430, 182);
      pg.fillStyle = "#5f5a8f"; pg.font = "12px JetBrains Mono"; pg.fillText("both slowed down enormously, and the electron is still drawn far too fast", 130, 202);
      pg.textAlign = "start";
      $("#pulse-state").textContent = !pClosed ? "A long copper wire, already packed with free electrons. One of them is marked."
        : !lit ? "The push (gold) races along the wire, each electron shoving the next. The marked electron has barely moved."
        : "The bulb lit the moment the push arrived. The marked electron has crept forward a hair's width. Same in real life: the push is trillions of times faster than the electrons.";
    }
    function pclosedLever(g2, closed) { closed ? g2.lineTo(124, WY) : g2.lineTo(84 + 40 * Math.cos(-0.6), WY + 40 * Math.sin(-0.6)); }
    // the route electrons drift along: out of the battery's − end (bottom), around the loop, into + (top)
    const pts = [[L, BB], [L, B], [R, B], [R, T], [L, T], [L, BT]];
    const segs = []; let P = 0;
    for (let i = 0; i < pts.length - 1; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[i + 1], len = Math.hypot(x2 - x1, y2 - y1); segs.push({ x1, y1, x2, y2, len, s: P }); P += len; }
    const at = (u) => { u = ((u % P) + P) % P; for (const sg of segs) if (u <= sg.s + sg.len) { const k = (u - sg.s) / sg.len; return [lerp(sg.x1, sg.x2, k), lerp(sg.y1, sg.y2, k)]; } return pts[0]; };
    const N = 70, els = Array.from({ length: N }, (_, i) => ({ u: (i / N) * P, j: i * 2.4 }));
    const K = { copper: 16, silicon: 0.7, glass: 0 }; // how easily each material lets them drift (px/s per volt)
    const speed = () => (closed ? volts * K[mat] : 0);
    const setSw = () => { $("#loop-sw").textContent = closed ? "SWITCH: CLOSED" : "SWITCH: OPEN"; };
    const flip = () => { closed = !closed; SFX.click(); setSw(); };
    $("#loop-sw").addEventListener("click", flip);
    cv.addEventListener("click", (e) => { const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 760, y = ((e.clientY - r.top) / r.height) * 360; if (x > SW0 - 20 && x < SW1 + 20 && Math.abs(y - T) < 40) flip(); });
    $("#volt").addEventListener("input", (e) => { volts = +e.target.value; $("#volt-val").textContent = volts; });
    $$("[data-mat]").forEach((b) => b.addEventListener("click", () => { mat = b.dataset.mat; tried.add(mat); SFX.click(); $$("[data-mat]").forEach((x) => x.classList.toggle("on", x === b)); }));
    function task(name) {
      if (done[name]) return;
      done[name] = true; SFX.success();
      $(`[data-task="${name}"]`).classList.add("done");
      if (done.pulse && done.volt && done.open && done.mats) { save({ loop: true }); reveal("#loop-explain"); setTimeout(() => reveal("#loop-next", false), 500); }
    }
    if (saved.loop) { Object.keys(done).forEach((k) => { done[k] = true; $(`[data-task="${k}"]`).classList.add("done"); }); $("#loop-explain").hidden = false; $("#loop-next").hidden = false; }
    onEnter[1] = () => actLoop(1, (dt, now) => {
      drawPulse(now);
      const t = now / 1000, v = speed();
      els.forEach((el) => { el.u += v * dt; });
      meter += (v / (9 * K.copper) - meter) * clamp(dt * 5, 0, 1);
      if (volts >= 4 && closed && mat === "copper") task("volt");
      if (done.volt && !closed && volts >= 4) task("open");
      if (tried.has("glass") && tried.has("silicon")) task("mats");
      // ---- draw
      g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, 760, 360);
      const live = v > 0;
      g.strokeStyle = live ? "#c9a44a" : "#5f5a8f"; g.lineWidth = 12; g.lineJoin = "miter";
      g.beginPath(); g.moveTo(L, BB); g.lineTo(L, B); g.lineTo(SEG0, B); g.moveTo(SEG1, B); g.lineTo(R, B); g.lineTo(R, T); g.lineTo(SW1, T); g.moveTo(SW0, T); g.lineTo(L, T); g.lineTo(L, BT); g.stroke();
      // the swappable piece
      const mc = { copper: "#c87533", glass: "rgba(160,200,255,.35)", silicon: "#6a6f8a" }[mat];
      g.fillStyle = mc; g.fillRect(SEG0, B - 9, SEG1 - SEG0, 18);
      g.fillStyle = "#ecebff"; g.font = "bold 15px Silkscreen"; g.textAlign = "center"; g.fillText(mat.toUpperCase(), (SEG0 + SEG1) / 2, B + 34);
      // switch
      g.strokeStyle = "#ffab40"; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(SW0, T);
      closed ? g.lineTo(SW1, T) : g.lineTo(SW0 + 52 * Math.cos(-0.6), T + 52 * Math.sin(-0.6)); g.stroke(); g.lineCap = "butt";
      g.fillStyle = "#ffab40"; g.beginPath(); g.arc(SW0, T, 7, 0, 7); g.fill(); g.fillStyle = "#5f5a8f"; g.beginPath(); g.arc(SW1, T, 6, 0, 7); g.fill();
      g.fillStyle = "#9a95c4"; g.font = "bold 14px Silkscreen"; g.fillText("SWITCH", (SW0 + SW1) / 2, T - 26);
      // electrons
      els.forEach((el) => {
        const [x, y] = at(el.u);
        const inPiece = y > B - 12 && x > SEG0 && x < SEG1;
        if (inPiece && mat === "glass") return;
        if (inPiece && mat === "silicon" && el.j % 7 > 1.2) return; // only a very few free electrons in silicon
        g.fillStyle = "#7bdcff"; g.beginPath(); g.arc(x + Math.sin(t * 9 + el.j) * 1.5, y + Math.cos(t * 8 + el.j) * 1.5, 4.2, 0, 7); g.fill();
      });
      // battery
      g.fillStyle = "#c9a44a"; g.fillRect(L - 8, BT - 8, 16, 8);
      g.fillStyle = "#2a2450"; g.strokeStyle = "#b58cff"; g.lineWidth = 3; g.fillRect(L - 24, BT, 48, BB - BT); g.strokeRect(L - 24, BT, 48, BB - BT);
      g.fillStyle = "#b58cff"; g.fillRect(L - 24, BT, 48, 18);
      g.fillStyle = "#0e0c1e"; g.font = "bold 16px JetBrains Mono"; g.fillText("+", L, BT + 14); g.fillStyle = "#c9ceff"; g.fillText("−", L, BB - 10);
      g.textAlign = "left"; g.fillStyle = "#ecebff"; g.font = "bold 15px Silkscreen"; g.fillText("BATTERY", L + 34, 176); g.fillStyle = "#ffe066"; g.font = "bold 18px JetBrains Mono"; g.fillText(`${volts} V`, L + 34, 200);
      g.fillStyle = "#9a95c4"; g.font = "13px JetBrains Mono"; g.fillText(`= ${volts} joules for every coulomb`, L + 34, 220); g.fillText("that goes around", L + 34, 236);
      // the charge the battery has separated: extra electrons at −, missing ones at +
      const piles = Math.round(volts * 1.4);
      for (let i = 0; i < piles; i++) { const a = i * 2.4; g.fillStyle = "#7bdcff"; g.beginPath(); g.arc(L - 34 - (i % 4) * 9, BB - 6 + Math.floor(i / 4) * 9 + Math.sin(a) * 2, 3.5, 0, 7); g.fill(); }
      for (let i = 0; i < piles; i++) { g.strokeStyle = "#ff4d8d"; g.lineWidth = 2; g.beginPath(); g.arc(L - 34 - (i % 4) * 9, BT + 6 - Math.floor(i / 4) * 9, 3.5, 0, 7); g.stroke(); }
      if (volts > 0) { g.fillStyle = "#9a95c4"; g.font = "11px JetBrains Mono"; g.textAlign = "right"; g.fillText("missing e⁻", L - 26, BT - 22); g.fillText("extra e⁻", L - 26, BB + 34); g.textAlign = "left"; }
      // the push on every free electron, all along the wire
      if (v > 0) {
        const size = 4 + volts * 1.3;
        for (let u = 40; u < P; u += 130) {
          const [ax, ay] = at(u), [bx2, by2] = at(u + 2), ang = Math.atan2(by2 - ay, bx2 - ax);
          g.save(); g.translate(ax, ay - (Math.abs(Math.sin(ang)) > 0.5 ? 0 : 20)); if (Math.abs(Math.sin(ang)) > 0.5) g.translate(Math.cos(ang) > -2 ? 22 : 0, 0); g.rotate(ang);
          g.strokeStyle = "rgba(255,224,102,.8)"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-size, -size * 0.6); g.lineTo(0, 0); g.lineTo(-size, size * 0.6); g.stroke(); g.restore();
        }
      }
      // bulb
      const glow = clamp(meter, 0, 1);
      if (glow > 0.01) { const gl = g.createRadialGradient(R, 176, 4, R, 176, 110); gl.addColorStop(0, `rgba(255,224,102,${0.7 * glow})`); gl.addColorStop(1, "rgba(255,224,102,0)"); g.fillStyle = gl; g.fillRect(R - 120, 60, 240, 240); }
      g.fillStyle = glow > 0.01 ? `rgb(255,${190 + 34 * glow | 0},${70 + 40 * glow | 0})` : "#1f1b3d"; g.beginPath(); g.arc(R, 172, 26, 0, 7); g.fill();
      g.strokeStyle = "#9a95c4"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "#8a92c0"; g.fillRect(R - 12, 196, 24, 18);
      // electrons crashing into the filament's atoms hand over their energy as heat and light
      for (let i = 0; i < Math.floor(glow * 14); i++) { const a = Math.random() * 6.28, rr = Math.random() * 18; g.fillStyle = "#ffffff"; g.fillRect(R + Math.cos(a) * rr, 172 + Math.sin(a) * rr, 2, 2); }
      g.fillStyle = "#ecebff"; g.font = "bold 15px Silkscreen"; g.textAlign = "right"; g.fillText("BULB", R - 40, 178);
      // current meter
      g.textAlign = "left"; g.fillStyle = "#9a95c4"; g.font = "bold 13px Silkscreen"; g.fillText("CURRENT", 470, 128);
      g.fillStyle = "#1f1b3d"; g.fillRect(470, 136, 130, 14); g.fillStyle = "#3df5c4"; g.fillRect(470, 136, 130 * clamp(meter, 0, 1), 14);
      g.textAlign = "start";
    });
  };

  // ======================================================================
  //  ACT 2 · SWITCHES DECIDE: build the circuit yourself
  // ======================================================================
  const LEVELS = [
    { tag: "LEVEL 1 · CLOSE THE LOOP", tokens: [], cases: [[0, 0]], target: () => true,
      brief: 'Current only flows around a <b>closed loop</b>: out of the battery, through the bulb, and back. <b>Click the dotted links</b> to lay wire from <b class="gold">IN</b> to <b class="gold">OUT</b>.' },
    { tag: "LEVEL 2 · A SWITCH", tokens: ["A"], cases: [[0, 0], [1, 0]], target: (a) => a,
      brief: '<b>Drag switch A</b> onto your circuit so that A turns the bulb on and off. Tap it to flip it. Then press <b>TEST</b>.' },
    { tag: "PUZZLE · AND", tokens: ["A", "B"], cases: [[0, 0], [1, 0], [0, 1], [1, 1]], target: (a, b) => a && b,
      brief: 'You have switch <b class="gold">A</b> and switch <b class="gold">B</b>. Where do you put them so the bulb lights <b>only when A AND B are both on</b>? You can add and remove wire too.' },
    { tag: "PUZZLE · OR", tokens: ["A", "B"], cases: [[0, 0], [1, 0], [0, 1], [1, 1]], target: (a, b) => a || b,
      brief: 'Now rebuild it so the bulb lights when <b>A OR B</b> is on (or both). Hint: the current needs more than one way through.' },
  ];
  const COLS = 5, ROWS = 3, GX = 190, GY = 100, GS = 80; // grid of connection points
  const node = (c, r) => [GX + c * GS, GY + r * GS];
  const IN = [0, 1], OUT = [COLS - 1, 1];
  const EDGES = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (c < COLS - 1) EDGES.push({ a: [c, r], b: [c + 1, r] });
    if (r < ROWS - 1) EDGES.push({ a: [c, r], b: [c, r + 1] });
  }
  const key = (n) => n[0] + "," + n[1];
  const distSeg = (px, py, x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1, k = clamp(((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy), 0, 1); return Math.hypot(px - (x1 + k * dx), py - (y1 + k * dy)); };
  inits[2] = () => {
    const svg = $("#circuit");
    let level = 0, A = false, B = false, testing = false, hover = -1, drag = null;
    let parts = EDGES.map(() => null);   // null | "wire" | "A" | "B"
    const under = {};                     // what a switch was placed on top of, restored when it's moved away
    const where = (t) => parts.indexOf(t);
    const passable = (k) => parts[k] === "wire" || (parts[k] === "A" && A) || (parts[k] === "B" && B);
    // Every link that lies on some path from IN to OUT carries current, so collect all of them (with direction).
    function liveLinks() {
      const live = new Map(), seen = new Set([key(IN)]); let found = 0;
      (function dfs(n, path) {
        if (found > 4000) return;
        if (key(n) === key(OUT)) { found++; path.forEach(([k, from, to]) => { if (!live.has(k)) live.set(k, [from, to]); }); return; }
        EDGES.forEach((e, k) => {
          if (!passable(k)) return;
          const m = key(e.a) === key(n) ? e.b : key(e.b) === key(n) ? e.a : null;
          if (!m || seen.has(key(m))) return;
          seen.add(key(m)); path.push([k, n, m]); dfs(m, path); path.pop(); seen.delete(key(m));
        });
      })(IN, []);
      return live;
    }
    function draw() {
      const live = liveLinks(), on = live.size > 0;
      const [ix, iy] = node(...IN), [ox, oy] = node(...OUT);
      let s2 = DEFS;
      s2 += wire(`M70 200 V${iy} H${ix}`, on) + wire(`M${ox} ${oy} H560 V${oy + 12}`, on) + wire(`M560 ${oy + 68} V320 H70 V240`, on);
      s2 += battery(70, 200) + bulb(560, oy + 40, on);
      EDGES.forEach((e, k) => {
        const [x1, y1] = node(...e.a), [x2, y2] = node(...e.b), p = parts[k], isLive = live.has(k);
        s2 += `<g class="edge" data-edge="${k}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="30"/>`;
        if (k === hover) s2 += `<line class="drop-hint" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        if (!p) s2 += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3d3772" stroke-width="3" stroke-dasharray="4 8"/>`;
        else if (p === "wire") s2 += `<line class="wire${isLive ? " live" : ""}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        s2 += `</g>`;
        if (p === "A" || p === "B") {
          const closed = p === "A" ? A : B, vert = x1 === x2;
          const mx = lerp(x1, x2, 0.25), my = lerp(y1, y2, 0.25), ex = lerp(x1, x2, 0.75), ey = lerp(y1, y2, 0.75);
          s2 += `<g class="placed-sw" data-placed="${p}" data-at="${k}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="34"/>
            <line class="wire${isLive ? " live" : ""}" x1="${x1}" y1="${y1}" x2="${mx}" y2="${my}"/><line class="wire${isLive ? " live" : ""}" x1="${ex}" y1="${ey}" x2="${x2}" y2="${y2}"/>
            <line class="lever" x1="${mx}" y1="${my}" x2="${ex}" y2="${ey}" transform="rotate(${closed ? 0 : -32} ${mx} ${my})"/>
            <circle class="pivot" cx="${mx}" cy="${my}" r="6"/><circle cx="${ex}" cy="${ey}" r="4" fill="#5f5a8f"/>
            <text class="label big" x="${(x1 + x2) / 2 + (vert ? 14 : -7)}" y="${(y1 + y2) / 2 + (vert ? 6 : -22)}" style="fill:${closed ? "#ffe066" : "#ecebff"}">${p}</text></g>`;
        }
      });
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const [x, y] = node(c, r); s2 += `<circle cx="${x}" cy="${y}" r="5" fill="#9a95c4" pointer-events="none"/>`; }
      // the holding slots for the switches, at the top of the picture
      const toks = LEVELS[level].tokens;
      if (toks.length) s2 += `<text class="label" x="${255}" y="-58">DRAG A SWITCH ONTO A LINK</text>`;
      toks.forEach((t, i) => {
        const x = 250 + i * 120, y = -32;
        s2 += `<rect class="tray" x="${x}" y="${y - 24}" width="100" height="44"/>`;
        if (where(t) < 0 && !(drag && drag.moved && drag.token === t)) s2 += swGlyph(t, x + 20, y, false, `class="tray-sw" data-tray="${t}"`);
      });
      if (drag && drag.moved && drag.p) s2 += swGlyph(drag.token, drag.p.x - 30, drag.p.y, false, 'class="drag-sw"');
      s2 += `<text class="label big" x="${ix - 20}" y="${iy - 18}" style="fill:#ffe066">IN</text><text class="label big" x="${ox - 22}" y="${oy - 18}" style="fill:#ffe066">OUT</text>`;
      if (on) {
        s2 += flow(`M70 200 V${iy} H${ix}`) + flow(`M${ox} ${oy} H560 V320 H70 V240`);
        live.forEach(([from, to]) => { s2 += flow(`M${node(...from).join(" ")} L${node(...to).join(" ")}`); });
      }
      svg.innerHTML = s2;

      if (level === 0 && on && $("#c-next").hidden) { SFX.success(); $("#c-next").hidden = false; }
    }
    const removeSwitch = (t) => { const k = where(t); if (k >= 0) { parts[k] = under[k] || null; delete under[k]; } };
    const placeSwitch = (t, k) => { removeSwitch(t); if (parts[k] === "A" || parts[k] === "B") removeSwitch(parts[k]); under[k] = parts[k]; parts[k] = t; };
    // a switch drawn on its own (tray, or following the pointer while dragging)
    function swGlyph(t, x, y, closed, attrs) {
      return `<g ${attrs}><rect x="${x - 10}" y="${y - 22}" width="80" height="40" fill="transparent"/>
        <line class="lever" x1="${x}" y1="${y}" x2="${x + 60}" y2="${y}" transform="rotate(${closed ? 0 : -32} ${x} ${y})"/>
        <circle class="pivot" cx="${x}" cy="${y}" r="6"/><circle cx="${x + 60}" cy="${y}" r="4" fill="#5f5a8f"/>
        <text class="label big" x="${x + 64}" y="${y - 6}" style="fill:#ffe066">${t}</text></g>`;
    }
    function loadLevel(i) {
      level = i; A = B = false;
      const lv = LEVELS[i];
      $("#c-brief").innerHTML = lv.brief; $("#c-tag").textContent = lv.tag;
      ["A", "B"].forEach((t) => { if (!lv.tokens.includes(t)) removeSwitch(t); });
      if (i >= 2) { removeSwitch("A"); removeSwitch("B"); } // each puzzle starts with the switches back in the tray
      $("#c-help").textContent = lv.tokens.length ? "Click a dotted link to lay wire, click it again to remove it. Drag a switch from the top onto a link; tap a placed switch to flip it; drag it back to put it away." : "Click a dotted link to lay a piece of wire. Click it again to remove it.";
      const n = lv.cases.length;
      $("#c-test").textContent = n === 2 ? "▶ TEST BOTH CASES" : `▶ TEST ALL ${n} CASES`;
      $("#c-test").hidden = i === 0; $("#c-next").hidden = true; $("#truth").hidden = true;
      draw();
    }
    // ---- wire tool: click links
    svg.addEventListener("click", (e) => {
      if (testing || e.target.closest("[data-placed]")) return;
      const ed = e.target.closest("[data-edge]");
      if (!ed) return;
      const k = +ed.dataset.edge;
      if (parts[k] === "A" || parts[k] === "B") return;
      parts[k] = parts[k] === "wire" ? null : "wire";
      parts[k] ? SFX.place() : SFX.remove();
      draw();
    });

    // ---- switches: drag from the tray or from the circuit; a tap on a placed switch flips it
    const svgPoint = (cx, cy) => { const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM().inverse()); };
    const nearestEdge = (cx, cy) => { const p = svgPoint(cx, cy); let best = -1, bd = 28; EDGES.forEach((e, k) => { const d = distSeg(p.x, p.y, ...node(...e.a), ...node(...e.b)); if (d < bd) { bd = d; best = k; } }); return best; };
    const startDrag = (token, e) => { if (testing) return; e.preventDefault(); drag = { token, sx: e.clientX, sy: e.clientY, moved: false, ghost: null, fromCircuit: where(token) >= 0 }; };
    svg.addEventListener("pointerdown", (e) => { const ps = e.target.closest("[data-placed], [data-tray]"); if (ps) startDrag(ps.dataset.placed || ps.dataset.tray, e); });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
      if (drag.moved) { drag.p = svgPoint(e.clientX, e.clientY); hover = nearestEdge(e.clientX, e.clientY); draw(); }
    });
    window.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const d = drag; drag = null;
      hover = -1;
      if (!d.moved) { // a tap: flip a placed switch
        if (d.fromCircuit) { if (d.token === "A") A = !A; else B = !B; SFX.click(); }
        draw(); return;
      }
      const k = nearestEdge(e.clientX, e.clientY);
      if (k >= 0) { placeSwitch(d.token, k); SFX.place(); }
      else if (d.fromCircuit) { removeSwitch(d.token); SFX.remove(); } // dropped outside: back to the tray
      draw();
    });
    $("#c-clear").addEventListener("click", () => { if (testing) return; parts = parts.map(() => null); Object.keys(under).forEach((k) => delete under[k]); SFX.remove(); draw(); });
    $("#c-next").addEventListener("click", () => { SFX.click(); loadLevel(level + 1); });
    $("#c-test").addEventListener("click", async () => {
      if (testing) return;
      const lv = LEVELS[level], box = $("#truth"), missing = lv.tokens.filter((t) => where(t) < 0);
      box.hidden = false;
      if (missing.length) { box.innerHTML = `<p class="muted tiny">Drag switch ${missing.join(" and ")} onto your circuit first.</p>`; SFX.deny(); return; }
      testing = true;
      box.innerHTML = lv.cases.map(([a, b]) => `<div class="case"><span>A ${a ? "on" : "off"}${lv.tokens.includes("B") ? ` · B ${b ? "on" : "off"}` : ""}</span><span class="res">…</span></div>`).join("");
      let ok = true;
      for (let i = 0; i < lv.cases.length; i++) {
        A = !!lv.cases[i][0]; B = !!lv.cases[i][1]; draw();
        const el = box.children[i]; el.classList.add("run");
        await new Promise((r) => setTimeout(r, 650));
        const want = lv.target(A, B), got = liveLinks().size > 0;
        el.classList.remove("run"); el.classList.add(want === got ? "ok" : "bad");
        el.querySelector(".res").innerHTML = `bulb ${got ? "<b>ON</b>" : "off"} ${want === got ? "✓" : "✗ should be " + (want ? "on" : "off")}`;
        want === got ? SFX.tick() : SFX.deny();
        ok = ok && want === got;
      }
      testing = false;
      if (ok) {
        SFX.success(); save({ ["solved" + level]: true });
        if (level < LEVELS.length - 1) { $("#c-next").hidden = false; $("#c-next").textContent = level === 1 ? "▶ FIRST PUZZLE" : "▶ NEXT PUZZLE"; }
        else reveal("#c-done");
      } else {
        const hint = document.createElement("p"); hint.className = "muted tiny";
        hint.textContent = level === 2 ? "Not quite. Can the current reach OUT without passing through both switches?"
          : level === 3 ? "Not quite. Can each switch, on its own, give the current a way through?" : "Not quite. Is switch A on the only way from IN to OUT?";
        box.appendChild(hint);
      }
    });
    loadLevel(0);
  };

  // ======================================================================
  //  ACT 3 · THE RELAY
  // ======================================================================
  inits[3] = () => {
    const svg = $("#relay");
    let pressed = false, energized = false, timer = null;
    function draw() {
      const closed = energized;
      let s = DEFS;
      // control circuit (left): battery 1, push button, coil
      s += battery(40, 170, false);
      s += wire("M40 170 V110 H120 V165 H150", pressed) + wire("M150 190 H120 V290", pressed) + wire("M60 290 H40 V210", pressed);
      // the switch that powers the magnet
      s += knife(60, 290, pressed, "relay") + `<text class="label" x="50" y="325">SWITCH</text>`;
      // the coil (an electromagnet)
      s += `<ellipse class="field${energized ? " on" : ""}" cx="200" cy="178" rx="92" ry="52"/><ellipse class="field${energized ? " on" : ""}" cx="200" cy="178" rx="120" ry="72"/>`;
      s += `<rect class="coil${energized ? " on" : ""}" x="150" y="150" width="100" height="56"/>`;
      for (let x = 158; x < 248; x += 10) s += `<line x1="${x}" y1="150" x2="${x + 6}" y2="206" stroke="${energized ? "#e0c8ff" : "#6a5aa0"}" stroke-width="3"/>`;
      s += `<text class="label" x="142" y="272">MAGNET (COIL)</text>`;
      // the lever (armature): pivots at the bottom, its top swings left onto the contact
      s += `<line class="arm" x1="292" y1="270" x2="292" y2="104" style="transform-origin:292px 270px;transform:rotate(${closed ? -7 : 0}deg)"/><circle class="pivot" cx="292" cy="270" r="8"/>`;
      s += `<text class="label" x="306" y="140">LEVER</text><path d="M300 250 q12 -8 0 -16 q-12 -8 0 -16" stroke="#5f5a8f" stroke-width="3" fill="none"/>`;
      // output circuit (right): fixed contact, bulb, battery 2
      s += wire("M262 106 H250 V60 H442", closed) + wire("M498 60 H570 V170", closed) + wire("M570 210 V300 H292 V270", closed);
      s += `<rect x="252" y="100" width="18" height="10" fill="${closed ? "#c9a44a" : "#8a82a8"}"/>`;
      s += battery(570, 170, false) + bulb(470, 60, closed, false);
      if (pressed) s += flow("M40 170 V110 H120 V165 H150 M150 190 H120 V290 H40 V210");
      if (closed) s += flow("M570 170 V60 H250 V106 H270 M292 150 V300 H570 V210");
      svg.innerHTML = s;
      $("#relay-state").textContent = !pressed ? "The left circuit powers the magnet. The right circuit is switched by it."
        : closed ? "Current in the coil makes a magnet, which pulls the lever shut. The second bulb lights, with no finger on its switch."
        : "…";
    }
    const toggle = () => {
      pressed = !pressed; SFX.click(); clearTimeout(timer);
      if (pressed) timer = setTimeout(() => { energized = true; SFX.place(); draw(); save({ relay: true }); reveal("#chain-panel", false); }, 140);
      else { if (energized) SFX.remove(); energized = false; }
      draw();
    };
    $("#relay-btn").addEventListener("click", toggle);
    svg.addEventListener("click", (e) => { if (e.target.closest('[data-sw="relay"]')) toggle(); });
    if (saved.relay) $("#chain-panel").hidden = false;
    draw();

    // ---- the chain: each relay's contact powers the next relay's coil
    const cv = $("#chain"), g = cv.getContext("2d"), N = 8;
    let states = new Array(N).fill(0), running = false;
    function drawChain(t) {
      g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, 320, 70);
      for (let i = 0; i < N; i++) {
        const x = 10 + i * 38, on = states[i];
        g.fillStyle = on ? "#c9a44a" : "#3d3772"; g.fillRect(x - 8, 44, 38, 2);        // wire to the next relay
        g.fillStyle = on ? "#4a2a8a" : "#2a2450"; g.fillRect(x, 30, 16, 12);              // coil
        g.fillStyle = on ? "#e0c8ff" : "#6a5aa0"; for (let k = 0; k < 16; k += 3) g.fillRect(x + k, 30, 1, 12);
        g.fillStyle = "#c9ceff"; g.fillRect(x + 20, on ? 22 : 18, 1, on ? 20 : 24);         // lever
        g.fillRect(x + (on ? 17 : 20), on ? 22 : 18, on ? 4 : 1, 1);
        g.fillStyle = on ? "#ffe066" : "#2d2856"; g.fillRect(x + 4, 10, 8, 8);             // indicator lamp
        if (on) { g.fillStyle = "rgba(255,224,102,.25)"; g.fillRect(x + 1, 7, 14, 14); }
      }
    }
    drawChain(0);
    $("#chain-btn").addEventListener("click", async () => {
      if (running) return;
      running = true;
      states.fill(0); drawChain();
      for (let i = 0; i < N; i++) {
        await new Promise((r) => setTimeout(r, 250));
        states[i] = 1; drawChain();
        SFX.click(); SFX.tick();
      }
      await new Promise((r) => setTimeout(r, 900));
      states.fill(0); drawChain();
      running = false;
      save({ chain: true });
      reveal("#relay-next");
    });
  };

  // ======================================================================
  //  ACT 4 · THE VACUUM TUBE (then the race)
  // ======================================================================
  function initTube() {
    const cv = $("#tube"), g = cv.getContext("2d");
    let gridPos = false, flips = 0, ps = [], rate = 0, hits = 0;
    const setBtn = () => {
      // gridPos means "on": the grid at 0 V. Real tubes switch between negative (off) and about 0 V (on).
      $("#grid-btn").textContent = gridPos ? "GRID: 0 V" : "GRID: NEGATIVE";
      $("#tube-state").innerHTML = gridPos
        ? "The grid is at <b>0 V</b>, the same as the filament: it stops pushing back, and the strongly positive plate pulls the electrons straight through the gaps in the mesh. Current flows: <b class='gpu'>ON</b>. (A positive grid would catch some electrons and waste current, so real tubes keep it at or below 0 V.)"
        : "The grid is at <b>−5 V</b>. That's tiny next to the plate's +100 V, but the grid sits right next to the filament, so its push wins there: like charges repel, and the electrons are turned back before they get going. No current: <b>OFF</b>.";
    };
    $("#grid-btn").addEventListener("click", () => {
      gridPos = !gridPos; flips++; SFX.click(); setBtn();
      if (flips >= 2) { save({ tube: true }); reveal("#race-panel"); }
    });
    if (saved.tube) $("#race-panel").hidden = false;
    setBtn();
    const CX = 330, PLATE = 74, GRID = 250, CATH = 292; // the grid sits close to the filament, far from the plate
    onEnter[4] = () => actLoop(4, (dt, now) => {
      const t = now / 1000;
      // electrons boil off the hot filament
      for (let i = 0; i < 60 * dt * 6; i++) ps.push({ x: CX - 50 + Math.random() * 100, y: CATH - 6, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 60 });
      ps.forEach((p) => {
        const nearGrid = p.y < GRID + 46 && p.y > GRID - 8;
        if (!gridPos && nearGrid) p.vy += 1500 * dt;       // repelled by a negative grid, right where the electrons start
        else p.vy -= 260 * dt;                              // pulled up toward the + plate
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.y <= PLATE + 8) { p.dead = true; hits++; }
        if (p.y > CATH + 4) p.dead = true;                  // fell back into the filament
      });
      ps = ps.filter((p) => !p.dead).slice(-500);
      rate += ((hits / Math.max(dt, 1e-3)) / 400 - rate) * clamp(dt * 4, 0, 1); hits = 0;
      const lit = clamp(rate, 0, 1);
      // ---- draw
      g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, 760, 360);
      // outside circuit: plate → bulb → battery → filament
      const wireC = lit > 0.05 ? "#c9a44a" : "#5f5a8f";
      g.strokeStyle = wireC; g.lineWidth = 6;
      g.beginPath(); g.moveTo(CX, PLATE); g.lineTo(CX, 14); g.lineTo(600, 14); g.lineTo(600, 100); g.moveTo(600, 156); g.lineTo(600, 230); g.moveTo(600, 280); g.lineTo(600, 346); g.lineTo(CX, 346); g.lineTo(CX, CATH + 6); g.stroke();
      if (lit > 0.01) { const gl = g.createRadialGradient(600, 126, 4, 600, 126, 100); gl.addColorStop(0, `rgba(255,224,102,${0.7 * lit})`); gl.addColorStop(1, "rgba(255,224,102,0)"); g.fillStyle = gl; g.fillRect(500, 26, 200, 200); }
      g.fillStyle = lit > 0.05 ? "#ffe066" : "#1f1b3d"; g.beginPath(); g.arc(600, 124, 24, 0, 7); g.fill(); g.strokeStyle = "#9a95c4"; g.lineWidth = 3; g.stroke();
      g.fillStyle = "#8a92c0"; g.fillRect(588, 146, 24, 12);
      g.fillStyle = "#2a2450"; g.strokeStyle = "#b58cff"; g.lineWidth = 3; g.fillRect(582, 230, 36, 50); g.strokeRect(582, 230, 36, 50); g.fillStyle = "#b58cff"; g.fillRect(582, 230, 36, 14);
      g.font = "bold 13px Silkscreen"; g.fillStyle = "#9a95c4"; g.fillText("BULB", 634, 130); g.fillText("BATTERY", 628, 262);
      // the tube: glass, plate, grid, filament
      g.fillStyle = "rgba(160,200,255,.06)"; g.strokeStyle = "#7a86b8"; g.lineWidth = 3;
      g.beginPath(); g.roundRect ? g.roundRect(CX - 110, 30, 220, 300, 60) : g.rect(CX - 110, 30, 220, 300); g.fill(); g.stroke();
      g.fillStyle = "#8c92be"; g.fillRect(CX - 70, PLATE - 8, 140, 16);
      g.fillStyle = gridPos ? "#8c92be" : "#7b86ff";
      for (let x = CX - 80; x <= CX + 80; x += 14) g.fillRect(x, GRID - 2, 8, 4);
      if (!gridPos) { g.fillStyle = "#ecebff"; g.font = "bold 14px JetBrains Mono"; for (let x = CX - 70; x <= CX + 70; x += 46) g.fillText("−", x - 4, GRID - 8); }

      const heat = 0.8 + 0.2 * Math.sin(t * 13);
      const fg = g.createRadialGradient(CX, CATH, 4, CX, CATH, 90); fg.addColorStop(0, `rgba(255,140,40,${0.45 * heat})`); fg.addColorStop(1, "rgba(255,140,40,0)"); g.fillStyle = fg; g.fillRect(CX - 100, CATH - 80, 200, 120);
      g.strokeStyle = `rgb(255,${150 + 60 * heat | 0},60)`; g.lineWidth = 4; g.beginPath();
      for (let i = 0; i <= 10; i++) g.lineTo(CX - 50 + i * 10, CATH + (i % 2 ? -6 : 6)); g.stroke();
      ps.forEach((p) => { g.fillStyle = "#7bdcff"; g.fillRect(p.x - 2, p.y - 2, 4, 4); });
      // labels and the grid's own wire
      g.strokeStyle = "#5f5a8f"; g.lineWidth = 4; g.beginPath(); g.moveTo(CX - 84, GRID); g.lineTo(120, GRID); g.stroke();
      g.fillStyle = gridPos ? "#8c92be" : "#7b86ff"; g.fillRect(62, GRID - 20, 62, 40); g.fillStyle = "#0e0c1e"; g.font = "bold 17px JetBrains Mono"; g.fillText(gridPos ? "0 V" : "−5 V", gridPos ? 77 : 70, GRID + 6);
      g.font = "bold 13px Silkscreen"; g.fillStyle = "#c9ceff";
      g.fillText("PLATE  +100 V", CX + 80, PLATE + 5); g.fillText("GRID", 62, GRID - 30); g.fillText("HOT FILAMENT  0 V", CX + 50, CATH + 34);
      g.fillStyle = "#9a95c4"; g.fillText("VACUUM", CX - 30, 160);
    });
  }

  // ---- the race
  const RACERS = [
    { name: "RELAY", c: "var(--cpu)", per: 10e-3 },
    { name: "VACUUM TUBE", c: "var(--gold)", per: 1e-6 },
    { name: "TRANSISTOR", c: "var(--gpu)", per: 10e-12 },
  ];
  // e.g. "0.001 s (1 ms)": the plain seconds written out, and the everyday unit
  const unitText = (s) => (s >= 1 ? "" : s >= 1e-3 ? `${+(s * 1e3).toFixed(1)} ms` : s >= 1e-6 ? `${+(s * 1e6).toFixed(1)} µs` : `${+(s * 1e9).toFixed(1)} ns`);
  const secText = (s) => (s >= 1 ? s.toFixed(2) : s.toFixed(Math.min(12, Math.ceil(-Math.log10(s)) + 1)).replace(/0+$/, "").replace(/\.$/, ""));
  const timeText = (s) => `${secText(s)} s${unitText(s) ? ` <span class="unit">(${unitText(s)})</span>` : ""}`;
  function initRace() {
    $("#lanes").innerHTML = RACERS.map((r, i) => `<div class="lane" style="--c:${r.c}"><span class="name" style="color:${r.c}">${r.name}</span>
      <div class="cells">${"<i></i>".repeat(40)}</div><span class="time" id="lane-t${i}">0</span></div>`).join("");
    let running = false;
    $("#race-btn").addEventListener("click", () => {
      if (running) return;
      running = true; $("#race-btn").disabled = true; SFX.whoosh();
      const t0 = performance.now();
      let lastCell = -1;
      actLoop(4, (dt, now) => {
        const el = (now - t0) / 1000;
        RACERS.forEach((r, i) => {
          const total = r.per * 1000, k = clamp(el / total, 0, 1);
          const cells = $$(".lane")[i].querySelectorAll("i");
          const n = Math.floor(k * 40);
          cells.forEach((c, j) => c.classList.toggle("on", j < n));
          // the relay ticks up in plain seconds (two decimals, steady width); the fast ones show seconds plus their unit
          $("#lane-t" + i).innerHTML = i === 0 ? `${Math.min(el, total).toFixed(2)} s` : timeText(Math.max(Math.min(el, total), 1e-12));
          if (i === 0 && n !== lastCell) { lastCell = n; SFX.tick(); }
        });
        if (el >= RACERS[0].per * 1000) {
          running = false; $("#race-btn").disabled = false; $("#race-btn").textContent = "↺ AGAIN";
          SFX.success(); save({ race: true });
          $("#race-compare").hidden = false;
          reveal("#race-facts", false); reveal("#why-won", false); reveal("#race-next");
          return false;
        }
      });
    });
  }
  inits[4] = () => { initTube(); initRace(); };

  // ======================================================================
  //  ACT 5 · DOPING
  // ======================================================================
  inits[5] = () => {
    const cv = $("#lattice"), g = cv.getContext("2d");
    // phones get fewer, bigger atoms so they're easy to tap
    const narrow = innerWidth < 640;
    const COLS = narrow ? 6 : 11, ROWS = narrow ? 5 : 6, SP = narrow ? 120 : 64, OX = narrow ? 60 : 40, OY = narrow ? 50 : 40;
    if (narrow) cv.height = 580;
    const CWL = cv.width, CHL = cv.height;
    const atoms = Array.from({ length: COLS * ROWS }, () => "Si");
    let tool = "P", volt = false, electrons = [], holes = [], thermal = [], goalMet = 0, done = false, pureTime = 0;
    const stepDone = [false, false, false];
    const NOTES = [
      "Almost nothing flows. Every electron is busy holding two atoms together in a bond, so there's nothing free to push. (The rare flicker is heat shaking one loose for a moment.)",
      "That 5th electron has no bond to sit in. It's <b class='gpu'>free</b>, and the voltage pushes it along. Moving charge is a current.",
      "<b class='gpu'>It conducts!</b> A handful of swapped atoms turned an almost-insulator into a conductor.",
    ];
    function markStep(i) {
      if (stepDone[i]) return;
      stepDone[i] = true; SFX.reveal();
      $("#dope-note").innerHTML = NOTES[i];
      const items = $$("#dope-steps li"), nxt = stepDone.indexOf(false);
      items.forEach((li, k) => { li.classList.toggle("done", stepDone[k]); li.classList.toggle("now", k === nxt); });
    }
    $$("#dope-steps li")[0].classList.add("now");
    if (saved.doped) { $("#dope-explain").hidden = false; $("#dope-next").hidden = false; }
    const pos = (i) => [OX + (i % COLS) * SP, OY + Math.floor(i / COLS) * SP];
    const bonds = []; // [atomA, atomB]
    for (let i = 0; i < atoms.length; i++) { if (i % COLS < COLS - 1) bonds.push([i, i + 1]); if (i + COLS < atoms.length) bonds.push([i, i + COLS]); }
    const bondMid = (b) => { const [a, c] = bonds[b], p = pos(a), q = pos(c); return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
    const bondsOf = (i) => bonds.map((b, k) => (b[0] === i || b[1] === i ? k : -1)).filter((k) => k >= 0);

    function place(i) {
      const old = atoms[i];
      if (old === tool) return;
      atoms[i] = tool;
      const [x, y] = pos(i);
      // remove what the old atom contributed
      if (old === "P") { let best = 0; electrons.forEach((e, k) => { if (Math.hypot(e.x - x, e.y - y) < Math.hypot(electrons[best].x - x, electrons[best].y - y)) best = k; }); electrons.splice(best, 1); }
      if (old === "B" && holes.length) { let best = 0; holes.forEach((h, k) => { const [hx, hy] = bondMid(h.b), [bx, by] = bondMid(holes[best].b); if (Math.hypot(hx - x, hy - y) < Math.hypot(bx - x, by - y)) best = k; }); holes.splice(best, 1); }
      if (tool === "P") electrons.push({ x: x + 14, y: y - 14, vx: 0, vy: 0 });
      if (tool === "B") holes.push({ b: bondsOf(i)[0], t: 0 });
      SFX.place();
    }
    cv.addEventListener("click", (e) => {
      const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * CWL, y = ((e.clientY - r.top) / r.height) * CHL;
      let best = -1, bd = narrow ? 55 : 30;
      atoms.forEach((_, i) => { const [ax, ay] = pos(i), d = Math.hypot(ax - x, ay - y); if (d < bd) { bd = d; best = i; } });
      if (best >= 0) place(best);
    });
    $$("[data-dope]").forEach((b) => b.addEventListener("click", () => { tool = b.dataset.dope; SFX.click(); $$("[data-dope]").forEach((x) => x.classList.toggle("on", x === b)); }));
    $("#volt-btn").addEventListener("click", () => {
      volt = !volt; SFX.click();
      $("#volt-btn").textContent = volt ? "REMOVE VOLTAGE" : "APPLY VOLTAGE";
    });

    let meter = 0;
    onEnter[5] = () => actLoop(5, (dt, now) => {
      const t = now / 1000;
      // a rare thermal electron–hole pair in pure silicon: there, then gone
      if (Math.random() < dt * 0.25) { const b = Math.floor(Math.random() * bonds.length), [x, y] = bondMid(b); thermal.push({ x, y, b, life: 1.2 }); }
      thermal = thermal.filter((p) => (p.life -= dt) > 0);
      // free electrons wander, and drift toward + (right) under a voltage
      electrons.forEach((e) => {
        e.vx += (Math.random() - 0.5) * 900 * dt + (volt ? 260 * dt : 0);
        e.vy += (Math.random() - 0.5) * 900 * dt;
        e.vx *= 0.9; e.vy *= 0.9;
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.y < 14) e.y = 14; if (e.y > CHL - 14) e.y = CHL - 14;
        if (e.x > CWL - 14) e.x = 14; if (e.x < 14) e.x = volt ? 14 : CWL - 14;
      });
      // holes hop between neighbouring bonds, drifting toward − (left) under a voltage
      holes.forEach((h) => {
        h.t -= dt;
        if (h.t > 0) return;
        h.t = 0.25 + Math.random() * 0.2;
        const [a, c] = bonds[h.b];
        const near = [...bondsOf(a), ...bondsOf(c)].filter((k) => k !== h.b);
        let pick = near[Math.floor(Math.random() * near.length)];
        if (volt) { const left = near.filter((k) => bondMid(k)[0] < bondMid(h.b)[0] - 1); if (left.length && Math.random() < 0.7) pick = left[Math.floor(Math.random() * left.length)]; if (!left.length && bondMid(h.b)[0] < 60) pick = bonds.findIndex((b) => b[0] % COLS === COLS - 2 && Math.floor(b[0] / COLS) === Math.floor(a / COLS)); }
        if (pick >= 0) h.b = pick;
      });
      // current: carriers moving under the voltage
      const carriers = electrons.length + holes.length;
      const target = volt ? clamp(carriers * 25, 0, 100) + (thermal.length ? 2 : 0) : 0; // 3 free charges clear the goal line (60), 2 do not
      meter += (target - meter) * clamp(dt * 4, 0, 1);
      $("#meter-fill").style.height = meter + "%";
      $("#meter-fill").style.setProperty("--w", meter + "%");
      $("#meter-val").textContent = volt ? `${meter.toFixed(0)} units` : "no voltage";
      const pure = atoms.every((a) => a === "Si");
      if (volt && pure) { pureTime += dt; if (pureTime > 1.5) markStep(0); } else pureTime = 0;
      if (atoms.includes("P") || atoms.includes("B")) { if (!stepDone[0]) markStep(0); markStep(1); }
      if (volt && meter >= 60) { goalMet += dt; if (goalMet > 1.2 && !done) { done = true; save({ doped: true }); SFX.success(); markStep(2); reveal("#dope-explain"); setTimeout(() => reveal("#dope-next", false), 600); } }
      else goalMet = 0;

      // ---- draw
      g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, CWL, CHL);
      if (volt) { // terminals
        g.fillStyle = "rgba(123,134,255,.25)"; g.fillRect(0, 0, 8, CHL); g.fillStyle = "rgba(255,77,141,.25)"; g.fillRect(CWL - 8, 0, 8, CHL);
        g.font = "bold 18px JetBrains Mono"; g.fillStyle = "#7b86ff"; g.fillText("−", 12, 22); g.fillStyle = "#ff4d8d"; g.fillText("+", CWL - 24, 22);
      }
      const holeBonds = new Set(holes.map((h) => h.b));
      bonds.forEach((b, k) => {
        const [a, c] = b, p = pos(a), q = pos(c);
        g.strokeStyle = "#2d2856"; g.lineWidth = 3; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke();
        const [mx, my] = bondMid(k), horiz = p[1] === q[1];
        const th = thermal.find((x) => x.b === k);
        if (holeBonds.has(k)) {
          hole(g, mx + (horiz ? 5 : 0), my + (horiz ? 0 : 5), 5.5);
          g.fillStyle = "#b8b0e0"; g.beginPath(); g.arc(mx - (horiz ? 5 : 0), my - (horiz ? 0 : 5), 3.5, 0, Math.PI * 2); g.fill();
        } else if (th) {
          g.fillStyle = "#b8b0e0"; g.beginPath(); g.arc(mx - (horiz ? 5 : 0), my - (horiz ? 0 : 5), 3.5, 0, Math.PI * 2); g.fill();
          g.fillStyle = `rgba(123,220,255,${th.life})`; g.beginPath(); g.arc(mx + 10, my - 10 - (1.2 - th.life) * 12, 4, 0, Math.PI * 2); g.fill();
        } else {
          g.fillStyle = "#b8b0e0";
          [-5, 5].forEach((o) => { g.beginPath(); g.arc(mx + (horiz ? o : 0), my + (horiz ? 0 : o), 3.5, 0, Math.PI * 2); g.fill(); });
        }
      });
      atoms.forEach((a, i) => {
        const [x, y] = pos(i);
        g.fillStyle = a === "P" ? "#11917b" : a === "B" ? "#a3244f" : "#3d3772";
        g.beginPath(); g.arc(x, y, narrow ? 30 : 17, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ecebff"; g.font = `bold ${narrow ? 24 : 13}px JetBrains Mono`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(a, x, y + 1);
      });
      electrons.forEach((e) => { g.fillStyle = "rgba(123,220,255,.25)"; g.beginPath(); g.arc(e.x, e.y, 11, 0, Math.PI * 2); g.fill(); electron(g, e.x, e.y, 5.5); });
      g.textAlign = "left"; g.textBaseline = "alphabetic";
    });
  };

  // ======================================================================
  //  ACT 6 · BUILD A TRANSISTOR
  // ======================================================================
  const FAB = [
    { btn: "1 · P-TYPE WAFER", text: 'Start with a slab of silicon doped with a little boron: <b style="color:var(--hot)">p-type</b>, full of holes.' },
    { btn: "2 · IMPLANT SOURCE & DRAIN", text: 'Shoot phosphorus ions through a mask into two spots. They become <b class="gpu">n-type</b> islands: the <b>source</b> and the <b>drain</b>.' },
    { btn: "3 · GROW GLASS", text: "Heat it in oxygen. A layer of glass (silicon dioxide), only a few nanometres thick in real chips, grows on top. It insulates." },
    { btn: "4 · ADD THE GATE", text: "Put a conductive <b>gate</b> on top of the glass, between the islands. It never touches the silicon: the glass sits in between." },
    { btn: "5 · WIRE IT UP", text: "Connect a bulb and a battery across source and drain. Then give the gate its own voltage." },
  ];
  const VT = 0.5; // modern transistors switch on at a few tenths of a volt
  // one notation everywhere: electrons are cyan dots marked −, holes are pink rings marked +
  function electron(g, x, y, r = 4.5, alpha = 1) {
    g.globalAlpha *= alpha; g.fillStyle = "#7bdcff"; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#0e0c1e"; g.fillRect(x - r * 0.55, y - 0.8, r * 1.1, 1.6); g.globalAlpha /= alpha;
  }
  function hole(g, x, y, r = 5) {
    g.strokeStyle = "#ff4d8d"; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ff4d8d"; g.fillRect(x - r * 0.55, y - 0.8, r * 1.1, 1.6); g.fillRect(x - 0.8, y - r * 0.55, 1.6, r * 1.1);
  }
  inits[6] = () => {
    const cv = $("#fet"), g = cv.getContext("2d");
    let stage = saved.fab || 0, stageT = 99, vg = 0, lit = false, stageStart = 0, solved = !!saved.fet;
    seedRand = 3;
    const holesP = Array.from({ length: 60 }, () => ({ x: 50 + rnd() * 660, y: 220 + rnd() * 170, p: rnd() * 6 }));
    const srcE = Array.from({ length: 22 }, () => ({ x: rnd(), y: rnd(), p: rnd() * 6 }));
    const drnE = Array.from({ length: 22 }, () => ({ x: rnd(), y: rnd(), p: rnd() * 6 }));
    const ions = Array.from({ length: 40 }, () => ({ x: rnd(), d: rnd() }));
    const flowE = Array.from({ length: 30 }, (_, i) => ({ u: i / 30 }));
    const stepsEl = $("#fab-steps");
    function buildButtons() {
      stepsEl.innerHTML = FAB.map((f, i) => `<button class="btn small ${i < stage ? "ghost done" : i === stage ? "" : "ghost"}" data-fab="${i}" ${i !== stage ? "disabled" : ""}>${f.btn}</button>`).join("")
        + (stage === FAB.length ? `<button class="btn small cpu-btn" id="fab-again">↺ BUILD IT AGAIN</button>` : "");
      $("#fab-brief").innerHTML = stage < FAB.length ? FAB[stage].text : "It's built. Now use it.";
      $("#gate-ctl").hidden = stage < FAB.length;
    }
    stepsEl.addEventListener("click", (e) => {
      if (e.target.closest("#fab-again")) { stage = 0; vg = 0; $("#vg").value = 0; $("#vg-val").textContent = "0.0"; save({ fab: 0 }); SFX.remove(); buildButtons(); return; }
      const b = e.target.closest("[data-fab]");
      if (!b || +b.dataset.fab !== stage) return;
      stage++; stageStart = performance.now(); SFX.reveal(); save({ fab: stage }); buildButtons();
      if (stage === 2) setTimeout(() => reveal("#junction-explain", false), 1300);
      if (stage === FAB.length) setTimeout(() => $("#gate-ctl").scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    });
    $("#vg").addEventListener("input", (e) => { vg = +e.target.value; $("#vg-val").textContent = vg.toFixed(2); });
    buildButtons();
    if (stage >= 2) $("#junction-explain").hidden = false;
    if (solved) { $("#fet-explain").hidden = false; $("#not-panel").hidden = false; $("#fet-next").hidden = false; $("#fet-goal").innerHTML = `Threshold found: about ${VT} V.`; }

    onEnter[6] = () => actLoop(6, (dt, now) => {
      const t = now / 1000, k = clamp((now - stageStart) / 1200, 0, 1); // animation progress of the latest step
      const ch = stage >= 5 ? clamp((vg - VT) / 1.6, 0, 1) : 0;         // how strong the channel is
      g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, 760, 420);
      const S0 = 210; // silicon surface
      // 1: p-type substrate with holes
      if (stage >= 1) {
        const a = stage === 1 ? k : 1;
        g.globalAlpha = a;
        g.fillStyle = "#2a1630"; g.fillRect(40, S0, 680, 190);
        holesP.forEach((h) => {
          const nearGate = h.x > 250 && h.x < 510;
          const push = stage >= 5 && nearGate ? clamp((vg / 3) * 60, 0, 60) * Math.max(0, 1 - (h.y - S0) / 120) : 0; // gate voltage repels holes from the surface
          const y = Math.min(392, h.y + push + Math.sin(t * 1.3 + h.p) * 3);
          const x = h.x + Math.cos(t * 1.1 + h.p) * 3;
          if ((x > 74 && x < 266 || x > 494 && x < 686) && y < S0 + 100 && stage >= 2) return; // no free holes inside the islands or their barriers
          hole(g, x, y);
        });
        g.fillStyle = "#ff4d8d"; g.font = "bold 15px Silkscreen"; g.fillText("P-TYPE SILICON", 300, 390);
        g.globalAlpha = 1;
      }
      // 2: source and drain islands, implanted through a mask
      if (stage >= 2) {
        const a = stage === 2 ? k : 1;
        if (stage === 2 && k < 1) {
          g.fillStyle = "#3a3a44"; g.fillRect(40, 120, 50, 12); g.fillRect(250, 120, 260, 12); g.fillRect(670, 120, 50, 12);
          ions.forEach((ion) => { const y = 132 + ((t * 300 + ion.d * 200) % 150); const x = ion.x < 0.5 ? 90 + ion.x * 2 * 160 : 510 + (ion.x - 0.5) * 2 * 160; if (y < S0 + 60 * a) { g.fillStyle = "#3df5c4"; g.fillRect(x, y, 3, 3); } });
        }
        [[90, srcE], [510, drnE]].forEach(([x0, es]) => {
          g.fillStyle = `rgba(31,58,110,${a})`; g.beginPath(); g.moveTo(x0, S0); g.lineTo(x0 + 160, S0); g.lineTo(x0 + 160, S0 + 60); g.quadraticCurveTo(x0 + 160, S0 + 82, x0 + 138, S0 + 82); g.lineTo(x0 + 22, S0 + 82); g.quadraticCurveTo(x0, S0 + 82, x0, S0 + 60); g.closePath(); g.fill();
          es.forEach((e) => electron(g, x0 + 14 + e.x * 132 + Math.sin(t * 2 + e.p) * 3, S0 + 12 + e.y * 58 + Math.cos(t * 1.7 + e.p) * 3, 4.5, a));
        });
        // the barrier (depletion zone) around each island: fixed + ions inside the edge, fixed − ions just outside, no free charges
        g.globalAlpha = a;
        [90, 510].forEach((x0) => {
          g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(x0 - 12, S0, 12, 94); g.fillRect(x0 + 160, S0, 12, 94); g.fillRect(x0 - 12, S0 + 82, 184, 12);
          g.font = "bold 11px JetBrains Mono";
          g.fillStyle = "#9a95c4";
          for (let y = S0 + 10; y < S0 + 80; y += 16) { g.fillText("−", x0 - 9, y + 4); g.fillText("−", x0 + 163, y + 4); g.fillText("+", x0 + 3, y + 4); g.fillText("+", x0 + 150, y + 4); }
          for (let x = x0 + 4; x < x0 + 160; x += 18) { g.fillText("−", x, S0 + 92); g.fillText("+", x + 6, S0 + 78); }
        });
        g.fillStyle = "#7bdcff"; g.font = "bold 15px Silkscreen"; g.fillText("SOURCE (N)", 104, S0 + 118); g.fillText("DRAIN (N)", 530, S0 + 118);
        if (stage >= 5) { g.fillStyle = "#9a95c4"; g.font = "12px JetBrains Mono"; g.fillText("electrons come from here", 92, S0 + 136); g.fillText("…and drain away here", 520, S0 + 136); }
        g.fillStyle = "#c9ceff"; g.font = "12px JetBrains Mono"; g.fillText("barrier", 262, S0 + 74);
        g.globalAlpha = 1;
      }
      // 3: glass
      if (stage >= 3) { const th = 14 * (stage === 3 ? k : 1); g.fillStyle = "rgba(160,200,255,.55)"; g.fillRect(250, S0 - th, 260, th); if (stage >= 3) { g.fillStyle = "#a0c8ff"; g.font = "12px JetBrains Mono"; g.fillText("glass", 514, S0 - 2); } }
      // 4: gate
      if (stage >= 4) {
        const a = stage === 4 ? k : 1;
        g.fillStyle = `rgba(140,146,190,${a})`; g.fillRect(262, S0 - 14 - 34 * a, 236, 34 * a);
        const gv = stage >= 5 ? clamp(vg / 3, 0, 1) : 0;
        if (gv > 0) { g.fillStyle = `rgba(255,77,141,${0.25 + gv * 0.5})`; g.fillRect(262, S0 - 48, 236, 34); g.fillStyle = "#fff"; g.font = "bold 14px JetBrains Mono"; for (let x = 280; x < 490; x += 30) g.fillText("+", x, S0 - 26); }
        g.fillStyle = "#ecebff"; g.font = "bold 15px Silkscreen"; g.fillText("GATE", 290, S0 - 58);
      }
      // 5: wiring, the bulb, the channel
      if (stage >= 5) {
        const lw = (pts, live) => { g.strokeStyle = live ? "#c9a44a" : "#5f5a8f"; g.lineWidth = 5; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
        g.fillStyle = "#8a92c0"; g.fillRect(140, S0 - 10, 60, 10); g.fillRect(560, S0 - 10, 60, 10);
        lw([[170, S0 - 10], [170, 60], [330, 60]], ch > 0); lw([[430, 60], [590, 60], [590, 80]], ch > 0); lw([[590, 120], [590, S0 - 10]], ch > 0);
        // battery on the top wire
        // battery: its − end feeds the source (left), its + end pulls electrons through the bulb from the drain (right)
        g.fillStyle = "#5f5a8f"; g.fillRect(360, 52, 9, 16); g.fillRect(396, 44, 5, 32); g.fillStyle = "#9a95c4"; g.font = "13px JetBrains Mono"; g.fillText("−", 356, 40); g.fillText("+", 395, 40);
        lw([[330, 60], [360, 60]], ch > 0); lw([[401, 60], [430, 60]], ch > 0);
        // bulb
        const b = Math.pow(ch, 0.6);
        if (b > 0) { const gl = g.createRadialGradient(590, 100, 4, 590, 100, 90); gl.addColorStop(0, `rgba(255,224,102,${0.6 * b})`); gl.addColorStop(1, "rgba(255,224,102,0)"); g.fillStyle = gl; g.fillRect(490, 10, 200, 180); }
        g.fillStyle = b > 0 ? `rgb(255,${200 + 24 * b | 0},${80 + 22 * b | 0})` : "#1f1b3d"; g.beginPath(); g.arc(590, 100, 20, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#9a95c4"; g.lineWidth = 2; g.stroke();
        // gate wire
        lw([[380, S0 - 48], [380, 120]], vg > 0);
        // while the gate is charged: electrons are pulled up (−, cyan), holes are pushed down (+, pink)
        if (vg > 0.05) {
          const al = clamp(vg / 1.2, 0, 1), bob = (t * 1.5) % 1;
          for (let i = 0; i < 4; i++) {
            const x = 290 + i * 60;
            g.globalAlpha = al;
            g.strokeStyle = "#7bdcff"; g.lineWidth = 2.5; const ye = S0 + 70 - bob * 30;
            g.beginPath(); g.moveTo(x, ye + 18); g.lineTo(x, ye); g.lineTo(x - 5, ye + 6); g.moveTo(x, ye); g.lineTo(x + 5, ye + 6); g.stroke();
            g.strokeStyle = "#ff4d8d"; const yh = S0 + 110 + bob * 30;
            g.beginPath(); g.moveTo(x + 24, yh - 18); g.lineTo(x + 24, yh); g.lineTo(x + 19, yh - 6); g.moveTo(x + 24, yh); g.lineTo(x + 29, yh - 6); g.stroke();
            g.globalAlpha = 1;
          }
        }
        g.fillStyle = "#9a95c4"; g.font = "13px JetBrains Mono"; g.fillText(`GATE BATTERY ${vg.toFixed(2)} V`, 390, 128);
        // channel: electrons gathered under the glass
        if (ch > 0) {
          const n = Math.floor(ch * 70);
          for (let i = 0; i < n; i++) electron(g, 252 + ((i * 37) % 256), S0 + 5 + ((i * 13) % Math.max(2, Math.floor(4 + ch * 10))), 3.6);
          // current: electrons streaming source → drain
          flowE.forEach((f) => { f.u = (f.u + dt * (0.15 + ch * 0.6)) % 1; electron(g, 150 + f.u * 460, S0 + 6 + Math.sin(f.u * 20) * 2, 3.6); });
          g.fillStyle = "#3df5c4"; g.font = "bold 15px Silkscreen"; g.fillText("CHANNEL", 330, S0 + 40);
        }
        // what's happening, in words
        const cap = vg < 0.05 ? "No voltage on the gate. Between the two islands there's p-type silicon: holes, but no free electrons. The source's electrons can't get across. <b>OFF</b>."
          : vg < 0.45 ? "The <b>+</b> gate attracts electrons (−) and repels holes (+): holes are pushed down, away from the surface, and a few electrons are pulled up against the glass. Not enough to bridge the gap yet."
          : vg <= VT + 0.03 ? "Almost there: electrons, drawn in mostly from the source and drain, are gathering in a thin layer under the glass…"
          : "Past the <b>threshold</b>: the gathered electrons form a <b class='gpu'>channel</b> from source to drain. The current flows and the bulb lights. <b class='gpu'>ON</b>.";
        if ($("#fet-caption").innerHTML !== cap) $("#fet-caption").innerHTML = cap;
        // goals
        const nowLit = ch > 0.02;
        if (nowLit && !lit) SFX.reveal();
        lit = nowLit;
        if (!solved) {
          if (lit && vg <= VT + 0.2) {
            solved = true; save({ fet: true }); SFX.success();
            $("#fet-goal").innerHTML = `<b class="gpu">That's the threshold: about ${VT} V.</b> Below it the channel can't form, and the switch stays off.`;
            reveal("#fet-explain"); setTimeout(() => { reveal("#not-panel", false); reveal("#fet-next", false); }, 600);
          } else if (lit) $("#fet-goal").innerHTML = "The light is on! Now slide the voltage <b>down</b> slowly: what's the lowest voltage that still lights it?";
        }
      }
    });
    initNot();
  };
  let seedRand = 1;
  const rnd = () => ((seedRand = (seedRand * 16807) % 2147483647) / 2147483647);

  // ======================================================================
  //  ACT 7 · SHRINK IT
  // ======================================================================
  const THINGS = [
    { name: "a relay", size: 2e-2, draw: "relay", x: 0.5 },
    { name: "a grain of sand", size: 5e-4, draw: "grain", x: 0.35 },
    { name: "a human hair", size: 7e-5, draw: "hair", x: 0.7 },
    { name: "a red blood cell", size: 7.5e-6, draw: "rbc", x: 0.3 },
    { name: "a bacterium", size: 2e-6, draw: "bact", x: 0.7 },
    { name: "a virus", size: 1e-7, draw: "virus", x: 0.22 },
    { name: "a modern transistor", size: 5e-8, draw: "fet", x: 0.78 },
    { name: "its thinnest fin", size: 6e-9, draw: "fin", x: 0.5 },
    { name: "silicon atoms", size: 2.35e-10, draw: "atoms", x: 0.5 },
  ];
  const lenText = (m) => (m >= 1e-2 ? `${(m * 100).toFixed(m >= 0.1 ? 0 : 1)} CM` : m >= 1e-3 ? `${(m * 1e3).toFixed(1)} MM` : m >= 1e-6 ? `${fmt(m * 1e6)} µM` : m >= 1e-9 ? `${fmt(m * 1e9)} NM` : `${(m * 1e9).toFixed(1)} NM`);
  const CHIPS = [
    ["Intel 4004 · 1971", 2300], ["Intel 8086 · 1978", 29000], ["Intel 486 · 1989", 1.2e6], ["Pentium 4 · 2000", 42e6],
    ["Core 2 Duo · 2006", 291e6], ["Apple A7 · 2013", 1e9], ["NVIDIA H100 · 2022", 80e9], ["NVIDIA B200 · 2024 (2 dies)", 208e9],
  ];
  inits[7] = () => {
    const cv = $("#zoom"), g = cv.getContext("2d"), CW = 960, CH = 420;
    const slider = $("#zoom-slider");
    function draw() {
      const k = +slider.value / 1000, span = Math.pow(10, -2 - 8 * k * 0.9 - 0.45 * k); // 1 cm → ~0.1 nm across the canvas
      g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, CW, CH);
      $("#zoom-tag").textContent = `${lenText(span)} ACROSS`;
      THINGS.forEach((th, i) => {
        const px = (th.size / span) * CW;
        if (px < 4 || (px > CW * 1.4 && th.draw !== "atoms")) return;
        const cx = CW * th.x, cy = CH / 2;
        // fade in as it grows visible, fade out once it's wider than the view (atoms tile, so they stay)
        const wide = th.draw === "fin" ? px * 6 : px; // the fin is drawn 6× longer than it is thick
        if (th.draw === "fin" && wide > CW * 1.4) return;
        const a = th.draw === "atoms" ? clamp((px - 25) / 35, 0, 1) : clamp(Math.min((px - 4) / 20, (CW * 1.4 - wide) / (CW * 0.5)), 0, 1);
        if (a <= 0) return;
        g.globalAlpha = a;
        if (th.draw === "relay") { g.fillStyle = "#ffab40"; g.fillRect(cx - px / 2, cy - px * 0.3, px, px * 0.6); g.fillStyle = "#b8620f"; for (let x = 0; x < px * 0.5; x += Math.max(2, px / 20)) g.fillRect(cx - px * 0.4 + x, cy - px * 0.2, Math.max(1, px / 60), px * 0.4); }
        else if (th.draw === "grain") { g.fillStyle = "#d9b77a"; g.beginPath(); for (let a2 = 0; a2 < 6.28; a2 += 0.4) { const r = (px / 2) * (0.85 + 0.15 * Math.sin(a2 * 3)); g.lineTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r); } g.fill(); }
        else if (th.draw === "hair") { g.fillStyle = "#6a4a2a"; g.fillRect(cx - px / 2, 0, px, CH); }
        else if (th.draw === "rbc") { g.fillStyle = "#c83a3a"; g.beginPath(); g.ellipse(cx, cy, px / 2, px / 2.2, 0, 0, 6.28); g.fill(); g.fillStyle = "#8a2020"; g.beginPath(); g.ellipse(cx, cy, px / 5, px / 6, 0, 0, 6.28); g.fill(); }
        else if (th.draw === "bact") { g.fillStyle = "#4a9a3a"; g.beginPath(); g.ellipse(cx, cy, px / 2, px / 6, 0.3, 0, 6.28); g.fill(); }
        else if (th.draw === "virus") { g.fillStyle = "#ff4d8d"; g.beginPath(); g.arc(cx, cy, px / 2.4, 0, 6.28); g.fill(); for (let a2 = 0; a2 < 6.28; a2 += 0.5) { g.fillRect(cx + Math.cos(a2) * px / 2.2 - px / 30, cy + Math.sin(a2) * px / 2.2 - px / 30, px / 15, px / 15); } }
        else if (th.draw === "fet") { g.fillStyle = "#3df5c4"; for (let f = -1; f <= 1; f++) g.fillRect(cx - px / 2, cy + f * px * 0.25 - px * 0.04, px, px * 0.08); g.fillStyle = "rgba(140,146,190,.9)"; g.fillRect(cx - px * 0.1, cy - px * 0.45, px * 0.2, px * 0.9); }
        else if (th.draw === "fin") { g.fillStyle = "#3df5c4"; g.fillRect(cx - px * 3, cy - px / 2, px * 6, px); }
        else if (th.draw === "atoms") { const sp = px; for (let y = cy % sp - sp; y < CH + sp; y += sp) for (let x = -sp; x < CW + sp; x += sp) { g.fillStyle = "#7b86ff"; g.beginPath(); g.arc(x + ((y / sp) % 2) * sp / 2, y, sp * 0.3, 0, 6.28); g.fill(); } }
        if (px > 16 && px < CW * 1.5) { g.fillStyle = "#ecebff"; g.font = "bold 18px JetBrains Mono"; g.textAlign = "center"; g.fillText(`${th.name} · ${lenText(th.size).toLowerCase()}`, cx, Math.min(CH - 16, cy + Math.max(px * 0.35, 30) + 24)); g.textAlign = "left"; }
        g.globalAlpha = 1;
      });
    }
    slider.addEventListener("input", draw);
    draw();
    const max = Math.log10(3e11);
    $("#moore").innerHTML = CHIPS.map(([n, c]) => `<div class="row"><span>${n}</span><div class="bar"><i data-w="${(Math.log10(c) / max) * 100}"></i></div><b>${fmt(c)}</b></div>`).join("");
    setTimeout(() => $$("#moore i").forEach((el, i) => setTimeout(() => { el.style.width = el.dataset.w + "%"; SFX.tick(); }, i * 180)), 400);
  };

  // ======================================================================
  //  ACT 8 · FINALE: SWITCHES FLIPPING SWITCHES
  // ======================================================================
  inits[8] = () => {
    const cv = $("#fchain"), g = cv.getContext("2d"), N = 7;
    let input = false, states = new Array(N).fill(false), flips = 0, busy = false;
    function draw() {
      g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, 320, 80);
      // every transistor taps the same two wires: the supply rail on top, ground at the bottom
      g.fillStyle = "#ff8a5c"; g.fillRect(0, 4, 320, 2);
      g.fillStyle = "#5f5a8f"; g.fillRect(0, 74, 320, 2);
      for (let i = 0; i < N; i++) { const x = 14 + i * 43; g.fillStyle = "#ff8a5c"; g.fillRect(x + 21, 6, 1, 22); g.fillStyle = "#5f5a8f"; g.fillRect(x + 1, 38, 1, 36); }
      for (let i = 0; i < N; i++) {
        const x = 14 + i * 43, on = states[i], gateOn = i === 0 ? input : states[i - 1];
        g.fillStyle = gateOn ? "#c9a44a" : "#3d3772"; g.fillRect(x - 14, 26, 18, 2);                  // wire from the previous output to this gate
        g.fillStyle = gateOn ? "#ff4d8d" : "#8c92be"; g.fillRect(x + 4, 20, 16, 4);                   // gate
        g.fillStyle = on ? "#3df5c4" : "#2a1630"; g.fillRect(x + 4, 28, 16, 10);                       // channel
        g.fillStyle = "#1f3a6e"; g.fillRect(x, 28, 4, 10); g.fillRect(x + 20, 28, 4, 10);             // source and drain
        g.fillStyle = on ? "#ffe066" : "#2d2856"; g.fillRect(x + 8, 50, 8, 8);                         // output lamp
        if (on) { g.fillStyle = "rgba(255,224,102,.25)"; g.fillRect(x + 5, 47, 14, 14); }
      }
      g.fillStyle = input ? "#ff4d8d" : "#5f5a8f"; g.fillRect(0, 22, 6, 10);
    }
    draw();
    $("#fchain-btn").addEventListener("click", async () => {
      if (busy) return;
      busy = true; input = !input; SFX.click(); draw();
      $("#fchain-btn").textContent = input ? "▶ TURN THE FIRST GATE OFF" : "▶ FLIP THE FIRST GATE";
      for (let i = 0; i < N; i++) { await new Promise((r) => setTimeout(r, 220)); states[i] = input; draw(); SFX.tick(); }
      busy = false; flips++;
      if (flips >= 2 && $("#finale-card").hidden) { SFX.fanfare(); save({ done: true }); reveal("#finale-card"); }
    });
  };

  // ---- bonus: the NOT gate, three ways (switch + resistor, transistor + resistor, CMOS)
  function initNot() {
    const cv = $("#notc"), g = cv.getContext("2d");
    const X = 360, TOP = 44, BOT = 356, OUTY = 200, OX = 640; // the column of parts, the output node, the output reading
    let mode = "switch", input = 0, flipT = -9, held = 1; // held: the voltage a disconnected output keeps
    const NOTES = {
      switch: ["Switch open. Nothing connects the output to ground, so the resistor pulls it up to the supply: <b class='gold'>OUT = 1</b>.",
        "Switch closed. It connects the output straight to ground, and the switch conducts far better than the resistor, so ground wins: <b>OUT = 0</b>. Notice the current now flowing from supply to ground. That's wasted."],
      nmos: ["Gate at 0: the n-type transistor is off, so the resistor pulls the output up: <b class='gold'>OUT = 1</b>. The same circuit as the switch, with the transistor as the switch.",
        "Gate at 1: the transistor's channel forms and connects the output to ground: <b>OUT = 0</b>. It works, but current pours through the resistor for as long as the output is 0. With billions of gates, that would cook the chip."],
      palone: ["Meet the <b style='color:var(--hot)'>p-type</b> transistor: the mirror image of ours (n-type body, p-type islands), so it switches on when its gate is <b>0</b>. Input 0: it's on and connects the output to the supply: <b class='gold'>OUT = 1</b>. Looks like a NOT so far…",
        "Input 1: the p-type is off. But <b>off isn't 0</b>: the output is now connected to <i>nothing</i>. It feeds the next transistor's gate, which is insulated by glass, so its charge has nowhere to go and it just stays at its old voltage. It's <b>floating</b>. A bulb would go dark here, but a wire into a gate doesn't. Something has to pull it <b>down</b>."],
      cmos: ["Add an n-type below to do the pulling down. Input 0: the p-type is on, the n-type is off. The output connects to the supply: <b class='gold'>OUT = 1</b>.",
        "Input 1: the p-type is off, the n-type is on. The output connects to ground: <b>OUT = 0</b>. One switch gives the output a way <b>up</b>, the other a way <b>down</b>, and exactly one is ever connected, so no current is wasted except for an instant while it switches. This pair is in every chip you own."],
    };
    const sync = () => {
      $("#not-in").textContent = input ? "INPUT: 1 · SET IT TO 0" : "INPUT: 0 · SET IT TO 1";
      $("#not-state").innerHTML = NOTES[mode][input];
    };
    $("#not-in").addEventListener("click", () => { input = 1 - input; flipT = performance.now() / 1000; SFX.click(); sync(); });
    $$("[data-not]").forEach((b) => b.addEventListener("click", () => {
      mode = b.dataset.not; SFX.click(); sync();
      $$("[data-not]").forEach((x) => x.classList.toggle("on", x === b));
    }));
    sync();
    const line = (pts, c, w = 6) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); };
    const label = (s, x, y, c = "#9a95c4", align = "left", font = "bold 13px Silkscreen") => { g.fillStyle = c; g.font = font; g.textAlign = align; g.fillText(s, x, y); g.textAlign = "left"; };
    function resistor(y0, y1) {
      line([[X, y0], [X, y0 + 20]], "#5f5a8f"); line([[X, y1 - 20], [X, y1]], "#5f5a8f");
      g.strokeStyle = "#c9ceff"; g.lineWidth = 4; g.beginPath(); g.moveTo(X, y0 + 20);
      for (let i = 1; i <= 8; i++) g.lineTo(X + (i % 2 ? 16 : -16), y0 + 20 + ((y1 - y0 - 40) * i) / 8);
      g.lineTo(X, y1 - 20); g.stroke();
      label("RESISTOR", X + 30, (y0 + y1) / 2 + 5); label("a weak, permanent link to supply", X + 30, (y0 + y1) / 2 + 24, "#5f5a8f", "left", "12px JetBrains Mono");
    }
    // a transistor standing upright: channel between its two n (or p) ends, gate plate on its left
    function fet(y0, y1, on, kind) {
      const ty0 = y0 + 26, ty1 = y1 - 26;
      line([[X, y0], [X, ty0]], "#5f5a8f"); line([[X, ty1], [X, y1]], "#5f5a8f");
      const end = kind === "p" ? "#7a2448" : "#1f3a6e";
      g.fillStyle = end; g.fillRect(X - 12, ty0, 24, 14); g.fillRect(X - 12, ty1 - 14, 24, 14);
      g.fillStyle = on ? (kind === "p" ? "#ff4d8d" : "#3df5c4") : (kind === "p" ? "#1e2a52" : "#2a1630");
      g.fillRect(X - 12, ty0 + 14, 24, ty1 - ty0 - 28);
      g.fillStyle = "rgba(160,200,255,.55)"; g.fillRect(X - 17, ty0 + 14, 5, ty1 - ty0 - 28);       // glass
      g.fillStyle = "#8c92be"; g.fillRect(X - 27, ty0 + 14, 10, ty1 - ty0 - 28);                    // gate
      if (kind === "p") { g.strokeStyle = "#ff4d8d"; g.lineWidth = 3; g.beginPath(); g.arc(X - 36, (y0 + y1) / 2, 7, 0, 7); g.stroke(); }
      label(kind === "p" ? "P-TYPE" : "N-TYPE", X + 26, (y0 + y1) / 2 - 4, kind === "p" ? "#ff4d8d" : "#3df5c4");
      label(kind === "p" ? "on when its gate is 0" : "on when its gate is 1", X + 26, (y0 + y1) / 2 + 15, "#9a95c4", "left", "12px JetBrains Mono");
      label(on ? "ON" : "OFF", X + 26, (y0 + y1) / 2 + 36, on ? "#ecebff" : "#5f5a8f");
    }
    function knife(y0, y1, closed) {
      const a = y0 + 30, b = y1 - 30;
      line([[X, y0], [X, a]], "#5f5a8f"); line([[X, b], [X, y1]], "#5f5a8f");
      const tilt = closed ? 0 : -0.6, len = b - a; // the lever pivots at the bottom contact and swings up onto the top one
      g.strokeStyle = "#ffab40"; g.lineWidth = 7; g.lineCap = "round"; g.beginPath(); g.moveTo(X, b); g.lineTo(X + Math.sin(tilt) * len, b - Math.cos(tilt) * len); g.stroke(); g.lineCap = "butt";
      g.fillStyle = "#ffab40"; g.beginPath(); g.arc(X, b, 6, 0, 7); g.fill(); g.fillStyle = "#5f5a8f"; g.beginPath(); g.arc(X, a, 5, 0, 7); g.fill();
      label("SWITCH", X + 30, (y0 + y1) / 2 + 5); label(closed ? "pressed" : "not pressed", X + 30, (y0 + y1) / 2 + 24, "#9a95c4", "left", "12px JetBrains Mono");
    }
    // ---- the two transistors side by side, in cross-section, driven by one gate voltage
    const pc = $("#pnc"), pg = pc.getContext("2d");
    let gate = 0;
    $("#pn-gate").addEventListener("click", () => { gate = 1 - gate; SFX.click(); $("#pn-gate").textContent = gate ? "GATES: 1 V · SET TO 0 V" : "GATES: 0 V · SET TO 1 V"; });
    const DOTS = Array.from({ length: 34 }, (_, i) => ({ x: (Math.sin(i * 12.9898) * 43758.5453) % 1, y: (Math.sin(i * 78.233) * 12345.678) % 1, p: i * 1.7 }));
    function crossSection(ox, kind, t) {
      const n = kind === "n", on = n ? gate === 1 : gate === 0, S0 = 150, W2 = 340;
      const bodyC = n ? "#2a1630" : "#16203e", islC = n ? "#1f3a6e" : "#5a1838";
      const carrier = (x, y, r) => (n ? hole : electron)(pg, x, y, r);      // what fills the body
      const free = (x, y, r) => (n ? electron : hole)(pg, x, y, r);         // what fills the islands, and the channel
      pg.fillStyle = bodyC; pg.fillRect(ox, S0, W2, 120);
      DOTS.forEach((d) => {
        const x = ox + 10 + Math.abs(d.x) * (W2 - 20), y0 = S0 + 10 + Math.abs(d.y) * 100;
        const under = x > ox + 110 && x < ox + 230, push = on && under ? 34 * Math.max(0, 1 - (y0 - S0) / 70) : 0;
        if ((x < ox + 104 || x > ox + 236) && y0 < S0 + 60) return; // islands
        carrier(x + Math.cos(t + d.p) * 2, Math.min(S0 + 112, y0 + push + Math.sin(t * 1.3 + d.p) * 2), 4);
      });
      [[ox + 14, ox + 100], [ox + 240, ox + W2 - 14]].forEach(([a, b], k) => {
        pg.fillStyle = islC; pg.fillRect(a, S0, b - a, 52);
        for (let i = 0; i < 9; i++) free(a + 10 + ((i * 29) % (b - a - 20)), S0 + 12 + ((i * 17) % 32), 4);
      });
      pg.fillStyle = "rgba(160,200,255,.55)"; pg.fillRect(ox + 100, S0 - 8, 140, 8);
      const gc = on ? (n ? "#ff4d8d" : "#7b86ff") : "#8c92be";
      pg.fillStyle = gc; pg.fillRect(ox + 108, S0 - 30, 124, 22);
      if (on) { pg.fillStyle = "#fff"; pg.font = "bold 13px JetBrains Mono"; pg.textAlign = "center"; for (let x = ox + 124; x < ox + 232; x += 24) pg.fillText(n ? "+" : "−", x, S0 - 14); }
      if (on) for (let i = 0; i < 14; i++) free(ox + 104 + i * 10, S0 + 6, 3.4);
      pg.textAlign = "center"; pg.font = "bold 14px Silkscreen";
      pg.fillStyle = n ? "#3df5c4" : "#ff4d8d"; pg.fillText(n ? "N-TYPE TRANSISTOR" : "P-TYPE TRANSISTOR", ox + W2 / 2, 30);
      pg.fillStyle = "#9a95c4"; pg.font = "12px JetBrains Mono";
      pg.fillText(n ? "p-type body · n-type islands" : "n-type body · p-type islands", ox + W2 / 2, 50);
      pg.fillText(n ? "source wired to ground, 0 V" : "source wired to supply, +1 V", ox + W2 / 2, 68);
      pg.fillStyle = "#ecebff"; pg.font = "bold 13px JetBrains Mono"; pg.fillText(`GATE ${gate} V`, ox + W2 / 2, S0 - 40);
      pg.font = "bold 12px Silkscreen"; pg.fillStyle = n ? "#7bdcff" : "#ff4d8d";
      pg.fillText("SOURCE", ox + 57, S0 + 70); pg.fillText("DRAIN", ox + W2 - 57, S0 + 70);
      const why = n ? (on ? "1 V above its source: pulls ELECTRONS up" : "same as its source: no pull") : (on ? "1 V below its source: pulls HOLES up" : "same as its source: no pull");
      pg.font = "12px JetBrains Mono"; pg.fillStyle = "#c9ceff"; pg.fillText(why, ox + W2 / 2, S0 + 140);
      pg.font = "bold 22px Silkscreen"; pg.fillStyle = on ? (n ? "#3df5c4" : "#ff4d8d") : "#5f5a8f"; pg.fillText(on ? "ON" : "OFF", ox + W2 / 2, 96);
      pg.textAlign = "left";
    }
    const prevEnter = onEnter[6];
    onEnter[6] = () => { prevEnter && prevEnter(); actLoop(6, notFrame); };
    function notFrame(dt, now) {
      const t = now / 1000;
      if (!$("#not-panel").hidden) {
        pg.fillStyle = "#0e0c1e"; pg.fillRect(0, 0, 760, 300);
        crossSection(30, "n", t); crossSection(390, "p", t);
      }
      const out = 1 - input;
      // is there a path from supply to ground right now? (CMOS: only for a moment, mid-switch)
      const leak = mode === "switch" || mode === "nmos" ? input === 1 : mode === "cmos" && t - flipT < 0.25;
      g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, 760, 400);
      // rails
      g.fillStyle = "#ff8a5c"; g.fillRect(40, TOP - 3, 680, 6); label("SUPPLY  +1 V", 48, TOP - 12, "#ff8a5c");
      g.fillStyle = "#5f5a8f"; g.fillRect(40, BOT - 3, 680, 6); label("GROUND  0 V", 48, BOT + 26, "#9a95c4");
      // the input wire, to the gate(s)
      const inC = input ? "#ff4d8d" : "#5f5a8f";
      if (mode === "switch") { label("YOUR FINGER IS THE INPUT", 60, OUTY + 70, inC); }
      else {
        line([[60, OUTY], [200, OUTY]], inC);
        if (mode !== "palone") line([[200, OUTY], [200, (OUTY + BOT) / 2], [X - 27, (OUTY + BOT) / 2]], inC);
        if (mode === "cmos" || mode === "palone") line([[200, OUTY], [200, (TOP + OUTY) / 2], [X - 43, (TOP + OUTY) / 2]], inC);
        g.fillStyle = inC; g.fillRect(40, OUTY - 16, 24, 32); label("IN", 40, OUTY - 24, "#ecebff"); label(String(input), 52, OUTY + 6, "#0e0c1e", "center", "bold 16px JetBrains Mono");
      }
      // the column: top part between supply and the output node, bottom part between the node and ground
      const hasP = mode === "cmos" || mode === "palone";
      if (hasP) fet(TOP, OUTY, input === 0, "p"); else resistor(TOP, OUTY);
      if (mode === "switch") knife(OUTY, BOT, input === 1);
      else if (mode === "palone") {
        // nothing below: the output has no way down to ground
        g.strokeStyle = "#3d3772"; g.lineWidth = 3; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(X, OUTY); g.lineTo(X, BOT); g.stroke(); g.setLineDash([]);
        label("NOTHING HERE", X + 26, (OUTY + BOT) / 2 - 4, "#5f5a8f"); label("no way down to ground", X + 26, (OUTY + BOT) / 2 + 15, "#5f5a8f", "left", "12px JetBrains Mono");
      } else fet(OUTY, BOT, input === 1, "n");
      // output node and reading. A lone p-type that's off leaves the output floating at whatever it held
      const floating = mode === "palone" && input === 1;
      if (!floating) held = out;
      const outV = floating ? held : out, outC = outV ? "#ffe066" : "#5f5a8f";
      line([[X, OUTY], [OX - 30, OUTY]], outC);
      g.fillStyle = outV ? (floating ? "#9a8a40" : "#ffe066") : "#1f1b3d"; g.fillRect(OX - 30, OUTY - 34, 90, 68);
      g.strokeStyle = floating ? "#ff5a5a" : "#9a95c4"; g.lineWidth = 2; if (floating) g.setLineDash([5, 5]); g.strokeRect(OX - 30, OUTY - 34, 90, 68); g.setLineDash([]);
      label(floating ? `${outV}?` : String(outV), OX + 15, OUTY + 14, outV ? "#0e0c1e" : "#9a95c4", "center", "bold 38px JetBrains Mono");
      label("OUT", OX + 15, OUTY - 44, "#ecebff", "center");
      label(floating ? "FLOATING" : outV ? "≈ 1 V" : "≈ 0 V", OX + 15, OUTY + 56, floating ? "#ff5a5a" : "#9a95c4", "center", floating ? "bold 13px Silkscreen" : "13px JetBrains Mono");
      label(floating ? "stuck at its old value" : "→ to the next gate", OX + 15, OUTY + 80, floating ? "#ff5a5a" : "#5f5a8f", "center", "12px JetBrains Mono");
      g.fillStyle = "#ecebff"; g.beginPath(); g.arc(X, OUTY, 6, 0, 7); g.fill();
      // electrons streaming from ground up to the supply while there's a straight path: wasted current
      if (leak) for (let i = 0; i < 9; i++) { const u = ((i / 9 + t * 0.5) % 1); electron(g, X, BOT - u * (BOT - TOP), 4.5); }
      // the waste meter
      g.fillStyle = "#1f1b3d"; g.fillRect(560, 326, 160, 14); g.fillStyle = leak ? "#ff5a5a" : "#3df5c4"; g.fillRect(560, 326, leak ? 160 * (mode === "cmos" ? 0.5 : 1) : 4, 14);
      label("CURRENT WASTED", 560, 318, leak ? "#ff5a5a" : "#9a95c4");
    }
  }

  // ---------- boot ----------
  const hashAct = parseInt((location.hash.match(/act=(\d+)/) || [])[1], 10);
  go(Number.isFinite(hashAct) ? hashAct : 0);
})();
