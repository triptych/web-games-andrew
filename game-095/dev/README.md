# Hauntly Manor — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-095/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **layout**: 600 seeds make valid layouts (codes in range, three distinct books, a real melody), seeds vary the house, and the clue text carries the numbers the locks want. **rules**: the key's hiding places, the library door, wrong items kept, the hatch, the pantry lock (wrong, right, once), the oven and its timer, every recipe, the shelf, the music box, the trunk, the case board (no evidence, three wrong suspects, the right one), the party in any order, the three talk paths and their endings, the shy ghosts, ambient spooks, the idle timer. **world**: every hotspot is in a real room with a name; every room has a way back and a shy ghost; every plan step points at a real hotspot in its room and has three hints; every line has a known speaker and fits the box. **determinism**: same seed → same game; a save round trip mid-story plays on identically; a bake in progress survives a load; an unknown version is rejected. **bot**: the bot plays `SEEDS` seeds at two skills to an ending and the table is printed. **hints**: the hint button walks the whole story one step at a time, clearer each time. **fuzz**: random actions from the start (taps, uses, combines, doors, notes, codes, accusations), invariants after each, then the bot finishes from wherever that left things. `ONLY=purity,layout,rules,world,determinism,bot,hints,fuzz`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-095/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game, the intro with a real typewriter, real mouse taps and tooltips, the pack (select, put away, wrong use), arrow keys and Enter, the hint button, the journal's four tabs, a real chain (key → library door), the pantry lock by its wheels, the oven, combining by taps, the music box by its keys, the party by select-and-tap, Winnie's talk by clicking choices, the ending and Play Again, pause and the stopped clock, Save & Quit → Continue. **hotspots**: in every room on the desktop and both phone shapes, every hotspot has a model, is on screen between the HUD and the pack, and has the canvas (not a button) under it. **phones** (touch only, real CDP taps) at 390×844 and 844×390: menus, intro, a hotspot, the pack, a door, the journal and map, ≥ 44 px controls on screen, no sideways scroll, the canvas matches the visible viewport, screens stay open after the lift. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,hotspots,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-095/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=4'` adds URL parameters. |
| `node game-095/dev/shot.mjs name "query" [w h]` | Screenshots `dev/gallery.html`: one room with no UI, for judging models. `room=attic&seed=3&f=trunk_open,shelf_open` sets the room, the seed and flags. |

The browser scripts need `playwright` and a static server on port 8095:

```bash
python3 -m http.server 8095          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-095/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` (the oven bakes four times faster) and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__hm`: `G` (the game), `mode` (title, play, over), `seen` (a count of every sim event drained), `stage`, `ui`, `audio`, `input`, `settings`; `start(seed, keepIntro)` (skips the title and, unless asked, the intro), `do(action)` (the same path a tap takes), `tap(id)` (a tap on a hotspot, using the selected item if any), `autoplay(on)` (the bot plays the real game, reading dialogue as it goes), `ff(sec, until)` (the bot plays ahead in the sim until `until(G)` is true; dialogue is skipped), `skip()` (clear the dialogue box), `save()`, `hasSave()`, `screenOf(id)` (the client-pixel point of a hotspot), `hot()` (the hotspot ids the current room's model has). `&fast=N` runs the clock N× faster; it does nothing without `debug=1`.
