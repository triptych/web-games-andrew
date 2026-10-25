# FABLECART — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-099/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js`, `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **stickers**: every built-in has 12×12 palette art, only known blocks, stickers and tags, and survives the import sanitiser unchanged; every block, event and condition in the catalogue makes a valid fresh block. **rules**: one scenario per idea (touch and i-frames, shooting, last words, become, items, solids, repeat/if/vars/shout, the runaway guards, doors that carry the hero, win and lose, taps, chase/flee/walk). **carts**: hostile JSON is rebuilt safely (prototype pollution, huge numbers, markup, hidden blocks, 300-item scenes), share codes round trip. **determinism**: same seed, same game; save round trips. **room**: each machine of the console opens its screen. **bot**: the bot plays the starter cart at skill 1, 0.5 and 0.2 on `SEEDS` seeds with per-step invariants, and prints the balance table. `ONLY=purity,stickers,rules,carts,determinism,room,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-099/dev/browsertest.mjs` | Real Chromium. **desktop**: boot, power on by click, walk into the TV with real keys and play (Space shoots, Escape pauses, Space on the focused Resume resumes), win, the Shelf (copy, share, import, bad code), the Stage with mouse (stick, paint, snap, erase, move, scenes, backgrounds, play), the Press (rename, paint art, add blocks by tap and by drag, `if` and `not`, live test stage rebuild, Done), a brand-new sticker made from blocks that then acts in a game. **phones** (touch only, real CDP touches) at 390×844 and 844×390: tap through the Shelf and Stage, the deck, the stick, A, pause, the Press by finger, controls ≥ 44 px, no sideways scroll. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-099/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-099/dev/shot.mjs stickers.html [name]` | Screenshots a dev page. [stickers.html](stickers.html) is the sticker gallery: every built-in at 10×, with its die-cut border, on grass. Judge new art here. |

The browser scripts need `playwright` and a static server on port 8099:

```bash
python3 -m http.server 8099          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-099/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. The page is Canvas 2D, so no GPU or SwiftShader flags are needed. `&fast=4` runs four times the simulation per frame; the tests wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

Two harness traps (both are in the test, not the game): after a raw CDP `touchEnd` Chromium swallows the click of the *next* tap (the phone test spends one on the top bar), and the Press scrolls smoothly after a block is added, so wait before tapping a control whose position you measured.

## Debug hooks (`?debug=1`)

`window.__fc`: `G` (the world on screen), `mode` (boot, room, play, stage, press), `cart`, `store`, `seen` (count of every sim event drained), `view`, `ui`, `audio`, `input`, `stage`, `press`, `shelf`; `room(x)`, `open('shelf'|'stage'|'press'|'play')` (as if walked into), `stageOn(i)`, `pressOn(stickerId, 'stage'|'book')`, `play(cart, seed)`, `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run ahead with the bot), `cell(x, y)` (scene cells → client px, to click where a sticker is), `layout`, `persist()`. `&fast=N` does nothing without `debug=1`.
