/* EP 02 scenes, part B: relays, vacuum tubes, silicon */
(function () {
  "use strict";
  const { ctx, W, H, lx, LO_W, LO_H, C, clamp, seg, easeOut, easeInOut, lerp, fmt, hexA, hash, text, body, mono, typed, rect, circle, ring,
    poly, glow, background, panel, tag, title, electron, hole, battery, bulb, knife, flowDots, wireCol, blitLo, fadeOut, SC } = window.TR;

  // ---------------------------------------------------------------- relays
  // coil + lever + a second circuit. coil, lever: 0..1
  function relay(t, coil, lever, labels = true) {
    const on = coil > 0.5, shut = lever > 0.5;
    // control circuit (left)
    battery(240, 600, 70, 120);
    const ctl = [[240, 528], [240, 380], [560, 380], [560, 470]], ctl2 = [[560, 630], [560, 820], [430, 820]], ctl3 = [[330, 820], [240, 820], [240, 672]];
    poly(ctl, wireCol(on), 12); poly(ctl2, wireCol(on), 12); poly(ctl3, wireCol(on), 12);
    knife(330, 430, 820, on ? 1 : 0);
    if (labels) text("SWITCH", 380, 890, 28, C.muted);
    if (on) { flowDots([[240, 672], [240, 820], [560, 820], [560, 630]], t, 120, 46, 8); flowDots([[560, 470], [560, 380], [240, 380], [240, 528]], t, 120, 46, 8); }
    // the coil, an electromagnet
    if (on) { ctx.save(); ctx.setLineDash([14, 16]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = hexA(C.cache, 0.8 * coil); ctx.lineWidth = 4;
      [[200, 120], [270, 170]].forEach(([rx, ry]) => { ctx.beginPath(); ctx.ellipse(680, 550, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); }); ctx.restore(); }
    rect(560, 470, 240, 160, on ? "#4a2a8a" : "#2a2450");
    ctx.strokeStyle = C.cache; ctx.lineWidth = 5; ctx.strokeRect(560, 470, 240, 160);
    for (let x = 576; x < 796; x += 22) poly([[x, 470], [x + 14, 630]], on ? "#e0c8ff" : "#6a5aa0", 6);
    if (labels) text(on ? "COIL = MAGNET" : "COIL", 680, 680, 28, on ? C.cache : C.muted);
    // the lever: pivots at the bottom, its top swings left onto the contact
    const ang = -0.11 * lever;
    ctx.save(); ctx.translate(900, 840); ctx.rotate(ang);
    ctx.strokeStyle = "#c9ceff"; ctx.lineWidth = 16; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -460); ctx.stroke(); ctx.lineCap = "butt";
    ctx.restore();
    circle(900, 840, 18, C.cpu);
    if (labels) text("LEVER", 990, 600, 28, C.muted, { align: "left" });
    rect(830, 372, 30, 24, shut ? C.live : "#8a82a8");
    // the output circuit (right)
    const out = [[830, 384], [800, 384], [800, 240], [1250, 240]], out2 = [[1370, 240], [1600, 240], [1600, 470]], out3 = [[1600, 600], [1600, 920], [900, 920], [900, 840]];
    poly(out, wireCol(shut), 12); poly(out2, wireCol(shut), 12); poly(out3, wireCol(shut), 12);
    battery(1600, 540, 70, 120);
    bulb(1310, 240, 40, shut ? 1 : 0);
    if (shut) { flowDots([[1600, 612], [1600, 920], [900, 920], [900, 400]], t, 120, 46, 8); flowDots([[800, 384], [800, 240], [1600, 240], [1600, 468]], t, 120, 46, 8); }
    if (labels) text("SECOND CIRCUIT", 1310, 160, 30, shut ? C.gold : C.muted);
  }
  SC.relay = (lt, d, t) => {
    background(t, 0.4);
    const coil = lt > d * 0.32 ? 1 : 0;
    const lever = easeOut(seg(lt, d * 0.62, d * 0.62 + 0.12));
    relay(t, coil, lever);
    tag("SWITCHES THAT ELECTRICITY CAN FLIP", lt, 0.4, 1010, C.cache);
  };

  // relays in a row, each one's contact powering the next coil; then Zuse's Z3
  SC.relaychain = (lt, d, t) => {
    background(t, 0.4);
    const N = 8, period = 2.6 + N * 0.25;
    const ph = lt % period;
    ctx.save(); ctx.translate(140, 200); ctx.scale(5, 5);
    ctx.fillStyle = "#0e0c1e"; ctx.fillRect(-4, 0, 336, 70);
    for (let i = 0; i < N; i++) {
      const x = 10 + i * 38, on = ph > 0.4 + i * 0.25 && ph < period - 0.5;
      ctx.fillStyle = on ? "#c9a44a" : "#3d3772"; ctx.fillRect(x - 8, 44, 38, 2);
      ctx.fillStyle = on ? "#4a2a8a" : "#2a2450"; ctx.fillRect(x, 30, 16, 12);
      ctx.fillStyle = on ? "#e0c8ff" : "#6a5aa0"; for (let k = 0; k < 16; k += 3) ctx.fillRect(x + k, 30, 1, 12);
      ctx.fillStyle = "#c9ceff"; ctx.fillRect(x + 20, on ? 22 : 18, 1, on ? 20 : 24);
      ctx.fillRect(x + (on ? 17 : 20), on ? 22 : 18, on ? 4 : 1, 1);
      ctx.fillStyle = on ? "#ffe066" : "#2d2856"; ctx.fillRect(x + 4, 10, 8, 8);
      if (on) { ctx.fillStyle = "rgba(255,224,102,.25)"; ctx.fillRect(x + 1, 7, 14, 14); }
    }
    ctx.restore();
    const first = lt < d * 0.3;
    if (first) { text("RELAY: A SWITCH FLIPPED BY ELECTRICITY", W / 2, 120, 50, C.cache, { alpha: seg(lt, 0.3, 0.9) }); body("(this early kind: a magnet and a moving lever)", W / 2, 640, 40, C.muted, { alpha: seg(lt, d * 0.12, d * 0.12 + 0.5) }); }
    else text("ONE RELAY FLIPS THE NEXT", W / 2, 120, 50, C.ink, { alpha: seg(lt, d * 0.3, d * 0.3 + 0.5) });
    const facts = [["1941 · Konrad Zuse's Z3", C.ink, 0.5], ["~2,600 RELAYS", C.cache, 0.68], ["~5 STEPS PER SECOND", C.cpu, 0.84]];
    if (!first) facts.forEach(([s, col, f], i) => (i ? text : body)(s, W / 2, 640 + i * 110, i ? 60 : 66, col, { alpha: seg(lt, d * f, d * f + 0.5) }));
  };

  // a moth, pixel by pixel: forewings, hindwings, body, antennae. flap 0..1 squashes the wings
  function mothSprite(cx, cy, s, flap = 1, pressed = false) {
    const inE = (x, y, ex, ey, rx, ry, a) => { const c = Math.cos(a), sn = Math.sin(a), dx = x - ex, dy = y - ey, u = dx * c + dy * sn, v = -dx * sn + dy * c; return (u * u) / (rx * rx) + (v * v) / (ry * ry); };
    for (let y = -22; y <= 22; y++) for (let x = -34; x <= 34; x++) {
      const ax = Math.abs(x) / Math.max(0.15, flap), sx = Math.sign(x) || 1;
      const fw = inE(ax, y, 15, -5, 17, 8, -0.35), hw = inE(ax, y, 10, 7, 10, 7, 0.4), bd = inE(x, y, 0, 1, 2.6, 13, 0);
      let col = null;
      if (bd <= 1) col = y < -9 ? "#2a2018" : (y % 3 === 0 ? "#4a3a28" : "#3a2e20");
      else if (fw <= 1) { const h = hash(Math.abs(x) * 41 + y * 7); col = fw > 0.8 ? "#4a3e2c" : h > 0.82 ? "#3e3424" : (Math.abs(x) + y) % 7 === 0 ? "#a89670" : "#8a7a5a"; }
      else if (hw <= 1) col = hw > 0.75 ? "#5a4c36" : hash(Math.abs(x) * 13 + y) > 0.85 ? "#6a5a42" : "#7a6a4e";
      if (col) { ctx.fillStyle = col; ctx.fillRect(cx + x * s, cy + y * s, s, s); }
    }
    ctx.fillStyle = "#2a2018";
    for (let k = 0; k < 9; k++) { ctx.fillRect(cx + (-1 - k) * s, cy + (-13 - k) * s, s, s); ctx.fillRect(cx + (1 + k) * s, cy + (-13 - k) * s, s, s); }
    if (pressed) { ctx.fillStyle = "rgba(255,250,220,.12)"; ctx.fillRect(cx - 36 * s, cy - 24 * s, 72 * s, 48 * s); }
  }
  // a relay clacking away, until a moth flies in and jams it; then the 1947 logbook page
  SC.moth = (lt, d, t) => {
    const split = d * 0.42;
    if (lt < split) {
      background(t, 0.4);
      const land = d * 0.26, stuck = lt > land;
      const coil = stuck ? 1 : Math.floor(lt * 2.4) % 2;
      relay(t, coil, stuck ? 0.35 : coil, false);
      // clicks
      if (!stuck && Math.floor(lt * 2.4) % 2 === 1 && (lt * 2.4) % 1 < 0.4) text("CLICK", 1010, 330, 34, C.ink);
      // the moth flutters in from the top right and lands between the contacts
      const k = easeInOut(seg(lt, d * 0.08, land));
      const mx = lerp(1900, 846, k) + Math.sin(lt * 7) * 30 * (1 - k), my = lerp(120, 384, k) + Math.cos(lt * 9) * 40 * (1 - k);
      if (lt > d * 0.08) mothSprite(mx, my, 3, stuck ? 0.55 : 0.4 + 0.6 * Math.abs(Math.sin(lt * 18)));
      text(stuck ? "STUCK" : "CLICK, CLICK, CLICK… EVERY CLICK WEARS IT DOWN", W / 2, 110, 46, stuck ? C.hot : C.muted, { alpha: seg(lt, 0.3, 0.8) });
      if (lt > split - 0.4) rect(0, 0, W, H, `rgba(0,0,0,${seg(lt, split - 0.4, split)})`);
      return;
    }
    lt -= split; d -= split;
    rect(0, 0, W, H, "#1a140c");
    const k = easeOut(seg(lt, 0, 1.0));
    ctx.save(); ctx.translate(W / 2, H / 2 + (1 - k) * 80); ctx.rotate(-0.025);
    rect(-640, -440, 1280, 880, "#e8dcc0");
    for (let y = -360; y < 440; y += 60) rect(-640, y, 1280, 2, "#b8c8d8");
    rect(-520, -440, 3, 880, "#d89090");
    const lines = [["9/9", "0800", "Arctan started"], ["", "1000", "\"   stopped - arctan ✓"], ["", "1100", "Started Cosine Tape (Sine check)"], ["", "1525", "Started Mult+Adder Test."]];
    ctx.fillStyle = "#3a3060"; ctx.font = "italic 500 40px 'Space Grotesk'"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    lines.forEach(([a, b, c], i) => { const y = -385 + i * 60; ctx.fillText(a, -620, y); ctx.fillText(b, -490, y); ctx.fillText(c, -340, y); });
    // the tape and the moth
    mothSprite(0, -64, 4, 0.9, true);
    ctx.fillStyle = "rgba(255,250,220,.55)"; ctx.fillRect(-180, -175, 360, 50); ctx.fillRect(-180, -10, 360, 50);
    ctx.fillStyle = "#3a3060"; ctx.font = "italic 500 40px 'Space Grotesk'";
    ctx.fillText("1545", -490, 80); ctx.fillText("Relay #70 Panel F", -340, 80); ctx.fillText("(moth) in relay.", -340, 140);
    const a = seg(lt, d * 0.55, d * 0.55 + 0.8);
    ctx.globalAlpha = a; ctx.font = "italic 700 46px 'Space Grotesk'"; ctx.fillStyle = "#8a2030";
    ctx.fillText("First actual case of bug being found.", -460, 240);
    ctx.restore();
    tag("1947 · HARVARD MARK II", lt, 0.6);
  };

  // ---------------------------------------------------------------- vacuum tubes
  // deterministic electrons: spawned at a fixed rate, each one's path decided by the grid at its birth
  const TCX = 330, PLATE = 74, GRID = 250, CATH = 292, RATE = 110;
  function tube(t, gridNeg, showGrid, gridA = 1) {
    // brightness: how many electrons born a moment ago made it through
    let made = 0; for (let k = 0; k < 8; k++) made += gridNeg(t - 0.25 - k * 0.04) ? 0 : 1;
    const lit = made / 8;
    const wc = lit > 0.05 ? "#c9a44a" : "#5f5a8f";
    ctx.strokeStyle = wc; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(TCX, PLATE); ctx.lineTo(TCX, 14); ctx.lineTo(600, 14); ctx.lineTo(600, 100); ctx.moveTo(600, 150); ctx.lineTo(600, 230); ctx.moveTo(600, 280); ctx.lineTo(600, 346); ctx.lineTo(TCX, 346); ctx.lineTo(TCX, CATH + 6); ctx.stroke();
    bulb(600, 124, 22, lit);
    battery(600, 255, 34, 50);
    ctx.font = "bold 13px Silkscreen"; ctx.fillStyle = "#9a95c4"; ctx.textAlign = "left"; ctx.fillText("BULB", 634, 130); ctx.fillText("BATTERY", 628, 262);
    ctx.fillStyle = "rgba(160,200,255,.06)"; ctx.strokeStyle = "#7a86b8"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(TCX - 110, 30, 220, 300, 60); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8c92be"; ctx.fillRect(TCX - 70, PLATE - 8, 140, 16);
    const neg = gridNeg(t);
    if (showGrid) {
      ctx.save(); ctx.globalAlpha = gridA;
      ctx.fillStyle = neg ? "#7b86ff" : "#8c92be";
      for (let x = TCX - 80; x <= TCX + 80; x += 14) ctx.fillRect(x, GRID - 2, 8, 4);
      if (neg) { ctx.fillStyle = "#ecebff"; ctx.font = "bold 14px JetBrains Mono"; for (let x = TCX - 70; x <= TCX + 70; x += 46) ctx.fillText("−", x - 4, GRID - 8); }
      ctx.strokeStyle = "#5f5a8f"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(TCX - 84, GRID); ctx.lineTo(120, GRID); ctx.stroke();
      ctx.fillStyle = neg ? "#7b86ff" : "#8c92be"; ctx.fillRect(56, GRID - 20, 68, 40);
      ctx.fillStyle = "#0e0c1e"; ctx.font = "bold 17px JetBrains Mono"; ctx.textAlign = "center"; ctx.fillText(neg ? "−5 V" : "0 V", 90, GRID + 6); ctx.textAlign = "left";
      ctx.font = "bold 13px Silkscreen"; ctx.fillStyle = "#c9ceff"; ctx.fillText("GRID", 62, GRID - 30);
      ctx.restore();
    }
    const heat = 0.8 + 0.2 * Math.sin(t * 13);
    const fg = ctx.createRadialGradient(TCX, CATH, 4, TCX, CATH, 90); fg.addColorStop(0, `rgba(255,140,40,${0.45 * heat})`); fg.addColorStop(1, "rgba(255,140,40,0)"); ctx.fillStyle = fg; ctx.fillRect(TCX - 100, CATH - 80, 200, 120);
    ctx.strokeStyle = `rgb(255,${150 + 60 * heat | 0},60)`; ctx.lineWidth = 4; ctx.beginPath();
    for (let i = 0; i <= 10; i++) ctx.lineTo(TCX - 50 + i * 10, CATH + (i % 2 ? -6 : 6)); ctx.stroke();
    // the electrons
    ctx.fillStyle = "#7bdcff";
    for (let i = Math.floor((t - 1.6) * RATE); i <= Math.floor(t * RATE); i++) {
      const ts = i / RATE, tau = t - ts;
      if (tau < 0) continue;
      const x0 = TCX - 50 + hash(i) * 100, vx = (hash(i + 0.5) - 0.5) * 30, vy0 = -40 - hash(i + 0.25) * 60, y0 = CATH - 6;
      let x = x0 + vx * tau, y;
      if (gridNeg(ts) && showGrid) {
        const T = 0.7, h = 14 + hash(i + 0.75) * 26;
        if (tau > T) continue;
        y = y0 - h * Math.sin((Math.PI * tau) / T);
      } else {
        y = y0 + vy0 * tau - 130 * tau * tau;
        if (y <= PLATE + 8) continue;
      }
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    ctx.font = "bold 13px Silkscreen"; ctx.fillStyle = "#c9ceff"; ctx.textAlign = "left";
    ctx.fillText("PLATE  +100 V", TCX + 80, PLATE + 5); ctx.fillText("HOT FILAMENT  0 V", TCX + 50, CATH + 34);
    ctx.fillStyle = "#9a95c4"; ctx.fillText("VACUUM", TCX - 30, 160);
  }
  const tubeFrame = (fn) => { ctx.save(); ctx.translate(150, 90); ctx.scale(2.3, 2.3); fn(); ctx.restore(); };
  SC.tube = (lt, d, t) => {
    background(t, 0.3);
    // electrons only start flowing once the filament is hot (a third of the way in)
    const tOn = t - lt + d * 0.3;
    tubeFrame(() => tube(t, (ts) => ts < tOn, false));
    tag("CURRENT THROUGH EMPTY SPACE", lt, d * 0.7, 1010, C.e);
  };
  SC.grid = (lt, d, t) => {
    background(t, 0.3);
    const t0 = t - lt;
    // negative for the second quarter, 0 V for the third, then flipping like a switch
    const neg = (ts) => { const l = ts - t0; if (l < d * 0.22) return false; if (l < d * 0.48) return true; if (l < d * 0.72) return false; return Math.floor((l - d * 0.72) / 0.8) % 2 === 0; };
    tubeFrame(() => tube(t, neg, true, seg(lt, 0.2, 0.9)));
    const a = seg(lt, d * 0.75, d * 0.75 + 0.5);
    if (a > 0) { rect(1180, 860, 700, 150, `rgba(7,6,15,${0.85 * a})`); text("A FEW VOLTS", 1530, 900, 46, "#7b86ff", { alpha: a }); text("CONTROL A HUNDRED", 1530, 965, 46, C.gold, { alpha: a }); }
  };

  // ENIAC's 17,000 tubes, all glowing hot
  SC.eniac2 = (lt, d, t) => {
    const g = lx;
    g.fillStyle = "#0b0918"; g.fillRect(0, 0, LO_W, LO_H);
    const pan = seg(lt, 0, d) * 40;
    for (let r = 0; r < 9; r++) for (let c = -2; c < 30; c++) {
      const x = Math.round(c * 10 - pan + (r % 2) * 5), y = 6 + r * 14;
      if (x < -8 || x > LO_W) continue;
      g.fillStyle = "#2a2a3c"; g.fillRect(x + 1, y + 9, 6, 3);
      g.fillStyle = "#3a4058"; g.fillRect(x + 1, y, 6, 9); g.fillRect(x + 2, y - 1, 4, 1);
      const f = hash(r * 50 + c + Math.floor(t * 8) * 0.37);
      g.fillStyle = f > 0.2 ? "#ffb050" : "#d07020"; g.fillRect(x + 3, y + 3, 2, 5);
      g.fillStyle = "rgba(255,150,60,.25)"; g.fillRect(x, y + 1, 8, 8);
    }
    // heat shimmer rising
    for (let i = 0; i < 40; i++) { const x = hash(i) * LO_W, y = LO_H - ((t * 20 + hash(i + 9) * LO_H) % LO_H); g.fillStyle = "rgba(255,180,90,.18)"; g.fillRect(Math.round(x + Math.sin(t * 3 + i) * 2), Math.round(y), 1, 3); }
    blitLo();
    rect(0, 0, W, H, "rgba(7,6,15,.35)");
    const facts = [["~10,000× FASTER THAN A RELAY", C.gold, 0.12], ["ENIAC: ~17,000 TUBES", C.ink, 0.45], ["EVERY FILAMENT GLOWING HOT", C.cpu, 0.72]];
    facts.forEach(([s, col, f], i) => {
      const a = seg(lt, d * f, d * f + 0.5); if (a <= 0) return;
      ctx.font = "60px Silkscreen"; const w = ctx.measureText(s).width;
      rect(W / 2 - w / 2 - 30, 300 + i * 160 - 50, w + 60, 100, `rgba(7,6,15,${0.85 * a})`);
      text(s, W / 2, 300 + i * 160, 60, col, { alpha: a });
    });
  };

  // ---------------------------------------------------------------- silicon
  const LC = 11, LR = 5, SP = 150, LOX = 210, LOY = 330;
  const lpos = (i) => [LOX + (i % LC) * SP, LOY + Math.floor(i / LC) * SP];
  const BONDS = [];
  for (let i = 0; i < LC * LR; i++) { if (i % LC < LC - 1) BONDS.push([i, i + 1]); if (i + LC < LC * LR) BONDS.push([i, i + LC]); }
  const bmid = (b) => { const [a, c] = BONDS[b], p = lpos(a), q = lpos(c); return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; };
  // atoms: {i: "P"|"B"}, holeBond: index of the bond missing an electron, hi: atom to highlight
  function lattice(t, atoms, o = {}) {
    BONDS.forEach((b, k) => {
      const [a, c] = b, p = lpos(a), q = lpos(c), horiz = p[1] === q[1];
      poly([p, q], "#2d2856", 6);
      const [mx, my] = bmid(k);
      const lit = o.hi != null && (a === o.hi || c === o.hi);
      // each bond holds two electrons, one from each atom (the first dot sits on atom a's side)
      const dot = (dx, dy, own) => circle(mx + dx, my + dy, 8, lit ? (own ? C.gold : "#ffffff") : "#b8b0e0");
      if (o.holeBond === k) { dot(horiz ? -12 : 0, horiz ? 0 : -12, a === o.hi); hole(mx + (horiz ? 12 : 0), my + (horiz ? 0 : 12), 12); }
      else { dot(horiz ? -12 : 0, horiz ? 0 : -12, a === o.hi); dot(horiz ? 12 : 0, horiz ? 0 : 12, c === o.hi); }
    });
    // the crystal carries on past the edges of the picture: bonds run off and fade out
    for (let i = 0; i < LC * LR; i++) {
      const [x, y] = lpos(i), col = i % LC, row = Math.floor(i / LC);
      const stubs = [];
      if (col === 0) stubs.push([-1, 0]); if (col === LC - 1) stubs.push([1, 0]); if (row === 0) stubs.push([0, -1]); if (row === LR - 1) stubs.push([0, 1]);
      stubs.forEach(([dx, dy]) => {
        const gr = ctx.createLinearGradient(x, y, x + dx * 110, y + dy * 110); gr.addColorStop(0, "#2d2856"); gr.addColorStop(1, "rgba(45,40,86,0)");
        ctx.strokeStyle = gr; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 110, y + dy * 110); ctx.stroke();
        circle(x + dx * 63, y + dy * 63, 8, "rgba(184,176,224,.7)"); circle(x + dx * 87, y + dy * 87, 8, "rgba(184,176,224,.3)");
      });
    }
    for (let i = 0; i < LC * LR; i++) {
      const [x, y] = lpos(i), a = atoms[i] || "Si";
      circle(x, y, 40, a === "P" ? "#11917b" : a === "B" ? "#a3244f" : "#3d3772");
      if (o.hi === i) ring(x, y, 52 + 6 * Math.sin(t * 5), C.gold, 5);
      mono(a, x, y + 2, 30, C.ink);
    }
  }
  SC.lattice = (lt, d, t) => {
    background(t, 0.3);
    const a = seg(lt, 0, 0.8);
    ctx.save(); ctx.globalAlpha = a; lattice(t, {}, { hi: lt > d * 0.18 && lt < d * 0.6 ? 27 : null }); ctx.restore();
    title("A SILICON CRYSTAL", lt, 0.3, 130, 60, C.ink);
    if (lt > d * 0.18 && lt < d * 0.6) {
      const a = seg(lt, d * 0.18, d * 0.18 + 0.5);
      text("4 OF ITS OWN", W / 2 - 330, 220, 40, C.gold, { alpha: a });
      text("+ 4 SHARED BY NEIGHBOURS", W / 2 + 230, 220, 40, C.ink, { alpha: a });
    }
    if (lt >= d * 0.6) text("EVERY ELECTRON LOCKED IN PLACE", W / 2, 220, 40, "#b8b0e0", { alpha: seg(lt, d * 0.6, d * 0.6 + 0.5) });
    const v = seg(lt, d * 0.78, d * 0.78 + 0.5);
    if (v > 0) {
      rect(0, 0, 18, H, hexA(C.sky, 0.4 * v)); rect(W - 18, 0, 18, H, hexA(C.hot, 0.4 * v));
      mono("−", 50, 330, 50, C.sky, { alpha: v }); mono("+", W - 50, 330, 50, C.hot, { alpha: v });
      rect(W / 2 - 380, 990, 760, 80, `rgba(7,6,15,${0.85 * v})`);
      text("CURRENT: ~0", W / 2, 1030, 48, C.muted, { alpha: v });
    }
  };
  // a free electron wandering through the lattice (smooth, deterministic)
  const wander = (t, sx, sy, k, drift = 0) => [sx + Math.sin(t * 0.9 + k) * 180 + Math.sin(t * 2.3 + k * 2) * 60 + drift, sy + Math.sin(t * 1.3 + k * 3) * 110 + Math.cos(t * 2.9 + k) * 40];
  SC.doping = (lt, d, t) => {
    background(t, 0.3);
    const P = lt > d * 0.12, B = lt > d * 0.55;
    const atoms = {}; if (P) atoms[24] = "P"; if (B) atoms[30] = "B";
    // the hole hops along bonds next to the boron
    const hb = [BONDS.findIndex((b) => b[0] === 30 && b[1] === 31), BONDS.findIndex((b) => b[0] === 29 && b[1] === 30), BONDS.findIndex((b) => b[0] === 19 && b[1] === 30), BONDS.findIndex((b) => b[0] === 30 && b[1] === 41)];
    const holeBond = B ? hb[Math.floor(lt * 1.5) % 4] : null;
    lattice(t, atoms, { holeBond });
    if (P) {
      const pk = seg(lt, d * 0.12, d * 0.12 + 1.2), [px, py] = lpos(24), [wx, wy] = wander(t, px, py - 70, 1);
      const x = lerp(px + 20, wx, pk), y = lerp(py - 20, wy, pk);
      glow(x, y, 40, C.e, 0.4); electron(x, y, 13);
      if (pk > 0.3) text("FREE!", x, y - 40, 26, C.e);
      const a = seg(lt, d * 0.3, d * 0.3 + 0.5);
      text("PHOSPHORUS: 5 OUTER ELECTRONS", 560, 150, 38, C.gpu, { alpha: a });
      text("N-TYPE", 560, 220, 60, C.gpu, { alpha: seg(lt, d * 0.42, d * 0.42 + 0.5), glow: 12 });
    }
    if (B) {
      const a = seg(lt, d * 0.6, d * 0.6 + 0.5);
      text("BORON: ONLY 3", 1420, 150, 38, C.hot, { alpha: a });
      text("P-TYPE", 1420, 220, 60, C.hot, { alpha: seg(lt, d * 0.85, d * 0.85 + 0.5), glow: 12 });
      const [hx, hy] = bmid(holeBond);
      if (lt > d * 0.7) text("A HOLE", hx, hy + 60, 26, C.hot, { alpha: seg(lt, d * 0.7, d * 0.7 + 0.4) });
    }
  };
})();
