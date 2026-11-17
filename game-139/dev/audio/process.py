# process.py RAW — encode the ElevenLabs downloads into game-139/audio/.
#   RAW/music-*.mp3  -> audio/music-*.mp3   80 kbps stereo, 1.5 s fades so the loop seam is soft, -18 LUFS
#   RAW/sfx-*.mp3    -> audio/sfx-*.mp3     96 kbps mono, leading silence trimmed, at most 2.6 s, -16 LUFS
#   RAW/take-*.mp3   -> audio/vo-<line>.mp3 64 kbps mono, one file per line (names from voices.json)
# A take holds all of one character's lines separated by [long pause]. The cuts are at the middles of the
# longest silences (ffmpeg silencedetect, -38 dB, at least 0.5 s): lines - 1 of them, taken in time order.
# Short pauses inside a line (0.6 s) lose to the [long pause] gaps (1.2 s and up) every time in these takes.
# Run with: python3 -I game-139/dev/audio/process.py RAW
import sys, os, glob, json, re, subprocess

RAW = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'audio')
os.makedirs(OUT, exist_ok=True)
TAKES = json.load(open(os.path.join(HERE, 'voices.json')))


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode().strip())


def run(args):
    subprocess.run(['ffmpeg', '-y', '-v', 'error'] + args, check=True)


def silences(f):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'silencedetect=noise=-38dB:d=0.5', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    out = []
    for m in re.finditer(r'silence_end: ([\d.]+) \| silence_duration: ([\d.]+)', err):
        end, d = float(m.group(1)), float(m.group(2))
        out.append((end - d / 2, d))
    return out


for f in sorted(glob.glob(os.path.join(RAW, 'music-*.mp3'))):
    d = dur(f)
    out = os.path.join(OUT, os.path.basename(f))
    run(['-i', f, '-af', f'afade=t=in:d=1.5,afade=t=out:st={d - 1.5:.2f}:d=1.5,loudnorm=I=-18:TP=-2', '-ac', '2', '-b:a', '80k', '-ar', '44100', out])
    print(os.path.basename(f), f'{d:.1f}s', os.path.getsize(out) // 1024, 'KB')

for f in sorted(glob.glob(os.path.join(RAW, 'sfx-*.mp3'))):
    out = os.path.join(OUT, os.path.basename(f))
    d = min(dur(f), 2.6)
    af = f'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:2.6,loudnorm=I=-16:TP=-1.5,afade=t=out:st={max(0.05, d - 0.08):.2f}:d=0.08'
    run(['-i', f, '-af', af, '-ac', '1', '-b:a', '96k', '-ar', '44100', out])
    if dur(out) < 0.1:   # a very quiet clip trims to nothing: keep it whole
        run(['-i', f, '-af', 'loudnorm=I=-16:TP=-1.5', '-ac', '1', '-b:a', '96k', '-ar', '44100', out])
    print(os.path.basename(f), f'{dur(out):.2f}s')

for who, t in TAKES.items():
    f = os.path.join(RAW, f'take-{who}.mp3')
    if not os.path.exists(f):
        continue
    names = t['lines']
    gaps = sorted(silences(f), key=lambda g: -g[1])[:len(names) - 1]
    cuts = sorted(g[0] for g in gaps)
    edges = [0.0] + cuts + [dur(f)]
    for i, name in enumerate(names):
        a, b = edges[i], edges[i + 1]
        out = os.path.join(OUT, f'vo-{name}.mp3')
        af = 'silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse,loudnorm=I=-16:TP=-1.5'
        run(['-ss', f'{a:.2f}', '-to', f'{b:.2f}', '-i', f, '-af', af, '-ac', '1', '-b:a', '64k', '-ar', '44100', out])
        print(f'vo-{name}', f'{dur(out):.2f}s')
