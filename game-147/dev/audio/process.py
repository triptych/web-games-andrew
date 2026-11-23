#!/usr/bin/env python3
"""Turn the raw ElevenLabs downloads into the game's audio/ folder.

    python3 -I game-147/dev/audio/process.py RAW OUT

RAW holds music-*.mp3, jingle-*.mp3, sfx-*.mp3 and vo-<who>.mp3 (one take per character, lines separated by
[long pause]). Music: 80 kbps stereo with a short fade at the loop seam. Effects: leading and trailing silence trimmed,
96 kbps mono. Voices: each take is cut at its LINES-1 longest pauses (ffmpeg silencedetect), every line trimmed and
saved as vo-<who>-<line>.mp3 at 64 kbps mono. Needs ffmpeg.
"""
import os, re, subprocess, sys

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

LINES = {
    'maple': ['welcome', 'battle', 'skill', 'guard', 'heal', 'chain', 'victory', 'hurt', 'flee', 'cook', 'clean', 'pay', 'shock', 'levelup', 'deed'],
    'ember': ['hello', 'battle', 'skill', 'skill2', 'chain', 'victory', 'hurt', 'cook', 'perfect', 'joined', 'flee'],
    'kit': ['hello', 'battle', 'skill', 'steal', 'chain', 'victory', 'hurt', 'checkin', 'joined', 'flee'],
    'fern': ['hello', 'battle', 'skill', 'heal', 'chain', 'victory', 'hurt', 'harvest', 'joined'],
    'bru': ['hello', 'battle', 'skill', 'skill2', 'chain', 'victory', 'hurt', 'clean', 'joined', 'buff'],
    'goldmaw': ['intro', 'debt', 'keepup', 'paid', 'late', 'coin', 'deed', 'friend'],
}

# Takes whose lines have pauses inside them ("Paid. In full. Here is the deed.") are cut by hand, at the middle of
# the pause between lines, read off a silencedetect listing.
CUTS = {
    'goldmaw': [7.46, 13.07, 15.46, 19.85, 25.87, 28.19, 31.88],
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
        ff('-i', src, '-af', f'afade=t=in:d=0.08,afade=t=out:st={d - 0.6:.2f}:d=0.6', '-ac', '2', '-b:a', '80k', os.path.join(OUT, f))
    elif f.startswith('jingle-'):
        ff('-i', src, '-af', TRIM, '-ac', '2', '-b:a', '80k', os.path.join(OUT, f))
    elif f.startswith('sfx-'):
        ff('-i', src, '-af', TRIM + ',afade=t=out:st=0:d=0.01', '-ac', '1', '-b:a', '96k', os.path.join(OUT, f))
    elif f.startswith('vo-'):
        who = name[3:]
        names = LINES[who]
        r = ff('-i', src, '-af', 'silencedetect=noise=-38dB:d=0.35', '-f', 'null', '-')
        starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
        ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
        gaps = [(e - s, (s + e) / 2) for s, e in zip(starts, ends) if s > 0.2]
        cuts = CUTS.get(who) or sorted(m for _, m in sorted(gaps, reverse=True)[:len(names) - 1])
        if len(cuts) != len(names) - 1:
            print('!! ', who, 'found', len(cuts) + 1, 'lines, expected', len(names))
        bounds = [0.0, *cuts, duration(src)]
        for i, line in enumerate(names[:len(bounds) - 1]):
            a, b = bounds[i], bounds[i + 1]
            ff('-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', src, '-af', TRIM, '-ac', '1', '-b:a', '64k', os.path.join(OUT, f'vo-{who}-{line}.mp3'))
        print(who, len(names), 'lines; cuts at', ', '.join(f'{c:.2f}' for c in cuts))
print('done:', len(os.listdir(OUT)), 'files')
