# Coppergate Lane — dev harnesses

| Command | What |
|---|---|
| `node game-030/dev/simtest.mjs` | Node only: purity, data (every map, person, event, tree, quest, picture, effect and voice clip), every rule and every v1 gap that was filled, determinism, saves, whole games by the bot at three skills with a balance table. `MEDIA=0` skips the art and audio file checks. |
| `node game-030/dev/browsertest.mjs` | Chromium: desktop by real keys and clicks, two touch-only phones, blocked storage, the bot autoplaying. Screenshots in `dev/shots/`. |
| `node game-030/dev/play.mjs out.png "js"` | One screenshot after a snippet (runs with `__cl`). |
| `node game-030/dev/shots.mjs [w] [h]` | Screenshots of every place, the menu, a boss battle. |
| `node game-030/dev/preview.mjs` | The 1200×630 Garden preview (Wick's party facing Big Bertha). |

All commands run from the repo root. The browser harnesses serve the repo from disk through Playwright's routing
([serve.mjs](serve.mjs)); `playwright` must resolve from the game folder:
`mkdir -p game-030/node_modules && ln -s "$(npm root -g)/playwright" game-030/node_modules/playwright`
(don't commit it).

## Debug hooks (`?debug=1`, `&fast=N`)

`window.__cl`: `G` (the live game), `counts` (events seen), `start(seed)`, `autoplay(on)`, `busy()`, `send(cmd)`,
`path(x, y, adjacent)`, `mode()`, `fight(group, boss)`, `warp(map, x, y)`, and the `mapView`, `battleView`, `ui`, `vn`,
`audio` objects. `fast=N` runs the game and battle playback N× faster.

Art and sound pipelines: [art/README.md](art/README.md), [audio/README.md](audio/README.md).
