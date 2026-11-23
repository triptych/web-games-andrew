# Inn Over My Head — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-147/dev/simtest.mjs` | Headless, in Node. **purity**, **hotel** (dust, bunnies, sparkle, check-in, tips, checkout, walk-ins, the day, dailies, staff, shop, decor, time away), **cooking** (needle, zones, quality, the self-stirring pot, serving, crafting), **debt** (payments, unlocks, late fees, the win), **recruits** (all four strangers), **bonds** (levels, vignettes, synergy, duo/trio chains), **battle** (timeline, elements, stagger, free chains, the gauge, combos, items, defend, flee, every skill and chain, rewards, defeat, the three auto presets), **determinism** (seeds, a mid-battle save round trip), **bot** (whole games over `SEEDS` seeds at two skills; debt paid by day 40; the attentive bot never late). `ONLY=…`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-147/dev/browsertest.mjs` | Real Chromium + SwiftShader. **desktop** by real mouse and keys: title, the intro scene, a dust bunny clicked in 3D, a check-in from the Desk (key 1), a pinned ✕ on a long panel, a Honey Tart stirred with Space in the gold zone, rigged models and clips loaded, music playing and clips decoded, an adventure (key 9) with an attack by A and Enter, the auto-battle (T) to victory, home, Save & Quit, Continue. **phones** (touch only) at 390×844 and 844×390: the title and scene by taps, the dock, a tapped bunny, a battle by tapping Attack and an enemy. **nostorage**. Fails on any page error, console error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-147/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `AFTER="js"` runs a second snippet before the shot. |
| `node game-147/dev/rigshot.mjs who clip,clip [frames]` | A strip of frames per clip of a rigged model from `dev/rig/` (copy `models/<who>.glb` and `models/anim/<who>-<clip>.glb` there). |
| `node game-147/dev/icons.mjs` | Renders every Meshy item model as a 128 px toon icon into `art/icons/`. |
| `meshy/`, `art/`, `audio/` | The media pipelines and what was generated: see their READMEs. |

The browser scripts need `playwright` and a static server on port 8147:

```bash
python3 -m http.server 8147          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-147/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root).

SwiftShader draws a few frames a second, so the tests open the game with `&fast=3` and wait on state, never on the
clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__iomh`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `start(seed)`
(skips the title and the intro), `act(cmd)` (any command the UI sends), `autoplay(on, skill)` (the bot plays the real
game), `ff(seconds, skill)` (the sim runs ahead with the bot), `busy()` (a battle animation or undrained events),
`save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame.
