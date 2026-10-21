# Verdant Protocol

**Genre:** Press-turn RPG with monster recruiting (Shin Megami Tensei and Persona, in a healing post-apocalypse)
**Engine:** three.js r165 (instanced scenery, toon shading with ink outlines, custom post chain), no asset files
**Status:** v1.0.0

---

## Concept

Year 212 after the Hexfall. Meridian, the machine that ran the world's weather, grid and magic, went wrong and
corrupted everything it touched. The earth is healing anyway: moss climbs the server towers, forests grow through the
malls. You are a Warden of the Verdant Accord, an agent with a **Grafter** that reads a corrupted Hex's broken code and
lets you ask it, politely, to be something else. A Hex that says yes becomes a **daemon** and fights for you.

The tone is hopeful and strange: PS2-era Atlus staging (angular glass UI, a moon phase that matters, a station hub
between missions, bonds with the cast) over a world that is quietly getting better. Nobody here is simply evil; the
guardians you fight are things stuck in a loop, and the game asks what you do about that.

Riffs on: *Shin Megami Tensei: Nocturne* (Press Turn, negotiation, fusion, the moon), *Persona 3/4/5* (knock-downs,
All-Out Attack, Bonds, a calendar), *Pokémon* (collecting), *Digimon* (the digital and the wild as one thing).

## Core loop

A **day**: pick one thing at the station. Deploy into a zone (a stack of generated floors ending in a guardian), hang
out with a friend, or sleep. In a zone: explore in real time, strike Hexes first for an ambush, fight turn-based
battles, **recode** the ones you want, open chests, rest at Sprouts. Back home: the Infirmary has already healed
everyone; spend Scrap, **splice** daemons in the Greenhouse, deepen Bonds. The moon turns each day.

## Mechanics

### Press Turn
Each side gets one icon per member standing. A normal action spends an icon (a flash icon first). Hitting a
**weakness** or landing a **critical** knocks the target down and spends only half an icon. A **miss** or a **null**
costs two icons; a **repel** or **drain** costs all. A downed unit loses its next icon standing up (half an icon for
your side: a mercy). When every foe is down, **All-Out Attack**. Bosses get extra icons.

### Damage
`baseline(level) = 8 + 2.1 × level`; `damage = baseline × power/40 × (offence/defence)^0.85`, then buffs (±25% a
stage), affinity (weak ×1.5, resist ×0.5, null 0, drain heals, repel reflects), Charge/Focus (×2.2), guard (×0.5),
critical (×1.5), tide, difficulty. Offence is Strength (Strike), Agility-weighted (Gun) or Magic (spells).
Defence is Vitality for physical, Vitality and Magic for spells. Stats are `4 + growth × (level+4)/2`.

### Elements
Strike, Gun, Pyre, Rime, Volt, Gale, Lumen, Hex, and Root (nothing resists it). Affinities: weak, resist, null,
drain, repel. You learn a species' affinities by hitting them (kept in the Compendium); a Scan shows all.

### Ailments and buffs
Lag (lose an action), Rot (6% HP a turn), Hush (no skills), Panic (attacks at random). Attack, defence and speed move
two stages either way for three turns.

### Recoding
Choose **Recode** on a Hex: it costs the turn. A short conversation: each of the eight personalities (Wild, Timid,
Proud, Playful, Cold, Kind, Cruel, Curious) answers one of four scripts best (**Soothe, Command, Barter, Mirror**)
for +2 rapport, another for +1, one for 0, one for −1. Reach 3 before four exchanges. Starting rapport: the tide
(Bright +1, Dark −1), the Hex being downed (+1) or under half health (+1), Wren's Bond (+1), having recoded the species
before (+1). Demands (an item, Scrap, HP or MP) give +2 if met and −1 if refused; liked gifts give +2, others +1.
Rapport −2 severs the link (the daemon is angry, and cannot be recoded again this fight); running out of patience
sends it away. Guardians cannot be recoded in the fight; they join after the story scene that follows.

