# The Last Apprentice — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-140/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, storage, `Math.random` or the clock. **data**: every scene lints (directives, speakers, labels, conditions), every backdrop, CG, portrait, track and effect a script names is listed in `js/assets.js`, has a prompt and is on disk (`NOART=1` skips the disk), every voice clip exists, every line the voice script records has a clip and none is stale. **rules**: effects and conditions. **wards**: every ward on 60 seeds starts unsolved, its shortest solution is in its band, hints lead to the goal. **determinism**: a seed replays exactly; a save round trip plays on identically. **routes**: five bot policies play to the end and the balance table is printed (Caius turns, Aldwin lives or falls, as the story intends). |
| `node game-140/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: the title (WebGL on, grey but for gold), New Story names the apprentice, the music plays, effects decode and the narrator is voiced, Enter, Tab and number keys, the log and the journal, every dialog keeps its buttons and tabs on screen with 2000 px of filler, Escape closes Settings from a focused slider, a ward-lock turned by a mouse drag and by its buttons, a hint, the Codex, the crimson ripple and the bloom scene, a camp talk, the road map, Save → Save & Quit → Continue, the bot to the end, the ending, the title in full colour. **phones** (touch only, real taps) at 390×844 and 844×390: the dialogue box, the same dialog check, a tap on a ring, the ward, camp and map controls ≥ 44 px and on screen, every map pin on screen, no sideways scroll. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error, failed request or HTTP error. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-140/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. E.g. `node game-140/dev/play.mjs ward "__tla.start(3); return __tla.toPhase('ward')" 1500`. |
| `node game-140/dev/audio/voices.mjs OUT` · `python3 -I game-140/dev/audio/process.py RAW OUT/takes.json` | The voice script and the audio pipeline: see [audio/README.md](audio/README.md). |
| `python3 -I game-140/dev/art/export.py RAW [names]` | The art pipeline: see [art/README.md](art/README.md). |

The browser scripts need `playwright` and a static server on port 8140:

```bash
python3 -m http.server 8140          # repo root
ln -s "$(npm root -g)" game-140/dev/node_modules
```

Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`. SwiftShader draws a few frames a second, so the tests open the
game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything:
look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__tla`: `G` (the game), `mode` (title, game, ending), `seen` (a count of every sim event drained),
`album`, `holding` (a ward is opening), `webgl`, `ui`, `vn`, `audio`, `input`, `stage`, `wardView`,
`start(seed, name)` (skips the title), `send(cmd)`, `toPhase('ward' | 'camp' | 'map' | 'end', policy)`,
`toChapter(n)`, `toScene(id)` (the bot plays ahead with no rendering in between), `autoplay(policy, every)` (the
bot plays through the real UI), `slots()`, `save()`. `&fast=N` speeds up typing, auto mode and a ward's opening
blaze N times; it does nothing without `debug=1`.
