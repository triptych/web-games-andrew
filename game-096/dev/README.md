# Homeward Hop — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-096/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **levels**: all fourteen build (the builder throws on any hop the body cannot make or any shell the world has not handed out), three found-things each, nothing buried, gates have switches, a chase level has no corners. **rules**: running, jumping, coyote and buffer, a held vs a tapped jump, every shell's power, crates, pearls and hearts, baddies, shots and blocking, the water, barrels, crumbles, switches and gates, the inventions. **bosses**: each fight, and that only the right shell hurts. **determinism**: same seed and inputs, same run; a save round trip mid-level plays on identically. **bot**: the bot plays every level immortal and mortal (`SEEDS` seeds) with per-step invariants and prints a timing table. **progress**: clears, unlocks, parts, building and wearing. `ONLY=purity,levels,rules,bosses,determinism,bot,progress`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-096/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, Start the Journey, the story, real keys run, jump, spin and roll, Escape pauses and the sim stops, Space on the focused Resume resumes, winning shows the results and saves, Next, the map, the workshop (build and wear a gadget), a reload offers Continue and the gadget is worn. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the story, the touch deck is on from the first stage, the stick runs, Jump / Spin / Power work, every control is ≥ 44 px and on screen, the HUD clears the back link, no sideways scroll, the canvas matches the visible viewport, the pause menu, results, map and workshop fit. **nostorage**: boots, plays and finishes a level with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-096/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-096/dev/shots.mjs` | One browser, many screenshots: every level run ahead by the bot to a few moments (`LEVELS=`, `SECS=`, `W=`, `H=`, `TOUCH=1`). Writes `dev/shots/gal-<level>-<n>.png`. |
| `node game-096/dev/shot.mjs` | Screenshots the model gallery `dev/models.html` on a neutral background: `SETS=pinch,shells,enemies,bosses,props,curios`, `Q="&gear=boater,magnet&state=glide&shell=3&h=2&d=4"`. Judge the cast here before they go under fog and light. |
| `node game-096/dev/perf.mjs` | Draw calls, triangles and geometries for a few levels (`renderer.info`). |

The browser scripts need `playwright` and a static server on port 8096:

```bash
python3 -m http.server 8096          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-096/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__hh`: `G` (the run), `mode`, `P` (progress), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(levelId)` (skips the menus), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with an immortal bot), `tp(x, y, z)`, `win()`, `give(partKind, n)`, `clearAll()` (every level cleared), `openMap()`, `openWorkshop()`, `toTitle()`, `launch(id)`, `pause()`, `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