### Splicing
Two daemons in, one out. The race comes from the symmetric table in `data/fusion.js`, the level from the average
plus one (the first of that race at or above it), the same race gives a higher one, and two special recipes make two
rare daemons. Up to two skills (three with Maple's Bond) pass on. The preview is exactly the result.

### The tide
Eight phases, one a day. Dark Tide: Hexes hit 10% harder and are harder to recode. Bright Tide: Hexes hit 8% softer
and listen more easily. Sleeping at the Infirmary waits for a better one.

### Bonds
Five friends, four ranks each, one scene a rank, one day each. Wren (recoding, free flash icons), Dov (XP,
Endure), Ilsa (All-Out Attack), Maple (cheaper splices, more inheritance), Quill (prices and Scrap). Higher ranks wait
for the story.

### The Currents
Choices move three counters: **Hearth** (rebuild what was), **Wild** (let the green take it), **Graft** (make
something new). The ending is a choice at Meridian: Reboot, Purge, or Graft, which is locked until Graft ≥ 5 and every
Bond is at least Rank 2.

## Content

| | |
|---|---|
| Zones | Brightwater Underpass, Verdancy Galleria, Server Orchard, Compile Cathedral, Skyrail, Meridian Spire (4 floors), and the repeatable Hex Rift |
| Guardians | Switchman Unit-7, Mother Bloom, Bailiff Aurelia, Leviathan Index, Windbreaker Titan, The Pruner, Meridian (two waves) |
| Daemons | 56 in eight races (Sprite, Beast, Construct, Wisp, Wyrm, Colossus, Archon, Revenant), 16 procedural rigs |
| Skills | 100: physical, gun, four tiers of six spells, healing, buffs, ailments, passives, signatures |
| Items | 66 incl. 40 skill chips; 20 pieces of gear in four slots |
| Story | prologue, 6 chapters (pre, post, a station scene each), 20 Bond scenes, three endings |

## Look and sound

Stepped toon shading with a rim light and inverted-hull ink outlines; textures painted in code and filtered NEAREST;
flat vertex-coloured models. Post: bloom, then our own PS2 pass: ordered dither to 5 bits a channel, grade, vignette,
scanlines, grain, chromatic aberration on hits, glitch tearing, a radial zoom, and the swirl-and-shatter that opens a
battle. Hexes wear a pulsing magenta shell. UI: skewed angular glass panels, neon edges, glitching title, Press Turn
diamonds, a terminal for recoding, big italic banners for WEAK and ALL-OUT. Twelve original tunes and every effect
from Web Audio. No image or audio files.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | WASD / Arrows | Stick / d-pad | Drag on the left |
| Action / confirm | Space · Z · Enter | A | A button / tap |
| Run | Shift | X / RT | RUN |
| Menu / pause | Tab · Esc · P | Y · Start | ☰ ✦ |
| Camera | Q / E, wheel | | Drag, pinch |

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the frame loop, input routing, backdrops for scenes, debug hooks |
| `js/sim/game.js` | `newGame`, `act`, `step`, scenes, hub actions, rewards, saves |
| `js/sim/battle.js` | Press Turn engine, enemy AI, recoding sub-state, rewards |
| `js/sim/explore.js`, `gen.js` | Real-time exploration, foes, chests; the floor generator |
| `js/sim/splice.js`, `units.js`, `perks.js`, `world.js`, `recode.js` | Fusion, stats and gear, Bonds, small shared pieces |
| `js/sim/data/*` | Skills, daemons, items, zones, the splice table, the whole story |
| `js/sim/bot.js` | An auto-player for tests, balance and the debug autoplay |
| `js/view/*` | Stage and post chain, toon materials, humans, 16 daemon rigs, environments, props, FX, hub, field, battle |
| `js/ui.js`, `js/ui/*` | DOM: dialogue, field HUD, battle HUD with the recoding terminal, panels |
| `js/audio.js`, `input.js`, `save.js` | Sound, keyboard/pad/touch, guarded storage |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, content integrity, floor connectivity, every battle
rule, recoding, exploration, the hub, every scene and the three endings, determinism and save round trips, a fuzz run
and whole bot-played games. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations
and with storage blocked.

## Balance notes

The bot found: guardians with self-heals stalled (guardians now rarely heal), a boss with a leftover extra-icon bonus
hit three times a phase (bonuses are per living boss), the weakness-targeting AI was lethal to random parties (weak
×2.2 and a mercy rule: downed party members cost half an icon), and Meridian was unwinnable at level 60 until its
damage and health were cut. Whole games: the careful bot finishes in about 23 days at Lv 43 with about 4 defeats, 15
recodes and 7 splices; a casual bot finishes in about 26 days with 7 defeats.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- Post-game: Rift depth rewards, a bestiary completion reward.
- New Game+ with the Currents carried over.

## Changelog

### v1.0.0 (2026-10-21)
- First release: Press Turn battles with knock-downs and All-Out Attacks; recoding with eight personalities; splicing with a
  race table and skill inheritance; six zones and a Rift; seven guardians; five Bonds; three endings; 56 daemons;
  a PS2-style three.js look with its own post chain; twelve tunes; touch controls; saves.
