# Game 008: Centipede Tower Defense

**Genre:** Hybrid Centipede / Tower Defense / Space Shooter
**Engine:** Kaplay v4000 (ES6 modules)
**Target Resolution:** 1280 × 720
**Status:** Planning

---

## Concept

A classic Centipede-style game merged with tower defense strategy. A centipede and its allies descend the playfield in the signature zigzag pattern. The player controls a spaceship at the bottom and can also purchase and place auto-firing towers in designated placement slots scattered across the field. Every completed wave earns currency to buy new towers or upgrade existing ones. Obstacles (nodes) litter the field and affect enemy pathing — destroyed enemy segments leave new nodes behind.

---

## Core Mechanics Overview

### 1. The Playfield

A **24 × 18 tile grid** (each tile 48 × 48 px → 1152 × 864, scaled to fit 1280 × 720 with side margins).

Vertical zones:
- **Rows 0–12** — Enemy zone. Centipede spawns and traverses here. Tower placement slots live here.
- **Row 13–14** — Buffer zone. Spider/Flea danger zone. No towers allowed.
- **Rows 15–17** — Player zone. Player ship moves freely. No enemies spawn here (except spiders).

### 2. Nodes (Mushrooms)

- 30–40 randomly placed **nodes** at game start, scattered in the enemy zone.
- Nodes deflect the centipede — it turns and descends one row when it hits a node or the wall.
- A destroyed centipede segment leaves a new node at that position.
- Nodes have 4 HP (one shot to chip, four to destroy).
- Towers placed in tower slots never become nodes.
- Players can shoot nodes away to open lanes.
- A **Poison Node** (created by Scorpion enemies) causes the centipede to rush straight down when touching it.

### 3. The Centipede

- Spawns at the top-left or top-right, traveling horizontally.
- On hitting a wall or node edge: descend one row and reverse direction.
- **12 segments per centipede at wave 1** (head + 11 body).
- Destroying a segment:
  - Leaves a node at that tile.
  - If it was a body segment, it splits the centipede into two independent centipedes (the segment behind becomes a new head).
- The centipede speeds up as it descends further.
- **Reaching the player zone**: centipede reverses direction (now travels upward in player zone — immediately dangerous).
- If the entire centipede is destroyed, the wave is won.

### 4. Player Ship

- Moves **left/right** along the bottom three rows (smooth movement, WASD or arrow keys).
- **Auto-fires** upward every 0.25s (upgradeable).
- Player bullet: single projectile, hits one node or one centipede segment.
- Player also has a limited **Smart Bomb** (AOE) — 3 per wave.
- Player has 3 lives. Centipede reaching the bottom-most row costs 1 life and resets the centipede to the top.
- Spiders entering the player zone are an immediate threat.

### 5. Towers

Towers occupy **tower slots** — pre-designated tiles marked on the grid (approximately 18–24 slots total spread across the enemy zone). Slots are visually distinct (darker tile). Only one tower per slot.

Towers auto-fire at the nearest enemy in range. They do NOT rotate to track; they fire on a fixed cooldown toward the best target in a defined arc.

#### Tower Types

| Tower | Cost | Damage | Fire Rate | Range | Special |
|-------|------|--------|-----------|-------|---------|
| **Blaster** | 150 | 8 | 0.6s | 5 tiles | Basic single shot, full 360° |
| **Sniper** | 300 | 40 | 1.8s | 12 tiles | Pierces all segments in a line |
| **Scatter** | 250 | 5 × 3 pellets | 1.2s | 4 tiles | 3-way spread, great vs clusters |
| **Freeze** | 200 | 2 | 2.0s | 4 tiles | Slows centipede 60% for 2s |
| **Tesla** | 350 | 15 | 1.0s | 5 tiles | Chains to 3 nearby segments |
| **Mortar** | 400 | 35 AOE | 3.0s | 8 tiles | Splash 2-tile radius, destroys nodes |

#### Tower Upgrade Tiers (per tower)

Each tower has **2 upgrade levels** (Tier 1 → Tier 2 → Tier 3).

Example — Blaster:
- T1 (base): 8 dmg, 0.6s rate, 5 tile range
- T2 (+100g): 12 dmg, 0.45s rate, 6 tile range — costs 100g
- T3 (+200g): 18 dmg, 0.3s rate, 7 tile range, dual shot — costs 200g

