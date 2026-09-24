# POPGUN PIP — Game Design Document

**Genre:** 8-bit side-scrolling platformer (Mario-shaped worlds) with Metroid-style unlocks and shooting
**Tech:** vanilla HTML / CSS / ES modules, Canvas 2D, Web Audio. No libraries, no build step, **no asset files**
**Status:** implemented (v1, 2026-09-24). Verification: see [dev/README.md](dev/README.md).
**Target:** phones first (portrait and landscape), desktop keyboard and gamepad equally supported
**Tone:** light-hearted. Nobody dies horribly; things go *pop*.

---

## 1. Pitch

King Grumblewort woke up on the wrong side of the castle, stomped on the Sun, and shattered its shine
into **Sun Shards** that rained across the five Popple Isles. Everything went grumpy. Worse, his
Grumble goons raided Grandma Pip's workshop and carried off her inventions — spring boots, a frost
ray, sticky mitts and a rocket popper — and handed one to each of his island bosses.

**Pip** — a round pom-pom of a creature with a cork popgun — sets off to hop, pop and stomp across the
isles, win Grandma's gadgets back one boss at a time, and collect enough shards to open the Keep and
put the shine back in the sky.

The hook is the fusion:

| Borrowed from | What it gives POPGUN PIP |
|---|---|
| **Mario** | worlds of short, readable left-to-right levels on an overworld map; stomping; `?` blocks, bricks, coins, pipes, flagpoles, checkpoints; temporary power-ups; lives and 1-ups |
| **Metroid** | a gun and a growing arsenal; **permanent abilities that open paths you've already seen**; sealed vaults with heart containers and weapons; a reason to go back |
| **Arcade** | score, combo-stomps, a tight 8-bit look, chiptune music, instant restarts |

The linking idea: **every level is generated with pockets you can see but can't reach yet**. A ledge
too high, a wall of red rock, a shaft too tall to climb, a stair of bubbles that pop when you touch
them. Beat a boss, get a gadget, and the map lights up the levels where that gadget now opens
something.

---

## 2. Core loop

```
Overworld map ──► pick a level ──► "WORLD 2-3" card ──► play ──► flagpole / boss
      ▲                                                             │
      └──── new gadget? map shows which old levels it opens ◄───────┘
```

* **Minute to minute:** run, jump, stomp, shoot, bump blocks, grab coins.
* **Level to level:** reach the flag. Find the 3 Sun Shards: one on the route, one hidden with the
  moves you have, one usually behind a gadget gate.
* **World to world:** beat the boss in the castle, win a gadget. Five worlds, the fifth is the Keep.
* **Across the game:** revisit levels with new gadgets for shards, heart containers, weapons and
  power chips. The Keep's door needs **36 of 60** shards.

A player who never backtracks can still reach 40 shards (route + hidden) so the game is finishable
without backtracking, but only just — the vaults hold the extra hearts and weapons that make the
Keep comfortable.

---

## 3. Pip — moves and abilities

| Move | Input | Notes |
|---|---|---|
| Run | ←/→ | always-run: no run button (phone friendly). Accel/decel, not instant |
| Jump | A | variable height (release early = short hop), 6-frame coyote time, 6-frame jump buffer |
| Stomp | land on an enemy | bounce; hold A for a higher bounce; chained stomps score 100-200-400-800-1000-1UP |
| Shoot | B (hold to autofire) | fires the current weapon forward, **up** if ↑ is held |
| Ground Pound | ↓ in the air | plummets, breaks bricks and cracked floors below, flattens enemies |
| Swap weapon | C / SWAP | cycles the weapons you own |

### Gadgets (permanent, boss rewards)

| # | Gadget | Boss | Does | Gate it opens |
|---|---|---|---|---|
| 1 | **Spring Boots** | Chompo (World 1) | double jump | high ledges (5–6 tiles) |
| 2 | **Frost Ray** (weapon) | Sir Sandsnake (World 2) | shots freeze enemies into ice blocks you can stand on; freezes **bubble blocks** solid | bubble staircases to 8–9 tile ledges |
| 3 | **Sticky Mitts** | Glimmerjaw (World 3) | wall slide + wall jump | tall narrow shafts |
| 4 | **Rocket Popper** (weapon) | Nimbus Grump (World 4) | slow heavy rockets, splash damage | **red rock** walls |

