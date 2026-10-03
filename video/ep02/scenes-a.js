/* EP 02 scenes, part A: the hook, electricity, and switches that decide */
(function () {
  "use strict";
  const { ctx, W, H, lx, LO_W, LO_H, C, clamp, seg, easeOut, easeInOut, lerp, fmt, hexA, hash, text, body, mono, typed, rect, circle, ring,
    poly, glow, background, panel, tag, title, electron, hole, battery, bulb, knife, flowDots, wireCol, blitLo, fadeOut, SC } = window.TR;

  // ---------------------------------------------------------------- the hook
  // ENIAC: a room of cabinets full of glowing tubes; one burns out
  SC.eniac = (lt, d, t) => {
    const g = lx;
    g.fillStyle = "#14122a"; g.fillRect(0, 0, LO_W, 92);
    g.fillStyle = "#0d0b1c"; g.fillRect(0, 92, LO_W, LO_H - 92);
    for (let i = -10; i < 22; i++) { g.fillStyle = "#1a1730"; for (let y = 92; y < LO_H; y++) g.fillRect(Math.round(120 + (i * 12 - 120) * (1 + (y - 92) / 20)), y, 1, 1); }
    g.fillStyle = "#211e3c"; g.fillRect(0, 26, LO_W, 2);
    const burn = d * 0.72; // when one tube dies
    for (let c = 0; c < 10; c++) {
      const x = 6 + c * 23, y = 34;
      g.fillStyle = "#2c2848"; g.fillRect(x, y, 20, 56);
      g.fillStyle = "#3a3560"; g.fillRect(x, y, 20, 2); g.fillRect(x, y, 1, 56);
      g.fillStyle = "#1a1730"; g.fillRect(x + 2, y + 44, 16, 9);
      for (let r = 0; r < 9; r++) for (let k = 0; k < 4; k++) {
        const id = c * 100 + r * 10 + k, x2 = x + 3 + k * 4, y2 = y + 4 + r * 4;
        const fl = hash(id + Math.floor(t * 7) * 0.13);
        let col = fl > 0.15 ? "#ff9a3a" : "#c8641e";
        if (id === 512) {
          if (lt > burn && lt < burn + 0.15) col = "#ffffff";
          else if (lt >= burn + 0.15) col = "#2a1a10";
        }
        g.fillStyle = col; g.fillRect(x2, y2, 2, 2);
      }
    }
    // cables snaking along the floor, and a person for scale
    g.fillStyle = "#3a3560"; for (let x = 0; x < LO_W; x += 2) g.fillRect(x, 96 + Math.round(Math.sin(x * 0.11) * 2), 2, 1);
    g.fillStyle = "#0a0914"; g.fillRect(150, 100, 5, 4); g.fillRect(149, 104, 7, 12); g.fillRect(150, 116, 2, 8); g.fillRect(153, 116, 2, 8);
    blitLo();
    if (lt > burn && lt < burn + 0.6) glow(6 + 5 * 23 + 3 + 2 * 4 + 1, 34 + 4 + 1 * 4 + 1, 220 * (1 - seg(lt, burn, burn + 0.6)), "#ffffff", 0.9);
    tag("1945 · ENIAC", lt, 0.3);
    const facts = [["27 TONNES", 0.18], ["~150 KILOWATTS", 0.42], ["A TUBE DIED EVERY ~2 DAYS", 0.7]];
    facts.forEach(([s, f], i) => {
      const a = seg(lt, d * f, d * f + 0.5);
      if (a <= 0) return;
      ctx.font = "50px Silkscreen";
      const w = ctx.measureText(s).width;
      rect(W - 90 - w - 40, 70 + i * 96, w + 50, 78, `rgba(7,6,15,${0.8 * a})`);
      text(s, W - 90, 110 + i * 96, 50, i === 2 ? C.hot : C.gold, { align: "right", alpha: a });
    });
  };

  // a phone, glowing, next to the numbers
  function drawPhone(x, y, w, h, t, on = 1) {
    rect(x - 10, y - 10, w + 20, h + 20, "#050507");
    rect(x - 10, y - 10, w + 20, 4, "#3a3a46");
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#1b1640"); g.addColorStop(1, "#3a1a50");
    ctx.save(); ctx.globalAlpha = on; ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // a little app grid
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
      const cols = [C.gpu, C.cpu, C.hot, C.sky, C.gold, C.cache];
      rect(x + 24 + c * ((w - 48) / 4), y + 70 + r * ((w - 48) / 4), (w - 48) / 4 - 18, (w - 48) / 4 - 18, cols[(r * 4 + c) % 6]);
    }
    rect(x + 20, y + 20, 50, 8, C.ink); rect(x + w - 60, y + 18, 34, 14, C.gpu); rect(x + w - 26, y + 22, 4, 6, C.gpu);
    ctx.restore();
  }
  SC.phone = (lt, d, t) => {
    background(t);
    const k = easeOut(seg(lt, 0, 0.8));
    // ENIAC shrinks away to the left; the phone rises on the right
    ctx.save(); ctx.globalAlpha = 0.9;
    for (let c = 0; c < 6; c++) { rect(170 + c * 70, 420, 60, 220, "#2c2848"); for (let r = 0; r < 10; r++) for (let q = 0; q < 3; q++) rect(182 + c * 70 + q * 16, 436 + r * 18, 8, 8, hash(c * 99 + r * 7 + q + Math.floor(t * 6)) > 0.2 ? "#ff9a3a" : "#c8641e"); }
    ctx.restore();
    text("ENIAC", 375, 690, 40, C.muted);
    mono("~5,000 additions / s", 375, 750, 34, C.cpu);
    const py = lerp(1200, 270, k);
    glow(1440, py + 280, 520, C.sky, 0.25);
    drawPhone(1300, py, 280, 540, t);
    text("YOUR PHONE", 1440, py + 610, 40, C.muted);
    mono("~1,000,000,000,000 / s", 1440, py + 670, 34, C.gpu, { alpha: seg(lt, 1.0, 1.6) });
    const a = seg(lt, d * 0.35, d * 0.35 + 0.6);
    mono("×", 860, 520, 140, C.ink, { alpha: a });
    text("HUNDREDS OF MILLIONS", 860, 640, 44, C.gold, { alpha: a });
    // on a battery, all day
    const b = seg(lt, d * 0.7, d * 0.7 + 0.5);
    if (b > 0) {
      ctx.save(); ctx.globalAlpha = b;
      rect(1640, py + 40, 120, 56, "#0e0c1e"); ctx.strokeStyle = C.gpu; ctx.lineWidth = 5; ctx.strokeRect(1640, py + 40, 120, 56); rect(1760, py + 56, 10, 24, C.gpu);
      rect(1650, py + 50, 100 * (0.95 - 0.1 * seg(lt, d * 0.7, d)), 36, C.gpu);
      ctx.restore();
      mono("ALL DAY", 1700, py + 130, 30, C.gpu, { alpha: b });
    }
  };

  // one switch, then billions; none of them move
  function miniSwitch(x, y, s, on) {
    // a tiny switch glyph: two contacts and a lever
    ctx.fillStyle = on ? C.gpu : "#2a2450";
    ctx.fillRect(x, y, s, s);
    if (s >= 10) { ctx.fillStyle = on ? "#c9fff1" : C.dim; ctx.fillRect(x + s * 0.15, y + s * 0.45, s * 0.7, s * 0.12); }
  }
  SC.switches = (lt, d, t) => {
    background(t, 0.5);
    const z = easeInOut(seg(lt, 0.6, d * 0.55));
    const cell = lerp(520, 12, Math.pow(z, 0.5)) ;
    if (cell > 200) {
      // the single big switch, flipping
      const on = Math.floor(lt * 1.2) % 2 === 1, x0 = W / 2 - 260, y0 = H / 2;
      poly([[x0 - 300, y0], [x0, y0]], wireCol(on), 14); poly([[x0 + 520, y0], [x0 + 820, y0]], wireCol(on), 14);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(cell / 520, cell / 520); ctx.translate(-W / 2, -H / 2);
      knife(x0, x0 + 520, y0, on ? 1 : 0); ctx.restore();
    } else {
      const cols = Math.ceil(W / cell) + 2, rows = Math.ceil(H / cell) + 2, ox = W / 2 - (cols / 2) * cell, oy = H / 2 - (rows / 2) * cell;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const on = Math.sin(t * 5 + c * 0.7 + r * 1.3 + hash(r * 999 + c) * 6) > 0;
        miniSwitch(ox + c * cell, oy + r * cell, cell * 0.8, on);
      }
      rect(0, 0, W, H, `rgba(7,6,15,${0.35 * z})`);
    }
    const a = seg(lt, d * 0.45, d * 0.45 + 0.6);
    if (a > 0) { rect(W / 2 - 720, 330, 1440, 170, `rgba(7,6,15,${0.85 * a})`); mono("~20,000,000,000", W / 2, 415, 110, C.gpu, { alpha: a, glow: 20 }); }
    const b = seg(lt, d * 0.78, d * 0.78 + 0.5);
    if (b > 0) { rect(W / 2 - 520, 560, 1040, 130, `rgba(7,6,15,${0.85 * b})`); text("MOVING PARTS: 0", W / 2, 625, 70, C.gold, { alpha: b }); }
  };

  // sand, a rock, the question, then the title card
  SC.question = (lt, d, t, s) => {
    const g = lx;
    g.fillStyle = "#07060f"; g.fillRect(0, 0, LO_W, LO_H);
    // a dune of sand grains, sparkling
    for (let x = 0; x < LO_W; x++) {
      const top = 92 + Math.round(10 * Math.sin(x * 0.03) + 5 * Math.sin(x * 0.11 + 1));
      for (let y = top; y < LO_H; y++) { const h = hash(x * 300 + y); g.fillStyle = h > 0.96 ? "#fff3c8" : h > 0.6 ? "#d9b77a" : h > 0.3 ? "#c4a064" : "#a8864e"; g.fillRect(x, y, 1, 1); }
    }
    // a lump of silicon: grey, metallic, faceted
    const rx = 120, ry = 70;
    const SI = [[0, -14], [12, -10], [18, 0], [14, 10], [0, 14], [-14, 10], [-18, -2], [-10, -12]];
    g.fillStyle = "#6a6f8a"; g.beginPath(); SI.forEach(([x, y], i) => (i ? g.lineTo(rx + x, ry + y) : g.moveTo(rx + x, ry + y))); g.fill();
    g.fillStyle = "#9aa0c0"; g.beginPath(); g.moveTo(rx, ry - 14); g.lineTo(rx + 12, ry - 10); g.lineTo(rx + 4, ry); g.lineTo(rx - 10, ry - 12); g.fill();
    g.fillStyle = "#454a62"; g.beginPath(); g.moveTo(rx + 4, ry); g.lineTo(rx + 14, ry + 10); g.lineTo(rx, ry + 14); g.fill();
    if (Math.sin(t * 2) > 0.7) { g.fillStyle = "#ffffff"; g.fillRect(rx + 6, ry - 9, 1, 1); }
    blitLo();
    const sp = s.speech;
    const end = sp + 0.2; // title card after the voice
    const qa = 1 - seg(lt, end, end + 0.4);
    title("SILICON", lt, 0.3, 200, 64, "#c9ceff", { alpha: qa });
    title("THE MAIN INGREDIENT OF SAND", lt, 1.4, 280, 36, C.muted, { alpha: qa });
    if (lt > sp * 0.62 && qa > 0) {
      rect(0, 860, W, 140, `rgba(7,6,15,${0.8 * seg(lt, sp * 0.62, sp * 0.62 + 0.4) * qa})`);
      text("HOW DO YOU MAKE A SWITCH OUT OF A ROCK?", W / 2, 930, 56, C.gold, { alpha: seg(lt, sp * 0.62, sp * 0.62 + 0.5) * qa });
    }
    const ta = seg(lt, end + 0.2, end + 0.8);
    if (ta > 0) {
      rect(0, 0, W, H, `rgba(0,0,0,${0.82 * ta})`);
      text("TRICKED", W / 2 - 160, H / 2 - 110, 70, C.ink, { alpha: ta });
      text("ROCKS", W / 2 + 200, H / 2 - 110, 70, C.gpu, { alpha: ta });
      text("EP 02", W / 2, H / 2 - 20, 40, C.muted, { alpha: ta });
      text("THE SWITCH", W / 2, H / 2 + 90, 150, C.cpu, { alpha: seg(lt, end + 0.5, end + 1.1), glow: 30 });
    }
  };

  // ---------------------------------------------------------------- electricity
  // a copper wire, and a magnifying lens onto its atoms and free electrons
  SC.wire = (lt, d, t) => {
    background(t, 0.5);
    // the small circuit: battery, wire, bulb (open: nothing flows yet)
    const k = seg(lt, 0, 0.6);
    ctx.save(); ctx.globalAlpha = k;
    battery(200, 760, 60, 100);
    poly([[200, 700], [200, 600], [1720, 600], [1720, 720]], C.copper, 14);
    poly([[200, 820], [200, 900], [1720, 900], [1720, 800]], C.copper, 14);
    bulb(1720, 760, 34, 0);
    ctx.restore();
    // the lens
    const L = easeOut(seg(lt, 0.8, 2.0)), cx = 960, cy = 380, R = 330 * L;
    if (R > 4) {
      ctx.strokeStyle = hexA(C.ink, 0.25 * L); ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(cx - R * 0.7, cy + R * 0.7); ctx.lineTo(900, 600); ctx.moveTo(cx + R * 0.7, cy + R * 0.7); ctx.lineTo(1020, 600); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      rect(cx - R, cy - R, 2 * R, 2 * R, "#160d08");
      const sp = 76;
      for (let r = -5; r <= 5; r++) for (let c = -6; c <= 6; c++) {
        const x = cx + c * sp + (r % 2 ? sp / 2 : 0), y = cy + r * sp * 0.87;
        const jx = Math.sin(t * 9 + r * 3 + c) * 2, jy = Math.cos(t * 8 + c * 2 + r) * 2;
        circle(x + jx, y + jy, 24, "#8a4a22"); circle(x + jx - 6, y + jy - 6, 9, "#b0683a");
        mono("+", x + jx, y + jy + 2, 22, "#ffd0a0");
      }
      // the free electrons wander between the atoms
      const show = seg(lt, d * 0.45, d * 0.45 + 0.8);
      for (let i = 0; i < 70; i++) {
        const bx = cx + (hash(i) - 0.5) * 2 * R, by = cy + (hash(i + 77) - 0.5) * 2 * R;
        const x = bx + Math.sin(t * (1.3 + hash(i + 5)) + i) * 40, y = by + Math.cos(t * (1.1 + hash(i + 9)) + i * 2) * 40;
        electron(x, y, 11, show);
      }
      ctx.restore();
      ring(cx, cy, R, "#c9ceff", 8);
    }
    if (lt > 1.8) { text("COPPER ATOMS", 330, 230, 38, "#e0a070", { alpha: seg(lt, 1.8, 2.4) }); }
    if (lt > d * 0.45) { text("FREE ELECTRONS", 1600, 230, 38, C.e, { alpha: seg(lt, d * 0.45, d * 0.45 + 0.6) }); electron(1600, 290, 16, seg(lt, d * 0.45, d * 0.45 + 0.6)); }
  };

  // the push: closing a switch sends a wave down a wire already full of electrons
  SC.pulse = (lt, d, t) => {
    background(t, 0.4);
    ctx.save(); ctx.translate(48, 240); ctx.scale(2.4, 2.4);
    const X0 = 130, X1 = 650, WY = 100, NE = 32, SPN = (X1 - X0) / NE, FRONT = 210, DRIFT = 3;
    const tc = 1.2, closed = lt > tc, el = closed ? lt - tc : 0, front = closed ? Math.min(X1, X0 + el * FRONT) : X0;
    ctx.fillStyle = "#2a2450"; ctx.strokeStyle = "#b58cff"; ctx.lineWidth = 3; ctx.fillRect(30, WY - 30, 40, 60); ctx.strokeRect(30, WY - 30, 40, 60);
    ctx.fillStyle = "#b58cff"; ctx.fillRect(30, WY - 30, 40, 14);
    ctx.fillStyle = "#0e0c1e"; ctx.font = "bold 13px JetBrains Mono"; ctx.textAlign = "center"; ctx.fillText("+", 50, WY - 19);
    ctx.strokeStyle = closed ? "#c9a44a" : "#5f5a8f"; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(70, WY); ctx.lineTo(84, WY); ctx.moveTo(124, WY); ctx.lineTo(X1, WY); ctx.stroke();
    const ang = -0.6 * (1 - seg(lt, tc - 0.15, tc));
    ctx.strokeStyle = "#ffab40"; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(84, WY); ctx.lineTo(84 + 40 * Math.cos(ang), WY + 40 * Math.sin(ang)); ctx.stroke(); ctx.lineCap = "butt";
    for (let i = 0; i < NE; i++) {
      const bx = X0 + (i + 0.5) * SPN, behind = front - bx;
      const disp = behind > 0 ? Math.min(SPN * 0.6, (behind / FRONT) * DRIFT + (front >= X1 ? (el - (X1 - X0) / FRONT) * 0.25 : 0)) : 0;
      const inWave = closed && behind > 0 && behind < 46 && front < X1;
      const x = bx + disp + Math.sin(t * 9 + i) * 1.2, y = WY + Math.cos(t * 7 + i * 1.7) * 2;
      if (i === 2) { circle(x, y, 5, C.hot); ctx.fillStyle = C.hot; ctx.font = "bold 12px Silkscreen"; ctx.textAlign = "center"; ctx.fillText("MARKED ELECTRON", bx, WY + 34); }
      else if (inWave) circle(x, y, 6, C.gold);
      else electron(x, y, 4.5);
    }
    if (closed && front < X1) { const gw = ctx.createLinearGradient(front - 60, 0, front, 0); gw.addColorStop(0, "rgba(255,224,102,0)"); gw.addColorStop(1, "rgba(255,224,102,.35)"); ctx.fillStyle = gw; ctx.fillRect(front - 60, WY - 18, 60, 36); }
    const lit = closed && front >= X1;
    bulb(X1 + 40, WY, 22, lit ? 1 : 0);
    ctx.fillStyle = "#9a95c4"; ctx.font = "bold 13px Silkscreen"; ctx.textAlign = "center"; ctx.fillText("BATTERY", 50, WY + 50); ctx.fillText("SWITCH", 104, WY - 30);
    ctx.restore();
    const a1 = seg(lt, d * 0.3, d * 0.3 + 0.6), a2 = seg(lt, d * 0.62, d * 0.62 + 0.6);
    text("THE PUSH", 560, 760, 44, C.gold, { alpha: a1 });
    mono("~2/3 the speed of light", 560, 830, 40, C.gold, { alpha: a1 });
    text("EACH ELECTRON", 1380, 760, 44, C.hot, { alpha: a2 });
    mono("~0.1 mm per second", 1380, 830, 40, C.hot, { alpha: a2 });
    body("(both slowed down enormously here)", W / 2, 960, 30, C.dim, { alpha: a1 });
  };

  // the battery: chemistry piles electrons at −, leaves a shortage at +, and the imbalance pushes the loop
  function loopScene(lt, d, t, volts, opts = {}) {
    ctx.save(); ctx.translate(100, 70); ctx.scale(2.25, 2.25);
    const L = 110, R = 650, T = 70, B = 290, BT = 150, BB = 210;
    const pts = [[L, BB], [L, B], [R, B], [R, T], [L, T], [L, BT]];
    const live = volts > 0.3;
    poly([[L, BB], [L, B], [R, B], [R, T], [L, T], [L, BT]], wireCol(live), 12);
    // electrons drifting − → + around the loop
    const P = 2 * (R - L) + 2 * (B - T) - (BB - BT), N = 60, v = volts * 9;
    for (let i = 0; i < N; i++) {
      let u = ((i / N) * P + t * v) % P;
      const [x, y] = window.TR.pathAt(pts, u);
      if (opts.hideNearBulb && Math.hypot(x - R, y - 172) < 40) continue;
      electron(x + Math.sin(t * 9 + i) * 1.5, y + Math.cos(t * 8 + i) * 1.5, 4.2);
    }
    battery(L, (BT + BB) / 2, 48, BB - BT);
    // separated charge: extra electrons at −, missing ones (holes) at +
    const piles = Math.round(volts * 1.4);
    for (let i = 0; i < piles; i++) electron(L - 34 - (i % 4) * 10, BB - 4 + Math.floor(i / 4) * 10, 3.8);
    for (let i = 0; i < piles; i++) hole(L - 34 - (i % 4) * 10, BT + 4 - Math.floor(i / 4) * 10, 4);
    if (piles > 0) {
      ctx.fillStyle = "#9a95c4"; ctx.font = "bold 12px JetBrains Mono"; ctx.textAlign = "right";
      ctx.fillText("shortage of e⁻", L - 26, BT - 30); ctx.fillText("extra e⁻", L - 26, BB + 40); ctx.textAlign = "left";
    }
    // push arrows all along the wire
    if (live) {
      const size = 4 + volts * 1.3;
      for (let u = 40; u < P; u += 130) {
        const [ax, ay] = window.TR.pathAt(pts, u), [bx, by] = window.TR.pathAt(pts, u + 2), ang = Math.atan2(by - ay, bx - ax);
        const vert = Math.abs(Math.sin(ang)) > 0.5;
        ctx.save(); ctx.translate(ax + (vert ? 22 * Math.sign(R - ax - 1) : 0), ay - (vert ? 0 : 20)); ctx.rotate(ang);
        ctx.strokeStyle = "rgba(255,224,102,.85)"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-size, -size * 0.6); ctx.lineTo(0, 0); ctx.lineTo(-size, size * 0.6); ctx.stroke(); ctx.restore();
      }
    }
    bulb(R, 172, 26, clamp(volts / 6, 0, 1));
    ctx.fillStyle = "#ecebff"; ctx.font = "bold 15px Silkscreen"; ctx.textAlign = "right"; ctx.fillText("BULB", R - 40, 178);
    ctx.textAlign = "left"; ctx.fillText("BATTERY", L + 36, 176);
    ctx.fillStyle = C.gold; ctx.font = "bold 18px JetBrains Mono"; ctx.fillText(`${volts.toFixed(1)} V`, L + 36, 200);
    ctx.restore();
  }
  SC.battery = (lt, d, t) => {
    background(t, 0.4);
    const volts = 3 * easeInOut(seg(lt, 1.0, d * 0.4)) + 3 * easeInOut(seg(lt, d * 0.74, d * 0.84));
    loopScene(lt, d, t, volts);
    tag("CHEMISTRY SEPARATES CHARGE", lt, 0.6, 1010, C.cache);
    const a = seg(lt, d * 0.5, d * 0.5 + 0.6) * (1 - seg(lt, d * 0.72, d * 0.74));
    if (a > 0) { rect(W / 2 + 60, 965, 900, 90, `rgba(7,6,15,${0.85 * a})`); body("like charges repel, opposite charges attract", W / 2 + 510, 1010, 38, C.ink, { alpha: a }); }
    const b = seg(lt, d * 0.76, d * 0.76 + 0.5);
    if (b > 0) { rect(W / 2 - 80, 940, 1060, 130, `rgba(7,6,15,${0.85 * b})`); text("BIGGER IMBALANCE", W / 2 + 450, 975, 38, C.ink, { alpha: b }); text("= HARDER PUSH = VOLTAGE", W / 2 + 450, 1035, 38, C.gold, { alpha: b }); }
  };

  // voltage = the energy each electron picks up per trip; it's handed over in the bulb
  SC.voltage = (lt, d, t) => {
    background(t, 0.4);
    const split = d * 0.56, a1 = 1 - seg(lt, split - 0.4, split);
    if (a1 > 0) {
      ctx.save(); ctx.globalAlpha = a1;
      const V = lt < d * 0.3 ? 1.5 : 3, Lx = 360, Rx = 1560, T = 300, B = 760, BY = 530;
      const pts = [[Lx, BY + 60], [Lx, B], [Rx, B], [Rx, T], [Lx, T], [Lx, BY - 60]];
      poly([[Lx, BY + 60], [Lx, B], [Rx, B], [Rx, T], [Lx, T], [Lx, BY - 60]], C.live, 14);
      const P = window.TR.pathLen(pts);
      for (let i = 0; i < 40; i++) { const [x, y] = window.TR.pathAt(pts, ((i / 40) * P + t * 160) % P); electron(x, y, 9); }
      battery(Lx, BY, 90, 140);
      bulb(Rx, BY, 50, V / 3);
      // the marked electron: full of energy from the battery until it passes through the bulb
      const per = P / 230, u = ((lt / per) % 1) * P, [mx, my] = window.TR.pathAt(pts, u);
      const onRight = Math.abs(mx - Rx) < 1 && u > (B - BY) + (Rx - Lx) + 60;
      const passed = u > 60 + (B - BY) + (Rx - Lx) + (B - BY) + 40;
      const E = passed ? 0 : onRight ? clamp((my - (BY - 40)) / 120, 0, 1) : 1;
      if (onRight && E < 1 && E > 0) for (let k = 0; k < 6; k++) rect(mx - 40 + hash(k + Math.floor(t * 20)) * 80, my - 40 + hash(k * 3 + Math.floor(t * 20)) * 80, 8, 8, "#fff3c8");
      glow(mx, my, 40 + 70 * E * (V / 3), C.gold, 0.8 * E);
      circle(mx, my, 14, E > 0.05 ? C.gold : C.e);
      rect(mx - 50, my - 62, 100, 16, "#17142e"); rect(mx - 50, my - 62, 100 * E * (V / 3), 16, C.gold);
      text("ENERGY", mx, my - 82, 22, C.gold);
      mono(`${V} V`, Lx + 100, BY - 20, 70, C.gold, { align: "left" });
      body(V < 3 ? "each electron gets a small kick" : "double the voltage: twice the energy per electron", W / 2, 900, 40, C.ink, { alpha: seg(lt, V < 3 ? 0.5 : d * 0.3, (V < 3 ? 0.5 : d * 0.3) + 0.5) });
      ctx.restore();
    }
    // the filament up close: electrons crash into the atoms, which shake, heat up and glow
    const k3 = seg(lt, split, split + 0.6), heat = seg(lt, split + 0.3, d * 0.92);
    if (k3 <= 0) return;
    ctx.save(); ctx.globalAlpha = k3;
    panel(260, 200, 1400, 680, C.line);
    ctx.beginPath(); ctx.rect(264, 204, 1392, 672); ctx.clip();
    if (heat > 0) glow(960, 540, 760, "#ff9a3a", 0.35 * heat);
    for (let r = 0; r < 7; r++) for (let c = 0; c < 15; c++) {
      const x = 330 + c * 90 + (r % 2) * 45, y = 260 + r * 92, sh = 2 + heat * 7;
      circle(x + Math.sin(t * 23 + r * 7 + c * 3) * sh, y + Math.cos(t * 19 + c * 5 + r) * sh, 26, `rgb(${110 + 145 * heat | 0},${70 + 120 * heat | 0},${60 - 20 * heat | 0})`);
    }
    for (let i = 0; i < 46; i++) {
      const u = (t * 0.18 + hash(i + 3)) % 1, x = 270 + u * 1380, y = 230 + hash(i) * 620 + Math.sin(u * 40 + i) * 30;
      electron(x, y, 10);
      if (heat > 0 && Math.sin(u * 40 + i) > 0.97) glow(x, y, 50, "#ffffff", 0.8 * heat);
    }
    for (let i = 0; i < 30 * heat; i++) rect(300 + hash(i * 7 + Math.floor(t * 12)) * 1320, 220 + hash(i * 13 + Math.floor(t * 12)) * 640, 6, 6, "#fff3c8");
    ctx.restore();
    text("INSIDE THE BULB'S THIN WIRE", 960, 150, 40, C.muted, { alpha: k3 });
    text("HEAT + LIGHT", 960, 960, 64, C.gold, { alpha: heat, glow: 20 });
  };

  // ---------------------------------------------------------------- switches decide
  // two circuits: A and B in series (AND), and side by side (OR)
  function andOrPanel(ox, oy, kind, A, B, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(ox, oy);
    const on = kind === "AND" ? A && B : A || B;
    panel(0, 0, 820, 560, on ? C.gpuDeep : C.line);
    const L = 110, R = 690, T = 150, Bm = 440;
    battery(L, 300, 60, 110);
    poly([[L, 360], [L, Bm], [R, Bm], [R, 340]], wireCol(on), 10);
    bulb(R, 300, 30, on ? 1 : 0);
    if (kind === "AND") {
      poly([[L, 240], [L, T], [220, T]], wireCol(on), 10); poly([[320, T], [430, T]], wireCol(on), 10); poly([[530, T], [R, T], [R, 266]], wireCol(on), 10);
      knife(220, 320, T, A ? 1 : 0); knife(430, 530, T, B ? 1 : 0);
      text("A", 270, T - 60, 40, C.cpu); text("B", 480, T - 60, 40, C.cpu);
    } else {
      const T2 = 300;
      poly([[L, 240], [L, T], [300, T]], wireCol(on), 10); poly([[400, T], [R, T], [R, 266]], wireCol(on), 10);
      poly([[220, T], [220, T2 - 40], [300, T2 - 40]], wireCol(on && B), 10); poly([[400, T2 - 40], [480, T2 - 40], [480, T]], wireCol(on && B), 10);
      knife(300, 400, T, A ? 1 : 0); knife(300, 400, T2 - 40, B ? 1 : 0);
      text("A", 350, T - 60, 40, C.cpu); text("B", 350, T2 - 100, 40, C.cpu);
    }
    text(kind, 410, 510, 50, on ? C.gpu : C.muted);
    ctx.restore();
  }
  function breakIntro(lt, d, t) {
    // a complete loop, then cut, then the cut becomes a switch
    const cut = lt > d * 0.11, isSwitch = lt > d * 0.24, closed = isSwitch ? Math.floor((lt - d * 0.24) / 1.1) % 2 === 1 : !cut;
    const L = 460, R = 1460, T = 330, B = 780, G0 = 860, G1 = 1060;
    battery(L, 555, 90, 150);
    poly([[L, 630], [L, B], [R, B], [R, 600]], wireCol(closed), 14);
    poly([[R, 510], [R, T], [G1, T]], wireCol(closed), 14); poly([[G0, T], [L, T], [L, 480]], wireCol(closed), 14);
    if (isSwitch) knife(G0, G1, T, closed ? 1 : 0);
    else if (!cut) poly([[G0, T], [G1, T]], wireCol(true), 14);
    else { poly([[G0, T], [G0 + 60, T - 10]], C.wire, 14); poly([[G1, T], [G1 - 60, T + 12]], C.wire, 14); }
    bulb(R, 555, 50, closed ? 1 : 0);
    if (closed) { flowDots([[L, 630], [L, B], [R, B], [R, 600]], t, 140, 50, 10); flowDots([[R, 510], [R, T], [L, T], [L, 480]], t, 140, 50, 10); }
    else { // everything stops: the electrons sit still
      for (let x = L + 30; x < R; x += 50) { electron(x, B, 10); if (x < G0 || x > G1) electron(x, T, 10); }
    }
    const s1 = !cut ? "A COMPLETE LOOP: CURRENT FLOWS" : !isSwitch ? "BREAK IT ANYWHERE: EVERYTHING STOPS" : "A SWITCH: A GAP YOU CAN CLOSE";
    text(s1, W / 2, 170, 54, !cut ? C.gpu : !isSwitch ? C.hot : C.cpu);
  }
  SC.andor = (lt, d, t) => {
    background(t, 0.4);
    const t0 = d * 0.4;
    if (lt < t0) { breakIntro(lt, d, t); if (lt > t0 - 0.4) rect(0, 0, W, H, `rgba(7,6,15,${seg(lt, t0 - 0.4, t0)})`); return; }
    lt -= t0; d -= t0;
    const CASES = [[0, 0], [1, 0], [0, 1], [1, 1]];
    const ci = Math.floor(lt / 1.3) % 4, [A, B] = CASES[ci];
    const a1 = seg(lt, 0.2, 0.8), a2 = seg(lt, d * 0.5, d * 0.5 + 0.6);
    andOrPanel(110, 230, "AND", A, B, a1);
    andOrPanel(990, 230, "OR", A, B, a2);
    // electrons along whichever paths conduct
    const flows = [];
    if (A && B) flows.push([110, [[110, 360], [110, 440], [690, 440], [690, 330]]], [110, [[690, 266], [690, 150], [110, 150], [110, 240]]]);
    if (A || B) {
      flows.push([990, [[110, 360], [110, 440], [690, 440], [690, 330]]], [990, [[690, 266], [690, 150], [480, 150]]], [990, [[220, 150], [110, 150], [110, 240]]]);
      if (A) flows.push([990, [[480, 150], [220, 150]]]);
      if (B) flows.push([990, [[480, 150], [480, 260], [220, 260], [220, 150]]]);
    }
    flows.forEach(([ox, pts]) => { const al = ox === 110 ? a1 : a2; if (al <= 0) return; ctx.save(); ctx.translate(ox, 230); flowDots(pts, t, 110, 44, 7, al); ctx.restore(); });
    text(`A ${A ? "ON " : "OFF"}   ·   B ${B ? "ON " : "OFF"}`, W / 2, 140, 48, C.cpu, { alpha: a1 });
    const k = seg(lt, d * 0.8, d * 0.8 + 0.5);
    if (k > 0) { rect(W / 2 - 560, 860, 1120, 110, `rgba(7,6,15,${0.85 * k})`); text("SWITCHES CAN DECIDE", W / 2, 915, 64, C.gold, { alpha: k, glow: 16 }); }
  };

  // a finger flips a switch, but a computer needs billions of flips a second
  function finger(x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    rect(-40, -420, 80, 380, "#d8a47a"); rect(-40, -420, 14, 380, "#e8b88a"); rect(26, -420, 14, 380, "#b88458");
    rect(-34, -70, 68, 40, "#e8c0a0"); rect(-28, -66, 56, 26, "#f0d0b4"); // the nail
    rect(-46, -440, 92, 30, "#c9906a");
    ctx.restore();
  }
  SC.fingers = (lt, d, t) => {
    background(t, 0.4);
    const press = (k) => Math.max(0, Math.sin(k * Math.PI));
    const p1 = seg(lt, 0.4, 1.6), down = press(p1), closed = p1 > 0.5 ? 1 : 0;
    const a = 1 - seg(lt, d * 0.4, d * 0.4 + 0.4);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a;
      poly([[560, 640], [860, 640]], wireCol(closed), 14); poly([[1060, 640], [1360, 640]], wireCol(closed), 14);
      knife(860, 1060, 640, closed);
      finger(1000, 560 - 160 * (1 - down) + (closed ? 40 : 0) * (1 - down));
      ctx.restore();
    }
    title("SOMETHING HAS TO FLIP THEM", lt, 0.6, 860, 60, C.ink, { alpha: a });
    const b = seg(lt, d * 0.42, d * 0.42 + 0.5);
    if (b > 0) {
      ctx.save(); ctx.globalAlpha = b;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 24; c++) {
        const on = Math.sin(t * 14 + c * 1.7 + r * 2.3 + hash(r * 24 + c) * 6) > 0;
        rect(300 + c * 56, 300 + r * 56, 44, 44, on ? C.gpu : "#2a2450");
      }
      ctx.restore();
      finger(820 + Math.sin(lt * 2) * 40, 720 + 30 * Math.abs(Math.sin(lt * 3)), 0.9);
      rect(1180, 760, 640, 220, `rgba(7,6,15,${0.9 * b})`);
      mono("needed: billions / s", 1500, 820, 40, C.gpu, { alpha: b });
      mono("a finger: ~5 / s", 1500, 900, 40, C.hot, { alpha: b });
    }
  };
})();
