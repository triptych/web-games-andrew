# ROMANCER

**Genre:** A game about making games: a story campaign of repairing toy versions of historic games, plus a full 2D game-making studio
**Engine:** three.js r165 (import map, ES modules) for the lab; a hand-written fantasy console, the VESTA-8, for the games, drawing 160 × 120 palette pixels. No asset files: every model, texture, sprite, sound and tune is made in code
**Status:** v1.0.0

---

## Concept

Tycho Station, the Moon, 3126. Nobody makes games any more: the Stream generates them, endlessly and perfectly. A salvage crate from Old Earth holds a **VESTA-8**, an 8-bit console from 1983, and nine cartridges. Eight are corrupted toy versions of games that made history; the ninth has a handwritten label that says MY GAME.

You are the Lumen Institute's new researcher. You repair each cartridge on the **Workbench** with the console's own tools — a pixel editor, a level maker, an object inspector, a scripting language, a sound designer and a music tracker — and play it on the television. Every restored cartridge gives VESTA back a memory and a piece of its hardware: colours, the sound chip, music, bigger maps, more levels. Those are your tools in the **Studio** too, where you make any 2D game you like and export it as a single HTML file that plays anywhere.

The tone is warm and nostalgic, a retro-futurist lab: chrome, wood-grain plastic, neon trim, a CRT glowing in the dark, the Earth hanging over the lunar skyline.

## The three layers

1. **The VESTA-8** (`js/runtime/`): a fantasy console, pure and seeded. A cartridge is plain JSON: 64 sprites of 8 × 8 in a 16-colour palette, four tile flags per sprite, up to four levels of up to 128 × 64 tiles with placed objects, up to 32 object types with physics settings and a script each, a game script, eight sound effects and a 32-step song. It runs at 60 frames a second and draws into a `Uint8Array` framebuffer. The same code runs in the editor, in the tests, and inside every exported HTML file.
2. **The campaign** (`js/meta/`): nine missions, task checks, VESTA's repairs, bots, progress, unlocks, achievements and the story. Pure.
3. **The app** (`js/view/`, `js/ui/`, `js/main.js`): the three.js lab, the Workbench editors, the screens.

## Core loop

1. In the lab, the current cartridge sits in the console and the HUD names the next broken thing. Tap the console (or WORKBENCH).
2. The first time, VESTA and the Curator brief you on what was lost and the tools that came back.
3. On the Workbench, VESTA's checklist lists what's broken. Each task opens the right tool; tap it for a hint; "VESTA, repair it" does it for you (and costs you the Hands On commendation).
4. **Play** zooms the camera into the television. Play the repaired game; the last task is always to *play* it (score a point, break ten bricks, reach the flag…).
5. When every task is done the cartridge is **restored**: fanfare, what came back, a memory from VESTA, and the next cartridge appears on the shelf.

## The VESTA-8

### Screen and data
- 160 × 120 pixels, 16 colours (`V.PALETTE`), colour 0 see-through in sprites; 3 × 5 system font.
- Sprites: 64 × 8 × 8, stored as 64 hex strings. Flags per sprite: SOLID, HAZARD, LADDER, ONE-WAY.
- Levels: `{ w, h, tiles, objs }`, tiles one character each (`V.TILECH`), objects `{ t, x, y }`.
- Until RALLY is restored the colour DAC is broken: the television shows everything in green phosphor (`V.PHOSPHOR`). The editors show true colours, limited to 4, then 8, then 16.

### Objects (`js/runtime/core.js`)
Each type has a sprite (and animation frames), a size in tiles (the sprite repeats), a **control** preset, speed, jump, gravity, bounce, "stops at solid tiles", "solid to others", an **edge** rule, hp, auto-flip, turn-at-ledges and a snug or full hitbox.