Sell value: 50% of total invested gold.

### 6. Enemy Roster

| Enemy | Behavior | Threat | Appears Wave |
|-------|----------|--------|--------------|
| **Centipede** | Zigzag descent, splits on hit | Main threat | 1 |
| **Flea** | Drops straight down from random X, creates nodes | Mid threat | 3 |
| **Spider** | Erratic movement in player zone, eats nodes | Danger to player | 5 |
| **Scorpion** | Travels full width of one row, poisons nodes it passes | Tactical threat | 7 |
| **Armored Centipede** | Same as centipede, 2 HP per segment | Hard | 10 |
| **Fast Centipede** | 2× speed | Dangerous | 8 |
| **Giant Centipede** | 20 segments, 3 HP per segment | Boss wave | Every 5 |

### 7. Wave Structure

- **Wave intro**: brief title card (e.g., "Wave 4 — The Flea Invasion")
- Centipede spawns at top, begins traversal
- Special enemies (fleas, spiders, scorpions) spawn mid-wave on a timer
- Wave ends when all centipede segments are destroyed
- **Between waves**: Tower Shop opens for 15 seconds (or manual skip)
- Gold awarded:
  - Base: 75g per wave
  - +5g per segment killed (tracked across wave)
  - +25g bonus for completing wave without losing a life
  - Boss wave: +150g bonus

### 8. Economy

| Action | Gold |
|--------|------|
| Complete wave | 75 |
| Kill centipede segment | 5 |
| Kill Flea | 15 |
| Kill Spider | 25 |
| Kill Scorpion | 30 |
| No-death wave bonus | 25 |
| Boss kill bonus | 150 |
| Sell tower | 50% invested |

Starting gold: **200g** (enough for 1 Blaster or saving toward better).

---

## Technical Architecture

### File Structure

```
game-008/
├── index.html              # Minimal shell, imports main.js
├── game-plan.md            # This file
├── CHANGELOG.md            # Track phase completions
├── lib/
│   └── kaplay/
│       ├── kaplay.js
│       └── kaplay.mjs
└── js/
    ├── main.js             # Kaplay init, scene setup, splash, shop overlay
    ├── config.js           # All constants: grid, towers, enemies, waves
    ├── state.js            # Global mutable state + reset()
    ├── events.js           # EventBus (on/off/emit, cleanup callbacks)
    ├── grid.js             # Tile/node/slot management, coordinate helpers
    ├── centipede.js        # Centipede entity: spawning, movement, splitting
    ├── enemies.js          # Fleas, spiders, scorpions: spawning & AI
    ├── player.js           # Player ship: movement, shooting, smart bomb
    ├── towers.js           # Tower placement, auto-fire, upgrades, selling
    ├── waves.js            # Wave sequencer, special enemy scheduling
    ├── shop.js             # Between-wave tower shop UI (DOM overlay)
    ├── ui.js               # HUD: lives, score, gold, wave counter
    └── sounds.js           # Web Audio API procedural sounds
```

### Module Responsibilities

**main.js**
- Initialize Kaplay (`1280×720`, `pixelDensity: window.devicePixelRatio`)
- Define scenes: `splash`, `game`, `gameover`
- Import and call `init*` from all modules
- Scene cleanup with `onSceneLeave`

**config.js**
- `GRID_COLS = 24`, `GRID_ROWS = 18`, `TILE_SIZE = 48`
- `GRID_OFFSET_X`, `GRID_OFFSET_Y` (to center 1152px in 1280px)
- `TOWER_SLOTS` — array of `{col, row}` for all valid placement spots
- `TOWER_DEFS` — full tower definitions with upgrade tiers
- `ENEMY_DEFS` — centipede types, flea, spider, scorpion
- `WAVE_DEFS` — per-wave composition (centipede type, length, special spawns)
- `STARTING_GOLD`, `STARTING_LIVES`, `NODES_AT_START`

**state.js**
- `score`, `gold`, `lives`, `wave`, `isGameOver`, `isPaused`
- `nodes` — Map of `"col,row"` → node HP
- `towers` — Map of `"col,row"` → tower object
- `centipedes` — array of active centipede chains
- `enemies` — array of active non-centipede enemies
- `selectedTower` — type currently selected in shop for placement
- `reset()` — full state reset for new game

