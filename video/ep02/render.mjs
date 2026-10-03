// Render the video with headless Chromium. Modes:
//   node render.mjs frames <out.mp4> [fps]      → pipes PNG frames into ffmpeg (video only)
//   node render.mjs stills <dir> t1 t2 ...        → PNG stills at given times
import { spawn } from "node:child_process";
import fs from "node:fs";
const [mode, out, ...rest] = process.argv.slice(2);
const TIMELINE = JSON.parse(fs.readFileSync(process.env.TIMELINE || "timeline.json", "utf8"));
const URL = process.env.SCENE_URL || "http://localhost:8765/video/ep02/scene.html";
const PORT = 9335;
const chrome = spawn("chromium", ["--headless=new", `--remote-debugging-port=${PORT}`, "--no-sandbox", "--disable-gpu", "--window-size=1920,1080", "--hide-scrollbars", "--mute-audio", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50; i++) {
  try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); const p = j.find((x) => x.type === "page"); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {}
  await sleep(200);
}
await new Promise((r, rej) => { ws.onopen = r; ws.onerror = () => rej(new Error("ws error")); });
let id = 0; const pend = new Map(); const errors = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
await send("Runtime.enable"); await send("Page.enable");
await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.TIMELINE = ${JSON.stringify(TIMELINE)};` });
await send("Page.navigate", { url: URL });
await sleep(1500);
await ev("window.sceneReady");
if (errors.length) console.error("page errors:", errors);
const grab = async (t) => Buffer.from((await ev(`renderFrame(${t}); document.getElementById('c').toDataURL('image/png')`)).split(",")[1], "base64");

if (mode === "stills") {
  fs.mkdirSync(out, { recursive: true });
  for (const t of rest.map(Number)) fs.writeFileSync(`${out}/t${t.toFixed(2).padStart(7, "0")}.png`, await grab(t));
} else {
  const fps = +(rest[0] || 30), end = TIMELINE[TIMELINE.length - 1].t1, n = Math.ceil(end * fps);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", out], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    const buf = await grab(f / fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 300 === 0) console.log(`frame ${f}/${n} · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(`done: ${n} frames`);
}
console.log("scene errors:", (await ev("window.__sceneErrors || 0")));
ws.close(); chrome.kill();
process.exit(0);
