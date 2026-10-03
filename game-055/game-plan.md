# Rotorstorm — game plan

**Genre:** top-down helicopter shoot 'em up / bullet hell with an upgrade tree.
**Engine:** vanilla JavaScript, hand-written WebGL2, Web Audio. No libraries, no asset files.
**Status:** v1.0.0. Complete campaign, endless mode, tests.

## Pitch

*Desert Strike* and *Twin Cobra* meet the danmaku shooters. You fly the AH-77 Kestrel, the last
experimental gunship of Task Force HALYARD, up six operations along the Shattered Coast to shut
down MERIDIAN, a storm-steering AI that started steering storms *at* the cities it was built to
protect. Terrain is procedural, waves are procedural, bosses are hand-written spell cards, and
between sorties the hangar turns salvage into a 28-node skill tree.

## Core loop

1. **Briefing**: radio lines with portraits, a recon map, objective and boss, and a difficulty
   picker (Recruit / Pilot / Ace).
2. **Operation** (about 2.5–3 minutes): auto-scrolling flight over a seeded procedural map, with
   waves from the director, then a multi-phase boss.
3. **Debrief**: tally, rank (S–D), and salvage with a rank bonus.
4. **Hangar**: spend salvage on the tree. Refunds are free.

Fail an operation and you keep 60% of its salvage; once you've reached the boss you can retry
from it (rank capped at B). Cleared operations can be replayed from *Operations*. Clearing two
unlocks **Stormfront**, an endless run through every biome with a boss per sector.

## Controls

| | Phone | Keyboard | Gamepad |
|---|---|---|---|
| Fly | drag anywhere (relative: the ship moves *with* the finger, never under it) | WASD / arrows | stick / d-pad |
| Fire | automatic (option) | automatic, or Z / J / Space | A |
| Focus (slow, show hitbox, tight guns) | FOCUS toggle | Shift | LB / LT |
| Thunderclap EMP | EMP button | X / K | B |
| Overdrive | OD button | C / L | Y / RT |
| Pause | ❚❚ | P / Esc | Start |

The mouse works like a finger: hold the left button and drag.

## Mechanics

- **Hitbox**: a 3.4-unit dot in the cockpit (2.6 with *Slim Profile*); only bullets touching it
  hurt. Ground units can't be rammed; air units and bosses can.
- **Armour**: 3 pips (+3 from the tree, ±difficulty). A hit costs one pip, resets the chain,
  clears bullets within 120 units, and gives 2.2 s of invulnerability. *Deflector* adds a shield
  that recharges; *Phoenix Protocol* revives you once per operation.
- **Graze**: bullets passing within 24 units score and charge **Overdrive** (×1.8 fire rate,
  ×1.35 damage, 6–10 s; with *Time Dilation*, enemy fire runs at half speed).
- **Thunderclap EMP**: cancels every bullet and laser, damages everything on screen, and gives
  3–4 s of invulnerability. Two per operation, more from the tree and pickups.
- **Chain**: kills within 2.8 s of each other build a multiplier (+0.04 per kill, up to ×5).
- **Salvage**: wrecks drop gears that home in when you're near, after 2.4 s, or when you fly
  into the top of the screen.
- **Rescues**: three flares per operation mark stranded civilians. Hover within 50 units for
  1.2 s and the winch lifts them. They pay salvage and score, and the ending counts them.

## Story

Six operations, each with a briefing, timed in-flight radio, a pre-boss taunt from MERIDIAN,
phase lines, victory lines and a debrief paragraph. Cast: Cmdr. Rhea Castellan (OVERWATCH), Chief
Ozzie Mbeki (SPARKS, the hangar), Lt. Juno "Ash" Arden (your wingman, missing since the first
strike) and MERIDIAN.

| Op | Biome | Boss | Beat |
|---|---|---|---|
| 1 Breakwater | coast, dawn | **Tidewarden**, a dreadnought: 4 turrets + missile silo → bridge core | Ash's transponder pings from inland |
| 2 Canopy | jungle river, monsoon | **Mantis**, a walker with laser scythe arms | the crash site is empty; the harness was cut |
| 3 Dustveil | desert highway, sandstorm | **Sandwyrm**, a drilling train that burrows | MERIDIAN learns your name |
| 4 Whiteout | ice shelf, snow | **Bastion**, a fortress behind orbiting shield plates | logs reveal the SERAPH program |
| 5 Neon Rain | night city, superstorm | **Seraph**, a crowned gunship flown by Ash | shoot the crown, not the pilot; Ash ejects |
| 6 Crucible | volcano → platform | **MERIDIAN**, the core: nodes, Storm Eye, Cleansing Rain, Last Light | Ash flies on your wing for the final phase |

The epilogue varies with the survivors you rescued; a post-credits line sets up a sequel.

## Procedural levels

