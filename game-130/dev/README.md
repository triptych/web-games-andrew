# Starbase Spooky: dev harnesses

Plain Node scripts, no build step and no test framework. Run them from the repo root.

| Command | What it does |
|---|---|
| `node game-130/dev/simtest.mjs` | Headless, in Node. Sections (`ONLY=` takes a comma list; `SEEDS=n`, `VERBOSE=1`):<br>**purity**: `js/sim`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock.<br>**data**: every line the code names exists and has a voice clip; questions are valid; every spot is on the canvas; every art file exists.<br>**rules**: a whole game by hand, checking each gate (the briefing, the quiz, the dark garden, repairs, bedtime, the Glow-o-Meter, the mystery, the vents, the song, the ending).<br>**puzzles**: every puzzle solvable on 300 seeds after random wrong taps.<br>**determinism**: same seed and commands give the same game; a save round trip plays on identically.<br>**bot**: whole games at skill 1 and 0.4, with invariants and the balance table and bands. |
| `node game-130/dev/browsertest.mjs` | Real Chromium with real input. `ONLY=desktop,phones,nostorage`. Screenshots go to `dev/shots/bt-*`.<br>**desktop**: Space, Enter, M and N, number keys, Escape (including over a focused slider), mouse clicks on the map, on Zorp and on the wire puzzle, Save & Quit → Continue, the certificate, the sounds decoding and the music playing.<br>**phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, the dialogue, the map, the visitor and the answers; checks control sizes, the dialogue on screen and no sideways scroll.<br>**nostorage**: plays with `localStorage` throwing. |
| `node game-130/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value) and saves a screenshot to `dev/shots/name.png`. `FONTS=1` lets the Google Fonts load instead of stubbing them. |
| `python3 -I game-130/dev/art/export.py RAW` | Exports raw fal renders to `art/`. See [art/README.md](art/README.md). |
| `node game-130/dev/art/prompts.mjs [names]` | Prints every fal request, built from the data tables. |
| `node game-130/dev/audio/lines.mjs` | Prints the voice takes sent to ElevenLabs. |
| `python3 -I game-130/dev/audio/process.py RAW` | Cuts and encodes the raw ElevenLabs downloads into `audio/`. See [audio/README.md](audio/README.md). |
| `node game-130/dev/preview.mjs` | Writes the 1200×630 preview (`garden/img/games/game-130.jpg`) from a real scene. |

The browser scripts need `playwright` and a static server on port 8130:

```bash
python3 -m http.server 8130          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-130/dev/node_modules
```

## Debug hooks (`?debug=1`)

`window.__ss` has:
- `G`, `mode`, `map`, and `seen` (a count of every sim event drained)
- `view`, `ui`, `audio`
- `start(seed)` (skips the title) and `act(cmd)` (any sim command, through the same path as a tap)
- `next()` (the next line, without the quarter-second guard)
- `autoplay(on, skill)` (the bot plays the real game, frame by frame)
- `ff(n, skill)` (the bot plays n commands at once) and `until(fn, skill)` (the bot plays until `fn(G)` holds)
- `targetAt(key)` (the client px centre of a canvas target such as `spot:visitor`, `map:dock`, `wl0` or `p3`, for real taps) and `targets()`
- `objective()`, `rightAnswer()`, `save()` and `hasSave()`

`&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.

Passing tests don't mean the screen looks right, so open the screenshots.
