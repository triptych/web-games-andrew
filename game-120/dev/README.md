# HEXAPOD RISING — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-120/dev/simtest.mjs` | Headless, in Node (~45 s). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: tables are consistent, every boss attack named in a phase exists. **terrain**: all six levels × 10 seeds generate a field the weakest walker can cross and reach every pod; the same seed builds the same field. **rules**: walls, jump jets and fuel, boost, guns, missiles, pickups, pods, hazards, armour, upgrades and growth, stomps, drop-pod ambushes, the level flow, death and retry. **bosses**: every attack of every phase of every boss runs to its end with finite numbers; phase changes are invulnerable and announce themselves; shield pylons soak damage and stun the boss when broken; exposed cores take extra; the Leviathan cannot be hit underground and erupts after a telegraph; shockwaves hurt a grounded walker and miss a jumping one; killing a boss opens the gate. **determinism**: same seed and inputs → same game; a save round trip mid-fight (and mid-boss, with pylons) plays on identically. **bot**: whole campaigns at two skill levels with per-step invariants and a balance table. `ONLY=purity,data,terrain,rules,bosses,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-120/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the title (an attract-mode bot is fighting behind it), Space presses the focused button, story → briefing → Deploy, real keys walk and jump, the mouse aims, clicks fire and launch missiles, pause freezes the sim, Escape closes Settings with a slider focused, Save & Quit → Continue, the hangar buys and grows the walker, game over → retry, the Warlord's fall → ending. **high**: the bloom, shadow and MSAA path. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, both sticks, JUMP and MSL, controls ≥ 44 px, no sideways scroll, the canvas matches the visible viewport, the hangar fits and buys. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,high,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-120/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-120/dev/shots.mjs` | A gallery run: a screenshot per scene (title, a fight, each of the five bosses framed by the debug focus camera, the hangar) into `dev/shots/s-*.png`. `ONLY=boss3,hangar`, `Q='&q=high'`, `W=`/`H=`. |
| `node game-120/dev/preview.mjs` | Writes the 1200×630 Garden preview, `garden/img/games/game-120.jpg`. |

The browser scripts need `playwright` and a static server on port 8120:

```bash
python3 -m http.server 8120          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-120/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and `&q=low` (no bloom, no shadows) and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots, boss by boss.

## Debug hooks (`?debug=1`)

`window.__hr`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, level, upgrades)` (skips the title and story), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `warp(z)`, `god()` (the walker cannot be hurt), `hangar()`, `buy(track)`, `brief()`, `save()`, `hasSave()`, `skip()` (jump the pending screen timer). `__hr.view.focus = { a, k }` frames the living boss from angle `a` at `k` radii. `&fast=N` runs N× the simulation per frame and `&q=low|med|high` picks graphics; neither does anything without `debug=1`, except `q`.
