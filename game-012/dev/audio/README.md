# Arcana Pull — the audio (ElevenLabs)

Everything in `../../audio/` was generated with ElevenLabs on 2026-11-18 (flow "Arcana Pull game audio (game-012 v2)"), one take each,
and encoded by `process.py` (needs ffmpeg):

```bash
node game-012/dev/audio/voices.mjs                       # writes voices.json: the takes, built from js/sim/data/lines.js
python3 -I game-012/dev/audio/process.py RAW              # RAW holds music-*.mp3, sfx-*.mp3, take-*.mp3 as downloaded
```

It normalises loudness, trims silence, fades each theme's loop seam, cuts each voice take into its lines, and encodes music at 80 kbps
stereo, effects at 96 kbps mono and voices at 64 kbps mono: 51 files, 3.9 MB. Spend: 3,600 credits of music (900 a theme), 400 of
effects (17 each) and 2,218 of speech (1 a character for both voices).

The game (`js/audio.js`) decodes effects and voices into AudioBuffers, plays music through `<audio>` elements routed into a gain node
(so `lib/page-audio.js` still mutes a hidden tab) with a crossfade between themes, ducks the music under a voice, and falls back to a
small Web Audio synth for any effect that fails to load. Every spoken line is also shown as a subtitle.

## Music (`eleven_music_v2_5`, 60 s, "No vocals" in each prompt)

| File | Plays | Prompt (abridged) |
|---|---|---|
| `music-parlour` | title, the parlour, the Well | (v2.0.2 retake) Mysterious, intimate dark-fantasy chamber music for a fortune-teller's candlelit parlour: harp arpeggios, soft celesta, cello drone, glass harmonica, string pad; D minor, 76 BPM; no percussion, no clicks or ticking |
| `music-battle` | Thresholds 1–9 | A dark-fantasy card duel: frame drums and taiko, staccato strings, harpsichord riff, brass stabs, wordless choir; D minor, 120 BPM |
| `music-boss` | The World | A cosmic final battle: timpani, pipe organ, huge wordless choir, soaring strings, celestial bells; D minor, 132 BPM |
| `music-reading` | Readings, the ending, the last candle | A tarot reading by candlelight that blooms into hope: harp, glass harmonica, airy choir pad, solo violin; F major, 66 BPM |

**The tick (v2.0.1).** The takes came back with a short broadband tick above 4 kHz on every beat of `music-parlour` (one every
0.79 s, 76 BPM) and scattered ones in `music-reading` and `music-battle`, heard in play as a clicking under the parlour. The music
itself is dark (99.9% of its energy under 1.3 kHz for the parlour, 6.2 kHz at most), so `process.py` low-passes each theme
(parlour 4 kHz, reading 5 kHz, battle 7 kHz, boss 8 kHz; three 2-pole filters, 36 dB/octave). The shipped files were filtered in
place from the 2.0.0 encodes (the raw downloads aren't kept): the parlour's ticks fell from −13 dB to −33 dB against a typical frame.

**The parlour retake (v2.0.2).** Filtered at 4 kHz the parlour sounded muffled, so it was regenerated (flow "Arcana Pull:
music-parlour (v2.0.1 retake)", 2026-11-20, four takes at 900 credits each) with the hand drum and music box left out and "no
percussion, no drums, no clicks or ticking" in the prompt. Take 1 was kept: one high-frequency event and no sharp transients in 60 s
(the old track had 53 and 22), and brighter (99.9% rolloff 2.6 kHz). It is encoded by `process.py` with no low-pass.

## Effects (`eleven_text_to_sound_v2`)

The prompts are `sfx.json` (24): `pull` (the Well swirls), `flip`, `reveal` / `rare` / `legend` (by rarity), `star` (a star up, a
buff), `click`, `deny`, `hit`, `crit`, `spell` (a skill cast), `heal`, `shield`, `burn`, `stun`, `curse` (a debuff, a reversed
omen), `die` (a card shatters), `rise` (a revival, an upright omen), `victory`, `defeat`, `dust` (stardust), `omen` (a Reading's gong),
`phase` (The World changes), `whoosh` (a lunge, a dodge).

## Voices (`eleven_v4`, audio tags for delivery)

| Speaker | Voice | Tag | Lines |
|---|---|---|---|
| The Oracle | Andrea – British female character voice | `[mysterious, warm]` | the welcome, ten Threshold intros, the Reading, upright, reversed, a Legendary drawn, a win, a loss, the last candle, the ending, Ascension (20) |
| The World | Final Boss – Evil All Powerful Villain | `[cold, vast, menacing]` | at the start of its battle, its first phase, its fall (3) |

The lines are `ORACLE` and `WORLD` in `js/sim/data/lines.js`; the Oracle's 20 were recorded as two takes of ten to keep each call short.

**Splitting takes by text, not just by silence.** game-139 cut each take at its n−1 longest pauses. That worked for the first Oracle
take (line breaks 0.83–1.16 s, pauses inside lines ≤ 0.62 s) but not the second, whose line breaks (0.65–0.85 s) were no longer than
some pauses inside a line: "The World Entire…" came out at 1.5 s and "Again, then…" at 10.7 s. `align()` in `process.py` now chooses the
cuts by dynamic programming over every silence of at least 0.33 s, matching each segment's length to its line's share of the text and
favouring longer silences. Both takes split right; the clip lengths follow the line lengths (checked by duration, not by ear).

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` (signed links that expire in a few hours: download as soon as a run
finishes). Generation goes through the MCP connector.
