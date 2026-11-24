# Glimmerglade — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-148/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **rules**: runs, capacity, colour, blooming, mist, brambles, cups, undo stopping at a bloom, sprout, hints (and a lost position), restart, stuck, win, stars. **levels**: all 50 build deterministically with four of each colour, the twists their chapter promises, and the solver's line replays to a win in par through `act()`. **determinism**: save round trips mid-level play on identically. **bot**: the perfect bot 3-stars every level; three casual bots finish every level; prints the averages (`TABLE=1` for the per-level table). **free**: `SEEDS` daily/dream puzzles. `ONLY=purity,rules,levels,determinism,bot,free`, `VERBOSE=1`. |
| `node game-148/dev/browsertest.mjs` | Real Chromium. **desktop**: title and back link, Begin → story by real Space presses, real clicks lift and pour, a real drag pours, Z undoes, digit keys pour, Firefly and Sprout tools, Escape pauses, Settings over Pause closes on Escape with a slider focused, the audio decodes and music plays, win → stars → Next, Back to Title → Continue, the map, the journal, the daily dewdrop, sheet buttons stay on screen when scrolled. **phones** (touch only, 390×844 and 844×390): taps through story and play, tools and pause ≥ 44 px, on screen and on top, no blossom under the toolbar, no sideways scroll. **nostorage**. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. |
| `node game-148/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints), screenshots to `dev/shots/name.png`. `DPR=2` for a sharper picture. |
| `node game-148/dev/preview.mjs` | Writes `garden/img/games/game-148.jpg` (1200×630): level 45 part-way through, creatures perched. |
| `python3 -I game-148/dev/art/export.py RAW` | Raw ElevenLabs renders → `art/*.webp` ([art/README.md](art/README.md)). |
| `python3 -I game-148/dev/audio/process.py RAW` | Raw ElevenLabs audio → `audio/*.mp3` ([audio/README.md](audio/README.md)). |

The browser scripts need `playwright` and a static server on port 8148:

```bash
python3 -m http.server 8148          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-148/dev/node_modules
```

## Debug hooks (`?debug=1`)

`window.__gg`: `G`, `P` (progress), `mode`, `busy` (wisps flying, events undrained or commands queued), `seen` (a count
of every sim event drained), `view`, `ui`, `audio`, `input`, `settings`; `start(n)` (level n, 0-based, skipping the
story), `daily()`, `dream()`, `act(cmd)` (queue a command), `tap(i)` (the same as tapping blossom i), `win()` (play the
solver's line at once), `autoplay(on, fast)` (the perfect bot plays the real board), `legal()`, `tubeCenter(i)`
(client px), `save()`, `toTitle()`, `openMap()`.

Wait on state, not the clock: after a command, wait for `!__gg.busy`.
