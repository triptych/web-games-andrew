# Pixel Picross

**Genre:** Puzzle / Logic
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 900 × 680
**Status:** Phase 1 — Complete

---

## Concept

Classic nonogram (Picross) puzzle game. Number clues on each row and column
tell you how many consecutive filled squares exist in that line. Fill the grid
correctly to reveal a hidden pixel-art image.

The game features 5 hand-crafted puzzles scaling from a tiny 5×5 Heart to a
10×10 Rocket, teaching the solving technique organically. Drag-paint support
lets you fill entire rows in one smooth motion.

---

## Core Mechanics

### 1. Fill cells (left click / drag)
Click a cell to fill it. Click again to clear it. Hold and drag to paint a
run of cells with the same value.

### 2. Mark cells (right click / drag)
Right-click to place an X mark indicating "definitely empty". Useful for
elimination. Right-click again to clear the mark.

### 3. Clue deduction
Row clues appear to the left; column clues stack above each column. Each
number is the length of a consecutive run of filled squares in that line.

### 4. Win detection
The puzzle is solved the instant every solution cell is filled and no extra
cells are filled. Marked (X) cells do not count as filled.

### 5. Drag-paint
Pressing and holding a mouse button sets a "paint value" for the session.
Moving the mouse over additional cells applies the same value, enabling quick
row/column fills.

---

## Game Loop

Splash → game(0) → solve puzzle → celebration overlay
  → game(1) → ... → game(4) → complete scene → game(0) or splash

---

## Player Controls

| Action | Input |
|--------|-------|
| Fill / unfill cell | Left click |
| Mark / unmark cell (X) | Right click |
| Drag-paint | Hold button + drag |
| Restart puzzle | R |
| Return to menu | Escape |
| Next puzzle (after win) | Space |

---

## Puzzles

| # | Name    | Grid  | Difficulty |
|---|---------|-------|------------|
| 1 | Heart   | 5×5   | Beginner   |
| 2 | Diamond | 7×7   | Easy       |
| 3 | Plus    | 7×7   | Easy       |
| 4 | Tree    | 8×8   | Medium     |
| 5 | Rocket  | 10×10 | Hard       |

---

## UI / HUD

- Puzzle title + emoji in header (e.g. "❤️ Puzzle 1 / 5 — Heart")
- Row clues right-aligned to the left of the grid
- Column clues bottom-aligned above each column
- Footer key-binding reminder
- Win overlay: "Solved!" + puzzle name + SPACE to continue

---

## Sound Design

| Sound | Trigger | Style |
|-------|---------|-------|
| Fill  | Cell filled | Short square-wave blip |
| Mark  | Cell marked X | Softer sine tick |
| Win   | Puzzle solved | Rising 5-note arpeggio |
| AllComplete | All puzzles done | Grand fanfare |
| UIClick | Start game | Quick blip |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`    | Kaplay init, scene definitions, grid/mouse logic |
| `puzzles.js` | Puzzle solution grids and metadata |
| `sounds.js`  | Web Audio API sound effects |

---

## Phases

### Phase 1 — Foundation (2026-04-01)
- [x] Scaffold: index.html, main.js, puzzles.js, sounds.js
- [x] Five hand-crafted puzzles (5×5 → 10×10)
- [x] Left/right click fill & mark with drag-paint
- [x] Win detection and celebration overlay
- [x] Scene flow: splash → game → complete
- [x] Dynamic layout — grid centred with clue margins

### Phase 2 — Polish (future)
- [ ] Clue "completed" highlighting per line
- [ ] Timer / move counter per puzzle
- [ ] Mistake indicator (optional strict mode)
- [ ] Additional puzzle packs

---

## Changelog

### Phase 1 — Scaffold (2026-04-01)
- Initial implementation: 5 puzzles, full play loop, drag-paint, win detection
