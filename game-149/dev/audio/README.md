# Echoheart Academy — the sound (ElevenLabs)

Made on 2026-11-25 on one ElevenLabs flow ("Echoheart Academy (game-149) audio"), about 7,700 credits in all.
`process.py RAW_DIR` turns the downloads into `audio/` (needs ffmpeg).

## Music (`eleven_music_v2_5`, 60 s, instrumental; 900 credits each) → `audio/music/*.mp3`, 80 kbps

| Theme | Where | Prompt (short) |
|---|---|---|
| title | title, epilogue | uplifting anime opening: piano arpeggios, strings, glockenspiel, pop-rock drums, 140 BPM |
| academy | school days, mini-games | slice-of-life: pizzicato, flute, ukulele, celesta, brushed drums, 110 BPM |
| mystery | evenings, investigations | harp, bassoon, music box, ticking clock; playful suspense, 90 BPM |
| battle | battles | JRPG battle: rock drums, slap bass, guitar, strings, brass, synth bells, 160 BPM |
| climax | the Hollow Moon | racing strings, a ticking motif, taiko, wordless choir, brave brass, 150 BPM |
| tender | heart events, the dance, nights | piano and strings, music box, harp, 75 BPM |

## Effects (`eleven_text_to_sound_v2`, ~17 credits each) → `audio/sfx/*.mp3`, trimmed, 96 kbps mono

echo (a tuning fork that echoes back), fire, star, water, wind, hit, heal, hollow (a reversed drain), levelup,
victory, charm, quest, bell (the clocktower at midnight), cheer, whoosh, shatter (a crystal cage).

## Voices (`eleven_v4`, one take per character, lines separated by `[long pause]`) → `audio/vo/<who>-<key>.mp3`, 64 kbps mono

The lines and their keys are in [lines.json](lines.json). `process.py` cuts each take at the middles of its
(lines − 1) longest pauses (ffmpeg `silencedetect`); every take split cleanly first time.

| Character | Voice | Lines |
|---|---|---|
| Kai | Kai – Energetic Anime Hero | 8 |
| Hana | Kira X – Video Game, Bold & Cinematic | 7 |
| Lys | Libby-Animated | 7 |
| Pip | Ayla – Bubbly, Cute & Expressive | 7 |
| Ren | Jordan – Warm & Gritty | 7 |
| Principal Veymont (and his Hollow form) | Matthew Schmitz – Ancient Sage Dragon Wizard | 7 |
| Professor Graves | Andrea – British female character voice | 4 |
| Mochi | Peanut – Tiny & Peppy | 3 |

In the game (`js/audio.js`): music plays through `<audio>` elements routed into a gain node (so `lib/page-audio.js`
silences a hidden tab) and crossfades on theme changes; effects and voices are decoded into AudioBuffers; one voice
line plays at a time; battle barks only play when nobody else is talking and only sometimes; anything that fails to
load falls back to a Web Audio synth tone. Sound, music and voices have their own volume sliders.
