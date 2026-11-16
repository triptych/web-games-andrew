# WanderQuest — the sound (ElevenLabs)

`../../audio/` (44 clips, 5.9 MB) was made on 2026-11-16 with [ElevenLabs](https://elevenlabs.io) on one flow
("WanderQuest (game-085) audio"), one take each, and encoded by `process.py` (needs ffmpeg):

```bash
python3 -I game-085/dev/audio/process.py RAW     # RAW holds music-*.mp3, amb-*.mp3, loop-drums.mp3 and sfx-*.mp3 as downloaded
```

`js/audio-files.js` (generated) lists every clip, so the game never asks for one that isn't there. Any clip that is missing or
fails to decode plays the v1.3.0 Web Audio synth for that sound, and the plucked tune plays if a region's theme is missing.

| Kind | Model | Files | Cost |
|---|---|---|---|
| Music | `eleven_music_v2_5`, instrumental, 60 s (title 45 s) | `music/<region>.mp3` ×6, `music/title.mp3`: 57 s loops, 96 kbps stereo | 900 a track, 675 the title |
| Ambience | `eleven_text_to_sound_v2`, `loop: true`, 20 s | `amb/<region>.mp3` ×6, `amb/night.mp3`: 18 s loops, 64 kbps mono | 67 each |
| War drums | the same, 8 s loop | `amb/drums.mp3` | 27 |
| Effects | the same, `duration_seconds` set on each ([sfx.json](sfx.json)) | `sfx/*.mp3` ×29, 80 kbps mono | 2–10 each |

About 6,770 credits in all (the estimate before the music run said 11,100; the run charged 6,075).

**Music prompts** ask for an unhurried, loopable storybook theme that "ends the way it began", one instrument family per
region: Meadowmere (A major pentatonic) fingerpicked guitar, mandolin, tin whistle and fiddle over a plodding ox-cart hand drum;
the Amber Wastes (G phrygian dominant) oud, kanun, ney and darbuka; Mirewood (E minor pentatonic) harp, low clarinet,
pizzicato and marimba drips; Frostfang (D dorian) celesta, glockenspiel, cello and sleigh bells; Emberreach (F minor) cellos,
bassoon, French horn and soft taiko; Starhaven (B lydian) harp arpeggios, music box, celesta and flute; the title (D major) a
solo fiddle tune over guitar and accordion.

## Processing

- **Loops:** the first few seconds (3 s music, 2 s ambience, 0.4 s drums) are cross-faded under the last few with an
  equal-power fade and the head dropped, so the end runs straight back into the start; then loudness-normalised
  (music −17 LUFS, ambience −20).
- **Effects:** normalised to −1 dBFS *first*, then trimmed of anything below −42 dB at each end, capped (1.8 s, longer for the
  fanfares) and faded out. Trimming before normalising cut `ui-close` to 0.05 s: it came back peaking at −30 dB.

## In the game ([js/audio.js](../../js/audio.js))

- Effects are fetched and decoded when the first gesture makes the context; music and ambience are decoded when wanted, and
  only the playing theme stays decoded (a minute of stereo is about 20 MB of samples).
- The theme follows the region (`setScene`), the title has its own, and a change cross-fades over about 2.5 s; the old one
  keeps playing until the new one has loaded. At night a low-pass closes to 1.6 kHz and the music drops a little;
  crickets join the ambience on the meadow, desert and fen roads.
- Fights fade the drum loop in on the music bus from the first blow and out before the fanfare; hits pick party, foe, crit or
  heal clips with a ±7% pitch wobble. A clip played again within 60–150 ms is skipped, so a burst of events doesn't pile up.
- Nobody has listened to these with ears. The browser test checks that every effect decodes and that Meadowmere's theme and
  ambience are playing.
