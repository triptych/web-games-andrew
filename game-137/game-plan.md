# SHARDFRAME

**Genre:** Bullet heaven / survivors-like with missions, a mech garage and a light idle crew
**Engine:** three.js r165, sim/view layout. Art by fal (`nano-banana-2`), music, effects and voices by ElevenLabs; every model is code, and a Web Audio synth stands in for any sound that fails to load
**Status:** v1.0.0

---

## Concept

A 1990s TV-anime voxel bullet heaven. Three years ago the sky over Aozora Bay cracked open and the **Cubeborn**, monsters made of glowing cubes, poured out of the Lattice. Kai Arashi pilots **Shardframe Unit-07**, a sunset-orange walking mech, off the flying carrier **Skylark** on twelve sorties across three sectors: free caged civilians, burn down hives, hold out for the lift, and kill a kaiju at the end of each sector.

The verb is the survivors one (move; the guns fire themselves), but everything you destroy **bursts into physics voxels**. The coloured ones are power (red XP, blue shield, green repair, gold credits) and can be walked into or pulled in with a held **MAGNET**. Whatever you leave on the ground settles into **temporary walls** that monsters and their shots can't pass but yours can, until they fade or get chewed through. The landscape is voxels too: rockets, lasers and stomps break it into rubble.

Between sorties, aboard the Skylark, you **refit the mech** (arms, shoulder, core, legs; buy and upgrade parts with credits) and visit the **Crew deck**: everyone you rescue moves aboard and, on a real-time clock (even while the game is closed), leaves small gifts: credits, or a boost for the next sortie.

Riffs on Vampire Survivors and Brotato (the auto-fire swarm and level-up cards), Downwell's "the gems are also the danger" economy turned into cover, and the 1990s anime mecha opening (cut-ins, speed lines, a narrated cold open).

## Core loop

1. **Hangar**: collect the crew's gifts, buy or upgrade parts, fit the loadout, pick a sortie.
2. **Briefing**: Captain Mirei says what's wrong; the gifts that will boost this sortie are listed.
3. **Sortie** (45 s–2.5 min): the swarm grows; weapons fire on their own; you move, magnet up voxels, level up (three cards), fire Overdrive, and do the objectives. Then hold out 30 s until the lift arrives (a boss kill ends it at once).
4. **Debrief**: reward and salvage (half if you go down), the rescued join the crew, the next sortie opens.

## Mechanics (each has a line in `dev/simtest.mjs`)

