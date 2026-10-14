# VENDETTA OVERDRIVE

**Genre:** First-person shooter: an 80s action-movie revenge rampage in the spirit of Duke Nukem 3D, with Borderlands-style procedural guns
**Engine:** three.js r165 (import map, ES modules), no asset files: every model, texture, sound and song is generated in code
**Status:** v1.0.0

---

## Concept

Neo Angeles, summer 1987. The Xerxid Hegemony came out of the sky on the Fourth of July and burned the Sunset Strip in an afternoon. Colonel Jack "Ironjaw" Kane held the Strip with forty marines for six hours. Nobody came back. His daughter **Roxy Kane**, nineteen, motorcycle mechanic, owner of a mullet and a grudge, finds his shotgun in the rubble and a VHS tape in his helmet camera. On the tape, a shape with a golden arm walks toward her father and the screen goes to snow.

She's going to find whoever is on that tape. She's going to go through every alien between here and the mothership to do it.

The game is about **speed and noise**: you're fast (9 m/s, a jump, a jetpack), the enemies are loud and they come in crowds, guns fall out of everything, and every kill gives you **Fury** for **OVERDRIVE**, eight seconds of slow-motion in which you hit harder and every kill heals you. Kill quickly enough and the combo announcer starts shouting. Kill messily enough and there's nothing left to bury.

Riffs on: **Duke Nukem 3D** (a wisecracking hero, a city level to start, a jetpack, a kick on its own button, pipe bombs, keycards), **DOOM** (keycards and coloured doors, infighting-free crowds, monsters that teleport in when you take the key), **Borderlands** (guns rolled from parts with a maker, a rarity and an element, loot beams, a stat card to compare), **Max Payne** (the slow-motion meter), and every action film on a rental shelf in 1987.

## Core loop

One **level** (about 6–12 minutes):

1. A **briefing card** (where you are, what the tape showed last, the objective).
2. Fight through a procedurally generated level of 30–70 rooms and streets. Find the **keycard(s)**, open their doors, reach the **exit**, and on boss levels kill the boss first.
3. Pick up guns as you go. You carry four plus your boot; a better gun replaces the one in your hands (hold **E** over it, or tap **SWAP**).
4. Find the level's three **VHS tapes**. Each tape is a piece of the story: who was there the day Jack died and what really happened.
5. The **tally**: kills, tapes, time, style score, a rank from D to S ("TUBULAR!").

Five levels make the **campaign**, which has an ending. Dying shows an arcade **CONTINUE?** countdown; continuing restarts the level with the guns, health and ammo you had when you entered it.

## Mechanics

### Movement (`js/sim/player.js`)
- The player is a vertical cylinder: radius 0.4 m, height 1.8 m, eye height 1.6 m.
- Run 9 m/s with an acceleration of 70 m/s² on the ground and 20 m/s² in the air. No sprint key: you're always fast.
- Step up ledges of up to 0.6 m without jumping. Jump at 6.6 m/s against gravity of 20 m/s² (about 1.1 m).
- **Jetpack:** holding jump in the air burns fuel (35/s) for 30 m/s² of upward thrust (net 10 m/s² up). Fuel (100) refills at 25/s on the ground. It reaches the raised platforms that hold the best loot.
- Collision with the grid: a cell blocks you if it's solid, if its floor is more than the step height above your feet, or if your head won't fit under its ceiling. Moving x then z separately gives wall sliding.
- **Liquids:** slime (Sewers), plasma (Mothership) and toxic puddles (Strip) do 12 damage a second while your feet are in them.

### Guns (`js/sim/weapons.js`)
A gun is a plain object rolled from a seed: an **archetype**, a **maker**, a **rarity**, up to one **element** and some **parts**. The same object decides the stats, the name, the stat card and the 3D model, so nothing visual is ever saved.

| Archetype | Ammo | Base damage | Rate /s | Mag | Notes |
|---|---|---|---|---|---|
| Hand Cannon | bullets | 24 | 4.5 | 12 | Hitscan, accurate |
| Boomstick | shells | 10 × 9 pellets | 1.4 | 6 | Hitscan cone |
| Ripper | bullets | 10 | 13 | 60 | Hitscan, spins up |
| Doomsayer | rockets | 95 + splash 4.5 m | 1.1 | 4 | Rocket projectile; rocket jumps |
| Photon Rifle | cells | 17 | 8 | 40 | Fast plasma bolts |
| Disc Slinger | cells | 40 | 2.2 | 8 | Saw discs that ricochet 3 times |
| Tesla Coil | cells | 7 | 20 | 80 | Short beam (24 m) that arcs to 2 more targets |