### Vault items (permanent, hidden in levels)

| Item | Count | Effect |
|---|---|---|
| Heart Container | 4 | +1 max heart (3 → 7) |
| Spread Shot (weapon) | 1 | 3-way short-range pop |
| Power Chip | 3 | +1 damage for every weapon, each |

Vault items are placed by a fixed table (which world, which gate type) so every seed has the same
shape of progression; the generator decides *where* in the level.

### Health and failure

* Hearts, Metroid style. Start with 3.
* **Falling in a pit or lava costs one heart**, not a life: Pip pops back up on the last safe ground
  with a moment of invulnerability. Light-hearted, and it keeps phone players (whose thumbs slip)
  in the game.
* Out of hearts → lose a life → restart from the checkpoint with full hearts.
* Out of lives → GAME OVER → back to the map with 5 lives. **Progress is never lost.**
* 100 coins = 1-up.

---

## 4. Weapons

| Weapon | Fire rate | Damage | Behaviour |
|---|---|---|---|
| Pea Popper | 6/s | 1 | straight, medium range. Breaks nothing |
| Spread Shot | 4/s | 1 ×3 | three pellets fanned ±15°, short range |
| Frost Ray | 3/s | 1 | freezes a non-boss enemy for 5s into a solid ice block; freezes bubble blocks for 8s |
| Rocket Popper | 1.6/s | 4 | slow, accelerating; explodes in a 1.5-tile splash; breaks red rock and bricks |

Hot Pepper (a temporary power-up) doubles fire rate and makes shots pierce.

---

## 5. Temporary power-ups (from `?` blocks)

| Power-up | Effect | Duration |
|---|---|---|
| Coin | +1 coin | — |
| Berry | +1 heart (slides along the ground like a mushroom) | — |
| Rainbow Star | invincible, touch kills, faster run, its own music | 8s |
| Hot Pepper | rapid fire + piercing | 12s |
| Bubble Shield | absorbs one hit | until hit |
| Pip Plush | 1-up | — |

Hidden blocks (invisible until bumped from below) exist and are always rewarding.

---

## 6. Worlds

| # | World | Look | Special terrain | Enemies | Boss |
|---|---|---|---|---|---|
| 1 | **Sprinkle Meadows** | blue sky, green hills, clouds | pipes, ? rows, gentle gaps | Grumblebug, Snailbert, Buzzbee, Hopfrog, Chomper | **Chompo** — a giant Grumblebug that hops and quakes the floor, spilling little bugs |
| 2 | **Fizzy Dunes** | peach sky, dunes and pyramids | spikes, sand steps | Grumblebug, Pricklepuff, Cactopus, Hopfrog, Spitshroom, Buzzbee | **Sir Sandsnake** — a segmented worm that arcs out of the sand; hit the head |
| 3 | **Glimmer Grotto** | dark cave, glowing crystals | low ceilings, stalactites | Flapbat, Glintling, Snailbert, Pricklepuff, Chomper, Spitshroom | **Glimmerjaw** — a crystal golem that fans shards; only hurt while its eye is open |
| 4 | **Cotton Skies** | sunset, cloud banks | one-way clouds, moving platforms, springs, bottomless pits | Buzzbee, Drizzle, Hopfrog, Pricklepuff, Snailbert | **Nimbus Grump** — a storm cloud that marks then drops lightning |
| 5 | **Grumble Keep** | red stone, lava | lava pits, firebars, crushers | Grumblock, Lava Bubble, Pricklepuff, Spitshroom, Snailbert | **King Grumblewort** — three phases: hop & fireballs, flying pot & bombs, shockwave rage |

Each world: **4 levels + 1 castle** (25 levels). The castle level is shorter, harder, and ends in the
boss arena. The Keep's castle is sealed until 36 shards.

---

## 7. Enemies

