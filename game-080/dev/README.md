# EMBERLEAF — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-080/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **world**: every map builds, every door leads in and back to its doorstep, arrivals sit beside their way out, nobody stands in a doorway or a wall, spawns stand on ground (or water), shops have keepers, the library has its twelve lecterns and eight shelves of six, the loose pages never block the way. **gating**: the planner finishes the kingdom in order, proves each grimoire's lock is needed exactly where `BOOK_REQ` says (and nothing more is), and that every chest, person, sign, lectern and guardian can be reached in the end. **rules**: walking, walls, doors, rest, chests, keys, every power on its lock, swimming, the star seal, placing grimoires, the Returns Cart and its gifts, shops, gear, a battle won, a battle lost, a guardian becoming its book, no fleeing guardians, the dark caves. **people**: every person's every script at four points in the story, through the real dialogue runner. **determinism**: same seed, same game; a save round trip plays on identically; bad saves are refused. **bot**: the whole game, title to ending, on `SEEDS` seeds at two skills, with a balance table. `ONLY=purity,world,gating,rules,people,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-080/dev/browsertest.mjs` | Real Chromium (SwiftShader). **desktop**: title and back link, New Game, real Space through the welcome, real arrows into the library, Wick, Escape pauses and the sim stops, Space on the focused Resume, the satchel's six tabs, a squabble won by clicks, a shop, a dialogue choice pressed with Space, Save & Quit → Continue. **phones** (touch only, real CDP touches) at 390×844 and 844×390: tapping through dialogue, the touch deck, the stick walks, A talks, a squabble won by taps, ❚❚ pauses and stays open, the satchel; controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport, the HUD clear of the back link. **nostorage**: boots and plays with `localStorage` throwing. **stale**: every module and the stylesheet carry `?v=VERSION`; an old `game.js` shows the "couldn't start" card, and Reload then New Game works by touch. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage,stale`. |
| `node game-080/dev/stamp.mjs` | Writes the import map in `index.html` that fetches every module (and `style.css`) as `?v=VERSION`, so a phone that cached the last release can't mix old and new files. **Run it after bumping `VERSION` in `js/config.js` or adding a module**; simtest's purity section fails until you do. |
| `node game-080/dev/ending.mjs` | The last stretch in a real browser: `ff` with the bot to the Undercroft, then the in-page autoplay bot (waiting for the dialogue box and battle director like a person) calms the Blot; passes if the ending screen appears with no errors and the game is won. `SEED=n`. Takes a few minutes. |
| `node game-080/dev/tour.mjs` | Screenshots 36 places (towns, every biome, night and dusk, interiors, the library empty and restored, every dungeon) to `dev/shots/tour-*.png`. `ONLY=castle,undercroft`, `W=390 H=844` for a phone. |
| `dev/gallery.html` + `node game-080/dev/shot.mjs` | Every person (four facings, three walk frames and the dialogue-portrait crop), every foe at world and battle size, every guardian and every item icon, on a neutral background. `shot.mjs [page] [name]` screenshots a dev page full-length. |
| `node game-080/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8080:

```bash
python3 -m http.server 8080          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-080/dev/node_modules
```

Fonts come from Google Fonts with a system fallback; the harnesses answer those requests with an empty stylesheet. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__el`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `act(cmd)`, `start(seed, { skipIntro })`, `autoplay(on, { skill })` (the bot plays the real game, waiting for the UI like a person), `ff(seconds, { until })` (run the sim ahead with the bot, battles and dialogue included), `save()`, `hasSave()`, `warp(map, x, y)`, `give(item, n)`, `grant([grimoire ids])`, `fight([foe ids], { boss })`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.

## Debugging the world

`js/sim/plan.js`'s `reach(books)` floods the whole kingdom holding those grimoires; `progression()` collects guardians greedily. To see what's reachable in a zone, flood with `reach([...])` and print the tiles with `res.seen(node(map, x, y))` (see the gating section of `simtest.mjs`). Town zones are drawn in `TOWNS` in `js/sim/data/world.js` (22 × 14 letters each); dungeons and interiors in `js/sim/data/maps.js`.
