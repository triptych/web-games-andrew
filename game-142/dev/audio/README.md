# Kaboom Keep — the sound (ElevenLabs)

`../../audio/` (37 clips, about 1.7 MB) was made on 2026-11-19 with [ElevenLabs](https://elevenlabs.io) on one flow ("Kaboom Keep (game-142) audio") and encoded by `process.py`. [`js/media.js`](../../js/media.js) lists the clips, so the game never asks for one that isn't there; a missing or undecodable effect falls back to a Web Audio synth, a missing tune or voice to silence.

```bash
python3 -I game-142/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3 and take-*.mp3 as downloaded
```

| Kind | Model | Files | Cost (credits) |
|---|---|---|---|
| Music | `eleven_music_v2_5`, instrumental, `duration_seconds` set | `music-title` (45 s jig: lute, tin whistle, oompah tuba), `music-play` (60 s sneaky folk loop: bassoon, mandolin, clarinet, slide whistle), `music-win` (8 s brass fanfare), `music-lose` (5 s "wah wah wah waaah"); 80 kbps stereo, −17 LUFS, a 0.6 s fade at the end | 675 + 900 + 120 + 75 |
| Effects | `eleven_text_to_sound_v2`, `duration_seconds` on every node | 15 × `sfx-*`: cannon, whistle, stone, wood, ice, boom, pop, bonk, poof, thud, collapse, star, boing, split, roof; 96 kbps mono, leading silence trimmed, at most 3.2 s, −16 LUFS | 2–10 each, 66 in all |
| Voices | `eleven_v4`, one take per character, lines separated by `[long pause]`, delivery tags | 18 × `vo-*`; 64 kbps mono, cut at the middles of pauses of 0.6 s or more | 197 + 115 + 143 + 255 |

About 2,550 credits were spent in all (the estimate said 3,460).

## The cast

| Character | Voice | Lines |
|---|---|---|
| The knights | "Álfwyn – Excitable & Squeaky" | Uh-oh! · Incoming! · Whoaaaa! · Oof! · Not the castle! · Ow... my helmet! |
| King Bumble and Prince Pompous | "Grampa Werthers – Old & Cranky" | My beautiful castle! · Guards! Guards! · This is most un-royal! |
| Mumbleby the Wizard | "Potato – Earthy & Rooted" | Hocus pocus... oh dear. · That was NOT in my spellbook! · Who turned off the gravity? |
| Pip the Cannoneer | "Milly – Cheerful Aussie Character Voice" | Ready... aim... KABOOM! · Bullseye! · Castle cleared! Woo-hoo! · Aww, out of cannonballs! · Let's knock it down! · What a smash! |

Voices are rate-limited in [`audio.js`](../../js/audio.js): one at a time (a line that would talk over another is dropped), knights speak on about half their bonks, and the music ducks under speech.

## Notes

- Pauses shorter than 0.6 s are the "..." inside a line ("Hocus pocus... oh dear", "Ready... aim..."), so `process.py` ignores them; every take then had exactly one pause fewer than lines, and the script stops if that ever stops being true.
- The signed download links expire after a few hours: download as soon as a run finishes.
- Nobody has listened to these in the game yet. The browser test checks that all 33 effect and voice clips decode and that the play music is playing.
