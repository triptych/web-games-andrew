# THE HERO'S MERCHANT: dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-119/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js`, `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: all 105 recipes' inputs exist and are sold somewhere, every station level 5 exists, the roads connect the realm, every quest's requirements exist. **inventory**: grid placement and rotation, stacking, merging, weight, auto-sort, stash, favourites. **market**: spread, price impact and recovery, shop categories, stock, events, an arbitrage exists in Greenmarch. **rules**: buying, selling, crafting, quests (hero chain and couriers), visiting heroes, burden, wagon upgrades, road encounters, the Offer, the Eclipse. **determinism**: same seed and decisions, same game; a save round trip plays on identically; looking at prices changes nothing. **bot**: a planning bot plays whole campaigns on `SEEDS` seeds with per-stop invariants and prints the balance table. `ONLY=purity,data,inventory,market,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-119/dev/browsertest.mjs` | Real Chromium + WebGL (software). **desktop**: title → New Game → the intro dialogue → every venue opens → buy and sell through the market UI → a drag-and-drop in the wagon grid → craft at the Hearthmere forge → the notice board → travel along a road and arrive → the map → keyboard navigation. **phones** (touch only, real CDP touches) at 390×844 and 844×390: the town, the market and the wagon fit, controls are ≥ 44 px, no sideways scroll. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-119/dev/shots.mjs [steps.json] [w h] [touch]` | Boots the game once and screenshots a series of moments (software GL needs about 40 s to boot, so it does many shots per boot). |
| `node game-119/dev/play.mjs name "js" [waitMs] [w h] [touch]` | One screenshot after a snippet; `window.__thm` is available. |
| `node game-119/dev/shot.mjs page.html name [w h]` | Screenshot a dev page: `gallery.html` (chibi people), `gallery2.html` (buildings, trees, props, wagons), `scene.html?mode=town&town=emberforge&hour=18` (a 3D scene without the UI). |
| `node game-119/dev/preview.mjs` | The 1200×630 preview picture for the Garden's Library, from the real game. |

The browser scripts need `playwright` and a static server on port 8119:

```bash
python3 -m http.server 8119          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-119/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

Software GL (SwiftShader) is slow: the page takes about 40 s to boot (it paints the whole realm and uploads ~60 textures) and then draws a few frames a second. The game detects a software renderer and turns off bloom and MSAA; the tests wait on state, never on the clock, and use `&fast=N` so the road takes N times fewer frames. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__thm`: `G` (the game), `mode` (`title`, `play`, `over`), `mapOpen`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title), `skip()` (drop any open dialogue), `autoplay(on)` (the bot plays the real game, a stop at a time), `ff(days)` (the bot plays ahead synchronously), `act(cmd)` (a sim command through the UI's own path), `open(panelId)`, `save()`, `hasSave()`. `&fast=N` runs the road N times faster; it does nothing without `debug=1`.
