# SHARDFRAME — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-137/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **data**: parts, missions, crew, upgrades are well formed; every crew member is rescued in exactly one mission. **rules**: walking, the magnet slow, rock, breaking layers, the unbreakable edge, voxels flying and settling and stacking, debris bookkeeping, piles blocking monsters but not the mech, fading, collecting by walking and by magnet, rubble not collectible, shield and repair voxels, monsters walking, chewing through a pile, piles stopping monster shots but not the mech's, auto-guns, kills bursting into voxels, Overdrive charge, boomers, explosions breaking rock, hives, cages, level-up cards pausing the battle, Overdrive invulnerability, the shield and i-frames, losing, aborting, bosses arriving, winding up, dying. **hangar**: buying, upgrading, fitting, swapping arms, the crew's real-time gifts and their cap, boosts at launch. **maps**: 12 missions × 60 seeds, every cage and hive reachable. **determinism**: same seed, same game; a mid-sortie save round trip plays on identically. **bot**: the whole campaign on `SEEDS` seeds at skill 1 and 0.4 with per-step invariants, the balance table and its bands. `ONLY=purity,data,rules,hangar,maps,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. The bot section takes a few minutes. |
| `node game-137/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game plays the cinematic, Enter moves a shot, Escape skips it, the music plays and the clips decode, a sortie from the list, its briefing, Launch, the battlefield is drawn, real keys walk, hold Space for the magnet, E for Overdrive, the 2 key picks a card while the battle waits, Escape pauses and the sim stops, Settings sits on top and Escape closes it with a slider focused, Space presses Resume, the bot wins, the debrief welcomes the crew, an hour later the gifts are collected, the Mech tab buys a Scatter Cannon, Save & Quit, Continue restores it. **phones** (touch only, real CDP touches, 390×844 and 844×390): New Game, Skip, a sortie, Launch, the touch deck, the stick walks, a second finger holds 🧲, OD fires, controls ≥ 44 px, on screen and not overlapping, the canvas matches the viewport, the pause screen stays open after the finger lifts. **nostorage**: plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node game-137/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `node game-137/dev/art/prompts.mjs [pilot\|crew\|cast\|scenes\|rest]` | The fal jobs, built from the game's data. See [art/README.md](art/README.md). |
| `python3 -I game-137/dev/art/export.py RAW` | Raw fal PNGs → `art/*.webp`. |
| `python3 -I game-137/dev/audio/process.py RAW` | Raw ElevenLabs MP3s → `audio/*.mp3` (music, effects, voice lines cut at their pauses). See [audio/README.md](audio/README.md). |

The browser scripts need `playwright` and a static server on port 8137:

```bash
python3 -m http.server 8137          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-137/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4&q=low` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__sf`: `G`, `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `cin` (the cinematic), `newGame(seed, { intro })` (skips the title; the intro is off unless asked), `launch(id)` (opens and starts sortie `id`), `autoplay(on)` (the bot flies the real game), `ff(seconds)` (run the sortie ahead with the bot), `hangarBot()` (the bot spends and launches), `save()`, `hasSave()`, `loadAndResume()`. `&fast=N` runs N× the simulation per frame; `&q=low` turns off antialiasing and draws at 1× pixels.
