# Common core: what the games duplicate, and what was factored out

An audit of the 139 games (November 2026) for modules and mechanics that have been written more than
once, which of them belong in a shared library, and which don't. The result is
[lib/core/](../lib/core/README.md): a library to draw from, not a framework. No game has been switched to
it; each game stays standalone, and its itch.io export carries the files it uses
([dev/itch/export.mjs](../dev/itch/export.mjs)).

## How the duplication happened

The `/scaffold-game` skill ([.claude/commands/scaffold-game.md](../.claude/commands/scaffold-game.md))
writes a fresh `rng.js`, `save.js`, `input.js`, `audio.js`, `config.js` and `main.js` into every new game.
Each copy then evolves on its own. When a game finds a bug in one of them, the fix goes into that game
and into the scaffold, but never back into the games already made.

| File | Games with it | Distinct after stripping comments |
|---|---|---|
| `js/main.js` | 136 | — (game-specific) |
| `js/config.js` | 112 | 112 (game-specific tuning) |
| `js/audio.js` | 98 | 98 |
| `js/save.js` | 87 | 87 |
| `js/ui.js` | 86 | — (game-specific) |
| `js/input.js` | 81 | 81 |
| `js/rng.js` (+ `js/sim/rng.js`) | 79 (+13) | 38 (+11) |
| `js/sounds.js`, `js/state.js`, `js/events.js` (Kaplay era, 004–036) | 30, 28, 26 | 30, 28, 8 (18 identical `events.js`) |

And the same pieces of code across all game JavaScript:

| Pattern | Games |
|---|---|
| guarded `localStorage` | 128 |
| a Web Audio noise buffer | 116 |
| `devicePixelRatio` handling | 115 |
| a `window.__xx` debug namespace | 104 |
| mulberry32 (`0x6D2B79F5`) | 102 |
| a toast | 91 |
| a dynamics compressor on the master bus | 90 |
| MIDI → frequency | 79 |
| sizing from `visualViewport` | 77 |
| `hash3` (`374761393`) | 74 |
| a gamepad poll | 73 |
| `CanvasTexture` (three.js) | 73 |
| a CRT / scanline pass | 68 |
| drums (kick, hat, snare) | 68 |
| a screen stack (`openScreen`) | 60 |
| a look-ahead `setInterval` music scheduler | 51 |
| a convolver reverb | 51 |
| `EffectComposer` + `UnrealBloomPass` | 48, 46 (bloom kernels already shared: `lib/round-bloom.js`) |
| `STEP = 1 / 120` fixed step | 45 |
| HTML escape | 45 |
| a typewriter for dialogue | 30 |
| FNV-1a string hash | 25 |
| value noise / fBm | 23 |
| a bitmap font table | 22 |
| BFS reachability / flood fill | ~20 |
| A* | 16 |

The dev harnesses repeat themselves too. Counting games whose `dev/*.mjs` scripts define each helper:
`shot` 96, `check` 91, `until` 83, `backLinkOk` 68, `reportErrors` and `nostorage` 62, `tapSel` 57.

## Why it matters: fixes that never spread

Counted in the copies on disk:

| Fix | Found in | Copies that have it |
|---|---|---|
| Space must not be `preventDefault`ed on a focused `<button>`, or it can't press it | game-078 | 55 of 81 `input.js`; 21 of the other 26 call `preventDefault` on Space |
| a focused slider/select keeps its keys but Escape still closes its sheet | game-117/118 | 58 of 81 |
| the touch stick ends on `lostpointercapture` | — | 42 of 81 |
| a looping silent `<audio>` so iOS plays Web Audio with the ringer on silent | game-100 | 1 of 98 `audio.js` |
| resume an `interrupted` audio context (a phone call) | game-100 | 1 of 98 |
| a per-sound throttle so 40 pickups in one frame don't clip | — | 18 of 98 |
| hash the seed so seeds 1, 2, 3 don't start alike | game-126 | 7 of 77 `makeRng` |

"Has the guard" is what was counted, not whether each game shows the bug: a game whose menus never take
focus may never hit the Space case. These are the places to look first when a game is next touched.

## What was factored out

