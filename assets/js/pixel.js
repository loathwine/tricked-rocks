/* Pixel-art helpers: palettes, sprites, and the lesson's scenes. */
(function () {
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  /** Draw a sprite from a string map. Each char is a key into `pal`; "." is transparent. */
  function drawSprite(ctx, rows, pal, ox = 0, oy = 0, scale = 1) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = pal[row[x]];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    });
  }

  const SPRITES = {
    cpu: [
      "..o.o.o.o.o.o...",
      "................",
      "o.AAAAAAAAAAAA.o",
      "..AaaaaaaaaaaA..",
      "o.AaBBBBBBBBaA.o",
      "..AaBbbbbbbBaA..",
      "o.AaBbWWWWbBaA.o",
      "..AaBbWggWbBaA..",
      "o.AaBbWggWbBaA.o",
      "..AaBbWWWWbBaA..",
      "o.AaBbbbbbbBaA.o",
      "..AaBBBBBBBBaA..",
      "o.AaaaaaaaaaaA.o",
      "..AAAAAAAAAAAA..",
      "................",
      "..o.o.o.o.o.o...",
    ],
  };
  const PAL_CPU = { o: "#c9a44a", A: "#b8620f", a: "#ffab40", B: "#e08a2a", b: "#ffc46e", W: "#7a3d08", g: "#3df5c4" };

  // --- the sunset scene: 32×18. The picture is computed by exactly the 8-step
  //     renderPixel(x, y) recipe the lesson displays (STEPS below).
  const SCENE_W = 32, SCENE_H = 18;
  const SKY = ["#1b1640", "#241a52", "#33206a", "#4a2a7a", "#6a3088", "#94377f", "#c24277", "#ea5f6a", "#ff8a5c", "#ffb35c"];
  const K = { SUN_X: 20, SUN_Y: 8, SUN_R: 4.2, SEA: 11 };
  const COL = { SUN: "#ffe066", ROCK: "#2a1d4f", GLINT: "#ffc46e", STAR: "#ecebff", WATER: ["#1a2260", "#23307a"] };

  function skyColor(x, y) {
    const f = (y / K.SEA) * SKY.length;
    let band = Math.min(SKY.length - 1, Math.floor(f));
    if ((x + y) % 2 === 0 && f % 1 > 0.6 && band < SKY.length - 1) band++;
    if (y < 5 && (7 * x + 13 * y) % 23 === 0) return COL.STAR;
    return SKY[band];
  }
  const distance = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
  const mountainHeight = (x) => Math.round(8.2 + 1.8 * Math.sin(0.42 * x + 0.6) + 1.1 * Math.sin(0.93 * x + 2.1));
  const waterColor = (y) => COL.WATER[y % 2];
  const isGlint = (x, y) => y >= K.SEA && Math.abs(x - K.SUN_X) < 3 - (y - K.SEA) / 4 && (x + 3 * y) % 4 !== 0;

  // Each step: code shown to the learner, optional condition, and what it does.
  const STEPS = [
    { code: 'color = <span class="fn" data-fn="skyColor">skyColor</span>(x, y)', viz: "sky", plain: "Pick a sky color for this height",
      run: (s) => { s.color = skyColor(s.x, s.y); }, show: (s) => ({ color: s.color }) },
    { code: 'd = <span class="fn" data-fn="distance">distance</span>((x, y) ↔ SUN)', viz: "dist", plain: "Measure how far it is to the sun",
      run: (s) => { s.d = distance(s.x, s.y, K.SUN_X, K.SUN_Y); }, show: (s) => ({ num: "d = " + s.d.toFixed(1) }) },
    { code: '<span class="k">if</span> d &lt; SUN_R: color = <span class="sw" style="--c:#ffe066"></span>SUN', viz: "sun", plain: "Inside the sun? Paint it yellow",
      cond: (s) => s.d < K.SUN_R, run: (s) => { s.color = COL.SUN; } },
    { code: 'h = <span class="fn" data-fn="mountainHeight">mountainHeight</span>(x)', viz: "mtn", plain: "Look up the mountain height here",
      run: (s) => { s.h = mountainHeight(s.x); }, show: (s) => ({ num: "h = " + s.h }) },
    { code: '<span class="k">if</span> y ≥ h: color = <span class="sw" style="--c:#2a1d4f"></span>ROCK', viz: "rock", plain: "Behind the mountain? Paint it rock",
      cond: (s) => s.y >= s.h, run: (s) => { s.color = COL.ROCK; } },
    { code: '<span class="k">if</span> y ≥ SEA: color = <span class="fn" data-fn="waterColor">waterColor</span>(y)', viz: "sea", plain: "Below the sea line? Paint it water",
      cond: (s) => s.y >= K.SEA, run: (s) => { s.color = waterColor(s.y); } },
    { code: '<span class="k">if</span> <span class="fn" data-fn="isGlint">isGlint</span>(x, y): color = <span class="sw" style="--c:#ffc46e"></span>GLINT', viz: "glint", plain: "In the sun's reflection? Add a glint",
      cond: (s) => isGlint(s.x, s.y), run: (s) => { s.color = COL.GLINT; } },
    { code: '<span class="k">return</span> color', viz: "ret", plain: "Done: that's this pixel's color", run: () => {} },
  ];

  const FN_CODE = {
    skyColor: `skyColor(x, y):
  band = floor(y / SEA × 10)      // 10 bands: night → orange
  if checker(x, y) and near next band:
    band = band + 1               // dithering: blend the edge
  if y < 5 and (7x + 13y) mod 23 = 0:
    return STAR                   // a few stars up high
  return SKY[band]`,
    distance: `distance((x1, y1) ↔ (x2, y2)):
  // Pythagoras. Same answer in both directions.
  return √((x1 − x2)² + (y1 − y2)²)`,
    mountainHeight: `mountainHeight(x):
  // two sine waves added up = a bumpy skyline
  return round(8.2 + 1.8·sin(0.42x + 0.6)
                   + 1.1·sin(0.93x + 2.1))`,
    waterColor: `waterColor(y):
  // alternate two blues per row = ripples
  return y is even ? DEEP_BLUE : BLUE`,
    isGlint: `isGlint(x, y):
  // a wedge of sunlight on the water,
  // narrowing as it comes toward us
  return y ≥ SEA
     and |x − SUN.x| < 3 − (y − SEA) / 4
     and (x + 3y) mod 4 ≠ 0    // gaps = sparkle`,
  };

  /** Run renderPixel(x, y) and record the state after every step. */
  function trace(x, y) {
    const s = { x, y, color: null };
    return STEPS.map((st) => {
      const took = st.cond ? st.cond(s) : true;
      if (took) st.run(s);
      return { ...s, took };
    });
  }

  const SCENE = [];
  for (let y = 0; y < SCENE_H; y++) for (let x = 0; x < SCENE_W; x++) SCENE.push(hex(trace(x, y)[STEPS.length - 1].color));

  // --- matrix-output "heatmap" for the AI act ---
  const HEAT = ["#140f33", "#1f2a6b", "#1e5a8a", "#169e93", "#3df5c4", "#b8ffe9"];
  const MATRIX = [];
  for (let y = 0; y < SCENE_H; y++)
    for (let x = 0; x < SCENE_W; x++) {
      const v = 0.5 + 0.25 * Math.sin(x * 0.45) * Math.cos(y * 0.6) + 0.25 * Math.sin((x + y) * 0.23 + 1);
      MATRIX.push(hex(HEAT[Math.max(0, Math.min(HEAT.length - 1, Math.floor(v * HEAT.length)))]));
    }

  window.PX = { hex, drawSprite, SPRITES, PAL_CPU, SCENE, SCENE_W, SCENE_H, MATRIX, K, COL, STEPS, FN_CODE, trace, mountainHeight, isGlint };
})();
