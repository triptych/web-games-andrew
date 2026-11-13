# Lanternhall — audio

All music, effects and voices were generated with **ElevenLabs** on one flow. A small Web Audio synth in
[audio.js](../../js/audio.js) stands in for any file that fails to load. Prompts live in
[media.js](../../js/sim/data/media.js) (the sim test checks every `@music` and `@sfx` a script names is listed
there and on disk).

| Folder | Count | Format | Model |
|---|---|---|---|
| `audio/music/` | 8 × 60 s | 80 kb/s stereo MP3, normalised, short fades | `eleven_music_v2_5`, `duration_seconds: 60`, instrumental |
| `audio/sfx/` | 18 | 96 kb/s mono MP3, trimmed, capped at 3.5 s | `eleven_text_to_sound_v2` |
| `audio/vo/` | 20 lines | 64 kb/s mono MP3 | `eleven_v4`, one take per speaker |

**Music:** title, hall, tavern, tender, tense, gloam, sad, triumph. Scripts pick them with `@music`; the desk plays
`hall` (and `gloam` from chapter 4), visits and heart events `tender`.

**Effects:** stamp, door, coin, bell, roar, thunder, cheer, page, quill, fizz, bottle, drop, dice, clash, rankup,
fail, win, step. "About 1 second" in a prompt is a hint: the bottle came back 14 s long and is cut to 3.5.

## Voices

The four greetings each of the five people you can visit says when you drop by (`talk` in
[cast.js](../../js/sim/data/cast.js)).

| Speaker | Voice |
|---|---|
| Kael | Harry – Fierce Warrior |
| Seraphine | Elowen – Elf |
| Bram | Jordan – Warm & Gritty |
| Nyx | Yuria – Expressive, Playful, Witty |
| Ren | Quinn – Comforting & Approachable |

A clip is named by `voiceKey(who, text)` in [voices.js](../../js/voices.js), a hash of the speaker and the raw
line, so an edited line loses its clip instead of playing the wrong one; `VOICED` there lists the clips that exist.

```bash
node game-133/dev/audio/voices.mjs RAW_DIR          # prints one take per speaker, writes RAW_DIR/takes.json
# generate each take (eleven_v4, one generation) and save it as RAW_DIR/vo-<who>.mp3
python3 -I game-133/dev/audio/process.py RAW_DIR    # music, effects, and the takes split at their longest pauses
node game-133/dev/audio/voices.mjs RAW_DIR write    # lists the clips in js/voices.js
```

A take is the speaker's lines joined with `[long pause]`, each with a delivery tag (`[quiet, reserved]`,
`[warm, laughing]`…). With four lines a take, cutting at the three longest silences was enough; for longer takes
use game-127's alignment.
