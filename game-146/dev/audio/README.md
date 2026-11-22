# JINGLE POP — the audio (ElevenLabs)

The music, effects and voices in `../../audio/` were generated with ElevenLabs on 2026-11-22 (flow "JINGLE POP game
audio"), one take each, and processed by `process.py` (needs ffmpeg):

```bash
python3 -I game-146/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3, vo-*.mp3 as downloaded
```

It normalises loudness, trims silence, fades the loop seam of each music track, cuts each voice take into its lines at
the longest pauses (ffmpeg `silencedetect`; the lengths were checked against the text, longest line ↔ longest clip),
and encodes music at 80 kbps stereo, effects at 96 kbps mono and voices at 64 kbps mono: 47 files, 3.5 MB.
Spend: about 6,600 credits (music ~3,800, voices ~1,600, effects ~90).

`js/audio.js` decodes effects and voices into AudioBuffers, plays music through `<audio>` elements routed into a gain
node (so `lib/page-audio.js` still silences a hidden tab) with a crossfade between themes, and falls back to a Web Audio
synth (blips, chimes and a jingly sequencer) for anything that fails to load. Voices have their own volume slider and
never overlap: one line at a time, with a gap and a chance per trigger so play doesn't turn into chatter.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays | Prompt (abridged) |
|---|---|---|---|
| `music-title` | 60 s | title, story, ending | Cozy, magical Christmas orchestral title theme: celesta and glockenspiel melody, pizzicato strings, warm French horn, gentle sleigh bells, light swing. |
| `music-play1` | 60 s | chapters 1–3 | Bouncy, playful puzzle music: jingle bells, glockenspiel and xylophone, pizzicato strings, bassoon and tuba bass, brushed snare, toy-workshop feel, 118 bpm. |
| `music-play2` | 60 s | chapters 4–6 | Twinkling, slightly mysterious winter music: celesta and harp arpeggios, sleigh bells, warm string pad, upright bass, 108 bpm. |
| `music-endless` | 60 s | the Blizzard | Upbeat Christmas rock-and-roll: boogie-woogie piano, jingle bells on every beat, walking bass, brushed swing drums, saxophone stabs, 150 bpm. |
| `music-win` | 7 s | a level won | Sleigh bells, glockenspiel run, bright brass, a big warm chord and a chime. |
| `music-lose` | 5 s | a level lost | Slow descending celesta, a muted trombone wah-wah, one sleigh bell shake. |

## Effects (`eleven_text_to_sound_v2`, duration set per effect)

`sfx-pop` (a glass bauble popping with a chime; pitched up with the streak), `sfx-shoot` (slingshot thwip with a
jingle), `sfx-stick` (a bauble clinking into place; also the wall bounce, pitched up), `sfx-drop` (ornaments tumbling
with bells), `sfx-bell` (golden bells and the Jingle Bell), `sfx-boom` (the pudding bomb's festive poof), `sfx-ice`
(thawing), `sfx-gift` (paper rip, ribbon pop, sparkle), `sfx-tinsel`, `sfx-cocoa`, `sfx-lower` (snow sliding, a thud:
the ceiling comes down), `sfx-powerup`, `sfx-star`, `sfx-candy`, `sfx-coal`, `sfx-wind` (a 10 s loop, generated but not
used in v1.0.0).

## Voices (`eleven_v4`, audio tags for delivery)

One take per character with every line separated by `[long pause]`.

| Character | Voice | Lines |
|---|---|---|
| Juniper (Juni) | Ayla – Bubbly, Cute & Expressive | In play: "Here we go!" · "Ornaments reclaimed!" · "Oh, tinsel-sticks..." · "Jingle-tastic!" · "Timber!" · "Ooh, a present!" · "Watch this!" · "Almost there!" · "Careful, Juni... careful..." · "Wow! Look at 'em all!" · "Three stars! Mrs. Claus is gonna love this!" · "Bring on the blizzard!" Story: "Leave it to me, Mrs. Claus!..." · "Grimwick... you just wanted a tree of your own, didn't you?" · "Every last ornament, home where it belongs. Merry Christmas!" |
| Grimwick | Chuck – Goblin | One taunt per chapter (`grim-1` … `grim-6`), "...Maybe. Just a little one." (`grim-7`), the Blizzard's dare (`grim-8`). |
| Mrs. Holly Claus | Nan – Warm Vintage Storyteller | The opening request (`holly-intro`) and "Then he shall have one. Merry Christmas, everyone!" (`holly-end`). |

The story text is `STORY` in `js/sim/data/levels.js`; each line's `vo` names its clip.

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` with signed links that expire after a few hours; download
everything as soon as a run finishes.
