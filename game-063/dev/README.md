# TEE & SORCERY — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-063/dev/simtest.mjs` | Headless tests of the pure simulation. **purity**: `js/sim` never imports three, touches the DOM, calls `Math.random` or imports the view. **determinism**: the same shots give the same hash, and a clone plays a shot exactly like the original. **content**: every hole's tee is on the tee box, its cup on a near-flat green that holds a ball, pickups float above real ground, monsters spawn on ground, route points are playable, every hole builds in under 2.5 s, five realms of three holes and a boss. **physics**: 30 random shots per hole from random spots with random clubs and mis-hits — never NaN, never sinks into the ground, never rests inside a trunk or rock, always settles; a straight putt drops; water costs a stroke and replays. **rpg**: XP and levels, stat points, the shop growing with progress, buying, equipping, results and personal bests. **story**: every speaker and mood exists, every realm has its scenes. **bosses**: each starts sealed, the seal keeps the ball out, each can be beaten through the real hit path and the seal opens, each takes a turn. **bot**: a search bot with perfect strikes plays all 20 holes at par or better, and a noisy, risk-aware bot (human-like timing errors) finishes every hole inside the stroke limit. `ONLY=purity,determinism,content,physics,rpg,story,bosses,bot`, `HOLES=1-1,5-4`, `SEEDS=2`, `VERBOSE=1`. The bot section takes about six minutes. |
| `node game-063/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). Desktop: title → New Quest → hero creator → prologue (Space, Skip) → map → realm intro → hole fly-over → arrow-key aiming, club change, a real three-press keyboard swing → the ball flies and settles → Mulligan → pause, settings, resume → hole out → results → Continue walks on → the Clubhouse (buy, tabs) → reload → Continue → a boss hole (boss bar, seal, a hit) → quit to map. Touch-only phones at 390×844 and 844×390 with CDP touches: through every screen into a hole, every HUD control ≥ 44 px with no overlaps, a drag aims, three taps on SWING shoot, ❚❚ pauses. Fails on any console error, page error or failed request. `ONLY=desktop\|phones`. Screenshots in `dev/shots/`. |
| `node game-063/dev/botrun.mjs [ids] [--noise N] [--seeds N] [--tier T]` | Plays holes with the search bot and prints strokes against par. The pars were set from this. |
| `node game-063/dev/probe.mjs <hole> <club> [yaws] [--from x,z]` | One club at a grid of powers: where each shot ends and how the bot scores it. |
| `node game-063/dev/bossprobe.mjs <hole> [phase2]` | Counts boss hits from a grid of shots at several distances. A boss nobody can hit shows up as zeros. |
| `node game-063/dev/trace54.mjs [hole]` | The perfect-strike bot on one hole, printing the boss state after every shot. |
| `node game-063/dev/holemap.mjs [ids]` | Renders each hole's surface grid to `dev/shots/maps/<id>.png` with colliders, pickups and monsters marked. |
| `node game-063/dev/shot.mjs "<page>" name [w h]` | Screenshots a page. `dev/view.html?hole=1-2&cam=aim\|over\|boss\|hero\|cup&shot=driver,0.9&pose=swing,-2.3&phase2=1&ball=x,z&t=2&q=1` renders one hole deterministically; `dev/chars.html?set=cast\|monsters\|bosses&expr=happy&pose=address&zoom=0.4` lines up the characters. |
| `node game-063/dev/play.mjs name "js;;SHOT:x;;KEY:Space;;CLICK:sel;;WAIT:ms" [waitMs] [w h] [touch] [query]` | Opens the real game with `?debug=1` and runs snippets (`S` = `window.__ts`). |

The browser scripts need `playwright` and a static server:

```bash
python3 -m http.server 8063          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-063/dev/node_modules
BASE=http://127.0.0.1:8063 node game-063/dev/browsertest.mjs
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader renders at a few frames a second, so the tests open the game with `?fast=6` (six simulation steps per frame step) and the map walk speeds up the same way.

## Debug hooks (`?debug=1`)

`window.__ts`: `app`, `world`, `profile`, `mode`, `go(holeId)`, `win()` (drops the ball in the cup, beating any boss), `give(item, n)`, `gold(n)`, `xp(n)`, `shoot({ club, power, acc, perfect, yaw })`, `skipIntro()`, `portraits`, `hash()`. `?hole=ID` starts straight in a hole; `?fast=N` runs the simulation N× per frame.

## What the bot found

- **Drives rolled 85 yards.** Landing with all the flight speed kept, a driver ran from 113 to 198 yd. Each club now carries backspin that bites on the first landing (driver keeps 42% of its speed, wedge 16%).
- **The cup was far too big.** Chip-ins from 100 yards were routine. The cup shrank from 0.5 to 0.34 yd and the capture speed from 5.6 to 4.6.
- **The noisy bot was risk-blind.** Planning with perfect strikes and executing with errors, it hooked into the woods again and again. The refinement stage now scores each candidate under a hook, a slice, a fat and a thin strike.
- **A float32 Dijkstra skips its own entries.** The geodesic distance field stored `nd` in a `Float32Array`, then compared the float64 popped key against the rounded store and skipped almost every node. `Float64Array` fixed it.
- **The sandworm could not be hit from beyond six yards** while it circled in real time. It now holds still while you aim and slithers on its own turn.
- **Lord Bogey's transformation scored as a loss.** His HP resets to 6 when he becomes Triple Bogey, so the bot saw the killing blow as −2 damage and never took it. Boss progress is now counted across phases.
- **Late-game power made par-5s into par-3s.** POW now adds 1% ball speed per point (it was 2%), and pars were set from the noisy bot.
