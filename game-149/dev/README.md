# Echoheart Academy — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node game-149/dev/simtest.mjs` | Headless, in Node, ~5 s. **purity** (`js/sim/`, `js/rng.js`, `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock). **story**: every scene compiles; every background, CG, sprite, music theme, sound and voice line a scene names exists; every friend has five hangouts and three heart events; every fighter has a Meshy model. **vn**: lines, choices and effects, labels, `call` and `end`, conditions, `{name}`. **bonds**: hearts, gifts (once a day, costing no time), heart events in order, the captive is the closest friend. **battle**: damage, guard, weakness, items, Echo copying ally and foe spells, the boss multiplier, losing and retrying, boss win rates. **minis**: all six at two levels and three bot skills (perfect ≈ S, clumsy worse), plus direct rules. **map**: a flood fill with the real mover proves every place, charm, petal and marshmallow reachable and no wall or edge crossable. **calendar**, **climax** (the moon clock, battle cost, sealed cages). **guide**: where the campus arrow points (classmates on day one, quest turn-ins, heart events, the closest friend, the nearest cage, the tower), and that a whole bot game always has a real place in free time. **determinism** (same seed, same game; save round trips on the map, mid-battle and mid-mini-game). **bot**: whole games over `SEEDS` seeds at three skills and four favourites, with per-step invariants, the balance table and asserted bands. `ONLY=…`, `SEEDS=n`, `VERBOSE=1`. |
| `node game-149/dev/browsertest.mjs` | Real Chromium + SwiftShader. **desktop** by real keys and clicks: the title, a typed name, reading with Space, a choice by arrows and Enter, the Resonance exam with arrow keys, music playing and effects decoded, a sprite standing on the bottom edge, walking with held arrows, the guide arrow, the Great Hall fading while Kai stands behind it, Space at the library, its sheet and meeting Lys, Escape (also from a focused slider), a battle with Meshy models and clips loaded and a Strike by Enter, Auto to the end card, the Fireball Gallery by arrow keys, a long bag whose Close stays pinned, the journal, Save & Quit and Continue, the moon clock, the ending. **phones** (touch only, real CDP touches) at 390×844 and 844×390: the title and name by taps, taps reading on, the mini-game pad, the touch deck and stick, A at a door, a tapped sheet, a battle by taps; every control ≥ 44 px, on screen and on top. **nostorage**. Fails on any page error, console error or failed request. `ONLY=desktop,phones,nostorage`; `LAND=1` runs only the landscape phone. Screenshots in `dev/shots/`. |
| `node game-149/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |
| `art/`, `meshy/`, `audio/` | The media pipelines and what was generated: see their READMEs. |

The browser scripts need `playwright` and a static server on port 8149:

```bash
python3 -m http.server 8149          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules game-149/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root);
the scripts serve three.js from there, or set `THREE_PKG`.

SwiftShader draws a few frames a second, so the tests open the game with `&fast=3`, jump ahead with `__ea.ff` and wait
on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.__ea`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`,
`vnv`, `bui`, `mini`, `start(seed, name)` (skips the title and the name), `act(cmd)` (any command the UI sends),
`scene(name)` (play a scene now), `autoplay(on, { skill, fav })` (the bot plays the real game), `ff(seconds, opts,
until)` (the sim runs ahead with the bot until `until(G)`), `busy()`, `save()`, `hasSave()`, `place(id)` (stand at a
place's door). `&fast=N` runs N× the simulation per frame.
