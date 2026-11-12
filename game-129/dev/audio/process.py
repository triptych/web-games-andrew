#!/usr/bin/env python3
"""HOLLOWDEEP audio pipeline: raw ElevenLabs downloads -> game-129/audio/ (needs ffmpeg).

    python3 -I game-129/dev/audio/process.py RAW_DIR

RAW_DIR holds music-*.mp3, sfx-*.mp3 and vo-*.mp3 as named in README.md. Each voice take holds a character's lines in
the order of js/voices.js, separated by long pauses: the n-1 longest pauses are found with ffmpeg's silencedetect and
the take is cut there into audio/vo/<id>-<n>.mp3. Adapted from game-126's process.py.
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'audio'))
SFX_MAX = {}
LOOPS = {'title', 'town', 'dungeon-1', 'dungeon-2', 'dungeon-3', 'battle', 'boss'}


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


def voice(src, dst, a, b):
    ff('-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af', 'loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse,silenceremove=start_periods=1:start_threshold=-45dB',
       '-ac', '1', '-b:a', '64k', dst)


def split(src, n):
    """Cut a take into n lines at its n-1 longest pauses."""
    sil = sorted(silences(src), key=lambda s: s[1] - s[0], reverse=True)[:n - 1]
    bounds, t = [], 0.0
    for s, e in sorted(sil):
        bounds.append((t, s + 0.08))
        t = max(0.0, e - 0.08)
    bounds.append((t, duration(src)))
    return bounds


def main(raw):
    os.makedirs(os.path.join(OUT, 'vo'), exist_ok=True)
    p = lambda n: os.path.join(raw, n)
    counts = json.loads(subprocess.run(['node', '-e', "import('" + os.path.join(HERE, '..', '..', 'js', 'voices.js') + "').then(m=>console.log(JSON.stringify(Object.fromEntries(Object.entries(m.VOICES).map(([k,v])=>[k,v.lines.length])))))"], capture_output=True, text=True, check=True).stdout)
    report = {}
    for f in sorted(os.listdir(raw)):
        if f.startswith('music-'):
            name = f[6:-4]
            d = duration(p(f))
            # loops get a short fade at both ends so the seam is a breath, not a click; stings fade only out
            fade_in = 0.6 if name in LOOPS else 0.02
            fade = 1.2 if name in LOOPS else 0.6
            ff('-i', p(f), '-af', f'loudnorm=I=-18:TP=-1.5,afade=t=in:d={fade_in},afade=t=out:st={d - fade:.2f}:d={fade}', '-ac', '2', '-b:a', '80k', os.path.join(OUT, f'music-{name}.mp3'))
        elif f.startswith('sfx-'):
            name = f[4:-4]
            mx = SFX_MAX.get(name)
            trim = ['-t', str(mx)] if mx else []
            if name == 'ambience':
                ff('-i', p(f), '-af', 'loudnorm=I=-24:TP=-3', '-ac', '1', '-b:a', '64k', os.path.join(OUT, 'sfx-ambience.mp3'))
                continue
            ff('-i', p(f), *trim, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1,areverse,silenceremove=start_periods=1:start_threshold=-55dB,afade=t=in:d=0.05,areverse',
               '-ac', '1', '-b:a', '96k', os.path.join(OUT, f'sfx-{name}.mp3'))
    for cid, n in counts.items():
        src = p(f'vo-{cid}.mp3')
        if not os.path.exists(src):
            print('missing', src); continue
        parts = split(src, n)
        if len(parts) != n:
            print('WARN', cid, 'split into', len(parts), 'not', n)
        for i, (a, b) in enumerate(parts):
            voice(src, os.path.join(OUT, 'vo', f'{cid}-{i + 1}.mp3'), a, b)
        report[cid] = [round(b - a, 2) for a, b in parts]
    print(json.dumps(report))
    print('wrote', OUT)


if __name__ == '__main__':
    main(sys.argv[1])
