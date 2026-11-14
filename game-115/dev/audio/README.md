# Hearthwick — the audio (ElevenLabs)

The music, ambience and effects in `../../audio/` were generated with ElevenLabs on 2026-11-14 (flow "Hearthwick game audio"),
one take each, and processed by `process.py` (needs ffmpeg and numpy):

```bash
python3 -I game-115/dev/audio/process.py RAW     # RAW holds music-*.mp3, amb-*.mp3, sfx-*.mp3, ui-*.mp3 as downloaded
```

Music and ambience are made to loop by crossfading the last few seconds into the first (equal power) and dropping the head;
effects are trimmed of silence at both ends, capped and faded out. Everything is loudness-normalised. Music 96 kbps stereo,
ambience 64 kbps mono, effects 64–80 kbps mono: 33 files, 3.5 MB. Spend was about 4,200 credits (music 3,820, ambience 200,
effects 130); the estimate before the run said 7,700.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays | Prompt (abridged) |
|---|---|---|---|
| `music-day` | 86 s | 05:00–21:00, and behind the title | cozy village day theme, 88 bpm, F major: music box melody, fingerpicked guitar, pizzicato, wooden flute |
| `music-night` | 86 s | 21:00–05:00 | night lullaby, 62 bpm: music box and harp over low strings, felt piano, celesta, no drums |
| `music-festival` | 71 s | festival days (the last day of each season), by day | harvest festival jig, 116 bpm, D major: fiddle, accordion, tin whistle, mandolin, tambourine, claps |

Each track is an `<audio>` element routed into the music bus (so `../lib/page-audio.js` still pauses it in a hidden tab); the
wanted one fades in, the others fade out and pause after five seconds of silence. If a track fails to load, the generated
music-box tune of v1.0.0 plays instead.

## Ambience (`eleven_text_to_sound_v2`, `loop: true`, 20 s, kept 18 s)

`amb-day` (songbirds and a breeze), `amb-night` (crickets, a frog), `amb-rain` (rain on thatch). Decoded into looping buffers and
faded by the time of day and the weather. Any that fails falls back to the synthesised chirps, ticks and filtered-noise rain.

## Effects (`eleven_text_to_sound_v2`, `duration_seconds` set on each)

| File | Plays on |
|---|---|
| `sfx-chop`, `sfx-pick`, `sfx-forage` | tapping a tree, a boulder or a plant (pitch varied ±6%) |
| `sfx-treefall` | a tree comes down |
| `sfx-place`, `sfx-built` | placing a building; one finishing or upgrading |
| `sfx-claim`, `sfx-journal` | claiming a journal reward; an entry becoming ready |
| `sfx-coin`, `sfx-craft` | a sale; a crafted item (both rate-limited so a busy town patters) |
| `sfx-hire`, `sfx-newcomer`, `sfx-levelup` | a hero hired or a villager welcomed; someone at the gate; a level up |
| `sfx-queststart`, `sfx-questwin`, `sfx-questpart`, `sfx-questfail` | a party sets off; comes home with all, half or none of the loot |
| `sfx-raidwarn`, `sfx-raidwin`, `sfx-raidlose` | raiders sighted at dusk; the town holds; the town is raided |
| `sfx-research`, `sfx-festival`, `sfx-merchant` | an upgrade researched; a festival or the ending; the merchant's wagon |
| `ui-click`, `ui-open`, `ui-close`, `ui-no` | buttons, panels, and "can't do that" |

A clip that is missing or fails to decode plays the original synthesised sound for that event.

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com`; the signed links expire after a few hours, so download as soon as a run
finishes. The music node's duration and "instrumental" can only be set on a flow node (`creative_add_flow_node` with
`model_parameters`, then `creative_run_flow_nodes` with `generations_count: 1`).