Each module in [lib/core/](../lib/core/README.md) is the best version found in the repo, with the fixes
above merged in, tested in Node ([dev/core/simtest.mjs](../dev/core/simtest.mjs), 49 checks) and in
Chromium on a desktop and a touch-only phone, with storage working and blocked
([dev/core/browsertest.mjs](../dev/core/browsertest.mjs)).

| Module | Chosen because |
|---|---|
| `rng.js` | Identical in most games, and save files depend on it. Reproduces 69 of the 77 copies value for value (two variants), so it is a true drop-in. |
| `math.js`, `noise.js` | Tiny, pure, redefined everywhere (`clamp` in 63 games). `noise.js` matches the games' `vnoise`/`fbm`. |
| `grid.js` | BFS proofs and A* are rewritten per game with the same bugs to avoid (diagonal corner cutting, unbounded searches). Tested against BFS on 300 random mazes. |
| `store.js` | 87 hand-written guards around `localStorage`; one place to get the blocked-storage case right (itch.io's iframe can block it). |
| `input.js` | The most-fixed file in the repo; the copies disagree on four fixes. Named actions replace the hard-coded `a`. |
| `audio.js` | The bus/compressor/noise/tone/throttle plumbing is the same in every procedural-audio game; the sounds are not. `AudioCore` is meant to be extended, and holds the two iOS fixes only one game has. |
| `viewport.js` | The `100vh` bug shipped twice (058, 067); 77 games now read `visualViewport` by hand. |
| `loop.js` | The fixed-step accumulator, the frame cap and `?debug=1&fast=N` are copied into every sim/view `main.js`. |
| `dom.js` | `toast`, `esc`, time and number formatting, colour mixing: one-liners copied 15–90 times. |

## What was not factored out, and why

- **Game logic** (`js/sim/game.js`, `bot.js`, data, `config.js`, `ui.js`, the views). These are the games.
  The scaffold's shapes for them (`newGame`/`step`/`serialize`, a bot playing through the same input) are a
  convention, already documented in the skill, not code to share.
- **three.js view helpers** (canvas textures, bloom chains, toon/ink passes, instanced props). Strong
  candidates, but they would make `lib/core` depend on three.js, which each game loads from its own import
  map. A separate `lib/three/` whose modules take `THREE` as an argument (as `round-bloom.js` takes the
  pass) would keep the rule; that is the next step if it is wanted.
- **The CRT pass and bitmap font** (game-075 and game-092 share a byte-identical `view/font.js` and two
  169-line `crt.js`). Real duplication, but only three games; worth extracting the next time a game wants
  the look.
- **A screen stack / menu focus manager** (60 games). The pattern is shared, but each game's markup and
  screens differ; extracting it means agreeing a markup contract first.
- **Typewriter dialogue** (30 games). Usually entangled with each game's scene runner.
- **Kaplay-era modules** (`events.js`, `state.js`, `sounds.js` in games 004–036). Eighteen `events.js`
  files are identical, but those games are being refreshed to the sim/view layout one at a time
  ([refresh-plan.md](refresh-plan.md)), which replaces them.
- **The dev harness helpers** (`check`, `until`, `shot`, `backLinkOk`, `nostorage`, ...). Dev-only, so the
  itch constraint doesn't apply and sharing them is easy: a `dev/lib/harness.mjs` is a good follow-up.

## Using it

- **New games:** import from `lib/core` instead of writing `rng.js`, `save.js`, `input.js` and the audio
  plumbing. The scaffold has not been changed yet; switching its templates to these imports (and rerunning
  its harnesses) is the natural next step.
- **Existing games:** don't migrate them in bulk. When a game is next opened for other work, swap a copy
  for the module if it is a drop-in (check with `dev/core/simtest.mjs`'s table), run the game's own
  `simtest` and `browsertest`, and bump its patch version as for any fix (`js/config.js`, `js/gamedata.js`,
  `CHANGELOG.md`, `status.md`).
- **Itch.io:** nothing to do. `node dev/itch/export.mjs game-NNN` copies the `lib/core` files the game uses,
  and their own imports, into the zip. Builds of games that don't use `lib/core` are byte-identical to
  before (checked on 001, 004, 019, 027, 065 and 139).