**Makers** lean the stats and set the colours of the model: *Kane & Sons* (military olive, +damage), *Neon Dynamics* (pink and cyan chrome, +fire rate), *Xerxid Salvage* (purple, glowing, organic; more element chance), *Bubba's Garage* (rust and duct tape; +mag, −accuracy, cheap), *Tokyo Cyberworks* (white and red; +accuracy, faster reload).

**Rarity** (rolled with a level bonus): Common (white), Rad (green), Gnarly (blue), Tubular (purple), Legendary (gold). Each rarity adds a part and +8% damage per tier.

**Parts:** Twin Barrels, Overclocked, Heavy Slugs, Extended Mag, Quickdraw, Laser Sight, Ricochet, Homing, Explosive Rounds, Vampiric. Parts that make no sense for an archetype are never rolled (no Homing on a hitscan gun).

**Elements** (chance 0/15/30/45/60% by rarity, +20% for Xerxid): **Fire** (burn 8/s for 3 s), **Shock** (35% of a hit arcs to 2 enemies within 6 m), **Cryo** (each hit slows; 4 stacks freeze; a frozen enemy shatters when it dies), **Acid** (+60% against armoured enemies, eats armour).

**Legendaries** have a fixed name and forced parts: *Ironjaw's Last Word* (Jack's shotgun: 12 pellets, fire), *The Mixtape* (discs, 6 bounces, homing), *Neon Requiem* (photon, shock, homing), *Big Hair Bertha* (Doomsayer, twin, explosive). Bosses always drop one.

Names: `[element or part prefix] [maker] [noun] [Mk. roman]`, e.g. *Searing Kane & Sons Boomstick Mk.III*.

You start with **the Boot** (kick, always there) and **Dad's Spare Hand Cannon**, which never runs dry and rides outside the four swappable slots, so you can never end up with nothing to shoot (key 1; guns 2–5). The legendary shotgun, Ironjaw's Last Word, waits in the exit room of level 1.

### Kick, pipe bombs, Fury
- **Kick** (V / right mouse): 40 damage in a 2.2 m cone, a big knockback, shatters frozen enemies. 0.55 s cooldown.
- **Pipe bombs** (G): carry up to 5; thrown at 14 m/s, bounce, explode after 2.2 s (110 damage, 5 m). Enemies drop them.
- **Fury** (0–100): +4 a kill, +3 for a gib, +2 per combo step. **OVERDRIVE** (F) when full: 8 s in which enemies and their shots move at 35% speed, your damage is ×1.5 and every kill heals 5 (up to 100).

### Combos and style
Kills within 2.5 s of each other chain. 2: DOUBLE KILL, 3: TRIPLE KILL, 4: MEGA KILL, 6: RAMPAGE, 8: TOTALLY RADICAL, 12: UNSTOPPABLE. Style score = kills × combo multiplier, with bonuses for gibs, kicks and kills in the air.

Roxy's **one-liners** (an original set of about 40) fire on level starts, multi-kills, gibs, boss kills, near-death recoveries and tapes, at most one every 7 s, picked by the sim's RNG so a seed replays them the same.

### Enemies (`js/sim/enemies.js`, `js/sim/data.js`)

| Enemy | HP | Speed | Behaviour |
|---|---|---|---|
| **Snarl Trooper** | 60 | 4.5 | Grinning mouth on its chest; strafes and fires 3-shot plasma bursts |
| **Chomper** | 24 | 9.5 | Knee-high bag of teeth; packs, leaps at you |
| **Skull Drone** | 45 | 7, flies | Chrome skull with jets; hovers 2–4 m up, fires twin red lasers, dives |
| **Meatbeast** | 260 | 5.5 | Armoured brute; charges in a straight line and gores (30); armoured (acid +60%) |
| **Brainstalker** | 110 | 3.5 | Exposed brain on stilts; teleports when hurt, homing psi orbs |
| **Octotank** | 420 | 2.6 | Tentacles on treads; rocket volleys with splash, armoured |