| Control | What it does |
|---|---|
| move4 / move8 | Top-down walking; walkers slide round corners into gaps (corner nudge) |
| platform | Run, jump on A or ↑ with coyote time and a short hop on release, climb LADDER tiles |
| paddle_v / paddle_h | One axis |
| grid | One tile per press; a hop keeps the other axis on its row or column, so a log can't drag it into a wall |
| maze | Keeps moving, turns at the next gap, reverses at once |
| chase | Maze AI: at each junction, toward the player (80%) or at random, never reversing unless stuck |
| homing, patrol, wander | Fly at the player; walk and turn at walls (and ledges); wander |

Edges: none, stop, bounce, wrap (off one side, back from the other), destroy.

The frame: game `on update` → `on press` handlers → for each object: control, `on update`, gravity, movement against solid tiles, one-way platforms and solid objects in steps of ≤ 4 px (`on bump`), edges, animation, `on enter` when its centre changes cell, `on hazard` → object pairs that overlap (or touched a solid object) fire `on hit` once each → `on land` → removals → a level change or restart requested this frame happens now (never mid-loop) → camera.

### VESTA SCRIPT (`js/runtime/lang.js`)
A small Lua-like language: `on <event> [type]` handlers, `function`s, `local`, `if/elseif/else`, `while`, numeric and `for x in all("type")` loops, `repeat … until`, `return`, `break`, `+= -= *= /=`, `..`. Lexed and parsed to an AST, compiled to JS closures. Names: locals, then `me`, then the object's own properties (`x y vx vy spr hp timer …`), then shared globals (unset reads as 0). Division by zero is 0. Every statement counts against a budget of 200 000 per frame, so an endless loop stops the game with an error on its line instead of freezing. Calls to functions that exist nowhere are caught before the game runs. Around 70 built-ins (`V.BUILTIN_DOCS`).

Events: start, update, hit, bump, enter, hazard, press, land, die, draw.

### Sound (`js/runtime/sound.js`)
Effects: wave (square, triangle, saw, sine, noise), start and end pitch, length, volume, vibrato and arpeggio steps. Music: one 32-step pattern with a lead (pentatonic rows in the tracker), a bass and three drums, tempo and lead wave, scheduled with a look-ahead clock.

### Export (`js/runtime/index.js`, `host.js`)
Every runtime part is one self-contained function that adds to `V`. `exportHTML()` writes each part with `fn.toString()`, the standalone player (`host.js`: a CSS CRT, keyboard, gamepad, a touch pad, Web Audio) and the cart as JSON (with `<` and line separators escaped) into one HTML file. `importCart()` reads a `.vesta.json` or an exported `.html` back.

## The cartridges (`js/meta/missions.js`)

| # | Year | Toy | After | What was lost (the tasks) | Teaches |
|---|---|---|---|---|---|
| 1 | 1972 | RALLY | PONG | the ball sprite; its bounce; the paddle's control; *score a point* | Sprites, the inspector |
| 2 | 1976 | BRICKBREAK | BREAKOUT | the wall (paint 24 bricks); the ball's `on bump`; *break 10 bricks* | Map, first script |
| 3 | 1978 | INVASION | SPACE INVADERS | the invaders' second frame; the ship's fire control; *score 100* | Spawning, animation, loops |
| 4 | 1980 | MAZE MUNCH | PAC-MAN | five glitched walls; the runner's maze control; the ghosts' chase AI; *eat 50 dots* | Maze movement, AI |
| 5 | 1981 | ROAD HOP | FROGGER | the car sprite; the river's HAZARD flag; the logs' wrap; *get a frog home* | Flags, hazards, wrapping |
| 6 | 1981 | GIRDER CLIMB | DONKEY KONG | the LADDER flag; the hero's run-&-jump; the barrels' gravity; *reach the top* | Gravity, jumping, ladders |
| 7 | 1985 | SCROLL RUN | SUPER MARIO BROS. | the camera; the bridge (8 glitched tiles); the coin sprite; *reach the flag* | Big maps, the camera |
| 8 | 1986 | DUNGEON KEY | THE LEGEND OF ZELDA | the sword sprite; the attack; the stairs in room 1; *claim the relic in room 2* | Rooms, keys, doors |
| 9 | — | THE LAST CARTRIDGE | your own game | a name; three sprites; 20 tiles; two object kinds, one steered; a script with a handler; *win it* | Everything |

