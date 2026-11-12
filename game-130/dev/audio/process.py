#!/usr/bin/env python3
"""Starbase Spooky audio pipeline: raw ElevenLabs downloads -> game-130/audio/*.mp3 (needs ffmpeg).

    python3 -I game-130/dev/audio/process.py RAW_DIR

RAW_DIR holds music-*.mp3, sfx-*.mp3 and vo-<take>.mp3 as named in dev/audio/README.md. takes.json (written by
lines.mjs when the takes were sent) lists the line ids in each take, in order. Each take is cut at its n-1 longest
pauses into one clip per line, audio/vo-<line id with . as ->.mp3, and every cut is checked against the length of its
text: a clip far shorter or longer than its words would take is printed as SUSPECT, so a missed pause is caught.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'audio'))
SFX_MAX = {'whale': 5.0, 'signal': 3.5, 'dock': 2.5, 'ghost': 2.5, 'fixed': 2.5, 'flicker': 1.8, 'clue': 1.8, 'munch': 1.8}
ECHO = {'mama'}   # Mama Glimmer is as big as a spaceship: give her an echo


def ff(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def silences(path, db=-40, d=0.35):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True)
    st = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', r.stderr)]
    en = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', r.stderr)]
    return list(zip(st, en))


def duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(r.stdout.strip())


def split(src, n):
    sil = sorted(silences(src), key=lambda s: s[1] - s[0], reverse=True)[:n - 1]
    bounds, t = [], 0.0
    for s, e in sorted(sil):
        bounds.append((t, s + 0.08))
        t = max(0.0, e - 0.08)
    bounds.append((t, duration(src)))
    return bounds


def words(text):
    return len(re.sub(r'\[[^\]]*\]', '', text).split())


def main(raw):
    os.makedirs(OUT, exist_ok=True)
    p = lambda n: os.path.join(raw, n)
    for f in sorted(os.listdir(raw)):
        if f.startswith('music-'):
            name = f[6:-4]
            d = duration(p(f))
            ff('-i', p(f), '-af', f'loudnorm=I=-18:TP=-1.5,afade=t=in:d=0.3,afade=t=out:st={d - 1.5:.2f}:d=1.5', '-ac', '2', '-b:a', '80k', os.path.join(OUT, f'music-{name}.mp3'))
        elif f.startswith('sfx-'):
            name = f[4:-4]
            mx = SFX_MAX.get(name, 1.2)
            ff('-i', p(f), '-t', str(mx), '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1,areverse,silenceremove=start_periods=1:start_threshold=-55dB,afade=t=in:d=0.08,areverse',
               '-ac', '1', '-b:a', '96k', os.path.join(OUT, f'sfx-{name}.mp3'))
    from_lines = {}
    sys.path.insert(0, HERE)
    takes = json.load(open(os.path.join(HERE, 'takes.json')))
    texts = json.load(open(os.path.join(HERE, 'texts.json'))) if os.path.exists(os.path.join(HERE, 'texts.json')) else {}
    bad = 0
    for t in takes:
        src = p(f"vo-{t['take']}.mp3")
        if not os.path.exists(src):
            print('missing', src); continue
        parts = split(src, len(t['ids']))
        rates = []
        for lid, (a, b) in zip(t['ids'], parts):
            dst = os.path.join(OUT, 'vo-' + lid.replace('.', '-') + '.mp3')
            echo = ',aecho=0.8:0.7:120|260:0.35|0.2' if t['who'] in ECHO else ''
            ff('-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af', f'loudnorm=I=-16:TP=-1.5{echo},afade=t=in:d=0.02,areverse,afade=t=in:d=0.05,areverse',
               '-ac', '1', '-b:a', '64k', dst)
            seg = t['text'].split(' [long pause] ')[t['ids'].index(lid)]
            rates.append((lid, (b - a) / max(1, words(seg))))
        med = sorted(r for _, r in rates)[len(rates) // 2]
        for lid, r in rates:
            flag = r < med * 0.45 or r > med * 2.2
            bad += flag
            if flag or os.environ.get('VERBOSE'):
                print(('SUSPECT ' if flag else '        ') + f"{t['take']:14} {lid:22} {r:.2f}s/word (take median {med:.2f})")
    print('wrote', OUT, '·', bad, 'suspect cuts')


if __name__ == '__main__':
    main(sys.argv[1])
