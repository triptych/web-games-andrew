# Gemheart Saga — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-128/dev/simtest.mjs` | Headless, in Node, about 5 s. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock, and the bot never rolls the game's dice. **board**: bounces, matches, line/bomb/prism gems, blasts, gravity and refill, stone, chains, cascades. **battle**: gems → damage/mana/healing, weakness, chains, the foe's timer and curses, skills (damage, shield, freeze), items and their cooldown, doom gems, winning pays once, losing, Phoenix Feather revives, level ups. **village**: idle output and its cap, a clock set back pays nothing, the daily gift and streak, calendar arithmetic, the festival, Town Hall gating, exact costs, the Market by level, equip/upgrade/sell, requests. **story**: four ten-chapter tales, different orders and scenes, every fight and speaker known, the nemesis twice, the Sovereign last. **media**: every picture and sound the game names exists, every story voice clip is tied to a line, media under 12 MB. **determinism**: same seed + bot → same game; a save round trip mid-battle plays on identically; unknown saves rejected. **bot**: every hero's whole tale at skill 1 and 0.6 on `SEEDS` seeds, the balance table and its bands. `ONLY=purity,board,battle,village,story,media,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-128/dev/browsertest.mjs` | Real Chromium. **desktop**: title and back link, New Tale → hero choice → scene (Next, Skip) → village; daily gift, Market purchase, Escape closes a panel with focus inside it, the skill tree; a chapter: Enter through the scene, a real mouse drag swaps, arrows + Space swap, key 1 casts, Escape pauses and the battle stops, results and Continue through every fight, home with the chapter done; Save & return to title → Continue; the ElevenLabs clips decode and music plays. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus (the finger that picks a hero doesn't also advance the scene), village buttons ≥ 44 px and on screen, a patrol, a real touch drag swaps, a tapped skill fires, the board fully on screen, ❚❚ pauses and stays up after the finger lifts. **nostorage**: boots and fights with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-128/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-128/dev/preview.mjs` | The 1200×630 preview for the Garden library: a Kael battle mid-fight. Writes `garden/img/games/game-128.jpg`. |
| `python3 -I game-128/dev/art/export.py RAW` | Raw fal renders → `art/`. See [art/README.md](art/README.md). |
| `node game-128/dev/art/prompts.mjs` | Every fal request, written from the data tables. |
| `python3 -I game-128/dev/audio/process.py RAW` | Raw ElevenLabs downloads → `audio/`. See [audio/README.md](audio/README.md). |

The browser scripts need `playwright` and a static server on port 8128:

```bash
python3 -m http.server 8128          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-128/dev/node_modules
```

SwiftShader draws a few frames a second and a frame is capped at 0.05 s, so the tests open the game with `&fast=3` and
wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__gs`: `G`, `mode` ('title' or `G.mode`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`,
`input`, `start(seed, hero)` (a new tale straight into the village), `cmd(c)` (any sim command, as the UI sends it),
`autoplay(on, skill)` (the bot plays battles in the real loop), `ff(seconds)` (run the battle ahead with the bot),
`win()` (end the current fight in a win), `skipScene()`, `clock(ms)` (move the village clock forward), `save()`,
`hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
