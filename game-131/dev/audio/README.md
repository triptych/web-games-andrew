# Fray & the Spiral Isle — the audio (ElevenLabs)

Everything in `../../audio/` was generated with ElevenLabs on 2026-11-12 (flow "Thimble & the Spiral Isle — game audio";
the goblin was renamed Fray during the session, so the flow and its first voice nodes keep the old name). One take
each. `process.py` (needs ffmpeg and node) turns the originals into the game's files and writes `js/audio-files.js`,
the set of clips the game is allowed to request:

```bash
python3 -I game-131/dev/audio/process.py RAW     # RAW holds music-*.mp3, amb-*.mp3, sfx-*.mp3, vo-<take>.mp3
node game-131/dev/audio/check.mjs                # each cut voice line's length against its text
```

107 files, 10.9 MB. About 20,000 credits: voices cost roughly a credit a character.

| Kind | Model | Files | Notes |
|---|---|---|---|
| Music | `eleven_music_v2_5`, instrumental, 60–75 s | `music-isle`, `-caves`, `-under`, `-sky`, `-sea`, `-warren` | 80 kbps stereo, short fades at the loop seam. The title uses `isle`. |
| Ambience | `eleven_text_to_sound_v2`, 20 s, `loop: true` | `amb-<place>` ×6 | 64 kbps, played as a looping buffer under the music. |
| Effects | `eleven_text_to_sound_v2` | `sfx-step`, `-pickup`, `-item`, `-gem`, `-door`, `-lever`, `-travel`, `-page` | 96 kbps mono, silence trimmed. Chimes, bumps and menu sounds are synthesised. |
| Voices | `eleven_v4` | `vo/<line id>.mp3` ×87 | 64 kbps mono. |

## Voices

| Who | Voice | Lines |
|---|---|---|
| Fray | Tilly the Storyteller – Whimsical, Playful, Childlike | 65: everything in `LINES` and each tunnel's `found` and `used` (takes `fray-1` … `fray-5`) |
| The narrator | Laura – Scottish Children's Storyteller | 13 story cards, and the organ's and Tide Mother's notes (takes `narrator-1` … `narrator-5`) |
| Grandfather Lichen | Mossbeard, The God of the Wild | 2 |
| Elder Grusk | Mister Gruff | 3 |

`takes.mjs` builds the takes from the game's own text (`node takes.mjs fray-1` prints one, ready to paste into a speech
node), with `[long pause]` between lines; `process.py` cuts each take at its longest pauses and names the pieces by
line id. `narrator-5` and `elder-2` are the seven lines that name Fray, recorded again after she was renamed; takes
are processed in name order, so they replace the lines cut from the earlier takes. `flow.json` has the node ids.

The cuts were checked by clip length against the text (6 to 26 characters a second), not by ear. If a line starts with
the tail of the one before it, adjust the `silencedetect` threshold in `process.py`.

## In the game

`js/audio.js` plays music through `<audio>` elements routed into a gain node (so `lib/page-audio.js` still silences a
hidden tab) with a slow crossfade between places, and decodes ambience, effects and voices into buffers on demand.
One voice at a time; a new line replaces the old; music ducks under speech. Voices have their own volume slider.
Anything missing falls back: a place without a track borrows a neighbour's or gets a soft sine pad, missing ambience
is filtered noise, missing effects are small synth sounds.

## Networking

Results are served from `elevenlabsusercontent.com`; the links are signed and expire in a few hours, so download each
take as soon as it completes.
