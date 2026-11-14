"""Hearthwick audio: raw ElevenLabs downloads -> game-115/audio/*.mp3 (needs ffmpeg and numpy).

    python3 -I game-115/dev/audio/process.py RAW_DIR

RAW_DIR holds music-*.mp3, amb-*.mp3, sfx-*.mp3 and ui-*.mp3 as downloaded. Music and ambience are made to loop: the last
LOOP seconds are crossfaded into the first LOOP seconds and the head is dropped, so the end flows into the start. Effects
have silence trimmed off both ends, are capped in length, and get a short fade out. Everything is loudness-normalised.
"""
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / 'audio'
SR = 44100
# name prefix -> (channels, kbps, target LUFS, crossfade seconds for loops or None)
KIND = {'music': (2, 96, -19, 4.0), 'amb': (1, 64, -26, 2.0), 'sfx': (1, 80, -17, None), 'ui': (1, 64, -20, None)}
MAXLEN = {'ui': 0.45, 'sfx': 3.2}


def decode(path, ch):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, ch).copy()


def encode(x, path, ch, kbps, lufs):
    p = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-i', '-',
                        '-af', f'loudnorm=I={lufs}:TP=-1.5:LRA=11', '-ar', str(SR), '-ac', str(ch), '-b:a', f'{kbps}k',
                        str(path)], input=x.astype(np.float32).tobytes(), capture_output=True)
    if p.returncode:
        raise RuntimeError(p.stderr.decode())


def loop(x, secs):
    n = int(secs * SR)
    head, body, tail = x[:n], x[n:-n], x[-n:]
    t = np.linspace(0, 1, n)[:, None]
    seam = tail * np.cos(t * np.pi / 2) + head * np.sin(t * np.pi / 2)      # equal-power crossfade
    return np.concatenate([body, seam])


def trim(x, maxlen):
    env = np.abs(x).max(axis=1)
    thr = max(1e-4, env.max() * 0.02)
    idx = np.flatnonzero(env > thr)
    if idx.size == 0:
        return x
    x = x[max(0, idx[0] - int(0.004 * SR)): idx[-1] + int(0.03 * SR)]
    x = x[:int(maxlen * SR)]
    f = min(len(x), int(0.06 * SR))
    x[-f:] *= np.linspace(1, 0, f)[:, None]
    g = min(len(x), int(0.003 * SR))
    x[:g] *= np.linspace(0, 1, g)[:, None]
    return x


def main(raw):
    raw = Path(raw)
    OUT.mkdir(exist_ok=True)
    total = 0
    for src in sorted(raw.glob('*.mp3')):
        kind = src.stem.split('-')[0]
        ch, kbps, lufs, xf = KIND[kind]
        x = decode(src, ch)
        x = loop(x, xf) if xf else trim(x, MAXLEN[kind])
        dst = OUT / f'{src.stem}.mp3'
        encode(x, dst, ch, kbps, lufs)
        total += dst.stat().st_size
        print(f'{src.stem:16} {len(x) / SR:6.2f}s {dst.stat().st_size // 1024:5} KB')
    print(f'total {total // 1024} KB')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'raw')
