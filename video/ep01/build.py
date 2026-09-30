"""Build the EP01 timeline, voice track, synthesized sound bed and captions.

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

# ambient bed: two slow detuned drones + a soft pad that swells in the finale
bed = 0.55 * np.sin(2 * np.pi * 55 * tt) + 0.35 * np.sin(2 * np.pi * 82.4 * tt + 0.4 * np.sin(tt * 0.3)) + 0.18 * np.sin(2 * np.pi * 110.3 * tt)
swell_end = seg["g1"]["t0"] + 2 if "g1" in seg else END
swell = np.clip((tt - seg["r1"]["t0"]) / 8, 0, 1) * np.clip((swell_end - tt) / 3, 0, 1) if "r1" in seg else np.zeros(N, np.float32)
pad = swell * (0.25 * np.sin(2 * np.pi * 220 * tt) + 0.2 * np.sin(2 * np.pi * 277.2 * tt) + 0.2 * np.sin(2 * np.pi * 329.6 * tt))
fade = np.clip(tt / 2, 0, 1) * np.clip((END - tt) / 2, 0, 1)
# (the low drone bed was removed: it read as a constant hum on good speakers)
sfx += (0.05 * pad) * fade

if "s01" in seg:  # cues for the narrated episode
    # act changes: a soft rising whoosh
    for sid in ["s09", "s14", "s18", "s23", "s26", "s28"]:
        add(seg[sid]["t0"], tone(180, 0.5, "saw", 900) * 0.5, 0.05)

    S = lambda sid, frac=0.0: seg[sid]["t0"] + frac * (seg[sid]["t1"] - seg[sid]["t0"])
    Sp = lambda sid, frac=0.0: seg[sid]["t0"] + frac * seg[sid]["speech"]

    # cold open
    add(S("s01", 0.25), tone(1320, 0.05), 0.05); add(S("s01", 0.62), tone(1320, 0.05), 0.05)
    add(S("s02", 0.55), boom(0.6), 0.25)
    for i in range(10):  # counter rising in the crowd
        add(S("s04", 0.2 + i * 0.065), tone(300 * 2 ** (i / 5), 0.07, "square"), 0.03)
    add(S("s06", 0.05), tone(200, 1.2, "sine", 400, attack=0.6), 0.08)
    add(S("s07", 0.2), tone(1760, 0.25), 0.1)
    add(S("s07", 0.7), tone(440, 0.22, "sine", 880), 0.07)
    hit = Sp("s08", 0.4)
    start = seg["s08"]["t0"]
    for dd in range(1, 15):
        k = (dd / 14) ** (1 / 1.6); add(start + k * (hit - start), tone(220 * 2 ** (dd / 4), 0.06, "square"), 0.045)
    add(hit, boom(), 0.4); add(hit, noise(0.35), 0.12)
    add(seg["s08"]["t0"] + seg["s08"]["speech"] + 0.15, chime(), 0.05)

    # act 1
    for i in range(8):
        add(S("s10", 0.12 + i * 0.104), tone(330 + i * 55, 0.05, "sine"), 0.06)
    for i in range(40):
        k = (i / 40) ** (1 / 2.2); add(S("s11", 0.03 + k * 0.9), tone(1320, 0.015, "sine"), 0.03)
    add(S("s12", 0.62), boom(0.5), 0.2)
    add(S("s13", 0.72), noise(1.5, 1.5), 0.05)
    # act 2
    for i in range(4):
        add(S("s14", 0.4 + i * 0.1), tone(520, 0.08, "sine", 780), 0.1)
    add(S("s15", 0.3), boom(0.5), 0.3)
    for i in range(16):
        add(seg["s16"]["t0"] + 0.2 + i * 0.12, tone(1100, 0.02, "sine"), 0.04)
    # act 3
    for i in range(8):
        add(S("s18", 0.45 + i * 0.035), tone(520 + i * 30, 0.06, "sine", 780), 0.05)
    for i in range(9):
        add(S("s19", 0.1 + i * 0.097), tone(330 + i * 40, 0.04, "sine"), 0.05)
    r0 = Sp("s20", 0.4)
    for i in range(12):
        add(r0 + i * 0.25, tone(1320, 0.015), 0.04)
    add(r0 + 3.2, chime(392, (0, 4, 7, 12, 16, 19, 24), 0.06), 0.07)
    add(S("s21", 0.2), chime(523.25, (0, 7, 12), 0.1), 0.05)
    add(S("s22", 0.05), tone(150, 2.0, "saw", 1200, attack=1.0) * 0.4, 0.05)
    # act 6: laser zaps
    for i in range(8):
        add(S("s28", 0.52 + i * 0.05), tone(2400, 0.06, "square", 800), 0.03)
    # finale
    if "p6" in seg:
        add(seg["p6"]["t0"] + 0.1, boom(1.5), 0.25)
        add(seg["p6"]["t0"] + 0.1, chime(261.63, (0, 7, 12, 16, 19, 24), 0.12), 0.06)
    # rewind: a falling tape whine + hiss
    add(S("s02b", 0.3), tone(1400, 3.5, "saw", 180, attack=0.3) * 0.5, 0.05); add(S("s02b", 0.3), noise(3.5, 0.5), 0.03)
    # reflect: projector clicks while the film runs backwards
    for i in range(int((seg["r1"]["t1"] - seg["r1"]["t0"]) * 8)):
        add(seg["r1"]["t0"] + i / 8, tone(3000, 0.01, "square"), 0.02)
    # poem: a soft bell at each line
    for sid in [x for x in ["p1", "p2", "p3", "p4", "p5"] if x in seg]:
        add(seg[sid]["t0"] + 0.05, tone(659.25, 2.5, "sine"), 0.03)
        add(seg[sid]["t0"] + 0.05, tone(987.77, 2.0, "sine"), 0.015)
    # the human computer: crank clatter
    for i in range(int((seg["s03b"]["t1"] - seg["s03b"]["t0"]) * 3)):
        add(seg["s03b"]["t0"] + 0.3 + i / 3, noise(0.05, 2), 0.04)
    if "s32" in seg:
        add(S("s32", 0.55), chime(), 0.05)

# ---------------------------------------------------------------- the wordless ending: a score + scene sounds
def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, "same").astype(np.float32)

if "g1" in seg:
    A0 = seg["g1"]["t0"]
    g9 = seg["g9"]; MIRROR = g9.get("mirror", True)
    OFF = g9["t0"] + (0.72 if MIRROR else 0.92) * (g9["t1"] - g9["t0"])   # the phone screen turns off / the fade ends
    D = lambda sid: seg[sid]["t1"] - seg[sid]["t0"]
    G = lambda sid, f=0.0: seg[sid]["t0"] + f * D(sid)
    rng = np.random.default_rng(7)
    score = np.zeros(N, np.float32)
    # pad chords: Am  F  C  G, slow, cross-faded
    prog = [[110.0, 130.81, 164.81, 220.0], [87.31, 110.0, 130.81, 174.61], [130.81, 164.81, 196.0, 261.63], [98.0, 123.47, 146.83, 196.0]]
    CH = 6.0
    j = 0
    while A0 + j * CH < OFF:
        a = int((A0 + j * CH) * SR); b = min(N, int((A0 + (j + 1) * CH + 1.5) * SR))
        x = np.arange(b - a) / SR; L = (b - a) / SR
        env = np.clip(x / 1.5, 0, 1) * np.clip((L - x) / 1.5, 0, 1)
        for f in prog[j % 4]:
            score[a:b] += (np.sin(2 * np.pi * f * x) + 0.35 * np.sin(2 * np.pi * 2.003 * f * x) + 0.15 * np.sin(2 * np.pi * 3.01 * f * x)) * env * 0.25
        j += 1
    inten = np.clip((tt - A0) / (OFF - A0), 0, 1) ** 1.4 * 0.75 + 0.25
    score *= inten
    # arpeggio from the time-lapse on, getting denser as the chip comes alive
    t_ = G("g4")
    while t_ < OFF:
        chord = prog[int((t_ - A0) / CH) % 4]
        k = int((t_ - G("g4")) / 0.375)
        f = chord[k % 4] * (2 if k % 8 < 4 else 4)
        n = int(0.7 * SR); x = np.arange(n) / SR
        pl = (np.sin(2 * np.pi * f * x) + 0.3 * np.sin(2 * np.pi * 2 * f * x)) * np.exp(-x * 6)
        a = int(t_ * SR); b = min(N, a + n); score[a:b] += 0.12 * pl[: b - a] * inten[a]
        t_ += 0.1875 if t_ > G("g8") else 0.375
    sfx += 0.9 * score

    wn = rng.uniform(-1, 1, N).astype(np.float32)
    def region(sid, sig, f0=0.0, f1=1.0, vol=1.0, fade=0.8):
        a = int(G(sid, f0) * SR); b = int(G(sid, f1) * SR)
        x = np.arange(b - a) / SR; L = (b - a) / SR
        sfx[a:b] += vol * sig[a:b] * np.clip(x / fade, 0, 1) * np.clip((L - x) / fade, 0, 1)
    region("g1", wn - lowpass(wn, 6), vol=0.10)                     # rain (bright hiss)
    add(G("g1", 0.45), boom(2.2) + 0.5 * noise(2.2, 2), 0.25)       # thunder
    add(G("g1", 0.75), noise(0.3, 3), 0.06)                          # a rock breaks off
    region("g2", lowpass(wn, 60) * (0.7 + 0.3 * np.sin(tt * 1.3)), vol=0.9)   # river
    for i in range(14): add(G("g2", 0.05 + i * 0.065), tone(900 + 300 * (i % 4), 0.03), 0.02)  # bubbles, pebbles
    step = 0.8
    for i in range(int(D("g3") / step)):                              # dinosaur footsteps
        add(G("g3") + 0.4 + i * step, boom(0.45), 0.28); add(G("g3") + 0.4 + i * step, noise(0.12, 3), 0.05)
    add(G("g4"), tone(120, 2.5, "saw", 1500, attack=2.0) * 0.3, 0.05) # time-lapse whoosh
    region("g4", lowpass(wn, 120) * (0.6 + 0.4 * np.sin(tt * 0.9)), vol=1.6)  # wind
    for e in range(1, 6):                                             # a soft whoosh at each jump between eras
        add(G("g4", e / 6) - 0.2, tone(300, 0.6, "sine", 900, attack=0.3), 0.04)
    region("g5", lowpass(wn, 200), 0.45, 1.0, vol=2.5)                # furnace roar
    add(G("g5", 0.45), boom(0.8), 0.2)
    add(G("g6", 0.1), tone(1200, 4.0, "sine", 2400, attack=1.5), 0.03)  # crystal shimmer
    add(G("g6", 0.62), noise(0.4, 2), 0.05)                           # the slice
    for i in range(18): add(G("g7", 0.05 + i * 0.05), tone(2600, 0.05, "square", 900), 0.02)  # light burning in
    hum = np.sin(2 * np.pi * 120 * tt) * 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 240 * tt))
    a8, b8 = int(G("g8") * SR), int(OFF * SR)
    sfx[a8:b8] += 0.04 * hum[a8:b8] * np.linspace(0.2, 1, b8 - a8)    # current, rising
    for i in range(30): add(G("g8", rng.uniform(0, 1)), tone(3000, 0.01, "square"), 0.02)
    region("g9", lowpass(wn, 400), 0.0, 0.72, vol=2.0)               # a low swell as we zoom out
    if MIRROR:  # the screen dies: everything stops, a tiny click, then silence
        sfx[int(OFF * SR):] = 0
        add(OFF, tone(1800, 0.012, "square"), 0.08)
    else:       # the last chord rings out as we fade to the end card
        a_ = int((OFF - 2.5) * SR); b_ = int(OFF * SR)
        sfx[a_:b_] *= np.linspace(1, 0, b_ - a_); sfx[b_:] = 0
    add(seg["g10"]["t0"] + 1.0, chime(261.63, (0, 7, 12), 0.25), 0.03)

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
        txt = re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).lower() if m.group(1) not in ("GPU", "CPU", "AI", "SIMD") else m.group(1), txt)
        f.write(f"{i}\n{ts(s['voice'])} --> {ts(s['voice'] + len(clips[s['id']]) / SR)}\n{txt}\n\n")
print(f"wrote {OUT}/voice.wav, {OUT}/sfx.wav, {OUT}/captions.srt")
