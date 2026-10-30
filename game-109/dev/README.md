# STARBLAZER '86 — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-109/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **rules**: movement and walls, every weapon level, hits, piercing, scoring and the chain, dying, shields, game over, bombs, every power-up, extra lives, the wave cycle, mines, carried capsules, formations that dive and return. **waves**: 60 waves over five seeds (valid orders, nothing pops in on screen, pieces unlock on schedule, bosses and bonus stages where they belong), nothing shoots on wave 1 or in a bonus stage, a perfect bonus stage pays out, and a bot that cannot be hurt clears waves 1-40 in a sane time. **bosses**: each of the three enters untouchable, fights, can be killed, blows up in a chain and hands over to the next wave. **determinism**: same seed and inputs, same game; a save round trip mid-game, mid-formation, mid-boss and mid-beam plays on identically. **bots**: whole games at skills 1, 0.6 and 0.3 with per-step invariants and the balance table. `ONLY=purity,rules,waves,bosses,determinism,bots`, `SEEDS=n`, `VERBOSE=1`. About 12 s. |
| `node game-109/dev/browsertest.mjs` | Real Chromium. **desktop**: title with a demo playing behind it, the canvas filling the window and really drawing, High Scores, How to Play and Settings, Start Game, real keys move, hold fire and bomb, Escape pauses and the sim stops, Space on the focused Resume button resumes, Save & Quit → Continue, the last ship goes, initials entry, the table and a reload, a boss fight. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck, auto-fire with the FIRE button hidden, the stick, BOMB, pause, auto-fire off and FIRE held and released, controls ≥ 44 px, no sideways scroll, the canvas matching the viewport, the field clear of the back link. **nostorage**: boots, plays, ends and takes initials with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. About 50 s. |
| `node game-109/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-109/dev/preview.mjs [boss wave] [seed]` | The 1200×630 Garden / share picture: a poster with the playfield caught mid boss explosion. Writes `dev/shots/preview.jpg`; copy it to `garden/img/games/game-109.jpg`. |
| `game-109/dev/sprites.html` | Every sprite (player, four sector skins of every enemy, bosses, bullets, capsules, medals) and the entry curves, on a neutral background. Open it through the static server. |

The browser scripts need `playwright` and a static server on port 8109:

```bash
python3 -m http.server 8109          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-109/dev/node_modules
```

Canvas 2D needs no WebGL, so there is no SwiftShader and no offline three.js package. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. The tests open the game with `&fast=4` (four times the simulation per frame) and wait on state, never on the clock. Passing tests don't mean the screen shows anything good: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__sb`: `G` (the game), `mode` (`title` | `play` | `over`), `seen` (a count of every sim event drained in play), `view`, `ui`, `audio`, `input`, `settings`, `start(seed)` (skips the title), `autoplay(on, skill)` (the bot plays the real game), `ff(seconds, skill)` (run the sim ahead with the bot), `wave(n)` (cut to wave n), `die(last)` (put a bullet on the ship; with `last`, on its last life), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
