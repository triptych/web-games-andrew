# SANDSUNK — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-141/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js`, `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock, and the bot never looks inside a block (except monsters under the Lamp of Lumen). **rules**: digging, damage by family, marks, traps, monsters, never-an-instant-knockout, fainting and the phoenix, exhaustion, runes, the conduit, chests, doors, items, shop, skills, levelling, quests, clear, descend, ending. **generation**: floors 1–24 on 4×SEEDS seeds match their plan, start safe and unsolved. **determinism**: same seed and commands → same game; a save round trip plays on identically. **bot**: the whole story at skill 1, 0.5 and 0 on SEEDS seeds with invariants, then endless floors; prints and bands the balance table. `ONLY=purity,rules,generation,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-141/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, a real click strikes, right-click marks, keys dig, Escape/Space menus, skills/quests/museum, camp and the shop, Save & Quit → Continue, the bot clears floor 1 and Descend works, the Meshy model loads in the viewer, the ElevenLabs audio decodes and music plays. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps, long-press marks, the Mark button, ≥ 44 px controls, no HUD under the back link, a long sheet's Done is on screen, no sideways scroll. **nostorage**. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-141/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `python3 -I game-141/dev/art/export.py RAW` | Rebuilds `art/` from the raw fal renders ([art/README.md](art/README.md)). |
| `python3 -I game-141/dev/audio/process.py RAW` | Rebuilds `audio/` from the ElevenLabs downloads ([audio/README.md](audio/README.md)). |
| `node game-141/dev/models/meshy-batch.mjs RAW WORK` then `opt.mjs` | Rebuilds `models/` with Meshy ([models/README.md](models/README.md)). |

The browser scripts need `playwright` and a static server on port 8141:

```bash
python3 -m http.server 8141          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-141/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests wait on state, never on the clock, and effects run slowly there. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ss`: `G`, `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `museum`, `input`, `start(seed)` (skips the title), `act(cmd)` (through the real command path), `bot(n, skill, until)` (n bot commands through the real command path), `autoplay(on, delay)` (the bot plays the live game), `exposed(i)`, `cellAt(i)` (a cell's client position), `save()`, `hasSave()`.
