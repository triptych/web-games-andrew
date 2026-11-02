# Crystal Crescendo — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-113/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **maps**: 24×16, known tiles, chests filled, every person, sign, chest, Song Crystal, trigger, exit and route stop reachable on foot from the spawn, every scene a map names exists. **song**: 1,000+ composed phrases (40 seeds × 6 phrases × play/guard/solo × 3 densities × 5 band shapes) with no overlapping notes in a lane, holds inside the phrase, syllables only on Marigold's lane, the same phrase written the same way twice, a full band playable. **battle**: PERFECT/GOOD/miss judgments, a press too early is ignored, guard misses hurt and blocks don't, melody heals, lyrics ward, a harmony hold held to the end (and dropped), knock-outs silence a lane, Crescendo revives, the tutorial can't be lost, defeat → Try again, a win clears the roaming monster. **save**: round trips mid-story and mid-duel (talk phrases' `Infinity` included) play on identically; unknown versions are rejected. **story**: the bot plays from the prologue to the credits at skill 1 and 0.75 on `SEEDS` seeds with per-step invariants and prints the balance table. `ONLY=purity,maps,song,battle,save,story`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-113/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title, New Game → difficulty, the prologue advanced by real Space presses, walking with real arrows, real Space to talk to Otto, Otto's tutorial lines, falling notes judged on real D/F/J/K presses, AUTO finishing the duel with no presses (and the setting remembered and switched off), the results, pause stopping the sim, the band menu, Save & Quit → Continue, the route map by click, defeat → Try again → Return to the Song Crystal. **final**: the throne scene into the final battle, the Hush, the Colossus and its golden notes, the credits. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, a tap on the dialogue box advances, the touch deck, the stick, A, the duel's lane pads (≥ 44 px, on screen, a tap is a press), ❚❚ and Resume, no sideways scroll. **nostorage**: plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,final,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-113/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1` (add `Q='&fast=4'` for more), runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-113/dev/shot.mjs [page] [name]` | Screenshots a dev page: by default [gallery.html](gallery.html), every person in every view and pose, Otto, the Archivist and every monster on a neutral background. |
| `node game-113/dev/preview.mjs` | The 1200×630 launcher picture: a duel in Frosthold with the full band, to `garden/img/games/game-113.jpg`. |

The browser scripts need `playwright` and a static server on port 8113:

```bash
python3 -m http.server 8113          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-113/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws about five frames a second at 1280×760 and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4&q=0` and wait on state, never on the clock. **The first frame of a duel takes ~15 s under SwiftShader**: it compiles about thirty shader programs (it is a fraction of a second on a GPU). Two presses inside one slow frame merge into one confirm edge, so tests space their presses. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ccr`: `G`, `mode` (title | play | ending), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `highway`; `start(seed, difficulty)` (skips the title), `chapter(name, level)` (jumps to `beach`, `aurelune`, `marisonde`, `sunreach`, `frosthold` or `spire` with the band and flags that chapter would have), `battle(enemy, opts)`, `scene(id)`, `skipScene(maxSec)` (confirms every line until the scene hands over), `near(id)` (stand beside a person), `autoplay(on, skill)` (the bot plays the real game), `ff(seconds, skill)` (run the sim ahead with the bot), `save()`, `hasSave()`, `pause()`, `resume()`. `&fast=N` runs N× the simulation per frame and `&q=0|1|2` picks the graphics quality; `fast` does nothing without `debug=1`; `q` works on any URL.
