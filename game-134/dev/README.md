# UFOops! — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-134/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a canvas, storage, `Math.random` or the clock. **rules** (96 checks): flying, the beam and its cone, the hold, overheating, banking and docking, grades, the buzzer, getting hurt and crashing, dropping (wrecks, bonks, waking up, beaming a bonked agent), agents deflecting and tinfoil backfiring, the camera flash reversing the controls, nets, shotguns and their reach, lasers and dodging them, jets and dodging them, every pickup, glitches and duct tape, fleeing farmers, restocking, the boss and the ending, upgrades, retries and Continue. **data**: every episode's tables name real things and the special order can turn up. **determinism**: same seed and inputs → same game; save round trips after 10 s and 45 s play on identically; damaged saves are rejected. **bot**: whole games at skill 1, 0.6 and 0.3 on `SEEDS` seeds with per-step invariants, the balance table and its bands. `ONLY=purity,rules,data,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-134/dev/browsertest.mjs` | Real Chromium. **desktop**: the title and back link, every painting and sound file decodes, the recorded title theme plays, New Game → the episode card, Space on Roll it!, real keys fly and held Space beams, the gameplay track takes over, pause freezes the sim, Escape closes Settings with a slider focused, Space presses the focused Resume, Save & Quit → Continue, the bot finishes the episode → the report card and its grade → a repair → episode 2, losing every saucer → CANCELLED! → Continue. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck, the stick flies, a second finger holds BEAM while the stick is down, DROP, controls ≥ 44 px, the HUD clears the back link, no sideways scroll, the canvas matches the visible viewport, ❚❚ stays open after the lift. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error, failed request or HTTP error. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-134/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. `DPR=2` for a sharper picture, `Q='&fast=4'` for URL parameters. |
| `node game-134/dev/preview.mjs` | The 1200×630 Garden preview, written to `garden/img/games/game-134.jpg`. |
| `python3 -I game-134/dev/art/export.py RAW` | Raw fal renders → `art/` (see [art/README.md](art/README.md)). |
| `python3 -I game-134/dev/audio/process.py RAW` | Raw ElevenLabs downloads → `audio/` and `js/voicelines.js` (see [audio/README.md](audio/README.md)). |

The browser scripts need `playwright` and a static server on port 8134:

```bash
python3 -m http.server 8134          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-134/dev/node_modules
```

The game is Canvas 2D, so there is no three.js to serve. The fonts (Luckiest Guy, Fredoka) are answered with an empty stylesheet; the game falls back to Impact and system sans. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__uo`: `G` (the game), `mode` (`title`, `play`), `seen` (a count of every sim event drained during play), `view`, `ui`, `audio`, `input`, `start(seed, episode = 0, go = false)` (skips the title; `go` also skips the episode card), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `finish()` (the bot plays the episode out to its report card), `cmd(c)` (send a menu command: `{ t: 'go' | 'next' | 'continue' }` or `{ t: 'upgrade', id }`), `art()` (`{ total, ok, failed }` for the paintings), `sound()` (effects and voices decoded, files that failed, what is playing), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame and `&seed=N` fixes the seed New Game uses; neither does anything without `debug=1`.
