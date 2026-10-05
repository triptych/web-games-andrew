# BRICKVADERS — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-060/dev/simtest.mjs` | Plays every stage of two loops headlessly with the bot (`js/sim/bot.js`), in Node. Fails on an exception, a NaN or a ball outside the field, or a stage the bot can't finish within 8 sim-minutes (continues are used as a player would). `DIFF=cadet\|arcade`, `STAGES=0,3,8`, `LOOPS=1`, `SEEDS=3`, `GOD=1`. Takes about ten seconds. |
| `node game-060/dev/browsertest.mjs` | Real Chromium + WebGL. Desktop: boot, attract pages and the bot demo, menu by click and keyboard, start, launch, steer with keys and mouse, fire, pause, wave clear and tally, continue, game over, initials, high-score table. Then every one of the 24 stages, the ending and loop 2. Then touch-only phones at 390×844 and 844×390: tap to start, spinner pad, FIRE, pause, 44 px targets, no sideways scroll. Fails on any console error, page error or failed request. `ONLY=desktop\|stages\|phones`. Screenshots in `dev/shots/`. |
| `node game-060/dev/play.mjs name "js after boot" [waitMs] [w h] [touch]` | Opens the real game with `?debug=1`, runs a snippet, screenshots to `dev/shots/name.png`. |
| `node game-060/dev/profile.mjs [stage]` | CPU-profiles three seconds of a stage with the bot playing and prints the hottest functions. |

The browser scripts need `playwright` and a static server on port 8060:

```bash
python3 -m http.server 8060          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-060/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader renders this game at roughly 10–15 fps (the JS thread is ~93% idle, waiting on the software GPU), so game time runs slower than real time in these scripts; the tests wait on state, not on the clock.

## Debug hooks (`?debug=1`)

`window.__bv`: `mode`, `page`, `world`, `session`, `view`, `data`, `G`, `start(difficulty, stage)`, `god(on)`, `killAll()`, `skipIntro()`, `goPage(n)` (attract page 0–4), `autoplay(on)` (the bot drives the real game, with sound).
