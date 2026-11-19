# Arcana Pull — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-012/dev/simtest.mjs` | Headless, in Node (under a second). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **data**: 78 cards by rarity, every skill effect known, every Hollow and Threshold well formed; every picture, effect, theme and voice clip on disk, every clip a spoken line and `voices.json` covering exactly the lines. **rules**: the Well (costs, a Rare in every ten-draw over 200 seeds, pity and soft pity, the featured Major's share, copies, stars, spare stardust), the spread, battles won and lost, lives and the end of a run, Readings after 3/6/9 and their omens (three in ten reversed), Hexed, Cursed, Fortune, the four charms, the ending and Ascension. **battle**: the element wheel, resonance tiers, the same timeline from the same seed, the shield cap followed through a timeline, taunt, The Star's revive, Death's execute, undying, The World's phases in order, the candle. **determinism**: same seed and commands → same run; save round trips at three points play on identically; an old save is refused. **bot**: whole runs for three styles on `SEEDS` seeds, invariants after every command, the balance table, its bands asserted. `ONLY=purity,data,rules,battle,determinism,bot`, `SEEDS=n`. |
| `node game-012/dev/browsertest.mjs` | Real Chromium. **desktop**: the title and back link, New Reading by a real click (audio unlocks), the Well, Draw 10, a card turned by click, Reveal all, the Grimoire by key, a card placed by click, a battle (both lines on the stage, the timeline playing, the canvas), 4× by key, Skip, the result and Enter, Escape pauses, the bot to a Reading, a card chosen by click, Save & Quit → Continue, effects, voices and music decoded and playing, the bot to the ending (or the last candle) and Ascend. **phones** (touch only) at 390×844 and 844×390: taps through the title, the Well and reveal, Auto, a battle with all eight cards on screen, controls ≥ 44 px, Skip and the result, the Grimoire sheet fits, no sideways scroll. **nostorage**: draws and fights with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-012/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-012/dev/preview.mjs` | The 1200×630 Library picture (`garden/img/games/game-012.jpg`): four Major Arcana fighting at the Falling Spire. |
| `node game-012/dev/art/prompts.mjs [pilot\|cards\|foes\|realms\|scenes\|sheets]` | The fal jobs, built from the data. `python3 -I game-012/dev/art/export.py RAW SHEETS.json` writes `art/`. See `dev/art/README.md`. |
| `node game-012/dev/audio/voices.mjs` | The voice takes, built from `js/sim/data/lines.js`. `python3 -I game-012/dev/audio/process.py RAW` writes `audio/`. See `dev/audio/README.md`. |

The browser scripts serve the repo from disk through Playwright's routing (`serve.mjs`, from game-027), so no web server has to
run. They need `playwright`: `mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright` and
`ln -s ../../dev/node_modules game-012/dev/node_modules`. Google Fonts are answered with an empty stylesheet.

## Debug hooks (`?debug=1`)

`window.__ap`: `G` (the run), `mode` (title, hub, battle, reading, ending, over), `frames`, `seen` (a count of every sim event drained),
`ui`, `stage`, `audio` (`played` counts every effect and voice line), `settings`, `start(seed)`, `act(cmd)` (a command, exactly as a tap
makes it), `legal()`, `ff(n, style)` (the bot plays n steps, skipping battle replays and dismissing results), `save()`, `hasSave()`,
`battleDone()`. `&fast=1` skips every battle replay.
