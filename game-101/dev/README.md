# PixelCrypt — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-101/dev/simtest.mjs` | Headless, in Node. Covers v1.1 too: artifact effects, achievements, the saga end to end, floor styles, the new monster families. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **gen**: 440 floors (40 seeds × 11 depths up to 150) are valid (stairs and every feature reachable without secrets, secret pockets sealed by exactly the secret doors, solid borders, a guardian on every fifth floor, floors a pure function of their seed, packing round trips); thousands of items, encounters and bosses are well-formed from item level 1 to 400 and power grows without bound. **rules**: movement, walls, doors, secret doors and searching, chests, traps, gathering, battles (win, level up, wipe, flee, no fleeing a guardian), equipment, two-handed weapons, curses and the church lifting them, potions, tomes, shops, the inn, recruiting up to six, dismissing, church services, the tavern, investments (cost curve, income curve, discounts, daily income, idle real-time income, the cap), quests of every type, the journal, guardians and checkpoints. **determinism**: same seed and commands → same game; a save round trip plays on identically; unknown versions are rejected. **bot**: the bot plays whole games of two temperaments on `SEEDS` seeds with per-command invariants (finite gold, HP/MP inside their maximums, a bag within capacity with unique ids, the party on its floor, no 500-command stall) and prints the balance table. `ONLY=purity,gen,rules,determinism,bot`, `SEEDS=n`, `STEPS=n`, `VERBOSE=1`. |
| `node game-101/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title, no Continue without a save, party creation, the town, real keys 1–8 open every building and Escape leaves it, a Guild purchase, a shop buy by click, the Descent, the dungeon; arrow keys turn and step, M opens the map, Space on a chest opens its dialog, Space presses the focused button; a battle by real `1`-key presses through to the results screen; the camp (party, slot picker, journal, items); equipping a new sword from the bag through the menus; a hopeless guardian fight, no fleeing it, the defeat screen and the way home; the audio context is running; Save → reload → Continue; half an hour "away" earns game days. **autoplay**: the bot plays the real game through the real UI. **phones** (touch only, real touches) at 390×844 and 844×390: taps through the title, creation, the town and the Descent; the touch pad turns and steps; Auto plays a battle; every control ≥ 44 px and on screen; no sideways scroll; the 3D view fits; the camp sheet fits. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,autoplay,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-101/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-101/dev/gallery.mjs` | A contact sheet of the procedural art on a neutral grey: every monster family, tints, bosses, strangers, things on the floor, item icons, portraits, and the wall atlas of each of the ten themes (`dev/shots/gallery-sprites.png`, `gallery-atlas.png`). Judging art in the game hides broken shapes under the dither and the fog. |

The browser scripts need `playwright` and a static server on port 8101:

```bash
python3 -m http.server 8101          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright     # once
ln -s ../../dev/node_modules game-101/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second, so the tests open the game with `&fast=6` (battle animations and fades play 6× faster) and wait on state, never on the clock. The tests also stop random encounters (`G.danger = -1e9`) while they walk. Passing tests don't mean the screen looks right: look at the screenshots and run `gallery.mjs`.

## Debug hooks (`?debug=1`)

`window.__pc`: `G` (the game), `mode` (`title` | `play`), `seen` (a count of every sim event drained), `ui`, `stage`, `audio`, `input`, `settings`, `start(seed, classes)` (skips the menus), `act(cmd)` (any sim command, with its events played), `autoplay(on, opts)` (the bot plays the real game), `ff(n)` (run the bot n commands synchronously, then let the UI catch up), `go(depth)` (put the party on floor N), `save()`, `hasSave()`, `toTitle()`, `press(code)`. The sim command `{ t: 'debugBattle', enemies, opts }` starts a battle from nothing (used by the tests). `&fast=N` plays animations N× faster; it does nothing without `debug=1`.
