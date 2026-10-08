# game-071 dev tools

Run from the repo root with a static server on port 8071 (`python3 -m http.server 8071`). The browser tools need Playwright and a local copy of three r165 in `dev/package/` (the CDN is routed there, see the repo's [dev/README.md](../../dev/README.md)).

| Tool | What it does |
|---|---|
| `node game-071/dev/simtest.mjs` | Headless checks in Node: sim purity, quest data, every dungeon room reachable, the whole main story and both summit choices, combat, sigils, crafting, the law, fast travel, save and load. About 3 s after the world builds. |
| `node game-071/dev/browsertest.mjs` | The real game in Chromium (SwiftShader): desktop flow through character creation, every menu, quicksave/quickload, the keep, a conversation, fast travel, a dungeon and the Eye of the Storm; then a touch-only phone. Screenshots in `dev/shots/bt-*.png`. Slow: SwiftShader renders a few frames per second. |
| `node game-071/dev/shot.mjs name "js;;WAIT:ms;;SHOT:x"` | Ad-hoc screenshots. Snippets run with `F` = the app (`window.__fm`). `PAGE=dev/models.html` opens the model gallery instead. |
| `dev/models.html` | A gallery of every character, beast, monster and dragon with their animations. |

URL flags: `?debug` (frame stats), `?q=0..3` (force a quality tier), `?fast=N` (run the sim N× faster).

What the tests found while building it: quest steps whose scripted dragon disappeared after a load or a door (now re-spawned while none is alive), a New Game snapshot that shared objects with the live world, a title camera that lerped up from under the terrain, and dungeon rooms that ramps could not reach (corridor heights are now relaxed).
