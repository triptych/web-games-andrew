# NEONFALL — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-092/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **rules**: running, screens and the ring, the jump (height, time, buffer, coyote), logs, pits, vines, crocodiles, cobras and fire, ladders, tunnels, walls, scorpions, treasure and streaks, extra lives, the clock, winning and losing, on a hand-built lab world. **world**: 60 generated worlds keep every generator rule (clear edges, vines over wide pits, ladder clearances, walls only on ladder screens, a ladder every 8 tunnel screens, 24 treasures on distinct screens, 8 underground). **determinism**: same seed and inputs → same game; a save round trip plays on identically; an unknown save version is rejected. **crossing**: on 3 seeds the bot crosses every surface screen in both directions with no death and no hit, every tunnel screen without a wall too, and no tunnel pocket lacks a ladder. **bot**: whole 20 minute games on `SEEDS` seeds (default 6) at skill 1, 0.85 and 0.7 with invariants after every step, and the balance table. `ONLY=purity,rules,world,determinism,crossing,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-092/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader), so the CRT pass runs. **desktop**: title and back link, the bot's demo behind the menu, Start Expedition, real keys run, jump and climb a ladder (Down beside the hole, then Up), Escape pauses and the sim stops, Space presses the focused Resume button, a treasure is collected and the HUD follows, Save & Quit → Continue, a whole game to the end screen, Play Again. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck, the stick runs Harry, JUMP jumps, the HUD fits and clears the back link, controls ≥ 44 px and on screen, the picture is 16:9 inside the visible viewport, pause stays open after the finger lifts. **nostorage**: boots and plays a whole game with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-092/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. The snippet can import sim modules, e.g. `const W = await import('/game-092/js/sim/world.js'); const i = W.getWorld(3).screens.findIndex(s => s.kind === 'croc'); __nf.start(3); __nf.tp(i, 60)` puts Harry at a crocodile pit. |

The browser scripts need `playwright` and a static server on port 8092:

```bash
python3 -m http.server 8092          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-092/dev/node_modules
```

No external library is loaded (Google Fonts is answered with an empty stylesheet and the game falls back to a system monospace). Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__nf`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot, dropping the effects of what it skipped), `tp(screen, x, layer)` (put Harry somewhere), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; `&seed=N` fixes the world. Neither does anything without `debug=1` (`seed` works always).
