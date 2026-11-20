#!/usr/bin/env python3
"""Raw generations -> game-028/audio/ and js/audio-files.js.

  python3 -I game-028/dev/audio/process.py RESULTS_DIR RAW_DIR

RESULTS_DIR holds the saved fal results (JSON, as returned by wait_for_jobs): for each voice take the result's
audio URL and, where present, its character timestamps; for each music job its audio URL. RAW_DIR/sfx holds the
ElevenLabs sound effects (<name>.mp3), downloaded from the flow (see README.md).

Voices: each take (takes.json, from voices.mjs) is cut into lines. With timestamps, a line runs from its first
character's start to its last character's end (plus 0.12 s each side, and never into the next line). Without
them, the take is split at its N-1 longest silences (ffmpeg silencedetect), which the [long pause] between lines
makes reliable. Each line is loudness-normalised and encoded 64 kbps mono to audio/vo/<key>.mp3.
Music: 80 kbps stereo, 2 s fade in at the start, 3 s fade out at the end. Effects: leading/trailing silence trimmed,
96 kbps mono. Needs ffmpeg.
"""
import json, os, re, subprocess, sys, glob, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
GAME = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(GAME, 'audio')
MUSIC = ['title', 'village', 'forest', 'grove', 'ruins', 'sanctum', 'battle', 'boss', 'ending']

def run(cmd): return subprocess.run(cmd, capture_output=True, text=True)

def load_results(d):
    """request_id -> {'url', 'ts'} from every saved result file."""
    found = {}
    for f in glob.glob(os.path.join(d, '*')):
        s = open(f, encoding='utf-8', errors='replace').read()
        try:
            j = json.loads(s)
        except Exception:
            i = s.find('{'); 
            try: j = json.loads(s[i:])
            except Exception: continue
        if isinstance(j, list): j = json.loads(j[0]['text'])
        for job in j.get('jobs', []):
            rid = job['request_id']
            r = job.get('result') or {}
            url = (r.get('audio') or {}).get('url') or next((m['url'] for m in job.get('media', []) if m.get('media_type') == 'audio'), None)
            e = found.setdefault(rid, {})
            if url: e['url'] = url
            if r.get('timestamps'): e['ts'] = r['timestamps']
    return found

def fetch(url, path):
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        urllib.request.urlretrieve(url, path)
    return path

def flatten(ts):
    chars, st, en = [], [], []
    for c in ts:
        chars += c['characters']; st += c['character_start_times_seconds']; en += c['character_end_times_seconds']
    return ''.join(chars), st, en

def duration(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path])
    return float(r.stdout.strip())

def silences(path):
    r = run(['ffmpeg', '-i', path, '-af', 'silencedetect=noise=-38dB:d=0.35', '-f', 'null', '-'])
    out, start = [], None
    for line in r.stderr.splitlines():
        m = re.search(r'silence_start: ([\d.]+)', line)
        if m: start = float(m.group(1))
        m = re.search(r'silence_end: ([\d.]+)', line)
        if m and start is not None: out.append((start, float(m.group(1)))); start = None
    return out

def cut(src, a, b, dst, voice=True):
    af = 'loudnorm=I=-18:TP=-2:LRA=9,afade=t=in:d=0.03,areverse,afade=t=in:d=0.08,areverse'
    run(['ffmpeg', '-y', '-v', 'error', '-ss', f'{max(0, a):.3f}', '-to', f'{b:.3f}', '-i', src, '-af', af, '-ac', '1', '-ar', '44100', '-b:a', '64k', dst])

def main():
    res_dir, raw = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.join(raw, 'takes'), exist_ok=True)
    for d in ('vo', 'music', 'sfx'): os.makedirs(os.path.join(OUT, d), exist_ok=True)
    R = load_results(res_dir)
    jobs = dict(l.split() for l in open(os.path.join(raw, 'vojobs.txt')) if l.strip())
    takes = json.load(open(os.path.join(HERE, 'takes.json')))
    voices = []
    for t in takes:
        rid = jobs[t['who']]
        e = R.get(rid, {})
        if 'url' not in e: print('NO AUDIO for', t['who']); continue
        src = fetch(e['url'], os.path.join(raw, 'takes', t['who'] + '.mp3'))
        total = duration(src)
        spans = []
        if 'ts' in e:
            text, st, en = flatten(e['ts'])
            if text != t['text']: print('  text mismatch for', t['who'], len(text), len(t['text']))
            for p in t['parts']:
                spans.append([st[p['start']], en[p['end'] - 1]])
            mode = 'timestamps'
        else:
            n = len(t['parts'])
            sil = sorted(silences(src), key=lambda s: s[1] - s[0], reverse=True)[:n - 1]
            sil.sort()
            edges = [0.0] + [((a + b) / 2) for a, b in sil] + [total]
            if len(sil) != n - 1: print('  only', len(sil), 'pauses for', n, 'lines in', t['who'])
            spans = [[edges[i], edges[i + 1]] for i in range(len(edges) - 1)]
            mode = 'silences'
        for i, (p, (a, b)) in enumerate(zip(t['parts'], spans)):
            lo = spans[i - 1][1] if i > 0 and mode == 'timestamps' else 0
            hi = spans[i + 1][0] if i + 1 < len(spans) and mode == 'timestamps' else total
            a2 = max(lo, a - 0.12) if mode == 'timestamps' else a
            b2 = min(hi, b + 0.2) if mode == 'timestamps' else b
            cut(src, a2, b2, os.path.join(OUT, 'vo', p['key'] + '.mp3'))
            voices.append(p['key'])
        print(t['who'], mode, len(spans), 'lines')
    # music
    mjobs = [l.split() for l in open(os.path.join(raw, 'mujobs.txt')) if l.strip()]
    music = []
    for name, rid in mjobs:
        e = R.get(rid, {})
        if 'url' not in e: print('NO MUSIC', name); continue
        src = fetch(e['url'], os.path.join(raw, 'takes', 'music-' + name + '.mp3'))
        d = duration(src)
        run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', f'afade=t=in:d=1.5,afade=t=out:st={d - 3:.2f}:d=3,loudnorm=I=-20:TP=-2', '-ar', '44100', '-b:a', '80k', os.path.join(OUT, 'music', name + '.mp3')])
        music.append(name); print('music', name, round(d, 1), 's')
    # effects
    sfx = []
    for f in sorted(glob.glob(os.path.join(raw, 'sfx', '*.mp3'))):
        name = os.path.basename(f)[:-4]
        run(['ffmpeg', '-y', '-v', 'error', '-i', f, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5', '-ac', '1', '-ar', '44100', '-b:a', '96k', os.path.join(OUT, 'sfx', name + '.mp3')])
        sfx.append(name)
    js = ('// Generated by dev/audio/process.py: the audio files that exist. Anything not listed falls back to the synth\n'
          '// (music, effects) or to silence (voices).\n'
          f'export const MUSIC = {json.dumps(music)};\nexport const SFX = {json.dumps(sfx)};\nexport const VOICES = new Set({json.dumps(sorted(set(voices)))});\n')
    open(os.path.join(GAME, 'js', 'audio-files.js'), 'w').write(js)
    print(len(voices), 'voice lines,', len(music), 'music,', len(sfx), 'effects')

if __name__ == '__main__':
    main()
