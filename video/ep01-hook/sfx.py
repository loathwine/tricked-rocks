"""Synthesize the hook's sound bed (no samples): drone, build ticks, a 'tink',
14 rising doubling blips and an impact. usage: python3 sfx.py timing.json out.wav"""
import json, math, random, struct, sys, wave

T = json.load(open(sys.argv[1]))
SR = 48000
N = int(T["end"] * SR)
buf = [0.0] * N
random.seed(3)

def add(t0, dur, fn, vol):
    s0 = int(t0 * SR)
    for i in range(int(dur * SR)):
        j = s0 + i
        if 0 <= j < N:
            buf[j] += vol * fn(i / SR, dur)

def env(t, dur, a=0.005, r=None):
    r = r or dur
    return min(1.0, t / a) * max(0.0, 1 - t / r)

def tone(f, shape="sine", slide=None):
    def fn(t, dur):
        freq = f if slide is None else f * (slide / f) ** (t / dur)
        ph = 2 * math.pi * freq * t
        v = math.sin(ph) if shape == "sine" else (1.0 if math.sin(ph) > 0 else -1.0) * 0.5
        return v * env(t, dur)
    return fn

# low drone, fades in, ducks for the title card
def drone(t, dur):
    fade = min(1.0, t / 1.5) * min(1.0, max(0.0, (T["a3e"] + 0.1 - t)) / 0.3 + 0.0) if t < T["a3e"] + 0.1 else 0.0
    return fade * (0.6 * math.sin(2 * math.pi * 55 * t) + 0.4 * math.sin(2 * math.pi * 82.6 * t + 0.3 * math.sin(t * 0.7)))
add(0, T["end"], drone, 0.10)

# CPU assembling: soft ticks
for i in range(18):
    add(0.15 + i * 0.075, 0.03, tone(900 + i * 40, "square"), 0.035)
# GPU core pops in: "tink"
add(T["a2"] + 0.05, 0.25, tone(1760), 0.12)
# question mark: little boing
add(T["a2"] + 1.9, 0.22, tone(440, "sine", 880), 0.08)

# doublings 1 -> 16,384: 14 blips on the same curve as the visuals
hit = T["a3"] + (T["a3e"] - T["a3"]) * 0.42
start = T["a3"] - 0.1
for d in range(1, 15):
    k = (d / 14) ** (1 / 1.6)
    add(start + k * (hit - start), 0.06, tone(220 * 2 ** (d / 4), "square"), 0.05)

# impact on "HUNDRED"
add(hit, 0.9, lambda t, dur: math.sin(2 * math.pi * 50 * (1 - t / 2) * t) * max(0, 1 - t / dur) ** 2, 0.45)
add(hit, 0.35, lambda t, dur: (random.random() * 2 - 1) * max(0, 1 - t / dur) ** 3, 0.18)
# title card chime
for i, st in enumerate([0, 4, 7, 12]):
    add(T["a3e"] + 0.1 + i * 0.07, 0.35, tone(523.25 * 2 ** (st / 12), "square"), 0.035)

peak = max(abs(x) for x in buf) or 1
with wave.open(sys.argv[2], "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x / max(1, peak))) * 32000)) for x in buf))
print("sfx written", sys.argv[2])
