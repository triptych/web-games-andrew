#!/usr/bin/env python3
"""Turn the raw ElevenLabs downloads into One Shot's audio/ folder.

    python3 -I game-151/dev/audio/process.py RAW game-151/audio

RAW holds music-*.mp3, jingle-*.mp3, sfx-*.mp3 and vo-<who>.mp3 (one take per character, lines separated by
[long pause]). Music: 80 kbps stereo with a short fade at the loop seam. Effects: silence trimmed, 96 kbps mono.
Voices: each take is cut at hand-placed times (CUTS, the middle of each [long pause], read off ElevenLabs' free
word-timed transcript of the take), every line trimmed and saved as vo-<who>-<line>.mp3 at 64 kbps mono.
Needs ffmpeg.
"""
import os, subprocess, sys

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

LINES = {
    'juno': ['intro', 'throne', 'launch', 'fire', 'win', 'downed', 'clear', 'rush', 'end'],
    'mira': ['intro', 'picket', 'ember', 'glacier', 'storm', 'prism', 'throne', 'fail', 'hull', 'shift', 'exposed', 'end'],
}
CUTS = {
    'juno': [4.57, 8.55, 10.8, 14.58, 16.64, 19.66, 21.86, 24.08],
    'mira': [6.23, 12.65, 18.3, 23.6, 28.7, 34.75, 38.5, 42.9, 44.4, 45.95, 49.3],
}

def ff(*args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-y', *args], capture_output=True, text=True)

def duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True)
    return float(r.stdout.strip())

TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse'

for f in sorted(os.listdir(RAW)):
    src = os.path.join(RAW, f)
    name = f[:-4]
    if f.startswith('music-'):
        d = duration(src)
        ff('-i', src, '-af', f'afade=t=in:d=0.05,afade=t=out:st={d - 0.5:.2f}:d=0.5', '-ac', '2', '-b:a', '80k', os.path.join(OUT, f))
    elif f.startswith('jingle-'):
        ff('-i', src, '-af', TRIM, '-ac', '2', '-b:a', '80k', os.path.join(OUT, f))
    elif f.startswith('sfx-'):
        ff('-i', src, '-af', TRIM + ',afade=t=out:st=0:d=0.01', '-ac', '1', '-b:a', '96k', os.path.join(OUT, f))
    elif f.startswith('vo-'):
        who = name[3:]
        bounds = [0.0, *CUTS[who], duration(src)]
        for i, line in enumerate(LINES[who]):
            a, b = bounds[i], bounds[i + 1]
            ff('-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af', TRIM, '-ac', '1', '-b:a', '64k', os.path.join(OUT, f'vo-{who}-{line}.mp3'))
print('done')
