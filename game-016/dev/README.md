# Crate Pusher — dev harness

| Command (from the repo root) | What it does |
|---|---|
| `node game-016/dev/browsertest.mjs` | **Solver:** a breadth-first search over (pusher, crates) states proves every level in `js/levels.js` is solvable and finds its shortest solution. **Desktop:** U undoes, R restarts, then all eight levels are played through the real UI from their solver solutions; each win saves the best move count and unlocks the next level; a click skips the win wait; the last level reaches the complete screen; the title's level picker shows every level solved; number keys pick a level. **Phones** (touch only, portrait and landscape): locked levels can't be picked, level 1 opens from the picker, a swipe pushes the crate home, a tap skips the win wait, swipes keep working afterwards, the Undo, Restart and Menu buttons work, a tap beside the pusher steps towards it, level 2 is solved by swiping. Fails on any console error, page error or failed request. Needs `playwright` and a static server (`python3 -m http.server 8000` from the repo root). |

Load the game with `?debug=1` to get `window.__cp`: the current scene, and in the game scene the level, move count, pusher position, tile size and board origin.
