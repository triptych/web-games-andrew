# Hurray LA's Fairy Lamp Adventure

**Genre:** Puzzle (memory / concentration)
**Engine:** Vanilla JS: Canvas 2D; painted lamp art generated with fal (see `art/README.md`)
**Status:** v1.0.0 in progress

---

## Concept

A memory game: flip painted antique glass fairy lamp shades and bases and match each top to its own bottom.

Hurray LA is a collector of antique pressed-glass fairy lamps. Her shelf has been knocked over and every lamp has come apart: shades (the glass domes) in one jumble, bases (the candle cups) in another. The player turns over two tiles at a time and pairs each shade with its own base. A completed lamp lights up, its candle glowing through the coloured glass, and goes back on the shelf. Cozy, unhurried, warm. Riffs on classic Concentration / Memory, but a match is two *different* pictures that belong together, so it rewards really looking at the glass patterns (hobnail, diamond point, starburst, moon and star).

## Core loop

1. A board is dealt face down: N lamps → N shade tiles and N base tiles, shuffled by seed.
2. Flip a tile, flip a second. Shade + its own base → the lamp lights, both tiles leave the board, the lamp joins the shelf.
3. Anything else → both flip back after a short look.
4. The board is cleared when every lamp is lit. Score by flips used (stars), not by time.
5. Boards grow: 4 lamps (8 tiles) → 6 → 8, then later boards mix in near-twins (two hobnails, two diamond points).

## Mechanics

### Flipping
- At most two tiles face up that are not yet matched. A third flip is ignored until the pair resolves.
- A pair resolves after `REVEAL` seconds (sim time) if it is not a match; immediately if it is.
- Flipping a face-up or matched tile does nothing.

### Matching
- A match is `shade.lamp === base.lamp`. Two shades or two bases never match.
- Each match pushes a `light` event (the view plays the candle glow, audio a glass chime).

### Scoring
- Moves = pairs turned. Stars: ≤ 1.5 × lamps moves = 3, ≤ 2.5 × lamps = 2, else 1.
- Best stars per board are saved.

## Content

Lamps live in [`js/sim/data/lamps.js`](js/sim/data/lamps.js): id, name, glass colour and an `art` description of the real antique each one is painted from (a reference photo of a collection: cobalt and amber hobnail, clear diamond point, green starburst, amber star crown, blue moon and star, pink blossom, amethyst diamond).

Each lamp has four painted sprites in `art/lamps/` (see [art/README.md](art/README.md)): `ID-shade.png`, `ID-base.png`, `ID-lit.png`, `ID-unlit.png`.

## Story

Hurray LA restores her shelf one board at a time; the last board relights the whole collection.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Pick a tile | Arrows / WASD + Space / Enter | D-pad + A | Tap the tile |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

Painterly: visible brushwork, soft glazes, warm candlelight through coloured glass, on a dark plum wood-panelled backdrop. The lamp sprites are painted with fal (nano-banana 2.1 edit) from a reference photo, cut out to transparent WebP: one master painting per lamp, and the shade, base and other candle state edited from it, so all four line up (see [art/README.md](art/README.md)). A code-drawn glass silhouette in each lamp's `glass` colour is the fallback if an image fails to load. Sound is Web Audio: soft glass chimes on flips, a warm swell on each lit lamp.

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, debug hooks |
| `js/sim/` | Pure simulation: no DOM, renderer, `Math.random` or clock. `game.js` rules, `bot.js` auto-player |
| `js/view/` | Reads the sim and answers its events |
| `js/ui.js` | DOM screens, HUD, settings, touch deck |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the rules, determinism and save round trips, and has the bot play [the whole game]. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations and with storage blocked.

## Balance notes

None yet: the bot still plays the placeholder.

## Open questions / next steps

- The scaffold still runs the placeholder rules (collect pickups); the memory board above replaces them next.
- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.

## Changelog

### v1.0.0 (2026-11-24)
- Scaffold (Canvas 2D sim/view layout), lamp data table, painted lamp sprites.
