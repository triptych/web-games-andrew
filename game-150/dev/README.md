# Folio & Fable — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-150/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **books**: the engine is deterministic and makes sane books over every kind × rarity × 40 seeds (title, author, virtues within budget, a finite look, value rising with rarity, every legendary grimoire talks). **rules**: furniture, shelving and sections, the open shop (browsers buy; wishes served, commissioned, declined, fulfilled later, lapsing), an impatient customer, closing early, expeditions, the bindery (rarity from cover and accents, skills, rebinding), reading and skills, talking books and Whispering, the town's inspirations, the trader and every chapter's reward to the ending. **determinism**: same seed and play → same game; a save in the middle of an open day plays on identically. **requests**: every wish over 240 bot days can be answered by a book the game can make. **bot**: the whole story at two skills on `SEEDS` seeds with per-step invariants and the balance table. `ONLY=purity,books,rules,determinism,requests,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-150/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game by a mouse click, the prologue, the audio decodes and plays, a real click on a shelf in the canvas, adding a book, Escape, filling the shelves, O opens the shop, a wish served at the counter (the clock stops meanwhile), the evening, reading, Sleep, the 3D inspector (pixels read back, the cover opens), the 3D shelves (a real click on a book), the bindery by clicks, an expedition, Save & Quit → Continue, the masterwork and the ending. **phones** (touch only, CDP touches) at 390×844 and 844×390: the story by taps, the dock ≥ 44 px, on screen and uncovered, a drag pans the shop, a tapped shelf's sheet keeps Done on screen, no sideways scroll, the layout in px. **nostorage**: plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-150/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-150/dev/preview.mjs` | The 1200×630 picture for the Garden's Library and share links: a stocked shop mid-day. |
| `python3 -I game-150/dev/art/export.py RAW` | The ElevenLabs renders → `art/` (see [art/README.md](art/README.md)). |
| `python3 -I game-150/dev/audio/process.py RAW` | The ElevenLabs audio → `audio/` (see [audio/README.md](audio/README.md)). |

The browser scripts need `playwright` and a static server on port 8150:

```bash
python3 -m http.server 8150          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-150/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the
scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4`
and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ff`: `G` (the game), `mode`, `speed`, `seen` (a count of every sim event drained), `ui`, `shop` (the 2D view;
`centerOn`, `sx`, `pick`), `stage` and `shelfStage` (the 3D views; `screenOf(bookId)`, `focusBook`, `bookAt`), `audio`,
`input`, `bot`; `start(seed, { story })` (skips the title, and the story unless asked), `autoplay(on)` (the bot plays
the real game through its own loop), `ff(days)` (the bot plays whole days synchronously), `cmd(c)` (any command, as a
tap would send it), `give(n, opts)` (n procedural books into the back room), `skipStory()`, `inspect(id)`,
`shelves()`, `save()`, `hasSave()`, `shelfBooks(row, slot)`, `cell(row, slot)`. `&fast=N` runs the shop clock N× faster;
it does nothing without `debug=1`.
