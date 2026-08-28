# Grimhold Abyss — Game Plan

A retro first-person dungeon crawler ("blobber") in the style of early-90s
DOS shareware — Catacomb 3-D / The Catacomb Abyss, Eye of the Beholder,
Dungeon Master. Grid-locked movement, 90° turns, a hand in the middle of
the screen throwing fireballs, and a chunky 16-colour EGA look.

**No engine, no framework, no build step.** The 3D view is drawn by a
custom software renderer written for this game: palette-indexed
framebuffer, perspective-projected textured wall columns, per-column depth
buffer, dithered distance shading, billboard sprites. Everything on screen
— walls, monsters, status bar, text — is rasterised by our own code into a
320×200 indexed buffer and blitted once per frame.

## Why a custom engine
The look of Catacomb Abyss comes from its *limitations*: 320×200 with
non-square pixels, 16 fixed colours, flat floor and ceiling, no lighting
model beyond "further away is darker", nearest-neighbour texture columns.
A modern 3D library fights all of that. A ~600-line software rasteriser
reproduces it exactly.

## Engine architecture (`js/engine/`)
- **`palette.js`** — the 16-colour EGA palette, hand-authored darkening
  chains per colour (there is no "half brightness" in EGA, so each colour
  has an explicit ramp), a 4×4 Bayer matrix for dithering between ramp
  steps, and a packed ABGR lookup for blitting.
- **`framebuffer.js`** — `Uint8Array` of palette indices at 320×200,
  clipped primitives (rect, hline, vline, textured column, sprite blit),
  and a single `present()` that expands indices to RGBA through the
  palette LUT.
- **`font.js`** — a 5×7 bitmap font drawn into the framebuffer, so all
  in-game text lives in the same pixel grid as the 3D view.
- **`textures.js`** — every wall texture and sprite is generated at load
  time from a seeded RNG (brick, cut stone, mossy stone, wood door,
  portcullis…), so the game ships with zero binary assets.
- **`renderer.js`** — the rasteriser. Camera transform → backface cull →
  near-plane clip → perspective projection → per-column perspective-correct
  texture mapping with a depth buffer → distance-shaded floor/ceiling rows
  → depth-tested billboard sprites.

## Rendering notes
Because every wall in a blobber spans the same world-space height range, a
nearer wall always fully covers a farther one inside any given screen
column. That means no polygon sorting is needed at all: a single
`colDepth[x]` array is a complete visibility solution for walls, and the
same array does sprite occlusion for free.

## Phases
- [x] **Phase 1 — Engine core.** Framebuffer, palette, dithered shading,
  procedural textures, wall/floor/ceiling rasteriser, grid-locked movement
  with animated steps and turns, a first procedural dungeon, automap.
- [x] **Phase 2 — Dungeons.** Room-and-corridor generation with themes per
  depth, doors, locked doors and keys, secret doors, descent stairs,
  multi-level persistence, torch props.
- [x] **Phase 3 — Bestiary and combat.** Billboard monsters with sprite
  animation and simple grid AI, melee, the fireball hand, damage, death,
  loot drops.
- [x] **Phase 4 — RPG systems.** XP and levels, HP/mana, inventory,
  potions/scrolls/treasure, chests, the boss on the final floor, win and
  lose screens, save/load.
- [x] **Phase 5 — Feel.** Procedural Web Audio SFX and a depth-tuned
  ambient drone, EGA palette flashes for damage and level-ups, camera
  shake, a status-bar portrait that reacts to injury, dithered title
  screen, help screen.

## Sound
There are no sound files either. `audio.js` is a handful of oscillators
and one reusable second of white noise: footsteps are a filtered noise
burst, the fireball is a rising sawtooth, a level-up is a four-note
arpeggio. The audio context is created on the first key press, because
browsers refuse to start audio before a gesture, and everything before
that is a no-op rather than an error.

## Controls
- **↑ / W** step forward · **↓ / S** step back
- **← / →** turn 90° · **Q / E** strafe left / right
- **Space / Ctrl** hurl a fireball · **F** strike (or just walk into it)
- **Enter** doors, stairs, chests, and searching a suspicious wall
- **Tab** automap · **I** pack · **1-3** use an item · **H** help
- **M** mute · **F2** save now · **Esc** pause

## Design rules
- Movement is cell-to-cell and turns are 90° — animated, but never
  free-look. That is what makes it a blobber and not an FPS.
- The player is always at a cell centre when a turn resolves; input during
  an animation is queued, not dropped, so movement stays responsive
  without breaking the grid.
- No asset files. Textures, sprites, font and sound are all generated.
- Anything the player changed is worth saving; anything derivable from the
  seed is not. A save stores opened tiles, seen cells, surviving monsters
  and remaining loot, and regenerates every floor around them.

## Verification
`?seed=` fixes a run, which is what made the automated checks possible:
generation was validated over 400 seeds (no unreachable stairs, no
unreachable key, no pointless lock), and a scripted playthrough descends
all ten floors and kills the lich on several seeds. Frame cost on the
largest floor with 18 monsters is about 2.3ms.
