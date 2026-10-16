# ROMANCER — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-084/dev/simtest.mjs` | Headless, in Node. **purity**: the runtime parts and `js/meta/` never touch the DOM, storage, `Math.random` or the clock. **export**: every runtime part is self-contained — rebuilt from `fn.toString()` in a fresh `vm` realm it plays RALLY to a win and draws it; no `</script` or line separators in any part; `exportHTML` escapes a hostile title and script and `importCart` reads the cart back from the HTML or a `.vesta.json`. **lang**: VESTA SCRIPT arithmetic, precedence, strings, loops, recursion, scoping, and errors with line numbers (unclosed blocks, unknown events and functions, the runaway-loop and recursion guards, nil fields). **rules**: platform jump height, one-way platforms, ladders, bounce and `on bump`, every edge rule, grid hops, maze turns, corner nudge, patrol ledges, hit/enter/hazard/die/spawn, solid objects, levels, restart, win/lose, the camera, drawing. **determinism**: same seed and inputs, same game; cloned runs are independent. **missions**: every cartridge as found compiles and is broken, no task fires on a blank cart, each repair fixes its task, and the bot completes and wins the repaired cart on `SEEDS` seeds (prints the table). **progress**: unlock order, completion, commendations, the Studio, the save round trip and a damaged save. `ONLY=purity,export,lang,rules,determinism,missions,progress`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-084/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the title and back link; New Expedition and a name; the prologue read with real Enter presses; the workbench; drawing the ball with a real mouse drag; the inspector; locked tabs; Play with real keys on the television; restoring RALLY, VESTA's memory and the unlocks; typing a script in CODE, a typo shown on its line; every tab; **Export** downloads an HTML file that then plays on its own from `file://` with the network blocked; the Studio; reload and Continue; Space pressing a focused button. **phones** (touch only, real CDP touches) at 390×844 and 844×390: the title, the logbook, the dialogue, the dock, a finger drawing, Play with the touch pad, holding ▼ moves the paddle, ≥ 44 px controls, no sideways scroll, the canvas matching the visible viewport. **nostorage**: plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-084/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port 8084:

```bash
python3 -m http.server 8084          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-084/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a frame or two a second here, so the tests open the game with `&fast=4`, wait on state rather than the clock, and send menu keys one at a time (menus take one press per frame). Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__rm`: `P` (progress), `mode` (title, lab, bench, play), `run` (the running cart), `bench`, `playCtx`, `seen` (a count of every console event drained), `view`, `ui`, `audio`, `input`, `V` (the runtime), `MISSIONS`; `start(name)` (a new expedition with the prologue skipped), `insert(id)` (put a cartridge on the bench, briefing skipped), `endScene()`, `repairAll(id)` (VESTA repairs every task), `tasks(id)`, `play()`, `stop()`, `autoplay(on)` (the cartridge's bot plays the real game), `ff(seconds)` (run the console ahead with the bot), `exportHTML()`, `features()`, `save()`, `hasSave()`. `&fast=N` runs N× console frames per frame; `&quality=0|1|2` overrides the graphics setting.
