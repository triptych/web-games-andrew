# NEBULA REQUIEM — the audio (ElevenLabs)

The music, sound effects and voices in `../../audio/` were generated with ElevenLabs on 2026-11-21 (flow "NEBULA
REQUIEM game audio"), one take each, and processed by `process.py` (needs ffmpeg):

```bash
node game-144/dev/audio/voices.mjs > /tmp/takes.json
python3 -I game-144/dev/audio/process.py RAW /tmp/takes.json     # RAW holds music-*.mp3, sfx-*.mp3, vo-*.mp3
```

It normalises loudness, fades the loop seam of each music track, trims and caps the effects (a "half second" warp came
back 3 s long), and cuts each voice take into its lines at its N−1 longest pauses, printing each clip's speech rate so a
bad cut stands out (all 74 came out between 7 and 16 characters a second). Music is 80 kbps stereo, effects 96 kbps
mono, voices 64 kbps mono: 9.4 MB in all. Spend was about 25 000 credits (music ~10 000, voices ~6 500, effects ~300).

The game (`js/audio.js`) plays music through `<audio>` elements routed into a gain node (so `lib/page-audio.js` still
mutes a hidden tab) with a crossfade between tracks, ducks the music under voices, decodes effects and voices into
AudioBuffers, and synthesises the guns, grazes, stars and UI blips itself (a sampled gun at 14 shots a second just
roars). Anything that fails to load falls back to the synth.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays |
|---|---|---|
| `title` | 60 s | title screen and pilot select |
| `stage1` | 90 s | Saturn's Grave, Veil of Glass |
| `stage2` | 90 s | Cathedral Ark, Iron Halo Foundry |
| `stage3` | 90 s | Leviathan Deep, Requiem Heart |
| `boss` | 60 s | bosses 1–5 |
| `final` | 75 s | Seraphine Null |
| `endless` | 90 s | survival |
| `ending` | 60 s | each pilot's ending and the results |

Prompts are in the flow; in short: an anime space-opera opening theme; a fast heroic breakbeat shmup track; dark
industrial techno with pipe organ; an eerie choir over trance drums; frantic boss music; a choral requiem with organ;
relentless drum and bass; a tender piano-and-strings ending.

## Effects (`eleven_text_to_sound_v2`)

`explode-s`, `explode-l`, `boss-die` (layered with more `explode-l` in the game, since it came back 1 s long), `bomb`,
`warp`, `powerup`, `shield`, `death`, `warning`, `laser` (when a beam appears), `rocket`, `burst`, `extend`, `roar`
(the Wyrm, the Mother and Seraphine arriving), `engine` (an engine destroyed), `capital` (a capital ship looming),
`synergy`.

## Voices (`eleven_v4`, audio tags for delivery)

One take per character holds all their lines separated by `[long pause]`; `voices.mjs` builds the takes from
`js/sim/data/story.js` and adds a delivery tag to each line (`DELIVERY` for the ones that differ from the character's
usual). Each clip is named by the line's voice id.

| Character | Voice | Lines |
|---|---|---|
| Sora Amane | Kira X – Video Game, Bold & Cinematic | 13 |
| Kaito Ren | Jordan – Warm & Gritty | 14 |
| Lyra-07 | K | 14 |
| Cmdr. Mei Tachibana | Andrea – British female character voice | 16 |
| Seraphine Null | Kristen – Cold Evil Queen Villain | 8 |
| Adm. Gideon Voss | Lord Alistair – British Aristocrat | 4 |
| Hikari Amane | Libby-Animated | 3 |
| SERAPH OS (ship computer) | Georgia K | 2 |

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` with links that expire in a few hours; everything was
downloaded as soon as its run finished.
