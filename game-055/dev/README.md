# Rotorstorm — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-055/dev/simtest.mjs` | Headless, no browser. Checks that `js/sim/` never touches the DOM or WebGL, never calls `Math.random` and never imports the view. Checks every biome has enough land. Plays every operation on `SEEDS` seeds (default 2) with the loadout a player would plausibly own by then (`typicalOwned`). A **god-mode bot** must reach and kill the boss with no phase hitting the 75 s safety limit, and at least six survivors must be placed. A **mortal dodging bot** (`js/bot.js`) reports hits, EMPs and grazes, which is the balance table. Then runs endless mode until the biome swaps and the next sector's boss arrives, and finishes with a determinism check. `DIFF=recruit\|pilot\|ace`, `OPS=0,3,5`. About 15 s. |
| `node game-055/dev/browsertest.mjs` | Real Chromium with WebGL2 (SwiftShader). **Desktop:** the title's attract demo renders; How to Play; Options (a slider saves); New Campaign → prologue → briefing → difficulty → Launch; flying with real key presses, focus, EMP and pause; the GPU-baked terrain agrees with the CPU's land/water/lava at random points; a boss killed through every phase → debrief and rank → hangar buy and refund; failing, Retry operation, Retry from the boss; Stormfront; the finale → epilogue → title. **Phones** (touch only, real CDP touches) at 390×844 and 844×390: menus by tap, a long briefing scrolled with a finger, touch controls ≥ 44 px and on screen, a drag flies the Kestrel, EMP / FOCUS / pause buttons, the hangar. Fails on any console error, page error or failed request. `ONLY=desktop\|phones`, `SEED=n`. |
| `node game-055/dev/smoke.mjs` | Quick look: title, two gameplay screenshots and the boss. `OP=0..5`, `W=` `H=` for the viewport. |
| `node game-055/dev/combat.mjs` | A fully upgraded Kestrel against a pack of gunships and tanks, with close-up frames of explosions, wrecks, tracers and the EMP. `OP=0..5`. |

Screenshots go to `dev/shots/` (ignored by git). Every browser script needs a static server from the
repo root (`python3 -m http.server 8055`) and `playwright`. A globally installed Playwright isn't
found by ESM `import`, so symlink it:

```bash
mkdir -p game-055/dev/node_modules && ln -s "$(npm root -g)/playwright" game-055/dev/node_modules/playwright
```

**Debug URL:** `index.html?debug=1&seed=N&fast=K` exposes `window.__rs` (`startOp(i)`, `god()`,
`skipToBoss()`, `nextPhase()`, `die()`, `endless()`, `giveSalvage(n)`, `terrainProbe()`, `layout()`)
and pins the mission seed. SwiftShader draws one or two frames a second, so `fast=K` runs K times
more simulation per frame: the browser tests use 8. Neither parameter does anything without
`debug=1`.