| Enemy | Behaviour | Stomp? | HP (shots) |
|---|---|---|---|
| Grumblebug | walks, turns at walls | ✓ | 1 |
| Snailbert | walks; stomp → shell; touch shell → kick; sliding shell kills enemies | ✓ (→ shell) | 3 |
| Hopfrog | hops toward Pip | ✓ | 2 |
| Buzzbee | flies a sine wave | ✓ | 1 |
| Pricklepuff | spiky walker | ✗ hurts | 2 |
| Spitshroom | stationary, lobs a spore every 2.5s | ✓ | 2 |
| Cactopus | stationary, fires needles left and right | ✗ | 3 |
| Chomper | rises from a pipe; stays down while Pip is next to the pipe | ✗ | 2 |
| Flapbat | hangs from the ceiling, swoops when Pip passes below | ✓ | 1 |
| Glintling | crystal slime; splits into two minis when shot | ✓ | 2 |
| Drizzle | floats above Pip dropping raindrops | ✓ | 2 |
| Grumblock | stone crusher, falls when Pip is under it | ✗ | invulnerable |
| Lava Bubble | leaps out of lava | ✗ | invulnerable |
| Firebar | rotating chain of fireballs | — | hazard |

Frozen enemies become ice blocks: solid, stand-on-able, and shatter after 5s (or when a rocket hits).

---

## 8. Procedural generation

Everything grows from **one save seed** chosen at New Game. `seed(world, level)` is a hash, so a level
is the same every time you revisit it — which is what makes "I saw a ledge there" a real memory.

### Levels

A level is a 24–30 tile high, 140–230 tile long grid built left to right from **segments**:

`flat`, `gap`, `stairs`, `pipes`, `qrow` (`?` blocks and bricks), `hills`, `floaters` (platforms over
a pit), `spring`, `spikes`, `lift` (moving platform), `crushers`, `firebar`, `lavapit`, `cave-low`,
`shell-run`…

Each theme has a weighted segment table; difficulty (gap width, enemy density, hazard count) rises
with world and level. Gaps and steps are bounded by what Pip can do **with the gadgets the world
assumes you have** (World 2 levels can assume Spring Boots, and so on).

Between segments the generator inserts **pockets**:

| Pocket | Built as | Needs |
|---|---|---|
| High ledge | a floating shelf 5–6 tiles up | Spring Boots |
| Bubble stair | a floating shelf 8–9 tiles up, bubble blocks every 3 | Frost Ray |
| Shaft | a 2-wide chimney 11+ tiles tall ending in a room | Sticky Mitts |
| Red vault | a room sealed with red rock | Rocket Popper |
| Basement | cracked floor over a hidden room | Ground Pound (always) |
| Hidden blocks | invisible `?` blocks | nothing — just curiosity |

Each level gets 3 shards: A on the route, B in a pocket the world's baseline moves can reach, C in a
pocket that needs the next gadget (or a later one). Vault items go into specific pockets by table.

### Solvability is tested, not assumed

`js/validate.js` runs the **real player physics** from every standable cell with a set of input
programs (walks, jumps of four heights with three run-ups, double jumps at three timings, and a
reactive wall-climb) and records where Pip lands. That gives the set of reachable cells for any set of
gadgets. The generator's contract, enforced by `dev/gentest.mjs` over many seeds:

1. The goal is reachable with the world's baseline gadgets.
2. Shards A and B are reachable with the baseline.
3. Each gated pocket is **not** reachable without its gadget and **is** reachable with it.

At runtime the generator validates the critical path and re-rolls a sub-seed on failure.

### Graphics

* Tiles are generated per theme from the NES 2C02 palette: dithered dirt, grass tufts, brick courses,
  crystal facets, cloud puffs, castle stone — with seeded speckle so no two runs look identical.
* Backgrounds are 3-layer parallax built procedurally: sky bands, then hills / dunes & pyramids /
  stalactites / cloud banks / castle pillars.
