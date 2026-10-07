# Tootle Isles — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-067/dev/simtest.mjs` | Headless tests of the pure simulation. **Purity:** `js/sim` never imports three, touches the DOM or calls `Math.random`. **Geometry:** every traversal starts and ends on the right tile edges, has the right length and a forward unit tangent. **Track:** straights, curves, crossings and switches from drawn paths; loops drawn from a corner close cleanly; branching off a straight; ends turning to meet a new line; strokes that rewind (and put back the trees they cleared); buildings stop track; stations only on straights and sharing names; no erasing under a train; bridges survive water. **Islands:** every preset on four seeds has land, a beach, a water border, a closed starter loop with a station, a running train and residents; blank islands have no track. **Trains:** two trains on a loop never share a tile; dead ends shuttle; nose-to-nose trains back off without deadlock; stations stop trains; switches route; too-short track is refused; reversing keeps the train where it is. **People:** residents spawn, never walk on water or hills, board and leave trains within capacity, and leave with their homes. **Save:** JSON round trip, trains keep running after load, junk is rejected, undo snapshots restore exactly. **Soak:** every preset with extra trains for ten simulated minutes, with no NaN and no overlap. `ONLY=purity,geometry,track,islands,trains,people,save,soak`. |
| `node game-067/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader) with real mouse input and real CDP touches. Desktop: title → New Island (Big Baseplate, no starter town) → help → drag a closed loop → a branch (switch) and a crossing → tap to flip the points → two platforms → put a train on → every train-card button → it runs and stops at the station, people ride → build (and turn) houses by clicking, a drag in Build moves the camera and places nothing, a windmill, a boat refused on land → paint water under the track (bridge) and a hill on it (tunnel), brush sizes → bulldoze, undo, redo, Ctrl+Z → the workshop saves a new train with a thumbnail, and it goes on the track → time of day → stickers → save, reload, Keep Playing restores the island → My Islands: copy, rename, share code, import → settings → back to the title. Phones at 390×844 and 844×390: title and island picker fit, finger-sized buttons, nothing covers the back link, tapping a train opens its card on screen, a one-finger drag lays track, a two-finger pinch zooms without laying track, the canvas is exactly the visible viewport (sized in px, not `100vh`), a tap builds on the tile under the finger, a drag in Build moves the camera and places nothing, the trays and workshop fit, no sideways scroll. Fails on any console error, page error or failed request. `ONLY=desktop\|phones`. Screenshots in `dev/shots/`. |
| `node game-067/dev/play.mjs "index.html?debug=1" script.js [w h]` | Opens the real game and runs a snippet: the body of an async function given `page, shot, wait, tt` (`tt('expr')` evaluates with `tt` = `window.__tt`). `TOUCH=1` for a touch phone, `LOG=1` echoes the console. |
| `node game-067/dev/shoot.mjs "dev/gallery.html" name [w h]` | Full-page screenshot of any page. `dev/gallery.html` renders every item, engine and car (`?only=tree` to filter). |

The browser scripts need `playwright` and a static server on port 8067:

```bash
python3 -m http.server 8067          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-067/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws this game at a few frames a second, so the browser test runs at `?fast=3` (three simulation steps per frame) on the lowest graphics tier, fast-forwards the simulation with `tt.step(n)` where it needs trains to have gone somewhere, and waits on the frame counter rather than wall time. Opening a tray shifts the view up, so the test waits a couple of frames before turning tile coordinates into screen positions, and recentres the camera on a tile if the tray covers it.

## Debug hooks (`?debug=1`)

`window.__tt`: `app`, `act` (every UI action), `world`, `rig` (camera goals `gx gz gyaw gpitch gdist`), `tod` (time of day), `ui`, `save`, `scene`, `renderer`, `camera`, `handler` (the input handler), `tileScreen(x, z)` (screen position of a tile), `step(n)` (n simulation steps). Also `?fast=N` (simulation speed) and `?q=0|1|2` (graphics tier).
