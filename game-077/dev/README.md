# CUE VICE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-077/dev/simtest.mjs` | The pure simulation in Node, no browser. Checks the sim is pure (no three.js, DOM, `Math.random` or clocks). Every level is rectangular, everything that matters (intel, tapes, switches, targets, terminals, recruits, the witness, the exit) can be reached by a rolling ball from the start, every patrol point is walkable and every patrol leg has a path. Thousands of random full-power shots never leave a ball inside a wall, never produce NaN and always come to rest. Rules: takedowns from behind, being seen, soft frontal bumps, sinking guards, splashing teammates, darts, blasts, Doc's healing and revives, recruits, the locked exit, Instant Replay, the boombox, Jinx's secure terminals and ghosting, Tito's wrecking and anchor, bosses, the precinct's no-alarm rule. Every episode is won through the real rules. No episode notices the squad in its first 4.5 s, and every patrol actually walks. `VERBOSE=1` prints every check. About 20 s. |
| `node game-077/dev/browsertest.mjs` | Real Chromium + WebGL. Desktop: title and back link, New Game into the prologue and the briefing, a real mouse drag shot with the aim guide, Space for Rico's ability, R rewind, T wait, keyboard aiming, wheel zoom, pause, options by keyboard, Busted and Instant Replay, Case Closed, buying an upgrade, the interlude into Episode 2, every title menu. Then every episode at 3× with random shots, waits and abilities, the ending and the credits. Touch-only phones at 390×844 and 844×390: tap through the menus, a touch drag shoots, ABILITY fires, ❚❚ pauses, 44 px targets, no sideways scroll, the HUD fits. Blocked `localStorage`. Fails on any console error, page error or failed request. `ONLY=desktop\|episodes\|phones\|storage`. Screenshots in `dev/shots/`. |
| `node game-077/dev/play.mjs name "js after boot" [waitMs] [w h] [touch]` | Opens the real game with `?debug=1`, runs a snippet, screenshots to `dev/shots/name.png`. E.g. `"__cv.start(7); __cv.view.vhs = 0"`. |
| `node game-077/dev/shoot.mjs ep dx dy` | Starts an episode and drags the selected teammate back by (dx, dy) pixels with the real mouse; screenshots the aim and the roll. |

The browser scripts need `playwright` and a static server on port 8077:

```bash
python3 -m http.server 8077          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-077/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader renders at a few frames a second, so the tests drive the sim directly through the debug hooks where they need time to pass (`__cv.settle()`), and use real mouse, keyboard and touch input for everything a player does.

## Debug hooks (`?debug=1`)

`window.__cv`: `G` (mode, selection, aim), `W` (the live `World`), `view`, `ui`, `data`, `audio`, `store`, `LEVELS`, `start(ep, squad?)`, `brief(ep)`, `playStory(keys, then)`, `shoot(id, angle, power)`, `settle(seconds)`, `win()`, `lose(why)`, `unlockAll()`, `toTitle()`. `&fast=N` runs the sim N× per frame.
