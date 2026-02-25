# Tiny Town

**Genre:** City Builder / Sandbox
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Planning — Phase 1

---

## Concept

A cozy city builder sandbox where you place roads, houses, parks, and shops on a grid to grow a small town.

There are no enemies or fail states — just the satisfying loop of watching a blank grid become a living neighbourhood. Players manage a gold budget, choosing where to invest to maximise their town score. The tone is warm and low-pressure, like drawing a map of a place you'd want to live in.

---

## Core Mechanics

### 1. Grid Placement
A 24 × 16 tile grid is the town canvas. Click or click-drag to paint tiles with the currently selected building type. Tiles can be overwritten by using the Clear tool first.

### 2. Building Types
| Type  | Cost | Score | Notes |
|-------|------|-------|-------|
| Road  | 10g  | +1    | Connects zones; should border houses/shops |
| House | 50g  | +10   | Residential; benefits from nearby parks |
| Park  | 30g  | +5    | Green space; future adjacency bonus source |
| Shop  | 80g  | +20   | Commercial; needs road access |
| Clear | free | 0     | Removes a tile; does not refund gold |

### 3. Gold Economy
Players start with 500 gold. Each placement costs gold. There is no income loop in Phase 1 — the constraint is budget management. Future phases may add a passive income tick based on town composition.

### 4. Tool Selection
The build panel on the right lists all tools with their cost. Keys 1–5 are shortcuts. The active tool is highlighted in the panel.

### 5. Drag-to-Paint
Holding the left mouse button and dragging paints multiple tiles continuously — great for laying roads.

### 6. Sandbox Reset
Press R to start a fresh town. The grid, gold, and score reset instantly.

---

## Game Loop

1. Start with an empty 24 × 16 grid and 500 gold.
2. Select a building type from the panel (or press 1–5).
3. Click or drag tiles to place buildings, spending gold.
4. Watch the score increase as buildings fill the grid.
5. When gold runs out, review the town. Press R to start over and try a different layout.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Place building | Left Click / Click-drag |
| Select Road | 1 |
| Select House | 2 |
| Select Park | 3 |
| Select Shop | 4 |
| Select Clear | 5 |
| Pause | P |
| Restart | R |
| Menu | Escape |

---

## Progression / Difficulty

Phase 1 is a pure sandbox — no win condition, no timer. Future phases may add:
- **Score targets** per zone (hit 500 points to unlock more gold)
- **Population counter** driven by house + road + park adjacency rules
- **Happiness meter** that gates unlocking shop tiles
- **Challenge modes**: limited gold, required layouts, time pressure

---

## UI / HUD

- **Top bar**: Score (left), Gold (left), game title (centre), hotkey reminder (right)
- **Right panel** (200 px wide): Build tool buttons with label, cost, colour swatch; highlighted when selected
- **Grid**: Dark background, subtle grid lines, coloured tile fills, small letter labels (H/P/$) on non-road tiles
- **Hover highlight**: White semi-transparent overlay on the tile under the cursor

---

## Sound Design

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Tool selected or splash start | Short sine blip (660 Hz) |
| Place (generic) | House or shop placed | Two-note soft tone |
| Place Road | Road tile placed | Short triangle pulse |
| Place Park | Park tile placed | Cheerful two-note chime |
| Clear | Tile removed | Short downward sweep |
| No Gold | Placement attempted with insufficient funds | Low buzzing square wave |
| Success | (future: score milestone) | Ascending 4-note arpeggio |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] 24 × 16 grid with click and drag-to-paint placement
- [x] 5 building types: road, house, park, shop, clear
- [x] Gold economy (spend on place, no refund)
- [x] Build panel with tool selection (mouse + 1–5 keys)
- [x] HUD: score + gold counters
- [x] Hover highlight on grid

### Phase 2 — Adjacency Rules
- [ ] Score bonus when house is adjacent to a park
- [ ] Shops require at least one adjacent road tile to place
- [ ] Visual indicator on tiles with active bonuses

### Phase 3 — Population & Income
- [ ] Population counter driven by houses + road access
- [ ] Passive gold income tick based on shops in the grid
- [ ] Happiness meter: parks boost happiness, which multiplies income

### Phase 4 — Polish
- [ ] Animated tile "pop" on placement (scale tween)
- [ ] Undo last placement (Ctrl+Z)
- [ ] Save/load town to localStorage
- [ ] Background ambient music (Web Audio looping pads)

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | ui |
| `goldChanged` | newGold | state | ui |
| `buildingPlaced` | col, row, type | main | (future: adjacency system) |
| `buildingCleared` | col, row | main | (future: adjacency system) |
| `selectedToolChanged` | toolName | state | ui |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js`   | Kaplay init, grid rendering, placement logic, scene definitions |
| `config.js` | Canvas size, grid dimensions, building definitions, color palette |
| `events.js` | EventBus singleton |
| `state.js`  | GameState singleton (score, gold, grid array, selected tool) |
| `sounds.js` | Web Audio API sound effects |
| `ui.js`     | HUD top bar, build panel, event subscriptions |

---

## Open Questions

- [ ] Should clearing a tile refund partial gold?
- [ ] What should the score represent — population, happiness, property value?
- [ ] Is there a "town name" input for personalisation?
- [ ] Add a mini-map once the grid gets larger in future phases?

---

## Changelog

### Phase 1 — Scaffold (2026-02-25)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- 24 × 16 grid with click and drag-to-paint
- 5 building types with gold costs and score values
- Build panel with keyboard shortcuts (1–5)
- HUD: score, gold, title, controls hint
