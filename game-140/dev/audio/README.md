# The Last Apprentice — audio

All music, effects and voices were generated with **ElevenLabs** on one flow. A small Web Audio synth in
[audio.js](../../js/audio.js) stands in for any file that fails to load (minor pads and arpeggios for the
themes, tones for the effects); `page` and `click` are synth-only.

| Folder | Count | Format | Model |
|---|---|---|---|
| `audio/music/` | 14, 60–90 s | 80 kb/s stereo MP3, −18 LUFS, short fades | `eleven_music_v2_5`, instrumental ([music.json](music.json)) |
| `audio/sfx/` | 13 | 96 kb/s mono MP3, −16 LUFS, trimmed | `eleven_text_to_sound_v2` ([sfx.json](sfx.json): prompt and seconds) |
| `audio/vo/` | 374 lines | 64 kb/s mono MP3, −17 LUFS, trimmed | `eleven_v4` |

**Music:** title, ravenmoor, grey, order, tension, ward, bloom, camp, sorrow, wood, sea, finale, glory, epilogue.
Scripts pick them with `@music`; a ward-lock plays `ward`; the road map plays `grey`, then `bloom` once four
colours are back. **Effects:** door, magic, geas, bells, ward, anvil, clash, storm, axe, fire, thunder, turn,
lock.

## Voices

Every line of dialogue is voiced except the apprentice's own lines and lines that contain the player's name. To
keep the cost down, the **narrator** is recorded only for the great moments: the prologue, the seven
colour-returns and the epilogue ([voices.mjs](voices.mjs) `NARRATED`). Ten voices from the ElevenLabs library:

| Speaker | Voice |
|---|---|
| Narrator | Tamsin – warm, articulate and confident |
| The Codex | Myrddin |
| Edda | Nan |
| Aldwin | John North – Warm Northerner |
| Kestrel | Elowen – Elf |
| Ione | Elariel X – Epic Ethereal Queen |
| Caius | Kaisserkrieger |
| Odrane | Archivist Arkadi |
| Tilly | Tilly the Storyteller |
| Cinerite knight | Lord Griff |

A clip is named by [voiceKey(who, text)](../../js/voicekey.js), an FNV-1a hash of the speaker and the raw line,
so an edited line simply loses its clip instead of playing the wrong one. [js/voices.js](../../js/voices.js) lists
the clips that exist, so the game never requests a missing file, and `dev/simtest.mjs` fails if a recorded line
has no clip or a clip no line.

### Making them

```bash
node game-140/dev/audio/voices.mjs OUT_DIR                 # OUT_DIR/takes.json: 21 takes, ≤ 2,400 chars, ≤ 32 lines
python3 -I game-140/dev/audio/process.py RAW_DIR OUT_DIR/takes.json
```

1. [voices.mjs](voices.mjs) gathers every voiceable line, groups them by speaker and writes **takes**: the lines
   joined with `[long pause]`, each tagged `[warmly]`, `[sadly]` or `[softly]` from its portrait expression
   (`[softly]` is dropped from a line with an exclamation mark, and a line with no letters, like "...", is not
   voiced). 42,163 characters in all.
2. [process.py](process.py) (from game-127) splits each take back into its lines by aligning the silences to the
   lines' text lengths with a dynamic programme, checks every clip against its predicted length (all 374 passed),
   and writes `js/voices.js`. It also encodes the music and effects.

**Cost:** ElevenLabs bills a voice's characters at its own rate: most of these voices cost about 1 credit a
character, but the Codex's voice cost about 2.4. Check a voice's price on a short line before recording a long
part with it.

Raw files are named `music-<id>.mp3`, `sfx-<id>.mp3` and `vo-<take>.mp3`.