**events.js**
- Shared EventBus singleton
- Events catalog:
  - `segmentKilled` (col, row, centipedeId)
  - `centipedeReachedBottom`
  - `playerHit`
  - `towerPlaced` (type, col, row)
  - `towerSold` (col, row)
  - `waveComplete` (waveNumber)
  - `goldChanged` (newAmount)
  - `scoreChanged` (newScore)
  - `livesChanged` (newLives)
  - `nodeDestroyed` (col, row)
  - `nodePoisoned` (col, row)

**grid.js**
- `tileToWorld(col, row)` → `{x, y}` pixel center
- `worldToTile(x, y)` → `{col, row}`
- `isNodeAt(col, row)` → bool
- `isTowerSlotAt(col, row)` → bool
- `isTowerAt(col, row)` → bool
- `placeNode(col, row, hp)`, `damageNode(col, row)`, `removeNode(col, row)`
- `drawGrid()` — renders tiles, slots, nodes each frame

**centipede.js**
- `Centipede` class: array of segments, each `{col, row, hp, isHead}`
- Movement state machine: `movingRight`, `movingLeft`, `descendingRight`, `descendingLeft`
- `update(dt)` — advance segments based on speed, handle wall/node collision
- `splitAt(segmentIndex)` → two new Centipede instances
- `onSegmentKilled(col, row)` → emit `segmentKilled`, create node, split if mid-chain
- Rendering: draw each segment as a colored circle, head slightly larger

**enemies.js**
- `spawnFlea(col)` — drops straight down, creates nodes as it passes
- `spawnSpider()` — erratic movement in player zone, destroys nodes
- `spawnScorpion(row)` — traverses a row, poisons nodes
- `updateEnemies(dt)` — move all non-centipede enemies
- `drawEnemies()` — render each enemy type distinctly

**player.js**
- `initPlayer()` — spawn ship at bottom-center
- WASD / Arrow key movement, clamped to bottom 3 rows
- Auto-fire timer: fires bullet every `fireRate` seconds
- `smartBomb()` — AOE clear of all enemies in radius
- `onPlayerHit()` — lose a life, respawn, flash invincibility (2s)

**towers.js**
- `placeTower(type, col, row)` — deduct gold, create tower entity
- `sellTower(col, row)` — refund 50%, remove entity
- `upgradeTower(col, row)` — deduct cost, upgrade stats
- `updateTowers(dt)` — iterate all towers, find targets, fire on cooldown
- Target priority: nearest enemy in range (centipede head > body > others)
- `drawTowers()` — distinct visual per tower type

**waves.js**
- `startWave(waveNumber)` — spawn centipede from config, schedule special enemies
- `checkWaveComplete()` — all centipede segments dead AND no active fleas/spiders
- `onWaveComplete()` — award gold, open shop, prepare next wave
- Boss detection: every 5th wave spawns Giant Centipede

**shop.js**
- DOM overlay (not Kaplay canvas) that appears between waves
- Shows all tower types with cost, stats, upgrade costs
- Tower selection enters placement mode on close
- Also shows upgrade/sell options when an existing tower is clicked in-game
- Auto-close after 15s countdown; manual "Start Wave" button

**ui.js**
- HUD drawn each frame:
  - Top-left: Lives (❤️ icons), Wave number
  - Top-right: Score, Gold (🪙)
  - Bottom: Smart Bomb count, current wave name
- Wave complete banner
- Game over overlay

**sounds.js**
- `playShoot()` — high-freq sine blip
- `playSegmentKill()` — satisfying pop (sawtooth ramp down)
- `playPlayerHit()` — low sawtooth buzz
- `playSmartBomb()` — dramatic sweep
- `playTowerPlace()` — positive chime
- `playWaveComplete()` — ascending chord
- `playFleaDrop()` — staccato descending notes
- `playSpiderMove()` — erratic chittering

---

## Development Phases

### Phase 1 — Scaffolding & Grid (Foundation)

**Goal:** Running Kaplay scene with a visible, correct grid.

