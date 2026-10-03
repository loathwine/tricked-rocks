"""Build the EP02 timeline, voice track, synthesized sound bed and captions.

usage (needs numpy):  nix-shell -p "python3.withPackages(ps: [ps.numpy])" --run "python3 build.py [narration.json] [outdir] [timeline.json]"
outputs: timeline.json, <outdir>/voice.wav, <outdir>/sfx.wav, <outdir>/captions.srt
Segments with "silent": seconds have no voice (used by the wordless ending).
"""
import json, os, re, sys, wave
import numpy as np

SR = 24000
LEAD, GAP = 0.6, 0.35
NARR = sys.argv[1] if len(sys.argv) > 1 else "narration.json"
OUT = sys.argv[2] if len(sys.argv) > 2 else "out"
TLF = sys.argv[3] if len(sys.argv) > 3 else "timeline.json"
os.makedirs(OUT, exist_ok=True)

narr = json.load(open(NARR))
timeline, t = [], LEAD
clips = {}
for s in narr:
    if "silent" in s:
        pcm = np.zeros(0, np.float32)
    else:
        with wave.open(f"audio/trim_{s['id']}.wav") as w:
            assert w.getframerate() == SR and w.getnchannels() == 1
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    clips[s["id"]] = pcm
    speech = len(pcm) / SR
    t0 = t if s is not narr[0] else 0.0
    start_voice = t
    t1 = t + (s["silent"] if "silent" in s else speech + GAP + s.get("pad", 0))
    s.setdefault("text", "")
    timeline.append({"id": s["id"], "scene": s["scene"], "t0": round(t0, 3), "t1": round(t1, 3),
                     "voice": round(start_voice, 3), "speech": round(speech + (start_voice - t0), 3), "text": s["text"],
                     **({"mirror": s["mirror"]} if "mirror" in s else {})})
    t = t1
END = t
json.dump(timeline, open(TLF, "w"), indent=1)
print(f"timeline: {len(timeline)} segments, {END:.1f} s ({END/60:.1f} min)")

N = int(END * SR) + SR
voice = np.zeros(N, np.float32)
for s in timeline:
    a = int(s["voice"] * SR)
    voice[a:a + len(clips[s["id"]])] += clips[s["id"]]

# ---------------------------------------------------------------- sound design
sfx = np.zeros(N, np.float32)
tt = np.arange(N) / SR
seg = {s["id"]: s for s in timeline}

def add(t0, sig, vol):
    a = int(t0 * SR)
    b = min(N, a + len(sig))
    if a < N:
        sfx[a:b] += vol * sig[: b - a]

def tone(f, dur, shape="sine", f2=None, attack=0.005):
    n = int(dur * SR); x = np.arange(n) / SR
    freq = f if f2 is None else f * (f2 / f) ** (x / dur)
    ph = 2 * np.pi * np.cumsum(np.full(n, 1.0) * freq) / SR
    sig = np.sin(ph) if shape == "sine" else np.sign(np.sin(ph)) * 0.5 if shape == "square" else 2 * (ph / (2 * np.pi) % 1) - 1
    env = np.minimum(1, x / attack) * np.maximum(0, 1 - x / dur)
    return sig * env

def noise(dur, decay=3):
    n = int(dur * SR); x = np.arange(n) / SR
    return np.random.default_rng(1).uniform(-1, 1, n) * np.maximum(0, 1 - x / dur) ** decay

def boom(dur=0.9):
    x = np.arange(int(dur * SR)) / SR
    return np.sin(2 * np.pi * 55 * (1 - x / 2) * x) * np.maximum(0, 1 - x / dur) ** 2

def chime(root=523.25, steps=(0, 4, 7, 12), dt=0.07):
    out = np.zeros(int((dt * len(steps) + 0.4) * SR), np.float32)
    for i, st in enumerate(steps):
        s = tone(root * 2 ** (st / 12), 0.35, "square"); a = int(i * dt * SR); out[a:a + len(s)] += s
    return out

S = lambda sid, frac=0.0: seg[sid]["t0"] + frac * (seg[sid]["t1"] - seg[sid]["t0"])
D = lambda sid: seg[sid]["t1"] - seg[sid]["t0"]
fade = np.clip(tt / 2, 0, 1) * np.clip((END - tt) / 2, 0, 1)
# a soft pad that swells from the shrink zoom through the finale
if "w2" in seg and "f2" in seg:
    swell = np.clip((tt - seg["w2"]["t0"]) / 6, 0, 1) * np.clip((seg["f2"]["t1"] + 1 - tt) / 3, 0, 1)
    pad = swell * (0.25 * np.sin(2 * np.pi * 220 * tt) + 0.2 * np.sin(2 * np.pi * 277.2 * tt) + 0.2 * np.sin(2 * np.pi * 329.6 * tt))
    sfx += (0.05 * pad) * fade

def mix(*sigs):
    out = np.zeros(max(len(x) for x in sigs), np.float32)
    for x in sigs: out[:len(x)] += x
    return out
