# Crate Pusher

**Genre:** Sokoban puzzle
**Engine:** Kaplay v4000 (ES6 modules, shared `/lib/kaplay`)
**Resolution:** 800 × 560, letterboxed to fit
**Status:** Complete, v1.1

---

## Concept

Classic Sokoban: push every crate onto a target. You can push but never pull, and only one crate at a time. Eight hand-made levels, from a one-move tutorial to a fifteen-move finale.

## Controls

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Move / push | Arrow keys or WASD | Swipe, or tap a square beside the pusher |
| Undo | U | Undo button |
| Restart level | R | Restart button |
| Menu | Esc | Menu button |
| Pick a level (title) | 1–8, or Space / Enter for the latest | Tap a level |
| Skip the win screen | — | Click or tap |

On touch devices the top bar is taller, so its buttons are bigger.

## Progression

Solving a level unlocks the next. The best (fewest) move count for each level is saved (if the browser allows storage) and shown on the title's level picker, which colours solved levels green, and in the level's top bar.

## Levels

| # | Name | Shortest solution |
|---|---|---|
| 1 | Tutorial | 1 move |
| 2 | Push Up | 2 |
| 3 | Around the Corner | 5 |
| 4 | Double Drop | 4 |
| 5 | Side by Side | 9 |
| 6 | Corner Run | 7 |
| 7 | Triple Threat | 13 |
| 8 | The Finale | 15 |

Shortest solutions come from the breadth-first solver in `dev/browsertest.mjs`, which also proves every level solvable.

## Files

| File | Responsibility |
|---|---|
| `js/levels.js` | Level strings (`#` wall, `.` target, `$` crate, `*` crate on target, `@` pusher, `+` pusher on target) and names |
| `js/main.js` | Kaplay init, title / game / complete scenes, movement, undo, progress, buttons, swipe and tap input |
| `dev/browsertest.mjs` | Solver + Playwright test on desktop and touch phones |

## Changelog

### v1.1 (2026-10-04)
- Touch and mouse: swipe or tap beside the pusher to move; Undo, Restart and Menu buttons
- Saved progress: levels unlock in order, best move counts are kept, and the title has a level picker
- WASD as well as arrow keys; a click or tap skips the win screen's wait
- Fixed: skipping the win screen on a touch *press* switched scene mid-touch and left every later swipe ignored, so it now happens on release
- `dev/browsertest.mjs` with a solver; this design doc

### v1.0
- Eight hand-made levels, undo, restart, win and complete screens
