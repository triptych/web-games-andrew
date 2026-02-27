# Nonogram Fleet

**Genre:** Puzzle / Strategy
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Complete

---

## Concept

Fill in nonogram puzzles to reveal the hidden positions of enemy spaceships, then fire
torpedoes to sink the fleet with your limited supply of shots.

The player faces a 10×10 nonogram grid whose solution encodes the layout of an enemy
battleship fleet. Solving the nonogram correctly (or even partially) tells you exactly
where to fire — but you only have a fixed number of torpedo shots per level, so every
cell mark matters. Levels escalate by increasing fleet density, adding decoy clue rows,
and shrinking the shot budget.

---

## Core Mechanics

### 1. Nonogram Solving
A classic picross/nonogram: row and column clues (e.g. "3", "1 2") tell you how many
consecutive filled cells exist in that line and in what order. Left-click to fill a
cell, right-click to mark it as definitely empty (an X). Clue numbers highlight green
when the line is satisfied.

### 2. Hidden Fleet
Behind the nonogram is a Battleship-style enemy fleet (Carrier 5, Battleship 4, two
Cruisers 3, two Submarines 2, two Scouts 1). Ships are placed randomly (horizontal
or vertical, no overlap, no adjacency). The nonogram clues are derived directly from
the fleet grid — solving the nonogram is equivalent to locating all ships.

### 3. Torpedo Fire
Once you've deduced where a ship lies you fire torpedoes with Space / click in a
separate "fire mode". Each fired shot costs one of your limited shots. A hit reveals
an orange flame; a miss shows a ripple. Sink every ship to clear the level.

### 4. Shot Budget
Each level provides a fixed shot budget (default 15). Wasting shots on known-empty
cells costs you — if the budget hits zero with ships still afloat, you lose a life
and retry the level.

### 5. Deduction Scoring
Bonus points are awarded for identifying ship positions through pure nonogram logic
without guessing. Hitting a correctly deduced cell scores 2× vs a random guess.

### 6. Level Escalation
8 hand-crafted (seeded) fleet configurations, each with tighter ship packing, reduced
shot budgets, and optional "ghost" ships whose segments don't trigger a hit sound
until an adjacent cell is also hit.

---

## Game Loop

1. **Level start** — enemy fleet is placed on the hidden 10×10 grid; nonogram clues
   are computed from the fleet.
2. **Solve phase** — player fills/marks cells on the nonogram to deduce ship positions.
   No shots yet; pure logic.
3. **Fire phase** — player fires torpedoes one at a time. Each hit/miss is revealed
   with animation and sound.
4. **Level end** — if all ships sunk → score tally → next level. If shots depleted →
   lose a life → retry same level.
5. **Game over** — lives reach 0; show final score and option to restart.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Fill cell | Left Click |
| Mark empty (X) | Right Click |
| Fire torpedo | Space / Click in fire mode |
| Toggle solve / fire mode | Tab |
| Pause | P |
| Restart level | R |
| Main menu | Escape |

---

## Progression / Difficulty

| Level | Ships | Shot Budget | Special |
|-------|-------|-------------|---------|
| 1 | Carrier + Submarine | 15 | Tutorial hints |
| 2 | +Battleship | 15 | — |
| 3 | Standard fleet | 15 | — |
| 4 | Standard fleet | 13 | — |
| 5 | Dense fleet | 12 | Ghost ship introduced |
| 6 | Dense fleet | 11 | 2 ghost ships |
| 7 | Dense + Scout x4 | 10 | Scrambled clue row |
| 8 | Full fleet + decoys | 9 | Boss level |

---

## UI / HUD

- **Top-left**: Score
- **Top-right**: Lives remaining
- **Bottom-left**: Shots remaining (turns red below 5)
- **Bottom-right**: Current level
- **Grid area**: 10×10 nonogram with row/col clues (satisfied clues turn green)
- **Status banner**: Floating text for "HIT!", "MISS", "SHIP SUNK", "LEVEL CLEAR"
- **Mode indicator**: Small label showing "SOLVE" or "FIRE" mode

---

## Sound Design

| Sound | Trigger | Style |
|-------|---------|-------|
| Cell click | Fill/clear nonogram cell | Short sine blip |
| Clue satisfied | Row/col clue turns green | Soft ascending pair |
| Fire | Torpedo launched | Low thud + sawtooth sweep |
| Hit | Torpedo hits ship | White noise burst + crunch |
| Miss | Torpedo hits water | Sine splash fade |
| Ship sunk | All segments destroyed | Ascending triangle notes |
| Level complete | All ships sunk | Short fanfare |
| Puzzle failed | Shots depleted | Descending sawtooth |
| Game over | All lives lost | Long descending gloom |
| UI click | Menu buttons | Short sine 660 Hz |

