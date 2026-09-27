/* Tiny chiptune sound effects via WebAudio. No assets needed. */
(function () {
  let ctx = null;
  let master = null;
  let muted = false;
  try { muted = localStorage.getItem("tr-muted") === "1"; } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.12;
    master.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, dur, opts = {}) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    const t0 = c.currentTime + (opts.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = opts.type || "square";
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) osc.frequency.exponentialRampToValueAtTime(opts.slide, t0 + dur);
    const v = opts.vol ?? 1;
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol = 0.5) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = vol;
    src.buffer = buf;
    src.connect(g).connect(master);
    src.start();
  }

  const notes = (base, steps, dt, type = "square", vol = 0.8) =>
    steps.forEach((s, i) => tone(base * Math.pow(2, s / 12), dt * 1.6, { delay: i * dt, type, vol }));

  window.SFX = {
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      try { localStorage.setItem("tr-muted", m ? "1" : "0"); } catch (e) {}
    },
    unlock() { const c = ensure(); if (c && c.state === "suspended") c.resume(); },
    click: () => tone(880, 0.04, { vol: 0.5 }),
    place: () => tone(520, 0.06, { slide: 780, vol: 0.6 }),
    remove: () => tone(420, 0.08, { slide: 180, vol: 0.5 }),
    tick: () => tone(1320, 0.015, { vol: 0.18, type: "triangle" }),
    step: (i) => tone(330 + i * 55, 0.03, { vol: 0.25, type: "triangle" }),
    deny: () => { tone(160, 0.12, { vol: 0.6 }); tone(120, 0.14, { delay: 0.08, vol: 0.6 }); },
    success: () => notes(523.25, [0, 4, 7, 12, 16, 19, 24], 0.07),
    fanfare: () => { notes(392, [0, 4, 7, 12], 0.1); notes(392, [12, 16, 19, 24], 0.1, "triangle", 0.6); },
    fail: () => notes(330, [0, -3, -6, -10], 0.1, "sawtooth", 0.5),
    whoosh: () => tone(200, 0.5, { slide: 1600, type: "sawtooth", vol: 0.25 }),
    boom: () => { noise(0.6, 0.7); tone(90, 0.5, { slide: 30, vol: 0.8 }); },
    reveal: () => tone(660, 0.12, { slide: 990, type: "triangle", vol: 0.5 }),
  };
})();
