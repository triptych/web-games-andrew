"""process.py — encode HAYATE RIVER STRIKE's ElevenLabs audio for the web.

    python3 -I game-152/dev/audio/process.py RAW_DIR game-152/audio

Music: 80 kbps stereo, a short fade at the loop seam. Effects: leading/trailing silence trimmed, peak-normalised,
96 kbps mono. Voices: each character's single take is cut at the middle of its pauses (CUTS, from ffmpeg
silencedetect), each line loudness-normalised to about -16 LUFS, 64 kbps mono. Needs ffmpeg.
"""
import subprocess
import sys
from pathlib import Path

RAW, OUT = Path(sys.argv[1]), Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)


def ff(*args):
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *args], check=True)


def dur(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(p)],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


# ---------------------------------------------------------------- music
for name, loop in [('music-title', True), ('music-river', True), ('music-boss', True),
                   ('jingle-clear', False), ('jingle-over', False)]:
    src = RAW / f'{name}.mp3'
    if not src.exists():
        print('missing', name); continue
    d = dur(src)
    af = f'afade=t=in:d=0.05,afade=t=out:st={d - (0.35 if loop else 0.8):.2f}:d={0.35 if loop else 0.8}'
    ff('-i', str(src), '-af', af, '-ac', '2', '-b:a', '80k', str(OUT / f'{name}.mp3'))
    print(name, f'{d:.1f}s')

# ---------------------------------------------------------------- effects
TRIM = 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse'
for src in sorted(RAW.glob('sfx-*.mp3')):
    tmp = OUT / (src.stem + '.tmp.wav')
    ff('-i', str(src), '-af', TRIM, '-ac', '1', str(tmp))
    # peak normalise to -1 dBFS
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(tmp), '-af', 'volumedetect', '-f', 'null', '-'],
                       capture_output=True, text=True)
    peak = float(r.stderr.split('max_volume:')[1].split('dB')[0])
    ff('-i', str(tmp), '-af', f'volume={-1 - peak:.1f}dB', '-b:a', '96k', str(OUT / f'{src.stem}.mp3'))
    tmp.unlink()
    print(src.stem, f'{dur(OUT / (src.stem + ".mp3")):.2f}s')

# ---------------------------------------------------------------- voices
CUTS = {
    # take: (cut times in seconds, line names)
    'vo-rin': ([3.34, 5.58, 9.44, 11.75, 14.95, 18.21, 20.75, 23.74],
               ['launch', 'jump', 'boss', 'core', 'bosskill', 'lowhull', 'overdrive', 'over', 'victory']),
    'vo-tomo': ([3.42, 7.32, 10.68, 15.48, 19.04],
                ['start', 'fuel', 'mini', 'boss', 'overdrive', 'dock']),
    'vo-kurogane': ([4.55, 8.53], ['taunt', 'final', 'defeat']),
}
for take, (cuts, names) in CUTS.items():
    src = RAW / f'{take}.mp3'
    edges = [0.0, *cuts, dur(src)]
    for i, name in enumerate(names):
        a, b = edges[i], edges[i + 1]
        out = OUT / f'{take}-{name}.mp3'
        ff('-ss', f'{a:.3f}', '-to', f'{b:.3f}', '-i', str(src),
           '-af', f'{TRIM},loudnorm=I=-16:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '1', '-b:a', '64k', str(out))
        print(out.stem, f'{dur(out):.2f}s')
