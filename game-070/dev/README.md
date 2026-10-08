# PHOSPHOR PATROL — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-070/dev/simtest.mjs` | Plays every wave of two loops headlessly with the bot (`js/sim/bot.js`), in Node, then a whole loop in one session. Fails on an exception, a NaN or anything outside the field, a colonist count that drifts, or a wave the bot can't finish within 7 sim-minutes (continues are used as a player would). Also checks rules: losing every colonist destroys the planet and turns snatchers into ravagers, the planet is rebuilt only after a boss, high falls kill and low falls land, catching and setting down score 500 each, meteors split 3 → 2 → 1 and score 20 / 50 / 100, a smart bomb clears the screen. `DIFF=cadet\|arcade`, `WAVES=0,4,9`, `LOOPS=1`, `SEEDS=3`, `GOD=1`. Takes about three seconds. |
| `node game-070/dev/browsertest.mjs` | Real Chromium + WebGL. Desktop: boot, attract pages and the bot demo, menu by click and keyboard, start, thrust both ways, climb, fire, smart bomb, hyperspace, pause, wave clear and tally, game over, continue, initials, high-score table. Then every one of the 15 waves (bosses included), the ending and loop 2. Then touch-only phones at 390×844 and 844×390: tap to start, the flight stick (thrust and turn around), FIRE, BOMB, HYPER, pause, 44 px targets, no overlaps, no sideways scroll. Fails on any console error, page error or failed request. `ONLY=desktop\|waves\|phones`. Screenshots in `dev/shots/`. |
| `node game-070/dev/play.mjs name "js after boot" [waitMs] [w h] [touch]` | Opens the real game with `?debug=1`, runs a snippet, screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8070:

```bash
python3 -m http.server 8070          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-070/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader renders this game at a few frames a second, so game time runs slower than real time in these scripts and screenshots catch more phosphor trail than a real GPU shows; the tests wait on state, not on the clock, and `__pp.ff()` runs the sim ahead when a screenshot needs a fight in progress.

## Debug hooks (`?debug=1`)

`window.__pp`: `mode`, `page`, `world`, `session`, `view`, `data`, `G`, `start(difficulty, wave)`, `god(on)`, `clearWave()`, `skipIntro()`, `goPage(n)` (attract page 0–4), `autoplay(on)` (the bot flies the real game, with sound), `ff(seconds)` (run the sim ahead with the bot flying).
