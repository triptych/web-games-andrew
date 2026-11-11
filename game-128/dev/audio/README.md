# Gemheart Saga — the audio (ElevenLabs)

The music, sound effects and voices in `../../audio/` were generated with ElevenLabs on 2026-11-11 (one flow, "Gemheart
Saga game audio"), one take each, and processed by `process.py` (needs ffmpeg):

```bash
python3 -I game-128/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3, vo-*.mp3 as downloaded
```

It normalises loudness, trims silence, fades the loop seam of each music track, cuts each voice take into its lines at
its pauses (ffmpeg `silencedetect`; where a dramatic pause inside a line is longer than the gap between lines, `WEIGHTS`
picks the pause nearest where the text length says the cut should fall), and encodes music at 80 kbps stereo, effects at
96 kbps mono and voices at 64 kbps mono: 70 files, about 5 MB. Spend was about 8,500 credits (music 4,395; effects 65;
voices 4,040).

The game (`js/audio.js`) decodes effects and voices into AudioBuffers, plays music through `<audio>` elements routed into
a gain node (so `lib/page-audio.js` still mutes a hidden tab) with a crossfade between themes, and falls back to Web Audio
tones for anything that fails to load. Story lines are matched to their clips by text (`VOICE_LINES`); battle barks are
rate-limited and played only some of the time. Voices have their own volume slider.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays | Prompt (abridged) |
|---|---|---|---|
| `music-title` | 60 s | title, the opening | Sweeping 32-bit-era RPG title theme: noble French horn and strings over harp arpeggios and choir pads. |
| `music-village` | 60 s | Briarwick | Cosy village theme: bouncy flute and fiddle over lute, accordion, pizzicato and hand drum. |
| `music-battle` | 60 s | battles | Fast synth-orchestral strings, punchy brass, slap bass, rock drums; minor hook that lifts to major. |
| `music-boss` | 60 s | bosses and nemeses | Pipe organ and choir riff, staccato strings, timpani, double-time drums, guitar stabs. |
| `music-victory` | 8 s | after a win | Brass and trumpet fanfare, rolling snare, final chord. |
| `music-story` | 45 s | story scenes | Tender oboe and piano over strings and a music box. |

## Effects (`eleven_text_to_sound_v2`, durations set per prompt)

`sfx-swap`, `sfx-match` (pitch rises with the cascade), `sfx-cascade` (chains of 3+), `sfx-special` (a special gem is
made), `sfx-blast` (line, bomb, prism, doom burst), `sfx-sword`, `sfx-fire`/`ice`/`nature`/`arcane` (ruby, sapphire,
emerald and amethyst hits and skills), `sfx-heal`, `sfx-hurt`, `sfx-shield`, `sfx-curse` (stone, chains, doom),
`sfx-roar` (bosses, enrage), `sfx-defeat`, `sfx-levelup`, `sfx-coins`, `sfx-build`, `sfx-anvil`.

## Voices (`eleven_v4`, audio tags for delivery)

Each hero's take holds five lines split into `-cry` (said now and then on a skill), `-win`, `-hurt`, `-intro` (their
tale's opening line) and `-end` (their ending). Nemeses and the Sovereign have `-taunt` and `-fall`.

| Character | Voice | Lines |
|---|---|---|
| Kael | Harry – Fierce Warrior | "For the Dawn!" · "Rest easy. It's over." · "I've had worse… I think." · intro · ending |
| Sela | Libby – Animated | "Tide, answer me!" · "Fascinating. Let's write that down." · "Ow! That was not in the books." · intro · ending |
| Fenn | Jordan – Warm & Gritty | "Ash, with me!" · "Clean shot. The wood thanks you." · "Hah, missed my heart!" · intro · ending |
| Brother Odo | Angus – Calm & Measured | "Be still, and be struck!" · "Peace to you, poor creature." · "Hm. Humbling." · intro · ending |
| Elder Maren | Tess – Direct and Grounded | greeting |
| Bess Tallow | Ruby B – London, Playful, Warm | greeting |
| Pell Farthing | Kai – Energetic Anime Hero | greeting |
| Mother Ilse | Ivy | greeting |
| Garrick Ironhand | William Dwyer | greeting |
| Tobin Thistledown | Jesse – Animation Character, Friendly | greeting |
| Sir Varek | Timothy Pemberton Smythe – British Posh | taunt · last words |
| Magister Quell | Callum – Husky Trickster | taunt · last words |
| Rotroot | Obsidian | taunt · last words |
| Vesper | Moriana – Dark, Seductive, Dangerous | taunt · last words |
| The Gloam Sovereign | Final Boss – Evil All Powerful Villain | "Little light…" · "No… the light… it burns so bright…" |
| Mother Murk | Grizzy – Expressive Dark Fantasy | "Come closer, dearie. The bog is always hungry." (when her fight starts) |
| The narrator | Romulus II Deep · Mysterious | the three opening lines and the first line of each ending |

The split points were checked by clip length against the text, not by ear: if a line starts with the tail of the one
before it, adjust `WEIGHTS` in `process.py`.

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` and fal from `v3b.fal.media`; both were reachable from the
cloud environment (generation itself goes through the MCP connectors).
