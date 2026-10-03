// YouTube uploader for Tricked Rocks, adapted from craftplan/scripts/yt-upload.mjs.
//
// Reads an upload manifest (video/ep01/upload.json) and uploads one entry:
// the video, its captions, and adds it to a playlist (created if missing).
// Every upload is recorded in upload-log.json next to the manifest, so a
// re-run never uploads the same entry twice.
//
// ── One-time setup (only a human can do this; Google requires it) ──
// 1. console.cloud.google.com → create a project (or reuse craftplan's).
// 2. APIs & Services → Library → enable "YouTube Data API v3".
// 3. Credentials → Create credentials → OAuth client ID → "Desktop app" → download the JSON.
// 4. Save it as  secrets/yt-client.json  in this repo (secrets/ is gitignored).
// 5. First run prints a consent URL; the Google account/brand you pick there is the
//    channel the video goes to. The refresh token is cached in secrets/yt-token.json.
//    Consent is interactive, so run the first upload yourself (in Claude Code: `! <command>`).
//
// ── Usage ──
//   node scripts/yt-upload.mjs video/ep01/upload.json main --dry-run
//   node scripts/yt-upload.mjs video/ep01/upload.json main
//   node scripts/yt-upload.mjs video/ep01/upload.json short
//   node scripts/yt-upload.mjs video/ep02/upload.json main --thumbnail   (set the thumbnail of an uploaded entry)
//   node scripts/yt-upload.mjs video/ep02/upload.json main --public      (switch an uploaded entry to public)
//   New uploads also set entry.thumbnail when it's given.
//
// Notes carried over from craftplan:
// - OAuth loopback port comes from YT_OAUTH_PORT (default 9878 here; craftplan uses 9877, Blender MCP holds 9876).
// - Never re-auth with narrower scopes: it overwrites the token and later uploads fail with
//   "insufficient authentication scopes".
// - While the GCP consent screen is in "Testing", refresh tokens expire after ~7 days (invalid_grant):
//   delete secrets/yt-token.json and consent again.
// - Always send the full status object: videos.update(status) replaces it wholesale.
// - An upload costs ~1,600 quota units of the default 10,000/day; captions ~400; playlist ops ~50 each.

import { readFileSync, existsSync, writeFileSync, mkdirSync, createReadStream } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { google } from "googleapis";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SECRETS = resolve(REPO, "secrets");
const CLIENT_PATH = resolve(SECRETS, "yt-client.json");
const TOKEN_PATH = resolve(SECRETS, "yt-token.json");
// youtube.upload: videos.insert · youtube.force-ssl: captions + playlists (a superset of "youtube")
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.force-ssl"];
const PORT = +(process.env.YT_OAUTH_PORT || 9878);

const fail = (msg) => { console.error(`[yt] ${msg}`); process.exit(1); };
const [manifestArg, key] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const DRY = process.argv.includes("--dry-run");
const SET_THUMB = process.argv.includes("--thumbnail"), MAKE_PUBLIC = process.argv.includes("--public");
if (!manifestArg || !key) fail("usage: node scripts/yt-upload.mjs <upload.json> <entry> [--dry-run]");
const MANIFEST = resolve(manifestArg), BASE = dirname(MANIFEST);
const entry = JSON.parse(readFileSync(MANIFEST, "utf-8"))[key] || fail(`no entry "${key}" in ${MANIFEST}`);
const LOG_PATH = resolve(BASE, "upload-log.json");
const log = existsSync(LOG_PATH) ? JSON.parse(readFileSync(LOG_PATH, "utf-8")) : {};
const FILE = resolve(BASE, entry.file);
const CAPTIONS = entry.captions && resolve(BASE, entry.captions);
if (!existsSync(FILE)) fail(`video not found: ${FILE}`);

const status = {
  privacyStatus: entry.publishAt ? "private" : entry.privacy || "private",
  ...(entry.publishAt ? { publishAt: new Date(entry.publishAt).toISOString() } : {}),
  selfDeclaredMadeForKids: false,
  embeddable: true,
  publicStatsViewable: true,
  license: "youtube",
};
const snippet = { title: entry.title, description: entry.description, tags: entry.tags || [], categoryId: entry.categoryId || "27" };

console.log(`[yt] entry "${key}": ${FILE}`);
console.log(`[yt]   title:    ${snippet.title}`);
console.log(`[yt]   privacy:  ${status.privacyStatus}${status.publishAt ? ` → public at ${status.publishAt}` : ""}`);
console.log(`[yt]   playlist: ${entry.playlist || "(none)"} · captions: ${CAPTIONS && existsSync(CAPTIONS) ? CAPTIONS : "(none)"}`);
const UPDATE = Boolean(log[key] && (SET_THUMB || MAKE_PUBLIC));
if (log[key] && !UPDATE) console.log(`[yt]   already uploaded: https://youtube.com/watch?v=${log[key].videoId} — skipping`);
if ((SET_THUMB || MAKE_PUBLIC) && !log[key]) fail(`entry "${key}" isn't uploaded yet`);
if (DRY || (log[key] && !UPDATE)) process.exit(0);
if (!existsSync(CLIENT_PATH)) fail(`OAuth client missing: ${CLIENT_PATH} (see the setup notes at the top of this file)`);

