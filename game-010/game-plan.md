# Tiny Town

**Genre:** City Builder / Sandbox
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Phase 4 — Polish

---

## Concept

A cozy city builder sandbox where you place roads, houses, parks, and shops on a grid to grow a small town.

There are no enemies or fail states — just the satisfying loop of watching a blank grid become a living neighbourhood. Players manage a gold budget, choosing where to invest to maximise their town score. The tone is warm and low-pressure, like drawing a map of a place you'd want to live in.

---

## Core Mechanics

### 1. Grid Placement
A 24 × 16 tile grid is the town canvas. Click or click-drag to paint tiles with the currently selected building type. Tiles can be overwritten by using the Clear tool first.

### 2. Building Types
| Type       | Cost  | Score | Notes |
|------------|-------|-------|-------|
| Road       | 10g   | +1    | Connects zones; required by commercial/civic |
| House      | 50g   | +10   | Residential; benefits from nearby parks |
| Apartment  | 120g  | +25   | Dense residential; needs road access |
| Park       | 30g   | +5    | Green space; boosts happiness & house bonuses |
| Shop       | 80g   | +20   | Commercial; needs road access; generates income |
| Office     | 150g  | +35   | Commercial; needs road access; generates income |
| Bank       | 200g  | +50   | Financial; needs road access; generates income |
| Government | 250g  | +60   | Civic; needs road access; generates income |
| Clear      | free  | 0     | Removes a tile; 50% refund |

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
- [x] Score bonus when house is adjacent to a park (+5 per qualifying house, recalculated on every place/clear)
- [x] Shops require at least one adjacent road tile to place
- [x] Visual indicator on tiles with active bonuses (yellow `+` badge on house; `Bonus: +N` in HUD)

### Phase 3 — Population & Income
- [x] Population counter driven by houses + road access
- [x] Passive gold income tick based on shops in the grid
- [x] Happiness meter: parks boost happiness, which multiplies income

### Phase 4 — Polish
- [x] Animated tile "pop" on placement (scale lerp 0.4→1.0 over 0.12 s via onUpdate)
- [x] Undo last placement (Ctrl+Z — full undo stack, gold & score restored)
- [x] Save/load town to localStorage (Ctrl+S / Ctrl+L, toast confirmation)
- [x] Background ambient music (Web Audio looping chord pads, M to toggle)

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

### Phase 4 — Visual Polish (2026-02-25)
- terrain.js: new module — generateTerrain() seeds biome map (field/grassland/mountain/lake) using inverse-distance weighted noise; drawTerrainLayer() renders background tiles with per-biome detail marks
- config.js: TERRAIN / TERRAIN_KEYS constants; 4 new building types: apartment, office, bank, government (each with label, color, cost, scoreValue, icon)
- config.js: all BUILDINGS entries now have `icon` field (null for road/clear)
- main.js: import terrain module; generateTerrain() on scene enter; drawTerrainLayer() after gridToScreen; drawTile() uses def.icon instead of hardcoded letter map; keyboard shortcuts auto-generated from BUILDINGS order (1–9); commercial/civic road requirement expanded to shop/office/bank/government
- population.js: apartment counts toward population; office/bank/government count toward income
- ui.js: panel buttons compacted to fit 9 entries (BTN_H=34, BTN_STEP=38); key number badge + colour swatch on each button

### Phase 4 — Polish (2026-02-25) continued
- animations.js: new module — cars drive along road tiles (max 10, respawn every ~6 s + on road placement); dollar signs float upward from shop tiles on each income tick
- main.js: import initAnimations; call after initUI, passing gridToScreen helper

### Phase 4 — Polish (2026-02-25)
- main.js: tile pop-in animation (scale 0.4→1.0 over 0.12 s, anchor center, onUpdate lerp)
- main.js: undo stack (Ctrl+Z) — restores tile, gold, score; works for place and clear
- main.js: Ctrl+S / Ctrl+L save/load via storage.js; toast on success
- main.js: M key toggles ambient music; startAmbient on scene enter, stopAmbient on leave
- storage.js: new module — saveGame/loadGame/hasSave using localStorage JSON
- sounds.js: startAmbient/stopAmbient/toggleAmbient — detuned sine pad chords cycling I–V–III–sus2
- ui.js: _showToast() generalised (colour param); _showIncomeToast delegates to it; toastMessage event
- ui.js: controls hint updated with new key bindings
- Splash version tag updated to Phase 4

### Phase 3 — Population & Income (2026-02-25)
- population.js: recalcPopulation, startIncomeTick
- Population = houses with adjacent road; recalculated on every place/clear
- Happiness = parks × 10% (capped at 100%); recalculated on every place/clear
- Passive income: every 5 s, shopCount × 10g × happiness multiplier (0.5–1.0)
- Income toast: "+Ng" flash in HUD on each tick
- HUD second row: Pop and Happiness labels
- state.js: population, happiness fields; addGold method
- config.js: INCOME_TICK_SECONDS, INCOME_PER_SHOP, HAPPINESS_PER_PARK, HAPPINESS_INCOME_MULT_MIN
- Splash version tag updated to Phase 3

### Phase 2 — Adjacency Rules (2026-02-25)
- adjacency.js: neighbour helpers, hasAdjacentRoad, recalcBonuses
- Shop placement requires adjacent road (reuses no-gold sound on fail)
- House-park bonus: +5 per house next to ≥1 park, recalculated on every place/clear
- Bonus `+` badge overlay drawn on qualifying house tiles
- HUD shows `Bonus: +N` when bonuses are active
- state.js: adjacencyBonuses Map
- Splash version tag updated to Phase 2

### Phase 1 — Scaffold (2026-02-25)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- 24 × 16 grid with click and drag-to-paint
- 5 building types with gold costs and score values
- Build panel with keyboard shortcuts (1–5)
- HUD: score, gold, title, controls hint
