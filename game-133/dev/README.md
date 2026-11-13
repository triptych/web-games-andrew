# Lanternhall — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-133/dev/simtest.mjs` | Headless, in Node (250 checks). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **scripts**: all 61 scenes linted (known directives and speakers, labels exist and are unique, every `{token}`, effect and condition parses), every backdrop, picture, portrait, face, tune, effect and voice clip is on disk. **rules**: grading, parties and reports, experience, visits and hearts, reviews, rooms, the till, the debt, the raid, the vote, the end. **petitions**: 2,000 petitions read back from their words give the true rank. **minigames**: 60 route maps solved; the stamp, brew, dice and spar rules. **determinism**: same seed and commands, same game; a save on days 3, 9, 16 and 22, mid-scene and mid-mini-game. **endings**: each of the sixteen is reached by its route through real play; the rule order. **bot**: whole games at three skills with per-command invariants and the balance table. `ONLY=purity,scripts,rules,petitions,minigames,determinism,endings,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-133/dev/browsertest.mjs` | Real Chromium. **desktop**: title and back link; New Game with a typed name and a chosen gender; real Enter/Space/digit keys through the prologue; Escape (also with a slider focused) and Space on a focused button; a petition graded from the words on the page; the party picker; all five mini-games by their real buttons and keys; a visit with its voiced greeting; End the Day; Save & Quit → Continue; the Handbook; the bot to the raid, the raid by click, an ending, the album; 108 pictures load and 46 sound files decode; music is playing. **phones** (touch only, real CDP touches) at 390×844 and 844×390: New Game, the story, a choice, the desk, a petition, every tab, Cartography on the d-pad, the menu; controls ≥ 44 px, on screen and clear of the back link on every screen; no sideways scroll. **nostorage**: boots, plays and ends with `localStorage` throwing. Fails on any console error, page error, failed request or HTTP error. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-133/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1&fast=8`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-133/dev/preview.mjs` | Writes `garden/img/games/game-133.jpg` (1200×630): the dragon scene. |
| `python3 -I game-133/dev/art/export.py RAW_DIR [name…]` | Cuts and encodes the fal images ([art/README](art/README.md)). Needs `pillow`, `numpy`, `scipy`. |
| `python3 -I game-133/dev/audio/process.py RAW_DIR` · `node game-133/dev/audio/voices.mjs RAW_DIR [write]` | Encodes the ElevenLabs audio and splits the voice takes ([audio/README](audio/README.md)). Needs `ffmpeg`, `numpy`. |

The browser scripts need `playwright` and a static server on port 8133:

```bash
python3 -m http.server 8133          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-133/dev/node_modules
```

Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__lh`: `G` (the game), `mode` (`title` / `game` / `ending`), `seen` (a count of every sim event drained), `ui`, `vn`, `audio` (`audio.played` counts effects), `album()`, `start(seed, { name, gender })` (skips the title), `send(cmd)` (the same path the UI uses), `skip()` (plays the scene on stage to its end, first answer each time), `ff(day, route)` (the bot plays through the real command path until that day or the ending; routes are the sixteen in `js/sim/bot.js`), `save()`, `hasSave()`. `&fast=N` speeds up typing, auto mode, the Cauldron's recipe and the till; it does nothing without `debug=1`.
