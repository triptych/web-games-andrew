# STARCADET — dev harnesses

No build step and no test framework: these are plain Node scripts that drive the **real** game
code. Run them from the game folder (`game-040/`).

| Command | What it does |
|---|---|
| `node dev/check.mjs` | Structural checks: every module imports, `js/sim/` is pure (no three.js, no DOM, no `Math.random`), every attack spec names a real pattern/special/bullet-kind, every level cue names a real enemy/formation/boss/comms id, cadet budgets total the Halcyon roll, every weapon's DPS curve rises with power |
| `node dev/simtest.mjs` | 30 assertions against the real simulation: hitbox vs ship size, graze and Overdrive, the death-bomb window, weapon muzzle counts, the whole rescue economy, shield facing, boss phase progression, Ironmaw's turrets removing attacks, laser warning vs firing, flares, every Wing Ability, determinism, entity-count bounds, save round-trip |
| `node dev/rendertest.mjs` | Runs the **real view layer** — scene, bloom composer, procedural models, instanced bullets, shader backdrops, fx, HUD, comms portraits, every menu — against `fake-three.mjs` and a strict fake Canvas2D, for all six levels and three boss fights |
| `node dev/balance.mjs [difficulty]` | Three scripted bots play all six levels and print times, deaths, pods recovered, peak bullet counts and ranks. This is where the numbers in GDD §10a come from |
| `node dev/playthrough.mjs [difficulty] [bot]` | A full six-level campaign, start to ending, carrying ship state and headcount between levels exactly as `main.js` does |
| `node dev/boottest.mjs` | Boots `main.js` itself under a fake DOM and walks the real state machine: title → intro → briefing → launch → play → pause → resume → level clear |
| `node dev/browsertest.mjs` | **Real Chromium, real WebGL, real three.js.** Loads `index.html` unmodified, plays through to a boss fight, screenshots each step at desktop and 390×844, and fails on any console error, page error or failed request. Needs Playwright and a static server — see the header of the file |

## Why a fake three.js?

`fake-three.mjs` implements exactly the three.js surface the view layer touches, and it is
deliberately hostile: a non-finite position or scale, an undefined colour, a disposed material or
geometry still in the scene graph, or an out-of-range instanced write **throws immediately**, naming
the object. That turns the class of bug that normally presents as "the screen went black" into a
stack trace.

It is never loaded by the game — `index.html` points at the real three.js r165 on unpkg.
`dev/hooks.mjs` (a Node module-resolution hook) swaps it in for `import 'three'` only inside these
harnesses.

**Bugs these caught before the game ever ran in a browser:**

- `disposeObject()` was disposing the *shared cached geometries* in `models.js`. In a browser,
  killing one Skimmer would have freed the GPU buffer out from under every other Skimmer on screen.
- The rescue economy could return **357 cadets out of a roll of 211**, because pod budgets counted
  pods while the story counted people. Pods now draw their passengers from the level's cadet budget.
- Boss HP was set against *nominal* DPS, so three levels never finished: a dodging pilot lands
  35–45% of nominal, and `balance.mjs` measured it.
- Explosions still in flight survived a level change, so the scene grew run over run.
- A boss whose HP reached zero by any path other than `damageBoss()` (a flare field, a ram) sat in
  its last phase forever — `boottest.mjs` found it while driving the state machine.
- One stray mouse movement permanently disabled the keyboard, because pointer-flying latched on.

Things only the **browser** test could show, since they are about what the frame looks like: the
backdrop plane was small enough that its edges were visible on screen, the starfield was bright and
chunky enough to be mistaken for bullets, the launcher link sat on top of the score, and the weapon
readout ran off the right edge of a phone.
