# STARSPIN

**Genre:** Roguelike slot-machine RPG (turn-based, deckbuilding by reel strips)
**Engine:** three.js r165 with custom GLSL shaders, no asset files
**Status:** v1.0.0, a complete run of three sectors; balance tuned by a bot

---

## Concept

A space fantasy slot machine RPG with a Slay the Spire style skill tree, three.js shaders and a retro-futuristic look.

The House, a casino station at the end of space, has stolen the stars. You fly the *Lucky Comet*, whose weapon is a **Fortune Engine**: a chrome one-armed bandit. Every symbol that lands on its payline fires. You spin, then spend a little Energy to nudge or respin reels toward a better line, then FIRE, and the enemies answer with the intents they showed. Between fights you add symbols to your reels (the reels are your deck) and climb **the Constellation**, a skill tree laid out like a Slay the Spire map: each star you light must join the last one, so the path you take is your build.

It riffs on Slay the Spire (intents, the branching map, a run of fights and bosses), Luck be a Landlord (symbols as the deck) and classic three-reel slots (nudges, holds, the lever), wrapped in an 80s outrun look: a striped retro sun, a neon grid floor, chrome and magenta.

SPINFRAME (game-048) is the repo's other slot-machine RPG. STARSPIN differs on purpose: one payline instead of many, explicit nudge and respin choices against visible neighbours, a deck you build by adding symbols to every reel, and a path-shaped skill tree rather than three skill trees.

## Core loop

One **run** is three sectors. Each sector is five stops:

| Stop | What happens |
|---|---|
| Fight | An encounter from the sector's *early* pool |
| Fight | From the *mid* pool |
| Waystation | Repair 35% of max hull, or strip one symbol from every reel |
| Fight | From the *mid* pool |
| Boss | Croupier Δ, the Nebula Wyrm, then The House |

Each won fight: pick one of three symbols to add to **every** reel (or skip), then spend the point you earned on the Constellation. A boss win also repairs the hull fully. Beating The House wins the run; reaching 0 hull ends it.

## Mechanics

