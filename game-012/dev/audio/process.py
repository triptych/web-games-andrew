# process.py RAW — encode the ElevenLabs downloads into game-012/audio/.
#   RAW/music-*.mp3  -> audio/music-*.mp3   80 kbps stereo, 1.5 s fades so the loop seam is soft, -18 LUFS, low-passed
#                       (LOWPASS) to strip the beat-locked high ticks eleven_music left in the takes
#   RAW/sfx-*.mp3    -> audio/sfx-*.mp3     96 kbps mono, -16 LUFS, then leading silence trimmed, at most 2.4 s (3 s for stings)
#   RAW/take-*.mp3   -> audio/vo-<line>.mp3 64 kbps mono, one file per line (names from voices.json)
# A take holds all of one speaker's lines separated by [long pause]. The cuts are at the middles of silences
# (ffmpeg silencedetect, -38 dB, at least 0.33 s) chosen by align(): segment lengths matched to each line's share
# of the text. In take oracle-b the line breaks (0.65-0.85 s) were no longer than some pauses inside lines.
# Run with: python3 -I game-012/dev/audio/process.py RAW
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
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'silencedetect=noise=-38dB:d=0.33', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    out = []
    for m in re.finditer(r'silence_end: ([\d.]+) \| silence_duration: ([\d.]+)', err):
        end, d = float(m.group(1)), float(m.group(2))
        out.append((end - d / 2, d))
    return out


def align(gaps, chars, total):
    """Choose len(chars) - 1 cut points from the silences so each segment's length best matches its share of the
    text (speech runs at a near-steady rate), favouring longer silences. A dynamic programme over the gaps in order.
    The n-1 longest gaps alone failed on a take whose in-line pauses were as long as its line breaks."""
    n = len(chars)
    rate = total / sum(chars)
    exp = [c * rate for c in chars]
    G = sorted(gaps)                       # (middle, duration) in time order
    INF = float('inf')
    # best[k][j]: cost of placing cut k (0-based) at gap j
    best = [[INF] * len(G) for _ in range(n - 1)]
    back = [[-1] * len(G) for _ in range(n - 1)]
    seg = lambda a, b, i: ((b - a) - exp[i]) ** 2 / exp[i]
    for j, (m, d) in enumerate(G):
        best[0][j] = seg(0, m, 0) - 2 * d
    for k in range(1, n - 1):
        for j, (m, d) in enumerate(G):
            for i in range(j):
                c = best[k - 1][i] + seg(G[i][0], m, k) - 2 * d
                if c < best[k][j]: best[k][j], back[k][j] = c, i
    j = min(range(len(G)), key=lambda j: best[n - 2][j] + seg(G[j][0], total, n - 1))
    cuts = []
    for k in range(n - 2, -1, -1):
        cuts.append(G[j][0]); j = back[k][j]
    return sorted(cuts)


# The takes are dark (99.9% of their energy under 1.3-6.2 kHz) but carried short broadband ticks above 4 kHz: on every beat
# of the parlour (76 BPM), now and then in the others. Three stacked 2-pole low-passes (36 dB/octave) remove them.
# The parlour was regenerated clean in 2.0.2 (no percussion in its prompt), so it plays unfiltered.
LOWPASS = {'reading': 5000, 'battle': 7000, 'boss': 8000}

for f in sorted(glob.glob(os.path.join(RAW, 'music-*.mp3'))):
    d = dur(f)
    out = os.path.join(OUT, os.path.basename(f))
    lp = LOWPASS.get(os.path.basename(f)[6:-4])
    lpf = f'lowpass=f={lp},lowpass=f={lp},lowpass=f={lp},' if lp else ''
    run(['-i', f, '-af', f'{lpf}afade=t=in:d=1.5,afade=t=out:st={d - 1.5:.2f}:d=1.5,loudnorm=I=-18:TP=-2', '-ac', '2', '-b:a', '80k', '-ar', '44100', out])
    print(os.path.basename(f), f'{d:.1f}s', os.path.getsize(out) // 1024, 'KB')

for f in sorted(glob.glob(os.path.join(RAW, 'sfx-*.mp3'))):
    out = os.path.join(OUT, os.path.basename(f))
    d = min(dur(f), 2.6)
    cap = 3.0 if os.path.basename(f) in ('sfx-victory.mp3', 'sfx-defeat.mp3', 'sfx-omen.mp3') else 2.4
    d = min(dur(f), cap)
    af = f'loudnorm=I=-16:TP=-1.5,silenceremove=start_periods=1:start_threshold=-40dB,atrim=0:{cap},afade=t=out:st={max(0.05, d - 0.12):.2f}:d=0.12'
    run(['-i', f, '-af', af, '-ac', '1', '-b:a', '96k', '-ar', '44100', out])
    if dur(out) < 0.1:   # a very quiet clip trims to nothing: keep it whole
        run(['-i', f, '-af', 'loudnorm=I=-16:TP=-1.5', '-ac', '1', '-b:a', '96k', '-ar', '44100', out])
    print(os.path.basename(f), f'{dur(out):.2f}s')

for who, t in TAKES.items():
    f = os.path.join(RAW, f'take-{who}.mp3')
    if not os.path.exists(f):
        continue
    names = t['lines']
    edges = [0.0] + align(silences(f), [len(x) for x in t['text'].split('[long pause]')], dur(f)) + [dur(f)]
    for i, name in enumerate(names):
        a, b = edges[i], edges[i + 1]
        out = os.path.join(OUT, f'vo-{name}.mp3')
        af = 'silenceremove=start_periods=1:start_threshold=-42dB,areverse,silenceremove=start_periods=1:start_threshold=-42dB,areverse,loudnorm=I=-16:TP=-1.5'
        run(['-ss', f'{a:.2f}', '-to', f'{b:.2f}', '-i', f, '-af', af, '-ac', '1', '-b:a', '64k', '-ar', '44100', out])
        print(f'vo-{name}', f'{dur(out):.2f}s')
