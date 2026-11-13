# GIANT'S VAULT — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-132/dev/simtest.mjs` | Headless, in Node (a few minutes with the bot). **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: every skill, item, monster and area table is well formed; every model the data names exists and `js/model-files.js` lists exactly what is on disk. **world**: 60 seeds of each generator proved (start reaches the exit, the waystone, every spawn and lore stone); every real area populated with monsters on floor. **rules**: armour, resists, crits, stagger and poise, kills and experience, levels and points, tier gating, the second oath, the potion, the portal (cast, interrupt, snapshot, return), death (gold, waystone or town), pickup and the loot filter, Ember (town trips, downed, Mend, fighting), telegraphs, ranged monsters, bosses (phases, the sealed way), Kolossar's end, rifts (bar, guardian, tiers, scaling). **skills**: every active skill used and doing what it says; Rage builds and drains; legendary powers and set bonuses switch on; Blood Pact and Void Current. **loot**: rarity order, magic find, mythics only in deep rifts, affix ranges and slots, legendaries and mythics, gems and sockets, combining, selling, gambling. **determinism**: same seed → same game; save round trips mid-fight and through a portal play on identically; unknown save versions are rejected. **bot**: every class × `SEEDS` seeds × skill 1 and 0.4 plays the whole campaign and three rift tiers with per-step invariants, prints the balance table and asserts its bands. `ONLY=purity,data,world,rules,skills,loot,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-132/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader), about four minutes. **desktop**: title and back link, class choice, a story card closed with Enter, I and K panels, learning and slotting a skill by click, WASD, a real `1` and a left click with the mouse on a monster attack it, Q drinks, Escape pauses and the sim stops, Settings on top of Pause, Escape with a slider focused, Space on the focused Resume, T portals to town and the door back, Save & Quit → Continue, the bot plays on in the page, the picture is not blank, models loaded, music played and sound came out, the merchant panel. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through title, class and card, the touch deck, the stick walks, a skill button casts at the nearest enemy, ❚❚ stays open after the lift, the inventory fits, controls ≥ 44 px, no sideways scroll, canvas = viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-132/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-132/dev/art/prompts.mjs [group]` | Prints every fal prompt (built from the data tables). `python3 -I game-132/dev/art/export.py RAW` rebuilds `art/`. See [art/README.md](art/README.md). |
| `python3 -I game-132/dev/audio/process.py RAW` | Rebuilds `audio/` and `js/audio-files.js` from the ElevenLabs originals. See [audio/README.md](audio/README.md). |
| `node game-132/dev/assets/meshy-batch.mjs WORK` · `bash game-132/dev/assets/meshy-rig.sh WORK` · `node opt.mjs` | The Meshy model pipeline. See [assets/README.md](assets/README.md). |

The browser scripts need `playwright` and a static server on port 8132:

```bash
python3 -m http.server 8132          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-132/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a few frames a second, so the tests open the game with `&fast=4&q=low` and wait on state, never on the clock. Passing tests don't mean the screen looks good: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__tv`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view` (`view.info.models` load counts, `view.info.tris`, `view.screenOf(x, y, h)`, `view.pick(cx, cy)`), `ui`, `audio` (`level()`, `musicPlaying`), `input`, `panels`, `start(seed, cls)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `act(cmd)`, `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame (only with `debug=1`); `&q=low` draws less; `&models=0` keeps the code-built stand-ins.
