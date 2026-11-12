# HOLLOWDEEP — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-129/dev/simtest.mjs` | Headless, in Node (about a minute). **purity**: `js/sim/`, `js/rng.js`, `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every monster sprite, portrait, texture, backdrop, icon atlas, music track, effect and voice line exists; the voiced townsfolk lines match the town text; story quests reference real NPCs, floors and items. **floors**: floors 1–45 over 60 seeds (2,700 floors): stairs, chests, quest spot and fountain reachable; every guardian is the only way to the stairs (sufficient *and* necessary). **rules**: town (shop, gear, hiring, inn, stables, temple), walking, stairs, encounters, battles (commands, back, rows, holy vs undead, flee, poison, wins, levels, wipes), guardians and warps, chests, quests (story, hunt, fetch, rescue), the hunting reaper. **determinism**: same seed and commands → same game; save round trips (also mid-battle) play on identically. **bot**: a careful and a reckless bot each play `SEEDS` games of `STEPS` commands with per-command invariants; balance bands. `ONLY=purity,data,floors,rules,determinism,bot`, `SEEDS=n`, `STEPS=n`, `VERBOSE=1`. |
| `node game-129/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title, New Game, narration subtitles, guild hire, shop, gate quest and entry, the dungeon picture is not blank, the minimap draws, real keys turn and walk and the camera follows, a battle by number keys (sprites load and sit on screen), Auto, ElevenLabs effects/voices decode and a music track plays and sound reaches the master bus, camp and map with keys, Enter on the stairs to town, Save & Quit → Continue. **phones** (touch only, real touches) at 390×844 and 844×390: taps through town and gate, the walking pad (≥ 44 px) walks and turns, the pad hides in battle, tap a command and then a monster, Auto by tap. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-129/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-129/dev/preview.mjs` | The 1200×630 Garden preview (`garden/img/games/game-129.jpg`): a guardian fight in the corridor. |
| `node game-129/dev/art/prompts.mjs [names]` | Prints the fal requests, built from the game's data tables. See [art/README.md](art/README.md). |
| `python3 -I game-129/dev/art/export.py RAW` | Raw fal renders → `art/`. |
| `node game-129/dev/models.mjs [id]` | Screenshots `dev/modelview.html`: every Meshy prop fitted the way the game fits it (front, side, above, the edge of its cell) → `dev/shots/models.png`. See [art/README.md](art/README.md#models-meshy). |
| `python3 -I game-129/dev/audio/process.py RAW` | Raw ElevenLabs downloads → `audio/`. See [audio/README.md](audio/README.md). |

The browser scripts need `playwright` and a static server on port 8129:

```bash
python3 -m http.server 8129          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-129/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root);
the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second, so the tests open the game with `&fast=4` and wait on state, never on the
clock. Passing tests don't mean the screen looks right: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__hd`: `G`, `mode`, `stack` (open screens), `seen` (a count of every sim event), `view`, `battle`, `town`,
`camp`, `audio`, `hud`, `send(cmd)`, `start(seed)` (skips the title), `ff(n, botOpts)` (the bot plays n commands),
`autoplay(on)`, `fight(kind)` (start a `random`, `boss` or `reaper` fight here), `faceOpen()` (look down the longest
corridor), `idle` (no events pending, nothing animating), `saveNow()`, `hasSave()`, `serialize()`.
`&fast=N` speeds battle playback and walking; it does nothing without `debug=1`.
