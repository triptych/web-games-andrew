# SPINFRAME — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-048/dev/simtest.mjs` | Checks `js/sim/` is pure (no DOM, no `Math.random`, no clock), the payline evaluator against hand-built grids (wilds, glitches blocking, mirror lines), 300 generated sector maps (every node reachable, no dead ends, one boss), every story scene's speakers, then has the bot play whole campaigns. Every combat step checks: no NaN in state or events, HP/shield/energy in bounds, grid shape, strips never change length, fights end within 80 turns. Then the Sim Ladder, the 8-hour refinery cap, a save round-trip and determinism (same seed → same fight). Prints a per-chapter balance table. `RUNS=12` for more campaigns. |
| `node game-048/dev/browsertest.mjs` | Real Chromium: title → New Cadet → callsign → prologue → every hub tab → chapter 0 intro → map → a battle driven by clicks (SPIN, tap a reel, nudge, ENGAGE, click an enemy to target) then AUTO → rewards → a Signal event, depot, repair bay, salvage, elite, boss scene, boss, outro → Reel Array upgrade, a skill, modules, refinery build and collect, a contract claim → Sim Ladder → a defeat → pause and settings → reload and Continue. Then a boss fight in all seven chapters, and touch-only play (CDP touch events) on 390×844 and 844×390 with layout assertions (controls on screen, tap targets, reels above SPIN, reel menu on screen). Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. `ONLY=desktop|chapters|phones`. Needs `playwright` resolvable from `game-048/` (e.g. `ln -s "$(npm root -g)/playwright" game-048/node_modules/playwright`) and a static server (`python3 -m http.server 8048` from the repo root). |

The balance table (`ch tries clears | battle loss hp% turns | elite … | boss … | lvl blade hull cols`) is what
`hpScale`/`dmgScale` in `js/sim/enemies.js`, the boss numbers and the upgrade costs in `js/sim/mech.js` were tuned
against. Targets that felt right: ~8–15% hull per skirmish, ~15–25% per elite, ~30–45% per boss, and fewer than two
attempts per chapter for a bot that spends sensibly.

## Debug hooks

Load the game with `?debug=1` to get `window.__sf` (and no automatic quality downgrade; `&quality=0|1|2` pins one):

| Hook | Effect |
|---|---|
| `__sf.p` / `__sf.screen` / `__sf.battle` | The live profile / which screen is up / the battle director (`battle.st` is the combat state) |
| `__sf.newGame(callsign, seed, skipStory)` | Start a profile, optionally skipping the prologue |
| `__sf.give(scrap, cores)` / `__sf.best(n)` / `__sf.mech({...})` | Add currency / set chapters cleared / set frame system levels |
| `__sf.mod(id, rarity, level)` | Add and equip a module |
| `__sf.deploy(chapter, threat)` | Start a sector (skips its intro and boss scenes) |
| `__sf.goto(type)` | Enter an unvisited node of that type on the current map (`battle`, `elite`, `event`, `salvage`, `depot`, `rest`, `boss`) |
| `__sf.win()` / `__sf.lose()` | End the current fight through the normal end path |
| `__sf.idle()` / `__sf.act(a)` | Is the battle waiting for input? / send an action (`{kind:'spin'}`, `'engage'`, `{kind:'nudge', reel, dir}`, …) |
| `__sf.reelPx(c)` / `__sf.enemyPx(id)` | Screen position of a reel / an enemy, for clicks and taps |
