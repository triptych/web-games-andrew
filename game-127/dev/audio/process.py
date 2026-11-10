#!/usr/bin/env python3
"""The First Dragon Prince audio pipeline: raw ElevenLabs renders -> game-127/audio/. Needs ffmpeg and ffprobe.

    python3 -I game-127/dev/audio/process.py RAW_DIR [TAKES_JSON]

RAW_DIR holds the renders as downloaded: music-<id>.mp3, sfx-<id>.mp3 and vo-<take>.mp3 (one take per speaker chunk,
see dev/audio/voices.mjs). Music is loudness-normalised to -18 LUFS with short fades so it loops without a click and
written as 80 kb/s stereo MP3. Sound effects are trimmed of leading and trailing silence, normalised to -16 LUFS and
written as 96 kb/s mono. Each voice take is split back into its lines by aligning the silences in it to the lines' text lengths (the takes
put a [long pause] between lines; see align()), every clip is checked against its text length, and written as audio/vo/<key>.mp3 at
64 kb/s mono. Trimming and silence detection are done in numpy: ffmpeg 6.1 stalls on areverse/silenceremove chains
that are resampled after loudnorm, so ffmpeg here only decodes, normalises and encodes. Finally js/voices.js is rewritten with the set of keys that have a clip, so the game never asks for a
file that is not there.
"""
import json
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(GAME, 'audio')


def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True, stdin=subprocess.DEVNULL, timeout=300)


def duration(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])
    return float(r.stdout.strip())


SR = 44100
WIN = 0.02                 # analysis window for loudness, seconds


def decode(path):
    """Mono float samples at SR. (ffmpeg only decodes here: no filters, so no filter-graph stalls.)"""
    r = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                       capture_output=True, check=True, stdin=subprocess.DEVNULL, timeout=300)
    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def encode(x, dst, bitrate, lufs, tp=-1.0, extra=''):
    """Loudness-normalise float samples and write them as mono MP3. The samples go in as WAV on stdin."""
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    af = f'loudnorm=I={lufs}:TP={tp},aresample={SR}' + extra
    subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-af', af, '-ac', '1', '-b:a', bitrate, dst], input=pcm, capture_output=True, check=True, timeout=300)


