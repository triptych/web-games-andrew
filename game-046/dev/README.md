# Quiverspire — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-046/dev/simtest.mjs` | The bot plays every chapter headlessly (3 seeds each, maxed talents so it sees late rooms) plus an Endless run. Every tick checks: no NaN, player and enemies inside the room, nobody standing on rock or in a pit, every card offer valid. Runs must end; no room may last 4 minutes. Also checks determinism (same seed → same run) and that `js/sim/` never imports three.js, touches the DOM or calls `Math.random`. `SEEDS=10` for more. |
| `BALANCE=1 node game-046/dev/simtest.mjs` | Adds a table of the bot's chapter clear rate (and average stage reached) at talent levels 0, 3, 6 and 10. `N=20` for more runs per cell. |
| `node game-046/dev/browsertest.mjs` | Real Chromium + WebGL: title/attract → talents → PLAY → blessing → walk & shoot → pause → door → angel → boss → results → all ten biomes → touch-only play at 390×844 and 844×390 (tap targets ≥ 44px, floating joystick). Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. Needs `playwright` and a static server (`python3 -m http.server 8046` from the repo root). |

No network to unpkg.com? Fetch three.js once and point the browser test at it —
CDN requests are then served from disk, still the genuine r165:

```bash
npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
THREE_PKG=$PWD/package node game-046/dev/browsertest.mjs
```

Software WebGL (SwiftShader) renders this game at a few frames per second, so
the browser test waits on game state rather than wall-clock time.

## Debug hooks

Load the game with `?debug=1` to get `window.__qs`:

| Hook | Effect |
|---|---|
| `__qs.world` / `__qs.mode` / `__qs.attract` | Live simulation, UI mode, whether the bot is driving |
| `__qs.start(chapter, endless)` | Start a run |
| `__qs.killAll()` | Kill every enemy in the room (drops loot) |
| `__qs.god(on)` | Make the player invulnerable |
| `__qs.toStage(i)` | Jump to stage index `i` (0–11) of the chapter |
| `__qs.state` | Persistent save (coins, talents, unlocks) |
| `__qs.brightness()` | Mean brightness of a freshly rendered frame |

`?debug=1` also disables the automatic quality downgrade.
