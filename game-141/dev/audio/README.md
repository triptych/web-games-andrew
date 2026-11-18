# SANDSUNK — the sound (ElevenLabs)

Everything in `../../audio/` was made on 2026-11-18 in one ElevenLabs flow and encoded by `process.py` (ffmpeg): `python3 -I game-141/dev/audio/process.py RAW`. About 7,100 credits in all (music 4,400, voices 2,600, effects about 100). The downloads are not in the repo (the signed links expire in hours; download as soon as a run finishes).

| Files | Model | Notes |
|---|---|---|
| `sfx-*.mp3` ×27 | `eleven_text_to_sound_v2`, one take each, prompt influence 0.5–0.7, 0.5–3 s | dig-soft/stone/crystal, break-soft/stone/crystal, trap, monster, mhit, hurt, coin, gem, artifact (fanfare), levelup, rune, solve, chest, press, descend, potion, disarm, mark, deny, rotate, power, blast, click. ~2–10 credits each. Silence trimmed, 96 kbps mono. |
| `music-dig.mp3` (90 s), `music-camp.mp3` (70 s), `music-treasure.mp3` (75 s), `music-ending.mp3` (60 s) | `eleven_music_v2_5`, instrumental | Oud, kanun, frame drum and ney for the dig; solo oud by the fire for camp; harp, celesta and choir pads for treasure floors; strings and brass for the tower rising. 900–1,350 credits each. 80 kbps stereo with a 2.5 s fade at the loop seam. |
| `vo-*.mp3` ×27 | `eleven_v4`, one take per character, lines separated by `[long pause]`, delivery tags per line | Cast: **Quill** — "Lord Alistair, British Aristocrat" (posh, dry, fussy: a clockwork owl professor), 18 lines in two takes; **Sela** — "Emma, Wry Gritty Hero", 7 lines; **Zahra** — "Andrea, British female character voice" (knowing, warm), 2 lines. Cut at the midpoints of the silences in `CUTS` (from `silencedetect` at −38 dB / 0.45 s; Sela's take has pauses inside two lines, so only six of its eight silences are cuts). 64 kbps mono. |

Line ids are the keys of `LINES` in `js/sim/data/story.js`; the text on screen is that table, the spoken line is the same words (Quill's spoken "mark" line drops the list of ways to mark).
In the game: effects and voices are decoded into AudioBuffers, music plays through `<audio>` elements routed into a gain node (so `lib/page-audio.js` silences a hidden tab), themes crossfade, voices duck the music, and anything missing falls back to a Web Audio blip or silence.
