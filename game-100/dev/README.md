# Glitterball Groove — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-100/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: the first board is full, match-free and has a move; refused swaps bounce and cost nothing; 3, 4, 5 and L matches clear and make the right special in the right place; beams, bombs and Glitterballs and all five combinations; the combo multiplier and its window; Fever; level lines and rooms; the clock, Slow Jam's moves and the end of a game; held swaps; shuffles. **determinism**: same seed and inputs → same game; a save round trip plays on identically; unknown save versions are rejected. **bot**: the bot plays whole games of both modes at two skills on `SEEDS` seeds with per-step invariants (unique ids, tokens where they say they are, finite numbers, a calm board is full, score never drops) and prints the balance table. `ONLY=purity,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-100/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the power screen, a key powers on, Enter skips the boot, the attract loop, the menu by keyboard into a game; real arrow keys and Space move, grab and swap; a real mouse **drag** and two **clicks** swap (the pointer is mapped back through the CRT bend: this fails if the bend and its inverse disagree); a refused swap; pause stops the sim, Resume by mouse; Save & Quit → Continue restores the game; the band is audible and the mix doesn't clip; the clock runs out; a high score; initials typed on the keyboard; the table shows them. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through power, boot, the menu and mode list; tap-tap and swipe swap; pause by tapping the button and resume; every control ≥ 44 px and on screen; the whole board on screen; no sideways scroll; the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-100/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-100/dev/gallery.mjs [w h] [touch]` | One browser session, a screenshot of every screen (power, boot, logo, scores, how to play, menu, modes, settings, how to, Hall of Fame, ready, play, Fever, pause, game over, initials) into `dev/shots/g-<name>-<w>x<h>.png`. For judging the look; `ONLY=menu,hud` for a few. |
| `node game-100/dev/flicker.mjs` | Reads every frame back and splits the picture into a 4 × 3 grid, counting how often a region's average brightness jumps and jumps back: a flash, as opposed to a drift or an edge moving across. Menu and idle board, effects on and calm; calm must show no flip at all, normal at most four in any region. Prints how much merely drifted too. |
| `node game-100/dev/preview.mjs` | The 1200×630 share and Garden Library picture (a board in Disco Fever): writes frames to `dev/shots/preview-<n>.jpg`; copy the best to `garden/img/games/game-100.jpg`, then `ONLY=game-100 node dev/add-meta.mjs`. |

The browser scripts need `playwright` and a static server on port 8100:

```bash
python3 -m http.server 8100          # repo root
ln -s ../../dev/node_modules game-100/dev/node_modules      # after: mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws about two frames a second at 1280×760 and the loop caps a frame at 0.05 s, so the browser test opens the game at the **Low** quality tier (no MSAA, no bloom) with `&fast=20` (20× simulation per frame) and waits on state, never on the clock. A UI timer (the boot, the attract loop, the game-over delay, the countdown) runs on that capped frame time, so a test that waits for one waits on `__gg.ui.t`, not on milliseconds. Passing tests don't mean the screen looks right: run `gallery.mjs` and look.

## Debug hooks (`?debug=1`)

`window.__gg`: `G` (the player's game), `demo` (the attract loop's), `screen`, `cursor`, `seen` (a count of every sim event drained), `stage`, `ui`, `audio`, `input`, `board`, `fx`, `backdrop`, `dancers`, `start(mode, seed)` (skips the pre-roll and the countdown), `autoplay(on, skill)` (the bot plays the real game), `ff(seconds, skill)` (run the sim ahead with the bot), `goto(screen, data)`, `toMenu()`, `moves()` (every legal swap now), `hit(id)` (client coordinates of a UI control), `hits()` (their ids), `cell(r, c)` (client coordinates of a board cell, through the bend), `save()`, `hasSave()`, `settings`, `press(key)`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
