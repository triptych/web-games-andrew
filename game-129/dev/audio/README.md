# HOLLOWDEEP — the audio (ElevenLabs)

The music, sound effects and voices in `../../audio/` were generated with ElevenLabs on 2026-11-12 (flow "HOLLOWDEEP
game audio"), one take each, and processed by `process.py` (needs ffmpeg):

```bash
python3 -I game-129/dev/audio/process.py RAW     # RAW holds music-*.mp3, sfx-*.mp3, vo-*.mp3 as downloaded
node game-129/dev/audio/takes.mjs                # prints each voice take's text (from js/voices.js) with its audio tags
```

It normalises loudness, trims silence from effects, fades the loop seam of each music track, cuts each voice take into
its lines at the longest pauses (ffmpeg `silencedetect`) and encodes music at 80 kbps stereo, effects at 96 kbps mono
and voices at 64 kbps mono: 128 files, 7.7 MB. Spend: about 7,250 credits of music, 100 of effects and 7,700 of voices.

The game (`js/audio.js`) plays music through `<audio>` elements routed into a gain node (so `lib/page-audio.js` still
mutes a hidden tab), crossfades between themes, ducks the music under a voice, decodes effects and voices into
AudioBuffers on demand, and falls back to synthesised blips and a drone for anything that fails to load. Voices have
their own volume slider and always show a subtitle.

## Music (`eleven_music_v2_5`, instrumental)

| File | Length | Plays |
|---|---|---|
| `music-title` | 60 s | title screen: oboe and harp over strings and choir, building to full orchestra |
| `music-town` | 60 s | Brindlemoor: guitar, recorder, accordion, pizzicato |
| `music-dungeon-1` | 75 s | strata 1–3: drones, distant choir, dulcimer and celesta, taiko pulses |
| `music-dungeon-2` | 75 s | strata 4–6: cello ostinato, forge clangs, male choir, glass harmonica |
| `music-dungeon-3` | 75 s | strata 7–8 and deeper: synth pads, detuned music box, clockwork ticks, vocalise |
| `music-battle` | 60 s | fights: rock-orchestral, guitars, string ostinato, brass stabs |
| `music-boss` | 60 s | guardians and the Reaper: choir, pipe organ, metal guitars, timpani |
| `music-victory` | 8 s | a win (a sting over the theme) |
| `music-defeat` | 10 s | a wipe |

The exact prompts are on the flow; each ended "made to loop seamlessly. Instrumental."

## Effects (`eleven_text_to_sound_v2`, durations set per effect)

`step`, `bump`, `stairs`, `chest`, `coins`, `hit`, `crit`, `hurt` (a monster hits a hero), `miss`, `fire`, `ice`,
`bolt`, `holy`, `dark`, `heal`, `levelup`, `down` (a monster dies), `encounter`, `roar` (guardian), `bell` (the
Reaper), `warp`, `trap`, `fountain`, and `ambience` (12 s loop of tunnel wind and drips, under the dungeon music).
Setting `duration_seconds` on each node kept them short (game-126's lightning crack came back 14 s long without it).

## Voices (`eleven_v4`, one take per character, lines separated by `[long pause]`)

Heroes have four lines: battle cry (sometimes, on a skill), victory, falling, joining the guild. Townsfolk have their
three greetings (one each day you walk in) and a thank-you when you report a quest. Guardians and the Reaper speak when
the fight starts and when they fall. The narrator opens a new game, announces a warp stone and a wipe.

| Character | Voice | Lines |
|---|---|---|
| narrator | Eldrin - Wise Ancient Wizard Storyteller | "Forty years ago, the ground beneath Brindlemoor split open, and the Hollowdeep breathed its first cold breath." · "Every floor runs deeper than the last. No one has found the bottom. Many have tried." · "Gather your company, delver. Light your lantern. The dark is waiting." · "The warp stones remember your victory. A deeper path is open." · "Your lanterns went out in the dark... but the guild carried you home." |
| marta | Poppy - Calm & Kind Teacher/Mother | "A bed, a bath, a hot meal. The dungeon will still be there in the morning, more's the pity." · "You look half dead. Sit. Eat." · "My Tomas went down in the third year. Mind you come back up." · "You found it. Oh... thank you, love. Thank you." |
| odo | Álfwyn - Excitable & Squeaky | "Everything a delver needs, and a few things they don't!" · "Bring me what you find down there. I pay fair. Mostly." · "Deeper you go, the better my stock gets. Funny how that works." · "Splendid! A deal's a deal. Here's your reward." |
| varga | Andrea - British female character voice | "Nobody goes down there alone. Not twice." · "The board's full of folk who want to fight. Pick the ones who'll stand when it counts." · "Five of you. Three up front, two behind. That's how we've always done it." · "Good work. The guild remembers who gets it done." |
| elowen | Libby-Animated | "The Dawn does not abandon those who walk in darkness." · "Bring me the fallen. While their name is spoken, they can return." · "Something below is calling the dead. I hear it at night." · "The Dawn smiles on you today. Go in light." |
| pell | Kai - Energetic Anime Hero | "Work on the board, ale at the bar, songs on the house." · "Every delver who comes back is a new verse. Give me a good one." · "They say there's a king at the bottom. They say there isn't a bottom." · "Ha! That's a verse and a chorus. Here's your pay." |
| ansel | Alden - Tired Old Man | "Down you go, then. Light your lantern." · "Beat a guardian and the warp stones remember it. I can send you past what you've conquered." · "Forty years at this gate. The stones hum louder every year." · "So it's done. The stones hum a little quieter tonight." |
| fighter_a | Harry - Fierce Warrior | "Stand and fight!" · "Another one for the pile." · "Not... yet..." · "Point me at something big." |
| fighter_b | Emma - Wry, Gritty Hero | "Come on, then!" · "Is that all the dark's got?" · "Agh! Keep... going..." · "I hit hard and I don't run. Deal?" |
| knight_a | The Doc | "By oath and steel!" · "Hold the line. Well done." · "Forgive me... I faltered..." · "My shield is yours, for as long as it holds." |
| knight_b | Tess - Direct and Grounded | "Behind me! I've got you." · "Everyone standing? Good." · "Dawn... keep them safe..." · "I'll stand in front. That's what I'm for." |
| thief_a | Jordan - Warm & Gritty | "Pardon me. Just passing through." · "And they never saw me coming." · "Well... that's... unlucky..." · "I pick locks, pockets and fights. Mostly locks." |
| thief_b | Ruby B - London, Playful, Warm | "Quick and quiet." · "Check their pockets before they fade." · "Sloppy... so sloppy..." · "Need someone small and sharp? I'm both." |
| mage_a | Matthew Schmitz - Ancient Sage Dragon Wizard | "Burn, by the old words!" · "Hm. Textbook, really." · "My spectacles... where are..." · "An old man's tricks still have teeth. You'll see." |
| mage_b | Elowen - Elf | "Feel the storm!" · "Elegant. As always." · "This isn't how... the story ends..." · "I've read about the deep. I'd rather see it." |
| priest_a | Rusty Malone - Deep & Raspy | "Light, guide my hand." · "Rest now, poor creatures." · "Carry on... without me... for now..." · "Every party needs someone to pray for it. I volunteer." |
| priest_b | K | "Be mended!" · "Is everyone all right? Thank the Dawn." · "I'm sorry... I couldn't..." · "I'll keep you standing. Promise." |
| ranger_a | Gravel Midnight – Deep Character Voice | "Steady... loose!" · "Clean shot. Clean kill." · "Lost... the trail..." · "I've tracked worse things than these in the dark." |
| ranger_b | Yuria - Expressive, Playful, Witty | "Got you in my sights!" · "Ha! Never stood a chance." · "Too close... too close..." · "Give me a bow and a reason. I'll do the rest." |
| ossuary_knight | Bloodgrin VF - Evil, Demonic Villain | "None pass. None have ever passed." · "At last... rest..." |
| mother_mycelia | Moriana - Dark, Seductive, Dangerous | "Sleep, little ones... and feed my children." · "My spores... will remember you..." |
| brine_leviathan | Cthulhu - The Old One | "The deep remembers the drowned. Join them." · "The tide... turns..." |
| forgefather | Azgar the Cursed - The Orc Troll | "The forge is lit. You will be the ore." · "The fire... goes... cold..." |
| winter_lich | Jerry B. - Dark Villain | Horror & Thriller | "Your warmth offends me. Let me take it from you." · "Impossible... the cold is eternal..." |
| elder_briar | Mossbeard | The God of the Wild | "Every root in this dungeon is mine. And now, so are you." · "Seeds... will grow again..." |
| orrery_engine | Silent Systemus – Sovereign Protocol | "Anomaly detected. Correcting the count." · "Error. Error. The stars... are wrong..." |
| hollow_king | Valko - Slow and dark | "You came all this way to ask what lies below. Below... is me." · "Then go deeper... and see what waits for you..." |
| reaper | Grizzy - Expressive Dark Fantasy | "Your lantern... is mine." · "I will find you... again..." |

The split points were checked by clip length against the text, not by ear: if a line starts with the tail of the one
before it, lower the pause threshold in `process.py`.

## Networking

ElevenLabs serves results from `elevenlabsusercontent.com` with signed links that expire after a few hours: download
them as soon as a run finishes.
