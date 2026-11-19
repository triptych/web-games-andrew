# The Sugar Siege — the audio (ElevenLabs)

The music, effects and voices in `../../audio/` were generated with ElevenLabs on 2026-11-19 (flow "Doom & Doilies: The
Sugar Siege game audio"), one take each, and processed by `process.py` (needs ffmpeg):

```bash
python3 -I game-143/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3, vo-*.mp3 as downloaded
```

It normalises loudness, fades the end of each music track, trims the effects (to 2–2.4 s), cuts each voice take into its
lines at its N−1 longest pauses (ffmpeg `silencedetect`), and encodes music at 80 kbps stereo, effects at 96 kbps mono
and voices at 64 kbps mono: 52 files, 3.4 MB. About 5,500 credits in all (music ≈3,150, effects ≈290, voices ≈1,900).

The game (`js/audio.js`) decodes effects and voices into AudioBuffers, plays music through `<audio>` elements routed into
a gain node (so `lib/page-audio.js` still mutes a hidden tab), crossfades between themes, ducks the music under a voice,
and falls back to a small Web Audio synth for anything that fails to load. Voices have their own volume slider.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays | Prompt |
|---|---|---|---|
| `music-town` | 60 s | title and town | Cozy spooky village waltz: music box and celesta melody, pizzicato strings, soft accordion, light harpsichord, gentle bassoon, a touch of theremin, playful and warm with a mysterious minor-key twist, 3/4. |
| `music-battle` | 60 s | sieges | Whimsical spooky battle march against gingerbread zombies: driving pizzicato strings, bouncy tuba, snare and timpani, harpsichord runs, spooky organ stabs, heroic brass, minor key, cheeky. |
| `music-king` | 50 s | when the King arrives | Grand spooky boss theme for a lonely Gingerbread Zombie King: heavy pipe organ, low choir, timpani, deep brass, eerie music box, looming but sad. |
| `music-love` | 40 s | the reveal and the ending | Tender sweet love theme: music box and celesta, warm strings, harp glissandos, soft flute, major key, a little magical sparkle. |

## Effects (`eleven_text_to_sound_v2`)

`sfx-doily` (a throw), `sfx-splat` (a hit), `sfx-crumble` (an enemy curls up for a nap), `sfx-wallhit`, `sfx-build`,
`sfx-coins` (hires, deliveries, wins), `sfx-bell` and `sfx-horn` (an invasion), `sfx-cheer` (a win), `sfx-arrow` (Moss),
`sfx-potion` (Ottilie), `sfx-magic` (abilities), `sfx-stomp` (Gerald), `sfx-kiss`, `sfx-oven` (a bake milestone),
`sfx-roar` (the King), `sfx-quest` (a quest done). UI blips are synthesised.

## Voices (`eleven_v4`, audio tags for delivery)

One take per character with every line separated by `[long pause]`, split by `process.py`. The lines are marked in
`js/sim/data.js` as `[speaker, n]` on quest and scene lines.

| Character | Voice | Lines |
|---|---|---|
| Mayor Noxia | Elowen – Elf | "Citizens of Thistlegloom! …pumpkins." · "Build it, bake it, and do try to look menacing." · "Hold the wall! And mind the doilies, they're hand-made!" · "Ha! Off you go, crumbly ones. Nap time!" · "We held! Somebody put the kettle on." · "Now, my darling… it's time for the reveal." |
| Lord Vellum | Lord Alistair – British Aristocrat | "Madam Mayor, the paperwork has paperwork." · "The scouts report gingerbread…" · "Invasion at dawn! I have prepared a schedule for panicking." · "Quest complete. I've filed it under miracles." |
| Pip | Chuck – Goblin | "Ooh! More flour! More sugar! More oven!" · "Hot buns, coming through!" · "The Great Oven is hungry, boss!" |
| Gerald | John North – Warm Northerner | "Um… hello. I promise I'm the nice kind of gingerbread." · "Gerald… stomp!" · "Nobody's ever asked me to tea before." |
| Mother | Kristen – Cold Evil Queen | "Darling, a mayor. Of course you are." · "I was proud of the evil. I'm prouder of this." · "Do stand up straight on that wall, dear." |
| King Crumbleton | Gravel Midnight | "Crumble… everything…" · "Nobody ever… shared me…" · "For… me?" · "I'm not stale anymore." |
| Queen Honeysnap | Libby – Animated | "Hello, your Majesty. I was baked just for you." · "Shall we stop all this crumbling, and have a dance instead?" · "Sweet dreams, everyone." |
| Sir Tobias | Kai – Energetic Anime Hero | "Sir Tobias, reporting! I'm, um, sorry about the siege last year." · "For Thistlegloom, and for doilies!" · "Ow! That one had sprinkles!" |
| Madame Silkwhistle | Andrea – British female | "Knit one, defend two, darling." · "A scarf for every soldier. And the wall." |

The split points were checked against the pause lengths, not by ear.

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com`; the signed links expire after a few hours, so everything was
downloaded as soon as it finished.
