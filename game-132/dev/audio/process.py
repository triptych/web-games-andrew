"""process.py RAW — turn the ElevenLabs originals in RAW into the game's audio/ folder and js/audio-files.js.

    python3 -I game-132/dev/audio/process.py RAW

- music-*.mp3: 80 kbps stereo, a 1.5 s fade-in and a 2.5 s fade-out so the loop seam is soft.
- sfx-*.mp3:   96 kbps mono, leading/trailing silence trimmed, at most 2.5 s long (the model's
               "about 1 second" is a hint, not a limit), with a 60 ms fade-out.
- take-<who>.mp3: one speech take per speaker (dev/audio/takes.mjs), cut at its longest pauses into the lines
               takes.mjs lists, in order: vo-<line>.mp3, 64 kbps mono, loudness-normalised, silence trimmed.
               take-<who>.<a>+<b>.mp3 is a re-recording of only lines …-<a> and …-<b>: just those clips are replaced.
The clip list in js/audio-files.js is everything in audio/, so a partial run keeps the clips it didn't touch.
Writes js/audio-files.js: the set of clips the game is allowed to request (it never asks for a file that isn't there).
Needs ffmpeg and ffprobe.
"""
import json
import os
import re
import subprocess
import sys

RAW = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.join(HERE, '..', '..')
OUT = os.path.join(GAME, 'audio')
os.makedirs(OUT, exist_ok=True)


def dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())


def ff(args):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', *args], check=True)


def silences(path, db=-40, d=0.45):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={db}dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True)
    st = [float(x) for x in re.findall(r'silence_start: ([0-9.]+)', r.stderr)]
    en = [float(x) for x in re.findall(r'silence_end: ([0-9.]+)', r.stderr)]
    return list(zip(st, en))


def split(src, n):
    """Cut a take into n lines at its n-1 longest pauses."""
    cuts = sorted(sorted(silences(src), key=lambda s: s[1] - s[0], reverse=True)[:n - 1])
    bounds, t = [], 0.0
    for s, e in cuts:
        bounds.append((t, s + 0.08))
        t = max(0.0, e - 0.08)
    bounds.append((t, dur(src)))
    return bounds


TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse'
done = []
for f in sorted(os.listdir(RAW)):
    name, ext = os.path.splitext(f)
    if ext != '.mp3':
        continue
    src, dst = os.path.join(RAW, f), os.path.join(OUT, f)
    if name.startswith('music-'):
        d = dur(src)
        ff(['-i', src, '-af', f'afade=t=in:d=1.5,afade=t=out:st={d - 2.5:.2f}:d=2.5', '-ac', '2', '-b:a', '80k', dst])
    elif name.startswith('sfx-'):
        ff(['-i', src, '-af', f'{TRIM},atrim=0:2.5,afade=t=out:st=2.44:d=0.06', '-ac', '1', '-b:a', '96k', dst])
    elif name.startswith('take-'):
        who, _, only = name[5:].partition('.')
        lines = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'takes.mjs'), '--json']).decode())[who]
        if only:
            lines = [l for l in lines if l.split('-')[-1] in only.split('+')]
        for line, (a, b) in zip(lines, split(src, len(lines))):
            out = os.path.join(OUT, line + '.mp3')
            ff(['-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af', 'loudnorm=I=-16:TP=-1.5,' + TRIM + ',afade=t=in:d=0.02', '-ac', '1', '-b:a', '64k', out])
            done.append(line)
            print(f'audio/{line}.mp3  {dur(out):.2f}s')
        continue
    else:
        continue
    done.append(name)
    print(f'audio/{f}  {dur(dst):.2f}s  {os.path.getsize(dst) // 1024} KB')

done = sorted(set(done) | {f[:-4] for f in os.listdir(OUT) if f.endswith('.mp3')})
with open(os.path.join(GAME, 'js', 'audio-files.js'), 'w') as fh:
    fh.write('// Written by dev/audio/process.py: every clip in audio/ (without .mp3). The game only requests these.\n')
    fh.write('export const AUDIO_FILES = new Set(' + json.dumps(sorted(done)) + ');\n')
print(len(done), 'files')
