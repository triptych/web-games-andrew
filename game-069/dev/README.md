# DIRT CROWN — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-069/dev/simtest.mjs` | Headless tests of the pure simulation. **purity**: `js/sim` never imports three, touches the DOM, calls `Math.random` or imports the view. **tracks**: every track, both directions: no bend tighter than the barrier can follow, separate parts of the loop never close (bridges excepted, and each figure eight really crosses on a bridge), climbable slopes, coins on the road, the grid behind the line. **physics**: six bots race every track at ratings 100, 550 and 1000: no NaN, nobody under the ground or past the barrier, everyone finishes, few resets, sensible lap times, jumps give air. **determinism**: the same race twice gives the same times. **rules**: elimination knocks out five, time trial medals, purses and the first-win bonus, unlocks, champions, upgrades, every event's field, every story speaker and trigger. **career**: a bot plays the whole game the way a player would (races each event in its own car, buys the cheapest upgrade it can afford, retries what it loses) and must win the Dirt Crown in under 90 races with no event needing more than 12 tries. `ONLY=purity,tracks,physics,determinism,rules,career`, `SKILL=0.82` (the career bot's skill), `VERBOSE=1`. |
| `node game-069/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). Desktop: title (back link, attract-mode race) → New Career → name → prologue (portrait, Enter, Skip) → hub (coins, rating, map, locks) → buy an engine, refuse one you can't afford → buy a paint job → event card → Colt's scene → countdown with W held → keyboard driving and steering → finish → results and purse → the next race unlocked → time trial targets, pause freezes the clock, resume, quit → reload and Continue keeps everything → settings → the final against Colt → CHAMPION → the ending → credits. Touch-only phones at 390×844 and 844×390 with real taps and CDP touches: every screen fits without sideways scroll, the canvas matches the viewport, buttons are finger-sized, taps advance the story and buy parts, auto-accelerate drives, holding ▶ steers, ❚❚ pauses. Fails on any console error, page error or failed request. `ONLY=desktop\|phones`. Screenshots in `dev/shots/`. |
| `node game-069/dev/probe.mjs <event> [rating] [skill] [seeds]` | Races a bot through one event several times and prints the running order every 10 s and the finishing times. Used to tune the champions. |
| `node game-069/dev/racecheck.mjs [tracks\|all] [rating]` | All-bot race on each track: best lap, finishing times, resets, wall hits, airs. |
| `node game-069/dev/geocheck.mjs [tracks]` | Each track's length, tightest bend and closest approach between distant parts of the loop. |
| `node game-069/dev/shot.mjs name "js;;WAIT:ms;;SHOT:x;;KEY:Down:KeyW;;CLICK:#sel;;UNTIL:expr" [w h] [touch] [query]` | Opens the real game with `?debug=1`, runs snippets (`S` = `window.__dc`) and takes screenshots. |

The browser scripts need `playwright` and a static server:

```bash
python3 -m http.server 8069          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-069/dev/node_modules
node game-069/dev/browsertest.mjs
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader renders a few frames a second, so the tests open the game with `?fast=8` (eight simulation steps per real one) and quality 2.

## Debug hooks (`?debug=1`)

`window.__dc`: `app`, `race`, `coins(n)`, `levels({ engine, … })`, `go(eventId)`, `win(pos)` (finishes the current race in that place), `skipStory()`, `autopilot(skill)` (the AI drives your car), `hideUI()`, `cam`. `?event=ID` starts straight in an event; `?fast=N` runs the simulation N× per frame; `?q=0|1|2` forces a quality tier.

## What the bots found

- **Good suspension swallowed every jump.** Takeoff needed the ground to fall away by more than a threshold that grew with suspension, so a maxed car never left the ground. Suspension now sets how far the tyres keep biting through small hops (travel) and how much a landing costs, not whether you fly.
- **The terrain sank under banked bends and tabletops.** The ground under the road took the lowest road height of every sample nearby, including ones on the same stretch, so a tabletop's ramps pulled the ground under its top down and the road floated. The lowest-road rule now only applies between different stretches (the bridge of a figure eight).
- **Races were processions.** With equal cars nobody passed: grid order was finishing order, and champions starting at the back finished last. Grids are now seeded slowest-first, drivers commit to a passing side when blocked, there is a slipstream, and champions start third with traffic of their own.
- **Fast cars flew off the ice.** The AI planned corner speeds with the track's base surface, so a quick car arrived at an ice patch far too fast. It now plans with the grip under its racing line.
- **"Rating" flattered an even build.** Opponents spent their odd levels on engine, drivetrain and tyres first, the most efficient build, so a local could match a player rated 80 points higher. Each local now spends them somewhere different.
