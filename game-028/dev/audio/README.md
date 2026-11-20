# Echoes of Aethermoor — sound

Everything you hear was made with **ElevenLabs**: the sound effects in ElevenLabs itself (the account's own credits),
the music and every voiced line with ElevenLabs models hosted on **fal** (`elevenlabs/music/v2.5`,
`elevenlabs/tts/eleven-v4`), billed to fal. [process.py](process.py) turns the raw generations into `audio/` and writes
`js/audio-files.js`, the list of files the game may load. A Web Audio synth stands in for any music or effect that
can't load; a missing voice line is simply silent.

## Voices (190 lines, 14 voices)

[voices.mjs](voices.mjs) walks every node of `js/sim/data/story.js` and every bark in `js/sim/data/barks.js`, and builds
one take per speaker: their lines joined by `[long pause]`, each led by a delivery tag from the line's mood (`[sadly]`,
`[determined]`, `[angrily]`, `[warmly]`, `[playfully]`, `[worried]`; barks get `[shouting]`). Each take was generated
once with character timestamps. process.py cuts a line from its first character's start to its last character's end;
for the four takes whose timestamps weren't saved it cuts at the take's N−1 longest silences, which the long pauses
make reliable. Clips are loudness-normalised, 64 kbps mono, named by `js/voicekey.js` (speaker + a hash of the exact
words), so changing a line falls back to silence until it is regenerated.

| Speaker | Voice | | Speaker | Voice |
|---|---|---|---|---|
| Narrator | River | | Borin | Charlie |
| Lyra | Lily | | Marta | Aria |
| Orin | Daniel | | Aldric | Eric |
| Sera | Laura | | Sylvara | Matilda |
| Thane | Callum | | Scholar Aneth | Alice |
| Elder Varec | George | | Korvas | Brian |
| Farmer Holt | Bill | | Vaelthas | Roger |

## Music (9 themes, Music v2.5, instrumental)

Prompts in [music.json](music.json): title (70 s), village, forest, grove, ruins, sanctum, battle (60 s each), boss
(75 s), ending (80 s). Encoded 80 kbps stereo with a short fade in and a 3 s fade out at the loop seam.

## Effects (20, ElevenLabs Sound Effects v2)

slash, hit, fire, ice, heal, shadow, arrow, shield, encounter, victory, defeat, levelup, chest, door, coin, quest,
anchor, seal, ko, step, generated on one ElevenLabs flow, one take each (about 100 credits in all). Silence trimmed,
96 kbps mono.

## Rebuild

```bash
node game-028/dev/audio/voices.mjs            # takes.json
python3 -I game-028/dev/audio/process.py RESULTS_DIR RAW_DIR
```
