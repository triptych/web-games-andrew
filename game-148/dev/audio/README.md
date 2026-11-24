# Glimmerglade — the audio (ElevenLabs)

Music, effects, ambience and voices in `../../audio/` were generated with ElevenLabs on 2026-11-24 (flow
"Glimmerglade game audio"), one take each, and processed by `process.py` (needs ffmpeg):

```bash
python3 -I game-148/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3, vo-lumi.mp3, vo-willow.mp3
```

It normalises loudness, trims silence, fades each music track's loop seam, cuts each voice take into its lines at
its n−1 longest pauses (ffmpeg `silencedetect`; checked by line length against the text) and encodes music at
80 kbps stereo, effects at 96 kbps mono, voices at 64 kbps mono: 44 files, 3.5 MB. Spend: about 9,100 credits
(music ~3,700, voices ~2,000, effects ~110).

`js/audio.js` decodes effects and voices into AudioBuffers, plays music through `<audio>` elements routed into a
gain node (so `lib/page-audio.js` still silences a hidden tab) with crossfades, loops the ambience under the music,
and falls back to a Web Audio synth (chimes and a maj7 celesta arpeggio) for anything that fails to load. Voices
have their own slider, never overlap, wait five seconds between lines and say each line at most once a level; every
line is captioned.

## Music (`eleven_music_v2_5`, instrumental, 60 s)

| File | Plays | Prompt (abridged) |
|---|---|---|
| `music-title` | title, map | Ethereal fairy-tale title theme: celesta and harp over a shimmering string pad, airy flute, wind chimes and music box, 76 bpm. |
| `music-meadow` | chapters 1–2 | Light, playful, cozy: plucked harp, pizzicato, glockenspiel, wooden flute, shaker, 96 bpm. |
| `music-moon` | chapters 3–4 | Dreamy moonlit: celesta and music-box arpeggios, felt piano, airy pad, harp, 84 bpm. |
| `music-star` | chapter 5, daily, dreams | Uplifting and shimmering: harp, celesta, airy strings, flute, frame drum, 100 bpm. |
| `music-win` | a level won (7 s) | Harp glissando, sparkling chimes, a warm strings-and-flute chord that blooms. |

## Effects (`eleven_text_to_sound_v2`)

`sfx-lift` (a wisp lifts), `sfx-pour` (fairy-wing whoosh and a glass bell), `sfx-drop` (a crystal plink, pitched per
colour), `sfx-bloom` (a harp glissando and unfurling petals), `sfx-creature` (a baby creature's happy chirp, pitched
per creature), `sfx-reveal` (mist clearing), `sfx-unlock` (brambles untangling), `sfx-nope`, `sfx-undo` (a reversed
shimmer; also restart, slower), `sfx-sprout`, `sfx-hint` (a firefly), `sfx-star`, `sfx-tap`, and `sfx-ambience`
(20 s dawn forest loop: distant birdsong, breeze, faint chimes).

## Voices (`eleven_v4`, audio tags for delivery)

One take per character with every line separated by `[long pause]`.

| Character | Voice | Lines |
|---|---|---|
| Lumi | Libby – Animated (a youthful fairy soprano) | `lumi-start` "Here we go, little lights!" · `bloom` "Bloom!" · `hello` "Oh, hello, little one!" · `pretty` "Ooh, so pretty!" · `think` "Hmm… let me think." · `oops` "Oops! Let's try that another way." · `hint` "Follow the firefly…" · `almost` "Almost there!" · `win` "The glade is glowing!" · `stars` "Three stars! Sparkle-tastic!" · `sprout` "A fresh sprout, just for us!" · `mist` "The mist is lifting!" · `unlock` "The brambles let go!" · `daily` "Today's dewdrop puzzle!" · `stuck` "Uh-oh… no more moves. Shall we undo?" · `promise` "Leave it to me, Grandmother Willow…" · `end` "We did it! Goodnight, glade…" · `wow` "Look at them all!" |
| Grandmother Willow | Nan – Warm Vintage Storyteller | `willow-1` … `willow-5` (the chapter intros in `CHAPTERS`), `willow-end`, `willow-hello` ("Good morning, little light.", unused in v1.0.0) |

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` with signed links that expire after a few hours;
download everything as soon as a run finishes.
