# PINBREAK '86 — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-045/dev/simtest.mjs` | Bot plays 12 seeded games headlessly; checks for NaN, balls leaving the table, balls inside bricks/bumpers, trapped balls; enforces that `js/sim/` never imports three.js, touches the DOM or calls `Math.random`. `SEEDS=40 MINUTES=10` for a longer soak. |
| `node game-045/dev/browsertest.mjs` | Real Chromium + WebGL: title/attract → start → plunge → play → explosive chain → power-ups → wave clear → pause → game over, then touch play at 390×844 and 844×390. Screenshots go to `dev/shots/`. Needs `playwright` and a static server (`python3 -m http.server 8045` from the repo root). |

No network to unpkg.com? Fetch three.js once and point the browser test at it —
CDN requests are then served from disk, still the genuine r165:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
THREE_PKG=$PWD/package node game-045/dev/browsertest.mjs
```

## Debug hooks

Load the game with `?debug=1` to get `window.__pb`:

| Hook | Effect |
|---|---|
| `__pb.world` / `__pb.mode` | Live simulation world and current mode |
| `__pb.start()` | Start a game |
| `__pb.power('fire', 8)` | Activate a power-up (`fire`, `laser`, `shield`, `wide`, `x2`) for N seconds |
| `__pb.blastAt(x, y)` | Detonate an explosion at a table position |
| `__pb.clearBricks()` | Destroy the whole wall (triggers WAVE CLEAR) |

`?debug=1` also disables the automatic quality downgrade, so a slow software
renderer in CI doesn't change what the screenshots show.
