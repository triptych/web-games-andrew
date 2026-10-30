# Doom & Doilies — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-110/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js`, `js/config.js`, `js/fmt.js` and `js/news.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **layout**: minion slots stay clear of a kitchen counter and hearth, fit in every room, and are the same every time. **rules**: crafting and flow, minion prices and Max, upgrades (every one reachable and buyable), dread and its four tiers, cackling, all four visitors, the three abilities, décor, henchmen, schemes, heirlooms (all twelve findable), mastery, trophies, relocation and perks, the ticker and number formatting. **away**: time away at the offline rate, the cap, upgrades that raise both, schemes finishing while away, a day in under a second. **determinism**: same seed and commands → same game; a save round trip plays on identically; an unknown version is rejected; an old save missing fields loads. **bot**: an attentive, a casual and an idle bot each play `HOURS` hours with per-step invariants and print the balance table. `ONLY=purity,layout,rules,away,determinism,bot`, `HOURS=n` (default 8), `VERBOSE=1`. |
| `node game-110/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title, back link and a title that fits; real mouse clicks on the castle craft; Space crafts; a panel row buys, and Space afterwards still crafts; C and the Cackle button cackle; a visitor greeted by a click on the sprite and another through the callout; every tab; an upgrade bought by two taps on its tile; décor appears in the castle; a henchman hired and sent on a scheme; Q/E, room buttons, Tab for the whole castle and a click on a room there; the menu (the castle keeps working behind it); Save & Quit → Continue; relocating through the Lair tab's confirm sheet, and the view moving house. **furniture**: seven of every minion and every piece of décor at once, and no minion sprite intersects furniture, décor or a window (`__dd.view.clipReport()`); the visitors' lane goes through doorways, never walls or furniture (`__dd.view.laneReport()`); a Ballroom visitor stays in the Ballroom and passes the doorway only with the portcullis up. **away**: a fresh page whose save is two hours old shows the welcome-back sheet. **phones** (touch only, real touches) at 390×844 and 844×390: taps craft and buy, the Cackle button, every control ≥ 44 px and on screen, abilities, rooms, HUD and panel don't overlap, the visitor callout, the menu stays open after the finger lifts. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,furniture,away,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-110/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `game-110/dev/sprites.html` | Every sprite (the Overlord's twelve pose/tool frames, the minions, visitors, henchman and the sixteen centrepieces) at 4× on a neutral grey, for judging the art before it goes under candlelight and bloom. Open it through the static server. |
| `node game-110/dev/preview.mjs` | Sets up a busy Ballroom through the debug hooks and writes `garden/img/games/game-110.jpg`, the 1200×630 preview for the launcher. |

The browser scripts need `playwright` and a static server on port 8110:

```bash
python3 -m http.server 8110          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-110/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.1 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__dd`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `send(cmd, cb)` (queue a command like any button), `start(seed)` (skips the title), `autoplay(on, opts)` (the bot plays the real game), `ff(seconds, opts)` (run the sim ahead with the bot), `give(charm, gold)`, `rates()`, `view.clipReport()` (minions intersecting furniture) and `view.settled()` (everything has popped in), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