* Characters are hand-authored 16×16 pixel strings drawn with per-world palette swaps; bosses are
  32×32 and larger, some built from parts (Sandsnake's segments).

### Music

A small **chiptune composer**: from a seed and a mood (key, mode, tempo, progression pool, drum
feel) it writes an AABA song — a motif-based square-wave lead, an arpeggiated second square, a
triangle bass and noise drums — and a look-ahead scheduler plays it. Each world has its own mood; each
level gets its own song in that mood. Fixed jingles for course clear, death, 1-up, gadget get, game
over.

---

## 9. Screens

1. **Title** — logo, drifting clouds, Pip bouncing. CONTINUE / NEW GAME / SOUND.
2. **Map** — one island per world, nodes along a dotted path. Each node shows ★★☆ shards and gate
   icons for gates seen there (grey = gadget missing, lit = gadget owned and something still inside).
   ←/→ walk, A enter, arrows at the edges to change island.
3. **Level card** — "WORLD 2-3 · FIZZY DUNES", Pip × lives.
4. **Play** — HUD: hearts, coins, lives, weapon, shard slots, score.
5. **Pause** — RESUME / EXIT TO MAP / MUSIC / SOUND, plus a controls reminder on keyboard.
6. **Gadget get** — Metroid-style item fanfare panel explaining the new move.
7. **Game over**, **Ending** (the sun relit, credits, stats).

---

## 10. Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | ←/→, A/D | d-pad / left stick | D-pad (slide between directions) |
| Aim up / pound | ↑ / ↓ | d-pad | D-pad |
| Jump | Z, Space, K | A (south) | **A** |
| Shoot | X, J | B/X | **B** (hold) |
| Swap | C, L, Shift | Y / shoulder | **SWAP** |
| Pause | Enter, P, Esc | Start | ‖ |

Phone layout: **portrait** puts the game view on top and a controller deck below (like a handheld);
**landscape** fills the screen and floats the controls in the lower corners. Every control ≥ 48 CSS px.

---

## 11. Rendering

* One canvas whose backing store **is** the game's pixel buffer. Its internal resolution is chosen so
  that the browser scales it up by an **integer** number of device pixels (5× on a typical phone) —
  pixel-perfect, no shimmer, no blit pass. Internal height is 200–320 px, width up to 480 px; the
  view simply sees further on a wider screen.
* Tiles pre-rendered per theme into an atlas canvas; backgrounds into wide strips; sprites baked once
  per palette.

---

## 12. Architecture

```
js/rng.js        seeded RNG + hash
js/config.js     every tuning number: physics, weapons, worlds, items, scoring
js/tiles.js      tile ids and their properties (solid, one-way, hazard, breakable…)
js/physics.js    pure body-vs-tile collision + the player's movement step (shared with validate)
js/levelgen.js   pure: seed → level
js/validate.js   pure: level + gadgets → reachable cells
js/game.js       pure simulation: player, enemies, bosses, projectiles, items, camera, events
js/enemies.js    enemy behaviours      js/bosses.js   boss behaviours
js/art.js        NES palette, sprite strings, procedural tiles & backgrounds (canvas)
js/font.js       5×7 bitmap font
js/render.js     draws a Game into the pixel buffer + HUD
js/screens.js    title, map, card, pause, gadget, game over, ending
js/audio.js      SFX + chiptune composer/sequencer
js/input.js      keyboard, gamepad, touch deck
js/save.js       localStorage (guarded)
js/main.js       boot, layout, fixed-step loop (60 Hz), screen state machine
```

Rules carried over from earlier games in this repo (docs/generic/learnings.md):

* The simulation is pure: no DOM, no `Math.random` — a Node harness plays the real game.
* Fixed timestep with edge-triggered inputs consumed on the first sub-step only.
* A bounded event queue from sim to audio/render.
* `%` is remainder: use a real modulo for animation frames.
* One keydown listener.
* Pointer-type-aware input: touching the screen shows the deck, a key press hides it.
* `localStorage` wrapped in try/catch.
* Assert control geometry in a phone test (sizes, overlaps) driven by real CDP touch input.

---

## 13. Scoring

| | |
|---|---|
| coin | 50 |
| enemy (shot) | 100 |
| stomp chain | 100 → 200 → 400 → 800 → 1000 → 1UP |
| brick | 50 |
| shard | 1000 |
| flagpole | 100–5000 by grab height |
| time bonus | 10 per second left |
| boss | 10000 |

---

## 14. Verification plan

| Harness | Checks |
|---|---|
| `dev/gentest.mjs` | many seeds × 25 levels: goal and shards A/B reachable with baseline; every gate unreachable without and reachable with its gadget; no enemy spawned inside terrain; generation cost |
| `dev/simtest.mjs` | real sim in Node: physics numbers (jump heights, gap widths), stomp, shots, blocks, power-ups, pits, checkpoint, flag, each boss killable by a bot, save round-trip, determinism |
| `dev/shots.mjs` | real Chromium screenshots of every screen and theme at phone portrait, phone landscape, desktop; fails on console errors |
| `dev/mobiletest.mjs` | phone emulation driven only by CDP touch: start, walk, jump, shoot, pause; control sizes and overlaps |
