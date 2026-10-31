# Quill & Legion — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-112/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every creature, foe, card, relic, encounter and act is well formed and points at things that exist. **hex**: neighbours, distance, directions, reach (walkers go round, flyers over), paths, distance fields. **battle**: deployment and swapping, the free move, attack against defence, Weak, Vulnerable, flanking, strike back once a round, walkers marching into reach, archers shooting anywhere (at half beside a foe, never struck back), Ward and when it drops, spells and Lore, Meteor's area, earthworks never walling the field, signature cards and orphaned ones, the foe's march and attack, statuses ticking, Rooted, Slumber, Challenge, winning, losing, a boss's escort fleeing, and every one of the 52 cards played on 30 random boards. **run**: 40 maps connected and typed, no skipping ahead, spoils and recovery, the card choice, dwellings (new stack, reinforcing, stock, gold, a full legion, dismissing), the scriptorium (buy, relic, erase), the campfire, every option of all 12 encounters, boons, boss relics and the next book. **saves**: determinism, a save round trip mid-battle plays on identically, version rejection. **bot**: whole campaigns on `SEEDS` seeds at two skill levels with invariants after every command, and the balance table. `ONLY=purity,data,hex,battle,run,saves,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-112/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, Space on New Campaign, a real click on a map node, deployment by mouse, Begin, a click selecting a stack and another moving it, a card by number key, the forecast on the first click and the order on the second, E ends the turn and the foe moves, Escape pauses and the foe stands still, Save & Quit → Continue restores the battle, winning opens the spoils, taking a card, Space on Onward, the map moves on. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through title, map and Begin; End Turn, pause and the piles ≥ 44 px and on screen; cards on screen; no sideways scroll; the canvas matches the visible viewport; taps land on the hex under the finger; select and move by touch; a card and a two-tap attack; the pause screen stays open after the finger lifts. **nostorage**: boots and fights with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-112/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-112/dev/shot.mjs [name] [p\|e] [only] [w h]` | Screenshots `dev/models.html`: every miniature of the legion (`p`) or the foe (`e`) on plain paper with its name, to `dev/shots/<name>.png`. `only=a,b` picks models. Judge a silhouette here before it goes on the field. |
| `node game-112/dev/preview.mjs` | The Garden's 1200×630 preview: a mid-battle moment set up through the debug hooks, written to `garden/img/games/game-112.jpg`. |

The browser scripts need `playwright` and a static server on port 8112:

```bash
python3 -m http.server 8112          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-112/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ql`: `G` (the campaign), `mode` (`title` or `run`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `play` (the battle controller), `start(seed)` (a new campaign, on the map), `battle(seed)` (a new campaign, straight into its first skirmish), `autoplay(on)` (the bot plays the real game through the real screens), `ff()` (the bot finishes the current battle at once and the view skips its animations), `send(cmd)` (any command, as the UI sends it), `save()`, `hasSave()`, `idle()` (the view has caught up), `screenOf(c, r)` (where a hex is in client px), `stack(id)`. `&fast=N` plays animations and the foe N× faster; it does nothing without `debug=1`.

Waiting for the view: after a command the sim changes at once but the view only hears about it on the next frame, so wait for `__ql.G.events.length === 0 && __ql.idle()` (the harness's `idle()`), not just the sim's state.
