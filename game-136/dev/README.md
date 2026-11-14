# Pinch & Place — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-136/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random`, the clock or base64. **catalog**: every kind and room is well formed. **rules**: crafting and clay, floor, rugs, things on top of surfaces, walls, the doorway, posts, turning, stowing (riders come too), squishing, undo, the shelf limit, unlocks and best ratings. **goals**: every goal type set up by hand, met and unmet (near, against, window, onrug, on, colours, walk, cosy). **determinism**: same seed → same room; a save round trip mid-room plays on identically; share links rebuild the same diorama and reject what doesn't fit. **bot**: the perfect bot earns three stars in every room on `SEEDS` seeds, a sloppy one earns fewer, nothing ever overlaps; prints the balance table. `ONLY=purity,catalog,rules,goals,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-136/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title → rooms → brief → building; the real mouse picks the gift bed off the shelf, puts it on a tile, selects it, R turns it; the Clay Bench makes a lamp and the lamp goal ticks; Escape/Space/Settings keyboard traps; Z undoes; ✓ rates; the ElevenLabs clips decode and a tune plays; photo mode (night, drag to turn, shutter, album, copy link); the link opens the same diorama in a new page; Save & Quit and a reload keep the stars. **phones** (touch only, real CDP touches) at 390×844 and 844×390: menus by tap, tap-to-pick, tap-to-move-ghost, tap-again-to-place, 44 px controls, no sideways scroll, photo mode and shutter by touch. **nostorage**: plays and rates with `localStorage` throwing; the album says it can't save. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-136/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `HASH='#d=…'` opens a share link. |
| `node game-136/dev/shot.mjs gallery.html gallery [w h]` | Screenshots a dev page once it sets `window.READY`. |
| `dev/gallery.html` | Every kind × shape on a neutral background (`?size=0\|1\|2`, `&kind=bed,sofa`). Judge the clay models here, not under coloured lamps. |
| `dev/preview.mjs` | The Garden's 1200×630 preview: a decorated room at golden hour, photographed through the game's own photo pipeline. |
| `dev/art/`, `dev/audio/` | How the fal art and the ElevenLabs sound were made, and the scripts that rebuild them. |

The browser scripts need `playwright` and a static server on port 8136:

```bash
python3 -m http.server 8136          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-136/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second, so the tests wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__pp`: `G` (the player's game), `viewG` (what the view shows: the title demo, the room, a visited diorama), `mode` (`title`, `build`, `photo`, `visit`), `placing`, `selected`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `evaluate()`, `start(roomId)` (opens a room with every room unlocked, skipping the menus), `act(cmd)`, `autoplay(on)` (the bot plays one command every 0.25 s), `ff()` (the bot decorates the room at once, stopping short of finishing), `finish()`, `enterPhoto(from)`, `exitPhoto()`, `takePhoto()`, `openBench()`, `startPlacing(id)`, `commitPlacing()`, `save()`, `hasSave()`, `shareURL()`, `lastLink`, `photo` (the photo-mode settings), `icons`.
