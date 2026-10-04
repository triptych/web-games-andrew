# Depths Unknown — dev harness

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-022/dev/browsertest.mjs` | Real Chromium, on desktop (1280×760) and a touch-only phone (390×844). Title → BEGIN MISSION → a base visit with coal sells it and shows no ending → a base visit carrying Singing Vein ore plays the ending over a paused base → its buttons ignore taps until the epilogue has played → KEEP MINING returns to the base → DEPLOY returns to the mine → the save records the mission → a second vein doesn't replay the ending → after a reload the title shows MISSION COMPLETE → NEW GAME from the ending starts a fresh world and returns to the title. Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. Needs `playwright` and a static server (`python3 -m http.server 8000` from the repo root). |

Phaser's clock runs slower than wall time under software WebGL, so the test waits for buttons to become interactive rather than sleeping a fixed time.

## Debug hooks

Load the game with `?debug=1` to get `window.__du`:

| Hook | Effect |
|---|---|
| `__du.game` | The `Phaser.Game` (scenes via `__du.game.scene`) |
| `__du.GameState` | The persistent state singleton (credits, cargo, stats incl. `missionComplete`) |
| `__du.SCENE` | Scene keys |
