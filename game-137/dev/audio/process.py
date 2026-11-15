# process.py RAW — encode the ElevenLabs downloads into game-137/audio/.
#   RAW/music-*.mp3  -> audio/music-*.mp3   80 kbps stereo, 1.5 s fades so the loop seam is soft, -17 LUFS
#   RAW/sfx-*.mp3    -> audio/sfx-*.mp3     96 kbps mono, leading silence trimmed, at most 3.2 s, -16 LUFS
#   RAW/take-*.mp3   -> audio/vo-<name>.mp3 64 kbps mono, one file per line, cut at the middles of the pauses in CUTS
# The cut times come from `ffmpeg -af silencedetect=noise=-38dB:d=0.45`; a take can have a pause inside a line
# (Mirei's "Mission complete. ... Come home, Kai."), so the cuts are listed by hand rather than taken blindly.
# Run with: python3 -I game-137/dev/audio/process.py RAW
import sys, os, glob, subprocess

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'audio')
os.makedirs(OUT, exist_ok=True)

CUTS = {
    'kai': ([2.59, 6.12, 9.30, 12.88], ['kai-launch', 'kai-overdrive', 'kai-levelup', 'kai-boss', 'kai-lowhp']),
    'mirei': ([4.71, 8.52, 12.69, 16.21, 19.86], ['mirei-launch', 'mirei-rescue', 'mirei-evac', 'mirei-boss', 'mirei-clear', 'mirei-down']),
    'intro': ([], []),   # filled in below from the intro take
}
INTRO_CUTS = os.environ.get('INTRO_CUTS', '4.79,11.17,15.70,20.07,24.77')
if INTRO_CUTS:
    CUTS['intro'] = ([float(x) for x in INTRO_CUTS.split(',')], [f'intro-{i + 1}' for i in range(len(INTRO_CUTS.split(',')) + 1)])


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode().strip())


def run(args):
    subprocess.run(['ffmpeg', '-y', '-v', 'error'] + args, check=True)


for f in sorted(glob.glob(os.path.join(RAW, 'music-*.mp3'))):
    d = dur(f)
    out = os.path.join(OUT, os.path.basename(f))
    run(['-i', f, '-af', f'afade=t=in:d=1.5,afade=t=out:st={d - 1.5:.2f}:d=1.5,loudnorm=I=-17:TP=-2', '-ac', '2', '-b:a', '80k', '-ar', '44100', out])
    print(os.path.basename(f), f'{d:.1f}s', os.path.getsize(out) // 1024, 'KB')

for f in sorted(glob.glob(os.path.join(RAW, 'sfx-*.mp3'))):
    out = os.path.join(OUT, os.path.basename(f))
    d = dur(f)
    af = f'silenceremove=start_periods=1:start_threshold=-45dB,atrim=0:3.2,loudnorm=I=-16:TP=-1.5,afade=t=out:st={max(0.05, min(d, 3.2) - 0.08):.2f}:d=0.08'
    run(['-i', f, '-af', af, '-ac', '1', '-b:a', '96k', '-ar', '44100', out])
    try:
        ok = dur(out) > 0.1
    except subprocess.CalledProcessError:
        ok = False
    if not ok:   # a very quiet clip trims to nothing: keep it whole
        run(['-i', f, '-af', 'loudnorm=I=-16:TP=-1.5', '-ac', '1', '-b:a', '96k', '-ar', '44100', out])
    print(os.path.basename(f), f'{dur(out):.2f}s', os.path.getsize(out) // 1024, 'KB')

for who, (cuts, names) in CUTS.items():
    f = os.path.join(RAW, f'take-{who}.mp3')
    if not os.path.exists(f) or not names:
        continue
    d = dur(f)
    edges = [0.0] + cuts + [d]
    for i, name in enumerate(names):
        a, b = edges[i], edges[i + 1]
        out = os.path.join(OUT, f'vo-{name}.mp3')
        af = 'silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse,loudnorm=I=-16:TP=-1.5'
        run(['-ss', f'{a:.2f}', '-to', f'{b:.2f}', '-i', f, '-af', af, '-ac', '1', '-b:a', '64k', '-ar', '44100', out])
        print(f'vo-{name}', f'{dur(out):.2f}s')
