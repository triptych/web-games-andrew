# Verdant Protocol — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-090/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock (comments and strings are stripped before the grep). **data**: every skill, daemon, item, zone, scene, recipe and shop line refers to things that exist; the splice table is symmetric and reaches every race; every daemon can be met or made. **floors**: every floor of every zone (and ten Rift runs) is connected — Sprout, stairs, chests, Hexes, boss and exit can all be walked to — and the same seed is the same floor. **battle**: Press Turn costs (normal, weak, null, repel, drain), knock-down, All-Out, guard, Charge, buffs, every ailment, healing, items, running, swapping, rewards, level-ups and skill choices. **recode**: every personality's best script, the worst, boredom, demands, gifts, guardians, a full Greenhouse, clearance. **explore**: walls, the Sprout, stairs, chests, ambushes both ways, the guardian. **hub**: shop, gear, chips, Seeds, party, splice (preview equals result), Bonds and perks. **story**: every scene plays to its end, the three endings, Graft locked until earned. **determinism**: same seed and choices → same game; save round trips taken at four moments play on identically; an unknown save version is rejected. **fuzz**: thousands of random legal and illegal actions with invariants. **bot**: whole games at skill 1 and 0.6, with a balance table. `ONLY=purity,data,floors,battle,recode,explore,hub,story,determinism,fuzz,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-090/dev/balance.mjs` | Boss win rates for a ready party at three levels each (`SKILL=1 N=48`), plus `TRACE=meridian` to print a fight round by round. |
| `node game-090/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game with a typed callsign, the prologue by real Space presses and Skip, the station, Briefing and a deploy, real keys walk the Agent, the menu by Tab, a battle by keyboard (commands, target, skill list, Recode terminal, Auto to the reward card), pause and a real Space on Resume, Save & Quit → Continue. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the prologue and menus, station buttons ≥ 44 px, a deploy, the touch deck, the stick moves the Agent, battle buttons and a target by touch, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-090/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=4&q=2'` adds URL parameters. |
| `node game-090/dev/shot.mjs "page?query" name [waitMs]` | Screenshots a dev page: `gallery.html?only=daemons|people|props|env` (every model on a neutral grey, `&rig=quad`, `&sp=cinderwolf`, `&rot=0.9`). `VIEW=1600x900` resizes. |

The browser scripts need `playwright` and a static server on port 8090:

```bash
python3 -m http.server 8090          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-090/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second, so the tests open the game with `&fast=6&q=0` (animations six times faster, no bloom or shadows) and wait on state (`__vp.busy`, `__vp.phase`), never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__vp`: `G` (the game), `mode` (title, game), `phase`, `busy` (events still playing), `seen` (a count of every event played), `view`, `ui`, `audio`, `input`; `start(seed, {name, look, skip})` (skips the title and the prologue), `skipScenes()`, `act(action)` (the same path as a click), `autoplay(on, skill)` (the bot plays the real game through the UI), `ff(ticks, skill)` (the bot plays ahead in the sim, then the view catches up), `deploy(zone)`, `teleport(x, y)`, `fight(ids, lv, kind, zone)` (a battle at once), `recruit(...ids)`, `level(n)`, `give(scrap)`, `chapter(n)`, `save()`, `hasSave()`. `&fast=N` plays animations N× faster, `&q=0|1|2` forces graphics quality; neither does anything without `debug=1`.
