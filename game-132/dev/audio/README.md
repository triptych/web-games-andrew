# TITAN'S VAULT — the audio (ElevenLabs)

Everything in `../../audio/` was generated with ElevenLabs on 2026-11-12, on the flow "TITAN'S VAULT — game audio".
One take each. `process.py` (needs ffmpeg) turns the originals into the game's files and writes `js/audio-files.js`,
the set of clips the game is allowed to request:

```bash
python3 -I game-132/dev/audio/process.py RAW     # RAW holds music-*.mp3 and sfx-*.mp3
```

19 files, 3.7 MB, about 6,500 credits (music ~900–1,125 credits a track, effects ~17 each).

| Kind | Model | Files | Notes |
|---|---|---|---|
| Music | `eleven_music_v2_5`, instrumental (`model_parameters: { duration_seconds, instrumental: true, lyrics_type: 'instrumental' }`) | `music-town` (60 s), `music-act1`, `music-act2`, `music-act3` (75 s), `music-boss` (60 s) | 80 kbps stereo, 1.5 s fade in and 2.5 s fade out at the loop seam. A sixth track for the rifts failed on ElevenLabs' side ("unexpected error"); rifts play the Act III track. |
| Effects | `eleven_text_to_sound_v2` | `sfx-swing`, `-hit`, `-zap`, `-thunder`, `-shadow`, `-slam`, `-warcry`, `-potion`, `-gold`, `-legendary`, `-levelup`, `-portal`, `-death-mon`, `-roar` | 96 kbps mono, silence trimmed, cut to 2.5 s at most (the "about 1 second" in a prompt is a hint, not a limit). |

The prompts are in the flow; `sfx.json` here has the full effect list that was planned (24); only the 14 above were made,
and the rest (footsteps, bone hits, arrows, chests, waystones) are synthesised in `js/audio.js` or borrow a near clip.

## In the game

`js/audio.js` plays music through `<audio>` elements routed into a gain node (so `lib/page-audio.js` still silences a
hidden tab), crossfading between town, the act, a boss fight and rifts. Effects are decoded into buffers on first use
and rate-limited per name, so a 30-monster pile-up doesn't turn into noise. Anything missing falls back to a small
Web Audio synth sound. There are no voices yet.
