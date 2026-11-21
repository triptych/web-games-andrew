# Coppergate Lane — sound

Everything you hear was made with **ElevenLabs**: the sound effects with Sound Effects v2 (`eleven_text_to_sound_v2`,
17 credits each), the voices with Eleven v4 (`eleven_v4`, one take per chunk of a speaker's lines) and the music with Music v2.5.
[process.py](process.py) turns the raw generations into `audio/` and writes `js/audio-files.js`, the list of files the game may
load. A Web Audio synth stands in for any music or effect that can't load; a missing voice line is simply silent.

## What exists

- **Effects (18)**: hit, slash, clang, spark, gears, heal, steam, quake, coin, chest, quest, levelup, victory, defeat,
  encounter, ko, shield, step. One take each, leading silence trimmed, loudness-normalised, 96 kbps mono.
- **Voices (22 clips)**: the battle shouts in [js/sim/data/barks.js](../../js/sim/data/barks.js), one take per speaker with the
  lines joined by `[long pause]` and a delivery tag (`[excited]`, `[firmly]`, `[shouting]`…): Wick (Jesse), Trina (Ayla),
  Mabel (Dolly), Big Bertha (Azgar the Cursed). process.py cuts each take at its N−1 longest silences and names each clip
  `speaker-<hash of the exact words>` ([js/voicekey.js](../../js/voicekey.js)), so editing a line falls back to silence until it
  is regenerated. 64 kbps mono. Voices are rationed in-game (one at a time, and not every ability).
- **Dialogue (64 lines)**: every spoken line in [js/sim/data/story.js](../../js/sim/data/story.js), in takes of at most eight lines
  per speaker (`dlg-<speaker>-<n>`), cut and named the same way. Voices: Wick (Jesse), Trina (Ayla), Mabel (Dolly), Big Bertha (Azgar
  the Cursed), Mayor Pilcrow (HorHey) and Bertram (Cedric M - Irritated, Annoyed Character). [voices.mjs](voices.mjs) builds
  `takes.json` and prints the prompt for each take; the narrator is text only.
- **Music (7)**: title, lane, wilds, gully, battle, boss and ending, from the prompts in [music.json](music.json) (Music v2.5,
  instrumental, 60-85 s, about 900-1,200 credits each). Encoded 80 kbps stereo with a short fade in and a 2 s fade out at the loop seam.

## Gotchas found

- Estimates and charges differ: a sound effect was estimated at 55 credits and charged 17; a music track was estimated at 1,650 and charged 900. Price one before a batch, and read the charge from the run.
- The account's monthly limit changed during the session (296,000, then 406,000): `account_get_usage` is worth calling again after a block rather than assuming it is still empty.
- Putting `silenceremove` and `loudnorm` in one ffmpeg filter chain made ffmpeg spin forever on one effect (the chest). process.py
  runs them as two passes; always pass `-nostdin`.
- `creative_generate_speech` takes `generations_count` 2 by default: pass 1.

## Rebuild

```bash
node game-030/dev/audio/voices.mjs [--prompts]               # takes.json from barks.js and story.js
python3 -I game-030/dev/audio/process.py RAW_DIR            # RAW_DIR: <sfx>.mp3, take-/dlg-<speaker>.mp3, music-<name>.mp3
```
