# HEXAPOD RISING

**Genre:** third-person mech shooter with RPG upgrades and boss fights
**Engine:** three.js r165, no asset files (every model, texture and sound is made in code)
**Status:** v1.0.0

---

## Concept

Planet Tessera IV. The Skarn swarm fell on the colony of Haven's Rest and dragged 312 colonists to the Hive at the far end of the Vessk Rift. You are Mara Quill, a survey pilot with a six-legged survey walker called MITE (puny, one pulse gun bolted on) and its AI, PIP. You walk MITE across six battle-scarred landscapes toward the alien main camp, cracking open the colonist pods the Skarn keep in their camps. After every mission the colonist engineers bolt scavenged parts onto the walker, and it visibly grows: a puny survey spider at the start, a giant war machine at the Hive gate. Think Metal Slug's relentless forward push and boss set-pieces, seen from behind a Cannon Fodder-sized hexapod that becomes a Mechwarrior.

## Core loop

One mission: walk the corridor (z = 0 to −length), fight camps and drop-pod ambushes, free the orange pods, grab scrap and repair kits, reach the arena, destroy the boss, walk through the gate. Report → hangar (spend scrap on five upgrade tracks; the walker grows) → briefing → next mission. Destroyed: retry the mission with your upgrades and the scrap you had when it began.

## Mechanics

### The walker
- Twin-stick: WASD / left stick walks, mouse / arrow keys / right stick aims (the whole walker turns), fire holds. Auto-aim snaps to the best target near your aim; with no aim input it faces the nearest enemy in front.
- **Jump jets** (Space, fuel 14): a leap; hold in the air to hover (fuel 34/s). **Boost** (Shift, fuel 24/s): ×1.75 speed. A hard landing is a **stomp**: damage in a radius, scaled by Leg Actuators.
- **Missiles** (E / right-click): a salvo from the shoulder racks; ammo recharges continuously. From tier 2 they seek, from tier 3 they cluster.
- Armour trickles back (nanite repair) to 70 % after four quiet seconds; repair kits heal 30 %.
- The hull grows: scale = 0.8 + 0.06 × upgrades bought (0.8 to 2.3). Bigger means a wider body and bigger legs, which step over bigger rubble.

### Terrain
A seeded heightfield with a winding corridor, craters, wrecks, spires and boulders. Steep slopes block you (Legs raise the limit); rubble taller than the walker's clearance blocks you, shorter rubble you step over; hazard pools hurt or slow (burning wreckage, acid, quicksand, black ice, lava, hive goo). Every field is **proved crossable** for the weakest, widest walker at generation time (a flood fill, 8 attempts, the last carves a lane), and every pod is reachable.

### Enemies
| Unit | Role |
|---|---|
| Skarn Trooper | infantry, two-shot bursts, flung by blasts |
| Rocketeer | slow splash rockets from range |
| Wasp Drone | flyer that circles and strafes (hit it at altitude) |
| Stalker Walker | biped mech, four-shot bursts |
| Bulwark Tank | quad-legged heavy, shell lobs, armour against small arms |
| Gun Emplacement | static, accurate |
| Shield Pylon | boss add: a boss is immune while one lives |

Camps wake together but a moment apart. Ambushes drop pods ahead of you. Camp budget and the heavy-mech cap rise with the level.

### Bosses (five, with 2–4 phases each)
A phase begins when health crosses its threshold. Each change is a 2.6 s invulnerable set-piece (shockwave, radio line, adds, shields). Attacks are telegraphed: **red circles** are delayed blasts (shells, orbital strikes, erupting wyrm, drop pods), **expanding rings** are shockwaves (jump them), **a sweeping beam** hurts only a grounded walker (jump it, or hide behind a tall rock), **a red strip** is a charge.

