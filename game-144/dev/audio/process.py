#!/usr/bin/env python3
"""Process NEBULA REQUIEM's raw ElevenLabs downloads into game-144/audio/.

    node game-144/dev/audio/voices.mjs > /tmp/takes.json
    python3 -I game-144/dev/audio/process.py RAW /tmp/takes.json

RAW holds music-*.mp3, sfx-*.mp3 and vo-<who>.mp3 as downloaded. Needs ffmpeg.

- music: loudness-normalised, a short fade at the loop seam, 80 kbps stereo  -> audio/music/<name>.mp3
- sfx:   leading/trailing silence trimmed, capped in length, 96 kbps mono    -> audio/sfx/<name>.mp3
- voices: each take is cut at its N-1 longest inner silences (N = the number of lines in the take), so every clip is
          one line, named by its voice id, 64 kbps mono                       -> audio/vo/<id>.mp3
Prints each clip's length against its text length so a bad split stands out (a ratio far from the others).
"""
import json, os, re, subprocess, sys

RAW, TAKES = sys.argv[1], sys.argv[2]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'audio')
for d in ('music', 'sfx', 'vo'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

# trim very long effects: a "half second" warp came back 3 s
SFX_MAX = {'warp': 1.0, 'powerup': 1.2, 'shield': 1.2, 'synergy': 1.8, 'extend': 2.0, 'rocket': 0.9, 'explode-s': 0.9,
           'burst': 2.6, 'laser': 3.0, 'roar': 2.8, 'capital': 3.0, 'warning': 2.0}


def run(args):
    return subprocess.run(args, capture_output=True, text=True)


def duration(f):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout)


def silences(f, noise='-38dB', d=0.35):
    err = run(['ffmpeg', '-i', f, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-']).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    return list(zip(starts, ends))


takes = json.load(open(TAKES))
total = 0

for f in sorted(os.listdir(RAW)):
    src = os.path.join(RAW, f)
    name = f[:-4]
    if name.startswith('music-'):
        dur = duration(src)
        dst = os.path.join(OUT, 'music', name[6:] + '.mp3')
        run(['ffmpeg', '-y', '-i', src, '-af', f'loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.05,afade=t=out:st={dur - 1.2:.2f}:d=1.2',
             '-ac', '2', '-b:a', '80k', dst])
    elif name.startswith('sfx-'):
        key = name[4:]
        cap = SFX_MAX.get(key, 4.0)
        dst = os.path.join(OUT, 'sfx', key + '.mp3')
        run(['ffmpeg', '-y', '-i', src, '-af',
             f'silenceremove=start_periods=1:start_threshold=-50dB,atrim=0:{cap},loudnorm=I=-14:TP=-1,afade=t=out:st={max(0.05, cap - 0.15):.2f}:d=0.15',
             '-ac', '1', '-b:a', '96k', dst])
    elif name.startswith('vo-'):
        who = name[3:]
        t = takes[who]
        ids = t['ids']
        texts = [s.strip() for s in t['text'].split('[long pause]')]
        dur = duration(src)
        sil = [s for s in silences(src) if s[0] > 0.3 and s[1] < dur - 0.3]
        need = len(ids) - 1
        cuts = sorted(sorted(sil, key=lambda s: s[1] - s[0], reverse=True)[:need])
        if len(cuts) < need:
            print(f'!! {who}: found {len(cuts)} pauses, need {need}')
        bounds = [0.0] + [(a + b) / 2 for a, b in cuts] + [dur]
        for i, vid in enumerate(ids):
            a, b = bounds[i], bounds[i + 1]
            dst = os.path.join(OUT, 'vo', vid + '.mp3')
            run(['ffmpeg', '-y', '-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-af',
                 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5',
                 '-ac', '1', '-b:a', '64k', dst])
            chars = len(re.sub(r'\[[^\]]*\]', '', texts[i]).strip())
            d = duration(dst)
            print(f'  {vid:28s} {d:5.2f}s {chars:3d} ch  {chars / max(d, 0.1):5.1f} ch/s')
        continue
    else:
        continue
    total += os.path.getsize(dst)
    print(f'{name:20s} -> {os.path.relpath(dst, OUT)} {duration(dst):5.2f}s {os.path.getsize(dst) // 1024} KB')

size = sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs)
print(f'audio/ total {size / 1e6:.1f} MB')
