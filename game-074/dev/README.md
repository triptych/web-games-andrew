# CINDERWING — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-074/dev/simtest.mjs` | Plays the real simulation in Node. Checks the sim is pure (no three.js, DOM or `Math.random`); every stage's terrain keeps a flyable gap, its boss arena is open, and every ground enemy spawns on terrain; scripts only name real kinds. A god bot clears every stage inside a time budget with no NaN anywhere and every boss falls within 150 s of fighting. Rules: the first crystal brings the Halo, colour and level changes, cast and recall, the Halo absorbs bullets, a whole squadron drops its relic, Seraph deaths return to the checkpoint, Pilgrim hits cost health and respawn in place, a full Radiance charge hits hard, the boss arrives at the end. Then the balance table: the dodging bot plays every stage on each trial. `STAGES=0,3`, `QUICK=1` (god-bot pass only), `VERBOSE=1`. About two minutes. |
| `node game-074/dev/browsertest.mjs` | Real Chromium + WebGL. Desktop: title and back link, menus by keyboard, the prologue, flying, feathers, Radiance, the Halo, pause, options, continue and game over, a cleared circle into the next. Then every stage and boss, Malphas's three phases and the Dawn, the ending and credits, the attract demo. Touch-only phones at 390×844 and 844×390: taps through menus, relative drag, BEAM, HALO, pause, 44 px targets, no sideways scroll, no control over the HUD. Blocked `localStorage`. Fails on any console error, page error or failed request. `ONLY=desktop\|stages\|phones\|storage`. Screenshots in `dev/shots/`. |
| `node game-074/dev/play.mjs name "js after boot" [waitMs] [w h] [touch]` | Opens the real game with `?debug=1`, runs a snippet, screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8074:

```bash
python3 -m http.server 8074          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-074/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader renders at a few frames a second, so the tests load the game with `&fast=3` (three times the simulation per frame) and use `__cw.ff(seconds)` to run the sim ahead with the bot flying.

## Debug hooks (`?debug=1`)

`window.__cw`: `mode`, `world`, `G`, `view`, `ui`, `data`, `audio`, `start(stage, diff, skipStory)`, `story(id)`, `god(on)`, `autoplay(on)` (the bot flies the real game), `ff(seconds)`, `toBoss()`, `killBoss()`, `clearStage()`, `startDemo()`, `onAction(act)`.
