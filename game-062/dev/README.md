# Kraken's Gambit — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-062/dev/simtest.mjs` | 1. **Purity**: `js/sim/` never imports three.js, touches the DOM, calls `Math.random` or reads the clock. 2. **Perft** on five standard positions (start to depth 4, Kiwipete to depth 3, and three positions full of promotions, en passant and castling traps), so the move generator is exact. 3. **AI**: finds mate in one at every searching level, only returns legal moves, and the First Mate beats the Cabin Boy. 4. **Sea events**: 250 random games in a Tempest (every third game forces each event type in turn). After every ply: both kings present, no pawn on rank 1 or 8, the side that just moved not in check, 16 pieces per side between the board and Davy Jones' Locker, and `applyRecord()` (what the 3D view uses to move its ships) replayed onto a mirror of piece ids reproduces the board square for square. 5. Every event type happens, and no event ever ends a game by itself. 6. **Determinism, undo, save/load**: same seed, same game; undo restores the exact FEN, log and captures; a JSON round trip mid-game plays on identically. `GAMES=1000` for a longer soak. |
| `node game-062/dev/browsertest.mjs` | Real Chromium + WebGL + the genuine three.js r165. **Desktop**: title, How to Play (12 rendered ship thumbnails, 8 events), setup, e2-e4 by real mouse clicks on the ship and the water, the computer's reply, then all eight sea events forced one after another and played by real clicks (each must happen, and the 3D fleet must match the simulation afterwards), undo, hint, labels, promotion through the picker, a back-rank mate and the game-over dialog, a two-captain game where the board turns to face the side to move, then reload and Continue Voyage. **Phones** (touch only, 390×844 and 844×390): a game by taps, toolbar buttons finger-sized and on screen, the log drawer, no sideways scroll, every tap point checked with `elementFromPoint` so nothing covers the board. Fails on any console error, page error or failed request. `ONLY=desktop` / `ONLY=phones`; `NOSTORAGE=1` makes `localStorage` throw. Screenshots in `dev/shots/`. |
| `node game-062/dev/probe.mjs [WxH] [name]` | One screenshot, for iterating on visuals. `EVAL='js'` runs an (awaited) expression first, e.g. `EVAL="__kg.start({sea:'tempest'})"`. |

The browser scripts need `playwright` (symlink it in: ESM ignores `NODE_PATH`) and a static server from the repo root:

```bash
mkdir -p game-062/dev/node_modules && ln -s "$(npm root -g)/playwright" game-062/dev/node_modules/playwright
python3 -m http.server 8062
```

No network to unpkg.com? Fetch three.js once and the scripts serve the CDN requests from disk (still the genuine r165):

```bash
cd game-062/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
```

Software WebGL (SwiftShader) runs at a few frames per second, so the browser test waits on game state (`__kg.state()`), not on the clock. In `?debug=1` the frame-time cap is 200 ms, so animations finish in reasonable wall time.

## Debug hooks

Load with `?debug=1` for `window.__kg`:
`state()` (screen, busy, turn, ply, FEN, result, events, last event, view side, whether the 3D fleet matches the sim, desync count),
`start(opts)`, `startFen(fen)`, `move('e2e4')`, `force('kraken')` (the next move's event),
`screenOf('e4')` / `pieceScreen('e4')` (client coordinates for real clicks), `speed(n)` (animation speed),
`brightness()`, `match()`.
