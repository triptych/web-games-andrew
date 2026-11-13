# GIANT'S VAULT — the audio (ElevenLabs)

Everything in `../../audio/` was generated with ElevenLabs on 2026-11-12 and 13, on one flow ("game audio").
`process.py` (needs ffmpeg) turns the originals into the game's files and writes `js/audio-files.js`, the set of clips
the game is allowed to request:

```bash
python3 -I game-132/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3 and take-*.mp3
```

38 files, 5.4 MB, about 11,400 credits: music ~900–1,125 credits a track, effects ~17 each, the four voice takes
~2,200 together (two variations each), and ~1,430 to re-record three narrator lines when the story's chained colossi were renamed Giants.

| Kind | Model | Files | Notes |
|---|---|---|---|
| Music | `eleven_music_v2_5`, instrumental (`model_parameters: { duration_seconds, instrumental: true, lyrics_type: 'instrumental' }`) | `music-town` (60 s), `music-act1`, `music-act2`, `music-act3`, `music-rift` (75 s), `music-boss` (60 s) | 80 kbps stereo, 1.5 s fade in and 2.5 s fade out at the loop seam. The rift track failed on ElevenLabs' side the first time ("unexpected error") and was made on a second try. |
| Voices | `eleven_v4`, one take per speaker | `vo-card-<id>` (6 story cards, 10–18 s), `vo-<boss>-0/1/2` (taunts), `vo-<boss>-death` | 64 kbps mono, loudness-normalised to −16 LUFS. See below. |
| Effects | `eleven_text_to_sound_v2` | `sfx-swing`, `-hit`, `-zap`, `-thunder`, `-shadow`, `-slam`, `-warcry`, `-potion`, `-gold`, `-legendary`, `-levelup`, `-portal`, `-death-mon`, `-roar` | 96 kbps mono, silence trimmed, cut to 2.5 s at most (the "about 1 second" in a prompt is a hint, not a limit). |

The prompts are in the flow; `sfx.json` here has the full effect list that was planned (24); only the 14 above were made,
and the rest (footsteps, bone hits, arrows, chests, waystones) are synthesised in `js/audio.js` or borrow a near clip.

## Voices

| Speaker | Voice | Delivery tag |
|---|---|---|
| Narrator (the six story cards) | Obsidian, a dark fantasy storyteller (`acrqYoDVmcpJemOxjC39`) | `[slow, grave, epic]` |
| Skyllith | Draconius, feral and demonic (`A921zklid24OpyVy1Elb`) | `[hissing, monstrous]` |
| Morwen | Kristen, a cold evil queen (`Qbw4VpyUrHEG7NigKzty`) | `[cold, regal, amused]` |
| Kolossar | Bloodgrin, an evil demonic villain (`KTAbPR4QFlhaTpde6md8`) | `[booming, ancient, furious]` |

The lines are the game's own text (`takes.mjs` builds them from `CARDS` and each boss's `taunt` and `death`), so a
line can't drift from what the screen shows. Each speaker is **one take** with `[long pause]` between lines: one
generation is cheaper than ten and keeps the voice consistent. `process.py` finds the take's silences
(`silencedetect`, −40 dB, 0.45 s), cuts at the n−1 longest, and names the pieces in `takes.mjs` order. Check the
cuts: the pause after a card's title is about 1.1 s and the line breaks 1.4–1.6 s, so the margin is small.

```bash
node game-132/dev/audio/takes.mjs narrator               # the text of one take, to paste into ElevenLabs
node game-132/dev/audio/takes.mjs narrator intro,act3    # a take of just those lines, to re-record them
# save it as RAW/take-narrator.intro+act3.mp3: process.py replaces only vo-card-intro and vo-card-act3
```

## In the game

`js/audio.js` plays music through `<audio>` elements routed into a gain node (so `lib/page-audio.js` still silences a
hidden tab), crossfading between town, the act, a boss fight and rifts. Effects are decoded into buffers on first use
and rate-limited per name, so a 30-monster pile-up doesn't turn into noise. Anything missing falls back to a small
Web Audio synth sound.

Voices play on their own bus with their own volume slider, one at a time, and the music ducks to 35% under them. The
narrator reads a story card when it opens and stops when it closes; a card that opens before the first gesture (no
audio context yet) is read once the context starts. Bosses speak when they first see you (`taunt[0]`, also shown as a
toast), at each phase (`taunt[1]`, `taunt[2]`) and as they die. A boss line never cuts the narrator off; a card line
waits for a boss line that is already playing.
