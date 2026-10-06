# Rotten to the Core — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-062/dev/simtest.mjs` | Headless tests of the pure simulation. **Purity:** `js/sim` never imports three, touches the DOM or calls `Math.random`. **Generator:** 12 floors × 40 seeds — every walkable tile reachable from the entrance, stairs up next to the start, stairs down (or the boss and its arena) reachable, every object on a reachable tile, solid objects never sealing off floor, packs on standable tiles, Granny's lectern on level 2, the Anvil of Furry on level 6, the Toothpick Thief on level 7, monster counts in range; the town's townsfolk, well and cellar reachable. **Determinism:** same seed → same floor; two bot runs from the same hero are identical. **Items:** 6 000 generated items well-formed, rarities ordered, level-1 stats sane for each class, save → load round trip. **Combat & town:** quests from Cane and Granny, shops, the cellar door, a knight squashing a grape for XP, a Portal Pie round trip, and every skill of every class cast without throwing. **Bot:** each class plays from a new hero to Durian the Diabolical. `ONLY=purity,gen,determinism,items,combat,bot`, `SEEDS=40`, `BOT_SEEDS=1,2,3`, `CLASSES=knight,ranger,mage`, `BOT_MINUTES=240`, `VERBOSE=1`. |
| `node game-062/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). Desktop: title → New Fruit → creator (class, fruit, hat, name) → town → walk by clicking → click Deckard Cane for a quest → buy a jam from Granny → equip by double-click → spend an attribute point → learn and bind a skill → the Wishing Well → the cellar door → click a grape until it pops → right-click and 1 cast → Q drinks → click a loot label → R Portal Pie → home and back → Tab map → Esc menu and settings → die and respawn → The Juicer (boss bar, stairs, quest) → Cane's reward → Durian → victory screen → save & quit → Continue. Then touch-only phones at 390×844 and 844×390 with real CDP touches: title and creator, controls ≥ 40 px and not covering the HUD, no sideways scroll, canvas not clipped, the stick walks, ⚔️ attacks, a skill button casts, tapping a monster attacks it, panels open and close. Fails on any console error, page error or failed request. `ONLY=desktop\|phones`. Screenshots in `dev/shots/`. |
| `node game-062/dev/play.mjs name "js;;SHOT:x;;CLICK:sel;;MCLICK:x,y;;KEY:k;;WAIT:ms" [waitMs] [w h] [touch] [query]` | Opens the real game with `?debug=1`, runs snippets (`S` = `window.__rt`) with a pause between them, takes screenshots along the way and a final one. |

The browser scripts need `playwright` and a static server on port 8062:

```bash
python3 -m http.server 8062          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-062/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader renders at a few frames a second and can spend seconds compiling shaders when a level is first drawn, so the browser test teleports between scenes, uses `?fast=3`, and waits for the view's frame counter (not wall time) before projecting a world point to click it.

## The bot

`js/sim/bot.js` plays through the real `World` and `Game` API: it explores every room, fights with a per-class rotation (squishy classes step back when hurt), loots what it can see, equips upgrades by a simple item score, spends points, talks to every townsfolk, identifies and sells everything in town, buys potions and pies, uses Portal Pies when its bag is full, and takes the stairs. It's a cautious, clumsy player. On Fresh difficulty each class beats Durian in about 33–55 simulated minutes (about 6–10 s of real time), arriving at level ~23–28 with 0–5 deaths. Its first runs found real bugs:

- line of sight was sampled every 0.3 tiles and skipped a wall corner that projectiles then hit — a ranged hero would shoot a corner forever (it's now an exact grid traversal)
- the corner-slide nudge in collision wasn't checked, so actors could end up inside a wall
- a portal back down could drop the hero inside a wall
- shrines never worked: the map's `kind` field overwrote the object's `kind: 'obj'`
- the event queue is capped, so finding "new" events by index silently missed the stairs event
- a full potion belt made a potion on the floor un-pick-up-able, and the bot (and a player) could loop on it

## Debug hooks (`?debug=1`)

`window.__rt`: `app`, `game`, `world`, `view`, `panels`, `screens`, `hud`, `input`, `mode`, `god(on)`, `give(kind, rarity, lvl)`, `level(n)`, `floor(f)`, `killAll()`, `tp(x, y)`, `snap()`, `save()`. `?quick=knight|ranger|mage` skips the menus with a fresh hero; `?seed=N` fixes the hero seed; `?fast=N` runs N× simulation per frame.
