#!/usr/bin/env python3
"""Folio & Fable audio pipeline: raw ElevenLabs downloads -> game-150/audio/*.mp3 (needs ffmpeg).

    python3 -I game-150/dev/audio/process.py RAW_DIR

RAW_DIR holds music-*.mp3, sfx-*.mp3 and the three voice takes (vo-vellum-story, vo-vellum-barks, vo-tam) as named in dev/audio/README.md. Each voice take holds several lines separated by [long pause]: the take is cut at
its n-1 longest silences (ffmpeg silencedetect) and each line is trimmed, loudness-normalised and encoded mono.
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'audio'))
TAKES = {
    'vo-vellum-story': ['vellum-prologue'] + [f'vellum-ch{n}-{k}' for n in range(1, 8) for k in ('intro', 'done')],
    'vo-vellum-barks': ['vellum-customer', 'vellum-sale', 'vellum-sendoff', 'vellum-welcome', 'vellum-trader', 'vellum-wow',
                        'vellum-goodnight', 'vellum-wish'],
    'vo-tam': ['tam-welcome', 'tam-justthebook', 'tam-thanks', 'tam-newbook', 'tam-wedidit', 'tam-open', 'tam-talking',
               'tam-promise', 'tam-forme'],
}
LOOP = {'title', 'shop', 'evening'}


def ff(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def silences(path, db=-38, d=0.35):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'],
                       capture_output=True, text=True)
    st = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', r.stderr)]
    en = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', r.stderr)]
    return list(zip(st, en))


def duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True)
    return float(r.stdout.strip())


def split(src, n):
    """Cut a take into n lines at its n-1 longest pauses (pauses at the very start or end don't count)."""
    total = duration(src)
    sil = [s for s in silences(src) if s[0] > 0.2 and s[1] < total - 0.2]
    sil = sorted(sorted(sil, key=lambda s: s[1] - s[0], reverse=True)[:n - 1])
    bounds, t = [], 0.0
    for s, e in sil:
        bounds.append((t, s + 0.1))
        t = max(0.0, e - 0.1)
    bounds.append((t, total))
    return bounds


def voice(src, dst, a, b):
    ff('-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af',
       'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,'
       'areverse,loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.02', '-ac', '1', '-b:a', '64k', dst)


def main(raw):
    os.makedirs(OUT, exist_ok=True)
    p = lambda n: os.path.join(raw, n)
    for f in sorted(os.listdir(raw)):
        if f.startswith('music-'):
            name = f[6:-4]
            d = duration(p(f))
            fade = 1.5 if name in LOOP else 0.4
            ff('-i', p(f), '-af', f'loudnorm=I=-18:TP=-1.5,afade=t=in:d=0.15,afade=t=out:st={d - fade:.2f}:d={fade}',
               '-ac', '2', '-b:a', '80k', os.path.join(OUT, f'music-{name}.mp3'))
        elif f.startswith('sfx-'):
            name = f[4:-4]
            if name == 'ambience':
                ff('-i', p(f), '-af', 'loudnorm=I=-26:TP=-3', '-ac', '1', '-b:a', '64k', os.path.join(OUT, 'sfx-ambience.mp3'))
                continue
            ff('-i', p(f), '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1,areverse,'
               'silenceremove=start_periods=1:start_threshold=-55dB,afade=t=in:d=0.04,areverse',
               '-ac', '1', '-b:a', '96k', os.path.join(OUT, f'sfx-{name}.mp3'))
    for take, lines in TAKES.items():
        src = p(take + '.mp3')
        if not os.path.exists(src):
            print('missing', src)
            continue
        parts = split(src, len(lines))
        for name, (a, b) in zip(lines, parts):
            voice(src, os.path.join(OUT, f'vo-{name}.mp3'), a, b)
        print(take, [(n, round(b - a, 2)) for n, (a, b) in zip(lines, parts)])
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
