# STARCADET — dev harnesses

No build step and no test framework: these are plain Node scripts that drive the **real** game
code. Run them from the game folder (`game-040/`).

| Command | What it does |
|---|---|
| `node dev/check.mjs` | Structural checks: every module imports, `js/sim/` is pure (no three.js, no DOM, no `Math.random`), every attack spec names a real pattern/special/bullet-kind, every level cue names a real enemy/formation/boss/comms id, the hazard rule (every pickup colour is green-dominant, nothing that damages the player is, and the two sets share no hex), cadet budgets total the Halcyon roll, every weapon's DPS curve rises with power |
| `node dev/simtest.mjs` | 38 assertions against the real simulation: hitbox vs ship size, graze and Overdrive, the death-bomb window, weapon muzzle counts, the whole rescue economy, shield facing, boss phase progression, Ironmaw's turrets removing attacks, laser warning vs firing, flares, every Wing Ability, determinism, entity-count bounds, save round-trip, the four timed power-ups (shield absorption and stacking, invulnerability, the speed multiplier, homing-rocket splash), and that **no boss ever teleports** except on a declared blink |
| `node dev/rendertest.mjs` | Runs the **real view layer** — scene, bloom composer, procedural models, instanced bullets, shader backdrops, fx, HUD, comms portraits, every menu — against `fake-three.mjs` and a strict fake Canvas2D, for all six levels and three boss fights |
| `node dev/balance.mjs [difficulty]` | Three scripted bots play all six levels and print times, deaths, pods recovered, peak bullet counts and ranks. This is where the numbers in GDD §10a come from |
| `node dev/playthrough.mjs [difficulty] [bot]` | A full six-level campaign, start to ending, carrying ship state and headcount between levels exactly as `main.js` does |
| `node dev/boottest.mjs` | Boots `main.js` itself under a fake DOM and walks the real state machine: title → intro → briefing → launch → play → pause → resume → level clear |
| `node dev/mobiletest.mjs` | **The phone pass.** An emulated iPhone-class device (touch, `isMobile`, dpr 3) driven *only* by touch input through CDP: taps through the menus, drags to fly, checks the ship does not teleport on a bare touch, exercises FLARE / OD / FOCUS-held / PAUSE, and asserts every on-screen control is ≥44px and clear of the HUD. `LANDSCAPE=1` runs the 844×390 pass |
| `node dev/perf.mjs` | Simulation cost per rendered frame at boss-level entity counts. The renderer's cost is a GPU question, but the sim is plain JS and costs a phone the same work — it comes in around 0.1ms per frame against a 16.7ms budget |
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

- **Every boss teleported on its first fight tick.** `MOVES.sway/dip/orbit` *assigned* `b.x` from
  a sine of the free-running `moveT`, but `moveT` ran throughout the 2.4s entry while `x` was pinned
  at 0 — so the moment the fight started the sine was already a third of a cycle in and the boss
  snapped across the arena. Tarpon, the *first boss in the game*, jumped 5.3 units in one tick
  (641 u/s). Phase changes did it again (each phase swaps `amp`/`cx`), and Ironmaw's ram lurched
  0.44u on its opening tick because the easing curve used an exponent below 1, which has infinite
  slope at t=0. The scripts now ease toward a target point, each phase drives its curve from its own
  `phaseT`, and `simtest.mjs` fails any boss that moves faster than 25 u/s without emitting a blink
  event.
- Pickups and enemy fire shared a palette: the amber power-up was `#ffd166` against `#ffb347` enemy
  orbs, the pink flare pickup was a shade off the hot-pink bullets, and the violet gem matched the
  Choirmaster's fire. Every pickup is now green and nothing that can hurt you is, which `check.mjs`
  enforces on the actual colour values rather than by convention.

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

Things only the **mobile** test could show, because they are about a device with no keyboard:

- Dragging was **absolute**: the first touch teleported the ship up to 3.3 units across the arena,
  and flying meant holding a thumb over the bullets you were trying to read. It is relative now.
- The on-screen buttons sat on top of the Overdrive and level meters.
- A CSS specificity slip (`#touch button` beating `#touch-pause`) rendered the pause button at 64px
  instead of 46px, on top of the ship readouts.
- The top HUD row *overflowed* 390px once the launcher link and pause button were accounted for, and
  an overflowing flex row with `space-between` silently pushes its last child off to the right —
  which is why the right-hand column kept landing under the pause button even after two "fixes".
- In landscape the menus could not be scrolled by finger **at all**: `touch-action: none` on `body`
  (which stops dragging the ship from scrolling the page) also disables scrolling inside overlays,
  so the LAUNCH button below the fold was simply unreachable.
- The comms panel sat on top of the OD button *and* on top of the player's own ship.
- Tapping a key-rebind button on a phone left the options panel stuck on "PRESS A KEY…" forever.
- Nothing marked the arena walls: the camera fits whichever dimension binds, so on a landscape phone
  the playable box is the middle ~40% of the glass with no indication of where it ends.
- Long banner strings were clipped by the fixed text-sprite canvas ("1. HANGAR RING" rendered as
  "ANGAR RI", and boss phase names are longer than that).

Things only the **browser** test could show, since they are about what the frame looks like: the
backdrop plane was small enough that its edges were visible on screen, the starfield was bright and
chunky enough to be mistaken for bullets, the launcher link sat on top of the score, and the weapon
readout ran off the right edge of a phone.
