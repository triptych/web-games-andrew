# BURROWGUARD — game plan

**Status:** complete (v1). Vanilla ES modules, hand-written WebGL renderer, no libraries, no asset files.

## Concept

A fusion of three arcade genres in which the genres are **one system**, not three modes:

| Genre | What it contributes | Where it lives |
|---|---|---|
| **Digging game** | You carve tunnels through four strata of dirt; boulders fall when undermined; a harpoon pumps monsters until they pop | `game.js` player/harpoon/rocks |
| **Tower defence** | Monsters walk from the surface to a crystal core; you build towers into the dirt beside their route | `game.js` waves/towers, `world.js` fields |
| **Maze chase** | Every round opens on a pellet-filled maze with four power gems; eating a gem turns every monster blue and edible (200-400-800-1600) | `world.js` generate, `game.js` fright |

**The link between them:** walkers path through *tunnels only*, using a distance field rebuilt whenever the terrain changes. So the tunnels you dig are the maze they walk. Digging pays gold (ore in every dirt cell), gold buys towers — and one careless cell that joins two corridors reroutes the whole horde around your towers. Good play is digging **dead ends**: to harvest ore, reach gems, get under boulders, and give towers new angles, without ever connecting their route to itself.

## Core loop (one round = 6 waves on a fresh board)

1. **READY** — a new board: surface lane, two entry shafts, four zig-zag corridors down to the core, 5–9 boulders, 4 gems at corridor ends.
2. **Countdown** — dig for gold, build. `GO!` calls the wave early and pays a gold per second skipped.
3. **Wave** — monsters enter from both ends of the surface lane. Towers fire; you pump, crush and eat.
4. Wave 6 is the **King** (plus escorts). Clear it → core bonus, 70% tower salvage, a new board, +3 core HP.

Lose when the core breaks (10 HP) or you run out of miners (3, extra at 20k / 60k / 120k).

## Enemies

| | Rule it breaks | Pumps |
|---|---|---|
| Grub | baseline walker | 4 |
| Skitter | fast, fragile | 2 |
| Drake | stops and breathes fire 3 cells along a row, **through dirt** | 4 (double points from the side) |
| Stalker | hunts the **miner** for 11s; phases through dirt as untouchable eyes when that's shorter | 3 |
| Borer | armoured; drills its **own** tunnel (dirt costs 3 on its field) — leaves permanent shortcuts | 6 |
| King | boss every 6th wave, ignores power gems, takes 60 from a boulder | 14 |

## Towers (built into dirt, 3 levels, sell for 70%)

Blaster (homing shots) · Frost (slowing aura + light DPS) · Arc (chain lightning) · Boomer (lobbed splash shells). Targeting is "closest to the core" by the ghost field.

## Controls

| Touch | Keyboard / mouse |
|---|---|
| Drag anywhere off the field and buttons — a relative stick | Arrows / WASD |
| PUMP button (hold to keep pumping) | Space / Z / X |
| Tray: tap a tower, then tap dirt | 1–4 then click dirt, or **B** to build in the cell ahead |
| Tap a tower → UPG / SELL / X | U upgrade, Backspace sell, Esc cancel |
| GO! | N / Enter |
| ‖ button | P / Esc, M mute |

## Module overview

```
js/config.js   all balance numbers
js/world.js    grid, board generator, Dijkstra fields (core / dig / ghost / to-player)
js/game.js     the whole simulation — pure: no DOM, no WebGL (audio calls no-op in Node)
js/audio.js    Web Audio chiptune: sfx, a walking tune that only plays while you move, fright siren
js/sprites.js  hand-drawn pixel art as strings;  js/font.js  5x7 bitmap font
js/atlas.js    packs sprites, generated dirt/tower/circle art and glyphs into one RGBA atlas (pure data)
js/gl.js       WebGL renderer: batcher, sharp-bilinear filter, bloom + scanline post pass
js/layout.js   portrait / landscape layouts in device pixels
js/render.js   world, HUD, touch controls, title/pause/game-over — immediate-mode UI
js/input.js    pointer + keyboard; relative thumbstick
js/main.js     boot, fixed-step loop (60Hz), screens, quality tiers, storage
```

## Renderer notes

- Everything is a textured quad in device pixels from one atlas; `rgba()` colours are cached arrays.
- **Sharp bilinear**: `px = seam + clamp((px - seam) / fwidth(px), -0.5, 0.5)` with LINEAR filtering gives nearest-neighbour inside texels and a one-pixel blend at their edges, so pixel art is crisp at 3.7x without shimmer. Falls back to NEAREST without `OES_standard_derivatives`.
- Atlas sprites are **extruded** 2px so opaque dirt tiles don't pick up transparent seams under bilinear sampling.
- Post: scene → quarter-res bright pass (threshold 0.7, above the brightest dirt speckle) → 2× separable 5-tap blur → composite with scanlines at the sprite-pixel pitch and a vignette. LOW renders straight to the back buffer at DPR ≤ 1.25.

## Verification

See [dev/README.md](dev/README.md).

## Changelog

### v1 (2026-09-23)
Initial release: everything above.
