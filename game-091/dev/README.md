# STARSPIN — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-091/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: spin, nudge and respin with their Energy, payline maths (pairs, three to five of a kind, Wild Stars, Static, every perk that changes the numbers), Block, Burn, jams that only last a fight, targets, rewards, the Constellation, Waystations, bosses, winning and losing. **tree**: 300 Constellations with no crossing edges, no dead ends, every star reachable, an Extra Reel in each keystone row and one Supernova Heart at the top. **determinism**: same seed and actions → same run; a save round trip mid-run plays on identically; an unknown save version is rejected. **bot**: whole runs on `SEEDS` seeds (default 60) at skill 1 and 0.6 with invariants after every action, and the balance table. `ONLY=purity,rules,tree,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-091/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Run, real keys spin, select, nudge and fire, pause blocks actions, Space presses the focused Resume button, C opens the Constellation to look at, Salvage → card → Ignite → Continue by click, Save & Quit → Continue, the run ends, New Run. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, every control ≥ 44 px and on screen, the reels and tags between the HUD and the bar, tap SPIN, tap a reel to select it, swipe up to nudge, tap FIRE, pause stays open after the finger lifts, a Salvage card and a star by touch. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-091/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. The snippet can import sim modules, e.g. `const B = await import('/game-091/js/sim/battle.js'); B.startBattle(__ss.G, ['house'], true); __ss.ff(0)` sets up a boss fight. |

The browser scripts need `playwright` and a static server on port 8091:

```bash
python3 -m http.server 8091          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-091/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second, so the tests open the game with `&fast=4` (the show of a resolved turn plays four times faster) and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ss`: `G` (the run), `mode`, `pending` (actions waiting for the show), `seen` (a count of every sim event played), `view`, `ui`, `audio`, `input`, `idle()` (no event playing and no reel turning), `start(seed)` (skips the title), `autoplay(on)` (the bot plays the real game through the show), `ff(n, until)` (the bot plays up to `n` actions, or until `until(G)` is true, then the view snaps to the result; `ff(0)` just resyncs), `act(action)` (as if the player pressed it), `save()`, `hasSave()`. `&fast=N` plays the show N× faster; it does nothing without `debug=1`.
