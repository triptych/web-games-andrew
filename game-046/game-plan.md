# Quiverspire

**Genre:** Action roguelite — Archero-style "stand still to shoot" arena archer
**Engine:** three.js r165 (ES modules via import map) + a pure-JS seeded simulation
**Target Resolution:** any — the camera fits the room to landscape monitors and portrait phones
**Status:** Playable — v1.0

---

## Concept

An Archero clone with its own spire to climb. Your archer shoots automatically,
but **only while standing still**: moving stops the bow. Every room is the same
rhythm — dodge, plant your feet, loose arrows, dodge again — and the build you
assemble from level-up cards decides how much one stop is worth.

Ten chapters (realms of the spire) of twelve rooms each: **120 procedurally
generated rooms**, plus an **Endless** mode that keeps climbing through the
biomes with a steepening difficulty curve. Every room, texture, model, particle
and piece of music is generated in code — there are no asset files.

---

## Core Mechanics

### 1. Move or shoot
WASD / arrows / left stick / a floating one-thumb joystick. While the move
vector is zero the archer faces the nearest enemy (strongly preferring ones in
line of sight) and fires a volley every `1 / attackSpeed` seconds; the first
volley after stopping comes at 45% of the cooldown, so stutter-stepping pays.

### 2. Rooms
Rooms are 11 tiles wide and 11–21 tall. Tiles are floor, **rock** (blocks
walking and arrows), **pit** (water / lava / acid / chasm / sky — blocks walking,
arrows fly over) or **spikes** (later chapters; they rise and fall on a clock).
Clear the room and the portcullis sinks: walk out through the top door.

### 3. Chapter plan (12 stages)
`combat ×3 → angel → combat → elite → combat ×2 → angel → combat ×2 → boss`

- **Angel**: heal 40% or take a random ability.
- **Elite** (stage 6): a mini-boss version of a chapter enemy — ×7 HP, bigger,
  faster, with an extra flourish on every attack — and some minions.
- **Devil**: after an elite or boss (50%), trade 20% of max HP forever for a
  strong ability (Multishot, Front Arrow, Ricochet, Piercing, Extra Life, …) — or walk past.
- **Boss** (stage 12): one of five, cycling through the chapters; chapters 6–10
  bring them back **Ascended** (phase two from 75% HP instead of 50%).

### 4. Abilities (29)
Level-ups (and the opening blessing) offer three weighted cards. Stack caps
keep builds honest; the Devil's pool is its own.

| Group | Abilities |
|---|---|
| Arrow count | Multishot (extra volley), Front Arrow +1, Diagonal Arrows, Side Arrows, Rear Arrow |
| Arrow behaviour | Piercing, Ricochet, Bouncy Wall, Giant Arrows |
| Elements | Blaze (burn), Freeze (slow + freeze chance), Poison Touch (permanent DoT), Bolt (chain lightning) |
| Companions | Flame Circle, Frost Circle (orbiting), Spirit Wisp (shoots while you move) |
| Stats | Attack Boost, Attack Speed, Crit Master, HP Boost, Swift Feet, Dodge Master, Rage |
| Survival | Bloodthirst, Aegis (blocks a hit every 8 s), Invincibility Star, Extra Life, Heal |
| Execution | Headshot (4% instant kill on normal enemies) |

### 5. Enemies (12 + elites)
Every attack is telegraphed — a wind-up the model shows (red glow, throb), and a
floor marker for anything area-based.

| Enemy | Behaviour |
|---|---|
| Slime / Slimelet | Hops at you; big slimes split in two |
| Bat | Flies over pits, wobbles in, telegraphs a dive |
| Bone Archer | Keeps range, shows a laser sight, fires an aimed arrow |
| Spitter Bloom | Rooted; rings of seeds on a rhythm |
| Hex Mage | Keeps range, casts a 3-way spread |
| Leaper | Marks where you stand, leaps there |
| Tusker | Shows its charge lane, then charges until it hits a wall |
| Bombardier | Lobs bombs (the arc is drawn) onto marked circles |
| Wraith | Drifts through walls, fires slow homing wisps |
| Stone Golem | Slow tank; stomp + expanding shockwave ring |
| Burrower | Tunnels under you (invulnerable), surfaces with a ring of shots |
| Watcher | Floating eye; a tracking laser that locks just before firing |

Enemy types unlock two a chapter (1: slime, bat, archer, bloom · 2: mage, leaper ·
3: tusker, bombardier · 4: wraith, golem · 5: burrower, watcher) and each chapter
favours two of them.

### 6. Bosses (5)
| Boss | Attacks |
|---|---|
| Gorgomire, the Swelling King | Leaps onto a marked circle (landing blast + bullet ring), spits fans, splits off slimes at 66% / 33% |
| Hollow Marksman | Arrow fans, arrow rain on marked circles, dashes; phase two adds a double spiral |
| Cinder Colossus | Telegraphed charges that crash into walls (ring of embers), triple stomp rings, meteors |
| Tidecoil Serpent | Rotating spiral streams, bullet walls with one gap, submerges and resurfaces with a ring |
| The Unlit Lich | Homing void orbs, summons, teleport rings with a gap aimed at you, rotating cross beams |

