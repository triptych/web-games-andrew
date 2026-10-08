# Haven Road — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-068/dev/simtest.mjs` | Headless tests of the pure simulation. **Purity:** `js/sim` never imports three, touches the DOM or calls `Math.random`. **Maps:** all twelve levels and 200 Open Road seeds have a clean road (no road tile touches another except its neighbours), long enough, from the west edge to the Haven gate; second roads join with a T; routes are continuous and end in the Haven; scenery stays on its tiles and blocks at most a fifth of the roadside; there's room to build; the same level always makes the same map. **Mechanics:** each ailment and each station does what the design says (wounds bleed and the Medic Tent closes them, blight spreads and the Remedy Lab clears it, the kitchen feeds and gives temporary health that soaks up harm first, cold rises in winter and the fire drives it out, splints mend and give a second wind, the Song Circle calms and builds courage); the dead catch only those they can keep up with; lanterns slow, flares stun, bells lure and the lured come back; collapse → revived by a medic or a stretcher crew, or lost (Hope −1, remembered); thriving arrivals join the roster and bring more supplies; volunteers deploy, cure the dead, who walk home and join; recalled volunteers rest first; a cured boss cures everything; a boss at the Haven ends the level; build, upgrade and pack-up rules. **Waves:** deterministic, sorted, everyone hurt somehow, no more than two troubles, only introduced ailments and dead, the newest dead not in the first wave, a boss in every boss level's last wave. **Letters:** built from the care given. **Balance:** the bot wins all twelve levels in a row (printing a table), doing nothing loses every level, each boss level is won with an empty roster, Open Road keeps going with no NaN. `ONLY=purity,maps,mechanics,waves,letters,balance`. |
| `node game-068/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader) with a real mouse and real CDP touches. Desktop: title → valley → briefing → level 1: build a Medic Tent by clicking a tile beside the road (it lands on that tile), a drag pans and builds nothing, key 2 and a click for a lantern, Space opens the gate, click a person (card), click a station (upgrade, pack up), speed / pause / sound by button and key, the pause menu, the bot plays out the level → results with stars and letters → Next road; progress survives a reload; level 4: the Volunteers tab, deploy a firefighter by clicking, the boss level played out and the boss cured; journal tabs and settings. Phones at 390×844 and 844×390: title, briefing and results fit, 44 px buttons, the back link is never covered, the canvas is exactly the visible viewport (sized in px, not `100vh`), the portrait camera turns the road up the screen, a tap builds on the tile under the finger, a one-finger drag pans and a pinch zooms without building, tapping a person opens their card on screen, no sideways scroll. Fails on any console error, page error or failed request. `ONLY=desktop\|phones`. Screenshots in `dev/shots/`. |
| `node game-068/dev/play.mjs "index.html?debug=1" script.js [w h]` | Opens the real game and runs a snippet: the body of an async function given `page, shot, wait, tt` (`tt('expr')` evaluates with `tt` = `window.__hr`). `TOUCH=1` for a touch phone, `LOG=1` echoes the console. |

The browser scripts need `playwright` and a static server on port 8068:

```bash
python3 -m http.server 8068          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-068/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws the game at a few frames a second, so the browser test runs on the lowest graphics tier (`?q=2`), fast-forwards with `__hr.step(n)` and lets the balance bot play levels out inside the page, and waits on the frame counter rather than wall time before turning tile coordinates into screen positions. It checks `document.elementFromPoint` is the canvas before clicking a tile, and zooms onto the tile if a panel covers it.

## Debug hooks (`?debug=1`)

`window.__hr`: `app` (mode, speed, paused, tool, selection, progress, settings, frameNo), `world` (the live simulation), `act` (every UI action), `stage` (camera rig, `toScreen`, `groundAt`), `terrain`, `actors`, `fx`, `UI`, `save`, `step(n)` (n simulation steps), `tileScreen(x, z)` (screen position of a tile's centre). Also `?fast=N` (simulation speed), `?q=0|1|2` (graphics tier) and `?level=N` (open that briefing).
