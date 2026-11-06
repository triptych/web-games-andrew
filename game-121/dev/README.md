# ARCANA WAGON — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-121/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **lexicon**: 12 themes × 2 symbols, every theme on three or more cards and with an omen, 4 boon and 4 bane colours, what Orla's journal knows. **reading**: over 400 seeds the hand always holds a perfect three-star spread *and* a false lead, the omen speaks for the first clouded vision, the worry is one of the beats, day-one readings use only known things. **story**: every guest, clue, scene, prince night and ending is wired; every clue can be learned from a reading *and* (three of them) from a confidant; every line of text is sane. **rules**: each command in each phase, Focus, stars, the clue threshold, ranks, evenings, affection, trust, the festival, all four endings and all three romance tiers. **determinism**: same seed and choices, same game; a save round trip at nine different moments plays on identically. **fuzz**: 24 games of random commands never break an invariant and the bot can always finish afterwards. **bot**: a perfect seer, a learner (it knows only what the Codex has taught it) and a random one play whole games on `SEEDS` seeds; the balance table is printed. `ONLY=purity,lexicon,reading,story,rules,determinism,fuzz,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-121/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game, the prologue types and a click finishes it, real Space and Enter go on exactly one line, the first guest walks in, gaze → three visions → omen → draw → six cards → lay by click and number key, take back with Backspace → turn → choose a style → the result card, Escape pauses and the clock stops, a slider with focus doesn't eat Escape, Space presses a focused menu button, C opens the Codex, Save & Quit → Continue, the evening screen, the Second Prince's choices, the festival, the ending, Begin Again; **pixels are read back** so a black canvas fails, and the music's peak level is checked. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the whole reading, controls ≥ 44 px and on screen, nothing under the ← Games link, a second tap right after the typing finishes does not pick an answer, a menu opened by a finger stays open. **nostorage**: boots and plays the whole story with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-121/dev/shots.mjs` | Boots once and takes a gallery of screenshots (`STEPS=ball,deal`, `W=390 H=844 TOUCH=1 SUFFIX=-phone`). Software WebGL needs ~40 s to boot, so use this rather than `play.mjs` when looking at several moments. |
| `node game-121/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `game-121/dev/gallery.html` | Every card face and glyph on one page. Judge the art here before you judge it under bloom. |
| `node game-121/dev/preview.mjs` | The 1200×630 Garden preview, `garden/img/games/game-121.jpg`. |

The browser scripts need `playwright` and a static server on port 8121:

```bash
python3 -m http.server 8121          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-121/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.1 s, so the tests open the game with `&fast=6` and wait on state, never on the clock. It also turns bloom and MSAA off (`q=low`); add `&q=high` to look at the glow. Passing tests don't mean the screen shows what you meant: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__aw`: `G` (the game), `mode` (`title` / `play`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title), `act(cmd)` (the same commands the UI sends: `next`, `choose`, `gaze`, `focus`, `draw`, `place`, `unplace`, `lay`, `say`, `evening`), `autoplay(on, { mode, romance })` (a bot plays the real game, frame by frame), `playTo(pred, { mode, romance })` (the bot plays with no rendering until `pred(G)`; this is how a screenshot gets to day 6), `save()`, `hasSave()`, `toTitle()`. `&fast=N` runs N× the clock; it does nothing without `debug=1`.

Bot options: `mode` `perfect` (knows the whole lexicon), `learner` (only what the Codex has taught it) or `random`; `romance` `elias`, `mirabel`, `wren` or `none` (it studies instead).
