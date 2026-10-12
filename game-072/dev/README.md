# RUNEBORE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-072/dev/simtest.mjs` | Headless. **Purity**: `js/sim/` and `js/rng.js` never touch the DOM or three.js and never call `Math.random`. **Worlds** (40 seeds): every relic, waystone, artifact and the wreck is in place and reachable from the surface without passing runestone, boulders or bedrock; the gate row and the four shards are intact. **Rules**: drilling down and sideways, ore and a full hold, auger hardness, fall damage and Featherfall, bogwind, boulders, magma and heat and the Salamander Scale, running dry and the crane's fee, selling, upgrades, repairs, every item, waystone travel, contracts, chapter flow, save/load. **Bot**: the autoplayer (`js/sim/bot.js`) plays the whole story, wyrm and ending included, on `SEEDS` seeds and prints the balance table. `ONLY=purity\|worlds\|rules\|bot`, `SEEDS=n`, `LIMIT=simSeconds`, `GOD=1`. About 30 s. |
| `node game-072/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **Desktop**: title and back link, New Delve with a typed name, the prologue by keyboard, driving, drilling, flying and boring with real keys, a blast rune, the Guild's license scene, selling, buying an upgrade and a rune, all five journal tabs, pause → Save & Quit → Continue, a waystone both ways, the Rune Gate, breaking a heart-shard by drilling it, the wyrm freed, the Wyrmheart, the ending choice, the epilogue cards and the ledger. **Phones** (touch only, real CDP touches) at 390×844 and 844×390: menus and dialogue by tap, the stick drills/flies/drives, a rune button, the Enter button opens a shop, a long shop scrolls with a finger, controls ≥ 44 px, no overlaps, no sideways scroll, the canvas fills the window. **Blocked storage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop\|phones\|nostorage`. A few minutes. |
| `node game-072/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet, screenshots to `dev/shots/name.png`. |

The browser scripts need a static server on port 8072 and Playwright:

```bash
python3 -m http.server 8072          # repo root
mkdir -p game-072/dev/node_modules && ln -s "$(npm root -g)/playwright" game-072/dev/node_modules/playwright
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a frame or two a second and the loop caps a frame at 0.05 s, so the tests open the game with `fast=4` (four times more simulation per frame) and wait on state rather than the clock.

## Debug hooks (`?debug=1`)

`window.__rb`: `G` (the game), `mode`, `view`, `ui`, `audio`, `newGame(seed, name)` (skips the title and prologue), `god()`, `money(n)`, `relic(i)`, `tp(col, row)`, `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `skipScenes()`, `enter()`, `use(item)`, `save()`. `&seed=N` fixes the world seed of a new delve; `&fast=K` runs K× more simulation per frame. Neither does anything without `debug=1`.
