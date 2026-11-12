"""process.py RAW — turn the ElevenLabs originals in RAW into the game's audio/ folder (needs ffmpeg and node).

  music-<place>.mp3  → audio/music-<place>.mp3   80 kbps stereo, loudness evened, short fades at the loop seam
  amb-<place>.mp3    → audio/amb-<place>.mp3     64 kbps stereo loop, untouched ends (generated as a seamless loop)
  sfx-<name>.mp3     → audio/sfx-<name>.mp3      96 kbps mono, silence trimmed
  vo-<take>.mp3      → audio/vo/<line id>.mp3    64 kbps mono: each take is cut into its lines at the longest
                                                 pauses, in the order dev/audio/takes.mjs lists them

Run with: python3 -I game-131/dev/audio/process.py RAW
"""
import json, os, re, subprocess, sys

RAW = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'audio')
os.makedirs(os.path.join(OUT, 'vo'), exist_ok=True)


def run(*args):
    return subprocess.run(args, capture_output=True, text=True)


def duration(path):
    r = run('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path)
    return float(r.stdout.strip())


def silences(path, noise='-38dB', d='0.45'):
    r = run('ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-')
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
    return list(zip(starts, ends))


takes = json.loads(run('node', os.path.join(HERE, 'takes.mjs')).stdout)
problems = []
for f in sorted(os.listdir(RAW)):
    src = os.path.join(RAW, f)
    name = os.path.splitext(f)[0]
    if f.startswith('music-'):
        d = duration(src)
        run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', f'loudnorm=I=-20:TP=-2,afade=t=in:d=1.2,afade=t=out:st={d - 2.5:.2f}:d=2.5', '-ac', '2', '-b:a', '80k', os.path.join(OUT, f))
    elif f.startswith('amb-'):
        run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', 'volume=0.9', '-ac', '2', '-b:a', '64k', os.path.join(OUT, f))
    elif f.startswith('sfx-'):
        run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,afade=t=in:d=0.005', '-ac', '1', '-b:a', '96k', os.path.join(OUT, f))
    elif f.startswith('vo-'):
        take = takes.get(name[3:])
        if not take:
            problems.append(f'{f}: no such take'); continue
        ids, total = take['ids'], duration(src)
        gaps = [s for s in silences(src) if s[0] > 0.2 and s[1] < total - 0.2]
        gaps = sorted(sorted(gaps, key=lambda g: g[0] - g[1])[:len(ids) - 1])     # the longest pauses, in time order
        if len(gaps) != len(ids) - 1:
            problems.append(f'{f}: found {len(gaps)} pauses for {len(ids)} lines')
        cuts = [0.0] + [(a + b) / 2 for a, b in gaps] + [total]
        for i, lid in enumerate(ids[:len(cuts) - 1]):
            a, b = cuts[i], cuts[i + 1]
            run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', f'{a:.3f}', '-t', f'{b - a:.3f}', '-i', src,
                '-af', 'silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse,afade=t=in:d=0.01,loudnorm=I=-17:TP=-2',
                '-ac', '1', '-b:a', '64k', os.path.join(OUT, 'vo', lid + '.mp3'))
        shortest = min((b - a for a, b in gaps), default=0)
        print(f'{f}: {len(ids)} lines, shortest pause used {shortest:.2f} s')

# what exists, so the game never asks for a file that is not there (a 404 is an error in the console)
names = sorted(os.path.relpath(os.path.join(d, f), OUT).replace(os.sep, '/')[:-4] for d, _, fs in os.walk(OUT) for f in fs if f.endswith('.mp3'))
with open(os.path.join(HERE, '..', '..', 'js', 'audio-files.js'), 'w') as fh:
    fh.write('// Written by dev/audio/process.py: every clip in audio/ (without .mp3). The game only requests these.\n')
    fh.write('export const AUDIO_FILES = new Set(' + json.dumps(names) + ');\n')
n = sum(len(fs) for _, _, fs in os.walk(OUT))
size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(OUT) for f in fs)
print(f'{n} files, {size / 1e6:.1f} MB in audio/')
for p in problems:
    print('PROBLEM', p)
