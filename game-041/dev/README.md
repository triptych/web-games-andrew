# BURROWGUARD — dev harnesses

Plain Node scripts, no build step and no test framework. Run from `game-041/`.

| Command | What it does |
|---|---|
| `node dev/simtest.mjs` | 138 assertions against the **real** simulation: atlas completeness, 200 generated boards (both spawns reach the core, 4 gems, seated boulders, room to build), digging and ore, walkers never entering dirt, a dug shortcut shortening their route, towers/upgrade/sell, four pumps popping a grub, gems and eating, the King ignoring gems, boulder crushes, stalker ghosting, borer drilling, drake fire, a full round to round 2, wave specs, determinism, and sim cost (~0.5ms p95 per step with 49 towers and 40 enemies) |
| `node dev/balance.mjs` | Two bots with an invincible miner measure the tower defence on its own. A perfect-placement "blasters" bot that never digs reaches round 2–3; a bot that wanders and digs dies sooner because it opens shortcuts — the game's central tension, measured |
| `node dev/mobiletest.mjs` | An emulated phone (touch, `isMobile`, dpr 3) driven **only** by CDP touch input: tap to start, relative stick walks and stops the miner, tray → build → tap dirt, select → SELL, two-finger PUMP, pause → RESUME; every control ≥44 css px, on screen, and not overlapping any other control, the field or the launcher link. `LANDSCAPE=1` for 844×390 |
| `node dev/shots.mjs` | Real Chromium + WebGL screenshots (title, play, fright, pump/fire, game over) at 390×844, 844×390 and 1280×800 into `dev/shots/` (git-ignored); fails on any console error |

The browser scripts need Playwright and a static server for the **repo root**:

```bash
python3 -m http.server 8041      # from the repo root; BASE defaults to http://127.0.0.1:8041
```

Both browser scripts pin FX to HIGH via `localStorage` first: software GL in a sandbox runs at
~12fps, which trips the game's automatic drop to LOW, which changes the device-pixel ratio and
the layout in the middle of a test.

## Bugs these caught

- **52 of 200 boards were unwinnable-by-design**: each corridor's down-shaft was placed at a fresh random column instead of where the corridor above ended, so sometimes it missed it and the spawns had no route to the core.
- The shader program was stored as `this.sprite`, overwriting the `sprite()` method — every draw threw.
- A 100% round-end tower refund let a do-nothing blaster bot reach round 8; salvage is 70% now and enemy HP grows faster.
- The miner spawned facing "down", so he was drawn lying on his side.
