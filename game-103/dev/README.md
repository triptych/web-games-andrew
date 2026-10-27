# Crown & Crumpet — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-103/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **data**: every map is a rectangle of known terrain; every start, foe and guest is on its own walkable square and connected to the rest; every skill, class, speaker and snack is well formed; recruits arrive in order. **rules**: movement cost, jumps, forests, gaps and fliers; targeting and range; height, cover, guard, cheer and teamwork in damage; AoE that never hurts friends; command refusals, auto end of turn, undo; statuses, healing, regen, sleep, turn order; Pip's fumble rate over 4,000 swings and how it falls by level 6; rescues, winning with nobody rescued, the Dread Lord's two scenes and surrender, losing, retry and the turn-limit guard; snacks and party rules. **saves**: determinism, a save round trip at five points of a battle and at the chapter break, version rejection. **bot**: the bot (the enemy's own brain) plays the whole story on `SEEDS` seeds with per-command invariants (no two units on a square, nobody on a wall, hp and mp in range) and prints the balance table, plus a sloppy bot that skips 40% of its turns. `ONLY=purity,data,rules,saves,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-103/dev/browsertest.mjs` | Real Chromium, Canvas 2D. **desktop**: title and back link, the prologue by keyboard, the party and snack sheet, a real mouse click walks a unit and another attacks, Undo, Skills sheet then Go!, Esc and P pause and the game freezes, Save & Quit → Continue restores every unit, winning chapter 2 recruits Mina, the bot finishes the rest of the story to the ending, the lose sheet and Try again. **phones** (touch only, real touches) at 390×844 and 844×390: the story and sheets by touch, the first tap previews and the second walks, every command button ≥ 44 px and on screen, the dialogue box and sheets inside the screen, the board inside the space the HUD leaves, every open tile centre picks that tile, no sideways scroll, the canvas matches the visible viewport, the pause screen stays open after the finger lifts. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-103/dev/shot.mjs [name] [w h]` | Screenshots `dev/gallery.html`: every character on a flat floor, and the portraits. Judge a silhouette here before it goes on a map. |
| `node game-103/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8103:

```bash
python3 -m http.server 8103          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-103/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. There is no CDN dependency (the only network request is an optional Google Font, which the scripts answer with an empty stylesheet).

The tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__cc`: `G` (the game), `mode` (`title`, `intro`, `battle`, `outro`, `ending`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `play` (the battle controller), `idle()` (the sim has no pending events and the view has nothing playing), `start(seed, chapter)` (a new campaign at that chapter with everyone recruited so far, straight into the battle), `autoplay(on)` (the bot plays your students in the real game), `ff()` (the bot finishes the battle at once and the view skips its animations), `save()`, `hasSave()`, `screenOf(x, y)` (where a tile is in client px, for clicking the canvas). `&fast=N` plays animations N× faster; it does nothing without `debug=1`.

Waiting for the view: after a command the sim changes at once but the view only hears about it on the next frame, so wait for `__cc.idle()`, not just `!view.busy`. To set up a scene, change `G.B` and call `__cc.view.skipAll(__cc.G)` so the picture catches up.
