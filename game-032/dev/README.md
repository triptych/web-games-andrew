# Ironhollow Depths — dev harness

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-032/dev/browsertest.mjs` | Real Chromium. **Floors:** generates 60 floors across all ten depths and checks each one: every floor tile is reachable from the spawn, the exit is reachable, no walking enemy spawns somewhere it can't reach you, the enemy count is right, enemy types match the depth (slimes only on floor 1, no skeletons before floor 3), and potions appear on floors 3, 5, 7 and 9. **Desktop:** title → Space → walk and swing → P and a hidden tab pause → closed stairs do nothing → kill the floor → the stairs open → floor 2 → floor 10 → clear it → claim the Hollow Crown → win screen → best run saved → R restarts → game over → a click restarts. **Phones** (touch only, 390×844 and 844×390): a tap starts the game, the stick, sword and pause controls are ≥ 44 px, on screen and don't cover the Games link, dragging the stick moves the knight (real CDP touch input), the sword button swings, pause works, the controls hide on the end screen and a tap restarts. Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. Needs `playwright` and a static server (`python3 -m http.server 8000` from the repo root). |

## Debug hooks

Load the game with `?debug=1` to get `window.__ih`:

| Hook | Effect |
|---|---|
| `__ih.start()` | Skip the title screen |
| `__ih.state` | The live `GameState` (score, lives, health, level, foesLeft, isPaused, isWon, isGameOver, best) |
| `__ih.dungeon.toFloor(n)` | Build floor `n` now |
| `__ih.dungeon.killAll()` | Kill every enemy on the floor (opens the stairs) |
| `__ih.dungeon.toExit()` | Stand on the stairs or the crown |
| `__ih.dungeon.god(on)` | Take no damage |
| `__ih.dungeon.check()` | Facts about the current floor: tile counts, reachability, enemy types, potions |
| `__ih.dungeon.player`, `.exitOpen`, `.swings` | Read-only state for assertions |
