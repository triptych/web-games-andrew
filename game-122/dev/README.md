# Rainglass — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-122/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every curio is inside the pane, big enough to find, unique, and has art in the painter. **rules**: wiping and its water cost, beads, the tap, heavy drops sliding and running off, drying out, spotting (a peephole is not enough), flow and chimes, completion, the melt, the album and the seal. **journey**: eight stations in order, then the small hours in a shuffled loop, the album filling to 32. **determinism**: same seed and inputs → same game; save round trips mid-pane, mid-melt and on a postcard play on identically; bad saves are rejected. **bot**: nine panes on `SEEDS` seeds at two skills with per-step invariants, and seconds a pane. `ONLY=purity,data,rules,journey,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-122/dev/browsertest.mjs` | Real Chromium. **desktop**: title with the attract demo, the back link, Board the train, a held mouse button and real arrow keys steer, sound on the meter, Space taps, pause freezes the sim, Settings over the pause menu and Escape from a focused slider, Space on a focused button, the album by M and ✉, a pane to its postcard, Save & Quit → Continue, the whole journey to the Morning ending, the small hours, the full album, the start-over confirm. Pixels are read back so a blank pane fails. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, relative drag steering from off the window, the tap button, the portrait journal, controls ≥ 44 px, the pause screen surviving the lift, no sideways scroll, the canvas matching the viewport. **nostorage**: plays a pane with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-122/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `DPR=2` for a sharper picture. |
| `node game-122/dev/shot.mjs` | Screenshots [gallery.html](gallery.html): all eight stations, early and in the small hours, with every curio's spot circle outlined (`RINGS=0` hides them). Use it to check that the art sits where the sim looks. |
| `node game-122/dev/preview.mjs` | The 1200×630 Garden preview: a pane half wiped at Lantern Quay, written to `garden/img/games/game-122.jpg`. |

The browser scripts need `playwright` and a static server on port 8122:

```bash
python3 -m http.server 8122          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-122/dev/node_modules
```

The game is Canvas 2D, so there is no three.js to serve. Fonts (Caveat, Nunito) are answered with an empty stylesheet; the game falls back to system fonts. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. Passing tests don't mean the screen looks right: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__rg`: `G` (the game), `mode` (`title`, `play`, `postcard`, `ending`), `seen` (a count of every sim event drained during play), `view`, `ui`, `audio` (with `level()`, the output meter), `input`, `start(seed)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (runs the sim ahead with the bot, stopping when the pane is done), `next()` (presses the postcard's button), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