async function authorize() {
  const creds = JSON.parse(readFileSync(CLIENT_PATH, "utf-8"));
  const { client_id, client_secret } = creds.installed || creds.web;
  const redirectUri = `http://127.0.0.1:${PORT}`;
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirectUri);
  if (existsSync(TOKEN_PATH)) { oauth2.setCredentials(JSON.parse(readFileSync(TOKEN_PATH, "utf-8"))); return oauth2; }
  const authUrl = oauth2.generateAuthUrl({ access_type: "offline", scope: SCOPES, prompt: "consent" });
  console.log("[yt] Open this URL in a browser, pick the channel to upload to, and grant access:\n", authUrl);
  const code = await new Promise((res, rej) => {
    const server = http.createServer((req, r) => {
      const c = new URL(req.url, redirectUri).searchParams.get("code");
      r.end("You can close this tab and return to the terminal.");
      if (c) { server.close(); res(c); }
    });
    server.listen(PORT, "127.0.0.1");
    setTimeout(() => { server.close(); rej(new Error("OAuth timed out")); }, 300000);
  });
  const { tokens } = await oauth2.getToken(code);
  oauth2.setCredentials(tokens);
  mkdirSync(SECRETS, { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
  console.log(`[yt] token cached → ${TOKEN_PATH}`);
  return oauth2;
}

const youtube = google.youtube({ version: "v3", auth: await authorize() });
const ch = (await youtube.channels.list({ part: ["snippet"], mine: true })).data.items?.[0];
console.log(`[yt] channel: ${ch?.snippet?.title} (${ch?.id})`);

async function setThumbnail(videoId) {
  const thumb = entry.thumbnail && resolve(BASE, entry.thumbnail);
  if (!thumb || !existsSync(thumb)) return console.log("[yt] no thumbnail in the manifest");
  await youtube.thumbnails.set({ videoId, media: { mimeType: thumb.endsWith(".png") ? "image/png" : "image/jpeg", body: createReadStream(thumb) } });
  console.log(`[yt] thumbnail set: ${entry.thumbnail}`);
}
if (UPDATE) {
  const videoId = log[key].videoId;
  if (SET_THUMB) await setThumbnail(videoId);
  if (MAKE_PUBLIC) {
    // videos.update replaces the whole status object, so send all of it
    await youtube.videos.update({ part: ["status"], requestBody: { id: videoId, status: { ...status, privacyStatus: "public", publishAt: undefined } } });
    log[key].publicAt = new Date().toISOString();
    writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
    console.log(`[yt] now public: https://youtube.com/watch?v=${videoId}`);
  }
  process.exit(0);
}

console.log("[yt] uploading video…");
const res = await youtube.videos.insert({ part: ["snippet", "status"], requestBody: { snippet, status }, media: { body: createReadStream(FILE) } });
const videoId = res.data.id;
log[key] = { videoId, title: snippet.title, uploadedAt: new Date().toISOString(), channel: ch?.id };
writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
console.log(`[yt] uploaded: https://youtube.com/watch?v=${videoId}`);
await setThumbnail(videoId).catch((e) => console.log(`[yt] thumbnail failed (${e.message}); retry with --thumbnail`));

if (CAPTIONS && existsSync(CAPTIONS)) {
  await youtube.captions.insert({
    part: ["snippet"],
    requestBody: { snippet: { videoId, language: "en", name: "English", isDraft: false } },
    media: { mimeType: "application/octet-stream", body: createReadStream(CAPTIONS) },
  });
  console.log("[yt] captions uploaded");
}

if (entry.playlist) {
  let pl = null, pageToken;
  do {
    const r = await youtube.playlists.list({ part: ["snippet"], mine: true, maxResults: 50, pageToken });
    pl = r.data.items.find((p) => p.snippet.title === entry.playlist) || null;
    pageToken = r.data.nextPageToken;
  } while (!pl && pageToken);
  if (!pl) {
    pl = (await youtube.playlists.insert({ part: ["snippet", "status"], requestBody: { snippet: { title: entry.playlist, description: "Interactive lessons on how computers really work, from sand to AI. https://loathwine.github.io/tricked-rocks/" }, status: { privacyStatus: entry.playlistPrivacy || status.privacyStatus } } })).data;
    console.log(`[yt] created playlist "${entry.playlist}"`);
  }
  await youtube.playlistItems.insert({ part: ["snippet"], requestBody: { snippet: { playlistId: pl.id, resourceId: { kind: "youtube#video", videoId } } } });
  console.log(`[yt] added to playlist "${entry.playlist}"`);
}
console.log(`[yt] done. Check it at https://studio.youtube.com/video/${videoId}/edit`);
