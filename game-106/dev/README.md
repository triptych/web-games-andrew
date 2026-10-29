# INTRUDER ALERT '84 — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-106/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: moving, spawning through the doors, the auto-laser, kills and chips, the chip magnet and crowd merging, level-ups (one at a time, the game waits), every upgrade family, contact damage and i-frames, the dash, electrified walls (they zap you and fry drones knocked into them; robots walk round walls instead), gunner bolts and line of sight, sectors and the purge, the Grinner (late, never in sector 1, knocked back but never killed), both endings. **maze**: 200 seeds, spawn clear and all four doors reachable. **determinism**: same seed and inputs → same game; a save round trip (also in the middle of a level-up) plays on identically. **bot**: whole runs on `SEEDS` seeds at skills 1 and 0.6 with per-step invariants, and the balance table. `ONLY=purity,rules,maze,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-106/dev/browsertest.mjs` | Real Chromium (SwiftShader). **desktop**: title and back link, the attract demo plays behind the title without touching the HUD or event counts, New Game, real keys move, Escape pauses and the sim stops, a real Space presses the focused Resume, Space dashes, a level-up shows three cards and waits, a real `2` picks, Settings opened from Pause is on top, Save & Quit → Continue, the run ends with stats, Play Again. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, the touch deck, the stick moves, DASH dashes, the level-up cards are on screen and a tap picks, controls ≥ 44 px, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`, `VERBOSE=1` names each screenshot. Screenshots in `dev/shots/`. |
| `node game-106/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-106/dev/shot.mjs [page] [name]` | Screenshots a dev page; by default `dev/gallery.html` (every sprite at 8× on neutral grey, mirrored and hit-flash too) to `dev/shots/gallery.png`. `gallery.html?dark` uses the game's background. |

The browser scripts need `playwright` and a static server on port 8106:

```bash
python3 -m http.server 8106          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-106/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH` (or `PLAYWRIGHT_BROWSERS_PATH`). The game loads Press Start 2P from Google Fonts; the harnesses answer that with an empty stylesheet, so screenshots show the monospace fallback.

SwiftShader draws a few frames a second for the first couple of seconds (canvas warm-up), then 60, and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

Useful snippets for `play.mjs`:

```bash
# a busy mid-run room with the Grinner in it
node game-106/dev/play.mjs busy "__ia.start(11); __ia.ff(100); for (const id of [...__ia.ui.stack]) __ia.ui.closeScreen(id);" 2500
# the portrait camera and its edge arrows
node game-106/dev/play.mjs portrait "__ia.start(11); __ia.ff(75); for (const id of [...__ia.ui.stack]) __ia.ui.closeScreen(id);" 2500 390 844 touch
# frame rate with each effect off (view.fx.bloom / scan / vignette)
node game-106/dev/play.mjs fps "__ia.start(3); __ia.ff(40); __ia.view.fx.bloom = false; ..." 
```

## Debug hooks (`?debug=1`)

`window.__ia`: `G` (the game), `mode`, `seen` (a count of every sim event drained during play; the attract demo isn't counted), `view` (with `view.fx` toggles), `ui`, `audio`, `input`, `start(seed)` (skips the title), `autoplay(on)` (the bot plays the real game and picks upgrades), `ff(seconds)` (run the sim ahead with the bot, picking upgrades), `pick(i)` (take level-up card i), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
