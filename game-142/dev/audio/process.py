"""Encode Kaboom Keep's ElevenLabs audio into game-142/audio/.

    python3 -I game-142/dev/audio/process.py RAW   # RAW holds music-*.mp3, sfx-*.mp3, take-*.mp3 as downloaded

Music: 80 kbps stereo, loudness -17 LUFS, a short fade at the end so the loop seam doesn't click.
Effects: 96 kbps mono, leading silence trimmed, at most 3.2 s, -16 LUFS.
Voices: each character's take is cut at the middle of every pause of 0.6 s or more (shorter
pauses are the "..." inside a line), then 64 kbps mono, -16 LUFS. The names below are the lines
in the order they were spoken; the script stops if a take has a different number of pieces.
"""
import re
import subprocess
import sys
from pathlib import Path

RAW = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[2] / 'audio'
OUT.mkdir(exist_ok=True)

LINES = {
    'knight': ['uhoh', 'incoming', 'whoa', 'oof', 'notthecastle', 'myhelmet'],
    'king': ['mycastle', 'guards', 'unroyal'],
    'wizard': ['hocuspocus', 'spellbook', 'gravity'],
    'pip': ['kaboom', 'bullseye', 'cleared', 'outofballs', 'knockitdown', 'smash'],
}


def ff(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def duration(f):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def pauses(f, min_len=0.6):
    log = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(f), '-af', 'silencedetect=noise=-35dB:d=0.35', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    return [(s, e) for s, e in zip(starts, ends) if e - s >= min_len]


TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB'

for f in sorted(RAW.glob('music-*.mp3')):
    d = duration(f)
    ff('-i', str(f), '-af', f'loudnorm=I=-17:TP=-1.5:LRA=11,afade=t=in:d=0.05,afade=t=out:st={max(0, d - 0.6):.2f}:d=0.6',
       '-ac', '2', '-b:a', '80k', str(OUT / f.name))
    print(' ', f.name, f'{d:.1f}s')

for f in sorted(RAW.glob('sfx-*.mp3')):
    ff('-i', str(f), '-af', f'{TRIM},atrim=0:3.2,loudnorm=I=-16:TP=-1.5,afade=t=out:st=2.9:d=0.3',
       '-ac', '1', '-b:a', '96k', str(OUT / f.name))
    print(' ', f.name)

for who, names in LINES.items():
    f = RAW / f'take-{who}.mp3'
    p = pauses(f)
    cuts = [0.0] + [(s + e) / 2 for s, e in p] + [duration(f)]
    if len(cuts) - 1 != len(names):
        sys.exit(f'{f.name}: {len(cuts) - 1} pieces for {len(names)} lines; list the cuts by hand')
    for i, name in enumerate(names):
        a, b = cuts[i], cuts[i + 1]
        out = OUT / f'vo-{who}-{name}.mp3'
        ff('-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', str(f),
           '-af', f'{TRIM},areverse,{TRIM},areverse,loudnorm=I=-16:TP=-1.5',
           '-ac', '1', '-b:a', '64k', str(out))
        print(' ', out.name, f'{b - a:.2f}s')
