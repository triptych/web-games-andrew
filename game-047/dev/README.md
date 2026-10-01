# Ashes & Aces — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-047/dev/simtest.mjs` | Checks `js/sim/` is pure (no three.js, no DOM, no `Math.random`), the poker evaluator against known hands (wilds, Ash, ace-low straights), 200 generated maps (every node reachable, no dead ends, fixed floors in place), then has the bot play whole 100-level runs. Every combat step checks: every card uid in exactly one zone, no arcana on the table, no NaN, HP within bounds, combats end within 80 turns. Also determinism (same seed → same run) and save round-trips. `RUNS=30` for more runs. |
| `BALANCE=1 RUNS=24 node game-047/dev/simtest.mjs` | Adds a per-world table of loss rate, turns and HP lost for battles, elites and Wardens. This table is what `hpScale`/`dmgScale` in `js/sim/worlds.js` and the Warden numbers in `js/sim/monsters.js` were tuned against. |
| `node game-047/dev/browsertest.mjs` | Real Chromium + WebGL: title → hero select → prologue → chapter → map → battle (mouse drag-and-drop, tap-to-place, End Turn button, a line firing) → menus (Esc, H, D) → reward → event, shop, campfire, treasure, elite → Warden intro, fight, crown, epilogue, chapter II → death and rekindle → reload and Continue → the Hollow King → an ending → title. Then a battle in each of the ten realms, and touch-only play (CDP touch events) on 390×844 and 844×390. Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. `ONLY=desktop|worlds|phones`. Needs `playwright` and a static server (`python3 -m http.server 8047` from the repo root). |

No network to unpkg.com? Fetch three.js once and point the tests at it — CDN
requests are then served from disk, still the genuine r165:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
THREE_PKG=$PWD/package node game-047/dev/browsertest.mjs
```

Software WebGL (SwiftShader) renders at a few frames per second and the frame
loop caps `dt` at 50 ms, so animations run slowly in the sandbox; the browser
test waits on game state, never on wall-clock time.

## Visual review pages

Open these through the static server:

| Page | Shows |
|---|---|
| `dev/cards.html` | A sheet of painted card faces (pips, J/Q/K portraits, aces, Joker, Ash, Arcana, the back, a normal map) |
| `dev/creatures.html?w=N` | Every monster body plan, coloured from realm N's palette |
| `dev/wardens.html` | The ten Wardens and the three heroes |

`node game-047/dev/shot.mjs <page> <out.png> [w] [h]` screenshots any of them;
`node game-047/dev/probe.mjs <out.png> <w> <h> "<js>" "<wait expr>"` runs a
snippet in the game (debug mode) and screenshots the result.

## Debug hooks

Load the game with `?debug=1` to get `window.__aa` (and no automatic quality downgrade):

| Hook | Effect |
|---|---|
| `__aa.run` / `__aa.screen` | The live run (saved JSON) / which screen is showing |
| `__aa.newRun(cls, seed)` | Start a run, skipping the prologue |
| `__aa.jump(world, floor)` | Move to realm `world` (0–9), with `floor` levels already cleared |
| `__aa.goto(type)` | Enter a node of that type on this realm's map (`battle`, `elite`, `event`, `shop`, `rest`, `treasure`, `boss`) |
| `__aa.win()` | Kill every enemy in the current battle |
| `__aa.battle` | `place(handIndex, cell)`, `endTurn()`, `idle()`, `handPx(i)`, `cellPx(c)`, `hurtPlayer(hp)` |
| `__aa.quality(q)` / `__aa.world(w)` | Force a quality tier (0–2) / show a realm |
