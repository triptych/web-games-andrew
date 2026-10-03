# Pale Engine — dev harnesses

Plain Node scripts, no build step, no test framework.

| Command (from the repo root) | What it does |
|---|---|
| `node game-054/dev/simtest.mjs` | Headless, no browser. Checks that `gen.js`, `world.js`, `bestiary.js` and `rng.js` never import three.js, touch the DOM or call `Math.random`. Generates all ten campaign levels on `SEEDS` seeds (default 6) at two difficulties and Endless Descent floors 1..`FLOORS` (default 20); each must pass the generator's own validation (exit, keys, pickups and terminals reachable in key order), nothing solid may stand in front of a switch or terminal, and then **a bot walks it with the real collision code** (`World.move`, the player's box, step height, headroom, doors that open and close): start → each key in order → the exit. A stall of 4 simulated seconds fails the level. Ends with a determinism check. Takes about a second. |
| `node game-054/dev/browsertest.mjs` | Real Chromium + WebGL + three.js r165. Desktop: title (the attract demo must render), How to Play, Options (the FOV slider), Codex, New Campaign → difficulty → briefing → level card → play; walking with real key presses, weapon keys, firing, the automap, pause/resume, a data terminal, a pickup, the exit switch and intermission, save + reload + Continue, death + Try again, a guardian sealing and then opening the exit, every theme rendering, the final boss and the ending, Endless Descent. Phones (touch only, real CDP touches) at 390×844 and 844×390: menus by tap, every control ≥ 44 px, on screen and clear of the HUD, the move stick walks, dragging looks, FIRE shoots, the pause button pauses. Fails on any console error, page error or failed request. Screenshots go to `dev/shots/`. Needs `playwright` and a static server (`python3 -m http.server 8054` from the repo root). `ONLY=desktop` or `ONLY=phones` runs half. |
| `node game-054/dev/smoke.mjs` | Quick look: title, level card and four gameplay screenshots. `LV=n` picks the campaign level (0-based). |
| `node game-054/dev/gallery.mjs` | Every archetype, guardian and the pylon lined up in a big room for screenshots. `LV=9` uses the Archon's arena. |
| `node game-054/dev/combat.mjs` | God mode, all weapons, a pack of monsters per weapon; screenshots mid-fight and the ammo/kill counts. |
| `node game-054/dev/vmshots.mjs` | One screenshot per first-person weapon. |
- `tour.mjs` — screenshots of level features (doors, key doors, pits, stairs, sky) per theme; `LVS=1,4,7` picks levels.
| `node game-054/dev/sheet.mjs out.png cols a.png b.png …` | Tiles screenshots into one image. |

No network to unpkg.com? Fetch three.js once and the browser scripts serve the
CDN requests from disk — still the genuine r165:

```bash
cd game-054/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
```

A globally installed `playwright` isn't found by ESM `import` even with
`NODE_PATH`; symlink it into `dev/node_modules/` (ignored by git):

```bash
mkdir -p game-054/dev/node_modules && ln -s "$(npm root -g)/playwright" game-054/dev/node_modules/playwright
```

Software WebGL (SwiftShader) renders at a few frames per second, so the
browser test waits on game state rather than wall-clock time, and `?debug=1`
raises the frame-time cap so game time keeps up.

## Debug hooks

Load the game with `?debug=1` to get `window.__pe` (it also lets you fire and
pause without Pointer Lock, and disables the automatic quality downgrade):

| Hook | Effect |
|---|---|
| `__pe.S` / `__pe.game` / `__pe.player` / `__pe.weapons` | The live session, the state machine, the player, the arsenal |
| `__pe.start(diff, level, mode)` | Start a run (`diff` 0–3, `level` 0-based, `mode` `'campaign'`/`'descent'`); then `__pe.begin()` once `game.cardReady` |
| `__pe.god(on)` | The player takes no damage |
| `__pe.giveAll()` | Every weapon, full ammo, every key |
| `__pe.killAll()` / `__pe.killBoss()` | Clear the level / fell the guardian |
| `__pe.toExit()` / `__pe.finish()` | Stand at the exit switch / complete the level |
| `__pe.spawn(arch, dist)` | Spawn an awake monster in front of you |
| `__pe.lookAt(x, z)` | Turn to face a world point |
| `__pe.brightness()` | Render a frame and return its mean brightness |
| `__pe.quality(q)` | Force a quality tier (0 high, 1 medium, 2 low) |
