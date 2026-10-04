# Refresh plan for the early games (001–036)

The games in this repo were built in order, and the later ones (037 onward) share conventions the early ones predate. This plan lists those conventions, records what an audit of games 001–036 found, and sets out the work to bring the early games up to the later standard. Each item is marked **done** or **backlog**. Backlog items are ranked and sized so the next pass can take them in order.

## The conventions the later games share

These are the conventions every game from 037 to 057 follows. The audit checked each early game against them. The last column shows where things stood before this pass.

| # | Convention | Where it is written down | Early games that followed it before this pass |
|---|---|---|---|
| C1 | A `← Games` link to `../index.html`, on screen and clickable | [learnings.md § Back-to-Launcher Link](generic/learnings.md#5-back-to-launcher-link--required-all-games) | All but game-031 (its link was below the fold on a laptop) |
| C2 | Boots with no console errors, page errors or failed requests | every `dev/browsertest.mjs` | All 36 |
| C3 | Survives blocked storage: `localStorage` can throw, so the game still boots and plays, just without saving | `try { … } catch` around every storage access in 037+ | 24 of 36. Nine crashed at load, and three more would throw on save, load or clear |
| C4 | Phone-first viewport: `viewport-fit=cover`, a `theme-color`, and no sideways scroll or clipped canvas on a 390 px phone | every 037+ `index.html` | None had both meta tags (game-033 had `viewport-fit` only). Six were clipped or overflowed: 001, 002, 005, 006, 026, 030 |
| C5 | Silent in a background tab: audio suspends when the tab is hidden | `visibilitychange` handlers in 037+ | 3 of 36 had their own handler (018, 034, 036). Kaplay suspends its *own* audio in a hidden tab, but most games make their own `AudioContext` for sound effects and music. Fifteen games play music or ambience with no handler |
| C6 | Touch is a first-class input, not an afterthought | [learnings.md § Making an action game genuinely playable on a phone](generic/learnings.md#making-an-action-game-genuinely-playable-on-a-phone-game-040-starcadet-2026-09-22) | About half. Several are keyboard-only or need a right click |
| C7 | Uses the shared engine copies in `/lib` instead of its own | [docs/README.md](README.md) | All but game-002 (Kaplay 3001, a different major version) and game-004 (an identical copy of `/lib/kaplay`) |
| C8 | A `dev/` harness that runs the real game headlessly or in a browser | every 037+ `dev/README.md` | Only game-033 |
| C9 | A design doc (`game-plan.md` or `GDD.md`) that matches the code | every 037+ game | 33 of 36. game-001, 002 and 016 had none; several understate their own progress (see [status.md](../status.md)) |
| C10 | A defined ending, or an explicitly endless design | the "Open" notes in [status.md](../status.md) | All but game-022 (no win condition) and game-032 (no floor progression) |

## How the audit was done

[`dev/smoketest.mjs`](../dev/smoketest.mjs) is a new repo-level harness. It loads every game in real Chromium on a desktop and on a touch-only phone, clicks or taps, presses Enter, Space, the arrows and WASD, and fails a run on any of these:
- a console error, a page error or a failed request
- a missing or covered back link
- a page wider than the phone, or a clipped canvas

With `NOSTORAGE=1` it also makes `localStorage` throw. See [dev/README.md](../dev/README.md).

| Check | Failures before this pass |
|---|---|
| Boot and first input, desktop and phone | none |
| Back link (C1) | game-031 |
| Phone layout (C4) | game-026: 90 px of sideways scroll. game-001, 002, 005, 006 and 030: fixed-size canvases (608 to 1280 px wide) clipped off both sides. A scroll-width check misses this, so the harness compares each canvas's on-screen rectangle with the window |
| Blocked storage (C3) | game-003, 010, 011, 013, 014, 018, 023, 028, 033: an uncaught `SecurityError`, usually at module load, so the game never starts |

A read-through of the code found these as well:

- **game-032 Ironhollow Depths**: `state.level` exists, but there are no stairs, so the game has one room and no ending. Its enemy hit-flash assigns a component (`k.color(...)`) to `enemy.color` instead of a colour (`k.rgb(...)`), so the flash never shows. Its slime wobble sets `scale` on objects with no `scale()` component, so it does nothing. It has one enemy type and keyboard-only controls.
- **game-022 Depths Unknown**: finding the Singing Vein shows a lore card and nothing else, so the game has no win.
- **game-001 Space Shooter**: a fixed 800×600 canvas, frame-rate-dependent movement (it runs twice as fast on a 120 Hz screen), keyboard-only, and no saved best score.
- **game-007, 009, 012**: storage access on save, load or clear that would throw with storage blocked. The smoke test can't reach these, because they sit behind menus.
- **game-016 Crate Pusher**: keyboard-only, no saved progress, no way to pick a level.
- **game-017 Pixel Picross**: marking a cell needs a right click, which a phone does not have.
- **game-004**: a byte-identical 560 KB copy of `/lib/kaplay`.

## Workstreams

### W1. A floor under every early game: done
1. Add the smoke-test harness at `dev/smoketest.mjs` (C2).
2. Guard storage in the twelve games with unguarded access (C3). Wrap the reads and the saves in `try`/`catch` and fall back to defaults, so the game plays without saving.
3. Fix the layout failures (C1, C4):
   - game-031: pin the back link to the corner
   - game-026: let the hint bar wrap and cap the message log's width
   - game-002: Kaplay 3001's own `scale` option, so taps still hit the right gem
   - game-005 and game-006: `letterbox: true`
   - game-030: a CSS transform that scales the canvas and its DOM panels together
   - game-001: rebuilt (see W3)
4. Add `viewport-fit=cover` and a `theme-color` matching the page background to every early game (C4).
5. Add one shared helper, [`lib/page-audio.js`](../lib/page-audio.js), included by every early game. It tracks each `AudioContext` and media element the page creates and suspends them while the tab is hidden (C5). It is engine-agnostic because Kaplay, Phaser, three.js and hand-written Web Audio all construct a standard `AudioContext`.
6. Point game-004 at `/lib/kaplay` and delete its copy (C7).

**Result:** `node dev/smoketest.mjs` and `NOSTORAGE=1 node dev/smoketest.mjs` pass for all of 001–036.

### W2. Finish the two unfinished games: done
- **game-032 Ironhollow Depths v1.2, Phase 2** (C6, C8, C10):
  - ten procedurally generated floors, each checked by flood fill; stairs that open once a floor is cleared
  - skeletons from floor 3 (they keep their distance and throw bones) and bats from floor 2 (erratic flyers)
  - potions on floors 3, 5, 7 and 9, and the Hollow Crown on floor 10 to win
  - a saved best run; touch controls (a floating stick, a sword button, a pause button); pause on a hidden tab
  - fixes for the hit flash and the wobble
  - [dev/browsertest.mjs](../game-032/dev/browsertest.mjs) checks 60 generated floors, the desktop flow and touch-only phones
- **game-022 Depths Unknown v1.4, an ending** (C8, C10): carrying Singing Vein ore back to base completes the mission. An epilogue plays over the paused base with the run's numbers, and offers to keep mining, start again or go to the menu. The ending is recorded in the save, so it plays once per world. [dev/browsertest.mjs](../game-022/dev/browsertest.mjs) covers it on desktop and on a touch-only phone.

### W3. Make keyboard- or mouse-only games playable on a phone: done for three games
- **game-001 v1.3**: a canvas that scales to fit, per-second movement, hold-to-fire, drag-to-steer with auto-fire on touch, a title screen, pause, and a saved best score. [dev/browsertest.mjs](../game-001/dev/browsertest.mjs).
- **game-016 v1.2**:
  - swipe or tap beside the pusher to move
  - on-screen Undo, Restart and Menu buttons
  - saved progress with best move counts, and a level picker on the title
  - its first design doc (C9)
  - [dev/browsertest.mjs](../game-016/dev/browsertest.mjs) proves every level solvable with a breadth-first solver, then plays all eight through the real UI
- **game-017 v1.2**: a Fill / Mark tool, so a phone can place crosses without a right click; Restart and Menu buttons; and saved progress. [dev/browsertest.mjs](../game-017/dev/browsertest.mjs).

In 016 and 017 the game is drawn at a fixed landscape resolution, so buttons are sized in game pixels to reach 44 px on a landscape phone. In portrait they come out at about 35–42 px. The tests report that number rather than hiding it.

### W4. Record it: done
- the version of each changed game in `js/gamedata.js` (which drives the launcher)
- [CHANGELOG.md](../CHANGELOG.md), [status.md](../status.md) and the README (which had game-022 down as Kaplay; it is Phaser 4)
- the per-game design docs
- the reusable lessons, in [learnings.md § Early-games refresh](generic/learnings.md#early-games-refresh-conventions-retrofitted-to-games-001036-2026-10-04) and [kaplay-api.md](kaplay/kaplay-api.md)

## Backlog, ranked

The work below is worth doing but did not fit this pass. It is ordered by player value for effort.

| Rank | Game(s) | Item | Size |
|---|---|---|---|
| 1 | 003, 005, 006, 008, 019, 021, 025, 026, 029, 030 | Touch controls for the remaining keyboard-only games, following the game-040 rules: relative drag, two thumbs in two corners, ≥ 44 px targets. game-032's `js/touch.js` is a small, reusable DOM stick and button layer for Kaplay games | M each |
| 2 | 005, 006, 008, 009, 012 | A `dev/` harness that drives one full run (C8). Start with the games that have the most state: 009 (RPG combat), 012 (gacha), 008 (tower defence) | M each |
| 3 | 014 | Move from three.js r128 (a global script from cdnjs) to r165 with an import map like every other three.js game. Retune the lights afterwards: r155 changed light units and r152 changed colour management, so the scene will look different | M |
| 4 | 002 | Move from the bundled Kaplay 3001 to `/lib/kaplay` (v4000). The colour and text APIs differ, so the game needs a full playtest afterwards | S–M |
| 5 | 001, 002 | Write a `game-plan.md` for each, so all games have a design doc (C9) | S each |
| 6 | 006, 009, 012, 014, 019 | Bring the stale plan docs up to the code ([status.md](../status.md) lists the specific gaps) | S each |
| 7 | 001–036 | A sound toggle wherever one is missing. Most early games have no mute. Add it per game, because the free key differs from game to game | S each |
| 8 | 006 | Now that it fills the window, its FPS readout sits under the Games link. Move the readout or hide it outside `?debug=1` | XS |
| 9 | 022 | Phase 2 polish from its own plan: particles, per-tier backgrounds, void anomalies | M |
| 10 | 032 | Phase 3 from its own plan: a sprite art pass, hit-pause, combo scoring | M |