### 7. Meta progression
Coins (dropped in runs, plus a per-room and chapter-clear bonus) buy six
permanent **talents**, ten levels each: Power, Vitality, Agility, Iron Skin,
Recover, Greed. Clearing a chapter unlocks the next; clearing chapter 1 unlocks
Endless. Best room per chapter and the Endless record are saved.

---

## Game Loop

Title (the bot plays the selected chapter behind the menu) → pick a chapter →
opening blessing → rooms: fight → loot vacuums in → level-up cards → walk out →
angel / elite / devil / boss → chapter clear → coins → talents → next chapter.

---

## Player Controls

| Action | Keyboard | Touch | Gamepad |
|--------|----------|-------|---------|
| Move | WASD / arrows | Drag anywhere (floating joystick) | Left stick / d-pad |
| Shoot | Stand still | Lift your thumb | Let go of the stick |
| Pick a card | Click / 1–3 | Tap | — |
| Pause | P / Esc | ❚❚ | — |
| Mute | M | ♪ | — |

---

## Difficulty

`difficulty(chapter, stage)` in `config.js`: enemy HP ×(1 + 0.42·(ch−1))·(1 + 0.035·stage),
damage ×(1 + 0.24·(ch−1))·(1 + 0.02·stage), a spawn budget that grows with both,
and a slightly faster attack tempo. Endless uses `1 + cycle + 0.1·cycle²` as its
chapter number, so it gets steep.

Balance is bot-derived: `BALANCE=1 node game-046/dev/simtest.mjs` prints the
bot's clear rate per chapter at talent levels 0 / 3 / 6 / 10 (see
[dev/README.md](dev/README.md)). Latest run (N=16 per cell; brackets are the
average stage reached out of 12):

| Talents | Ch 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| 0  | 94% | 94% | 69% | 56% | 50% | 0% (10.2) | 0% (4.7) | 0% (7.6) | 0% (3.0) | 0% (1.6) |
| 3  | 100% | 100% | 81% | 63% | 81% | 25% | 25% | 13% | 19% | 13% |
| 6  | 100% | 100% | 100% | 81% | 69% | 50% | 44% | 56% | 69% | 31% |
| 10 | 100% | 94% | 88% | 94% | 100% | 88% | 63% | 69% | 81% | 69% |

So the first chapters are open to a fresh save, and the Ascended half of the
spire asks for talents. A maxed bot falls in Endless around room 190. Nobody
has hand-tuned it against a human yet.

---

## Procedural graphics

- **Floors**: one canvas painter driven by a per-biome recipe — a two-tone
  checker so the grid reads, flagstone grout and bevels, cracks (glowing lava
  seams in the Forge, light in the Crystal Caverns), grass blades, moss, specks,
  splotches, rune circles — over value-noise grain, with a matching bump map.
- **Pits**: one shader with seven looks (water with caustics, lava with a
  drifting crust, acid with bubbles, ice water, bottomless chasm, starry void,
  open sky with clouds), sunk below the floor with shaded side walls.
- **Obstacles**: ten biome styles built from primitives with jittered vertices —
  mossy boulders, gravestones and sarcophagi, mesa stacks, ice shards,
  spotted mushrooms, broken columns, obsidian with glowing seams, crystal
  clusters, marble pillars, void shards with a spinning core.
- **Props** outside the walls: trees, pines, cacti, graves, candles, corals,
  kelp, chimneys, anvils, clouds, void spires, eyestalks…
- **Characters**: the hero, all twelve enemies and five bosses are modelled from
  primitives at runtime and hue-shifted per chapter.
- **Atmosphere**: per-biome light, fog, sky colour and ambient particles
  (fireflies, dust, embers, snow, spores, bubbles, sparks, glints, clouds, motes).

## Juice inventory

| Event | Reaction |
|---|---|
| Arrow hit | white (or element-coloured) sparks, damage number, knock-back, white flash on the model |
| Crit / headshot | gold number, flare, small shake; headshot adds hit-stop |
| Kill | burst in the enemy's colour, solid debris, shockwave ring, flare |
| Elite / boss kill | big burst, hit-stop / slow-motion, FOV punch, VICTORY banner |
| Player hit | red flash, shake, hit-stop, red number, i-frame blink |
| Low HP | a red heartbeat vignette |
| Level up | ring + rising sparks, badge pop, arpeggio |
| Telegraphs | circles that fill as the timer runs out, charge lanes, laser sights, lobbed bombs, falling meteors |

## Sound

