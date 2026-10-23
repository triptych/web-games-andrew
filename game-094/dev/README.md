# THE LONG HELIX — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-094/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **graph**: every `to` exists, every node is reachable, seven endings, every item and journal entry the story hands out exists, all prose is real. **rules**: the three disciplines, 2d6 checks (forced and rolled, with the pass rate measured), the pack limit, drop, use, locked choices, the clock, death by health and by clarity, the supply ship on day 60, every final choice. **determinism**: same seed and choices → same game; a save round trip plays on identically; bad saves are rejected. **bot**: whole playthroughs on `SEEDS` seeds × four goals × (dice, forced pass, forced fail): nothing is ever left with no choice, the pack never overflows, every ending is reached, every node is visited; prints the balance table. `ONLY=purity,graph,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-094/dev/browsertest.mjs` | Real Chromium. **desktop**: power on → boot show → title, the typewriter really types (and clacks), any key finishes the typing without also choosing, number keys / arrows+Enter / Space on a focused button all choose, floppy sound on each scene, a roll shows its dice, menu / journal / settings (the phosphor and typing speed change), pack select / use / drop, the bot plays to an ending through the real buttons, the end card, Save & Quit → Continue. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through title and story, a tap on the story finishes the typing without choosing, SHEET / PACK tabs, controls ≥ 44 px, text clear of the ← Games link. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-094/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `game-094/dev/gallery.html` | Every scene's 1-bit picture side by side (serve the repo root, open `/game-094/dev/gallery.html`). Judge a picture here before judging it under the scanlines. |

The browser scripts need `playwright` and a static server on port 8094:

```bash
python3 -m http.server 8094          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-094/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. There is no WebGL and no CDN: the game is plain DOM and a 2D canvas, so nothing is routed or stubbed.

The game types at a real speed, so the tests open it with `&fast=30` (typing and picture drawing 30× faster) and wait on state, never on the clock. The one test that checks the typewriter itself runs at `fast = 1`. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__lh`: `G` (the game), `mode` (`power | boot | title | play | over`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title), `choose(i)`, `autoplay(on, goal, seed)` (the bot plays the real game through the real UI; goal is `signature | edit | fire | leave`), `ff(n, goal, seed)` (n bot actions at once, finishing the typing each time), `skip()`, `save()`, `hasSave()`. `&fast=N` types and draws N× faster. `?debug=1` also skips the power-on and boot show; add `&boot=1` to keep them. None of it does anything without `debug=1`.
