# Refresh plan for the early games (001–036)

The games in this repo were built in order, and the later ones (037 onward) share conventions the early ones predate. This plan lists those conventions, records what an audit of games 001–036 found, and sets out the work to bring the early games up to the later standard. Each item is marked **done** or **backlog**. Backlog items are ranked and sized so the next pass can take them in order.

## The conventions the later games share

These are the conventions every game from 037 to 057 follows. The audit checked each early game against them.

| # | Convention | Where it is written down | Early games that follow it |
|---|---|---|---|
| C1 | A `← Games` link to `../index.html`, on screen and clickable | [learnings.md § Back-to-Launcher Link](generic/learnings.md#5-back-to-launcher-link--required-all-games) | All but one (game-031's link was off screen on desktop) |
| C2 | Boots with no console errors, page errors or failed requests | every `dev/browsertest.mjs` | All 36 |
| C3 | Survives blocked storage: `localStorage` can throw, so the game still boots and plays, just without saving | `try { … } catch` around every storage access in 037+ | 27 of 36 (9 crashed) |
| C4 | Phone-first viewport: `viewport-fit=cover`, a `theme-color`, and no sideways scroll or clipped canvas on a 390 px phone | every 037+ `index.html` | 2 of 36 had the meta tags; 3 were clipped or overflowed |
| C5 | Silent in a background tab: audio suspends when the tab is hidden | `visibilitychange` handlers in 037+ | 3 of 36. Fifteen others play music or ambience with no handler |
| C6 | Touch is a first-class input, not an afterthought | [learnings.md § Making an action game genuinely playable on a phone](generic/learnings.md#making-an-action-game-genuinely-playable-on-a-phone-game-040-starcadet-2026-09-22) | About half. Several are keyboard-only or need a right click |
| C7 | Uses the shared engine copies in `/lib` instead of its own | [docs/README.md](README.md) | All but game-002 (Kaplay 3001, a different major version) and game-004 (an identical copy of `/lib/kaplay`) |
| C8 | A `dev/` harness that runs the real game headlessly or in a browser | every 037+ `dev/README.md` | Only game-033 |
| C9 | A design doc (`game-plan.md` or `GDD.md`) that matches the code | every 037+ game | 33 of 36. game-001, 002 and 016 have none; several understate their own progress (see [status.md](../status.md)) |
| C10 | A defined ending, or an explicitly endless design | the "Open" notes in [status.md](../status.md) | All but game-022 (no win condition) and game-032 (no floor progression) |

## How the audit was done

[`dev/smoketest.mjs`](../dev/smoketest.mjs) is a new repo-level harness. It loads every game in real Chromium on a desktop and on a touch-only phone, clicks or taps, presses Enter, Space, the arrows and WASD, and fails a run on any console error, page error, failed request, missing or covered back link, or a page that is wider than the phone or clips its canvas. With `NOSTORAGE=1` it also makes `localStorage` throw. See [dev/README.md](../dev/README.md).

First run, before any fixes:

| Check | Failures |
|---|---|
| Boot and first input, desktop and phone | none |
| Back link (C1) | game-031 (its own styled link sat above the top of the viewport) |
| Phone layout (C4) | game-026 (90 px of sideways scroll); game-001 and game-002 (fixed-width canvases clipped off both sides, which a scroll-width check misses) |
| Blocked storage (C3) | game-003, 010, 011, 013, 014, 018, 023, 028, 033: an uncaught `SecurityError`, usually at module load, so the game never starts |

A read-through of the code found these as well:

- **game-032 Ironhollow Depths**: `state.level` exists, but there are no stairs, so the game has one room and no ending. Its enemy hit-flash assigns a component (`k.color(...)`) to `enemy.color` instead of a colour (`k.rgb(...)`), so the flash never shows. It has one enemy type and keyboard-only controls.
- **game-022 Depths Unknown**: finding the Singing Vein shows a lore card and nothing else, so the game has no win.
- **game-001 Space Shooter**: a fixed 800×600 canvas, frame-rate-dependent movement (it runs twice as fast on a 120 Hz screen), keyboard-only, and no saved best score.
- **game-016 Crate Pusher**: keyboard-only, no saved progress, no way to pick a level.
- **game-017 Pixel Picross**: marking a cell needs a right click, which a phone does not have.
- **game-004**: a byte-identical 560 KB copy of `/lib/kaplay`.

## Workstreams

### W1. A floor under every early game: done
1. Add the smoke-test harness at `dev/smoketest.mjs` (C2).
2. Guard storage in the nine games that crashed (C3). Wrap the module-load reads and the saves in `try`/`catch` and fall back to defaults, so the game plays without saving.
3. Fix the layout failures (C1, C4): game-031's back link, game-026's overflow, and the clipped canvases in game-001 and game-002.
4. Add `viewport-fit=cover` and a `theme-color` matching the background to every early game (C4).
5. Add one shared helper, [`lib/page-audio.js`](../lib/page-audio.js), included by every early game. It tracks each `AudioContext` the page creates and suspends them while the tab is hidden (C5). It is engine-agnostic because Kaplay, Phaser, three.js and hand-written Web Audio all construct a standard `AudioContext`.
6. Point game-004 at `/lib/kaplay` and delete its copy (C7).

Exit criterion: `node dev/smoketest.mjs` and `NOSTORAGE=1 node dev/smoketest.mjs` both pass for 001–036.

### W2. Finish the two unfinished games: done
- **game-032 Ironhollow Depths, Phase 2**: stairs that open once a floor is cleared, procedural room layouts, skeletons (they keep their distance and throw bones) and bats (erratic flyers) joining from floors 3 and 2, a health potion on some floors, a win screen after floor 10, a saved best floor, and touch controls (a stick plus an attack button). Also fix the hit flash.
- **game-022 Depths Unknown, an ending**: carrying Singing Vein ore back to base completes the mission. That plays an ending scene with the run's stats and offers to keep mining or start again. The ending is recorded in the save, so it plays once.

### W3. Make keyboard-only games playable on a phone: done for three games
- **game-001**: a canvas that scales to fit, `dt`-based movement, drag-to-steer with auto-fire on touch, pause when the tab is hidden, and a saved best score.
- **game-016**: swipe to move, on-screen Undo, Restart and Menu buttons, saved progress, and a level picker on the title screen.
- **game-017**: a Fill / Mark toggle, so a phone can place crosses without a right click.

### W4. Record it: done
Bump the version of each changed game in `js/gamedata.js` and in the launcher, add entries to `CHANGELOG.md`, refresh `status.md`, update the per-game `game-plan.md` files, and add the reusable lessons to `docs/generic/learnings.md`.

## Backlog, ranked

The work below is worth doing but did not fit this pass. It is ordered by player value for effort.

| Rank | Game(s) | Item | Size |
|---|---|---|---|
| 1 | 003, 005, 006, 008, 019, 021, 025, 029, 032 (beyond its new controls) | Touch controls for the remaining keyboard-only action games, following the game-040 rules: relative drag, two thumbs in two corners, ≥ 44 px targets | M each |
| 2 | 005, 006, 008, 009, 012 | A `dev/` harness that drives one full run (C8). Start with the games that have the most state: 009 (RPG combat), 012 (gacha), 008 (tower defence) | M each |
| 3 | 014 | Move from three.js r128 (a global script from cdnjs) to r165 with an import map like every other three.js game. Retune the lights afterwards: r155 changed light units and r152 changed colour management, so the scene will look different | M |
| 4 | 002 | Move from the bundled Kaplay 3001 to `/lib/kaplay` (v4000). The colour and text APIs differ, so the game needs a full playtest afterwards | S–M |
| 5 | 001, 002, 016 | Write a `game-plan.md` for each, so all games have a design doc (C9) | S each |
| 6 | 006, 009, 012, 014, 019 | Bring the stale plan docs up to the code ([status.md](../status.md) lists the specific gaps) | S each |
| 7 | 001–036 | A sound toggle wherever one is missing. Most early games have no mute. Add it per game, because the free key differs from game to game | S each |
| 8 | 022 | Phase 2 polish from its own plan: particles, per-tier backgrounds, void anomalies | M |
| 9 | 032 | Phase 3 from its own plan: a sprite art pass, screen shake, combo scoring | M |
