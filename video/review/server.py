#!/usr/bin/env python3
"""Local video review server: serves the repo (with HTTP Range, so videos seek) and stores frame comments.

usage:  python3 video/review/server.py
  video:   http://localhost:8766/video/review/?ep=ep02        → notes in video/<ep>/review/
  lesson:  http://localhost:8766/lessons/02-the-switch/?review → notes in lessons/<slug>/review/
Each note is a JSON entry in feedback.json plus a PNG snapshot (frame or viewport + drawing).
"""
import base64, json, os, re, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
PORT = int(os.environ.get("PORT", 8766))
EP_RE = re.compile(r"^ep\d+$")
LESSON_RE = re.compile(r"^\d\d-[a-z0-9-]+$")


def ep_dir(ep):
    """ep is either an episode id (ep02 → video/ep02) or "lesson:<slug>" (→ lessons/<slug>)."""
    if (ep or "").startswith("lesson:"):
        slug = ep[7:]
        if LESSON_RE.match(slug) and os.path.isdir(os.path.join(ROOT, "lessons", slug)):
            return os.path.join(ROOT, "lessons", slug)
        raise ValueError("bad lesson")
    if not EP_RE.match(ep or ""):
        raise ValueError("bad episode")
    return os.path.join(ROOT, "video", ep)


def load(ep):
    p = os.path.join(ep_dir(ep), "review", "feedback.json")
    return json.load(open(p)) if os.path.exists(p) else []


def save(ep, notes):
    d = os.path.join(ep_dir(ep), "review")
    os.makedirs(d, exist_ok=True)
    tmp = os.path.join(d, "feedback.json.tmp")
    json.dump(notes, open(tmp, "w"), indent=1)
    os.replace(tmp, os.path.join(d, "feedback.json"))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        if "/api/" in (self.path or ""):
            super().log_message(fmt, *args)

    def json_out(self, obj, code=200):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(u.query).items()}
        try:
            if u.path == "/api/videos":
                d = ep_dir(q.get("ep"))
                vids = []
                for sub in sorted(os.listdir(d)):
                    full = os.path.join(d, sub)
                    if sub.startswith("out") and os.path.isdir(full):
                        for f in sorted(os.listdir(full)):
                            if f.endswith(".mp4") and f != "video_only.mp4":
                                st = os.stat(os.path.join(full, f))
                                tl = "timeline.json" if sub == "out" else f"timeline{sub[3:]}.json"
                                vids.append({"path": f"{sub}/{f}", "timeline": tl, "mtime": int(st.st_mtime)})
                return self.json_out(vids)
            if u.path == "/api/feedback":
                return self.json_out(load(q.get("ep")))
        except ValueError as e:
            return self.json_out({"error": str(e)}, 400)
        return self.serve_ranged() if u.path.endswith((".mp4", ".wav")) else super().do_GET()

    def serve_ranged(self):
        path = self.translate_path(urlparse(self.path).path)
        if not os.path.isfile(path):
            return self.send_error(404)
        size = os.path.getsize(path)
        m = re.match(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        start, end = 0, size - 1
        if m:
            if m.group(1):
                start = int(m.group(1))
                if m.group(2):
                    end = min(int(m.group(2)), size - 1)
            elif m.group(2):
                start = size - int(m.group(2))
        self.send_response(206 if m else 200)
        self.send_header("Content-Type", "video/mp4" if path.endswith(".mp4") else "audio/wav")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Cache-Control", "no-store")
        if m:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            left = end - start + 1
            try:
                while left > 0:
                    chunk = f.read(min(1 << 20, left))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    left -= len(chunk)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_POST(self):
        u = urlparse(self.path)
        data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        try:
            ep = data.get("ep")
            notes = load(ep)
            if u.path == "/api/feedback":
                nid = max([n["id"] for n in notes] + [0]) + 1
                rdir = os.path.join(ep_dir(ep), "review")
                os.makedirs(rdir, exist_ok=True)
                note = {k: data.get(k) for k in ("t", "seg", "scene", "line", "text", "video", "videoMtime", "act", "actTitle", "scrollY", "viewport", "target", "points") if data.get(k) is not None}
                note.update(id=nid, created=time.strftime("%Y-%m-%d %H:%M:%S"), done=False)
                for key, suffix in (("snapshot", ""), ("drawing", "_drawing")):
                    b64 = (data.get(key) or "").split(",", 1)[-1]
                    if b64 and (key == "snapshot" or data.get("hasDrawing")):
                        fn = f"{nid:03d}{suffix}.png"
                        open(os.path.join(rdir, fn), "wb").write(base64.b64decode(b64))
                        note[key] = f"review/{fn}"
                notes.append(note)
                save(ep, notes)
                return self.json_out(note)
            if u.path == "/api/feedback/update":
                for n in notes:
                    if n["id"] == data["id"]:
                        for k in ("text", "done"):
                            if k in data:
                                n[k] = data[k]
                save(ep, notes)
                return self.json_out({"ok": True})
            if u.path == "/api/feedback/delete":
                keep = [n for n in notes if n["id"] != data["id"]]
                for n in notes:
                    if n["id"] == data["id"]:
                        for k in ("snapshot", "drawing"):
                            if n.get(k):
                                try: os.remove(os.path.join(ep_dir(ep), n[k]))
                                except FileNotFoundError: pass
                save(ep, keep)
                return self.json_out({"ok": True})
        except (ValueError, KeyError) as e:
            return self.json_out({"error": str(e)}, 400)
        self.send_error(404)


if __name__ == "__main__":
    print(f"review server:\n  video:  http://localhost:{PORT}/video/review/?ep=ep02\n  lesson: http://localhost:{PORT}/lessons/02-the-switch/?review")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
