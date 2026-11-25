"""process.py — turn the raw ElevenLabs downloads into the game's audio (game-149/audio/).

    python3 game-149/dev/audio/process.py RAW_DIR

RAW_DIR holds music-<theme>.mp3, sfx-<name>.mp3 and vo-<who>.mp3 (one eleven_v4 take per character, its lines
separated by [long pause], in the order of lines.json).

- Music: 80 kbps stereo, a 1.5 s fade out and a short fade in, so the loop seam is soft.
- Effects: leading and trailing silence trimmed, capped at 2.5 s (with a fade), 96 kbps mono.
- Voices: ffmpeg silencedetect finds the pauses; the take is cut at the middles of its (lines - 1) longest ones,
  each piece trimmed of silence and written as vo/<who>-<key>.mp3 at 64 kbps mono.
"""
import json, os, re, subprocess, sys

RAW = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'audio')
LINES = json.load(open(os.path.join(HERE, 'lines.json')))


def run(args):
    return subprocess.run(args, capture_output=True, text=True)


def duration(f):
    return float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout.strip())


TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse'


def music(name):
    src = os.path.join(RAW, f'music-{name}.mp3')
    d = duration(src)
    dst = os.path.join(OUT, 'music', f'{name}.mp3')
    run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', f'afade=t=in:d=0.4,afade=t=out:st={d - 1.5:.2f}:d=1.5',
         '-ac', '2', '-b:a', '80k', dst])


def sfx(name, cap=2.5):
    src = os.path.join(RAW, f'sfx-{name}.mp3')
    dst = os.path.join(OUT, 'sfx', f'{name}.mp3')
    run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', f'{TRIM},afade=t=out:st={cap - 0.3}:d=0.3,atrim=0:{cap}',
         '-ac', '1', '-b:a', '96k', dst])


def silences(src, noise='-38dB', d=0.25):
    err = run(['ffmpeg', '-i', src, '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-']).stderr
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    return list(zip(starts, ends))


def voice(who):
    src = os.path.join(RAW, f'vo-{who}.mp3')
    keys = [k for k, _ in LINES[who]['lines']]
    total = duration(src)
    sil = [(s, e) for s, e in silences(src) if s > 0.05 and e < total - 0.05]
    sil.sort(key=lambda p: p[1] - p[0], reverse=True)
    cuts = sorted((s + e) / 2 for s, e in sil[:len(keys) - 1])
    if len(cuts) != len(keys) - 1:
        print(f'  {who}: found {len(cuts)} pauses for {len(keys)} lines, check by ear')
    bounds = [0.0] + cuts + [total]
    for i, k in enumerate(keys):
        if i + 1 >= len(bounds):
            break
        a, b = bounds[i], bounds[i + 1]
        dst = os.path.join(OUT, 'vo', f'{who}-{k}.mp3')
        run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', src, '-af', TRIM,
             '-ac', '1', '-b:a', '64k', dst])
        print(f'  {who}-{k}: {b - a:.2f}s')


def main():
    for d in ('music', 'sfx', 'vo'):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if f.startswith('music-'):
            music(f[6:-4])
        elif f.startswith('sfx-'):
            sfx(f[4:-4], cap=3.0 if f[4:-4] in ('victory', 'bell', 'cheer') else 2.0)
    for who in LINES:
        if not who.startswith('_'):
            voice(who)
    print('done')


if __name__ == '__main__':
    main()
