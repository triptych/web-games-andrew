# WanderQuest — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-085/dev/simtest.mjs` | Headless, in Node (~15 s). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a canvas, storage, `Math.random` or the clock. **world**: roads, region gates, every town reachable once the Waystones are lit, the planner never takes a closed road, no quest points at a locked town, region or good (30 seeds). **book**: the scrapbook keeps every person (with what became of them), monster, item, good, material, town, road and letter; its counts agree with the stats over a 12-hour run; it stays bounded; older saves get one. **scenery**: the countryside beside the road is deterministic, varied (9+ kinds per biome), off the road, clumped into groves and clearings, and fills all three bands. **rules**: travel and Rally, rations and hunger, camping, the inn, trade and price pressure, courier / delivery / bounty quests, the cook, smith and alchemist, gear and its level limit, upgrades, hiring and cart levels, wanderers, the morning post and its streak, courses and turning back, Wardens, odds that change nothing, the Night Roads. **determinism**: same seed, same game; half an hour of play equals half an hour away; a save round trip plays on identically; an unknown save version is rejected; a full day away simulates in well under a second. **bot**: the bot plays the whole realm on `SEEDS` seeds at two skills (checking in every 30 minutes, or every 8 hours and spending less) with invariants checked every game hour, and prints the hour each Waystone was lit. `ONLY=purity,world,book,scenery,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-085/dev/browsertest.mjs` | Real Chromium. **desktop**: title and back link, unique ids, New Caravan by click, the letter, number keys switch tabs, an upgrade, a purchase and a hire by real clicks, a course set by clicking a town on the map, Space rallies, a fight's animation plays and ends, Esc opens the menu while the road keeps going, Save & Quit → Continue, then a **fresh page whose save is two hours old** shows the chronicle with two hours on the road (Space closes it), a new day's morning post opens from the Quests tab, and the Scrapbook opens by key with every creature's portrait drawn, the travel log and a letter re-read without counting as new post. **phones** (touch only, real taps) at 390×844 and 844×390: the title, the letter, every tab, the HUD clear of the back link with a seven-figure purse, 44 px controls on screen, nothing under the back link, Rally by tap, the menu stays open after the finger lifts, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and travels with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-085/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `STACK=1` prints page-error stacks; `REAL_FONTS=1` loads the real Google Fonts (Cinzel is much wider than the fallback the tests use, so check titles with it). |
| `node game-085/dev/shot.mjs [page] [name]` | Screenshots a dev page; by default `dev/gallery.html`: every monster, Warden, cart, traveller and roadside prop on a neutral background (`?night=1` at night). Judge art here before judging it on the road. |

The browser scripts need `playwright` and a static server on port 8085:

```bash
python3 -m http.server 8085          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-085/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. The game has no CDN dependency; the harnesses answer Google Fonts requests with an empty stylesheet.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

Testing time away: never rewind a save and `reload()` the page that wrote it, because its `pagehide` handler saves again first (game-034's lesson). The browser test seeds the rewound save with `addInitScript` on a fresh page in the same context.

## Debug hooks (`?debug=1`)

`window.__wq`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed, wagonName)` (skips the title and the naming sheet), `autoplay(on)` (the bot checks in every 10 s of play), `ff(seconds)` (run ahead quietly with the bot checking in), `away(seconds)` (exactly what coming back after that long does, chronicle and all), `cmd(command)` (any sim command), `day(n)` (move the calendar n days), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.

## Balance

`SEEDS=6 ONLY=bot node game-085/dev/simtest.mjs` prints the hour each Waystone was lit for both bots. Compare medians over several seeds, not one run: the seeded stream shifts with every new `rng()` call.
