#!/usr/bin/env python3
"""Gemheart Saga audio pipeline: raw ElevenLabs downloads -> game-128/audio/*.mp3 (needs ffmpeg).

    python3 -I game-128/dev/audio/process.py RAW_DIR

RAW_DIR holds music-*.mp3, sfx-*.mp3 and vo-*.mp3 as named in dev/audio/README.md. A voice take holds several lines
separated by [long pause] tags: the longest pauses are found with ffmpeg's silencedetect and the take is cut there
(the pattern from game-126).
"""
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'audio'))
# how each take splits, in order
SPLITS = {
    'kael': ['cry', 'win', 'hurt', 'intro', 'end'],
    'sela': ['cry', 'win', 'hurt', 'intro', 'end'],
    'fenn': ['cry', 'win', 'hurt', 'intro', 'end'],
    'odo': ['cry', 'win', 'hurt', 'intro', 'end'],
    'varek': ['taunt', 'fall'],
    'quell': ['taunt', 'fall'],
    'rotroot': ['taunt', 'fall'],
    'vesper': ['taunt', 'fall'],
    'sovereign': ['taunt', 'fall'],
    'narrator': ['open1', 'open2', 'open3', 'end-kael', 'end-sela', 'end-fenn', 'end-odo'],
}
# relative text lengths of the lines in a take, where the longest-pause rule picked the wrong gap
WEIGHTS = {'quell': [84, 115]}
SINGLE = ['maren', 'bess', 'pell', 'ilse', 'garrick', 'tobin', 'murk']


def ff(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def silences(path, db=-40, d=0.4):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True)
    st = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', r.stderr)]
    en = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', r.stderr)]
    return list(zip(st, en))


def duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(r.stdout.strip())


def voice(src, dst, a, b):
    ff('-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af', 'loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse,silenceremove=start_periods=1:start_threshold=-45dB',
       '-ac', '1', '-b:a', '64k', dst)


def split(src, n, weights=None):
    """Cut a take into n lines at n-1 of its pauses. Without weights, the longest pauses; with weights (the relative
    length of each line's text), the long pause nearest where each cut should fall, so a dramatic pause inside a line
    is not mistaken for the gap between two lines (Quell's "Sela. [pause] Little Sela.")."""
    dur = duration(src)
    sil = [s for s in silences(src) if s[0] > 0.3 and s[1] < dur - 0.3]
    if weights:
        tot, acc, cuts = sum(weights), 0, []
        for w in weights[:-1]:
            acc += w
            want = dur * acc / tot
            cand = [s for s in sil if s not in cuts and s[1] - s[0] >= 0.35] or [s for s in sil if s not in cuts]
            cuts.append(min(cand, key=lambda s: abs((s[0] + s[1]) / 2 - want) - 2 * (s[1] - s[0])))
        cuts.sort()
    else:
        cuts = sorted(sorted(sil, key=lambda s: s[1] - s[0], reverse=True)[:n - 1])
    bounds, t = [], 0.0
    for s, e in cuts:
        bounds.append((t, s + 0.08))
        t = max(0.0, e - 0.08)
    bounds.append((t, dur))
    return bounds


def main(raw):
    os.makedirs(OUT, exist_ok=True)
    p = lambda n: os.path.join(raw, n)
    for f in sorted(os.listdir(raw)):
        if f.startswith('music-'):
            name = f[6:-4]
            d = duration(p(f))
            fade = 0.4 if name == 'victory' else 1.5
            ff('-i', p(f), '-af', f'loudnorm=I=-18:TP=-1.5,afade=t=in:d=0.25,afade=t=out:st={d - fade:.2f}:d={fade}', '-ac', '2', '-b:a', '80k', os.path.join(OUT, f'music-{name}.mp3'))
        elif f.startswith('sfx-'):
            ff('-i', p(f), '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1,areverse,silenceremove=start_periods=1:start_threshold=-55dB,afade=t=in:d=0.05,areverse',
               '-ac', '1', '-b:a', '96k', os.path.join(OUT, f))
    for who, lines in SPLITS.items():
        src = p(f'vo-{who}.mp3')
        if not os.path.exists(src):
            print('missing', src); continue
        parts = split(src, len(lines), WEIGHTS.get(who))
        if len(parts) != len(lines):
            print('WARN', who, 'found', len(parts), 'parts for', len(lines), 'lines')
        for line, (a, b) in zip(lines, parts):
            voice(src, os.path.join(OUT, f'vo-{who}-{line}.mp3'), a, b)
        print(who, [(line, round(b - a, 2)) for line, (a, b) in zip(lines, parts)])
    for n in SINGLE:
        src = p(f'vo-{n}.mp3')
        if os.path.exists(src):
            voice(src, os.path.join(OUT, f'vo-{n}.mp3'), 0, duration(src))
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
