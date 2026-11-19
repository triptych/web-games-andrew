# Doom & Doilies: The Sugar Siege — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-143/dev/simtest.mjs` | Headless, in Node, about 300 checks. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **rules**: building, upgrading, workers and housing, hope, production, the oven and its ingredient caps, quests and deliveries, the day clock, the siege (doily, towers, knight, abilities, napping, splitting, the wall), the King who can't be beaten, the Queen, the retreat, the loss penalty, the epilogue. **content**: every quest giver, building, portrait, sprite and voice clip the data names exists. **determinism**: same seed → same game; a save round trip mid-siege plays on identically. **siege**: calibration bands. **whole**: the bot finishes the story at skill 1 and 0.3 on `SEEDS` seeds inside 70 minutes, with per-step invariants. `ONLY=purity,rules,content,determinism,siege,whole`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-143/dev/balance.mjs` | Whole games by the bot at skill 1, 0.6 and 0.3: every siege's result and wall left, the minutes to the ending. `SEEDS=n`. |
| `node game-143/dev/siege.mjs` | One siege at a time against a town that exactly meets the checklist, defended with no aim, skill 0.3, 0.6 and 1. Exports `readyTown` and `fight` for the simtest. |
| `node game-143/dev/run.mjs [seed] [skill] [minutes]` | One whole game, logging invasions and quests as they happen. |
| `node game-143/dev/browsertest.mjs` | Real Chromium. **desktop**: title and back link, the intro advanced with real keys, a plot built by a real click on the canvas, every dock panel, Escape out of Settings with a slider focused, sleeping until morning, the siege (real keys aim and throw, a number key for an ability, a click on the field), the result sheet, the sounds decode and a theme plays, Save & Quit → Continue, the King, the Queen, the ending, the epilogue. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and dialogue, a tap on a plot, building by tap, every panel's Close on screen when scrolled to the end, controls ≥ 44 px, a tap on the field throws, the ability button, pause and resume. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-143/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-143/dev/preview.mjs` | The 1200×630 preview picture for the launcher (a siege in progress). |

The browser scripts need `playwright` and a static server on port 8143:

```bash
python3 -m http.server 8143          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-143/dev/node_modules
```

The tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows
anything: look at the screenshots.

The art and audio pipelines are in [art/README.md](art/README.md) and [audio/README.md](audio/README.md).

## Debug hooks (`?debug=1`)

`window.__ds`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`,
`quiet` (set true to skip dialogue), `start(seed)` (skips the title), `load(G)`, `autoplay(on, skill)` (the bot plays the
real game), `ff(seconds, skill)` (run the sim ahead with the bot), `act(cmd)`, `save()`, `hasSave()`. `&fast=N` runs N×
the simulation per frame; it does nothing without `debug=1`.
