# BUBBLE NEBULA

**Genre:** Single-screen arcade platformer: a Bubble Bobble clone set in space
**Engine:** three.js r165 (import map, ES modules), no asset files: every model, texture, sound and tune is generated in code
**Status:** v1.0.0

---

## Concept

The Void Baron, a round purple villain in a top hat and monocle, has bottled every star in the Bubble Nebula and hidden them at the top of his space station. **Pip**, a baby star-dragon in a fishbowl helmet, climbs the station one sector at a time, blowing bubbles at the Baron's crew, trapping them, popping them, and collecting the loot they leave behind.

It plays like Taito's **Bubble Bobble** (1986): one screen per round, platforms you jump up through, bubbles that trap enemies and float up on an air current, chains of popped bubbles that double the loot, enemies that break out angry, a HURRY UP! warning and an unkillable ghost if you dawdle, special bubbles, EXTEND letters, and a boss at the end you can only hurt with lightning. Everything is re-themed for space, and the station's sectors run through five zones with their own colours and sky before the Baron's core.

The tone is cheerful and toy-like: neon-edged hull plates, a painted nebula behind the station, bouncy chiptune music, a cast of wind-up robots, jellyfish and little saucers.

## Core loop

One **sector** (about 30–60 s):

1. **Intro** (1.5 s): Pip rides a bubble to the bottom-left; the crew drops in from above.
2. **Play:** blow bubbles at the crew, pop the trapped ones (ideally several at once), dodge everything else.
3. **Clear:** the last enemy becomes loot. Up to 5 s to grab it (it ends as soon as it's all collected). Clearing in under 15 s gives +5000, under 25 s +2000.
4. **Warp** (1.8 s): the sector scrolls up and away, the next rises from below, and Pip rides a bubble to the start.

25 sectors make the run: 24 regular ones in five zones of five (the last zone has four), then **the Baron's Core**. Beating the Baron ends the game with a short story ending and the high-score table.

Dying costs a life; Pip respawns at the start with 2.6 s of invulnerability and the crew stays where it was. Losing the last life is **GAME OVER**: Continue restarts the same sector with the score at zero (an arcade continue), or go back to the title.

## Mechanics

All in `js/sim/`, all pure and seeded. Units are tiles; y grows downwards. The field is 32 × 26 tiles: columns 0–1 and 30–31 are walls, row 0 is the ceiling and row 25 the floor, both with the same 6-tile gap in the middle.

### Moving (`physics.js`, `game.js`)
- Pip is 1.5 × 1.7 tiles. Walk 6.6 tiles/s with full air control (Rocket Boots ×1.3).
- Jump at 23.5 tiles/s against gravity 58: a **4.76-tile** jump. Platforms are four rows apart, so every platform above you is one jump away. Fall speed is capped at 12.5.
- Holding jump hops again as soon as you land, as in the arcade.
- **Blocks are Bubble Bobble platforms:** rising passes up through them; falling lands on any block with space above it; a body on the ground or falling is stopped by blocks at its side, unless it is already inside one. A jump that peaks inside a block steps up onto it (if its top is within 0.95 of the feet).
- **Wrap:** whatever falls out of the floor gap drops back in through the ceiling gap. The ceiling only bumps heads; it is never a floor. Every sector is tested so that loot dropping in through the gap lands on a platform instead of falling forever.

### Bubbles
- **Blow** (X / J / K, ◯): a bubble (radius 0.95) dashes 5.2 tiles at 19 tiles/s in the direction you face (8.4 with Long Shot), then floats. Cooldown 0.3 s (Rapid Blower 0.17); holding the button repeats at ×1.5 the cooldown.
- A dashing bubble that touches a live enemy **traps** it. A bubble blown into a wall floats from there.
- Floating bubbles rise at 2.3 tiles/s and drift to the sector's **air current** (`air` in `levels.js`), pushing each other apart. Empty bubbles pop by themselves after 13 s (blinking for the last 2).
- A trapped enemy **breaks out** after 9 s (the bubble flashes red from 6 s), angry for the rest of its life.
- **Touching** a floating bubble pops it. Landing on one while holding jump **bounces** off it instead (empty and trapped bubbles; specials always pop).
- **Chains:** popping a bubble pops every bubble within 0.35 tiles of touching it, and every bubble touching those. The n-th enemy in one chain drops loot worth **500 × 2ⁿ⁻¹** (500, 1000, 2000 … 32 000). An empty bubble is 10.

### Loot (`ITEMS` in `config.js`)
A popped enemy spins off in an arc, bounces off the walls, and becomes loot where it lands. Loot scores when you touch it and fades after 12 s (it stays during the clear).

| Loot | Value | Look |
|---|---|---|
| Star Candy | 500 | a yellow star |
| Moon Cheese | 1000 | a crescent |
| Comet Cone | 2000 | an ice-cream cone |
| Ringed Planet | 4000 | a blue planet with a ring |
| Nebula Gem | 8000 | a pink octahedron |
| Galaxy Crown | 16 000 | a gold crown with a gem |
| Black Diamond | 32 000 | a dark diamond with cyan glints |
| Singularity | 64 000 | a black hole with an accretion ring |

### Special bubbles
Some sectors send special bubbles up through the floor gap every `zap` / `nova` seconds (at most four specials at once). They drift to the air current like the rest and last 18 s.
- **⚡ Zap:** popping it fires a bolt along its row the way you face, through walls, 22 tiles/s. Each enemy it crosses (live or trapped) dies for 1000, 2000, 4000…
- **✹ Nova:** popping it drops a fireball that lands on the platform below and spreads flames up to 5 tiles each way along it for 4 s. Flames kill the crew (same doubling values) and only stun Pip for 0.6 s.
- **Letters N·E·B·U·L·A:** one letter bubble (a letter you don't have) every 11–16 s. Collect all six for **EXTEND**: an extra life, and the sector is skipped (not in the last regular sector or the core).

### Power-ups
Once per sector, 8–14 s in, there's a 75% chance a power-up appears on a random platform away from you. The boots and candies last until you die.

| Power-up | Effect | Weight |
|---|---|---|
| Rocket Boots | run ×1.3 | 20 |
| Long Shot (pink candy) | bubble range 8.4 | 20 |
| Rapid Blower (blue candy) | cooldown 0.17 s | 20 |
| Stasis Clock | the crew freezes, harmless, for 7 s | 14 |
| Supernova | every enemy on screen pops for 2000 each | 6 |
| Wormhole | skip three sectors (never into the core) | 3 |

### HURRY UP! and the Void Wraith
After the sector's hurry time (42 s; 36–40 s later on) **HURRY UP!** sounds, the music speeds up and every enemy turns angry. 9 s later the **Void Wraith** drifts in from the ceiling gap and homes in on Pip through every wall, speeding up from 2.2 to 6.4 tiles/s. It can't be trapped. Dying sends it away and gives you at least 20 s before the next HURRY UP!.

### Lives and score
2 spare lives to start. Extra lives at 20 000, 60 000, then every 100 000, and from EXTEND. The top five scores (with the sector reached) are kept in local storage.

### The crew (`enemies.js`)

| Enemy | Size | Speed (angry) | Behaviour | First sector |
|---|---|---|---|---|
| **Blip** (wind-up robot) | 1.5 × 1.5 | 3.0 (5.0) | Walks; at an edge turns back or walks off (55/45); when you're above it, hops up to the platform over it; turns towards you on your row | 1 |
| **Spark** (coil spring with a star head) | 1.4 × 1.5 | 3.4 (5.4) | Hops in arcs, now and then a big one; turns towards you a third of the time | 3 |
| **Glooper** (space jelly) | 1.6 × 1.5 | 2.7 (4.3) | Floats diagonally and bounces off every block and wall | 6 |
| **Grunt** (alien trooper) | 1.6 × 1.7 | 2.3 (3.9) | Walks like a Blip without the hop; fires a plasma rock (8 tiles/s) along your row when it faces you, every 2.4 s (1.4 angry) | 9 |
| **Comet Moth** | 1.6 × 1.3 | 2.3 (3.6) | Drifts through everything towards a point near you that it re-picks every 1–2 s, with a wobble | 11 |
| **Saucer** (little UFO) | 1.9 × 1.1 | 2.9 (4.4) | Cruises wall to wall, changes height every 3–6 s, beams a laser straight down when you're under it | 15 |

### The Void Baron (`boss.js`)
5.2 × 5.2, 24 hit points. He bounces round his core like a pinball (4.0 tiles/s, up to 6.0 as he weakens) and throws fans of void orbs at you (5.2 tiles/s; three orbs, five below a third of his health; every 3 s, faster as he weakens). Bubbles can't hold him. Zap bubbles rise from the floor every 1.2 s (at most six) and just keep rising; a bolt from one **homes in on him** and knocks off one point. At zero he is caught in a giant bubble that floats to the middle of the core: pop it and he spins away, leaving the **Nebula Heart** (100 000). Collecting it wins the game.

## Content

25 sectors in `js/sim/levels.js`, written as half-maps that are mirrored (a 28-character row is used as is). Each sets its air current, hurry time and special bubbles.

| # | Sector | Crew | Specials |
|---|---|---|---|
| 1 | Docking Bay | 4 blip | |
| 2 | Stair Rings | 6 blip | |
| 3 | Twin Moons | 4 blip, 2 spark | |
| 4 | Antenna Array | 4 spark, 2 blip | |
| 5 | Ringworld | 4 blip, 2 spark | zap |
| 6 | Asteroid Belt | 4 glooper, 2 blip | |
| 7 | Satellite Dish | 2 glooper, 2 blip, 2 spark | zap |
| 8 | Greenhouse Dome | 4 blip, 2 glooper | nova |
| 9 | Grunt Barracks | 2 grunt, 2 blip, 2 spark | |
| 10 | Hydroponics | 2 glooper, 2 blip, 2 grunt | zap, nova |
| 11 | Comet Tail | 2 moth, 2 blip, 2 spark | |
| 12 | Plasma Vents | 2 grunt, 2 glooper, 2 moth | nova |
| 13 | Jelly Reef | 4 glooper, 2 spark | zap |
| 14 | Barracks Deck | 4 grunt, 2 blip | |
| 15 | Saucer Hangar | 2 saucer, 2 blip, 2 spark | zap |
| 16 | Foundry Gate | 2 saucer, 2 grunt, 2 moth | nova |
| 17 | Spring Works | 4 spark, 4 blip | zap |
| 18 | Jellyfish Lagoon | 4 glooper, 2 saucer | zap |
| 19 | Moth Nursery | 4 moth, 2 grunt | nova |
| 20 | Comet Forge | 4 spark, 2 saucer, 2 grunt | zap, nova |
| 21 | Void Deck | 2 saucer, 2 grunt, 2 glooper, 2 moth | zap |
| 22 | Event Horizon | 2 glooper, 2 grunt, 2 blip, 2 spark | nova |
| 23 | Saucer Swarm | 4 saucer, 2 moth | zap |
| 24 | The Baron's Gate | 2 moth, 2 grunt, 2 spark, 2 blip | zap, nova |
| 25 | The Baron's Core | the Void Baron | zap (always) |

Zones: **Docking Ring** (1–5, cyan), **Asteroid Gardens** (6–10, green and gold), **Nebula Reef** (11–15, pink and violet), **Comet Foundry** (16–20, orange), **Void Deck** (21–24, pale blue on black), and **the Baron's Core** (purple).

## Story

The title tagline and the HUD carry it: *the Void Baron has bottled the stars; pop his crew, sector by sector.* The ending (four short paragraphs in `js/ui.js`) shows the stars tumbling out of his hat, the nebula lighting up again, and the Baron, shrunk to the size of a plum and very sorry, living on Pip's mantelpiece in a bubble. The game has a defined ending; the score table is the replay hook.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | ← → / A D | Stick / d-pad | ◀ ▶ (one zone: slide between them without lifting) |
| Jump | Z / Space / ↑ / W | A | JUMP |
| Blow a bubble | X / J / K | B or X | ◯ |
| Pause | P / Esc | Start | ❚❚ |
| Menus | ↑ ↓, Enter / Space / Z | d-pad, A, B back | tap |

## Look and sound

- **Camera:** a 30° perspective camera looking straight at the field from the front, placed so the whole 32 × 26 field fits the part of the screen that the HUD and the touch deck leave free (beside the deck in landscape, above it in portrait). It sways slightly, and shakes on pops, zaps and deaths.
- **Station:** each block is an instanced box with a hull-plate texture and an emissive neon frame in the zone's colour, so bloom picks up the frames and not the plates. The side walls are darker vented panels. Behind the field: a translucent back panel, a nebula painted by an fbm shader in the zone's three colours, three layers of twinkling stars and two slow planets.
- **Bubbles:** one instanced draw with a thin-film shader (fresnel rim, drifting rainbow interference, a specular glint), tinted per bubble: cyan, red when about to break, yellow zap, orange nova, pink letters. Icons (letters, a lightning glyph, a star) are canvas sprites.
- **Models** (`js/view/models.js`, judged on `dev/models.html`): Pip (a green star-dragon with a cream belly, orange back spikes, a fishbowl helmet and a little antenna), wind-up Blips with a turning key, Sparks on a coiled spring, see-through Gloopers, Grunts with a red visor and a blaster, Comet Moths with see-through wings and a glowing tail, Saucers with blinking rim lights, the hooded Wraith, and the Baron with his top hat, monocle and moustache. Angry enemies flash red; frozen ones turn blue.
- **Effects:** a pooled additive particle system, rising score and chain labels sized to their text, lightning bolt quads, flame sprites, glowing enemy shots.
- **Sound** (`js/audio.js`, all Web Audio): a look-ahead sequencer playing three original tunes, a bouncy major-key main theme (it speeds up ×1.35 at HURRY UP!, as the arcade does), a minor-key boss theme and a soft title version, with square lead, triangle bass, arpeggios, kick, snare and hats. Effects for blowing, trapping, popping (pitched by trapped/empty), chains (rising notes), bouncing, loot, letters, EXTEND, 1UP, zap, nova, hurry, the Wraith, dying, power-ups and every Baron moment.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes (title with the attract demo, play, over, ending), the fixed-step loop, input routing, layout insets for the camera, debug hooks |
| `js/sim/game.js` | The rules: sectors and phases, the player, bubbles and chains, loot, specials, power-ups, hurry and the Wraith, lives, saves |
| `js/sim/physics.js` | Tile queries, the platformer body mover, wrap, standing segments |
| `js/sim/enemies.js` | The six crew types' AI, popping |
| `js/sim/boss.js` | The Void Baron |
| `js/sim/levels.js` | The 25 sector maps, zones and the level builder |
| `js/sim/nav.js` | The jump graph: what you can reach from where, by real simulated jumps |
| `js/sim/bot.js` | The auto-player (tests, balance, attract mode) |
| `js/view/` | `stage.js` (renderer, camera fit, bloom), `backdrop.js` (nebula, stars, planets), `tiles.js` (a sector's blocks), `models.js`, `bubbles.js`, `fx.js`, `view.js` (reads G, answers events, the warp scroll) |
| `js/ui.js` | DOM screens, HUD, banners, high scores, the ending |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge with latched taps, sound, guarded storage and the score table, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity and the version stamp, proves every sector's platforms, spawns, air current and top gap reachable on the jump graph, tests every rule above, checks determinism and save round trips, and has the bot play the whole campaign on six seeds at two skills. `browsertest.mjs` drives the real game on desktop (all the way from New Game to the ending), touch-only phones in both orientations, and with storage blocked.

## Balance notes

From the bot table (`ONLY=bot SEEDS=6`):
- The first boss had 30 hit points, fans of five and seven orbs, and bolts that flew straight along their row; the best bot spent 6 minutes and 67 deaths there and once never finished. Bolts that home in on him, 24 hit points, fans of three (five below a third of his health) and slower orbs brought the fight to about 75 s and 5 deaths for the best bot.
- The first bot sidestepped one orb into the next. It now scores each possible move (left, right, still, with or without a jump) by how close it comes to anything lethal in the next 1.2 s and takes the safest. That alone halved its deaths in the regular sectors.
- The bot used to flee from an enemy it was lined up to shoot. Enemies in its line of fire are now ignored when it judges danger, and it waits 3.2 s (not 4.6) before popping for a chain, so trapped enemies stop breaking out while it walks over.
- Two air currents sat where no jump could reach them (Asteroid Belt, Foundry Gate): bubbles would have gathered out of reach. The level test caught both; the currents moved.
- Now: the best bot clears a regular sector in 25–70 s with about 1.2 deaths, and the whole campaign in about 20 minutes with about 29 deaths, so it needs a few continues; the weaker bot dies about 50 times. The bot is not a person: humans will be better at chains and worse at dodging fans of orbs. The best chain the bot makes is 3; chains of 5–7 are there for players who wait.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- Two-player co-op (Bub and Bob) is the most famous part of Bubble Bobble and isn't here. The sim keeps one player; a second would mean `G.players` and a second input set.
- More special bubbles (water/flood) and Bubble Bobble's secret-condition power-ups.
- The portrait phone view is small (the width limits it); the game suggests turning sideways.

## Changelog

### v1.0.0 (2026-10-16)
- First release: 25 sectors in six zones, six crew types, the Void Wraith and the Void Baron; blowing, trapping, chains, bouncing, wrap-around, zap and nova bubbles, N·E·B·U·L·A letters and EXTEND, six power-ups, HURRY UP!, lives, continues, saves and a high-score table.
- A three.js view with neon hull plates, a nebula sky, thin-film bubbles, procedural models and the sector-to-sector scroll; a sequenced chiptune soundtrack.
- Keyboard, gamepad and touch (a slide-between ◀ ▶ zone, JUMP and ◯); the field fits beside or above the touch deck.
- A jump-graph planner that proves every sector reachable, a bot that beats the campaign, and sim and browser harnesses.
