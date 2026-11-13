# Hard Hat Harbor — the sound (ElevenLabs)

`../../audio/` (51 clips, 3.4 MB) was made on 2026-11-13 with [ElevenLabs](https://elevenlabs.io) on one flow ("Hard Hat Harbor (game-135) audio") and encoded by `process.py`. `js/audio-files.js` lists the clips, so the game never requests one that isn't there; anything missing falls back to a Web Audio blip.

```bash
node game-135/dev/audio/takes.mjs                  # the voice script: one take per character, lines joined by [long pause]
python3 -I game-135/dev/audio/process.py RAW       # RAW holds music-*.mp3, sfx-*.mp3 and take-<giver>.mp3
```

| Kind | Model | Files | Cost |
|---|---|---|---|
| Music | `eleven_music_v2_5`, instrumental, 45 s and 2 × 60 s | `music-title`, `music-work1`, `music-work2` (80 kbps stereo, faded at the seam) | 675 + 900 + 900 credits |
| Effects | `eleven_text_to_sound_v2`, prompts in `sfx.json` | 18 × `sfx-*` (96 kbps mono, silence trimmed, at most 2.5 s; the engine is a 4 s loop) | 17 credits each |
| Voices | `eleven_v4`, one take per character | 30 × `vo-*` (64 kbps mono, loudness-normalised) | 3,144 credits |

**Music prompts** ask for "1990s children's CD-ROM game music" with a General MIDI band: marimba, clarinet and tuba for the title; honky-tonk piano, banjo and whistling for work tune one; xylophone, wah clavinet and muted trumpet for work tune two. The two work tunes take turns.

## The cast

| Character | Voice | Lines |
|---|---|---|
| Mayor Maple | Dolly - Southern Hospitality | welcome, three briefs, three thank-yous, the finale |
| Officer Dot | Ayla - Bubbly, Cute & Expressive | rockslide brief and thank-you |
| Ms. Finch | Elowen - Elf | school and playground |
| Farmer Gus | Chad | the farm lane |
| Foreman Rosa | Emma - Wry, Gritty Hero | cannery and homes, and the eight vehicle call-outs ("Bulldozer!") |
| Pip | Sheldon - Quirky, Clever, Enthusiastic | the park |

Each take is the character's lines in order with a delivery tag (`[warmly]`, `[excited]`, …) and `[long pause]` between them; `process.py` cuts at the longest pauses. All six takes split into the right number of clips with lengths that match their lines (the eight one-second call-outs included).

## Notes

- One music generation failed ("unexpected error, please try again") and was run again once; the rest ran first time.
- "About 1 second" is a hint: the digging scrape came back 14 s long. `process.py` trims every effect to 2.5 s.
- In the game the voice ducks the music; effects are rate-limited per clip; the engine loop's pitch and level follow the speed.
- Nobody has listened to these. The browser test checks that clips decode, that a voice line plays when someone talks, that music is playing and that the master bus carries sound.
