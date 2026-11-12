# Starbase Spooky: the audio (ElevenLabs)

All music, sound effects and voices in `../../audio/` were generated with ElevenLabs on 2026-11-12, in the flow
"Starbase Spooky game audio", one take each. They were processed by `process.py` (needs ffmpeg):

```bash
node game-130/dev/audio/lines.mjs > game-130/dev/audio/takes.json   # only when lines change
python3 -I game-130/dev/audio/process.py RAW                        # RAW holds music-*.mp3, sfx-*.mp3, vo-<take>.mp3
```

The script:
- normalises loudness and trims silence,
- fades each music track's loop seam,
- cuts each voice take back into one clip per line at its longest pauses (ffmpeg `silencedetect`; the lines were
  sent joined by `[long pause]`),
- checks every cut against the length of its text, and prints any clip far off its words as SUSPECT,
- encodes music at 80 kbps stereo, effects at 96 kbps mono and voices at 64 kbps mono.

The result is 173 files, 10 MB. The only SUSPECT clip is Madame Gloobella's "Brava! Bravissima!", which she sings.
The spend was about 19,500 credits: voices about 14,300 (1 credit per character with `eleven_v4`), music 3,600 and
effects 250.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays |
|---|---|---|
| `music-title` | 45 s | the title screen |
| `music-station` | 60 s | walking around the station |
| `music-spooky` | 45 s | the vents, the night cards, and day 5 once the mystery is solved |
| `music-fixit` | 45 s | every puzzle |
| `music-ending` | 45 s | the certificate |

The prompts are in the flow and in `audio.js`'s git history. In short: a cheerful SNES-style chiptune title; calm
synth marimba; a silly-spooky theremin; perky clockwork puzzle music; and a warm, soaring goodbye.

## Effects (`eleven_text_to_sound_v2`)

The effects are `door`, `dock`, `spark`, `fixed`, `ghost`, `flicker`, `clue`, `sticker`, `wrong`, `right`, `beep`,
`munch`, `signal` and `whale`. Each is trimmed to its useful length in `SFX_MAX`.

A `zip` effect was generated but not kept. The map's travel sound uses `door`. The memory puzzles' notes, the UI
blips and the radio hum are synthesised.

## Voices (`eleven_v4`, audio tags for delivery)

| Character | Voice | Lines |
|---|---|---|
| Orby (robot helper, narrator) | Yumi | 101: hints, comments on everything, clues, breakdowns, puzzle help, the 20 facts, the mystery |
| Captain Ada Comet | Dolly – Southern Hospitality | 6: the five briefings and the ending |
| Zorp | Chuck – Goblin | 8: hello, right, wrong, goodbye, and his four questions with their answers |
| Madame Gloobella | Andrea – British female character voice | 8 |
| Captain Snorkel | HorHey | 8 |
| Professor Quasar | Devry | 8 |
| Blip & Blop | Peanut – Tiny & Peppy | 8 |
| Wisp | Mimi – Cute & Quirky | 5 |
| Mama Glimmer | Ivy (with an echo added in `process.py`) | 2 |

`takes.json` is the exact text of every take. A clip is `audio/vo-<line id with . as ->.mp3`. The game strips the
`[tags]` before showing the words.