Tasks:
- [ ] Create `index.html`, link to `js/main.js`
- [ ] Copy `lib/kaplay/` from root lib
- [ ] Implement `config.js` with grid constants and tower slot positions
- [ ] Implement `state.js` with initial values
- [ ] Implement `events.js` (EventBus)
- [ ] Implement `grid.js` — tile drawing, node placement
- [ ] Implement `main.js` — Kaplay init, game scene stub
- [ ] Implement `ui.js` — basic HUD (lives, score, gold, wave)
- [ ] Implement `sounds.js` — stubs + initAudio
- [ ] Random node placement at start (30 nodes in enemy zone)
- [ ] Visual: grid lines, tower slots highlighted, nodes visible

**Deliverable:** A rendered grid with nodes and tower slot highlights.

---

### Phase 2 — Centipede Movement

**Goal:** Centipede traverses the field correctly with splitting behavior.

Tasks:
- [ ] Implement `Centipede` class in `centipede.js`
- [ ] Segment-by-segment movement (head leads, body follows with delay)
- [ ] Wall collision → descend + reverse
- [ ] Node collision → descend + reverse (node takes 0 dmg from centipede)
- [ ] Reaching player zone → centipede becomes urgent threat
- [ ] Segment destroy → split into two centipedes + leave node
- [ ] Speed increases as centipede descends
- [ ] Render: head = large circle w/ eyes, body = smaller circles, colored by type
- [ ] Wire `segmentKilled` events

**Deliverable:** Centipede spawning, traversing, splitting, and looping correctly.

---

### Phase 3 — Player Ship & Shooting ✅ COMPLETE

**Goal:** Playable spaceship that kills centipede segments.

Tasks:
- [x] Implement `player.js` — ship entity in bottom zone
- [x] WASD / Arrow movement (smooth, clamped to player zone)
- [x] Auto-fire bullets upward
- [x] Bullet hits: segment → kill + node, node → damage
- [x] Smart Bomb (3 per wave, `Space` key or `B`)
- [x] Player death: centipede reach bottom or spider collision
- [x] Lives system (3 lives, then game over)
- [x] Invincibility frames after hit (2s flash)
- [x] Wire `playerHit`, `livesChanged`, game over transition
- [x] Player shooting sounds

**Deliverable:** Fully playable core loop — move, shoot, kill centipede, die.

---

### Phase 4 — Tower Placement & Auto-Fire ✅ COMPLETE

**Goal:** Players can place, upgrade, and sell towers that auto-attack.

Tasks:
- [x] Implement `towers.js` — placement, auto-fire, upgrade, sell
- [x] Click on empty tower slot → enter placement mode (if tower selected in shop)
- [x] Click on placed tower → show upgrade/sell panel (DOM popup)
- [x] Implement all 6 tower types with correct behavior:
  - Blaster (single shot, dual-shot at T3)
  - Sniper (piercing column shot — instant hit all in column)
  - Scatter (3-way spread pellets)
  - Freeze (slow debuff on hit — centipede.applySlow)
  - Tesla (chain lightning to up to 3 adjacent segments)
  - Mortar (AOE shell arc, destroys nodes in splash)
- [x] Tower range visualization on hover (showRangeFor / hideRange)
- [x] Implement `shop.js` — right-HUD tower buttons + between-wave DOM overlay
- [x] Gold deduction / refund on place/sell
- [x] Wire `towerPlaced`, `towerSold`, `goldChanged`, `towerClicked` events
- [x] Tower sounds (playTowerPlace on placement)
- [x] Placement cancel on ESC
- [x] Tier badge (T2/T3) on upgraded towers
- [x] Slow support added to Centipede class (applySlow, slowTimer)

**Deliverable:** Full tower economy — buy, place, upgrade, sell.

---

### Phase 5 — Wave System & Special Enemies ✅ COMPLETE

**Goal:** 15+ waves with escalating difficulty and all enemy types.

Tasks:
- [x] Implement `waves.js` with wave sequencer
- [x] Wave definitions in `config.js` for waves 1–20
- [x] Boss waves (5, 10, 15, 20) with Giant Centipede
- [x] Implement `enemies.js`:
  - Flea: drops from top, creates nodes
  - Spider: erratic in player zone, eats nodes
  - Scorpion: traverses a row, poisons nodes
  - Armored Centipede (wave 10+)
  - Fast Centipede (wave 8+)
- [x] Between-wave shop (15s timer, Skip button)
- [x] Gold rewards per wave + kill bonuses
- [x] Wave complete animation + gold notification
- [x] Wave title card on start

