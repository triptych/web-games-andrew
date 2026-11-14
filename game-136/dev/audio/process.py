# process.py RAW — encode the ElevenLabs downloads into game-136/audio/.
#   RAW/music-*.mp3 -> audio/music-*.mp3   80 kbps stereo, 1.5 s fade-in and fade-out so the loop seam is soft
#   RAW/sfx-*.mp3   -> audio/sfx-*.mp3     96 kbps mono, leading silence trimmed, at most 3.2 s, loudness-normalised
#                                          (sfx-fire is a loop: no trim, no fade)
# Run with: python3 -I game-136/dev/audio/process.py RAW
import sys, os, glob, subprocess

RAW = sys.argv[1]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'audio')
os.makedirs(OUT, exist_ok=True)


def dur(f):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).decode().strip())


def run(args):
    subprocess.run(['ffmpeg', '-y', '-v', 'error'] + args, check=True)


for f in sorted(glob.glob(os.path.join(RAW, 'music-*.mp3'))):
    d = dur(f)
    out = os.path.join(OUT, os.path.basename(f))
    run(['-i', f, '-af', f'afade=t=in:d=1.5,afade=t=out:st={d - 1.5:.2f}:d=1.5,loudnorm=I=-18:TP=-2', '-ac', '2', '-b:a', '80k', '-ar', '44100', out])
    print(os.path.basename(f), f'{d:.1f}s', os.path.getsize(out) // 1024, 'KB')

for f in sorted(glob.glob(os.path.join(RAW, 'sfx-*.mp3'))):
    out = os.path.join(OUT, os.path.basename(f))
    if 'fire' in f:
        af = 'loudnorm=I=-24:TP=-3'
    else:
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
