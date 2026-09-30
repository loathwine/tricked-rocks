// Render scene.html frame by frame with headless Chromium (CDP), write PNGs to frames/.
// usage: node render.mjs <timing.json> [fps]
import { spawn } from "node:child_process";
import fs from "node:fs";
const TIMING = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const FPS = +(process.argv[3] || 30);
const URL = process.env.SCENE_URL || "http://localhost:8765/video/ep01-hook/scene.html";
fs.rmSync("frames", { recursive: true, force: true });
fs.mkdirSync("frames");
const chrome = spawn("chromium", ["--headless=new", "--remote-debugging-port=9334", "--no-sandbox", "--disable-gpu", "--window-size=1920,1080", "--hide-scrollbars", "--mute-audio", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 50; i++) {
  try { const j = await (await fetch("http://127.0.0.1:9334/json")).json(); const p = j.find((x) => x.type === "page"); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {}
  await sleep(200);
}
await new Promise((r, rej) => { ws.onopen = r; ws.onerror = (e) => rej(new Error("ws error")); });
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => (await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
console.log("connected"); await send("Page.enable"); console.log("page enabled");
await send("Page.addScriptToEvaluateOnNewDocument", { source: `window.TIMING = ${JSON.stringify(TIMING)};` });
await send("Page.navigate", { url: URL });
await sleep(1500);
console.log("navigated"); console.log("ready:", await ev("window.sceneReady"));
const n = Math.ceil(TIMING.end * FPS);
for (let f = 0; f < n; f++) {
  const url = await ev(`renderFrame(${f / FPS}); document.getElementById('c').toDataURL('image/png')`);
  fs.writeFileSync(`frames/f${String(f).padStart(4, "0")}.png`, Buffer.from(url.split(",")[1], "base64"));
  if (f % 60 === 0) process.stdout.write(`frame ${f}/${n}\n`);
}
ws.close(); chrome.kill();
console.log(`done: ${n} frames at ${FPS} fps`);
process.exit(0);
