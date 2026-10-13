# CHROME CHALICE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-075/dev/simtest.mjs` | The simulation in Node, no browser. **purity** (`js/sim` never imports the view, touches the DOM or calls `Math.random`); **realms** (every realm builds, every room's doors are joined, the planner solves ARCADE and `SEEDS` REMIX shuffles); **rules** (carrying, swapping, dropping, gates, magnet, bridge, charge, grey pixel, bite, sword, bat, THE NULL, CHROMAGON's phases, the collapse, extra lives, winning); **bot** (a god-mode bot clears every realm in ARCADE and REMIX, then a whole campaign on one session); **balance** (a mortal bot on NOVICE and EXPERT, deaths and time per realm, printed as a table). `ONLY=purity,realms,rules,bot,balance`, `SEEDS=12`. The first three take seconds; bot and balance take several minutes. |
| `node game-075/dev/browsertest.mjs` | Real Chromium with SwiftShader WebGL. Desktop: the back link, the cabinet, the CRT, the attract pages and the demo, coin and START, GAME SELECT by keyboard, the intro, moving, picking up, slashing, dropping and dashing, pause, Options (CRT off and on), a realm clear and the tally, CONTINUE?, GAME OVER, name entry and the saved table. Every realm boots; the bot opens the Citadel, beats CHROMAGON and carries the Chrome Chalice home; the ending; loop 2. Touch-only phones at 390×844 and 844×390: the layout, no sideways scroll, the monitor on screen, controls ≥ 44 px and clear of it, taps through the menus, the joystick moves SQUIRE, C dashes, ❚❚ pauses. Blocked `localStorage`. Fails on any console error, page error or failed request. `ONLY=desktop,realms,phones,storage`. Screenshots in `dev/shots/`. |
| `node game-075/dev/play.mjs name "js after boot" [waitMs] [w h] [touch]` | Opens the real game with `?debug=1`, runs a snippet, screenshots to `dev/shots/name.png`. `Q='&fast=4'` adds URL parameters, `PROBE='js'` prints a value before the shot. |
| `node game-075/dev/mapdump.mjs [realm] [remixSeed]` | Prints a realm's tile map as text, with items, dragons and pickups marked. |
| `game-075/dev/sprites.html` + `node game-075/dev/shot.mjs game-075/dev/sprites.html out.png` | A sheet of every baked sprite at 5×, for checking the art without the game. |

The browser scripts need `playwright` and a static server on port 8075:

```bash
python3 -m http.server 8075          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-075/dev/node_modules
```

SwiftShader runs this game at roughly 12–15 fps once its shaders are compiled (the first page of a fresh browser is far slower, so the test waits a moment after boot). The game clock caps a frame at 50 ms, so game time runs slower than wall time there; the tests wait on state, not on the clock.

## Debug hooks (`?debug=1`)

`window.__cc`: `mode`, `pageName`, `world`, `session`, `credits`, `G` (the mode machine's state, including `G.seen`, a count of every sim event drained), `data` (the save), `R` (the renderer), `audio`, `start(realm, { skill, mode, remix })`, `god(on)`, `autoplay(on)` (the bot drives the real game), `page(n)` (attract page 0–5; 5 is the demo), `clearRealm()`, `kill()`, `ending()`, `set(key, value)` (a setting), `layout()`.

URL parameters: `&fast=N` runs N× the simulation per frame; `&persist=0..1` sets the CRT's phosphor persistence.
