# EMBERSPIRE — the audio (ElevenLabs)

The music, sound effects and voices in `../../audio/` were generated with ElevenLabs on 2026-11-10 (flow
"EMBERSPIRE game audio"), one take each, and processed by `process.py` (needs ffmpeg):

```bash
python3 -I game-126/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3, vo-*.mp3 as downloaded
```

It normalises loudness, trims silence, fades the loop seam of each music track, cuts each voice take into its lines at
the longest pauses (ffmpeg `silencedetect`), and encodes music at 80 kbps stereo, effects at 96 kbps mono and voices at
64 kbps mono: 54 files, 4.3 MB. Spend was about 7,500 credits.

The game (`js/audio.js`) decodes effects and voices into AudioBuffers, plays music through `<audio>` elements routed into
a gain node (so `lib/page-audio.js` still mutes a hidden tab) with a crossfade between themes, and falls back to its own
Web Audio chiptune synth for anything that fails to load. Voices have their own volume slider.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays | Prompt |
|---|---|---|---|
| `music-title` | 60 s | title screen | Epic fantasy RPG title theme in a 16-bit SNES style: noble, wistful synth horn and harp arpeggios over sweeping strings, quiet wonder to a heroic swell. |
| `music-town` | 60 s | Hearthmere by day | Cheerful, cozy medieval melody on chiptune-flavoured flute and pizzicato strings over lute and hand drum. |
| `music-evening` | 60 s | evenings, bond scenes | Slow tender melody on soft lute, music-box chimes and recorder; fireside, romantic, peaceful. |
| `music-battle` | 60 s | floor battles | Fast heroic synth brass and strings, pounding bass ostinato, snappy drums, minor key with a triumphant lift. |
| `music-boss` | 60 s | every 10th floor | Dark, urgent pipe-organ riff, aggressive synth strings, timpani, double-time drums, brass stabs. |
| `music-victory` | 8 s | after a win | Bright brass and synth-trumpet fanfare with rolling snare. |

## Effects (`eleven_text_to_sound_v2`)

`sfx-hit` (sword hit, every physical blow), `sfx-fire`, `sfx-ice`, `sfx-bolt` (trimmed from 14 s to 1.6 s), `sfx-holy`,
`sfx-dark`, `sfx-nature` (each element's hits, pitch varied ±6%), `sfx-heal`, `sfx-revive`, `sfx-down` (a monster falls),
`sfx-roar` (boss entrance and enrage), `sfx-levelup`, `sfx-coins` (buying, daily bonus, bounties, idle income),
`sfx-anvil` (upgrades and reforging). UI blips stay synthesised.

## Voices (`eleven_v4`, audio tags for delivery)

Each hero has a battle cry (said now and then when they use a skill), a victory line and a recruit line; the townsfolk
greet you when you walk in; the Watcher narrates the opening and greets you at the gate.

| Character | Voice | Lines |
|---|---|---|
| Arin | Harry – Fierce Warrior | "For Hearthmere!" · "One floor closer, Father." · "My father went up those stairs…" |
| Mira | Libby – Animated | "Light, guide my hand!" · "Everyone's alright? Good. Good." · recruit line |
| Brakka | Emma – Wry, Gritty Hero | "Hah! Come here!" · "Is that all? I was just warming up!" · recruit line |
| Sylas | Callum – Husky Trickster | "Pardon me. I'll just take that." · "Elegant, as always." · recruit line |
| Lyra | Elowen – Elf | "Steady… loose!" · "Clean shot. The forest thanks you." · recruit line |
| Thorne | Michael Gisor – Nerd | "Stand back, this one's experimental!" · "Nothing caught fire…" · recruit line |
| Pip | Álfwyn – Excitable | "A song for courage!" · "Oh, that's going in the ballad!" · recruit line |
| Grimble | Angus – Scottish | "Fire in the hole!" · "Ha! Science!" · recruit line |
| Nyx | Moriana – Dark | "Kneel to the dark." · "How very… final." · recruit line |
| Old Bram | HorHey | "Sit, sit! The stew's hot and the gossip's hotter." |
| Hilde | Raven Ashcroft | "Bring me ore, and I'll bring you edges." |
| Corwin | William Dwyer | "The board's fresh…" |
| Zephyrine | Izumi | "Everything has a price, darling…" |
| Sister Amaya | Kristen – Storytelling | "The light remembers every step you take up there." |
| The Watcher | Grizzy – Dark Fantasy | the opening narration · "Up, then. Always up." |

Recruit lines are `RECRUIT_LINES` in `js/sim/data/story.js`. The split points were checked by clip length against the
text, not by ear: if a line starts with the tail of the one before it, adjust the pause threshold in `process.py`.

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com`; the cloud environment's network policy had to allow that
host before the files could be downloaded (generation itself goes through the MCP connector).
