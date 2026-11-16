# CLEAN SLATE — the audio (ElevenLabs)

Everything in `../../audio/` was generated with ElevenLabs on 2026-11-16 (flow "CLEAN SLATE game audio (game-139)"),
one take each, and encoded by `process.py` (needs ffmpeg):

```bash
node game-139/dev/audio/voices.mjs                       # writes voices.json: the takes, built from the game's own lines
python3 -I game-139/dev/audio/process.py RAW              # RAW holds music-*.mp3, sfx-*.mp3, take-*.mp3 as downloaded
```

It normalises loudness, trims silence, fades the loop seam of each music track, cuts each voice take into its lines at the
middles of its longest pauses (ffmpeg `silencedetect`), and encodes music at 80 kbps stereo, effects at 96 kbps mono and
voices at 64 kbps mono: 62 files, 4.6 MB. Spend: about 3,600 credits of music, 57 of effects and 4,350 of speech.

The game (`js/audio.js`) decodes effects and voices into AudioBuffers, plays music through `<audio>` elements routed into a
gain node (so `lib/page-audio.js` still mutes a hidden tab) with a crossfade between themes, and falls back to a small
Web Audio synth for any effect that fails to load. Voices have their own volume slider and play one at a time.

## Music (`eleven_music_v2_5`, instrumental, 60 s)

| File | Plays | Prompt (abridged) |
|---|---|---|
| `music-day` | title, days at the inn, letters | Cosy medieval tavern folk tune: fingerpicked lute, tin whistle, hand drum, upright bass |
| `music-night` | ordinary nights | A sly, tense card game: pizzicato strings, cimbalom, walking bass, brushed snare, clarinet |
| `music-boss` | the three bosses | A showdown with the past: low strings, frame drums, dark fiddle, harpsichord, choir pad |
| `music-ending` | the ending | Tender fiddle and lute growing into a joyful tavern band with accordion and claps |

## Effects (`eleven_text_to_sound_v2`)

The prompts are `sfx.json`. `flip` (a rival card turns over), `deal` (a card is drawn), `settle` (a pair is made), `cut`
(a Blade), `hit` (a rival's blow lands), `block` (Composure soaks it), `heal`, `coins` (tips), `shuffle` (the discard is
reshuffled), `lock`, `grudge`, `cleared` (a night won), `defeat` (the run lost), `door` (a rival arrives), `pour` (Pour
One Out), `build` (a room, or a Polish).

## Voices (`eleven_v4`, audio tags for delivery)

Each rival says their arrival line and, if they stay, their partnership line; Mother Thorn's second line is the one she
says when you win. The Narrator has twelve lines (`NARRATOR` in `js/sim/data/inn.js`). The cast is `CAST` in `voices.mjs`.

| Character | Voice | Tag |
|---|---|---|
| Narrator | Eldrin – Wise Epic Fantasy Narration | `[dry, wry]` |
| Brannoc Vell | Callum – Husky Trickster | `[amused]` |
| Sister Quell | Emma – Wry, Gritty Hero | `[dry, quiet]` |
| Gideon Flint | Chad | `[weary, deadpan]` |
| The Marrow Twins | Ayla – Bubbly, Cute & Expressive | `[excited]` |
| Lady Corvina | Harriet – Mature British Actress | `[haughty]` |
| Big Moss | Azgar the Cursed | `[softly, shy]` |
| Rook Daggett | Harry – Fierce Warrior | `[frustrated]` |
| Madame Oriel | Andrea – British female character voice | `[mysterious]` |
| Captain Varr | Dusty Garner | `[firm]` |
| The Grey Choir | Grav – Deep, Dark & Sinister | `[whispering]` |
| Vesper Kane | Elowen – Elf | `[earnest]` |
| Dr Mott | Alden – Tired Old Man | `[fussy]` |
| Penrose Tally | ross | `[prim]` |
| Garr Hollins | Angus – Calm & Measured | `[booming]` |
| Mother Thorn | Beatrice – Mature Female Storyteller | `[coldly calm]` |

The split points were checked by clip length against the text, not by ear.

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` (signed links that expire in a few hours: download as soon as a
run finishes). Generation itself goes through the MCP connector.
