# The First Dragon Prince — dev harnesses

Everything runs from the **repo root**. The browser harnesses need a static server on port 8127:

```bash
python3 -m http.server 8127
```

Playwright is preinstalled globally; ESM imports need a local link (git-ignored):

```bash
ln -sfn "$(npm root -g)" game-127/dev/node_modules
```

| Harness | What it does |
|---|---|
| `node game-127/dev/simtest.mjs` | Node only. Sections: **purity** (no DOM, `Math.random`, clock or storage in `js/sim/`), **data** (every id a script, activity, quest, region or ending names exists; every art file is on disk, every expedition danger has a creature), **rules**, **scenes** (every script lints, terminates and can be saved and loaded mid-scene), **determinism** (same seed, same game; save round trip), **routes** (the bot plays each of the 16 routes on 3 seeds and must reach its ending), **skill dial**, **bad endings**. 806 checks. |
| `node game-127/dev/browsertest.mjs` | Real Chromium. Desktop 1280×760: naming, prologue (typing, voice, music, history), Free Day, market, a talk, the planner by click, three periods with vignettes, status, save to slot 1, Save & Quit, Continue, an album replay that leaves the game alone, and the bot to the ending card. Phones 390×844 and 844×390, touch only: taps through, ≥ 44 px controls on screen, no sideways scroll, panel below the HUD. `nostorage`: localStorage throws, the game still plays. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. |
| `node game-127/dev/play.mjs <name> "<js>" [wait] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet, saves `dev/shots/<name>.png`. |

The art and audio pipelines are in [art/README.md](art/README.md) and [audio/README.md](audio/README.md).

## Debug hooks (`?debug=1`)

`window.__fdp`:

- `G`, `R` (an album replay's sandbox game), `mode` (`title` · `game` · `replay` · `ending`), `album`, `seen` (count of every sim event drained), `ui`, `vn`, `audio`, `input`.
- `start(seed, names)` new game, straight into the prologue. `send(cmd)` a sim command through the UI.
- `skipScenes()` finish every queued scene, first choice each time.
- `months(n, route)` / `toEnding(route)` / `playThrough(route)` the bot plays in a blink (no rendering in between).
- `autoplay(route, every)` the bot plays through the real UI, one command every `every` seconds; `autoplay(null)` stops.
- `place(id)` open a Free Day place. `replay(key)` replay an album scene. `unlockAll()` fill the album.

`&fast=N` types and auto-advances N times faster.