### A turn
1. **SPIN** (free) lands every reel at random. The window shows each reel's payline symbol and its neighbours above and below.
2. Spend **Energy** (2 a turn, more from Capacitor, Supernova Heart and last turn's Ion Charges): **nudge** a reel one symbol up or down (1), or **respin** it (1). Spark Coil makes the first of these each turn free.
3. **FIRE** resolves the payline, then every living enemy acts.

### The payline
- Symbols group by kind. Every copy in a group of *n* is multiplied by `MULT[n]`: 1, ×1.5, ×2, ×2.5, ×3 for one to five.
- **Wild Stars** join the biggest group (ties go to the earlier kind in `SYMBOL_ORDER`). Alone, they fire as Starblades.
- **Static** does nothing, unless the Static Filter makes it a Wild Star.
- **Ion Charge** is never multiplied: +1 Energy next turn per copy.
- Starblade damage goes to your target, Comets hit every enemy, Hex Moons add Burn to your target, Aegis gives Block, Nova Mend repairs.
- Block soaks damage and is gone at the start of your next turn (halved instead with Aegis Memory). Burn ticks at the start of the enemy's turn, ignores Block and drops by one each tick.

| Symbol | Base | Effect |
|---|---|---|
| Starblade | 5 | Damage to the target |
| Comet | 3 | Damage to every enemy |
| Hex Moon | 2 | Burn on the target |
| Aegis | 5 | Block |
| Nova Mend | 3 | Repair |
| Ion Charge | 1 | +Energy next turn (unmultiplied) |
| Wild Star | — | Joins the biggest group |
| Static | — | Junk an enemy jammed in; gone after the fight |

The starting reels are three shuffled copies of: Starblade ×3, Aegis ×2, Comet, Nova Mend, Ion Charge.

### Enemies
Enemies show their next move (Slay the Spire intents) and cycle through a fixed list, normal enemies from a random point, bosses from the first. Moves: attack (optionally several hits, optionally with Block), Block, power up (+strength to every hit), heal the most hurt ally, and **jam**: insert Static into your reels for the rest of the fight. HP grows 8% per stop within a sector. `FOE.hp` and `FOE.dmg` in `config.js` scale every enemy and were fitted with the bot.

| Sector | Early | Mid | Boss |
|---|---|---|---|
| The Rust Rings | Scrap Drone; two Void Moths | Ring Pirate; Drone + Moth; two Drones | Croupier Δ |
| Nebula Reach | Comet Jackal; Nebula Squid | Prism Knight; two Jackals; Squid + Jackal | Nebula Wyrm |
| The House | Dealer Unit; two Luck Leeches | Chip Golem; Dealer + Leech; Golem + Leech | The House |

### The Constellation
Eleven rows. Six random walks climb from the bottom, each step moving at most one column and never crossing an edge already drawn; the stars are every cell a walk visited, so rows hold two to four stars. Rows 4 and 8 are **keystone** rows, each with an Extra Reel somewhere in it. The top is one star, the Supernova Heart, that every path reaches. You light any bottom star first, then always a star joined to the last one you lit. Points bank if you don't spend them.

| Star | Effect |
|---|---|
| Hull Plating | +8 max HP and repair 8 |
| Deflector | Start each fight with 6 Block (stacks) |
| Focusing Lens | +1 per Starblade and Comet (stacks) |
| Etch (Starblade, Comet, Hex Moon, Aegis, Nova Mend) | That symbol is 50% stronger (stacks) |
| Lucky Star | A Wild Star on every reel |
| Siphon Edge | Each Starblade in a firing group repairs 1 |
| Spark Coil | First nudge or respin each turn is free |
| Salvage Drones | Repair 5 after every won fight |
| **Extra Reel** (key) | +1 reel, up to five; a sixth would be +8 HP instead |
| **Capacitor** (key) | +1 Energy every turn |
| **Jackpot Core** (key) | Three or more of a kind get one more step (+1×) |
| **Twin Suns** (key) | Pairs ×2 instead of ×1.5 |
| **Static Filter** (key) | Static counts as a Wild Star |
| **Aegis Memory** (key) | Block halves at the end of a turn |
| **Supernova Heart** (top) | All damage +25%, +1 Energy every turn |

## Story

The House always wins: that is its law, and it took the stars to prove it. You win the run by breaking The House in its own casino, and every stolen star rolls back into the sky. There is no further story yet; the run is the game.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Spin, then Fire | Space / Enter | A | SPIN / FIRE |
| Select a reel | ← → / A D / 1–5 | D-pad ← → | Tap the reel |
| Nudge | ↑ ↓ / W S | D-pad ↑ ↓ | ▲ ▼, or swipe the reel |
| Respin | R / X | X | ⟳ |
| Target | T / Q | RB / LB | Tap the enemy's tag |
| Look at the Constellation | C | Y | ✦ |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

- **Sky**: one full-screen fragment shader. A striped retro sun (it moves into the gap beside the machine on wide screens), a scrolling perspective grid floor, a two-layer fbm nebula and hashed twinkling stars. Each sector has a palette (outrun magenta and cyan; violet; casino gold and red) that blends over a second or two.
- **The machine**: a rounded chrome cabinet lit by a RoomEnvironment PMREM, a canvas-texture marquee, chasing bulbs (instanced), a lever that pulls on SPIN, and a selection frame. Each **reel** is a flat quad whose shader wraps the strip texture round a drum with an asin warp, blurs it with seven taps while it spins, darkens toward the drum's edges, adds scanlines and flashes the payline on FIRE. Landing eases out with a small overshoot.
- **Enemies**: procedural models from primitives, drawn with one hologram shader: fresnel rim, scanlines, a white hit flash, and a hashed-voxel dissolve for deaths. Every model has its own idle animation.
- **Post**: UnrealBloom (threshold 1.1, so only `toneMapped: false` neon and the hottest highlights glow), a CRT pass (chromatic fringe toward the edges, fine scanlines, vignette, a red edge when you're hit, at most twice a second), ACES tone mapping.
- **Calm visuals** (defaults on with `prefers-reduced-motion`): less bloom, fringe and shake; the bulbs stop chasing and the grid barely moves.
- **Glyphs**: every symbol, star and intent icon is drawn in Canvas 2D (`js/glyphs.js`), baked into the reel textures and used as data URLs in the DOM.
- **Sound**: Web Audio only. A look-ahead synthwave sequencer (kick, snare, hats, sawtooth bass, a square arpeggio through a slapback delay) with a key, progression and tempo per sector. Effects for the lever, reel clicks and landings, nudges, every hit, jams, jackpots and the end of a run. The title's attract mode is silent.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the event show, action queue, input routing, attract mode, debug hooks |
| `js/sim/data.js` | Symbols, enemies, sectors, Constellation stars |
| `js/sim/battle.js` | Payline evaluation, turns, the enemy turn, HUD snapshots on events |
| `js/sim/tree.js` | Constellation generation and the path rule |
| `js/sim/game.js` | The run: stops, rewards, stars, Waystations, `act`, `step`, save format |
| `js/sim/bot.js` | Auto-player: reads nudges and respins, targets, builds, picks stars |
| `js/view/view.js` | Renderer, composer and CRT pass, layout, playing events as effects |
| `js/view/backdrop.js`, `machine.js`, `foes.js`, `fx.js` | The sky shader, the cabinet and reel shader, hologram enemies, sparks and beams |
| `js/ui.js` | HUD, bottom bar, enemy tags, reel touch zones, Salvage, Constellation map, Waystation, game over |
| `js/glyphs.js` | Procedural neon glyphs |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Press queue, sound and music, guarded storage, seeded RNG, tuning |

### The show
The sim resolves a whole FIRE at once (your groups, the hits, the enemy turn, jams, a new turn) and pushes one event per beat. Every battle event carries `s`, a small snapshot of the HUD (hull, Block, Energy, each enemy's HP, Block, Burn, strength and next move). `main.js` releases events one at a time, each holding the stage for its `DUR`; the HUD draws from the last released snapshot, so numbers never run ahead of the animation, and from the live state once the show is over. New actions wait in a short queue until the show and the reels are done. When idle the view snaps to the true state.

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, every rule, 300 generated Constellations, determinism and save round trips, and has the bot play whole runs at two skills. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations and with storage blocked.

## Balance notes

- With every enemy at its table values, the careful bot won 96% of runs and the careless one 68%. `FOE = { hp: 1.2, dmg: 1.3 }` brings them to about 63% and 27% over 60 seeds (69% and 25% over 200).
- Nearly every lost run ends at a boss, most often the Nebula Wyrm (sector 2). Normal fights wear the hull down but rarely end a run. That suits a roguelike, but the mid-sector fights could bite harder.
- The careful bot finishes with about 4.2 reels: the Extra Reel in each keystone row is the single strongest star, and the bot rates it first.

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.
- More events between fights (Slay the Spire's ? rooms), elites, and relics that bend the payline (diagonals, a second line).
- Upgraded copies of single symbols rather than only global Etches.
- A meta layer: unlockable starting machines or reels.

## Changelog

### v1.0.0 (2026-10-22)
- First release: three sectors of fights, Waystations and bosses; eight symbols with matches, Wild Stars and Static; nudges and respins for Energy; Slay the Spire style intents; Salvage that adds symbols to every reel; the Constellation, a generated path-shaped skill tree of 19 kinds of star with keystone rows; a shader sky, shader reels, hologram enemies, bloom and a CRT pass; synthwave music per sector; saves; keyboard, gamepad and touch; a bot, a sim test and a browser test.
