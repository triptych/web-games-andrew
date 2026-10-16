# BUBBLE NEBULA — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-082/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock (comments and strings are stripped before the grep). **stamp**: `index.html`'s import map is stamped with this `VERSION`. **levels**: all 25 sectors build; the floor holds the start; every platform, every walker's spawn, the air current and the top gap can be reached, proved on the jump graph the real body mover makes (`js/sim/nav.js`); loot dropping in through the top gap lands; ceiling and floor gaps line up. **rules**: walking, the 4.76-tile jump, one-way platforms, walls, the wrap; blowing, trapping, breaking out angry, popping, chains and their doubling loot, bouncing; letters and EXTEND; extra lives; HURRY UP! and the Wraith; dying, respawning, GAME OVER and continuing; zap, nova and all six power-ups; clearing, the quick-clear bonus and the warp; the Baron from his first hit to the Nebula Heart. **determinism**: same seed and inputs → same game; save round trips at three points mid-sector play on identically; unknown versions and impossible sectors are rejected. **bot**: the bot plays the whole campaign on `SEEDS` seeds at skill 1 and 0.6, with per-step invariants, and prints the time and deaths for every sector. `ONLY=purity,levels,rules,determinism,bot`, `SEEDS=n` (default 6), `VERBOSE=1`. About 20 s. |
| `node game-082/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the title with the bot's demo behind it, the version-stamped modules, New Game, real keys walk, a tapped jump and a tapped bubble (both latched), Escape pauses and the sim stops, Space on the focused Resume button, ❚❚, ↓↓↓ + Enter to Save & Quit, Continue restores the run, the bot clears sector 1 and sector 2 scrolls in, GAME OVER and Continue, the bot beats the Baron, the ending, a name on the high-score table. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the deck appears, holding ▶ and sliding onto ◀, JUMP, ◯, controls ≥ 44 px and on screen, the playfield clear of the deck, no sideways scroll, the canvas matches the visible viewport, the pause screen survives the finger lifting. **nostorage**: boots, plays and pauses with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. About 3 minutes. |
| `node game-082/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=4'` adds URL parameters. |
| `node game-082/dev/shot.mjs [page] [name] [w h]` | Screenshots a dev page; by default `dev/models.html`, the model gallery: Pip, the crew (plus angry and frozen tints), the Wraith, the Baron and every piece of loot on neutral grey. Judge models there, not under bloom in the game. |
| `node game-082/dev/stamp.mjs` | Writes `VERSION` into the import map in `index.html` (every module becomes `file.js?v=VERSION`). Run it after bumping the version or adding a module; `--check` only reports. |

The browser scripts need `playwright` and a static server on port 8082:

```bash
python3 -m http.server 8082          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-082/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__bn`: `G` (the game), `mode` (`title`, `play`, `over`, `ending`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, level)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead synchronously with the bot), `goto(level)` (load a sector), `save()`, `hasSave()`, `LAST` (the Baron's sector index). `&fast=N` runs N× the simulation per frame and `&quality=0|1|2` forces the graphics setting; `fast` does nothing without `debug=1`.
