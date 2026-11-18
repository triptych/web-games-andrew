"""process.py RAW — encode SANDSUNK's ElevenLabs downloads into the game's audio/ folder.

    python3 -I game-141/dev/audio/process.py RAW

RAW holds the downloads named as in dev/audio/README.md: sfx-<name>.mp3, music-<name>.mp3 and one voice take
per character (take-sela, take-zahra, take-quill-a, take-quill-b), each line separated by a [long pause].
- Effects: silence trimmed from both ends, 96 kbps mono.
- Music: 80 kbps stereo, a short fade-in and a 2.5 s fade-out so the loop seam is soft.
- Voices: each take is cut at the midpoint of the silences listed in CUTS (from ffmpeg silencedetect at
  -38 dB / 0.45 s, picked so that pauses inside a line stay inside it), then 64 kbps mono, vo-<line id>.mp3.
Needs ffmpeg.
"""
import os
import subprocess
import sys

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'audio')
os.makedirs(OUT, exist_ok=True)

SFX = ['dig-soft', 'dig-stone', 'dig-crystal', 'break-soft', 'break-stone', 'break-crystal', 'trap', 'monster', 'mhit',
       'hurt', 'coin', 'gem', 'artifact', 'levelup', 'rune', 'solve', 'chest', 'press', 'descend', 'potion', 'disarm',
       'mark', 'deny', 'rotate', 'power', 'blast', 'click']
MUSIC = ['dig', 'camp', 'treasure', 'ending']
# take: (line ids in order, cut times in seconds)
CUTS = {
    'take-quill-a': (['intro', 'numbers', 'mark', 'falseAlarm', 'monster', 'rune', 'runeHidden', 'door', 'conduit'],
                     [8.16, 14.43, 22.95, 29.09, 35.62, 42.35, 47.80, 52.11]),
    'take-quill-b': (['noLens', 'chest', 'clear', 'exhausted', 'faint', 'levelup', 'quest', 'boss', 'ending'],
                     [4.59, 11.96, 16.90, 22.06, 28.12, 31.97, 36.63, 42.21]),
    'take-sela': (['intro2', 'trap', 'disarm', 'artifact', 'revive', 'heart', 'deeper'],
                  [2.70, 7.08, 10.24, 13.91, 18.26, 24.71]),
    'take-zahra': (['camp', 'buy'], [7.67]),
}


def ff(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def size(p):
    return os.path.getsize(p) // 1024


trim = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse'
for s in SFX:
    out = os.path.join(OUT, f'sfx-{s}.mp3')
    ff('-i', os.path.join(RAW, f'sfx-{s}.mp3'), '-af', trim + ',afade=t=out:st=0:d=0.01:curve=nofade', '-ac', '1', '-b:a', '96k', out)
print(f'{len(SFX)} effects')

for m in MUSIC:
    src = os.path.join(RAW, f'music-{m}.mp3')
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src],
                               capture_output=True, text=True).stdout)
    out = os.path.join(OUT, f'music-{m}.mp3')
    ff('-i', src, '-af', f'afade=t=in:st=0:d=0.6,afade=t=out:st={dur - 2.5:.2f}:d=2.5', '-ac', '2', '-b:a', '80k', out)
    print(f'music-{m}.mp3 {dur:.0f}s {size(out)} KB')

n = 0
for take, (ids, cuts) in CUTS.items():
    src = os.path.join(RAW, take + '.mp3')
    bounds = [0.0, *cuts, None]
    for k, line in enumerate(ids):
        a, b = bounds[k], bounds[k + 1]
        out = os.path.join(OUT, f'vo-{line}.mp3')
        args = ['-ss', f'{a:.2f}'] + (['-to', f'{b:.2f}'] if b else []) + ['-i', src]
        ff(*args, '-af', trim, '-ac', '1', '-b:a', '64k', out)
        n += 1
print(f'{n} voice lines')