**Deliverable:** Complete wave progression with all enemy types.

---

### Phase 6 — Polish & Game Feel

**Goal:** Juice, audio, balance, and UX refinement.

Tasks:
- [ ] Full sound implementation in `sounds.js`
- [ ] Hit effects: particle burst on segment kill
- [ ] Centipede damage flash (white flash per segment hit)
- [ ] Node damage visual (crack effect via opacity/color)
- [ ] Poisoned node visual (green tint)
- [ ] Smart Bomb shockwave animation
- [ ] Tower attack visual effects (laser beam for sniper, arc for tesla, etc.)
- [ ] HUD polish: animated gold counter, score pop
- [ ] Game Over screen with final score and stats
- [ ] Splash screen with rules summary
- [ ] Balance pass: centipede speed, tower cost, gold economy
- [ ] Add game to launcher `gamedata.js`
- [ ] Create `CHANGELOG.md`

**Deliverable:** Shippable, polished game ready for launcher.

---

## Visual Design

### Color Palette

| Element | Color |
|---------|-------|
| Background | `#0a0a14` (near black) |
| Grid lines | `#1a1a2e` (subtle dark blue) |
| Tower slot (empty) | `#1e3a5f` (dark blue highlight) |
| Tower slot (hover) | `#2a5a9f` (bright blue) |
| Node | `#6b5b45` (brown) |
| Node (damaged) | `#8b3a2a` (dark red) |
| Node (poisoned) | `#2a7a2a` (green) |
| Centipede head | `#ff4444` (red) |
| Centipede body | `#cc2222` (darker red) |
| Player ship | `#44aaff` (cyan blue) |
| Player bullet | `#ffff44` (yellow) |
| Flea | `#ff8844` (orange) |
| Spider | `#aa44ff` (purple) |
| Scorpion | `#ff4488` (pink) |

### Tower Visual Styles (drawn via Kaplay primitives)

- **Blaster**: Blue square with small barrel indicator
- **Sniper**: Tall narrow rectangle, bright white tip
- **Scatter**: Wider square, 3 small barrels fanning out
- **Freeze**: Cyan diamond shape, icy glow effect
- **Tesla**: Yellow circle with lightning arc decoration
- **Mortar**: Heavy gray square, large angled barrel

---

## Scoring System

| Event | Points |
|-------|--------|
| Centipede segment kill | 10 |
| Centipede head kill | 25 (bonus) |
| Flea kill | 200 |
| Spider kill | 300–900 (distance-based) |
| Scorpion kill | 1000 |
| Wave complete | wave# × 100 |
| No-death wave bonus | 500 |
| Boss kill | 5000 |
| Node destroyed | 1 |

Spider scoring scales with how far into the player zone it ventured — classic Centipede rule.

---

## Key Design Principles

1. **Centipede feels authentic** — the signature side-to-side descent with node deflection must feel exactly right. Speed and behavior must match the classic arcade feel.

2. **Towers complement, don't replace, the player** — towers clear upper-field segments; player handles close-range threats and spiders. Neither alone can win.

3. **Node field is strategic** — nodes aren't just obstacles. Smart players clear lanes for towers; smart play preserves nodes that deflect centipedes into tower kill zones.

4. **Economy always offers choices** — players should never have too much gold. Tension between upgrading existing towers vs. buying new ones is key.

5. **Escalating urgency** — each wave should feel slightly more dangerous. By wave 10, the field is chaotic with multiple centipede fragments, fleas, and spiders simultaneously.

---

## Architecture Notes (From Learnings.md)

- Use **EventBus with cleanup callbacks** (`onSceneLeave`) to prevent listener accumulation
- Use **array format for RGBA colors**: `[r, g, b, a]` not `k.rgba()` (Kaplay v4000)
- **Never replace `entity.onUpdate`** — always call `entity.onUpdate(() => {...})` to add callbacks
- Use **`pixelDensity: window.devicePixelRatio`** for crisp rendering
- Keep modules under **500 lines** — split if growing large
- **Tag-based wave tracking** — use `k.get('wave_N')` not counters
- **Spawn validation** — check tile walkability before placing anything

---

**Document Version:** 1.5
**Created:** 2026-02-21
**Last Updated:** 2026-02-21
**Status:** Phase 5 complete — Phase 6 next (Polish & game feel)
