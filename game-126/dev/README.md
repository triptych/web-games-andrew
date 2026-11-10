# EMBERSPIRE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-126/dev/simtest.mjs` | Headless, in Node, under a second. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **data**: every monster, hero and NPC has its art; every act and skill exists; floors 1–300 build valid fights with a mini boss every 5th and a boss every 10th; every bond scene has a right answer. **rules**: turn order by speed, damage, weakness and resistance, defend, statuses, stun, items, revive, flee, the auto-battle brain, AI pacing, boss enrage, the climb, rests, checkpoints, defeat, recruiting, the party, equipping, the forge (upgrade, shards from +5, reforge), the market, the temple (learn, rank up, evolve, ascend), bonds and keepsakes, quests and milestones, the daily streak, the idle tithe and its cap, errands. **determinism**: same seed and commands → same game; a save round trip (also mid-battle) plays on identically. **bot**: the whole-game bot plays `DAYS` days on `SEEDS` seeds at two diligence levels with invariants every day, prints the balance table, and asserts the bands. `ONLY=purity,data,rules,determinism,bot`, `SEEDS=n`, `DAYS=n`, `VERBOSE=1`. |
| `node game-126/dev/browsertest.mjs` | Real Chromium. **desktop**: title, back link, New Game, the story by Enter, the daily bonus, the generated audio decodes and the town theme plays, the Tavern and Escape, the Gate, a battle with real keys (1 attacks, A toggles auto), the battle theme, victory, Next floor, home in the evening, an evening with Mira, rest, a Forge upgrade and a Market purchase by click, Save & Quit → Continue. **phones** (touch only) at 390x844 and 844x390: taps through title and story, finger-sized controls on screen, a tapped battle command and a target tapped on the canvas, no sideways scroll. **nostorage**: plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-126/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-126/dev/preview.mjs` | The 1200x630 Garden and share preview (a boss fight with an evolved party) to `garden/img/games/game-126.jpg`. |
| `python3 -I game-126/dev/art/export.py RAW` | Rebuilds `art/` from the raw fal renders. See [art/README.md](art/README.md). |
| `python3 -I game-126/dev/audio/process.py RAW` | Rebuilds `audio/` from the raw ElevenLabs downloads. See [audio/README.md](audio/README.md). |

The browser scripts need `playwright` and a static server on port 8126:

```bash
python3 -m http.server 8126          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-126/dev/node_modules
```

The tests wait on state, never on the clock, and open the game with `&fast=4`. Passing tests don't mean the screen
shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__es`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `stage`, `ui`, `audio`, `input`,
`start(seed)` (new game, no intro, into town), `send(cmd)` (as the UI does), `act(cmd)`, `days(n)` (the bot plays n whole
days), `fight(floor)` (a fight on any floor), `resolve()` (finish the battle with the AI), `give(gold)`, `busy` (the
view is animating or events are pending), `save()`, `hasSave()`. `&fast=N` runs N× battle pacing and animation; it does
nothing without `debug=1`.
