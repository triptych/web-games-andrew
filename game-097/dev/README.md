# Hollow Gambit — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-097/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every unit, ability and chapter is well formed; every start square is walkable and used once; no two summonable pieces move alike. **moves**: pawn, rook, bishop, knight, king, queen, phasing bishop, nightrider, cannon, grasshopper and the leapers, on small boards with walls, chasms and blockers; every piece has somewhere to go; nothing lands on a wall, a chasm, a friend or off the board. **combat**: the element table, damage, hit, crit, follow-up strikes, terrain, true hit, fights end. **abilities**: all 13, who they can target and what they do, plus random uses on random boards. **flow**: commands and their refusals, phases, the enemy turn, captures, win and lose, rewards, recruits, Bond, XP and levels. **gacha**: rates over 30,000 summons, both pities, costs, newcomer levels. **saves**: determinism, a save round trip mid-battle and mid enemy phase, version rejection. **bot**: the bot plays the whole campaign on `SEEDS` seeds with per-action invariants and prints the balance table. `ONLY=purity,data,moves,combat,abilities,flow,gacha,saves,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-097/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title, Space on the focused button, summon ×10, the roster and party, the campaign (chapter 2 locked), March, a real mouse click selects and moves a piece, Tab / arrows / Esc / T, the duel forecast then Strike, the cut-in arena with both fighters in frame, pause freezes the sim, Save & Quit → Continue restores the battle, winning shows the result and unlocks the next chapter. **phones** (touch only, real touches) at 390×844 and 844×390: every menu by touch, every control ≥ 44 px and on screen, no sideways scroll, the board inside the area the HUD leaves, a tap on each of the 64 squares picks that square, select and move by touch, the duel by touch and its framing, the pause screen stays open after the finger lifts. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-097/dev/shot.mjs [name] [p\|e] [only] [w h]` | Screenshots `dev/models.html`: every piece on a flat grey floor under plain light, with its label, to `dev/shots/<name>.png`. Judge a silhouette here before it goes under the candles. `?team=e` shows the dead's ring, `?only=a,b` picks pieces. |
| `node game-097/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8097:

```bash
python3 -m http.server 8097          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-097/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__hg`: `G` (the game), `mode` (`title`, `hub`, `battle`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `play` (the battle controller), `start(seed)` (a new game, straight to the sanctum), `battle(ch, unlock = true)` (start a chapter, clearing the ones before it), `autoplay(on)` (the bot plays your pieces in the real game), `ff()` (the bot finishes the battle at once and the view skips its animations), `save()`, `hasSave()`, `screenOf(x, y)` (where a board square is in client px, for clicking the canvas). `&fast=N` plays animations and the enemy N× faster; it does nothing without `debug=1`.

Waiting for the view: after a command the sim changes at once but the view only hears about it on the next frame, so wait for `__hg.G.events.length === 0 && !__hg.view.busy` (the harness's `idle()`), not just `!view.busy`.
