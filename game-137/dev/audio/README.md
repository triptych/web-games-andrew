# SHARDFRAME — the sound (ElevenLabs)

`../../audio/` (48 clips, about 3.7 MB) was made on 2026-11-15 with [ElevenLabs](https://elevenlabs.io) on one flow ("SHARDFRAME (game-137) audio") and encoded by `process.py`. `js/media.js` lists the clips, so the game never requests one that isn't there; a missing or undecodable effect falls back to a Web Audio synth, a missing tune or voice to silence.

```bash
python3 -I game-137/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3 and take-*.mp3 as downloaded
```

| Kind | Model | Files | Cost |
|---|---|---|---|
| Music | `eleven_music_v2_5`, instrumental, `duration_seconds` set, prompts in `music.json` | `music-title` (50 s), `music-hangar`, `music-battle1`, `music-battle2`, `music-boss` (60 s each); 80 kbps stereo, 1.5 s fades at the loop seam, −17 LUFS | 750 + 4 × 900 credits |
| Effects | `eleven_text_to_sound_v2`, `duration_seconds` on every node, prompts in `sfx.json` | 26 × `sfx-*`; 96 kbps mono, leading silence trimmed, at most 3.2 s, −16 LUFS | 2–10 credits each, about 110 |
| Voices | `eleven_v4`, one take per character, lines separated by `[long pause]`, delivery tags | 17 × `vo-*`; 64 kbps mono, cut at the middles of the pauses (`CUTS` in `process.py`) | 412 + 276 + 484 credits |

The music asks for an early-1990s anime opening (J-rock guitars, slap bass, synth brass), a city-pop hangar tune, two hard-rock mecha battle themes that take turns, and an orchestral-rock kaiju theme with choir and organ.

## The cast

| Character | Voice | Lines |
|---|---|---|
| Captain Mirei Tachibana | "Kira X – Video Game, Bold & Cinematic" | launch, hostage secured, evac inbound, boss warning, mission complete, Unit-07 down; and the six lines narrating the opening cinematic (`vo-intro-1…6`) |
| Kai Arashi | "Kai – Energetic Anime Hero" | launch, Overdrive, level up, boss, low HP |

Voices are rate-limited in `audio.js`: one at a time, at most one waiting, the level-up shout only 40% of the time, and the music ducks under speech.

## Notes

- Mirei's take had one more pause than lines ("Mission complete. … Come home, Kai."), so the cuts are listed by hand from `silencedetect` instead of taken blindly; the narration take likewise ("the Cubeborn… and everything").
- Setting `duration_seconds` kept every effect at the length asked and made them cheap (credits scale with length).
- The real cost of the five music tracks was 4,350 credits; the `estimate_only` run had said 7,975.
- Nobody has listened to these. The browser test checks that the clips decode and that music plays.
