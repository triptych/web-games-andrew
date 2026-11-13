#!/usr/bin/env python3
"""Lanternhall audio export: raw ElevenLabs MP3s -> the files the game loads.

    python3 -I game-133/dev/audio/process.py RAW_DIR

RAW_DIR holds music-<id>.mp3, sfx-<id>.mp3 and vo-<who>.mp3 (one take per speaker, lines separated by long
pauses; see voices.mjs). Music is normalised, given short fades and encoded at 80 kb/s stereo. Effects are
trimmed of silence, capped at 3.5 s (the model ignores "about 1 second" now and then), faded out and encoded at
96 kb/s mono. Voice takes are split at their longest silences into one clip per line, 64 kb/s mono.
ffmpeg only decodes and encodes; the trimming is done in numpy.
"""
import json, os, subprocess, sys
import numpy as np

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'audio')
SR = 44100


def decode(path, ch):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', str(ch), '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, ch) / 32768.0


def encode(a, path, kbps):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(a, -1, 1) * 32767).astype(np.int16).tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ac', str(a.shape[1]), '-ar', str(SR), '-i', '-', '-b:a', f'{kbps}k', path], input=pcm, check=True)


def envelope(a, win=0.02):
    n = int(SR * win)
    m = np.abs(a).max(axis=1)
    pad = (-len(m)) % n
    return np.pad(m, (0, pad)).reshape(-1, n).max(axis=1), n


def trim(a, thresh=0.012):
    env, n = envelope(a)
    loud = np.nonzero(env > thresh)[0]
    if not len(loud):
        return a
    return a[max(0, loud[0] * n - 400): min(len(a), (loud[-1] + 2) * n)]


def norm(a, peak=0.9, rms=None):
    if rms:
        cur = np.sqrt((a ** 2).mean()) + 1e-9
        a = a * (rms / cur)
    p = np.abs(a).max() + 1e-9
    return a * min(1.0, peak / p) if rms else a * (peak / p)


def fade(a, fin, fout):
    a = a.copy()
    i, o = int(SR * fin), int(SR * fout)
    if i: a[:i] *= np.linspace(0, 1, i)[:, None]
    if o: a[-o:] *= np.linspace(1, 0, o)[:, None]
    return a


made = {'music': [], 'sfx': [], 'vo': {}}
takes = json.load(open(os.path.join(RAW, 'takes.json'))) if os.path.exists(os.path.join(RAW, 'takes.json')) else {}
for f in sorted(os.listdir(RAW)):
    name, ext = os.path.splitext(f)
    if ext != '.mp3':
        continue
    kind, _, ident = name.partition('-')
    if kind == 'music':
        a = fade(norm(decode(os.path.join(RAW, f), 2), 0.95, 0.11), 0.4, 1.2)
        encode(a, f'{OUT}/music/{ident}.mp3', 80)
        made['music'].append(ident)
    elif kind == 'sfx':
        a = trim(decode(os.path.join(RAW, f), 1))[: int(SR * 3.5)]
        a = fade(norm(a, 0.85), 0.003, min(0.25, len(a) / SR / 3))
        encode(a, f'{OUT}/sfx/{ident}.mp3', 96)
        made['sfx'].append(ident)
        print(f'sfx {ident:10s} {len(a) / SR:.2f}s')
    elif kind == 'vo' and ident in takes:
        keys = takes[ident]
        a = decode(os.path.join(RAW, f), 1)
        env, n = envelope(a, 0.02)
        quiet = env < 0.015
        # runs of silence, longest first: the N-1 longest inside the take are the gaps between lines
        runs, start = [], None
        for i, q in enumerate(quiet):
            if q and start is None: start = i
            if not q and start is not None: runs.append((i - start, start, i)); start = None
        loud = np.nonzero(~quiet)[0]
        inner = [r for r in runs if r[1] > loud[0] and r[2] < loud[-1]]
        cuts = sorted(sorted(inner, reverse=True)[: len(keys) - 1], key=lambda r: r[1])
        if len(cuts) != len(keys) - 1:
            print(f'vo {ident}: found {len(cuts) + 1} lines, wanted {len(keys)}; skipped'); continue
        edges = [loud[0]] + [x for r in cuts for x in (r[1], r[2])] + [loud[-1] + 1]
        for k, i in zip(keys, range(0, len(edges), 2)):
            clip = a[max(0, edges[i] * n - 600): edges[i + 1] * n + 2500]
            encode(fade(norm(clip, 0.9, 0.09), 0.005, 0.06), f'{OUT}/vo/{k}.mp3', 64)
            made['vo'][k] = round(len(clip) / SR, 2)
        print(f'vo {ident:8s} {len(keys)} lines', [made['vo'][k] for k in keys])
json.dump(made, open(os.path.join(RAW, 'made.json'), 'w'), indent=1)
print('music', made['music'])