### The field
- 48×48 cells. Each cell has a height 0–3 (layers of 1 unit), a material (stone, crystal, rust, neon; the edge and hives can't be broken) and the hp of its top layer. Generated per sortie from a seed: crystal clumps (prairie), wandering ridges with gaps (canyon), a street grid of blocks (city), with a clear landing zone.
- **Proved**: every cage and every hive is reachable from the landing zone over open ground (flood fill); a layout that fails is thrown away. `maps` checks 12 missions × 60 seeds.
- Breaking a layer throws that material's rubble voxels (grey/cyan/rust/violet) and sometimes gold.

### Voxels (the physics)
- Thrown with velocity; gravity, bounce off walls taller than the voxel, bounce and friction on the ground, then **settle** snapped to a cell, stacking up to 3 high (0.3 units each).
- A settled voxel **blocks monsters and monster shots**, not the mech or its shots. The mech wades through at 80% speed.
- Settled voxels fade after 14 s. Monsters pushing into a pile **chew** the top voxel off every 0.45 s (brutes 3× faster).
- Coloured voxels are collected by walking within 1.1 cells, or from 4.5 cells while **MAGNET** is held (the mech moves at 55% and fires at 60% meanwhile). Rubble can't be collected.
- Explosions throw settled voxels back into the air.
- Cap of 900 voxels; the oldest settled ones go first.

### Weapons and parts
| Slot | Parts | Notes |
|---|---|---|
| Arms (2) | Vulcan Arm (starter), Scatter Cannon, Lance Laser | auto-target the nearest monster, else a hive; the laser pierces and cuts rock |
| Shoulder | Swarm Rockets (starter), Plasma Mortar, Saw Drones | rockets home and blast terrain; the mortar lobs over walls into the thickest crowd |
| Core | Heavy Plating (starter), Barrier Core, Overclock Reactor | HP; a recharging shield fed by blue voxels; fire rate and Overdrive charge |
| Legs | Strider (starter), Sprinter, Stomper | speed; Stomper adds a shockwave that also crushes rubble |

Each part has three levels (`LEVEL_MUL` 1, 1.35, 1.75 on its main stat). Prices 100–460 credits (`js/sim/data/parts.js`).

### Level-ups (in a sortie)
Red voxels fill XP (10, then +7 per level). A full bar pauses the battle and offers three cards from 13 (damage, fire rate, speed, magnet, HP, shield, regen, an extra bullet, an extra rocket, blast radius, laser width, an extra saw, Overdrive charge). Weapon cards only appear for weapons the mech carries.

### Overdrive
Kills (and hives) fill the gauge; when full, E / OD gives 5 s of double fire rate, 1.5× damage and invulnerability, with a cut-in of Kai and speed lines.

### Monsters
| Cubeborn | Behaviour |
|---|---|
| Mite | fast swarmer |
| Brute | slow, tough, chews piles three times faster |
| Spitter | keeps its distance and spits goo (blocked by voxel piles) |
| Boomer | walks up, fuses, explodes (hurts everything, breaks terrain) |
| Hive | a 3×3 structure that breeds monsters |
| Kaiju ×3 | Prism Behemoth, Rust Centipede, Lattice Queen: one AI (walk, wind up, attack) with ring, spiral, charge, stomp and summon attacks; they crush rock as they walk |

Monsters walk a flow field (Dijkstra from the mech, piles cost extra so they go round them when they can). Spawns grow with mission difficulty `d` (1.0–2.8) and time.

### Missions
Twelve, in three sectors (Glass Prairie, Rust Canyons, Neon Megalopolis): rescue (guarded cages, stand in the ring 3.5 s), hives, survive, combinations, and a boss at 4, 8 and 12. Mission 12 is the ending; after it every sortie can be replayed for credits.

### Crew and the idle clock
Twelve rescuable people, each with a portrait, a role, a gift and a period (7–16 min). Real seconds reach the sim only as a command (`act({ t: 'idle', secs })`): `main.js` sends the frame time while the game is open and the time since the save on load (capped at 8 h). A crew member keeps at most 3 gifts waiting. Gifts are credits or a **boost**; one of each boost is used at the next launch: Bento (+25 HP), Lucky Charm (+1.5 magnet), Tune-up (start at level 2), Cheer Song (Overdrive full), Hot Rounds (+15% damage), Shrine Ward (+30 shield), Herb Tea (regen), Turbo Oil (+12% speed), Maneki Cat (more gold).

## State, input, events

- **State** `G`: `mode` (hangar/mission/debrief), `hangar` (gold, parts, loadout, crew, boosts, clock), `unlocked`, `cleared`, `ended`, `run` (the sortie: `W` grid, `mech`, `enemies`, `shots`, `voxels`, `hives`, `cages`, `objectives`, `mods`, `boosts`, `evac`, `over`), `debrief`, `stats`, the rng state. All plain data: a save is `serialize(G)`; a mid-sortie save round trip plays on identically.
- **Input** (real time): `{ x, y, mag, od, pick }`. **Commands**: `buy`, `equip`, `collect`, `idle`, `launch`, `abort`, `done`.
- **Events**: `fire`, `beam`, `kill`, `boom`, `break`, `chew`, `collect`, `hurt`, `levelup`, `upgrade`, `overdrive`, `rescue`, `hive_down`, `hatch`, `spit`, `fuse`, `stomp`, `boss_in`, `boss_wind`, `boss_act`, `boss_down`, `objective`, `evac`, `clear`, `fail`, `launch`, `debrief`, `bought`, `upgraded`, `equip`, `gift`, `gift_ready`, `nope`.

## Story

Captain Mirei Tachibana commands the Skylark; Kai is seventeen and loud. The opening cinematic (six painted shots, narrated) shows the rift, the swarm, the carrier, Kai in the cockpit, the catapult launch and the landing. Each rescued person has a line. The ending: the Queen falls, the rift closes, the crew is home; the gifts keep coming.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Magnet (hold) | Space / Shift | A / triggers | 🧲 (hold) |
| Overdrive | E / X | X / Y | OD |
| Level-up card | 1 · 2 · 3 | d-pad + A | tap |
| Pause | P / Esc | Start | ❚❚ |
| Intro | Enter / Space next shot, Esc skip | | tap next shot, Skip |

## Look and sound

- **Look**: toon materials with a three-step ramp, black inverted-hull ink outlines on every voxel and model, flat unlit projectiles, white-then-colour impact flashes, a painted sky gradient per sector, chunky voxel models in code (`js/view/models.js`). Mech: sunset orange and charcoal with teal joints, a dome head with one visor slit, reversed bird legs (designed to not look like any franchise mech after the first title came back too familiar). HUD and menus are cel panels with heavy ink borders and outlined comic lettering. Overdrive: a slanted striped cut-in and speed lines.
- **Art (fal)**: title key art, hangar, ending, three sector paintings, the pilot and the commander, twelve crew portraits, six cinematic shots (three made with `nano-banana-2/edit` from the title and Kai's portrait so the mech and pilot stay on-model). See [dev/art/README.md](dev/art/README.md).
- **Sound (ElevenLabs)**: five tracks (title opening theme, hangar city-pop, two battle themes, boss), 26 effects, 17 voice lines (Mirei and Kai, plus the narration). See [dev/audio/README.md](dev/audio/README.md).

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title, intro, hangar, mission, debrief, ending), the fixed-step loop, the real-time crew clock, input routing, saves, debug hooks |
| `js/sim/game.js` | `newGame`, `step`, `act`, `serialize`/`deserialize` |
| `js/sim/world.js` | The grid, generation and its reachability proof, the flow field, circle-vs-grid collision, line traces |
| `js/sim/voxels.js` | Voxel physics: burst, fly, bounce, settle, stack, fade, chew, scatter, collect |
| `js/sim/damage.js` | Terrain layers, monsters, hives, the mech, explosions |
| `js/sim/combat.js` | The spatial hash, weapons, projectiles |
| `js/sim/enemies.js` | Spawning, monster AI, hives, the kaiju |
| `js/sim/run.js` | A sortie: start, step, level-ups, cages, objectives, evac, finish |
| `js/sim/hangar.js` | Parts, fitting, the mech's stats, crew, the idle clock |
| `js/sim/bot.js` | The auto-pilot (skill dial) and the hangar bot |
| `js/sim/data/*.js` | Parts, enemies, missions, crew, upgrades |
| `js/view/view.js`, `models.js` | three.js: terrain, voxels, monsters, kaiju, mech, effects, camera, the hangar turntable |
| `js/ui.js`, `js/cinematic.js` | DOM screens, HUD, hangar tabs, comms, cut-ins; the opening cinematic |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/media.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, media lists, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` (≈180 checks) covers purity, data, every rule above, the hangar and crew clock, map reachability over 720 maps, determinism and a mid-sortie save round trip, and has the bot play the whole campaign on 4 seeds at skill 1 and 0.4 with per-step invariants. `browsertest.mjs` plays the real page on desktop (cinematic, hangar, a sortie with real keys, cards, pause, debrief, crew gifts, buying, save and continue), two touch-only phones and blocked storage.

## Balance notes

Tuned against the bot. The first pass was far too easy: the perfect bot cleared all 12 sorties first time without dropping below 90% HP and killed bosses in 14 s, and late sorties paid ~2,900 credits (everything bought by mission 9). Changes: denser and tougher swarms (spawn rate `(2.2 + 1.1d)(1 + t/50)`, hp `×(0.6 + 0.4d^1.3)(1 + t/150)`), boss HP ×4, hive HP 900, guarded cages farther out with a 3.5 s hold, a 30 s evac, gold worth 1 credit, less healing. The skill dial was then too weak (a sloppy bot did as well as a good one), so a careless pilot now notices fewer threats and reacts slower.

Final table (4 seeds each; `node game-137/dev/simtest.mjs`):

| | skill 1 | skill 0.4 |
|---|---|---|
| Campaign finished | 4/4 | 4/4 |
| Sorties for 12 missions | 49 | 56 |
| Median lowest HP+shield in a won sortie | 50–90% | 26–77% |
| Rust Centipede (m8) | 4 wins / 5 tries | 4 / 6 |
| Hive Breaker (m2) | 4 / 4 | 4 / 7 |

Asserted bands: the perfect bot finishes on every seed in ≤ 18 sorties per campaign; the sloppy one needs more sorties; the first three sorties are won first time; the bosses beat the sloppy bot at least once; sortie 1 lasts ≥ 30 s and sortie 9 ≥ 120 s.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. Whether the magnet trade-off (slower, weaker fire) feels worth it is a feel question the bot can't answer.
- Nobody has listened to the audio or watched the cinematic with sound.
- The Rust Centipede is the difficulty spike; a person may find it unfair.

## Changelog

### v1.0.0 (2026-11-15)
- First release: twelve sorties in three sectors with rescue, hive, survive and boss objectives; physics voxels that are power-ups or temporary walls; destructible voxel terrain; 12 mech parts in 5 slots with three levels; 13 level-up cards; Overdrive with an anime cut-in; three kaiju; twelve rescuable crew with real-time gifts; a narrated opening cinematic (skippable); fal art, ElevenLabs music, effects and voices; sim and browser harnesses.