| Boss (level) | Phases | Signature |
|---|---|---|
| **Gatekeeper** (Haven's Ruin) | 2 | Siege tank. P1 burst fire, mortar shells, bolt fans. P2 (50 %): armour plating blows off, it is faster, **charges**, drops troopers. |
| **Siege Strider** (Redrock Canyon) | 3 | Alien six-legged artillery. P1 mortar barrages, stomp waves. P2 (66 %): calls drop pods. P3 (33 %): its shell opens, the **core takes ×1.8**, it fires a **sweeping beam** and double stomps. |
| **Glacier Leviathan** (Whitelight Glacier) | 3 | Burrowing wyrm with a segmented body. **Burrows** (untouchable), tracks you underground, **erupts** under you after a telegraph. P2: **blizzard** (traction and sight), drones. P3 (30 %): chain eruptions, exposed (×1.5). |
| **Cinder Titan** (Cinder Basin) | 3 | Forge colossus. P1 flame rings and fireballs that leave fire. P2 (66 %): **two shield pylons** feed it; break them to stun it. P3 (33 %): **meltdown**, lava pools rise in the arena, the core is exposed (×1.6), beam sweeps. |
| **The Warlord** (The Hive) | 4 | Zhar-Kul. P1 fans and lance dashes. P2 (75 %): **three shield pylons**, brood, missile volleys. P3 (50 %): the Hive Engine opens, sweeping beam, homing missiles, wasps. P4 (25 %): **orbital strike** rows, lava, exposed (×1.6). His fall wins the game. |

### Upgrades (five tracks, six tiers each, 25 purchases; scrap income affords ~15)
Main Guns (Pulse Gun → Twin Autocannon → Plasma Repeater → Ion Lance → Rail Cannon → Hellfire Battery), Missile Rack, Hull Armor, Fuel Tanks, Leg Actuators. Each shows on the model: plates, barrels, racks, tanks, piston legs.

## Content

Six missions: Haven's Ruin (scorched plains), Sporefen (toxic marsh), Redrock Canyon (terraced badlands), Whitelight Glacier (ice), Cinder Basin (volcanic), The Hive. 14 colonist pods, 3–6 colonists each. Level data is in `js/sim/data.js`; the story is in `js/sim/story.js`.

## Story

Prologue (PIP, Mara), a briefing per mission, radio chatter by progress and for every boss phase (Commander Okafor, Old Tomas, PIP, Zhar-Kul, the Skarn Net), an end-of-mission line, and three endings by how many pods you opened. The pens open when the Warlord falls.

## Controls

| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Walk | WASD | Left stick / d-pad | Left thumb drag |
| Aim and fire | Mouse + left button; arrow keys | Right stick, RT | Right thumb drag (auto-fires); FIRE auto-aims |
| Missiles | E / right-click | B | MSL |
| Jump jets | Space (hold to hover) | A | JUMP (hold to hover) |
| Boost | Shift | LB | BOOST |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

Scene: one chunked heightfield per level (vertex-coloured by height, slope, craters, hazards and camps, with a tiling procedural normal map), instanced rubble, wrecks, biome spires and ground cover, a shader sky, ACES tone mapping, a real-time shadow that follows the walker, HDR bloom (`UnrealBloomPass`), an environment map generated from the biome's sky. **The legs are a real two-bone IK rig**: each foot plants on the terrain, steps in a tripod gait, the hull tilts to the plane through its feet; the same rig walks the Stalkers, Bulwarks, the Strider, the Titan and the Warlord. Explosions are GPU point-sprite particles (fire, sparks, smoke), physics debris that bounces on the terrain, fireball volumes, shockwave rings, scorch decals and flash lights, with screen shake (off for reduced motion). Sound is all Web Audio: gun voices per tier, explosions by size, a walker hum, wind, a look-ahead score whose tempo follows how many enemies are awake and whether a boss is up.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, the mode machine, the fixed-step loop, input routing, the attract-mode title, debug hooks |
| `js/sim/` | Pure simulation: no DOM, renderer, `Math.random` or clock. `game.js` setup, player, bullets, flow, save; `terrain.js` fields and the crossability proof; `enemies.js`; `boss.js` the phase machine and attack library; `core.js` shared helpers; `data.js`, `story.js`; `bot.js` the auto-player |
| `js/view/` | Reads the sim and answers its events. `view.js` renderer, camera, bullets, telegraphs, hangar; `terrainmesh.js`; `walker.js` the IK rig and the tiered hexapod; `models.js` enemies and bosses; `fx.js`; `biomes.js`; `textures.js` |
| `js/ui.js`, `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | DOM screens and HUD, input merge, sound, guarded storage, seeded RNG, constants |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, terrain, the rules, every boss attack and phase, determinism and save round trips, and has a bot play whole campaigns. `browsertest.mjs` drives the real game on desktop, the high-graphics path, touch-only phones in both orientations and with storage blocked.

## Balance notes

- The first bot runs died in the first camp: enemy fire was tuned down (trooper burst 2.6 dmg, slower cadence, lead 0.35), the starting hull raised to 150, camps wake a moment apart, and **nanite repair** was added. A retreat rule in the bot (back off under 42 % armour) then turned 0/8 campaigns into 8/8.
- Upgrade costs were scaled ×1.5 after the bot maxed everything by mission 4; now about 15 of 25 are affordable.
- A big walker could not squeeze through gaps the generator had proved for a small one: blockers now see 55 % of the hull radius (the legs), and the crossability proof uses the widest walker.
- The Rail Cannon was weaker per second than the Ion Lance until the simtest said so (tier ladder check).

## Open questions / next steps

- Bosses and set-pieces were tuned against a bot and eyeballed under SwiftShader. A human pass on real hardware is the next job, especially frame rate with bloom at 1080p+ and phone thermals.
- Colonists are cosmetic; a rescue mini-escort could be a good Metal Slug-style addition.
- More enemy variety per biome (spore beasts in the marsh, ice crawlers) would sharpen each mission's identity.

## Changelog

### v1.0.1 (2026-11-05)
- Legs step independently like a spider: each leg decides when it is overstretched, neighbouring legs never lift together, at most three are airborne, starts are staggered into a ripple, and an idle walker fidgets one leg at a time (it used to lift two tripods in lockstep, which looked like a jumping jack when strafing).
- Strafing and backing up no longer turn the hull: with no aim input and no target the walker faces down-range, and the auto-target cone follows the guns, not the direction of travel.

### v1.0.0 (2026-11-05)
- First release: six missions, five multi-phase bosses, IK hexapod that grows with 25 upgrades, procedural terrain proved crossable, destructible colonist pods, hazards, drop-pod ambushes, story, hangar, attract-mode title, touch/gamepad/keyboard+mouse.
