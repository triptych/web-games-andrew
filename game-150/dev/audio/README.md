# Folio & Fable — the audio (ElevenLabs)

Music, effects, ambience and voices in `../../audio/` were generated with ElevenLabs on 2026-11-26 (flow
"Folio & Fable game audio"), one take each, and processed by `process.py` (needs ffmpeg):

```bash
python3 -I game-150/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3, vo-vellum-story.mp3, vo-vellum-barks.mp3, vo-tam.mp3
```

It normalises loudness, trims silence, fades each music loop's seam, cuts each voice take into its lines at its n−1
longest pauses (ffmpeg `silencedetect`; the line lengths were checked against the text) and encodes music at 80 kbps
stereo, effects at 96 kbps mono and voices at 64 kbps mono: 52 files, 3.9 MB. Spend: about 6,500 credits (music
2,820, voices 3,540, effects 140).

`js/audio.js` decodes effects and voices into AudioBuffers, plays music through `<audio>` elements routed into a gain
node (so `lib/page-audio.js` still silences a hidden tab) with crossfades, loops the rain-and-fire ambience under the
music, and falls back to a Web Audio music-box waltz and synth chimes for anything that fails to load. Voices have
their own slider and never overlap; the remarks wait seven seconds between lines; every line is captioned.

## Music (`eleven_music_v2_5`, instrumental)

| File | Plays | Prompt (abridged) |
|---|---|---|
| `music-title` (60 s) | title, ending | Wistful storybook theme: celesta and felt piano, a hopeful clarinet and pizzicato melody, cello pad, music box, harp. 78 bpm. |
| `music-shop` (60 s) | morning and the open shop | Bouncy plucked guitar and mandolin, bassoon and flute, pizzicato, brushed shaker, glockenspiel. 100 bpm. |
| `music-evening` (60 s) | evenings | Felt piano and nylon guitar, cello, harp arpeggios, a slow oboe lullaby, fireside warmth. 66 bpm. |
| `music-chapter` (8 s) | a chapter done | Harp glissando, celesta and chimes, a warm swelling chord on strings and horn. |

Estimate music before running it: the default is four takes (an estimate of 20,680 credits for these four); one take
each cost 2,820.

## Effects (`eleven_text_to_sound_v2`)

`sfx-bell` (shop door bell; a customer comes in), `sfx-coins` (a sale), `sfx-page` (sheets, reading), `sfx-shelve` (a
book onto a shelf), `sfx-furniture` (placing furniture), `sfx-craft` (hammer taps, a press, a magical chime),
`sfx-magic`, `sfx-return` (adventurers home: a small horn and a lute), `sfx-trader` (a caravan with bells),
`sfx-inspire` (a cheering crowd and a chime), `sfx-cat` (purr and meow), `sfx-tap`, `sfx-talk` (pages riffling like a
giggle), `sfx-nope`, `sfx-close` (the door and the lock at closing), `sfx-ambience` (20 s loop: rain on the windows, a
fire, a clock).

## Voices (`eleven_v4`, audio tags for delivery)

| Character | Voice | Lines |
|---|---|---|
| Old Vellum | Eldrin – Wise Ancient Wizard Storyteller (British) | `vellum-prologue`; `vellum-ch1-intro` … `vellum-ch7-done` (each chapter's introduction and ending, the text in `CHAPTERS` in `js/sim/data.js`); remarks `vellum-customer`, `-sale`, `-sendoff`, `-welcome`, `-trader`, `-wow`, `-goodnight`, `-wish` |
| Tam | Emmaline – young British girl | `tam-welcome`, `-justthebook`, `-thanks`, `-newbook`, `-wedidit`, `-open`, `-talking`, `-promise`, `-forme` |

Three takes: Vellum's story (15 lines, 177 s), Vellum's remarks (8) and Tam's (9), each with `[long pause]` between
lines. The texts are in `LINES` in `js/audio.js` and in `CHAPTERS`.

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` with signed links that expire after a few hours; download
everything as soon as a run finishes.