Each history note is a short, factual paragraph (designer, year, the innovation). The toy names are the game's own; the archive card names the original it's after.

Task checks are pure functions of the cart and of what playtests reached (the highest value each global took, and wins), so the player can fix things any way they like. Repairs are the reference fix. A glitch task checks the cells became **solid** again, not just that the glitch tile is gone, so a blank cart never ticks a task.

## Hardware that comes back (`FEATURES` in `progress.js`)

| Comes back | Feature |
|---|---|
| start | sprites, objects, play, 4 colours |
| RALLY restored | 8 colours, the sound chip, the cartridge burner (export) |
| BRICKBREAK opened / restored | map editor, CODE / 16 colours |
| INVASION opened / restored | animation frames / the music tracker |
| MAZE MUNCH opened | AI, grid and maze controls |
| ROAD HOP opened | HAZARD, LADDER, ONE-WAY flags |
| GIRDER CLIMB opened | platform physics |
| SCROLL RUN opened | big maps and the scrolling camera |
| DUNGEON KEY opened | up to four levels |

The Studio uses the same set; **Open Archive** in Settings unlocks everything there.

## Story (`js/meta/story.js`)

Cast: you (the researcher, named at the start), **Curator Vey**, dry and fond of old things; **VESTA**, the console's boot persona, who talks in capitals and gets warmer with every memory; **Auditor Nine**, a Stream projection reviewing the Institute's recycling schedule, who files the eleven minutes it spent watching SCROLL RUN as anomalous. Each cartridge has a briefing and a memory (a vignette from VESTA's players). The ninth cartridge belonged to Jun, VESTA's last player, who was making a game every night after school. The ending: Centennial Day, a queue out of the Great Hall's door, the recommendation amended to "more of these", and VESTA at 100%.

Portraits are 24 × 24 pixel art in the VESTA palette. The Journal replays every scene.

## Commendations

First Light, Full Colour, Hands On (restore one without repairs), Purist (all eight without repairs), Pixel Pusher (500 pixels), Cartographer (300 tiles), Debugger (hit a script error, then run that cart cleanly), Composer (32 notes), Foley Artist (5 sounds), Cartridge Burner (export), Shut Out (RALLY 3–0), Creator (win a Studio game), Archivist, Romancer.

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / d-pad | ◀ ▲ ▶ ▼ pad |
| A | Z / Space / J | A | A |
| B | X / K | B / X | B |
| Stop playing | Esc | Start | ■ Stop |
| Menus | ↑ ↓ Enter, Esc | d-pad, A, Start | tap |
| Editors | mouse; wheel zooms the map; Ctrl+Z / Ctrl+Y | — | one finger draws or paints, two fingers pan and pinch |

## Look and sound

- **Lab** (`js/view/view.js`): a dark room with a neon-trimmed floor grid; a window onto Tycho Station (domes, towers with lit windows, the Earth); a desk under a hanging lamp with a volumetric beam; the VESTA-8 (an extruded wedge with wood-grain front, ribs, chrome switches, a badge, a power light and the current cartridge in its slot); a wood-veneer television with knobs, a speaker grille and rabbit ears; a joystick on a cable that leans with your buttons; an oscilloscope that answers the sound chip; a shelf of nine cartridges with labels painted from each cart's own sprite; a holographic ring of nine memory sectors; dust in the light; a server rack blinking. ACES tone mapping, bloom, a generated environment map for reflections.
- **CRT** (`js/view/crt.js`): barrel distortion, scanlines, an aperture mask, phosphor bleed, vignette, flicker, static, the power-on collapse line; it lights the desk in the picture's colour.
- **Camera poses**: title (slow orbit), lab, shelf, bench, and **crt**, which fits the screen into whatever the play bar and the touch pad leave free. The glide runs on the wall clock.
- **UI**: chamfered panels, Orbitron and Share Tech Mono, cyan, amber and magenta.
- **Sound** (`js/audio.js`): the lab's hum (detuned drones under a breathing filter), computer bleeps, interface blips, VESTA's square-wave voice, a restoration fanfare; carts play through their own bus.

## Module overview

| Path | Responsibility |
|---|---|
| `js/runtime/` | The VESTA-8: `font`, `gfx`, `lang`, `sound`, `core`, `host` (exported files only), `index` (assembly, export, import) |
| `js/meta/missions.js` | The nine cartridges: builders, tasks, repairs |
| `js/meta/bots.js` | A bot per cartridge, some with look-ahead on cloned runs (`simulate`) |
| `js/meta/progress.js` | Progress, features, completion, achievements, Studio, save format |
| `js/meta/story.js`, `carts.js` | The script; cart-building helpers |
| `js/view/` | The lab, the CRT shader, painted textures |
| `js/ui/bench.js` | The Workbench: tabs, undo/redo, VESTA's checklist |
| `js/ui/sprite.js`, `map.js`, `objects.js`, `code.js`, `sound.js`, `cart.js` | The editors |
| `js/ui/ui.js`, `dom.js` | Screens, dialogue, portraits, archive, Studio, journal, Codex |
| `js/main.js` | Modes, the 60 Hz loop, play, restoration, story, debug hooks |
| `js/input.js`, `audio.js`, `save.js`, `config.js` | Input merge with latched presses, sound, guarded storage, constants |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` proves the runtime pure and self-contained (rebuilt from `fn.toString()` in a fresh realm it plays RALLY to a win), tests the language and every physics rule, determinism, and has a bot win every repaired cartridge on several seeds; `browsertest.mjs` plays the real thing in Chromium on desktop and touch-only phones, including exporting a game and playing the HTML file on its own.

## Balance notes

- The bots win every repaired cartridge: RALLY in ~25 s, BRICKBREAK ~2.3 min, INVASION ~15 s, MAZE MUNCH ~26 s (with deaths sometimes), ROAD HOP ~12 s, GIRDER CLIMB ~20 s, SCROLL RUN ~10 s, DUNGEON KEY ~8 s. A person is slower; the playtest tasks ask for less than a win where a win is long (a point, ten bricks, 100 points, 50 dots, one frog home).
- ROAD HOP's frog could be dragged into a bush by its log mid-hop: grid hops now pin the other axis.
- GIRDER CLIMB's bot needed "distance left along the route" rather than "floors climbed" to stop hiding on ladders.
- The finale's sample game (VESTA's repairs) was too hard for its bot at 15 stars and 5 misses; now 12 and 8.

## Open questions / next steps

- A human pass on real hardware: the bots are not people, and SwiftShader is not a GPU.
- More Studio templates, a sprite-sheet import, multi-pattern songs.

## Changelog

### v1.0.1 (2026-10-16)
- The title's last R was cut off with the real Orbitron font: the logo is gradient-clipped text, so the part that overflowed its 440 px column vanished. Smaller size, a 520 px column, and a fit-to-width once the font loads. On wide screens the title column is left-aligned throughout.
- RALLY's paddle task didn't tick for a player who set the control on "ball" instead of "player". Object tasks now name the object, their Go to button selects it, a control on the wrong object gets a note, and repairs put it back.

### v1.0.0 (2026-10-16)
- First release: the VESTA-8 runtime and VESTA SCRIPT, nine cartridges with tasks, repairs and bots, the story and commendations, the three.js lab, six editors, the Studio, save and load, and export to standalone HTML.
