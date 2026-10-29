# Oathstones — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-108/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **oaths**: every oath's line rule; Cascade and Crossroads staying put while their partners clear; Ring; Vigil waking; Fool stones; rubble and ice. **rules**: failed swaps, cascades, binding heroes and ranks, the calling, its rates and pity, called heroes arriving and going back, arrivals that bind and paint, the enemy's turns, shields, skills, waves, rewards, defeats, the party. **boards**: 540 dealt boards with nothing waiting and a move. **determinism**: same seed and commands → same game; a save round trip mid-battle plays on identically. **campaign**: the bot plays the whole campaign on `SEEDS` seeds at skill 1 and 0 with invariants after every command, and prints win %, HP left and turns per stage. `ONLY=purity,oaths,rules,boards,determinism,campaign`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-108/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game → camp and brief, Fight, real mouse clicks select and swap (and a swap that makes no line snaps back for free), the keyboard cursor swaps, a skill key, pause, Save & Quit → Continue resumes the battle, a win and its result, the camp, a ×5 summon reveal closed with a real Space, a hero sheet and Add to Party. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, the board fits between the HUD pieces, a tap reads a token, a swipe swaps, controls ≥ 44 px, the pause screen survives the lift, the camp fits. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-108/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. Setting `__os.view.stage.camera.fov` low after a battle is ready zooms in on the board. |
| `node game-108/dev/shot.mjs heroes\|monsters\|gems` | Screenshots [gallery.html](gallery.html): every hero, every monster or the four gem cuts on neutral grey, plainly lit. Judge models here, not under bloom. |
| `node game-108/dev/preview.mjs` | The 1200×630 preview for the Garden library: a battle with two heroes on the board, at `garden/img/games/game-108.jpg`. |

The browser scripts need `playwright` and a static server on port 8108:

```bash
python3 -m http.server 8108          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-108/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so animation time runs
slower than real time: the tests open the game with `&fast=6` and wait on state (`__os.ready`),
never on the clock. A screenshot taken a second after an arrival can still show its light beam.
Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__os`: `G` (the game), `mode` (title, camp, battle), `busy` (the view is playing or events
are undrained), `ready` (the board takes input), `sel` (the selected cell), `seen` (a count of every
sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (a new game at the camp),
`fight(stage)`, `act(cmd)` (any sim command; its events are played), `autoplay(on)` (the bot plays
the real game through the board), `ff(n)` (the bot plays n commands at once), `cellCenter(i)`
(client px of a cell), `moves()`, `save()`, `hasSave()`, `demo()` (the attract board's game).
`&fast=N` plays animations N× faster; it does nothing without `debug=1`.
