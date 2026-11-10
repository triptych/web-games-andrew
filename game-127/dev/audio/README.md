# The First Dragon Prince — audio

All music, effects and voices were generated with **ElevenLabs** on one flow. A small Web Audio synth in
[audio.js](../../js/audio.js) stands in for any file that fails to load (pad-and-arpeggio themes, tones for effects).

| Folder | Count | Format | Model |
|---|---|---|---|
| `audio/music/` | 16 × 60 s | 80 kb/s stereo MP3, −18 LUFS, short fades | `eleven_music_v2_5`, instrumental |
| `audio/sfx/` | 14 | 96 kb/s mono MP3, −16 LUFS, trimmed | `eleven_text_to_sound_v2` |
| `audio/vo/` | 501 lines | 64 kb/s mono MP3, −17 LUFS, trimmed | `eleven_v4` |

**Music:** title, manor, town, court, arcane, harbor, romance, tension, sad, epic, dragon, festival, dream,
triumph, dark, holy. Scripts pick them with `@music`; the Free Day picks by place.

**Effects:** fire, roar, wings, cheer, bells, sword, magic, coins, heart, success, fail, page, click, thunder
(`crowd` and `tambourine` in the scripts are aliases).

## Voices

Every line of dialogue and narration in the story, heart, Starfall and ending scenes is voiced, except lines that
contain the player's names (`{name}`, `{you}`…) and the player's own lines. 16 voices from the ElevenLabs library:

| Speaker | Voice |
|---|---|
| Narrator | Rowan – Audiobook Storyteller |
| Prince (Cael) | Jordan – Warm & Gritty |
| Isolde | Elowen – Elf |
| Rowan | Harry – Fierce Warrior |
| Pip | Darren – Irish Storyteller |
| Theo | Quinn – Soft Nerd Boy |
| Saffi | Yuria – Expressive, Playful, Witty |
| Lumi | Ayla – Bubbly, Cute & Expressive |
| King Theodric | Eldrin – Wise Ancient Wizard Storyteller |
| Duke Mordrain | Timothy Pemberton Smythe – British Posh |
| Hobb | Rusty Malone – Deep & Raspy |
| Archmage Velis | Harriet – Mature British Actress |
| Ysolde | Tess – Direct and Grounded |
| Mistress Vey | Moriana – Dark, Seductive, Dangerous |
| Ashkar | Matthew Schmitz – Ancient Sage Dragon Wizard |
| Captain Brannoc | Gravel Midnight – Deep Character Voice |

A clip is named by [voiceKey(who, text)](../../js/voicekey.js), an FNV-1a hash of the speaker and the raw line,
so an edited line simply loses its clip instead of playing the wrong one. [js/voices.js](../../js/voices.js) lists
the clips that exist, so the game never requests a missing file.

### Making them

```bash
node game-127/dev/audio/voices.mjs OUT_DIR                 # OUT_DIR/takes.json: 34 takes, ≤ 2,000 chars each
python3 -I game-127/dev/audio/process.py RAW_DIR OUT_DIR/takes.json
```

1. [voices.mjs](voices.mjs) gathers every voiceable line, groups them by speaker, and writes **takes** of up to
   about 2,000 characters: the lines joined with `[long pause]`, each tagged `[happy]`, `[sad]` or `[angry]` from
   its portrait expression. One take per node, one generation each (~54,000 characters in all).
2. [process.py](process.py) splits each take back into lines. Picking the N−1 longest silences was not enough:
   in six takes the pause between lines was barely longer than pauses inside them. It now **aligns**: a dynamic
   programme chooses N−1 silences, in order, scoring each segment by how close its length is to what its text
   predicts (characters ÷ the take's speaking rate) plus a bonus for the length of the pause it cuts at. Every
   clip is then checked against its predicted length; all 501 land within 0.54–1.8× of it.
3. Trimming and silence detection are done in numpy. ffmpeg 6.1 deadlocked (0% CPU, forever) on
   `silenceremove,areverse,…,loudnorm` chains whose output was resampled, so ffmpeg only decodes, normalises
   and encodes.

Raw files are named `music-<id>.mp3`, `sfx-<id>.mp3` and `vo-<take>.mp3`.
