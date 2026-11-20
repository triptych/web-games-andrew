# Echoes of Aethermoor — dev harnesses

| Command | What |
|---|---|
| `node game-028/dev/simtest.mjs` | Node only: purity, data (every map, person, event, tree, quest, art file and voice line), every rule and v1 bug fix, determinism, saves, whole games by the bot at three skills with a balance table. |
| `node game-028/dev/browsertest.mjs` | Chromium: desktop by real keys and clicks, two touch-only phones, blocked storage, autoplay. Screenshots in `dev/shots/`. |
| `node game-028/dev/play.mjs out.png "js"` | One screenshot after a snippet (runs with `__ea`). |
| `node game-028/dev/shots.mjs [w] [h]` | Screenshots of every place, the menu, a boss battle. |
| `node game-028/dev/preview.mjs` | The 1200×630 Garden preview. |

The browser harnesses serve the repo from disk through Playwright's routing ([serve.mjs](serve.mjs)); `playwright` must
resolve from the game folder: `mkdir -p game-028/node_modules && ln -s "$(npm root -g)/playwright" game-028/node_modules/playwright`
(ignored by git).

## Debug hooks (`?debug=1`, `&fast=N`)

`window.__ea`: `G` (the live game), `counts` (events seen), `start(seed)`, `autoplay(on)`, `busy()`, `send(cmd)`,
`path(x, y, adjacent)`, `mode()`, `fight(group, boss)`, `warp(map, x, y)`, and the `mapView`, `battleView`, `ui`, `vn`,
`audio` objects. `fast=N` runs the game and battle playback N× faster.

Art and sound pipelines: [art/README.md](art/README.md), [audio/README.md](audio/README.md).
