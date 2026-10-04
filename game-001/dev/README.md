# Space Shooter — dev harness

| Command (from the repo root) | What it does |
|---|---|
| `node game-001/dev/browsertest.mjs` | Real Chromium. **Desktop:** the title waits for input, Space starts, the ship moves at ~300 px/s whatever the frame rate, holding Space keeps firing, P and a hidden tab pause (nothing moves), a collision ends the run and saves the best score, Enter restarts, the best score survives a reload. **Phones** (touch only, portrait and landscape): the canvas fits the screen, a tap starts, dragging moves the ship by the drag distance (not to the finger) and fires while held, the restart button is ≥ 44 px. Fails on any console error, page error or failed request. Needs `playwright` and a static server (`python3 -m http.server 8000` from the repo root). |

The game is a single classic script, so its top-level `let` bindings (`mode`, `player`, `bullets`, `enemies`, `score`) are reachable from `page.evaluate` without a debug hook.
