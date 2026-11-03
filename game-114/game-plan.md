# LAST COLONIST

**Genre:** Run-and-gun side-scrolling shooter (arcade)
**Engine:** three.js r165, no asset files: 2D pixel-art sprites painted in code and lit as if in 3D
**Status:** v1.0.0

---

## Concept

The colony ark HALCYON has drifted for three hundred years with 4,000 sleepers aboard. Your cryo pod opens early: the deck lights are red and every pod on your row is torn open. The Hive came aboard while you slept, and it has been carrying the colonists home in cocoons to feed its young. You are the last colonist awake. Fight through four decks of the ship, follow the Hive ship down to its homeworld, cross four more sectors to the Queen's Larder, and bring the others home before they become alien food.

Minute to minute it is a tight arcade run-and-gun in the Contra and Metal Slug tradition: you run right, jump gaps and acid, aim eight ways, hold fire, and blow apart whatever crawls, flies or spits at you. Along the way you shoot open cocoon pods to free colonists (each one patches you up), grab weapon capsules, and throw flares that light up the room and then explode. Every second sector ends in a boss that locks the room.

The look is the point as much as the shooting: flat pixel sprites, but lit like a 3D scene. Every sprite has a normal map made from its shape, so a muzzle flash, a passing rocket, a burning flare or a wall lamp shades it from the side it comes from. Tiles form a shallow diorama that recedes to a back wall, glowing acid lights the pits, and bloom, chromatic aberration on hits, scanlines and a vignette finish the frame.

## Core loop

A **sector**: a briefing from KESTREL, the ark's ship-mind → run right through 6–9 seeded chunks of corridor, canyon or hive → free the pods, pick up a weapon, pass checkpoint beacons → either walk through the exit door or fight the boss in a locked arena → a tally (colonists freed, time, bonuses) → the next briefing. Eight sectors make a campaign. Losing every life is Game Over; Continue restarts the sector with the score you entered it with.

## Mechanics

### Movement (js/sim/game.js, js/sim/physics.js)
- y is up; 1 world unit = 1 tile = 16 sprite pixels. The player is 0.7 × 1.7 (1.05 crouched).
- Run speed 7.5; gravity 48; jump velocity 19.5 (a full jump rises ~4 tiles and carries ~6 tiles at a run). Releasing jump while rising multiplies the rise by 0.45 (a short hop). Coyote time 0.09 s, a 0.12 s jump buffer.
- One-way platforms: jump up through them, stand on them, **Down + Jump** drops through.
- Down on the ground (with little sideways input) crouches and stands still; stand up only with room.
- Acid hurts (1 hit) and bounces you out. Falling into a pit costs a hit and puts you back on the last safe ground.

### Aiming and weapons
- Eight-way aim from the stick or keys: Up alone points straight up (and stands still), Up + side runs and aims diagonally, Down + side on the ground aims diagonally down while running, Down in the air aims down. Crouching fires forward low (the only shot that hits a hiveling on the floor).
- Fire is held. A tap shorter than one step still fires once (presses are latched until a step consumes them).
- **Blaster** (default): 0.13 s, 1 damage. **Spread** (S): five bolts in a fan, 0.24 s. **Lance** (L): 3 damage, pierces every enemy in a line. **Rocket** (R): 3 damage plus a 2.3-tile blast. A weapon stays until you lose a life.
- **Flares** (3 at the start, max 5, +2 per pack): thrown in an arc, they bounce, light the room for 1.25 s (or go off at once on contact), then explode for 9 damage in 3.4 tiles and wipe out every enemy shot in that radius.

### Health, lives, scoring
- 5 health (4 on Hard), 1.4 s of invulnerability after a hit, 3 lives, an extra life every 30,000 points.
- Pods take 3 hits to open; each freed colonist is 1,000 points and +1 health. Kill scores per enemy type. Sector bonuses: 2,000 for the clear, 3,000 for every pod opened, 2,500 for no lives lost.
- Checkpoint beacons every three chunks and one at each arena door. You respawn at the last one with the blaster.

### Enemies (js/sim/enemies.js)
Spawn markers wake up 17 tiles ahead of you. Health scales with the sector (+7% each) and their speed and fire rate with a difficulty factor (+5% each).

| Enemy | Hitbox | HP | What it does |
|---|---|---|---|
| Skitter | 0.9 × 0.7 | 2 | Patrols, chases within 9 tiles, leaps at you from close range, won't walk off ledges or into acid |
| Hiveling | 0.55 × 0.6 | 1 | A small fast skitter that hatches from nests and the Queen's eggs |
| Wisp | 0.8 × 0.8 | 2 | Floats above you, then dives straight at you every 3–4.5 s; flies through walls |
| Spitter | 1 × 1.2 | 4 | A rooted acid plant that lobs globs to where you are going (two at a time from Sector 6) |
| Turret | 1 × 1 | 6 | Ship security: aims in eight directions and fires two-shot bursts, only with a clear line |
| Brute | 1.3 × 2.2 | 16 | Lumbers toward you, roars, then charges until it hits a wall or an edge |
| Nest | 1.6 × 1.3 | 10 | Hatches a hiveling every 3.4 s while fewer than three of its own are alive |

