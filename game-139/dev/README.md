# CLEAN SLATE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-139/dev/simtest.mjs` | Headless, in Node (about a second). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every card, rival and room is well formed and every picture and voice line it names exists. **rules**: pairs (exact for two rival cards, 12–14 with yours), Clean pairs, kings, cuts and Notoriety, taint, bounty, locks, pouring a Grudge, every rival intent, Composure, reshuffles, winning, trust and partnerships, the market, rooms, chores, interludes, letters, acts, bosses, endings, losing. **determinism**: same seed and commands → same run; save round trips at three points play on identically. **hints**: in 500+ real positions the tutorial's suggested pair is a legal command, exists whenever any pair does, and is your own non-Blade card whenever one can pair. **bot**: whole runs at three blade policies × two skills on `SEEDS` seeds with invariants after every command, the balance table, and its bands asserted. `ONLY=purity,data,rules,determinism,hints,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-139/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Run by click, the story by real Enter presses, a letter, the tutorial (Next, then the glowing pair made by real clicks, then Skip, remembered), a real mouse pair on the 3D table (picked by raycast), E ends the round, Escape pauses and keys stop, the bot wins the night, partnership, the day (buy, Polish through the deck picker, Open the doors), Save & Quit → Continue, the clips decode and music plays, the bot plays the run out to its ending or loss screen. **phones** (touch only, real touches) at 390×844 and 844×390: menus and stories by tap, every playable card on screen, the coach panel on screen and clear of the hand and skipped by a tap, a tapped pair settles, End round, ❚❚ stays open after the lift, controls ≥ 44 px, no sideways scroll, the day sheet fits. **nostorage**: plays a night with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-139/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-139/dev/preview.mjs` | The 1200×630 Library picture (`garden/img/games/game-139.jpg`): a night in progress on the card table. |
| `node game-139/dev/art/prompts.mjs [pilot\|rivals\|cards\|scenes\|sheets]` | The fal jobs, built from the data. `python3 -I game-139/dev/art/export.py RAW SHEETS.json` writes `art/`. See `dev/art/README.md`. |
| `node game-139/dev/audio/voices.mjs` | The voice takes, built from the rivals' and the Narrator's lines. `python3 -I game-139/dev/audio/process.py RAW` writes `audio/`. See `dev/audio/README.md`. |

The browser scripts need `playwright` and a static server on port 8139:

```bash
python3 -m http.server 8139          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-139/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a few frames a second: the tests wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__cs`: `G` (the run), `mode`, `sel` (the chosen card), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `start(seed)`, `act(cmd)` (a command, exactly as a tap makes it), `ff(n)` (the bot plays n commands, skipping stories), `autoplay(on, { skill, blades })` (the bot plays at a watchable pace), `skipStory()`, `screenOf({ hand } | { slot })` (where a card is on screen, in client px), `legal()` (every legal command), `save()`, `hasSave()`. `&fast=1` makes autoplay act every frame.
