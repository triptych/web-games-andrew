# HAYATE RIVER STRIKE — music, sound and voices (ElevenLabs)

Every sound in `../../audio/` was generated on 2026-11-27 with **ElevenLabs** (flow "HAYATE RIVER STRIKE — game art &
audio") and encoded by [process.py](process.py) (ffmpeg):

```bash
python3 -I game-152/dev/audio/process.py RAW game-152/audio
```

Music: 80 kbps stereo with a short fade at the loop seam. Effects: silence trimmed, peak-normalised, 96 kbps mono.
Voices: one take per character with the lines separated by `[long pause]`, cut at the middle of each pause (`CUTS`,
read from ffmpeg `silencedetect`; Kurogane's take has a pause inside "Impossible... my fleet", so his two cuts are
placed by hand), loudness-normalised to -16 LUFS, 64 kbps mono. 2.3 MB in all. A Web Audio synth stands in for any
effect that fails to load, and makes the engine hum.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Prompt (short) | Plays |
|---|---:|---|---|
| `music-title` | 40 s | 90s anime TV opening: heroic J-rock, soaring guitar lead, slap bass, brass stabs, 150 BPM | title |
| `music-river` | 60 s | 90s anime action BGM for a river stage: driving J-rock fusion, slap bass, synth brass, 165 BPM | sectors |
| `music-boss` | 50 s | 90s anime boss battle: heavy guitar riffs, taiko, synth choir, brass, 172 BPM | sector bosses |
| `jingle-clear` | 8 s | triumphant guitar and brass fanfare | the dock, victory |
| `jingle-over` | 8 s | sad descending synth and electric piano | game over |

`music-river` and `music-boss` failed once on the server ("unexpected error", not charged) and were run again.

## Effects (`eleven_text_to_sound_v2`, 2–8 credits each)

`cannon` · `missile` · `jump` (a boat launching out of the water) · `land` (slamming back down) · `boom` · `bigboom` ·
`pickup` (cores) · `powerup` (boosts) · `alarm` (boss warning) · `hurt` · `shield` · `laser` (lanes) · `deflect`
(shots off a shielded core) · `phase` (boss phase change) · `bridge` · `overdrive`. Enemy shots and telegraph beeps are
synth blips.

## Voices (`eleven_v4`, one take per character)

| Character | Voice | Lines |
|---|---|---|
| Rin Kazamatsuri | Kira X (bold, cinematic video-game heroine) | launch, jump, boss, core, bosskill, lowhull, overdrive, over, victory |
| Tomo Ishida | Kai (energetic anime hero) | start, fuel, mini, boss, overdrive, dock |
| Commodore Kurogane | Final Boss (deep, commanding villain) | taunt, final, defeat |

The subtitles are in [js/lines.js](../../js/lines.js); `main.js` queues them so only one plays at a time, and the
music ducks to 35% under each.

**Spend:** music about 4,125 credits (two runs of the 60 s and 50 s tracks), effects 71, voices 1,092.
