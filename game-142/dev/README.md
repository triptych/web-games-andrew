# Kaboom Keep — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-142/dev/simtest.mjs` | Headless, in Node (about a minute). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **physics**: a 12-slab column and a running-bond wall stand awake; a 34 m/s ball can't tunnel through a wall; a ball grazing a block's corner never freezes; the world is deterministic. **rules**: aiming and its limits, firing and reloading, picking balls, the predicted arc lands where the ball lands, every kind of bonk, breaking, ice, dust, knocked blocks, crate chains, the Boom Ball and its trick, Triple Trouble's split, winning and losing. **castles**: all 48 campaign castles and the first `ENDLESS` (10) Endless castles stand on their own with every block awake for 4 s and start under 560 bodies; flags stand on blocks; racks and star lines are sane. **determinism**: same seed and inputs → same game; a save taken mid-collapse plays on identically; an unknown save version is rejected. **bot**: the perfect bot clears all 48 castles, earns two stars on at least 85% and three on at most 60%, and clears the first 8 castles of an Endless run; a skill-0.5 bot clears at least 70%; per-step invariants (finite numbers, a body cap); prints the balance table. `ONLY=purity,physics,rules,castles,determinism,bot`, `SEEDS=n` (sloppy-bot seeds per castle, default 1), `ENDLESS=n`, `VERBOSE=1`. Takes several minutes. |
| `node game-142/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, the map (castle 1 open, 2 locked), the intro card, play; real arrow keys aim, Space fires, a mouse drag aims and a click fires; all 33 clips decode and the music plays; Escape pauses and the sim stops; Settings opens on top and Escape closes it with a slider focused; Space presses the focused Resume; Save & Quit → Continue restores the castle; the bot clears it → results with stars → castle 2 opens → Next Castle → Back lands on the title (v1.0.0 left no menu); keys 2 and Q pick balls; the map shows 48 castles in four regions and a locked Endless Siege; an Endless castle is cleared and Next Siege Castle carries the run total on. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through map and intro, FIRE, ❚❚ and the rack are ≥ 44 px and on screen, a drag aims without firing, a tap fires, FIRE fires, the pause screen survives the finger lifting. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-142/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-142/dev/preview.mjs` | The 1200×630 preview for the Garden and share links: castle 2 mid-explosion. Writes `garden/img/games/game-142.jpg`. |
| `python3 -I game-142/dev/art/export.py RAW` | Rebuilds `art/` from the fal originals ([art/README.md](art/README.md)). |
| `python3 -I game-142/dev/audio/process.py RAW` | Rebuilds `audio/` from the ElevenLabs originals ([audio/README.md](audio/README.md)). |

The browser scripts need `playwright` and a static server on port 8142:

```bash
python3 -m http.server 8142          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-142/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

Test shots are aimed wide of the tower on purpose: a straight shot at castle 1 bonks Sir Wobbleton and wins the castle, and every later step would then run against the results screen.

## Debug hooks (`?debug=1`)

`window.__kk`: `G` (the game), `mode` (`title`, `play`, `over`), `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(level, seed)` (skips the menus), `endless(n, seed)` (starts castle n of a siege), `autoplay(on, skill)` (the bot plays the real game), `ff(seconds, skill)` (run the sim ahead with the bot), `aim(yaw, pitch)`, `save()`, `hasSave()`, `progress()`. `&fast=N` runs N× the simulation per frame; `&attract=0` stops the title demo. Neither does anything without `debug=1`.