click = lambda: mix(tone(1400, 0.03, "square"), 0.6 * noise(0.03, 4))
clack = lambda: mix(tone(260, 0.06, "square"), noise(0.06, 3))
ding = lambda f=880: mix(tone(f, 0.9, "sine"), 0.4 * tone(f * 2, 0.6, "sine"))
if "h1" in seg:  # cues for the narrated episode
    for sid in ["e1", "d1", "r1", "t1", "s1", "x1", "w1", "f1"]:   # act changes: a soft rising whoosh
        add(seg[sid]["t0"], tone(180, 0.5, "saw", 900) * 0.5, 0.05)
    add(S("h1", 0.72), mix(noise(0.2, 2), tone(2400, 0.05, "square")), 0.07)      # a tube burns out
    for i in range(int(D("h3") * 1.2)):                                       # the big switch flips
        if i / 1.2 < D("h3") * 0.2: add(seg["h3"]["t0"] + i / 1.2, click(), 0.05)
    add(seg["h4"]["t0"] + seg["h4"]["speech"] + 0.45, chime(), 0.05)          # title card
    add(seg["e2"]["t0"] + 1.1, click(), 0.07)                                  # close the switch
    add(seg["e2"]["t0"] + 1.2 + 520 / 210, ding(), 0.03)                       # the bulb lights
    add(S("d1", 0.11), noise(0.12, 3), 0.08)                                  # the wire is cut
    k = D("d1") * 0.24 + 1.1
    while k < D("d1") * 0.4: add(seg["d1"]["t0"] + k, click(), 0.05); k += 1.1   # the cut becomes a switch
    k = D("d1") * 0.4 + 1.3
    while k < D("d1"): add(seg["d1"]["t0"] + k, click(), 0.05); k += 1.3     # truth table steps
    k = 0.0
    while k < D("r3") * 0.26: add(seg["r3"]["t0"] + k + 0.21, clack(), 0.05); k += 1 / 1.2   # the relay clacking
    add(S("r3", 0.26), mix(clack(), noise(0.2, 2)), 0.08)                      # jammed
    add(seg["d2"]["t0"] + 0.95, click(), 0.07)
    add(S("r1", 0.32), click(), 0.07); add(S("r1", 0.62), clack(), 0.12); add(S("r1", 0.62) + 0.05, ding(660), 0.025)
    per = 2.6 + 8 * 0.25; n = 0
    while n * per < D("r2"):
        for i in range(8):
            tt_ = n * per + 0.4 + i * 0.25
            if tt_ < D("r2"): add(seg["r2"]["t0"] + tt_, clack(), 0.06)
        n += 1
    add(S("t1", 0.3), tone(90, 1.5, "sine", 140, attack=0.5), 0.05)           # filament warms up
    d = D("t2")
    for f in [0.22, 0.48, 0.72]: add(S("t2", f), click(), 0.05)
    k = d * 0.72 + 0.8
    while k < d: add(seg["t2"]["t0"] + k, click(), 0.04); k += 0.8
    add(S("s2", 0.12), tone(660, 0.2), 0.04); add(S("s2", 0.55), tone(520, 0.2), 0.04)
    for f in [0.0, 0.22, 0.62, 0.8]: add(S("x1", f) + 0.05, tone(440, 0.25, "sine", 660), 0.03)
    add(S("x3", 0.2 + 0.55 * 0.625), chime(392.0, (0, 4, 7, 12), 0.06), 0.05)  # threshold: the channel forms
    add(S("x4", 0.05), tone(660, 0.6, "sine", 330), 0.03)                      # the channel dissolves
    for i in range(3): add(S("w1", 0.3 + i * 0.12), tone(880, 0.15), 0.03)
    for i in range(7): add(S("w2", 0.62) + i * 0.35, tone(700 + i * 90, 0.08, "square"), 0.025)
    n = 1
    while n * 2.8 < D("f1") * 0.7:
        for i in range(7): add(seg["f1"]["t0"] + n * 2.8 + (i + 1) * 0.22, tone(1100, 0.03), 0.03)
        n += 1
    add(S("f2", 0.55), boom(1.5), 0.2); add(S("f2", 0.55), chime(261.63, (0, 7, 12, 16, 19, 24), 0.12), 0.06)
    add(S("f3", 0.12), chime(), 0.04)

def write(path, x, peak=0.9):
    x = x / max(1e-6, np.abs(x).max()) * peak
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

write(f"{OUT}/voice.wav", voice if np.abs(voice).max() > 0 else voice + 1e-6, 0.95)
write(f"{OUT}/sfx.wav", sfx, 0.9)

# captions (one cue per segment, split into ≤ 2 lines)
def ts(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int((s % 1) * 1000):03}"
with open(f"{OUT}/captions.srt", "w") as f:
    for i, s in enumerate([x for x in timeline if len(clips[x["id"]])], 1):
        txt = re.sub(r"<[^>]+>", "", s["text"]).replace("  ", " ").strip()
        txt = re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).lower() if m.group(1) not in ("GPU", "CPU", "AI", "SIMD", "ENIAC") else m.group(1), txt)
        f.write(f"{i}\n{ts(s['voice'])} --> {ts(s['voice'] + len(clips[s['id']]) / SR)}\n{txt}\n\n")
print(f"wrote {OUT}/voice.wav, {OUT}/sfx.wav, {OUT}/captions.srt")