---

## Phases

### Phase 1 — Foundation ✓ COMPLETE
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] fleet.js — random ship placement on hidden 10×10 grid
- [x] puzzle.js — compute nonogram clues from fleet grid

### Phase 2 — Core Puzzle Loop ✓ COMPLETE
- [x] Render nonogram grid with row/col clues (grid.js)
- [x] Left/right click cell interaction (fill / mark X)
- [x] Clue satisfaction detection and green highlight
- [x] "SOLVE" vs "FIRE" mode toggle (Tab)

### Phase 3 — Combat ✓ COMPLETE
- [x] Torpedo fire mechanic — hit/miss reveal
- [x] Ship sunk detection and animation
- [x] Shot budget enforcement and life loss
- [x] Level transition and score tally

### Phase 4 — Polish ✓ COMPLETE
- [x] 8 seeded fleet configurations
- [x] Ghost ship mechanic (level 5+)
- [x] Deduction scoring bonus
- [x] Particle effects for hits/sinks
- [x] Tutorial hints on level 1

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | ui |
| `livesChanged` | newLives | state | ui |
| `shotsChanged` | remaining | state | ui |
| `cellFilled` | row, col | puzzle | puzzle (clue check) |
| `cellCleared` | row, col | puzzle | puzzle (clue check) |
| `shotFired` | row, col | fleet | fleet (hit check) |
| `shipHit` | row, col, shipName | fleet | ui, sounds |
| `shipSunk` | shipName | fleet | state, ui, sounds |
| `puzzleSolved` | — | puzzle | main (unlock fire mode) |
| `puzzleFailed` | — | state | ui, sounds |
| `levelComplete` | — | state | main |
| `gameOver` | — | state | ui, sounds |
| `gameWon` | — | state | ui, sounds |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`   | Kaplay init, scene definitions, input routing |
| `config.js` | Grid constants, fleet definitions, color palette |
| `events.js` | EventBus singleton |
| `state.js`  | GameState singleton (score, lives, shots, grids) |
| `sounds.js` | Web Audio API sound effects |
| `ui.js`     | HUD rendering, banners, game-over screen |
| `fleet.js`  | (TODO) Ship placement, hit detection |
| `puzzle.js` | (TODO) Nonogram clue generation and rendering |

---

## Open Questions

- [ ] Should the player be able to fire at any time, or only after the nonogram is fully solved?
- [ ] Do we show a preview of ship shapes before the level starts?
- [ ] Should "marks" (right-click X cells) persist across a retry?
- [ ] Ghost ship: does it show as a miss on first hit, or is it simply invisible until 2+ adjacent hits?

---

## Changelog

### Phase 1 — Foundation (2026-02-26)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- Defined full event catalog and fleet configuration in config.js
- fleet.js: random ship placement with no-overlap and no-adjacency rules; fireAt() with hit/miss/sunk detection
- puzzle.js: computeClues(), initPuzzle(), setCell(), checkLineSatisfied(), isPuzzleSolved()
- main.js: wired initFleet + initPuzzle into game scene

### Phase 3 — Combat (2026-02-27)
- Sounds wired to all fire/hit/miss/sunk/levelComplete/puzzleFailed/gameOver events
- Sunk ship cells revealed red on grid via shipSunk event in grid.js
- Shots label turns red at 5 or fewer remaining
- Level complete tally overlay: shots-remaining bonus, total score, NEXT LEVEL button
- 8 level configs in config.js: progressive fleet density and reduced shot budgets
- state.resetLevel() accepts per-level shot override; main.js passes levelCfg

### Phase 2 — Core Puzzle Loop (2026-02-26)
- grid.js: renders 10×10 nonogram grid with row/col clue labels; pixelToCell() hit-testing
- Clue labels turn green when their row/col is satisfied; react to cellFilled/cellCleared events
- Left-click fills cells (toggles); right-click marks empty (X, toggles); clicking again clears
- Tab toggles SOLVE/FIRE mode; mode label at bottom-centre updates accordingly
- FIRE mode: left-click or Space fires at hovered cell; hit/miss revealed on grid
- state.resetLevel() added to preserve score/lives/level across retries and level advances
- Puzzle solved event auto-switches to fire mode; level complete advances level; puzzleFailed loses a life
- Intro/how-to-play scene added (splash → intro → game flow); mini nonogram diagram and mode-box helpers
- fireAt() changed: hits are free (no shot consumed), only misses cost a shot
- puzzle.js: cellMarked event emitted for null↔empty transitions to trigger grid redraws
- ui.js: banner onUpdate cleanup changed to ctrl.cancel() (Kaplay API fix)
