# Coppergate Lane — sound

Everything you hear that isn't synthesised was made with **ElevenLabs**: the sound effects with Sound Effects v2
(`eleven_text_to_sound_v2`, 17 credits each) and the battle shouts with Eleven v4 (`eleven_v4`, one take per speaker).
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
- **Music (0)**: **not generated.** The account had about 2,000 credits left in the month and the effects and shouts used
  about 1,100 of them (a speech take costs 140–240 credits). The game plays its Web Audio synth for all seven themes
  (title, lane, wilds, gully, battle, boss, ending). The prompts are in [music.json](music.json); a generated track dropped into
  `audio/music/<name>.mp3` and listed by process.py is used instead, with no code change.
- **Dialogue voices (0)**: also not generated, for the same reason. 64 spoken lines, about 6,000 characters.

## Gotchas found

- A cost estimate said 55 credits for a sound effect; the run charged 17. Price one before a batch.
- Putting `silenceremove` and `loudnorm` in one ffmpeg filter chain made ffmpeg spin forever on one effect (the chest). process.py
  runs them as two passes; always pass `-nostdin`.
- `creative_generate_speech` takes `generations_count` 2 by default: pass 1.

## Rebuild

```bash
node game-030/dev/audio/voices.mjs                          # takes.json from barks.js
python3 -I game-030/dev/audio/process.py RAW_DIR            # RAW_DIR: <sfx>.mp3 and take-<speaker>.mp3
```
