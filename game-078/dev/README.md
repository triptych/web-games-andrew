# Sugarplum Drop — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-078/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: aiming and its limits, dropping, the cooldown and the buffered press, which treats are dropped, falling and resting, merging (same kind only, at the midpoint, scored), a cascade into a second merge, chains, two Jingle Bells, the line (and a falling treat not counting), nothing moving after game over. **physics**: a heap of treats comes to rest without sinking into itself or leaving the jar; a rolling treat turns the right way without sliding; a big merge swelling into a tight heap shoves gently. **determinism**: same seed and inputs → same game; a save round trip plays on identically; unknown and malformed saves are rejected. **bot**: whole games on `SEEDS` seeds at skill 1 and 0.5, with per-step invariants and overlap sampling, and the balance table. `ONLY=purity,rules,physics,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-078/dev/browsertest.mjs` | Real Chromium. **desktop**: title with the demo playing and the ladder, back link, How to Play, New Game, held ← aims, Space drops, a real mouse aims by hovering and drops by clicking, two placed truffles merge, Escape pauses and the sim stops, Space on Resume doesn't also drop, ❚❚, Save & Quit → Continue restores the jar, the jar fills → game over with the score and best, Play Again has the focus and starts fresh. **phones** (touch only, real CDP touches) at 390×844 and 844×390: a tap on New Game drops nothing, the dropper follows a dragged finger and lifting drops, a quick tap drops, ❚❚ is 44 px and stays open after the lift, a tap on Resume doesn't drop, the jar is on screen under the HUD, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots, plays and ends with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-078/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=3'` adds URL parameters. |
| `dev/treats.html` (open from the server) | Every treat at 60 px radius on a neutral background with its physics disc dashed, on the game's night sky, and at phone size. Look here before judging a drawing in the jar. |

The browser scripts need `playwright` and a static server on port 8078:

```bash
python3 -m http.server 8078          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-078/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. Google Fonts requests are answered with an empty stylesheet; the game falls back to a system font.

The tests open the game with `&fast=2` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__sd`: `G` (the game), `mode` (`title` | `play` | `over`), `best`, `seen` (a count of every sim event drained during play), `view` (with `jarRect()`, `scale`, `toWorld()`), `ui`, `audio`, `input`, `start(seed)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `place(tier, x, y)` (put a treat in the jar), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
