# Generated background music: a calm, warm pad with a soft plucked arpeggio. No samples, no licensing.
import numpy as np, wave, sys
SR = 44100
dur = float(sys.argv[1]) if len(sys.argv) > 1 else 240
out = sys.argv[2] if len(sys.argv) > 2 else 'public/music.wav'
t_all = np.arange(int(SR * dur)) / SR
mix = np.zeros((len(t_all), 2))
bpm = 84; beat = 60 / bpm; bar = beat * 4
# I - V - vi - IV in D major, voicings in Hz (midi)
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
chords = [[50, 57, 62, 66, 69], [45, 57, 61, 64, 69], [47, 54, 59, 62, 66], [43, 55, 59, 62, 67]]
rng = np.random.default_rng(3)
def pad(freq, start, length, amp):
    n0, n1 = int(start * SR), min(len(t_all), int((start + length) * SR))
    if n0 >= n1: return
    t = np.arange(n1 - n0) / SR
    env = np.minimum(1, t / 1.6) * np.minimum(1, (length - t) / 1.6).clip(0)
    sig = np.zeros_like(t)
    for d, w in ((-0.08, .5), (0, 1), (0.07, .5)):
        f = freq * 2 ** (d / 12)
        sig += w * (np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t) + 0.06 * np.sin(6 * np.pi * f * t))
    sig *= env * amp
    pan = rng.uniform(0.35, 0.65)
    mix[n0:n1, 0] += sig * (1 - pan); mix[n0:n1, 1] += sig * pan
def pluck(freq, start, amp):
    n0 = int(start * SR); length = 1.4; n1 = min(len(t_all), n0 + int(length * SR))
    if n0 >= n1: return
    t = np.arange(n1 - n0) / SR
    env = np.exp(-t * 3.2) * np.minimum(1, t / 0.005)
    sig = (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t) * np.exp(-t * 6)) * env * amp
    pan = rng.uniform(0.3, 0.7)
    mix[n0:n1, 0] += sig * (1 - pan); mix[n0:n1, 1] += sig * pan
nbars = int(dur / bar) + 1
for b in range(nbars):
    ch = chords[b % 4]
    for m in ch: pad(mid(m), b * bar, bar + 1.2, 0.05)
    pad(mid(ch[0] - 12), b * bar, bar + 1.2, 0.06)
    if b >= 2:
        notes = [ch[2] + 12, ch[3] + 12, ch[4] + 12, ch[3] + 12, ch[2] + 24, ch[4] + 12, ch[3] + 12, ch[4] + 12]
        for i, m in enumerate(notes):
            if rng.random() < 0.85: pluck(mid(m), b * bar + i * beat / 2, 0.045)
# simple reverb: a few delayed taps
rev = np.zeros_like(mix)
for d, g in ((0.11, .3), (0.23, .22), (0.37, .15), (0.53, .1)):
    k = int(d * SR); rev[k:] += mix[:-k] * g
mix = mix + rev[:, ::-1] * 0.8
fade = int(3 * SR); mix[:fade] *= np.linspace(0, 1, fade)[:, None]; mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.abs(mix).max() / 0.8
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print('music', out, dur)