def env_db(x):
    """Loudness per WIN window, in dB relative to the loudest window."""
    w = int(SR * WIN)
    n = max(1, len(x) // w)
    rms = np.sqrt(np.mean(x[:n * w].reshape(n, w) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms / max(rms.max(), 1e-9))


def trim(x, floor=-42.0, pad_a=0.03, pad_b=0.12):
    """Cut leading and trailing quiet (below `floor` dB from the peak window), keeping a little air."""
    db = env_db(x)
    loud = np.nonzero(db > floor)[0]
    if not len(loud):
        return x
    w = int(SR * WIN)
    a = max(0, loud[0] * w - int(SR * pad_a))
    b = min(len(x), (loud[-1] + 1) * w + int(SR * pad_b))
    y = x[a:b].copy()
    f = min(len(y), int(SR * 0.01))                 # 10 ms fade at both ends, so a cut never clicks
    if f:
        ramp = np.linspace(0, 1, f, dtype=np.float32)
        y[:f] *= ramp; y[-f:] *= ramp[::-1]
    return y


def silences(x, floor=-38.0, min_d=0.25):
    """[(start, end)] in seconds of every stretch quieter than `floor` dB for at least min_d."""
    quiet = env_db(x) < floor
    out, i, n = [], 0, len(quiet)
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if (j - i) * WIN >= min_d:
                out.append((i * WIN, j * WIN))
            i = j
        else:
            i += 1
    return out


def music(src, dst):
    d = duration(src)
    af = f'loudnorm=I=-18:TP=-1.5:LRA=11,aresample={SR},afade=t=in:d=0.4,afade=t=out:st={max(0, d - 2.5):.2f}:d=2.5'
    run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', src, '-af', af, '-ac', '2', '-b:a', '80k', dst])


def sfx(src, dst):
    encode(trim(decode(src), floor=-50, pad_a=0.0, pad_b=0.15), dst, '96k', -16)


def align(sil, lens, total):
    """Pick len(lens)-1 cut points from the silences, in order, so each segment's length fits its text.

    A dynamic programme over (line, silence): the cost of a segment is how far its length is from the length its
    text predicts (characters / the take's speaking rate), and each cut earns a bonus for the length of the pause it
    sits in, since the takes put a [long pause] between lines. Returns the chosen silences.
    """
    n = len(lens)
    rate = sum(lens) / max(0.1, total - sum(min(2.0, e - s) for s, e in sil) * 0.5)
    exp = [c / rate for c in lens]
    mids = [(s + e) / 2 for s, e in sil]
    m = len(sil)
    INF = float('inf')

    def seg(a, b, i):
        d = b - a
        return ((d - exp[i]) / (exp[i] + 0.8)) ** 2

    def bonus(j):
        return 1.6 * min(2.0, sil[j][1] - sil[j][0])

    # cost[i][j]: lines 0..i placed, line i ends at silence j
    cost = [[INF] * m for _ in range(n - 1)]
    back = [[-1] * m for _ in range(n - 1)]
    for j in range(m):
        cost[0][j] = seg(0, mids[j], 0) - bonus(j)
    for i in range(1, n - 1):
        for j in range(i, m):
            best, bk = INF, -1
            for k in range(i - 1, j):
                c = cost[i - 1][k]
                if c == INF:
                    continue
                c += seg(mids[k], mids[j], i)
                if c < best:
                    best, bk = c, k
            if bk >= 0:
                cost[i][j] = best - bonus(j)
                back[i][j] = bk
    last = n - 2
    best, bj = INF, -1
    for j in range(last, m):
        c = cost[last][j] + seg(mids[j], total, n - 1)
        if c < best:
            best, bj = c, j
    picks = []
    i, j = last, bj
    while i >= 0 and j >= 0:
        picks.append(sil[j])
        j = back[i][j]
        i -= 1
    return sorted(picks), exp, rate


def split_take(src, keys, texts, outdir):
    """Cut a take into len(keys) clips, one per line. Returns a list of problems (empty when it is clean)."""
    n = len(keys)
    x = decode(src)
    total = len(x) / SR
    gaps, exp, rate = [], [len(texts[0]) / 14], 14
    if n > 1:
        sil = [s for s in silences(x, min_d=0.2) if s[0] > 0.3 and s[1] < total - 0.3]
        if len(sil) < n - 1:
            return [f'{os.path.basename(src)}: {len(sil)} silences for {n} lines']
        gaps, exp, rate = align(sil, [len(t) for t in texts], total)
    bounds = [0.0] + [(s + e) / 2 for s, e in gaps] + [total]
    problems = []
    for i, key in enumerate(keys):
        a, b = bounds[i], bounds[i + 1]
        clip = trim(x[int(a * SR):int(b * SR)], floor=-40, pad_a=0.04, pad_b=0.15)
        d = len(clip) / SR
        # a clean clip is within a generous band of the length its text predicts
        if d > exp[i] * 2.2 + 1.2 or d < exp[i] * 0.4 - 0.2:
            problems.append(f'{key}: {d:.1f}s, expected ~{exp[i]:.1f}s "{texts[i][:40]}"')
        encode(clip, os.path.join(outdir, key + '.mp3'), '64k', -17)
    return problems


def write_manifest():
    vo = os.path.join(OUT, 'vo')
    keys = sorted(f[:-4] for f in os.listdir(vo) if f.endswith('.mp3')) if os.path.isdir(vo) else []
    body = ',\n'.join("    '" + "', '".join(keys[i:i + 8]) + "'" for i in range(0, len(keys), 8))
    js = ('// Generated by dev/audio/process.py: the voice lines that have a recording (see js/voicekey.js).\n'
          f'export const VOICED = new Set([\n{body},\n]);\n')
    with open(os.path.join(GAME, 'js', 'voices.js'), 'w') as f:
        f.write(js)
    return len(keys)


def main(raw, takes_path):
    os.makedirs(os.path.join(OUT, 'music'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'sfx'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'vo'), exist_ok=True)
    for f in sorted(os.listdir(raw)):
        src = os.path.join(raw, f)
        if f.startswith('music-') and f.endswith('.mp3'):
            dst = os.path.join(OUT, 'music', f[6:])
            if not os.path.exists(dst):
                music(src, dst)
            print('music', f[6:-4], f'{duration(dst):.1f}s')
        elif f.startswith('sfx-') and f.endswith('.mp3'):
            dst = os.path.join(OUT, 'sfx', f[4:])
            sfx(src, dst)
            print('sfx', f[4:-4], f'{duration(dst):.2f}s')
    problems = []
    if takes_path:
        takes = json.load(open(takes_path))
        from_text = {}
        for t in takes:
            parts = [re.sub(r'^\[[a-z ]+\]\s*', '', p.strip()) for p in t['text'].split('\n[long pause]\n')]
            from_text[t['id']] = parts
        for t in takes:
            src = os.path.join(raw, 'vo-' + t['id'] + '.mp3')
            if not os.path.exists(src):
                continue
            p = split_take(src, t['keys'], from_text[t['id']], os.path.join(OUT, 'vo'))
            print('vo', t['id'], len(t['keys']), 'lines', 'OK' if not p else f'{len(p)} problem(s)')
            problems += p
    n = write_manifest()
    print(n, 'voice clips in js/voices.js')
    for p in problems:
        print('  !', p)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
