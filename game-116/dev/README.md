# SOLITAIRE FROM OUTER SPACE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-116/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **data**: layouts fit 7 cards wide, every creature has a layout, known moves, badge text and a drawer, every card, gadget, souvenir and broadcast is described. **rules**: the beam (±1, K–A wrap), cover and flips, the four suits and the chain, draws and Quick, End Turn and every creature move, Static and Slime, freezing, the Clean Sweep, every kind of gadget, winning and losing. **run**: maps over 300 seeds × 3 reels (no crossing roads, all reachable, all lead to the boss, rows typed), travel, the store, removal down to the minimum deck, the diner, every broadcast option, boss souvenirs and the walk from reel to reel. **determinism**: same seed and commands → same run; a save round trip mid-fight plays on identically; an illegal command changes nothing. **bot**: whole runs on `SEEDS` seeds at skill 1 and 0.6 with per-command invariants, and the balance table (win rate, where runs end, HP lost per fight by reel and tier). `ONLY=purity,data,rules,run,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-116/dev/browsertest.mjs` | Real Chromium. **desktop**: title and back link, New Run, the reel card, the map by real keys, a mouse click plays a card that fits, D draws, E ends the turn, 1 fires a gadget, Escape pauses and Space presses the focused Resume button, Save & Quit → Continue restores the fight, the reward panel by click, the deck viewer, a lost run shows THE END and deletes the save. **phones** (touch only, real touches) at 390×844 and 844×390: menus, the map, a tap plays a card and draws, every control ≥ 44 px and on screen, the table clear of the bar, ❚❚ stays open after the finger lifts, the reward panel fits. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-116/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-116/dev/preview.mjs` | Sets up a fight against the Brain from Planet X mid-chain and writes the 1200×630 Garden preview to `garden/img/games/game-116.jpg`. |

The browser scripts need `playwright` and a static server on port 8116:

```bash
python3 -m http.server 8116          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-116/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. Font requests are answered with an empty stylesheet, so the screenshots use the fallback fonts.

The game is turn-based: a command resolves at once in the sim and the view plays its events back one at a time. Tests wait on `!__sfos.busy` (no queued taps, no undrained events, nothing playing) rather than on the clock, and the URL carries `&fast=4` to play the show four times faster. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__sfos`: `G` (the run), `mode`, `busy`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title), `autoplay(on, skill)` (the bot plays the real game through the same command path), `ff(n, until)` (run the bot for n commands or until `until(G)`, then finish the show), `cmd(c)` (one command), `finish()` (drain events and finish the show), `save()`, `hasSave()`. `&fast=N` plays the event show N× faster; it does nothing without `debug=1`.
