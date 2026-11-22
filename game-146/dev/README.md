# JINGLE POP — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-146/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: the grid and traced shots, matching and drops, every special and power-up, the tray, the ceiling, losing and winning and stars, the spirit meter, endless rows. **levels**: all 36 build the same board for any play seed, hang from the ceiling, cap colour groups, place their specials and have a par. **determinism**: same seed and inputs → same game; a save round trip mid-flight plays on identically (levels and the Blizzard). **bot**: the perfect bot clears every level on `SEEDS` seeds with per-step invariants; the balance table for skills 1, 0.6 and 0.3 is printed with asserted bands; the Blizzard lasts but ends. `ONLY=purity,rules,levels,determinism,bot`, `SEEDS=n` (default 3; the bot section takes about a minute), `VERBOSE=1`. |
| `node game-146/dev/balance.mjs` | Plays every level with the perfect bot (`SEEDS`, default 6) and writes `js/sim/data/par.js` (median × 1.35 + 2). Run it after changing levels or rules. |
| `node game-146/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, the level map, the story by Enter, the mouse aims and a click shoots, keys aim and Space shoots (a press during the cool-down is kept), pause freezes the sim, Settings over pause and closed by Escape from a slider, tray swaps by key and click, the sack by Q and click, the pudding bomb, Save & Quit → Continue, a won level → result → next level, a lost level → Try Again, the Blizzard with Grimwick's line and pushed rows, the ElevenLabs clips decode and the music plays. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through title and story, a drag on the board aims and the lift shoots, a drag below the launcher cancels, tray and sack taps, every control ≥ 44 px, on screen and on top, the pause screen survives the lift. **nostorage**: plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-146/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `python3 -I game-146/dev/art/export.py RAW` | Raw ElevenLabs image renders → `art/*.webp` (see [art/README.md](art/README.md)). |
| `python3 -I game-146/dev/audio/process.py RAW` | Raw ElevenLabs audio → `audio/*.mp3`, voice takes split into lines (see [audio/README.md](audio/README.md)). |

The browser scripts need `playwright` and a static server on port 8146:

```bash
python3 -m http.server 8146          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-146/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root);
the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4`
and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__jp`: `G` (the game), `mode`, `progress`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`,
`input`, `start(level, seed)` (skips the story), `endless(seed)`, `story(level)` (the story-then-level path),
`autoplay(on, skill)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the perfect bot),
`targets()`, `save()`, `hasSave()`, `unlockAll()` (every level open, every scene marked seen). `&fast=N` runs N× the
simulation per frame; it does nothing without `debug=1`.
