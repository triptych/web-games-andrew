# UFOops! — the audio (ElevenLabs)

The music, effects and voices in `../../audio/` were generated with ElevenLabs on 2026-11-13 (flow "UFOops! game audio"), one
take each, and processed by `process.py` (needs ffmpeg):

```bash
python3 -I game-134/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3, vo-*.mp3 as downloaded
```

It loudness-normalises everything, fades the loop seam of each music track, trims the effects, cuts each voice take into its
lines and writes `js/voicelines.js` (the exact on-screen text of each line → its file). Music 80 kbps stereo, effects 96 kbps mono,
voices 64 kbps mono: 78 files, 3.8 MB. Spend was about 6,500 credits (music 3,000, voices 3,200, effects 110).

The game (`js/audio.js`) decodes effects and voices into AudioBuffers and plays the music through `<audio>` elements routed into a
gain node (so `lib/page-audio.js` still silences a hidden tab), crossfading between themes. Anything that fails to load falls back
to the Web Audio synth. One voice at a time: Mother interrupts Zib and the General; they wait for her.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays | Prompt (abridged) |
|---|---|---|---|
| `theme` | 60 s | title, episode cards, the end | 80s Saturday-morning cartoon theme: slap bass, synth brass fanfare, funky guitar stabs, gated drums, 120 bpm |
| `play` | 60 s | episodes 1–7 | frantic comedic chase: synth bass ostinato, staccato brass, xylophone and slide whistle, 150 bpm |
| `boss` | 60 s | the finale | villain battle for a pompous general's tank: marching snare, oompah tuba, minor-key brass, 160 bpm |
| `report` | 20 s | the report card | jazzy game-show vamp: electric piano, muted trumpet, brushed drums |

## Effects (`eleven_text_to_sound_v2`)

`moo`, `cluck`, `oink`, `baa`, `yelp` (beamed walkers, pitch varied ±8%), `beam` (a seamless 3 s loop, pitched up for the Mega
Beam), `catch`, `bank`, `bonk`, `boom` (wrecks and boss hits), `shotgun`, `net`, `flash`, `charge` (laser wind-up), `laser`, `jet`,
`hit`, `crash`, `honk`, `hiccup`, `sputter` (the three glitches), `pickup`, `overheat`, `drop`, `stamp` (the report card's grade),
`fanfare`, `sad`. Menu blips, the jet warning, nets catching you and tank shells stay synthesised.

## Voices (`eleven_v4`, audio tags for delivery)

| Character | Voice | Lines |
|---|---|---|
| Mother | Dusty Garner (a sarcastic, sweet-ish Southern firecracker) | the eight briefings, the thirteen report-card verdicts, thirteen radio calls (quota, hurry, crash, hold full, banking, the boss) |
| Zib | Chuck – Goblin | "Gotcha!", "Wheee!", "Ow ow ow!", "Uh-ohhhh!", "Bombs away!", "Not again!", "Coming home, Mom!", "I'm okay!" |
| General Grumbles | Grampa Werthers – Old & Cranky | "Blast that saucer!", "Hold still, you flying hubcap!", "Fire at will!", "Not my beautiful tank!", "This isn't over, saucer!" |

The scripts are in `lines.json`; the line ids name the files (`mother-grade-grade-Aplus-1.mp3`).

### Splitting the takes

Each character's lines were read in one take separated by `[long pause]`. Zib's, the General's and Mother's radio take have exactly
one pause per gap, so the longest pauses are the cuts. The briefing and report-card takes also pause *inside* lines ("Good. Not great.
Good.", "Mother believes in you. [dryly] Mostly."), and those pauses are as long as the gaps: neither the longest pauses nor a fit
to the text lengths found the right ones (each moved a cut into a line). Both takes were run through ElevenLabs speech-to-text
(no charge), and the middle of every "[long pause]" its word timings mark is the cut (`CUTS` in `process.py`).

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` and fal from `v3b.fal.media`; both were reachable from the session.
Download as soon as a run finishes: the signed ElevenLabs links expire in a few hours.
