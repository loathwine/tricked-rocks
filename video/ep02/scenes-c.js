/* EP 02 scenes, part C: the transistor, why it won, and the finale */
(function () {
  "use strict";
  const { ctx, W, H, lx, LO_W, LO_H, C, clamp, seg, easeOut, easeInOut, lerp, fmt, hexA, hash, text, body, mono, typed, rect, circle, ring,
    poly, glow, background, panel, tag, title, electron, hole, battery, bulb, knife, flowDots, wireCol, blitLo, fadeOut, SC } = window.TR;

  // ---------------------------------------------------------------- the transistor (lesson coordinates, 760×420)
  const VT = 0.5, S0 = 210;
  const HOLES = Array.from({ length: 60 }, (_, i) => ({ x: 50 + hash(i) * 660, y: 220 + hash(i + 100) * 170, p: hash(i + 200) * 6 }));
  const SRC = Array.from({ length: 22 }, (_, i) => ({ x: hash(i + 300), y: hash(i + 400), p: hash(i + 500) * 6 }));
  const DRN = Array.from({ length: 22 }, (_, i) => ({ x: hash(i + 600), y: hash(i + 700), p: hash(i + 800) * 6 }));
  const IONS = Array.from({ length: 40 }, (_, i) => ({ x: hash(i + 900), d: hash(i + 1000) }));
  // stage: 1 wafer, 2 islands, 3 glass, 4 gate, 5 wired. k: progress of the newest stage. o.barrier: 0..1 how visible the barriers are
  function fet(t, stage, k, vg, o = {}) {
    const g = ctx, ch = stage >= 5 ? clamp((vg - VT) / 1.0, 0, 1) : 0;
    g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, 760, 420);
    const bar = o.barrier ?? 0;
    if (stage >= 1) {
      g.save(); g.globalAlpha = stage === 1 ? k : 1;
      g.fillStyle = "#2a1630"; g.fillRect(40, S0, 680, 190);
      HOLES.forEach((h) => {
        const nearGate = h.x > 250 && h.x < 510;
        const push = stage >= 5 && nearGate ? clamp((vg / 3) * 60, 0, 60) * Math.max(0, 1 - (h.y - S0) / 120) : 0;
        const y = Math.min(392, h.y + push + Math.sin(t * 1.3 + h.p) * 3), x = h.x + Math.cos(t * 1.1 + h.p) * 3;
        if (((x > 74 && x < 266) || (x > 494 && x < 686)) && y < S0 + 100 && stage >= 2) return;
        hole(x, y, 5);
      });
      g.fillStyle = "#ff4d8d"; g.font = "bold 15px Silkscreen"; g.textAlign = "left"; g.fillText("P-TYPE SILICON", 300, 390);
      g.restore();
    }
    if (stage >= 2) {
      const a = stage === 2 ? k : 1;
      if (stage === 2 && k < 1) {
        g.fillStyle = "#3a3a44"; g.fillRect(40, 120, 50, 12); g.fillRect(250, 120, 260, 12); g.fillRect(670, 120, 50, 12);
        IONS.forEach((ion) => { const y = 132 + ((t * 300 + ion.d * 200) % 150); const x = ion.x < 0.5 ? 90 + ion.x * 2 * 160 : 510 + (ion.x - 0.5) * 2 * 160; if (y < S0 + 60 * a) { g.fillStyle = "#3df5c4"; g.fillRect(x, y, 3, 3); } });
        g.save(); g.globalAlpha = 1 - seg(k, 0.85, 1);
        g.fillStyle = "#c9ceff"; g.font = "bold 13px Silkscreen"; g.textAlign = "center"; g.fillText("MASK", 380, 112);
        g.fillStyle = "#3df5c4"; g.fillText("PHOSPHORUS ATOMS", 170, 100); g.fillText("PHOSPHORUS ATOMS", 590, 100);
        g.textAlign = "left"; g.restore();
      }
      [[90, SRC], [510, DRN]].forEach(([x0, es]) => {
        g.fillStyle = `rgba(31,58,110,${a})`; g.beginPath(); g.moveTo(x0, S0); g.lineTo(x0 + 160, S0); g.lineTo(x0 + 160, S0 + 60); g.quadraticCurveTo(x0 + 160, S0 + 82, x0 + 138, S0 + 82); g.lineTo(x0 + 22, S0 + 82); g.quadraticCurveTo(x0, S0 + 82, x0, S0 + 60); g.closePath(); g.fill();
        es.forEach((e) => electron(x0 + 14 + e.x * 132 + Math.sin(t * 2 + e.p) * 3, S0 + 12 + e.y * 58 + Math.cos(t * 1.7 + e.p) * 3, 4.5, a));
      });
      if (bar > 0) {
        g.save(); g.globalAlpha = a * bar;
        [90, 510].forEach((x0) => {
          g.fillStyle = `rgba(255,255,255,${0.07 + 0.08 * (o.pulse ? Math.max(0, Math.sin(t * 4)) : 0)})`; g.fillRect(x0 - 12, S0, 12, 94); g.fillRect(x0 + 160, S0, 12, 94); g.fillRect(x0 - 12, S0 + 82, 184, 12);
          g.font = "bold 11px JetBrains Mono"; g.fillStyle = "#9a95c4";
          for (let y = S0 + 10; y < S0 + 80; y += 16) { g.fillText("−", x0 - 9, y + 4); g.fillText("−", x0 + 163, y + 4); g.fillText("+", x0 + 3, y + 4); g.fillText("+", x0 + 150, y + 4); }
          for (let x = x0 + 4; x < x0 + 160; x += 18) { g.fillText("−", x, S0 + 92); g.fillText("+", x + 6, S0 + 78); }
        });
        g.fillStyle = "#c9ceff"; g.font = "bold 13px Silkscreen"; g.fillText("BARRIER", 252, S0 + 74); g.fillText("BARRIER", 434, S0 + 74);
        g.restore();
      }
      g.save(); g.globalAlpha = a;
      g.fillStyle = "#7bdcff"; g.font = "bold 15px Silkscreen"; g.fillText("SOURCE (N)", 104, S0 + 118); g.fillText("DRAIN (N)", 530, S0 + 118);
      g.restore();
    }
    if (stage >= 3) { const th = 14 * (stage === 3 ? k : 1); g.fillStyle = "rgba(160,200,255,.55)"; g.fillRect(250, S0 - th, 260, th); g.fillStyle = "#a0c8ff"; g.font = "12px JetBrains Mono"; g.fillText("glass", 514, S0 - 2); }
    if (stage >= 4) {
      const a = stage === 4 ? k : 1;
      g.fillStyle = `rgba(140,146,190,${a})`; g.fillRect(262, S0 - 14 - 34 * a, 236, 34 * a);
      const gv = stage >= 5 ? clamp(vg / 2, 0, 1) : 0;
      if (gv > 0) { g.fillStyle = `rgba(255,77,141,${0.25 + gv * 0.5})`; g.fillRect(262, S0 - 48, 236, 34); g.fillStyle = "#fff"; g.font = "bold 14px JetBrains Mono"; for (let x = 280; x < 490; x += 30) g.fillText("+", x, S0 - 26); }
      g.save(); g.globalAlpha = a; g.fillStyle = "#ecebff"; g.font = "bold 15px Silkscreen"; g.fillText("GATE", 290, S0 - 58); g.restore();
    }
    if (stage >= 5) {
      const lw = (pts, live) => poly(pts, live ? "#c9a44a" : "#5f5a8f", 5);
      g.fillStyle = "#8a92c0"; g.fillRect(140, S0 - 10, 60, 10); g.fillRect(560, S0 - 10, 60, 10);
      lw([[170, S0 - 10], [170, 60], [360, 60]], ch > 0); lw([[401, 60], [590, 60], [590, 80]], ch > 0); lw([[590, 120], [590, S0 - 10]], ch > 0);
      g.fillStyle = "#5f5a8f"; g.fillRect(360, 52, 9, 16); g.fillRect(396, 44, 5, 32); g.fillStyle = "#9a95c4"; g.font = "13px JetBrains Mono"; g.fillText("−", 356, 40); g.fillText("+", 395, 40);
      bulb(590, 100, 20, Math.pow(ch, 0.6));
      lw([[380, S0 - 48], [380, 120]], vg > 0.02);
      if (vg > 0.05) {
        const al = clamp(vg / 1.2, 0, 1), bob = (t * 1.5) % 1;
        g.save(); g.globalAlpha = al; g.lineWidth = 2.5;
        for (let i = 0; i < 4; i++) {
          const x = 290 + i * 60, ye = S0 + 70 - bob * 30, yh = S0 + 110 + bob * 30;
          g.strokeStyle = "#7bdcff"; g.beginPath(); g.moveTo(x, ye + 18); g.lineTo(x, ye); g.lineTo(x - 5, ye + 6); g.moveTo(x, ye); g.lineTo(x + 5, ye + 6); g.stroke();
          g.strokeStyle = "#ff4d8d"; g.beginPath(); g.moveTo(x + 24, yh - 18); g.lineTo(x + 24, yh); g.lineTo(x + 19, yh - 6); g.moveTo(x + 24, yh); g.lineTo(x + 29, yh - 6); g.stroke();
        }
        g.restore();
        // a few electrons gathering under the glass, even below the threshold
        const pre = Math.floor(clamp(vg / VT, 0, 1) * 12);
        for (let i = 0; i < pre; i++) electron(262 + ((i * 53) % 236), S0 + 6 + (i % 3) * 3, 3.4);
      }
      g.fillStyle = "#ecebff"; g.font = "bold 14px JetBrains Mono"; g.fillText(`GATE ${vg.toFixed(2)} V`, 392, 132);
      if (ch > 0) {
        const n = Math.floor(ch * 70);
        for (let i = 0; i < n; i++) electron(252 + ((i * 37) % 256), S0 + 5 + ((i * 13) % Math.max(2, Math.floor(4 + ch * 10))), 3.6);
        for (let i = 0; i < 30; i++) { const u = (i / 30 + t * 0.35) % 1; electron(150 + u * 460, S0 + 6 + Math.sin(u * 20) * 2, 3.6, clamp(ch * 3, 0, 1)); }
        // and around the outside: out of the battery's −, into the source; out of the drain, through the bulb, into +
        flowDots([[364, 60], [170, 60], [170, S0 - 10]], t, 60, 28, 3.6, clamp(ch * 3, 0, 1));
        flowDots([[590, S0 - 10], [590, 60], [401, 60]], t, 60, 28, 3.6, clamp(ch * 3, 0, 1));
        g.fillStyle = "#3df5c4"; g.font = "bold 15px Silkscreen"; g.fillText("CHANNEL", 330, S0 + 40);
      }
    }
  }
  const fetFrame = (fn) => { ctx.save(); ctx.translate(124, 46); ctx.scale(2.2, 2.2); fn(); ctx.restore(); };

  SC.fetbuild = (lt, d, t) => {
    background(t, 0.3);
    const starts = [0, d * 0.22, d * 0.62, d * 0.8];
    let stage = 1; starts.forEach((s0, i) => { if (lt >= s0) stage = i + 1; });
    const k = seg(lt, starts[stage - 1], starts[stage - 1] + (stage === 2 ? 3.5 : 1.2)); // the implant gets time to read
    fetFrame(() => fet(t, stage, k, 0));
    const caps = ["P-TYPE SILICON", "TWO N-TYPE ISLANDS: SOURCE + DRAIN", "A THIN LAYER OF GLASS", "A METAL GATE ON TOP"];
    tag(caps[stage - 1], lt - starts[stage - 1], 0.3, 1010, stage === 1 ? C.hot : stage === 2 ? C.e : C.ink);
  };
  SC.barrier = (lt, d, t) => {
    background(t, 0.3);
    const form = seg(lt, 0.4, d * 0.45);
    fetFrame(() => {
      fet(t, 5, 1, 0, { barrier: form, pulse: lt > d * 0.6 });
      // at each border, electrons cross and fill holes
      for (let i = 0; i < 6; i++) {
        [[250, 1], [510, -1]].forEach(([xb, dir]) => {
          const y = S0 + 14 + i * 12, kk = seg(lt, 0.4 + i * 0.25, 1.6 + i * 0.25);
          if (kk <= 0 || kk >= 1) return;
          const x = xb - dir * 6 + dir * 26 * kk;
          electron(x, y, 4.2, 1 - seg(kk, 0.8, 1)); hole(xb + dir * 22, y, 5);
        });
      }
    });
    if (lt > d * 0.7) { rect(W / 2 - 420, 960, 840, 90, `rgba(7,6,15,${0.85 * seg(lt, d * 0.7, d * 0.7 + 0.4)})`); text("NO CURRENT", W / 2, 1005, 50, C.muted, { alpha: seg(lt, d * 0.7, d * 0.7 + 0.4) }); }
  };
  SC.channel = (lt, d, t) => {
    background(t, 0.3);
    const vg = lt < d * 0.75 ? 0.8 * seg(lt, d * 0.2, d * 0.75) : 0.8 + 0.9 * seg(lt, d * 0.75, d * 0.9);
    fetFrame(() => fet(t, 5, 1, vg, { barrier: Math.max(0, 1 - vg * 2) }));
    if (vg >= VT) { const a = seg(vg, VT, VT + 0.1); rect(W / 2 - 360, 960, 720, 90, `rgba(7,6,15,${0.85 * a})`); text("SWITCH: ON", W / 2, 1005, 54, C.gpu, { alpha: a, glow: 14 }); }
  };
  SC.fetoff = (lt, d, t) => {
    background(t, 0.3);
    const vg = 1.7 * (1 - seg(lt, 0.3, d * 0.22));
    fetFrame(() => fet(t, 5, 1, vg, { barrier: vg < 0.3 ? 1 - vg * 3 : 0 }));
    const a = seg(lt, d * 0.32, d * 0.32 + 0.5), b = seg(lt, d * 0.62, d * 0.62 + 0.5);
    if (a > 0 && b < 1) {
      ctx.save(); ctx.globalAlpha = 1 - b;
      rect(W / 2 - 720, 965, 1440, 100, `rgba(7,6,15,${0.85 * a})`);
      text("NO MOVING PARTS · ONLY ELECTRONS MOVE", W / 2, 1015, 46, C.gold, { alpha: a });
      ctx.restore();
    }
    if (b > 0) { rect(W / 2 - 520, 950, 1040, 110, `rgba(7,6,15,${0.9 * b})`); text("THE TRANSISTOR", W / 2, 1005, 72, C.gpu, { alpha: b, glow: 20 }); }
  };

  // ---------------------------------------------------------------- why it won
  SC.race = (lt, d, t) => {
    background(t, 0.4);
    // the 1947 point-contact transistor: a germanium block, two gold contacts, a plastic wedge
    const a0 = seg(lt, 0.2, 0.9);
    ctx.save(); ctx.globalAlpha = a0;
    glow(520, 560, 420, C.gold, 0.12);
    rect(360, 640, 320, 80, "#6a6f8a"); rect(360, 640, 320, 12, "#9aa0c0");
    rect(300, 720, 440, 40, "#8a6a40");
    ctx.fillStyle = "#c9c0e0"; ctx.beginPath(); ctx.moveTo(470, 380); ctx.lineTo(570, 380); ctx.lineTo(530, 636); ctx.lineTo(510, 636); ctx.fill();
    poly([[505, 640], [420, 480], [300, 420]], C.live, 8); poly([[535, 640], [620, 480], [740, 420]], C.live, 8);
    poly([[300, 420], [300, 300]], C.live, 8); poly([[740, 420], [740, 300]], C.live, 8);
    ctx.restore();
    text("1947 · BELL LABS", 520, 220, 44, C.ink, { alpha: a0 });
    text("THE FIRST TRANSISTOR", 520, 830, 34, C.muted, { alpha: a0 });
    const why = [["NO HEATER", 0.3], ["NEVER WEARS OUT", 0.42], ["CAN BE MADE TINY", 0.54]];
    why.forEach(([s, f], i) => {
      const a = seg(lt, d * f, d * f + 0.4); if (a <= 0) return;
      text("✓", 1060, 330 + i * 110, 60, C.gpu, { alpha: a });
      text(s, 1120, 330 + i * 110, 52, C.ink, { alpha: a, align: "left" });
    });
    const ic = seg(lt, d * 0.74, d * 0.74 + 0.6);
    if (ic > 0) {
      ctx.save(); ctx.globalAlpha = ic;
      rect(1100, 700, 280, 200, "#15122b"); ctx.strokeStyle = C.live; ctx.lineWidth = 4; ctx.strokeRect(1100, 700, 280, 200);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) rect(1116 + c * 29, 716 + r * 29, 18, 18, Math.sin(t * 5 + c + r * 2) > 0 ? C.gpu : C.gpuDeep);
      ctx.restore();
      text("~1960", 1420, 760, 50, C.gold, { alpha: ic, align: "left" });
      text("MANY ON ONE", 1420, 830, 40, C.ink, { alpha: ic, align: "left" });
      text("PIECE OF SILICON", 1420, 880, 40, C.ink, { alpha: ic, align: "left" });
    }
  };

  // zoom from a relay down to atoms, then the transistor count
  const THINGS = [
    { name: "a relay", size: 2e-2, draw: "relay", x: 0.5 }, { name: "a grain of sand", size: 5e-4, draw: "grain", x: 0.35 },
    { name: "a human hair", size: 7e-5, draw: "hair", x: 0.7 }, { name: "a red blood cell", size: 7.5e-6, draw: "rbc", x: 0.3 },
    { name: "a bacterium", size: 2e-6, draw: "bact", x: 0.7 }, { name: "a virus", size: 1e-7, draw: "virus", x: 0.32 },
    { name: "a modern transistor", size: 5e-8, draw: "fet", x: 0.8 },
  ];
  const lenText = (m) => (m >= 1e-2 ? `${(m * 100).toFixed(m >= 0.1 ? 0 : 1)} CM` : m >= 1e-3 ? `${(m * 1e3).toFixed(1)} MM` : m >= 1e-6 ? `${fmt(m * 1e6)} µM` : `${fmt(m * 1e9)} NM`);
  function zoomView(k) {
    const g = ctx, CW = 960, CH = 420, span = Math.pow(10, -2 - 4.85 * k);
    g.fillStyle = "#0e0c1e"; g.fillRect(0, 0, CW, CH);
    g.save(); g.beginPath(); g.rect(0, 0, CW, CH); g.clip();
    THINGS.forEach((th) => {
      const px = (th.size / span) * CW;
      if (px < 4 || px > CW * 1.4) return;
      const cx = CW * th.x, cy = CH / 2;
      const a = clamp(Math.min((px - 4) / 20, (CW * 1.4 - px) / (CW * 0.5)), 0, 1);
      g.save(); g.globalAlpha = a;
      if (th.draw === "relay") { g.fillStyle = "#ffab40"; g.fillRect(cx - px / 2, cy - px * 0.3, px, px * 0.6); g.fillStyle = "#b8620f"; for (let x = 0; x < px * 0.5; x += Math.max(2, px / 20)) g.fillRect(cx - px * 0.4 + x, cy - px * 0.2, Math.max(1, px / 60), px * 0.4); }
      else if (th.draw === "grain") { g.fillStyle = "#d9b77a"; g.beginPath(); for (let a2 = 0; a2 < 6.28; a2 += 0.4) { const r = (px / 2) * (0.85 + 0.15 * Math.sin(a2 * 3)); g.lineTo(cx + Math.cos(a2) * r, cy + Math.sin(a2) * r); } g.fill(); }
      else if (th.draw === "hair") { g.fillStyle = "#6a4a2a"; g.fillRect(cx - px / 2, 0, px, CH); }
      else if (th.draw === "rbc") { g.fillStyle = "#c83a3a"; g.beginPath(); g.ellipse(cx, cy, px / 2, px / 2.2, 0, 0, 6.28); g.fill(); g.fillStyle = "#8a2020"; g.beginPath(); g.ellipse(cx, cy, px / 5, px / 6, 0, 0, 6.28); g.fill(); }
      else if (th.draw === "bact") { g.fillStyle = "#4a9a3a"; g.beginPath(); g.ellipse(cx, cy, px / 2, px / 6, 0.3, 0, 6.28); g.fill(); }
      else if (th.draw === "virus") { g.fillStyle = "#ff4d8d"; g.beginPath(); g.arc(cx, cy, px / 2.4, 0, 6.28); g.fill(); for (let a2 = 0; a2 < 6.28; a2 += 0.5) g.fillRect(cx + Math.cos(a2) * px / 2.2 - px / 30, cy + Math.sin(a2) * px / 2.2 - px / 30, px / 15, px / 15); }
      else if (th.draw === "fin") { g.fillStyle = "#3df5c4"; g.fillRect(cx - px / 2, cy - px * 2.5, px, px * 5); }
      else if (th.draw === "fet") { g.fillStyle = "#3df5c4"; for (let f = -1; f <= 1; f++) g.fillRect(cx - px / 2, cy + f * px * 0.25 - px * 0.04, px, px * 0.08); g.fillStyle = "rgba(140,146,190,.9)"; g.fillRect(cx - px * 0.1, cy - px * 0.45, px * 0.2, px * 0.9); }
      if (px > 16) { g.fillStyle = "#ecebff"; g.font = "bold 18px JetBrains Mono"; g.textAlign = "center"; g.fillText(`${th.name} · ${lenText(th.size).toLowerCase()}`, cx, Math.min(CH - 16, cy + Math.max(px * 0.35, 30) + 24)); }
      g.restore();
    });
    g.restore();
    return span;
  }
  const CHIPS = [["1971", 2300], ["1978", 29000], ["1989", 1.2e6], ["2000", 42e6], ["2006", 291e6], ["2013", 1e9], ["2025", 92e9]];
  SC.shrink = (lt, d, t) => {
    background(t, 0.3);
    const zk = easeInOut(seg(lt, 0.3, d * 0.5));
    const fade = 1 - seg(lt, d * 0.56, d * 0.6);
    if (fade > 0) {
      ctx.save(); ctx.globalAlpha = fade; ctx.translate(0, 60); ctx.scale(2, 2);
      const span = zoomView(zk);
      ctx.restore();
      ctx.save(); ctx.globalAlpha = fade;
      text(`${lenText(span)} ACROSS`, W / 2, 1000, 44, C.muted);
      ctx.restore();
      if (zk > 0.85) { const a = seg(zk, 0.85, 1) * fade; rect(1240, 80, 640, 100, `rgba(7,6,15,${0.85 * a})`); mono("~10 ps per flip", 1560, 130, 44, C.gpu, { alpha: a }); }
      const nk = seg(lt, d * 0.4, d * 0.4 + 0.5) * fade;
      if (nk > 0) body("\u201c3 nm\u201d chips: a product name, not a size. The thinnest parts are a few nm; a whole transistor is ~50 nm.", W / 2, 940, 30, C.muted, { alpha: nk });
    }
    const b = seg(lt, d * 0.6, d * 0.6 + 0.5);
    if (b > 0) {
      text("TRANSISTORS ON ONE CHIP", W / 2, 140, 54, C.ink, { alpha: b });
      const max = Math.log10(3e11);
      CHIPS.forEach(([yr, n], i) => {
        const k = seg(lt, d * 0.62 + i * 0.35, d * 0.62 + i * 0.35 + 0.6), y = 260 + i * 105;
        text(yr, 300, y, 40, C.muted, { alpha: b, align: "left" });
        rect(480, y - 22, 1000, 44, "#17142e");
        rect(480, y - 22, 1000 * (Math.log10(n) / max) * easeOut(k), 44, i === CHIPS.length - 1 ? C.gold : C.gpu);
        mono(fmt(n), 1840, y, 40, i === CHIPS.length - 1 ? C.gold : C.ink, { alpha: k, align: "right" });
      });
    }
  };

  // ---------------------------------------------------------------- finale
  SC.chainfet = (lt, d, t) => {
    background(t, 0.3);
    const N = 7, period = 2.8, fast = seg(lt, d * 0.7, d);
    const inputAt = (time) => (fast > 0 ? Math.sin(time * (2 + 40 * fast * fast)) > 0 : Math.floor(time / period) % 2 === 1);
    const delay = lerp(0.22, 0.03, fast);
    ctx.save(); ctx.translate(80, 300); ctx.scale(5.5, 5.5);
    ctx.fillStyle = "#0e0c1e"; ctx.fillRect(-4, 0, 328, 80);
    ctx.fillStyle = "#ff8a5c"; ctx.fillRect(-4, 4, 328, 2);
    ctx.fillStyle = "#5f5a8f"; ctx.fillRect(-4, 74, 328, 2);
    for (let i = 0; i < N; i++) { const x = 14 + i * 43; ctx.fillStyle = "#ff8a5c"; ctx.fillRect(x + 21, 6, 1, 22); ctx.fillStyle = "#5f5a8f"; ctx.fillRect(x + 1, 38, 1, 36); }
    const input = inputAt(lt);
    for (let i = 0; i < N; i++) {
      const x = 14 + i * 43, on = inputAt(lt - (i + 1) * delay), gateOn = i === 0 ? input : inputAt(lt - i * delay);
      ctx.fillStyle = gateOn ? "#c9a44a" : "#3d3772"; ctx.fillRect(x - 14, 26, 18, 2);
      ctx.fillStyle = gateOn ? "#ff4d8d" : "#8c92be"; ctx.fillRect(x + 4, 20, 16, 4);
      ctx.fillStyle = on ? "#3df5c4" : "#2a1630"; ctx.fillRect(x + 4, 28, 16, 10);
      ctx.fillStyle = "#1f3a6e"; ctx.fillRect(x, 28, 4, 10); ctx.fillRect(x + 20, 28, 4, 10);
      ctx.fillStyle = on ? "#ffe066" : "#2d2856"; ctx.fillRect(x + 8, 50, 8, 8);
      if (on) { ctx.fillStyle = "rgba(255,224,102,.25)"; ctx.fillRect(x + 5, 47, 14, 14); }
    }
    ctx.fillStyle = input ? "#ff4d8d" : "#5f5a8f"; ctx.fillRect(-4, 22, 8, 10);
    ctx.restore();
    text("SUPPLY RAIL", 120, 270, 26, "#ff8a5c", { align: "left" });
    text("GROUND", 120, 760, 26, C.muted, { align: "left" });
    text("EACH GATE IS WIRED TO THE LAST ONE'S OUTPUT", W / 2, 130, 42, C.ink, { alpha: seg(lt, 0.4, 1.0) });
    const a = seg(lt, d * 0.55, d * 0.55 + 0.5);
    if (a > 0) { rect(W / 2 - 700, 870, 1400, 140, `rgba(7,6,15,${0.85 * a})`); text("SWITCHES FLIPPING SWITCHES", W / 2, 915, 60, C.gold, { alpha: a, glow: 14 }); body("billions of times a second", W / 2, 975, 38, C.muted, { alpha: seg(lt, d * 0.7, d * 0.7 + 0.5) }); }
  };

  // sand rises and assembles into a glowing chip
  SC.sandglow = (lt, d, t) => {
    const g = lx;
    g.fillStyle = "#07060f"; g.fillRect(0, 0, LO_W, LO_H);
    const k = easeInOut(seg(lt, 0.2, d * 0.6)), lit = seg(lt, d * 0.55, d * 0.8);
    const CX = 120, CY = 56, S = 30;
    for (let i = 0; i < 900; i++) {
      const sx = hash(i) * LO_W, sy = 100 + hash(i + 3) * 35;
      const tx = CX - S / 2 + (i % 30), ty = CY - S / 2 + Math.floor(i / 30);
      const kk = clamp(k * 1.4 - hash(i + 7) * 0.4, 0, 1);
      const x = lerp(sx, tx, kk), y = lerp(sy, ty, kk) - Math.sin(kk * Math.PI) * 20 * hash(i + 11);
      const onChip = kk >= 1;
      let col = hash(i + 5) > 0.6 ? "#d9b77a" : "#c4a064";
      if (onChip) {
        const cx = i % 30, cy = Math.floor(i / 30), edge = cx === 0 || cy === 0 || cx === 29 || cy === 29, grid = cx % 3 === 1 && cy % 3 === 1;
        col = edge ? "#c9a44a" : grid ? (lit > 0 && Math.sin(t * 6 - cx * 0.4 - cy * 0.3) > 0.3 - lit ? "#c9fff1" : "#3df5c4") : "#15122b";
      }
      g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    if (lit > 0) { g.fillStyle = "#c9a44a"; for (let j = 0; j < 30; j += 3) { g.fillRect(CX - 15 + j, CY - 18, 1, 3); g.fillRect(CX - 15 + j, CY + 15, 1, 3); g.fillRect(CX - 18, CY - 15 + j, 3, 1); g.fillRect(CX + 15, CY - 15 + j, 3, 1); } }
    blitLo();
    if (lit > 0) glow(CX * 8, CY * 8, 520, C.gpu, 0.25 * lit);
    title("WE TOOK THE MAIN INGREDIENT OF SAND", lt, 0.4, 840, 50, C.ink);
    title("AND TURNED IT INTO BILLIONS OF TINY MACHINES", lt, d * 0.4, 920, 50, C.gold, { glow: 14 });
    title("WITH NO MOVING PARTS", lt, d * 0.68, 995, 50, C.gpu, { glow: 14 });
  };

  // ---------------- thumbnails (stills, not part of the video) ----------------
  SC.thumbA = () => {
    rect(0, 0, W, H, "#07060f");
    glow(1250, 620, 700, C.gpu, 0.16);
    ctx.save(); ctx.translate(760, 300); ctx.scale(1.45, 1.45); fet(2.0, 5, 1, 1.7, { barrier: 0 }); ctx.restore();
    text("A SWITCH", 380, 330, 120, C.ink, { glow: 10 });
    text("MADE OF", 380, 470, 120, C.ink, { glow: 10 });
    text("ROCK", 380, 640, 170, C.gold, { glow: 30 });
    body("no moving parts", 380, 790, 52, C.gpu);
  };
  SC.thumbB = () => {
    rect(0, 0, W, H, "#07060f");
    glow(960, 700, 800, C.gpu, 0.14);
    ctx.save(); ctx.translate(124, 290); ctx.scale(2.2, 2.2); fet(2.0, 5, 1, 1.7, { barrier: 0 }); ctx.restore();
    rect(0, 0, W, 250, "rgba(7,6,15,.9)");
    text("HOW DO YOU MAKE A SWITCH", W / 2, 90, 84, C.ink, { glow: 8 });
    text("OUT OF A ROCK?", W / 2, 190, 100, C.gold, { glow: 24 });
  };

  SC.cta = (lt, d, t) => {
    background(t);
    // a small working transistor, switching on and off
    const vg = Math.floor(t / 1.6) % 2 ? 1.6 : 0;
    ctx.save(); ctx.translate(90, 260); ctx.scale(1.05, 1.05); fet(t, 5, 1, vg, { barrier: vg ? 0 : 1 }); ctx.restore();
    text("BUILD YOUR OWN TRANSISTOR", 1380, 330, 52, C.ink, { alpha: seg(lt, 0.2, 0.8) });
    mono("loathwine.github.io/tricked-rocks", 1380, 430, 36, C.gold, { alpha: seg(lt, 0.6, 1.2) });
    body("interactive lesson · link below", 1380, 485, 30, C.muted, { alpha: seg(lt, 0.6, 1.2) });
    const a = seg(lt, d * 0.12, d * 0.12 + 0.6);
    text("NEXT · EP 03", 1380, 650, 30, C.muted, { alpha: a });
    text("GATES", 1380, 730, 90, C.gpu, { alpha: a, glow: 16 });
    ["AND", "OR", "NOT"].forEach((s, i) => text(s, 1200 + i * 180, 830, 40, i === 2 ? C.cpu : C.ink, { alpha: seg(lt, d * 0.2 + i * 0.3, d * 0.2 + i * 0.3 + 0.4) }));
    fadeOut(lt, d, 1.2);
  };
})();
