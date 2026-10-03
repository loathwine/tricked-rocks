/* Review mode for lessons: draw on the page and leave notes, saved by the local review server (video/review/server.py).
   Off unless the URL has ?review (remembered for the tab) AND the review API answers, so it does nothing on the live site. */
(function () {
  "use strict";
  const params = new URLSearchParams(location.search);
  try {
    if (params.has("review")) sessionStorage.setItem("tr-review", params.get("review") === "0" ? "0" : "1");
    if (sessionStorage.getItem("tr-review") !== "1") return;
  } catch { if (!params.has("review")) return; }
  const slug = (location.pathname.match(/\/lessons\/([^/]+)/) || [])[1];
  if (!slug) return;
  const EP = `lesson:${slug}`, BASE = `${location.pathname.replace(/[^/]*$/, "")}`;
  const api = (path, body) => fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });

  api(`/api/feedback?ep=${encodeURIComponent(EP)}`).then(start, () => console.info("review mode: no review server (run python3 video/review/server.py)"));

  function start(initialNotes) {
    let notes = initialNotes, mode = "off", tool = "pen", color = "#ff4d8d", strokes = [], cur = null, side = "right";
    const css = document.createElement("style");
    css.textContent = `
      #tr-review, #tr-review * { box-sizing: border-box; font-family: "JetBrains Mono", monospace; }
      #tr-review .dock { position: fixed; left: 12px; bottom: 12px; z-index: 10002; display: flex; gap: 6px; }
      #tr-review button { font-size: 12px; padding: 6px 10px; color: #ecebff; background: #1f1b3d; border: 2px solid #ff4d8d; cursor: pointer; }
      #tr-review button:hover { background: #2d2856; }
      #tr-review button.on { color: #3df5c4; border-color: #3df5c4; }
      #tr-review button.sw { width: 26px; height: 26px; padding: 0; border-color: #2d2856; }
      #tr-review button.sw.on { border-color: #fff; }
      #tr-review canvas.ink { position: fixed; inset: 0; z-index: 10000; cursor: crosshair; }
      #tr-review canvas.show { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
      #tr-review .panel { position: fixed; bottom: 60px; width: 340px; max-height: calc(100vh - 80px); z-index: 10001; background: #17142ef2; border: 2px solid #ff4d8d;
        padding: 10px; display: flex; flex-direction: column; gap: 8px; color: #ecebff; font-size: 12px; }
      #tr-review .panel.right { right: 12px; } #tr-review .panel.left { left: 12px; }
      #tr-review .row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      #tr-review textarea { width: 100%; min-height: 80px; resize: vertical; background: #0e0c1e; color: #ecebff; border: 2px solid #2d2856; padding: 6px; font: 13px "Space Grotesk", sans-serif; }
      #tr-review .hint { color: #9a95c4; font-size: 11px; }
      #tr-review .list { overflow-y: auto; display: grid; gap: 8px; }
      #tr-review .note { border: 2px solid #2d2856; padding: 6px; display: grid; gap: 4px; cursor: pointer; background: #0e0c1e; }
      #tr-review .note:hover { border-color: #9a95c4; }
      #tr-review .note.done { opacity: .5; }
      #tr-review .note img { width: 100%; display: block; }
      #tr-review .note .txt { font: 13px "Space Grotesk", sans-serif; }
      #tr-review .note button { font-size: 10px; padding: 2px 6px; border-color: #2d2856; }
      #tr-review .x { position: fixed; top: 12px; right: 12px; z-index: 10002; }`;
    document.head.appendChild(css);
    const root = document.createElement("div");
    root.id = "tr-review";
    root.innerHTML = `<div class="dock"><button data-a="annotate">✎ ANNOTATE</button><button data-a="notes">NOTES</button></div>`;
    document.body.appendChild(root);
    const dock = root.querySelector(".dock");
    const count = () => { dock.querySelector('[data-a="notes"]').textContent = `NOTES (${notes.filter((n) => !n.done).length})`; };
    count();

    const ink = document.createElement("canvas"); ink.className = "ink";
    const g = ink.getContext("2d");
    const show = document.createElement("canvas"); show.className = "show";
    let panel = null, showClose = null;

    const actEl = () => document.querySelector("section.act.active");
    const actInfo = () => { const a = actEl(); return a ? { act: +a.dataset.act, actTitle: a.dataset.title } : {}; };

    // ---------- drawing ----------
    function sizeInk() { ink.width = innerWidth; ink.height = innerHeight; paint(); }
    function paint() {
      g.clearRect(0, 0, ink.width, ink.height);
      [...strokes, cur].filter(Boolean).forEach((s) => {
        g.strokeStyle = s.color; g.lineWidth = 4; g.lineCap = "round"; g.lineJoin = "round"; g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = 4;
        const a = s.pts[0], b = s.pts[s.pts.length - 1];
        g.beginPath();
        if (s.tool === "pen") s.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        else if (s.tool === "box") g.rect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        else {
          const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
          g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
          g.moveTo(b[0], b[1]); g.lineTo(b[0] - 20 * Math.cos(ang - 0.45), b[1] - 20 * Math.sin(ang - 0.45));
          g.moveTo(b[0], b[1]); g.lineTo(b[0] - 20 * Math.cos(ang + 0.45), b[1] - 20 * Math.sin(ang + 0.45));
        }
        g.stroke();
      });
      g.shadowBlur = 0;
    }
    ink.addEventListener("pointerdown", (e) => { ink.setPointerCapture(e.pointerId); cur = { tool, color, pts: [[e.clientX, e.clientY]] }; paint(); });
    ink.addEventListener("pointermove", (e) => { if (!cur) return; if (cur.tool === "pen") cur.pts.push([e.clientX, e.clientY]); else cur.pts[1] = [e.clientX, e.clientY]; paint(); });
    ink.addEventListener("pointerup", () => { if (cur && cur.pts.length > 1) strokes.push(cur); cur = null; paint(); });

    // the page element a note is about: whatever sits under the first mark (or the middle of the screen)
    function targetAt(x, y) {
      ink.style.display = "none"; if (panel) panel.style.display = "none";
      let el = document.elementFromPoint(x, y);
      ink.style.display = ""; if (panel) panel.style.display = "";
      if (!el) return null;
      const path = [];
      for (let n = el; n && n.nodeType === 1 && n !== document.body; n = n.parentElement) {
        if (n.id) { path.unshift(`#${n.id}`); break; }
        const sib = [...n.parentElement.children].filter((c) => c.tagName === n.tagName);
        path.unshift(n.tagName.toLowerCase() + (n.classList.length ? "." + [...n.classList].slice(0, 2).join(".") : "") + (sib.length > 1 ? `:nth-of-type(${sib.indexOf(n) + 1})` : ""));
      }
      return { selector: path.join(" > "), tag: el.tagName.toLowerCase(), text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 140) };
    }

    // ---------- modes ----------
    function closePanel() { if (panel) panel.remove(); panel = null; }
    function setMode(m) {
      if (mode === "annotate" && m !== "annotate") { ink.remove(); document.documentElement.style.overflow = ""; strokes = []; }
      closePanel();
      mode = mode === m ? "off" : m;
      dock.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.a === mode));
      if (mode === "annotate") openAnnotate();
      if (mode === "notes") openNotes();
    }
    dock.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setMode(b.dataset.a); });

    function openAnnotate() {
      hideShown();
      document.documentElement.style.overflow = "hidden"; // the drawing is in screen space, so the page must hold still
      root.appendChild(ink); sizeInk();
      panel = document.createElement("div");
      panel.className = `panel ${side}`;
      const ai = actInfo();
      panel.innerHTML = `
        <div class="row"><b>NOTE · act ${ai.act ?? "?"} ${ai.actTitle ? "· " + ai.actTitle : ""}</b></div>
        <div class="row">${["pen", "arrow", "box"].map((t) => `<button data-tool="${t}" class="${t === tool ? "on" : ""}">${t.toUpperCase()}</button>`).join("")}
          ${["#ff4d8d", "#ffe066", "#3df5c4", "#ffffff"].map((c) => `<button class="sw${c === color ? " on" : ""}" data-color="${c}" style="background:${c}"></button>`).join("")}</div>
        <div class="row"><button data-b="undo">UNDO</button><button data-b="clear">CLEAR</button><button data-b="side">⇄ MOVE PANEL</button></div>
        <textarea placeholder="What should change here? (draw on the page to point at it)"></textarea>
        <div class="row"><button data-b="save">SAVE NOTE</button><button data-b="cancel">CLOSE</button><span class="hint st"></span></div>
        <div class="hint">ctrl+enter saves · ctrl+z undo · esc closes. Scrolling is paused while annotating; close to interact with the lesson.</div>`;
      root.appendChild(panel);
      panel.querySelector("textarea").focus();
      panel.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.tool) { tool = b.dataset.tool; panel.querySelectorAll("[data-tool]").forEach((x) => x.classList.toggle("on", x === b)); }
        if (b.dataset.color) { color = b.dataset.color; panel.querySelectorAll("[data-color]").forEach((x) => x.classList.toggle("on", x === b)); }
        if (b.dataset.b === "undo") { strokes.pop(); paint(); }
        if (b.dataset.b === "clear") { strokes = []; paint(); }
        if (b.dataset.b === "side") { side = side === "right" ? "left" : "right"; panel.className = `panel ${side}`; }
        if (b.dataset.b === "save") saveNote();
        if (b.dataset.b === "cancel") setMode("off");
      });
      panel.querySelector("textarea").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveNote(); } });
    }

    let h2c = null;
    const loadH2C = () => h2c || (h2c = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"; s.onload = () => res(window.html2canvas); s.onerror = rej; document.head.appendChild(s); }));
    async function saveNote() {
      const ta = panel.querySelector("textarea"), st = panel.querySelector(".st"), text = ta.value.trim();
      if (!text && !strokes.length) { st.textContent = "write something or draw first"; return; }
      st.textContent = "capturing…";
      const p0 = strokes[0] ? strokes[0].pts[0] : [innerWidth / 2, innerHeight / 2];
      const target = targetAt(p0[0], p0[1]);
      const snap = document.createElement("canvas"); snap.width = innerWidth; snap.height = innerHeight;
      const sg = snap.getContext("2d"); sg.fillStyle = "#07060f"; sg.fillRect(0, 0, snap.width, snap.height);
      try {
        const html2canvas = await loadH2C();
        const shot = await html2canvas(document.body, { x: scrollX, y: scrollY, width: innerWidth, height: innerHeight, windowWidth: innerWidth, windowHeight: innerHeight,
          scale: 1, backgroundColor: "#07060f", logging: false, ignoreElements: (el) => el.id === "tr-review",
          // the clone would replay entrance animations from their first (invisible) frame
          onclone: (doc) => { const st = doc.createElement("style"); st.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; }"; doc.head.appendChild(st); } });
        sg.drawImage(shot, 0, 0);
      } catch (e) { console.warn("review: page capture failed, saving the drawing only", e); }
      sg.drawImage(ink, 0, 0);
      st.textContent = "saving…";
      try {
        await api("/api/feedback", { ep: EP, ...actInfo(), scrollY: Math.round(scrollY), viewport: [innerWidth, innerHeight], target, text,
          snapshot: snap.toDataURL("image/png"), drawing: ink.toDataURL("image/png"), hasDrawing: strokes.length > 0 });
      } catch (e) { st.textContent = "save failed: is the review server running?"; return; }
      notes = await api(`/api/feedback?ep=${encodeURIComponent(EP)}`); count();
      ta.value = ""; strokes = []; paint();
      st.textContent = "saved ✓";
    }

    function openNotes() {
      panel = document.createElement("div");
      panel.className = `panel ${side}`;
      const render = () => {
        const sorted = [...notes].sort((a, b) => (a.act ?? 0) - (b.act ?? 0) || a.scrollY - b.scrollY);
        panel.innerHTML = `<div class="row"><b>NOTES · ${slug}</b><span class="hint">${notes.filter((n) => !n.done).length} open</span></div>
          <div class="list">${sorted.map((n) => `
            <div class="note${n.done ? " done" : ""}" data-id="${n.id}">
              <div class="hint">#${n.id} · act ${n.act ?? "?"} ${n.actTitle ? "· " + n.actTitle : ""}</div>
              ${n.snapshot ? `<img src="${BASE}${n.snapshot}" loading="lazy" alt="">` : ""}
              <div class="txt">${(n.text || "").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</div>
              <div class="row"><button data-n="done">${n.done ? "REOPEN" : "DONE"}</button><button data-n="del">DELETE</button></div>
            </div>`).join("") || '<span class="hint">No notes yet. Use ✎ ANNOTATE.</span>'}</div>`;
      };
      render();
      root.appendChild(panel);
      panel.addEventListener("click", async (e) => {
        const el = e.target.closest(".note"); if (!el) return;
        const n = notes.find((x) => x.id === +el.dataset.id), act = e.target.dataset.n;
        if (act === "done") { await api("/api/feedback/update", { ep: EP, id: n.id, done: !n.done }); }
        else if (act === "del") { if (!confirm(`Delete note #${n.id}?`)) return; await api("/api/feedback/delete", { ep: EP, id: n.id }); }
        else return goTo(n);
        notes = await api(`/api/feedback?ep=${encodeURIComponent(EP)}`); count(); render();
      });
    }

    // jump to where a note was left and lay its drawing over the page
    function goTo(n) {
      const a = actInfo().act;
      if (n.act != null && n.act !== a) {
        try { sessionStorage.setItem("tr-review-goto", String(n.id)); } catch {}
        location.hash = `act=${n.act}`; location.reload();
        return;
      }
      setMode("off");
      scrollTo({ top: n.scrollY || 0 });
      if (n.drawing) {
        const im = new Image();
        im.onload = () => {
          show.width = innerWidth; show.height = innerHeight;
          const sg = show.getContext("2d"); sg.clearRect(0, 0, show.width, show.height); sg.drawImage(im, 0, 0, im.width, im.height);
          show.dataset.y = String(scrollY);
          root.appendChild(show);
          if (!showClose) { showClose = document.createElement("button"); showClose.className = "x"; showClose.onclick = hideShown; }
          showClose.textContent = `✕ HIDE DRAWING #${n.id}`; root.appendChild(showClose);
        };
        im.src = `${BASE}${n.drawing}?v=${n.id}`;
      }
    }
    function hideShown() { show.remove(); if (showClose) showClose.remove(); }
    addEventListener("scroll", () => { if (show.isConnected && Math.abs(scrollY - (show.dataset.y ?? scrollY)) > 4) hideShown(); }, { passive: true });

    addEventListener("resize", () => { if (mode === "annotate") sizeInk(); });
    addEventListener("keydown", (e) => {
      if (mode !== "annotate") return;
      if (e.key === "Escape") setMode("off");
      else if (e.key === "z" && (e.ctrlKey || e.metaKey) && e.target.tagName !== "TEXTAREA") { e.preventDefault(); strokes.pop(); paint(); }
    });
    try {
      const pending = sessionStorage.getItem("tr-review-goto");
      if (pending) { sessionStorage.removeItem("tr-review-goto"); const n = notes.find((x) => x.id === +pending); if (n) setTimeout(() => goTo(n), 400); }
    } catch {}
  }
})();
