# Wyrmbond — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-098/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random`, timers or the clock. **data**: every chapter map parses and is rectangular, every unit starts alone on a tile it can stand on, every enemy can be reached, every objective has what it needs (a boss, a stronghold, a goal Kestrel can walk to, a dragon to free, a keep for the Chain to muster at), every speaker, skill, trait and egg the tables name exists; 200 Wild Hunt maps are valid. **rules**: movement and blocking, the damage formula (element wheel, classes, cover, wounded attackers, fliers get no cover), siege can't move and fire or counter, flurries, First Strike, Thorns, Sturdy, claiming and income and healing, losing your stronghold, calling from a roost, unchaining (and that its chance is what the forecast says over 400 tries), each skill kind, stuns, the Wyrmsong, the lose conditions, the protected story dragon, AI-vs-AI legality. **roost**: starters, incubation in real time, tapping, hatching, the stable cap, feeding, training rings, trained-stat limits, the hoard, the market and its upgrade limits, breeding locks and cooldowns, hybrid rates, gene and trait inheritance over 3,000 eggs, level and stage tables. **determinism**: same seed → same game; a save round trip mid-battle and at the roost plays on identically. **campaign**: the bot plays the whole story on `SEEDS` seeds (Wild Hunts when behind) with per-action invariants, and every seed must reach the ending; prints the balance table. `ONLY=purity,data,rules,roost,determinism,campaign`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-098/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link → New Game → the prologue advanced with real Space and Enter → Skip → a starter picked → chapter 1 and its scene → a real click selects a dragon, a click on a blue tile opens the action menu (the unit is previewed there but nothing is sent), Escape backs out, Wait spends it, Tab and Escape, End Turn and the Chain's turn, pause and resume, the bot finishes → results → closing scene → the roost's Hatchery: place an egg, tap it warmer, wait, hatch; the Stable and a dragon's sheet, feeding; the Market; Save & Quit → Continue. The board fits between the HUD bars. **phones** (touch only, real CDP touches) at 390×844 and 844×390: the Journey → party picker → Fly!, a scene advanced by tapping, a touch selects and a touch moves, Wait, a drag pans the zoomed map without acting, pause stays open after the finger lifts, End Turn; every control ≥ 44 px and on screen; no sideways scroll; the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-098/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=6'` adds URL parameters. |
| `node game-098/dev/preview.mjs` | The 1200×630 share and Garden Library picture. The repo's `dev/screenshots.mjs` only reaches the title screen here, so this sets up a close-up fight through the debug hooks (an adult Pyrewyrm breathing on a collared Thornback, slowed to quarter speed) and writes a frame every 0.4 s to `dev/shots/preview-<n>.jpg`. Copy the best (frame 5) to `garden/img/games/game-098.jpg`; `ONLY=game-098 node dev/add-meta.mjs` writes the link-preview tags. |
| `node game-098/dev/shot.mjs "dev/models.html?set=dragons" name` | Screenshots the model gallery (`set=dragons`, `people` or `eggs`; `&chained=1` collars them) on a neutral background. |

The browser scripts need `playwright` and a static server on port 8098:

```bash
python3 -m http.server 8098          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-098/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

By default the browser scripts answer Google Fonts with an empty stylesheet, so they work offline and text uses the system fallback. That hides layout bugs: the title's Cinzel Decorative is far wider than its fallback, and it overflowed its sheet in a real browser while every test passed. `FONTS=1` (for `browsertest.mjs` and `play.mjs`) loads the real fonts; run it before calling a layout change done.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=6` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__wb`: `G` (the game), `mode` (`title | starter | hub | battle`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `play` (the battle controller), `roostUi`;
`start(seed, sp)` (a new game with that starter, straight to the roost), `battle(ch, unlock)` (start chapter `ch`, unlocking those before it, skipping its scene), `newStory(seed)` (the prologue and starter choice), `autoplay(on)` (the bot plays the player's side through the real loop), `ff()` (the bot finishes the battle at once; the view skips its animations), `tend()` (the bot tends the roost), `idle(sec)` (that much real time passes), `skipTalk()`, `goHub(tab)`, `save()`, `hasSave()`, `screenOf(x, y)`.
`&fast=N` plays animations and paces the enemy N× faster; it does nothing without `debug=1`.