All procedural Web Audio (`js/sounds.js`): bow twang, hits (crits ring), pops,
booms, slams, beams, level-up and card arpeggios, coin blips, door grind. Each
chapter **composes its own music** from a seed — key, mode (major, minor,
dorian, phrygian, mixolydian, harmonic minor), tempo, a four-chord progression,
bass figure, arpeggio and an 8-step motif — on a look-ahead sequencer; drums
and arpeggio come in when a fight starts, the lead motif for bosses and elites.

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Boot, mode state machine, fixed-timestep loop, hit-stop / slow-mo, room rebuilds |
| `config.js` | All tunables: player, abilities, enemies, bosses, chapters, stage plan, talents, difficulty |
| `sim/world.js` | Run & room flow, player movement, choices, rewards (pure, seeded) |
| `sim/roomgen.js` | Procedural room layouts with reachability validation |
| `sim/grid.js` | Tiles, circle collision, exact line of sight, BFS flow fields |
| `sim/combat.js` | Volleys, arrows, statuses, kills, loot, bullets, hazards, player damage |
| `sim/enemies.js` | Spawning and the twelve enemy brains |
| `sim/bosses.js` | The five boss state machines |
| `sim/abilities.js` | Ability rolls, grants, devil deals, stat folding |
| `sim/bot.js` | Autopilot (attract mode and tests) |
| `sim/rng.js` | Seeded PRNG + hashing |
| `juice.js` | Every sim event → sound, particles, camera, UI |
| `view/scene.js` | Renderer, camera rig, lights, shadows, bloom + grade pass, shake |
| `view/roomView.js` | Floor, pits, walls, door, obstacles, spikes, props, ambience, shrines |
| `view/actors.js` | Hero, enemy and boss models + animation, HP bars, orbits, spirits |
| `view/projectiles.js` | Instanced arrows, bullets, loot; hazard telegraphs |
| `view/fx.js` | Pooled particles, debris, rings, lightning, flares, damage numbers |
| `view/textures.js` | Canvas-painted textures |
| `view/biomes.js` | The ten biome recipes |
| `input.js` | Keyboard, floating joystick, gamepad |
| `ui.js` | DOM HUD and screens |
| `sounds.js` | SFX + generative music |
| `state.js` | Coins, talents, unlocks, records (localStorage) |

## Event Catalog (sim → juice)

`shoot`, `hit`, `dot`, `kill`, `spawn`, `eliteSpawn`, `bossSpawn`, `bossPhase`,
`bossAttack`, `bossSplit`, `bossDash`, `playerHurt`, `dodge`, `block`, `heal`,
`xp`, `coin`, `heart`, `levelUp`, `choice`, `chosen`, `roomEnter`, `roomClear`,
`doorOpen`, `roomExit`, `devilAppears`, `chapterClear`, `floorUp`, `enemyFire`,
`enemyWind`, `boom`, `slam`, `beam`, `charge`, `crash`, `land`, `emerge`,
`burrow`, `submerge`, `teleport`, `summon`, `roar`, `freeze`, `bolt`,
`ricochet`, `arrowBounce`, `arrowWall`, `bulletPop`, `spiritShot`, `star`,
`aegisReady`, `spikes`, `revive`, `death`.

---

## Testing

See [dev/README.md](dev/README.md).

- `node game-046/dev/simtest.mjs` — the bot plays every chapter headlessly and
  every tick is checked (no NaN; player and enemies inside the room and never on
  rock or in a pit); runs must end; determinism; Endless; `js/sim/` purity.
- `node game-046/dev/browsertest.mjs` — real Chromium + WebGL: title, talents,
  a run through doors, level-ups, an angel room, a boss, results, every biome,
  and touch-only play on portrait and landscape phones.

Bugs these caught before anyone played it: line of sight that skipped a tile
corner (the bot stood forever shooting into a rock); flyers parked over rock
where arrows could not reach them, then (once rock blocked them) bats pinned
against rocks until they got their own path field; auto-aim preferring a nearer
enemy behind a wall to a visible one; wide bodies — golems, elites — spawning in
pockets or wedging into one-tile gaps they could never pass (now a wide-body
path field, wide-only spawn tiles and a brief "squeeze" if one is stuck anyway);
the Slime King's landing blast and body contact double-dipping; the Lich's
summons pinning a weak build forever; a revive clearing the bullet list
mid-loop; knock-back banked during an enemy's spawn-in flinging it out of the
room; the room fade never lifting after a chapter clear (a black title screen);
pits hidden under the outer ground plane; a stray NaN fragment that the bloom
blur smeared across the whole frame (a black screen on some rooms — now scrubbed
before bloom); a clipped title on landscape phones;
and — deep in Endless — Headshot ignoring HP scaling, an empty level-up roll and
a Devil with nothing to sell freezing the run.

---

## Changelog

### v1.0 (2026-09-29)
- Initial release: simulation, procedural rooms and art, ten chapters, Endless, talents, tests.
