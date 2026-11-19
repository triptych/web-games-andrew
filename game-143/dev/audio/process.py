"""Normalise, trim and encode the ElevenLabs downloads for the game (needs ffmpeg).

    python3 -I game-143/dev/audio/process.py RAWDIR

RAWDIR holds music-*.mp3, sfx-*.mp3 and vo-*.mp3 as downloaded. Writes game-143/audio/.
Voice takes are split into lines at their N-1 longest pauses (ffmpeg silencedetect); LINES says how many each holds.
"""
import os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'audio')
RAW = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

LINES = {'noxia': 6, 'vellum': 4, 'pip': 3, 'gerald': 3, 'mother': 3, 'king': 4, 'queen': 3, 'tobias': 3, 'silk': 2}
SFX_MAX = {'sfx-quest': 2.4, 'sfx-magic': 2.0, 'sfx-build': 2.2, 'sfx-oven': 2.4}


def ff(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True).stdout
    return float(out.strip())


def silences(path):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', 'silencedetect=noise=-35dB:d=0.3', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    return list(zip(starts, ends))


for f in sorted(os.listdir(RAW)):
    src = os.path.join(RAW, f)
    name = f[:-4]
    if f.startswith('music-'):
        d = duration(src)
        ff('-i', src, '-af', f'loudnorm=I=-18:TP=-2,afade=t=in:d=0.05,afade=t=out:st={d - 1.6:.2f}:d=1.6',
           '-ac', '2', '-b:a', '80k', os.path.join(OUT, name + '.mp3'))
    elif f.startswith('sfx-'):
        cap = SFX_MAX.get(name, 2.0)
        ff('-i', src, '-af', f'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:{cap},'
           f'afade=t=out:st={max(0.05, cap - 0.25):.2f}:d=0.25,loudnorm=I=-16:TP=-1.5',
           '-ac', '1', '-b:a', '96k', os.path.join(OUT, name + '.mp3'))
    elif f.startswith('vo-'):
        who = name[3:]
        n = LINES[who]
        sil = silences(src)
        cuts = sorted(sorted(sil, key=lambda s: s[1] - s[0], reverse=True)[:n - 1])
        bounds = [0.0] + [(a + b) / 2 for a, b in cuts] + [duration(src)]
        for i in range(n):
            a, b = bounds[i], bounds[i + 1]
            ff('-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af',
               'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5',
               '-ac', '1', '-b:a', '64k', os.path.join(OUT, f'vo-{who}-{i + 1}.mp3'))
        print(who, [f'{b:.2f}' for b in bounds])
