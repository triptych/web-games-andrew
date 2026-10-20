# Curio Cove — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-088/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **board**: matching, every special and combo on hand-drawn boards, dirt and fossils, boulders, crust, relics, gravity past a boulder, refused swaps, out of moves and five more, the hammer, the shuffle, Treasure Rush. **fuzz**: random moves (and hammers) over 72 levels with `checkBoard` after every one. **levels**: 60 story levels and 40 Night Digs build deterministically, start still and with a move, and have goals that match their boards; the rewards cover all 60 finds and every bone; every task has a scene. **museum**: gating, tasks, staff, the till, decorations, boosters, a won dig, a replay, buying moves, time away. **determinism**: same seed → same game; a save round trip mid-dig plays on identically; an unknown save version is rejected. **story**: bots at skill 1 and 0.5 play the whole story to the Grand Reopening and print the balance table. `ONLY=purity,board,fuzz,levels,museum,determinism,story`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-088/dev/tune.mjs` | Fits every story level's moves and two- and three-star scores to a skill-0.5 bot and writes them into `TUNED` in `js/sim/levels.js`. `DRY=1` prints only, `SEEDS=n`, `ONLY=13-24`. Run it after changing level generation or scoring, then run simtest. About a minute. |
| `node game-088/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game and a typed name, the intro scene (Space, Skip), Dig by click, a real mouse drag swap, a keyboard swap, Escape pause, the hammer, a win and its card, back to the museum with the find, a task by click and its scene, every journal tab, buying in the shop, reload → Continue, running out of moves → +5 moves → back to the museum. **island**: the geography (every camp level and dry, the museum floor flat, no sea inland, the volcano tall), a mouse drag pans, the wheel zooms, a right-drag turns, the 🗺️ button shows the whole island and names its places, a tapped name flies there, a locked camp says which chapter opens it. **phones** (touch only, real CDP touches; one finger pans and two pinch) at 390×844 and 844×390: taps through the menus, ≥ 44 px controls on screen, every board cell on screen and clear of the HUD, a touch drag swap, pause stays open after the finger lifts. **nostorage**: boots and digs with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-088/dev/flicker.mjs [level] [w h]` | Photosensitivity check: opens a dig, waits for the board to settle, reads ~40 frames back (every 8th pixel) and prints the share of points whose brightness swung by more than 0.25 and the largest swing. `STILL=1` freezes the finds' bob so only light changes count (motion of edges otherwise dominates); `WHERE=1` lists the worst points; `GAME=path` measures another copy of the game. The browser test runs the same measurement on a 390×844 phone and fails above 1%. |
| `node game-088/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=4'` adds URL parameters. |
| `node game-088/dev/shot.mjs [page] [name]` | Screenshots a dev page: `gallery.html` (every model on a neutral background; `?only=tiles,art,dinos,animals`) or `digtest.html?level=N&moves=K` (the dig view alone, with the bot playing). `VIEW=390x844` resizes. |

The browser scripts need `playwright` and a static server on port 8088:

```bash
python3 -m http.server 8088          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-088/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. CSS animations may not have run a frame when a test measures a button: the browser test finishes a sheet's pop-in before it taps. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__cc`: `G` (the game), `mode` (title, museum, dig), `busy` (the board is animating), `frames`, `seen` (a count of every event drained, and `b:<type>` for board events), `digView`, `museum`, `ui`, `audio`, `input`, `stage`; `start(seed, name, keepIntro)` (skips the title and, unless asked, the intro), `dig(n)`, `autoplay(on, skill)` (the bot plays through the real swap handler), `win()` (the bot finishes the dig in the sim at once, then the view catches up), `story(digs)` (bots play the story ahead in the sim), `give(stars, coins)`, `task(id)`, `ff(sec)` (museum clock), `save()`, `hasSave()`, `cell(r, c)` (screen point of a cell), `setCursor(r, c)`, `moves()` (valid swaps). `stage.armSampler()` / `stage.swing(by)` read frames back for the flicker measurement; `digView.still = true` freezes the finds' bob. `&fast=N` speeds the dig's animations and the museum clock; it does nothing without `debug=1`.
