# Pinch & Place — the sound (ElevenLabs)

`../../audio/` (20 clips, 1.9 MB) was made on 2026-11-14 with [ElevenLabs](https://elevenlabs.io) on one flow ("Pinch & Place (game-136) audio") and encoded by `process.py`. `js/media.js` lists the clips, so the game never requests one that isn't there; anything missing or undecodable falls back to a Web Audio synth.

```bash
python3 -I game-136/dev/audio/process.py RAW     # RAW holds music-*.mp3 and sfx-*.mp3 as downloaded
```

| Kind | Model | Files | Cost |
|---|---|---|---|
| Music | `eleven_music_v2_5`, instrumental, prompts in `music.json` | `music-title` (45 s), `music-build1`, `music-build2` (60 s each); 80 kbps stereo, 1.5 s fades at the loop seam, loudness −18 LUFS | 675 + 900 + 900 credits |
| Effects | `eleven_text_to_sound_v2`, prompts in `sfx.json`, `duration_seconds` set on every node | 17 × `sfx-*`; 96 kbps mono, leading silence trimmed, at most 3.2 s, −16 LUFS (`sfx-fire` is a 5 s seamless loop at −24) | 2–17 credits each, 76 in all |

**Music prompts** ask for claymation stop-motion film music: ukulele, glockenspiel and pizzicato for the title; kalimba, marimba and fingerpicked guitar for building tune one; felt piano, music box and clarinet for tune two. The two building tunes take turns.

| Effect | Plays when |
|---|---|
| craft | a thing is pinched out of clay on the bench |
| squish | a shelf thing is squished back into clay |
| plop / lift | a thing is put down / picked up to move |
| rotate, stow, undo | turned, back to the shelf, undo |
| nope | a place where it doesn't fit |
| click, open | buttons, sheets opening |
| shutter | a photo is taken |
| goal | a goal on the brief card is met |
| star ×3, fanfare, cheer | the rating: one chime per star (pitched up), then the fanfare and, for three stars, the cheer |
| unlock | a new room opens |
| fire | loops quietly while a fireplace is in the room |

## Notes

- Setting `duration_seconds` on every effect node kept every clip at the length asked (game-135's "about 1 second" came back 14 s without it), and made them cheap: credits scale with length.
- `sfx-lift` is quiet enough that trimming leading silence at −45 dB removed all of it; `process.py` keeps a clip whole when trimming leaves nothing.
- Nobody has listened to these. The browser test checks that the clips decode and that music plays.