AI: idle until it sees you (in range, line of sight, and in front of it or within 8 m) or hears a gun within 20 m. **Attack tokens:** only 3/4/5 enemies (by difficulty) may wind up or fire at once, so a crowd is a fight rather than a firing squad. With line of sight they keep a preferred distance and strafe, without it they follow a breadth-first flow field from your cell (walkers obey step heights, drones don't). Every attack has a wind-up you can see (eyes flare) and hear. Hits stagger with a chance per type.

Difficulty: *Babysitter* (enemy damage ×0.55, 75% of the enemies), *Tough Cookie* (×1), *Total Carnage* (×1.45, 125%).

### Bosses (`js/sim/bosses.js`)

| Level | Boss | HP | Attacks |
|---|---|---|---|
| 2 | **Queen Chompra** | 3000 | Leap slam with a shockwave you can jump; spawns chomper broods; spit fans |
| 4 | **Warlord Vrask, the Gilded Butcher** | 4600 | Golden arm cannon bursts, rocket barrage, jetpack hop across the arena, ground pound; at half health he stops talking |
| 5 | **Major Dell Rourke, the Traitor King** | 6000 | Fused to the mothership's brain. Phase 1: orb rings and homing missiles. Phase 2 (⅔): shields up, kill the 4 pylons. Phase 3 (⅓): a sweeping beam you jump or duck behind cover for, and summons |

Levels 1 and 3 end in an **ambush**: walking into the exit room locks it until the wave is dead (ambushers who lose you for 8 s come back through the walls). Boss fights get a **supply drop** every 15 s.

### Levels (`js/sim/level.js`)
A level is a grid of 3 m cells (48 × 48 to 60 × 60, so up to 180 m across). Each open cell has a floor height, a ceiling height (or open sky), a material, and flags (liquid, door, key colour, exit).

1. Scatter rectangular rooms (theme-sized; streets and plazas outdoors), with a margin.
2. Minimum spanning tree over room centres, plus 15–25% extra edges for loops. Carve each edge as an L-shaped corridor (3–4 cells wide outdoors as streets, 1–2 indoors).
3. Start = one end of the tree's diameter, exit = the other; boss levels force a big arena at the exit.
4. Lock 1–2 edges on the start→exit path with coloured keycard doors; put each key in the region reachable before its door, preferring rooms off the main path.
5. Heights: rooms get floor heights in 0.5 m steps by walking the tree; corridor cells ramp between them in steps of at most 0.5 m.
6. Features: pillars, raised loot platforms (+1.8–3 m, reachable by jetpack), liquid pits, crates (cover you can stand on), explosive barrels.
7. Static lights: neon signs, street lamps, ceiling lamps, glowing liquids, baked into a lightmap by the view.
8. Content: enemies by room area and level budget (none in the start room), pickups, gun crates (rarity-biased), three VHS tapes in dead ends or on platforms.
9. **Validated:** flood fill from the start with the step rule (no jumps on the critical path), collecting keys and opening their doors until nothing changes. The exit and every key must be reached or the next attempt seed is tried. `dev/simtest.mjs` checks this on many seeds and has the bot play.

| # | Level | Theme | Boss |
|---|---|---|---|
| 1 | **Sunset Strip** | Night city: streets, plazas, neon signs, towers with lit windows, open sky with the mothership overhead | Ambush |
| 2 | **Galleria of Doom** | A dead shopping mall: tile, shopfronts, a big atrium, fountains of slime | Queen Chompra |
| 3 | **The Slime Line** | Hive sewers: brick tunnels gone organic, slime rivers, pulsing egg sacs | Ambush |
| 4 | **The Mothership** | Purple chrome and hexagons, plasma channels, energy doors | Warlord Vrask |
| 5 | **Throne of Lies** | The ship's brain core: a huge arena under a living ceiling | Rourke |

## Story

**Roxy Kane** (player). **Col. Jack "Ironjaw" Kane** (her father, dead before the game). **Maj. Dell Rourke** (Jack's partner of twenty years, "Uncle Dell" to Roxy). **Warlord Vrask** (Xerxid field commander with a golden arm). **Corporal Benny Ortiz** (the marine who filmed the tapes).

The fifteen VHS tapes (three per level) are Benny's helmet-cam recordings plus a few of Jack's personal tapes:

- **Level 1:** the Strip holding out; Jack telling Benny to keep filming; the golden arm in the smoke.
- **Level 2:** the evacuation through the Galleria; Jack and Dell arguing about orders that pulled the air support; a message Jack recorded for Roxy's birthday that he never sent.
- **Level 3:** the marines dragged into the sewers; Dell's voice on an alien frequency; Benny's last tape.
- **Level 4:** Vrask's trophy room: Jack's dog tags aren't there. Vrask, dying, laughs: "I never touched your father. The human gave him to us. The human pulled the trigger."
- **Level 5:** the truth: Dell Rourke sold the Strip to the Hegemony for a place in the hive mind and shot Jack himself when Jack wouldn't kneel. The last tape is Jack's: "Kiddo, if you're watching this, don't come looking for me. ...Who am I kidding. Bring the big gun."

**Ending:** Rourke dies with the ship's brain. Roxy takes back her father's dog tags, the mothership falls into the Pacific, and she rides off at sunrise. Sting: the radio picks up a second signal from orbit. "THE HEGEMONY HAS MORE SHIPS."

## Controls

| Action | Keyboard + mouse | Gamepad | Touch |
|---|---|---|---|
| Move | WASD | Left stick | Left thumb: floating stick |
| Look | Mouse (pointer lock); ← → to turn | Right stick | Right thumb: drag anywhere |
| Fire | Left mouse / Ctrl | RT | FIRE (hold; drag on it to aim) |
| Jump / jetpack | Space (hold in the air) | A | JUMP (hold) |
| Kick | V / right mouse | B | KICK |
| Reload | R | X | ⟲ |
| Use / swap gun | E | X (near a gun) | SWAP (appears near a gun) |
| Weapon | 1–5, Q (last), wheel | Y (next) | ⇄ |
| Pipe bomb | G | LB | 💣 |
| Overdrive | F | RB | OVERDRIVE (when full) |
| Pause | Esc / P | Start | ❚❚ |

Touch and gamepad get light aim assist (a slow pull toward an enemy within 6° of the crosshair while firing).

## Look and sound

- **Palette:** night blues and purples, hot pink and cyan neon, sodium orange street lamps, alien purple and acid green. Synthwave grade during Overdrive.
- **World shader:** one `ShaderMaterial` for every wall, floor and ceiling. A material id per vertex picks a procedural texture written in GLSL (brick, concrete, asphalt with lane markings, sidewalk, shopfront glass, mall tile, sewer brick, organic hive flesh with veins, chrome hex plating, glowing plasma, building facades with lit windows), with derivative bump mapping, a baked RGB lightmap sampled by world XZ, up to 12 dynamic lights (muzzle flashes, rockets, explosions, plasma) and fog.
- **Sky:** a gradient sunset (outdoor) or void (ship) with stars, a striped synthwave sun, a far skyline ring, and the Xerxid mothership hanging over the city.
- **Models:** enemies are built from lathe profiles, tubes, displaced spheres and capsules (smooth normals, a few thousand triangles each), with patched `MeshStandardMaterial` for rim light, hit flash, the lightmap, freeze/burn tints and a noise dissolve when teleporting. Guns are built from the gun object (receiver, barrels, magazine, stock, scope, coils, fins) with the maker's materials and the element's glow; the same builder draws the first-person gun and the loot on the floor (with a rarity beam).
- **Effects:** instanced particles (blood, sparks, smoke, fire, frost, plasma), instanced gibs that bounce, blood decals, fireball explosions with shockwave rings, beams and tracers, camera shake.
- **Post:** world pass, viewmodel pass, half-res bloom, a VHS pass (chromatic aberration kicks, vignette, damage flash, low-health desaturation, Overdrive grade, scan lines, grain), `OutputPass`.
- **Music:** a synthwave sequencer per level (arpeggiated saw leads, gated snare, octave bass, pads), a boss track, filtered during Overdrive.
- **Effects:** every archetype has its own synthesis, elements add a layer, enemies have formant growls, explosions have a sub-bass thump.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, pointer lock, debug hooks |
| `js/config.js` | Version, save key, step, tuning shared by the sim, view and tests |
| `js/rng.js` | Seeded mulberry32 + hash |
| `js/sim/game.js` | `newGame`, `startLevel`, `step`, `serialize`, `deserialize`; pickups, doors, objectives, combos, tally |
| `js/sim/level.js` | Seeded level generator and validator |
| `js/sim/world.js` | Grid queries: collision, ray casts, line of sight, flow fields |
| `js/sim/player.js` | Movement, jetpack, weapons in hand, kick, pipe bombs, Overdrive |
| `js/sim/weapons.js` | Gun generation (archetypes, makers, rarities, parts, elements, names) |
| `js/sim/combat.js` | Hitscan, projectiles, splash, elements, damage |
| `js/sim/enemies.js` | Enemy AI |
| `js/sim/bosses.js` | The three bosses |
| `js/sim/data.js` | Enemy table, level table, tapes, one-liners, briefings |
| `js/sim/bot.js` | The auto-player: navigates objectives, aims, fights |
| `js/view/view.js` | Owns the scene; syncs actors, pickups, projectiles from G; answers events |
| `js/view/stage.js` | Renderer, cameras, composer, VHS pass, quality |
| `js/view/levelmesh.js` | Level geometry, the world shader, the lightmap |
| `js/view/sky.js` | Sky dome, skyline, mothership |
| `js/view/enemies.js` | Enemy and boss models and their animation |
| `js/view/guns.js` | Gun model builder (viewmodel and loot) |
| `js/view/viewmodel.js` | First-person gun and gloves, bob, recoil, reload |
| `js/view/fx.js` | Particles, gibs, decals, explosions, beams, dynamic lights |
| `js/view/shaderlib.js` | Shared GLSL (noise) and the actor material patch |
| `js/ui.js` | Screens, HUD, toasts, subtitles, gun cards, settings, touch deck |
| `js/input.js` | Keyboard, mouse, gamepad and touch → one input state |
| `js/audio.js` | Synth music and effects |
| `js/save.js` | Guarded localStorage |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the level generator on many seeds (reachability, keys before doors, no enemies at the start), gun generation, the rules (movement, steps, jumps, jetpack, doors and keys, hitscan, splash, elements, Overdrive, death and continue), determinism and save round trips, and has the bot play the whole campaign at two skills. `browsertest.mjs` drives the real game on desktop, on touch-only phones in both orientations, and with storage blocked.

## Balance notes

Every number below came from the bot table (`ONLY=bot SEEDS=6 node game-079/dev/simtest.mjs`), at Tough Cookie:

| Change | Why the bot asked for it |
|---|---|
| Fury gains halved; the Overdrive heal capped at 100 | Overdrive fired seven times in 40 s and the bot sat at 200 HP all level |
| The starter pistol never runs dry, rides outside the slots | Every gun at 0/0 before Queen Chompra; later, the bot traded the pistol away and ran dry fighting Vrask |
| Ammo drops for a gun you carry (not the pistol), 38% of kills | Ammo starvation from level 2 on |
| About a third fewer enemies (rooms at area/24, patrols at /75), HP +10% a level instead of +15% | ~110 enemies a level, and the Mothership killed the bot within 10 s of spawning |
| Attack tokens; wider enemy spread and a random lead; idle enemies see only in front | 180–650 damage in 4 s from everything shooting at once |
| Boss HP 3000 / 4600 / 6000, plus supply drops | First drafts melted in 16 s with good guns and were unwinnable with bad ones |
| A breather of 9 cells round the start; a lighter Throne roster | The small last level woke ten drones at once |

Result (6 seeds): the skill-1 bot wins every campaign with 0–6 deaths (3 on average); the skill-0.6 bot wins every one with 1–10 (6 on average). A bot clears a level in 1–3 minutes by rushing the objective and killing 50–90% of the enemies; a person exploring for tapes and guns takes several times that. The bot is a better shot than a person and a worse tactician: it never retreats round a corner. Treat its death count as a floor.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person and SwiftShader is not a GPU.
- Co-op? Endless arcade mode with a new seed per level?

## Changelog

### v1.0.0 (2026-10-14)
- First release: five generated levels, seven gun archetypes rolled with makers, rarities, parts and elements, six enemies and three bosses, kick, pipe bombs, jetpack, Fury and Overdrive, combos and one-liners, fifteen VHS tapes, synthwave music, desktop, gamepad and touch controls.
- Tested by `dev/simtest.mjs` (the bot plays the campaign at two skills) and `dev/browsertest.mjs` (desktop, touch-only phones both ways, blocked storage); models judged on `dev/models.html`.
