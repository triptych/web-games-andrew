# Dragonroll — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-089/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock (comments and strings are stripped before the grep). **board**: forty spaces, the corners, every region's deeds, town and dungeon; every skill, drop, recipe and starting weapon exists. **rules**: dice, the loaded die and boots, doubles, laps and salaries; buying, tolls (and a region set doubling them), upgrading and selling deeds; shops, hiring, equipping, the inn, the forge and swapping companions; battles (Attack, MP costs, every skill and burst of three parties, items, smoke bombs, no running from bosses, losing); dungeons, shards, restocking and Dragonbane; roaming monsters; every Fate card drawn and resolved; the dragon (forced, early, a first and a second defeat, a win with both phases). **determinism**: same seed and choices → same game; save round trips on the board and mid-battle play on identically; an unknown save version is rejected. **fuzz**: random legal and illegal actions for thousands of steps with invariants after each. **bot**: bots at skill 1 and 0.5 play whole games for all three heroes and print the balance table. `ONLY=purity,board,rules,determinism,fuzz,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-089/dev/balance.mjs` | Just the bot table, quicker to iterate on: `SEEDS=n SKILL=1,0.5 CLS=knight LEN=short`. |
| `node game-089/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the title and back link, New Game with a class and a typed name, Space rolls, several turns answered by clicking the cards, a town by landing (buy, every tab, hire, leave), a battle by the menu and a target marker, the skill list by keyboard, Auto to the reward card, back to the island, a tile's card by clicking it, the map, Escape pauses and a real Space presses Resume, Save & Quit → Continue, the dragon won by Auto, the ending and its rank, Play again. **phones** (touch only, real touches) at 390×844 and 844×390: menus by tap, controls ≥ 44 px and on screen, a roll by tap, the decision card on screen, a battle by tapping the menu and a target, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-089/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=4'` adds URL parameters. |
| `node game-089/dev/shot.mjs "page?query" name [waitMs]` | Screenshots a dev page: `gallery.html?only=chars|monsters|bosses|dragon|props|buildings|places` (every model on a neutral grey; `&pose=attack`, `&rot=0.9`, `&mode=sleep|fly|roar`, `&gap=n`) or `board.html` (the island alone: `?view=over`, `?pos=14`, `?cam=x,y,z,dist,pitch`). `VIEW=1600x900` resizes. |

The browser scripts need `playwright` and a static server on port 8089:

```bash
python3 -m http.server 8089          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-089/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state (`__dr.busy`, `__dr.phase`), never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__dr`: `G` (the game), `mode` (title, game, over), `phase`, `busy` (events still playing), `seen` (a count of every event played), `view`, `ui`, `audio`, `input`; `start(seed, opts)` (skips the title; `opts` = `{ cls, length, name }`), `act(action)` (the same path as a click), `autoplay(on, skill)` (a bot plays the real game through the UI's own path), `ff(steps, skill)` (the bot plays ahead in the sim with no animation, then the view catches up), `fight(ids, level, kind, region)` (a battle at once), `dragon(level)` (the final battle with a ready party), `recruit(...ids)`, `level(n)`, `give(gold)`, `save()`, `hasSave()`. `&fast=N` plays animations N× faster; it does nothing without `debug=1`.
