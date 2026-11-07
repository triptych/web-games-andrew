# Atlas of Ink — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-123/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **world**: every seed builds a valid world (features on the right ground, harbours on a coast, rivers, an island's worth of land) and the same seed builds the same one. **rules**: the quill, focus building and bleeding, radius and error growing with focus, features that need a steady cast, the confidence rule, the clock, delivery, the season ending. **commissions**: every seed gets the six clients in order and each is solvable (a true route exists, targets sit inside their regions); a perfect chart earns three stars from every client, a chart that hides the reefs wrecks the ship, a goal that was never found cannot be reached. **determinism**: same seed and inputs → same game; a save taken mid-cast, or on a result screen, plays on identically; damaged saves are rejected. **bot**: whole seasons at three skill levels with per-step invariants, and the balance table. `ONLY=purity,world,rules,commissions,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-123/dev/browsertest.mjs` | Real Chromium. **desktop**: title with the attract demo, the back link, New Season → brief (the clock waits), Enter on Begin does not also open the hand-over dialog, real keys move and focus and cast, a quick tap casts, pause freezes the sim, Space presses the focused Resume, Escape closes Settings with a slider focused, Enter and E ask before handing over, the result and its stars, Next, Save & Quit → Continue restores the sheet, a whole season to the end screen and the best-season line, a new season. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck, the stick moves, a second finger holds SCRY while the stick is down, ✓ asks first, controls ≥ 44 px, the HUD clears the back link, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-123/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `DPR=2` for a sharper picture. |
| `node game-123/dev/preview.mjs` | The 1200×630 Garden preview: the Obsidian Court road half charted, written to `garden/img/games/game-123.jpg`. |

The browser scripts need `playwright` and a static server on port 8123:

```bash
python3 -m http.server 8123          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-123/dev/node_modules
```

The game is Canvas 2D, so there is no three.js to serve. Fonts (Caveat, IM Fell English) are answered with an empty stylesheet; the game falls back to system serif and cursive. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ai`: `G` (the game), `mode` (`title`, `play`, `over`), `seen` (a count of every sim event drained during play), `view`, `ui`, `audio` (with `level()`, the output meter), `input`, `start(seed, brief = false)` (skips the title; `true` shows the first brief), `autoplay(on)` (the bot plays the real game, including the clock), `ff(seconds)` (run the sim ahead with the bot; it hands the chart over by itself when it has charted everything), `finish()` (the bot plays the commission out and hands it over), `deliver()`, `jump(n)` (skip to commission n without playing the ones before), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame and `&seed=N` fixes the seed New Season uses; neither does anything without `debug=1`.