### Bosses (js/sim/bosses.js)
Each fights in a 24-tile arena that locks behind you. At half health (and the Queen's thirds) the boss changes phase, and KESTREL drops a med kit into the arena.

| Sector | Boss | HP | Patterns |
|---|---|---|---|
| 2 Hydroponics | The Brood Mother | 130 | Walks at you; lobs fans of acid; lays two skitters; roars and charges wall to wall (jump it) and is stunned when she hits it |
| 4 Command Spine | WARDEN-9 | 200 | Hovers and drifts; aimed five-shot bursts (three-way in phase 2); homing missiles you can shoot down; tracks you, slams down and sends shockwaves both ways along the floor (jump them) |
| 6 Bone Canyons | Gravemaw | 190 | A worm under the floor. A rumble tracks you, then locks: it erupts there (get out of the way), rises 7.5 tiles, fires rings of shots, sinks. Only hittable while up |
| 8 The Larder | The Hive Queen | 220 | Fans of spit; eggs that hatch hivelings; from phase 2 an eye beam across the room, low (jump) or high (crouch) after a flashing warning; in phase 3 she summons wisps |

## Content

### Sectors (js/sim/levels.js)
A sector is a start chunk, 6–9 chunks drawn by the seed from the sector's pool (never the same twice in a row), and an exit or arena chunk. The ship has a ceiling; the homeworld is open sky.

| # | Sector | Place | Chunks | Pods | Enemies | Ends in |
|---|---|---|---|---|---|---|
| 1 | Cryo Deck | Ark Halcyon · Deck 1 | 6 | 3 | skitter, wisp, turret | exit |
| 2 | Hydroponics | Ark Halcyon · Deck 4 | 7 | 4 | + spitter | the Brood Mother |
| 3 | Reactor Ring | Engineering | 8 | 4 | skitter, wisp, turret, brute; steam vents | exit |
| 4 | Command Spine | The Bridge | 8 | 4 | skitter, wisp, turret, brute | WARDEN-9 |
| 5 | Ashfall Wastes | Homeworld · The Landing | 8 | 5 | skitter, wisp, spitter, nest | exit |
| 6 | Bone Canyons | Homeworld · The Ribs | 9 | 5 | + brute | Gravemaw |
| 7 | Hive Spires | Homeworld · The Spires | 9 | 5 | all of them | exit |
| 8 | The Larder | Homeworld · The Queen's Chamber | 7 | 4 | all of them | the Hive Queen |

Fourteen chunks: start, exit, arena, hall, stairs, acid, bridge, tower, ledges, nest, vents, drop, cover, upper, pits. Design rules (proved by the reach test on every seed): enter and leave on the floor, steps up of at most 3 tiles, gaps of at most 4, nothing you must land on narrower than the planner can hit.

### Pickups
Weapon capsules float (two per sector, the first sector always has one), med kits and flare packs sit on the floor.

## Story (js/sim/data/story.js)

- **Intro**: you wake on the HALCYON to empty, torn pods.
- **KESTREL** briefs every sector: the Hive boarded eleven days ago; the Brood Mother lays the crawlers; the reactor vents on a timer; WARDEN-9 has been turned against the ship; the shuttle follows the Hive ship down; the homeworld's nests, the hollow canyons, the spires, and the Larder where 112 colonists are sealed in the walls.
- **Ending**: the Queen falls and the Larder opens. The text and title change with how many of the 34 pods you opened on the way: *Nobody Left Behind* (all), *The Ark Flies Again* (60% or more) or *The Last Colonists*. "You were the last colonist awake. You are not the last one any more."

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move / aim | Arrows / WASD | Stick / d-pad | Drag on the left (snaps to 8 ways) |
| Jump (hold for height) | Z / Space / K | A | JUMP |
| Fire (hold) | X / J | X, Y or RT | FIRE |
| Flare | C / L | B, LB or RB | FLARE |
| Drop through | Down + Jump | Down + A | Down + JUMP |
| Pause | P / Esc | Start | ❚❚ |

Settings: sound, music, graphics (High: 10 lights and bloom; Medium: 8 lights; Low: 5 lights, no bloom, 0.75 resolution), screen shake, auto-fire, difficulty (Normal / Hard: 4 health, tougher enemies and bosses), touch controls.

## Look and sound

- **Sprites** ([sprites.js](js/view/sprites.js)): every character, boss, pickup and prop is drawn pixel by pixel into one 1024² atlas, with a dark outline, a rim of shading, a separate emissive atlas (visors, eyes, egg sacs, lamps) and a normal map computed from each shape (a chamfer distance transform for the bevel plus a little of the brightness). One `MeshStandardMaterial` draws them all; a per-sprite attribute adds the white hit flash. See [dev/gallery.html](dev/gallery.html).
- **Lighting** ([stage.js](js/view/stage.js)): a fixed pool of point lights (10 on High) handed out every frame to whatever matters most near the camera: the suit lamp, muzzle flashes, rockets and lances, explosions, flares, the Queen's beam, boss eyes, wisps, pods, wall lamps (a few stutter on the ship) and acid. A fixed count means no shader recompiles.
- **Level** ([world.js](js/view/world.js)): tiles painted in code from each sector's palette, built as one merged mesh: front faces, tops and undersides receding 2.2 tiles to a back wall of panels with windows onto a nebula (the ship) or a low rock wall in front of two ridgelines, a sky and a planet (the homeworld). Acid is an animated shader that feeds the bloom.
- **Effects** ([fx.js](js/view/fx.js)): two quad batches (additive for light, alpha for smoke and debris) and a particle sim: muzzle flashes, tracers, sparks, gore, explosions with shock rings, dust, steam, rescue beams, ambient dust or ash.
- **Post**: UnrealBloom, then a grade pass (chromatic aberration that spikes on hits and blasts, faint scanlines and grain, a vignette, a red edge pulse at 1 health), then OutputPass with ACES.
- **Sound** ([audio.js](js/audio.js)): Web Audio only. A look-ahead sequencer plays original dark synthwave: a driving minor theme on the ship, a slower, stranger one on the homeworld, a boss theme, the title and an ending. Every weapon, hit, blast, roar, beam and rescue is synthesised.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title with the bot playing behind it, story, briefing, play, clear, over, won), the fixed-step loop, input routing, debug hooks |
| `js/sim/game.js` | `newGame`, `loadLevel`, `step`, the player, bullets, flares, pickups, checkpoints, clears, respawns, `continueGame`, `nextLevel`, saves |
| `js/sim/physics.js` | Tiles and the body mover (shared with the bot's planner) |
| `js/sim/levels.js` | Chunks, the eight sectors, the level builder |
| `js/sim/enemies.js`, `bosses.js`, `common.js` | Enemy and boss behaviour; shared damage, scoring and spawning helpers |
| `js/sim/bot.js` | The auto-player: a jump planner on the real body mover, a shot dodger, boss tactics |
| `js/sim/data/story.js` | Intro, briefings, endings |
| `js/view/` | `view.js` (camera, sprites, lights, events → effects), `stage.js`, `sprites.js`, `world.js`, `fx.js` |
| `js/ui.js`, `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | DOM screens and HUD, input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every chunk and every sector on many seeds, the rules (movement, weapons, flares, pods, death, continues, the exit, each boss), determinism and save round trips, has an invulnerable bot cross every sector on every seed (the reachability proof), and has mortal bots play whole campaigns. `browsertest.mjs` drives the real game by real keys from the title to the ending on desktop, by real touches on phones in both orientations, and with storage blocked.

## Balance notes

- The first bot runs had skitters and brutes killing it constantly; the fixes were game changes as well as bot ones: health 4 → 5, skitters leap from 3.2 tiles (was 3.6) and wait 2–3.2 s between leaps, wisps dive less often and slower, a brute winds up 0.7 s (was 0.55) and charges at 7.5 (was 8.5), sector scaling softened to +7% health and +5% speed per sector.
- Hiveling hitbox raised to 0.6 tall: at 0.45 even a crouched shot flew over it.
- The Queen went 420 → 320 → 260 → 220 HP, her spit fans from 7 bolts to 5 (and 7 in phase 3) at a wider spread and lower speed, and her eggs from 3 to 1 + phase. Gravemaw 240 → 190 and stays up 2.8 s. Bosses drop a med kit at each phase change.
- With those numbers (`SEEDS=6`), the skill-1 bot reaches the Larder every time and beats the Queen in half its runs within 15 continues, dying 7–64 times over a campaign (8–30 minutes); the skill-0.6 bot usually stalls at Bone Canyons. The bot is a poor dodger of aimed fans and reads leaping skitters late, so a person should do much better, but nobody has played it by hand yet.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU. The light pool and bloom are tuned on SwiftShader screenshots.
- Weapon pickups could stack levels (Contra's upgraded spread).
- A two-player mode would suit the genre.

## Changelog

### v1.0.0 (2026-11-02)
- First release: eight sectors (four aboard the ark, four on the Hive homeworld) built from fourteen seeded chunks, 34 colonist pods, four weapons and flares, seven enemy types, four bosses (the Brood Mother, WARDEN-9, Gravemaw, the Hive Queen), checkpoints, continues, three endings, Normal and Hard.
- Code-painted pixel-art sprites with emissive and generated normal maps under a pool of point lights; a tile diorama with glowing acid, back walls with windows onto space, homeworld skylines; bloom and a grade pass.
- Synthwave score and synthesised effects, all Web Audio.
- Sim tests (purity, chunks and sectors, rules, determinism, an invulnerable bot crossing every sector on every seed, mortal campaigns) and browser tests (desktop by keys to the ending, touch phones both ways, blocked storage).
