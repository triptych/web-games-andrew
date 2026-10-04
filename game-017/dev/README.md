# Pixel Picross — dev harness

| Command (from the repo root) | What it does |
|---|---|
| `node game-017/dev/browsertest.mjs` | Real Chromium. **Desktop:** a key starts puzzle 1, right click marks, X switches the tool and a left click then marks, every puzzle is solved by clicking its solution squares and saved as solved, a click goes on after each win, the last puzzle reaches the complete screen, after a reload the title continues at the first unsolved puzzle. **Phones** (touch only, portrait and landscape): a tap starts, taps fill, a drag fills a run of squares, the tool button switches to marking, Restart clears the board, puzzle 1 is solved by tapping, a tap goes on to puzzle 2 and taps still register afterwards, Menu returns to the title, buttons are ≥ 44 px in landscape. Fails on any console error, page error or failed request. Needs `playwright` and a static server (`python3 -m http.server 8000` from the repo root). |

Load the game with `?debug=1` to get `window.__px`: the current scene, and in the game scene the puzzle index, solution, the player's grid (0 empty, 1 filled, 2 marked), `won`, `markTool` and `cell(r, c)` (a cell's centre in game coordinates).
