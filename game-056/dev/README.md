# Keepfire — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-056/dev/simtest.mjs` | Headless checks on the real simulation: `js/sim/` never imports three.js, touches the DOM or calls `Math.random`; species, waves (1–75) and relics generate cleanly for many seeds; every tick's invariants (finite numbers, monsters in bounds, HP ≤ max, gold ≥ 0, Keepfire 0–100); same seed and actions → same run; save round-trip; card, castle, powerup and Keepfire actions; every region boss uses its abilities and can be killed; rekindle and Ember maths; and a bot campaign through all 60 waves with retries. `SEEDS=5` for more campaign seeds, `WAVES=30` for a shorter one. |
| `BALANCE=1 node game-056/dev/simtest.mjs` | Adds the per-wave balance table: clears, losses, lowest wall left, gold, units lost, forge level and average party level. |
| `node game-056/dev/browsertest.mjs` | Real Chromium + WebGL: title with its attract demo → New Defence → region card → place an archer by clicking → Sound the Horn → tap an orb and an ember → use the powerup → level a unit → buy a tower (the Keep pauses the wave) → clear → relic → save, reload, Continue → a boss in regions I, III and VI → lose and retry → Ember Tree and Rekindle → bestiary, settings, help; then all six biomes; then touch-only phones at 390×844 and 844×390 (tap targets ≥ 44px, HUD on screen, tap to place, collect, open the Keep and a unit, pick a relic). Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. Needs `playwright` and a static server (`python3 -m http.server 8056` from the repo root). `ONLY=desktop|regions|phones` runs one part. |

No network to unpkg.com? Fetch three.js once and point the browser test at it —
CDN requests are then served from disk, still the genuine r165:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
THREE_PKG=$PWD/package node game-056/dev/browsertest.mjs
```

Software WebGL (SwiftShader) renders this game at a few frames per second, so
the browser test steps the simulation through a debug hook and waits on game
state rather than wall-clock time.

## Debug hooks

Load the game with `?debug=1` to get `window.__kf`:

| Hook | Effect |
|---|---|
| `__kf.world` / `__kf.attract` / `__kf.mode` | The live run, the title-screen demo world, `'title'` or `'game'` |
| `__kf.advance(sec)` | Step the simulation synchronously (events flow to the view, sound and HUD as usual) |
| `__kf.toWave(n)` | Start a fresh defence at wave `n` with gold to match |
| `__kf.gold(n)` / `__kf.god(on)` / `__kf.killAll()` | Add gold, make the wall unbreakable, kill everything on the field |
| `__kf.orb('power' \| 'mote', x, lane)` | Drop a powerup orb or an ember mote |
| `__kf.cellScreen(lane, col)` / `__kf.wallScreen(lane, tier)` | Screen position of a field square or a tower platform |
| `__kf.skipModals()` / `__kf.startWave()` / `__kf.newGame()` | Flow shortcuts |
| `__kf.state()` | The persistent meta save (Embers, Ember Tree, settings, bestiary) |

`?debug=1` also turns off the automatic quality downgrade.

## Balance notes

The campaign is tuned against the bot in `js/sim/bot.js`, which builds the way
a reasonable player would (an alchemist economy, a blocker at the front of
each lane, a varied mix of shooters on the towers, upgrades and the forge with
what's left) and keeps all the gold from a failed attempt, like a player who
retries. With two seeds it clears the early regions comfortably, takes a
retry or two at the first boss and in Mirefen and Ashen Pass, cruises
through IV–V, and needs many attempts at Vael. That is the intended shape:
the final dragon is where Rekindling starts to pay.
