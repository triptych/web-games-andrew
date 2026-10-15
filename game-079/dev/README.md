# VENDETTA OVERDRIVE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-079/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **levels**: all five levels on `LEVEL_SEEDS` (25) seeds × 3 difficulties are valid (keys and exit reachable by walking, loot by jetpack), have three tapes, one door per key, nothing in the start room, no step over 0.5 m, the boss arena and legendary where they belong, and regenerate identically. **weapons**: 600 rolled guns have sane stats, valid parts and names; rarity rises with level; the legendaries and the bottomless starter. **rules**: movement, walls, steps, crates, jumps, the jetpack, hitscan, splash and rocket jumps, barrels, the four elements, the kick and shattering, doors and keys, pickups, guns and swaps, Dad's pistol, Overdrive, death and CONTINUE, the ambush, all three bosses and Rourke's phases. **guidance**: a walker that does nothing but follow the HUD arrow (and hop when it bumps into something) reaches the keycard on every level, `GUIDE_SEEDS` (6) seeds each. **determinism**: same seed and inputs → same game; a save round trip mid-fight plays on identically. **bot**: the bot plays the whole campaign on `SEEDS` (3) seeds at skill 1 and 0.6 with per-step invariants and prints the balance table. `ONLY=purity,levels,weapons,rules,guidance,determinism,bot`, `SEEDS=n`, `LEVEL_SEEDS=n`, `VERBOSE=1`. Everything but the bot takes a few seconds; the bot about 15 s per campaign. |
| `node game-079/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the title with the bot playing behind it and the back link, New Game → difficulty → briefing → play, real keys move, turn, jump, fire and kick, the minimap shows and M toggles the big map, Escape pauses and the sim stops, Space presses the focused Resume, a level cleared by the bot (run ahead synchronously) → the tally → Next Level, death → CONTINUE? → Continue with the guns you entered with, Save & Quit → Continue. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the deck, the stick moves, the look pad turns, FIRE, JUMP, KICK, ❚❚ and Resume, controls ≥ 44 px, on screen and not overlapping, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-079/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `Q='&fast=8'` adds URL parameters; `PAGE=dev/models.html Q='&row=guns'` opens the gallery instead. |
| `dev/models.html?row=enemies\|bosses\|guns` | Every enemy, boss and a spread of guns on a neutral background under plain light, no bloom; drag to orbit. Judge anatomy and proportions here, not in the game. |

The browser scripts need `playwright` and a static server on port 8079:

```bash
python3 -m http.server 8079          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-079/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws this game at about one frame a second, and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock; anything that needs a lot of game time is run ahead with `__vo.ff()`. Flashes decay per frame, so a screenshot under SwiftShader shows them far brighter than a real GPU would. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__vo`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, diff, level)` (skips the menus and starts playing), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead synchronously with the bot), `god(on)`, `fury()` (fill the bar), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame and `&seed=N` fixes the campaign seed; both need `debug=1`.
