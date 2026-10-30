# NEON ARCANA — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-111/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **pieces**: every glyph is connected, starts at the origin and comes back after four turns; the pool grows with the arcana; each power comes from its arcanum. **rules**: placing, overlap and edges, rows, columns and crosses, scoring, resonance, sigils, blight cracking and breaking, omens arriving (blight never completes a line, over 200 seeds), the deal and its mercy, every power, stuck versus over, conceding, rekindling (powers, sparks, overflow, the next omens), embers, the ending and the afterglow, free readings, the creeping Void. **determinism**: same seed and commands → same game; a save round trip plays on identically; unknown and corrupt saves are rejected. **bot**: whole campaigns (readings until all 22 are rekindled, carrying embers) on `SEEDS` seeds at three skills, with per-move invariants, and the balance table. `ONLY=purity,pieces,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-111/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader), real input. **desktop**: title, back link, the attract demo, the deck; a mouse drag, a tap then a click, the keyboard (digit, arrows, Space) each place a glyph; a drag that fills a row clears it; Escape pauses and the sim stops; a real Space on the focused Resume; T transmutes, B + arrows + Space fires the Tower Strike; rekindling The Fool (cinematic, banner, progress kept, the HUD moves on, Transmute wakes); Save & Quit → Continue; a stuck lattice ends the reading and keeps its embers; Read Again starts with them; rekindling The World shows the ending; Play on. **phones** (touch only, real CDP touches) at 390×844 and 844×390: a touch drag (the glyph floats above the finger), a tap then a tap, controls ≥ 44 px and on screen, the HUD and powers leave the lattice clear, the cell size, pause stays open after the finger lifts, Transmute by touch. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-111/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-111/dev/shot.mjs [page.html]` | Screenshots a dev page; by default [cards.html](cards.html), all 22 cards lit and dormant and the card back on a neutral background. |
| `node game-111/dev/preview.mjs` | Sets up a mid-game moment through the debug hooks and writes the 1200×630 launcher picture to `garden/img/games/game-111.jpg`. |

The browser scripts need `playwright` and a static server on port 8111:

```bash
python3 -m http.server 8111          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-111/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests wait on state, never on the clock, and `ready()` also waits two frames after play resumes (the frame that resumes play from a menu drops queued presses on purpose, so the key that closed the menu can't act in the game). Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__na`: `G` (the game), `mode`, `meta` (the Restoration's progress), `frames`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `ctl` (the play controller: `sel`, `cursor`, `drag`, `target`), `start(seed, { mode, arc, restored, embers })` (skips the title), `autoplay(on, skill)` (the bot plays the real game), `ff(n, skill)` (the bot plays n moves at once), `act(cmd)`, `setMeta(meta)`, `save()`, `hasSave()`. `view.toScreen(fx, fy)` maps cell coordinates to client px, `view.slots` are the hand slots in cell coordinates, and `view.cellPx()` is the size of a cell on screen. `&fast=N` speeds up `autoplay`.
