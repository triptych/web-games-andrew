# One Shot — music, sound and voices (ElevenLabs)

Every sound in `../../audio/` was generated on 2026-11-27 with **ElevenLabs** (flow "One Shot — game art & audio")
and encoded by [process.py](process.py) (ffmpeg):

```bash
python3 -I game-151/dev/audio/process.py RAW game-151/audio
```

Music: 80 kbps stereo with a short fade at the loop seam. Effects: silence trimmed, 96 kbps mono. Voices: one take
per character with the lines separated by `[long pause]`, cut at hand-placed times (`CUTS`, the middle of each pause,
read off ElevenLabs' free word-timed transcript of the take: silence detection alone found 11 and 22 pauses for 8 and
11 cuts, because lines like "One mothership, one shot." have pauses inside them), 64 kbps mono. 2.5 MB in all. A Web
Audio synth stands in for any effect that fails to load.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Prompt (short) | Plays |
|---|---:|---|---|
| `music-title` | 45 s | 90s anime space-opera opening: heroic guitar lead, synth-rock, brass stabs, analog strings, slap bass, 140 BPM | title and hangar |
| `music-battle` | 60 s | 90s anime space battle: urgent arpeggiated synths, gritty guitar riff, slap bass, orchestra hits, 160 BPM | the rounds |
| `music-lance` | 40 s | the final charge: taiko, pulsing synth bass, rising synth choir, swelling brass, 150 BPM | the final window |
| `jingle-win` | 8 s | brass and guitar victory flourish | a destroyed mothership |
| `jingle-fail` | 7 s | falling synth strings, low brass, a piano note | a mothership that survived |

## Effects (`eleven_text_to_sound_v2`, 2–15 credits each)

`match` (crystal chime, pitched up with the cascade) · `blast` (line special) · `nova` · `volley-a`, `volley-b` (one
per burst of missiles, alternating: heavy plasma-cannon bolts and a missile salvo) · `impact` (a hit on an escort) ·
`kill` (an escort blown apart) · `enemyshot` · `block` (the deflector) · `hit` (the hull) · `alarm` (low hull) · `charge` (the Lance
charging) · `beam` (the Lance) · `shatter` (a barrier breaks) · `bigboom` (a mothership dies) · `route` (also a
purchase) · `jam` (static) · `shift` (the barrier retunes).

## Voices (`eleven_v4`, one take per character)

| Character | Voice | Lines |
|---|---|---|
| Juno Arakawa | Kira X (bold, cinematic video-game heroine) | intro, throne, launch, fire ("Lance, full power! One... SHOT!"), win, downed, clear, rush, end |
| MIRA | K (gentle, soft, elegant) | intro, the six briefings, fail, hull, shift, exposed, end |

**v1.0.1:** the first cut had a thin `missile` hiss per missile and a non-lethal hit played as `hit` pitched up 1.6×;
the player heard slaps. The four new effects cost about 14 credits; `js/audio.js` adds a synth sub-bass `thump` under
each. Effects are raised to about -15 dB mean (peaks under -1 dB) and voice lines to -15 LUFS by `process.py`; MIRA's
take came back at -33 LUFS against about -12 for the music. While a line plays the music ducks to 30% and the effects
to 60% (`duck` in `js/audio.js`, on gain nodes of their own after the volume buses).

Comms play the matching line as their text appears (`ui.say` in `js/ui.js`), one voice at a time.

**Spend:** music about 2,390 credits, effects about 80, voices about 1,460 (the transcripts were free).