- **Terrain** (`js/sim/terrain.js`, `js/gfx/terrainGLSL.js`): value-noise height fields per biome
  (archipelago, a meandering river, dunes, mesas and a highway, ice shelf and open water, a city
  grid of lots with a canal and bridges, lava rivers and the Crucible's metal platform). The same
  integer hash and noise run on the CPU (doubles) and the GPU (float32, `uint` hashing), so a
  gunboat spawns on the water the shader paints. Coast operations force open sea under the
  dreadnought; the volcano switches to the platform under the final boss.
- **Director** (`js/sim/director.js`): 20 wave templates weighted by biome, with minimum
  "heat". Heat ramps through the operation and shortens the gaps between waves. Ground waves
  look for land, water or the highway ahead and swap themselves for an air wave if there isn't
  any. Elite waves (×2.2 HP, extra bullets, a purple glow) appear above 0.38 heat. Each operation
  places three rescues, two salvage caches and a mid-boss gunship (from op 2).
- **Enemies** (`js/sim/enemies.js`): hornet drones, jets (divers and strafers), gunships,
  bombers, a drone carrier, mines that burst when killed, homing SAM missiles you can shoot down,
  tanks, flak guns, SAM sites, bunkers, gunboats, icebreakers, fuel trucks and tanks (chain
  explosions), radars, rooftop gatling turrets, walkers, and the Warhawk mid-boss.

## Bosses and patterns

Bosses are lists of parts (hit circles) and phases. A phase ends on HP, on its gate parts being
destroyed, or on a timer (survival cards), with a 75 s safety limit. Scripts are JS generators
that `yield` seconds, so a pattern reads like a score. The bullet vocabulary in
`js/sim/bullets.js` covers rings, fans, aimed fans, stacks, curving bullets (angular velocity),
accelerating bullets, bullets that stop and re-aim (Bastion's *Absolute Zero*, Seraph's *Gilded
Cage*), bullets that split into rings, homing bullets, telegraphed delayed bullets (MERIDIAN's
lightning strikes), and sweeping lasers that warn before they fire.

## Skill tree (28 nodes)

| Chin Gun | Ordnance | Airframe | Systems |
|---|---|---|---|
| Heavy Barrels ×3 | Hellfire Rack | Composite Plating ×3 | EMP Capacitors ×2 |
| Twin Feed ×3 · Fan Spread | Deep Magazine ×2 · Rocket Pods ×2 | Auto-Repair ×2 · Turbine Tune ×2 | Overdrive Core ×2 · Salvage Magnet ×2 |
| Tungsten Rounds ×2 · Wide Fan | Cluster Warheads · Wingman Drone ×2 | Deflector · Slim Profile | Time Dilation · Scrap Broker ×2 |
| Tracer Crits ×2 | Hunter AI | Graze Dynamo | Thunderclap+ |
| **Ion Lance** (focus beam that burns bullets) | **Arc Caster** (chain lightning) | **Phoenix Protocol** | **Storm Breaker** (cancelled bullets → salvage) |

The tree costs about 27,500 salvage in total; the campaign pays roughly 15,000. Upgrades show on
the helicopter (missile racks, rocket pods, drones).

## Presentation

- **Renderer** (`js/gfx/`): one WebGL2 context. Terrain is baked into 512-unit chunks via MRT
  (lit albedo with material in alpha, plus emissive), decorated with sprite trees, huts and rocks,
  then stamped with craters and tank treads as the battle goes on. A ground shader animates water
  (waves, glints, caustics, breathing shore foam) and lava, and adds cloud shadows, 16 dynamic
  lights and a night searchlight. Sprites are instanced quads from two procedural atlases in one
  premultiplied blend mode, where alpha 0 means additive. Post: HDR bloom (5-level chain),
  shockwave refraction, chromatic aberration, weather (rain, sand haze, snow, ash and embers,
  storm lightning), cloud banks for intros and endless transitions, per-biome grading, ACES,
  grain, vignette, and a dimmed frame outside the field.
- **Effects** (`js/gfx/fx.js`): layered explosions (flash, flare, fire puffs with a colour ramp,
  smoke, stretched sparks, bouncing debris with shadows, rings, embers, lights, shockwaves,
  shake, hitstop), falling aircraft wrecks that crater or splash, muzzle flashes and ejected
  shell casings, missile trails, rotor downwash (ripples on water, dust on sand and snow), bullet
  cancels, lightning bolts, score popups, and boss death sequences with slow motion.
- **Audio** (`js/audio.js`): synthesised rotor wash, chin gun, explosions, sirens, EMP and UI
  sounds, plus a generative soundtrack per operation (drums, bass, arpeggio, pads, and a boss
  lead), seeded so each operation has its own tune.
- **Accessibility**: reduced flashing, adjustable shake, an always-visible hitbox, auto-fire,
  touch sensitivity, quality tiers with automatic downgrade, and `prefers-reduced-motion` for the UI.

## Architecture

```
js/sim/      pure simulation: world, player, bullets, enemies, bosses, director, terrain, skills, campaign
js/gfx/      WebGL2: gl helpers, atlas (Canvas 2D art), batch, ground + terrain GLSL, post, fx, renderer
js/ui.js     DOM screens, HUD, portraits, hangar tree
js/audio.js  Web Audio synthesis and music
js/input.js  keyboard, gamepad, pointer (relative drag)
js/bot.js    a dodging bot: plays the title-screen demo and the headless tests
js/main.js   flow, fixed 1/120 s loop with hitstop and slow-mo, event routing, debug hooks
```

`js/sim/` never touches the DOM, WebGL or `Math.random` (the test greps for it), so a Node script
can play the real game.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` plays every operation headlessly with a god bot
(every boss must die and no phase may time out) and a mortal dodging bot (balance). It also runs
endless mode and checks determinism. `browsertest.mjs` drives the whole game in Chromium on
desktop and on touch-only phones.

## Open questions

- Balance comes from the bot (its hits are a lower bound for a human). It hasn't been hand-played
  on a real phone or GPU, only SwiftShader.
- Online leaderboards, a daily seed and more endless-only bosses would suit Stormfront.
