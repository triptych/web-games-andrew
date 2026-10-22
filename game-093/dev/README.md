# Dawnshard Saga — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-093/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock and never import the view/UI/audio/input. **rules**: shields, weaknesses, Break (damage ×1.5, a lost turn, recovery), Boost and BP, items, defend, fleeing, XP and the level cap, shops, boss charges cancelled by Break, data tables complete (items, enemies, skills, every story beat). **determinism**: same seed and inputs → same game; a save round trip plays on identically; unknown save versions rejected. **world**: every place on the overmap can be walked to (gates closed, then open), every town door/villager/exit and every dungeon chest/crystal/boss is reachable on 3 seeds. **quests**: every board job and every villager storyline in every town is well formed and completable. **bot**: the auto-player plays a whole game to the ending (invariants checked as it goes) and prints the balance table. `ONLY=purity,rules,determinism,world,quests,bot`, `SEEDS=n` (bot games), `BOT_HOURS=n` (cap), `VERBOSE=1`. Everything but `bot` takes seconds; `bot` is about four minutes a seed. |
| `node game-093/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title, back link, New Game, the opening scene, real keys walk, Esc menu stops the sim, menu panes, a forced battle played with real keys (Boost, Attack, targets, Skills), Victory → Continue, save → reload → Continue restores the game. **phones** (touch only, CDP touches) at 390×844 and 844×390: title taps, the deck, the stick walks, A advances dialogue, ☰ opens the menu, a battle played by taps; controls finger-sized and on screen, battle windows don't overlap. **nostorage**: boots, starts and plays with `localStorage` throwing. Fails on any console/page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots land in `dev/shots/`. |
| `node game-093/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=8'` adds URL params. e.g. force a battle: `const B = await import('/game-093/js/sim/battle.js'); __ds.start(7); B.startBattle(__ds.G, {enemies:[{kind:'wolf',lvl:5}], bg:'forest'})`. |
| `dev/gallery.html`, `dev/gallery2.html` | Contact sheets of every generated sprite, tile and prop: open them through the static server. |
| `node game-093/dev/shot.mjs` | Screenshot helper for the galleries. |

The browser scripts need `playwright` and a static server on port 8093:

```bash
python3 -m http.server 8093          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-093/dev/node_modules
```

three.js comes from unpkg through an import map. If the CDN is blocked, put a copy of `three@0.165.0` in `dev/package` and the harnesses serve it (`THREE_PKG=/path`). Google Fonts is answered with an empty stylesheet; the game falls back to system serif/sans. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=8` and wait on state, never on the clock. Passing tests don't mean the screen looks right: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ds`: `G` (the game), `mode` (`title`/`play`), `counts` (every sim event type drained so far), `view`, `ui`, `audio`, `input`, `settings`, `start(seed)` (skip the title), `load(G)`, `autoplay(on)` (the bot plays the real game through the real UI/view), `ff(seconds)` (run the sim ahead), `save()`, `serialize()`, `step`, `act`, `newGame`, `enterMap`. `&fast=N` runs N× the simulation per frame; `&seed=N` seeds the first world; `&q=low` forces the cheap renderer. None of the hooks exist without `debug=1`.
