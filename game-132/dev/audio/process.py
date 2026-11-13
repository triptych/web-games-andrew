"""process.py RAW — turn the ElevenLabs originals in RAW into the game's audio/ folder and js/audio-files.js.

    python3 -I game-132/dev/audio/process.py RAW

- music-*.mp3: 80 kbps stereo, a 1.5 s fade-in and a 2.5 s fade-out so the loop seam is soft.
- sfx-*.mp3:   96 kbps mono, leading/trailing silence trimmed, at most 2.5 s long (the model's
               "about 1 second" is a hint, not a limit), with a 60 ms fade-out.
- vo-*.mp3:    64 kbps mono, silence trimmed (voice lines are already one line per file).
Writes js/audio-files.js: the set of clips the game is allowed to request (it never asks for a file that isn't there).
Needs ffmpeg and ffprobe.
"""
import json
import os
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
    elif name.startswith('vo-'):
        ff(['-i', src, '-af', TRIM, '-ac', '1', '-b:a', '64k', dst])
    else:
        continue
    done.append(name)
    print(f'audio/{f}  {dur(dst):.2f}s  {os.path.getsize(dst) // 1024} KB')

with open(os.path.join(GAME, 'js', 'audio-files.js'), 'w') as fh:
    fh.write('// Written by dev/audio/process.py: every clip in audio/ (without .mp3). The game only requests these.\n')
    fh.write('export const AUDIO_FILES = new Set(' + json.dumps(sorted(done)) + ');\n')
print(len(done), 'files')
