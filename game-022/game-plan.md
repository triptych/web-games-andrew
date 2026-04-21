# Depths Unknown

**Genre:** 2D Mining / Progression RPG (Motherload-style)
**Engine:** Phaser 4.0.0 (ES6 modules)
**Target Resolution:** 480 × 720 (portrait, mobile-first)
**Status:** Phase 1 Complete

---

## Concept

You are AXIOM-7, a prospector-class autonomous mining drone activated in the ruins of the Delverhaven colony — a settlement that vanished 200 years ago after drilling too deep. Your directive: extract enough value to fund a full excavation and discover what happened.

As you drill deeper you pass through geological strata that shouldn't coexist — medieval mines with iron scaffolding, crystalline caverns radiating arcane heat, cyclopean ruins predating human civilization, the fossilized hull of something enormous that impacted from orbit, and finally the Void Layer where physics begins to bend.

Tone: gritty, lonely, mysterious. Lore entries unlock as you reach depth milestones. The Singing Vein — a seam fusing magic and machine — is the narrative goal.

---

## Core Mechanics

### 1. Drilling
Each block has hardness (1–10). Drill power starts at 1 and improves with upgrades. Drill time = `ceil(hardness / drillPower) × 0.15s`. The Void Drill (tier 5) is instant on any block.

### 2. Fuel System
Fuel burns at 0.8 units/sec while moving/drilling, 1.2 units/sec while winching up, 0.1 units/sec idle. Empty fuel causes 2 hull damage/sec. Rescue costs 200 credits + 20% cargo.

### 3. Hull Integrity
Hull starts at 100 HP. Lava deals 3/sec, cave-ins deal 5–25, fuel-empty deals 2/sec. Hull reaching 0 destroys the machine and loses all cargo (credits kept). Hull Nanites upgrade auto-repairs 1 HP/sec.

### 4. Cargo Hold
10 slots base, upgradeable to 65. Each ore takes 1 slot (stackable up to stack size). Full cargo slows movement. Auto-sold on base arrival.

### 5. Progression Loop
Deploy → Drill down → Collect ore → Manage fuel/hull → Return to base → Sell → Upgrade → Go deeper.

### 6. Fog of War
Tiles outside light radius are black (unexplored) or darkened (explored). Light radius upgrades from 3 to 14 tiles. Sonar Pulse upgrade adds ore pings.

---

## Game Loop

Each run: deploy from base with full fuel, drill down as far as resources allow, collect valuable ores, winch back up before fuel runs out (or use Recall Flare for instant return). At base: auto-sell cargo, buy upgrades/consumables, then deploy again. The world is persistent — holes you dug remain. Credits carry between deaths.

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Move left | A / Left Arrow |
| Move right | D / Right Arrow |
| Drill / move down | S / Down Arrow |
| Winch up | W / Up Arrow |
| Use consumable | Space |
| Pause | P / Escape |

Mobile: virtual d-pad rendered by UIScene when mobile device detected.

---

## Progression / Difficulty

7 depth tiers, each with harder blocks, rarer/more valuable ores, and increasing hazards (lava pockets, cave-ins, void anomalies). Bedrock strips every 50 rows force navigation decisions. Upgrade costs scale from 300 cr (fuel tank) to 25,000 cr (Void-Tempered Hull). Deepest reachable depth: 6,400m (Void Layer).

---

## UI / HUD

**Top bar:** depth meter (meters), tier name (fades in on tier transition), credit counter.

**Bottom HUD (110px):** Hull bar (red, flashes below 25%), Fuel bar (orange, turns red below 20%), Cargo bar (green, amber when full), upgrade indicator row.

**Alerts (center screen):** LOW FUEL, HULL CRITICAL, CARGO FULL, depth records, lore messages.

**Mobile:** virtual d-pad (bottom-left) + USE button (bottom-right), shown only on mobile.

---

## World Generation

- 120 × 400 tile grid (16px tiles = 1920 × 6400 world pixels)
- Seeded LCG RNG — same seed = same world per session, new seed on New Game
- Per-tier fill block, ore spawns via weighted table, lava pockets, cellular automata caves (tiers 3–6)
- Bedrock border columns + horizontal strips with 3-tile gaps every 50 rows
- Guaranteed entry shaft at columns 57–63, rows 0–5
- Singing Vein cluster pre-placed in Void Layer (rows 355–375)

---

## Sound Design

All sounds procedural via WebAudio API — no audio files.

| Sound | Trigger | Style |
|-------|---------|-------|
| Drill | Block drilling | Sawtooth sweep + noise |
| Engine hum | Moving/drilling | Low sine, pitch varies with speed |
| Ore collect | Collecting ore | Ascending triangle arpeggio, pitch by tier |
| Hull damage | Taking damage | Noise burst + downward sweep |
| Lava hiss | Near lava | Low-pass noise |
| Low fuel alarm | Fuel < 20% | Square wave 880Hz beep |
| Hull critical alarm | Hull < 25% | Square wave 1200Hz, fast |
| Cave-in | Rock collapses | Low noise burst + thud |
| Singing Vein | Discovery | Ethereal harmonic arpeggio |
| Base arrival | Return to base | Major chord arpeggio |
| Upgrade | Buying upgrade | 4-note ascending arpeggio |
| Teleport | Using beacon | Frequency sweep 200→2000Hz |
| Ambient | Per tier | Low sine drone, deeper by tier |

---

## Ore Types (16 total)

| Name | Tier | Value | Hardness |
|------|------|-------|----------|
| Coal | 0 | 5 cr | 2 |
| Copper Ore | 0–1 | 8 cr | 3 |
| Iron Ore | 0–1 | 12 cr | 3 |
| Silver Ore | 1–2 | 30 cr | 4 |
| Gold Ore | 2 | 75 cr | 5 |
| Ruby | 2 | 100 cr | 5 |
| Mithril Ore | 2–3 | 180 cr | 6 |
| Magic Crystal | 3 | 220 cr | 6 |
| Dragon Bone | 3 | 280 cr | 7 |
| Spirit Essence | 3–4 | 350 cr | 7 |
| Dragon Heart | 4 | 500 cr | 8 |
| Xenite | 4–5 | 420 cr | 7 |
| Ancient Relic | 4 | 600 cr | 8 |
| Nanite Cluster | 5 | 750 cr | 8 |
| Crashed Alloy | 5–6 | 900 cr | 9 |
| Void Crystal | 5–6 | 1,100 cr | 9 |
| Singing Vein | 6 | 2,500 cr | 10 |
| Null Matter | 6 | 2,000 cr | 10 |
| Core Essence | 6 | 3,500 cr | 10 |

---

## Upgrades (38 total across 7 categories)

Categories: Hull (5 tiers), Drill (5 tiers), Fuel Tank (5 tiers), Engine (5 tiers), Cargo Hold (5 tiers), Lights (5 tiers), Special (8 one-off upgrades). See `js/data/upgrades.js` for full table with costs and unlock depths.

---

## Phases

### Phase 1 — Foundation (2026-04-21)
- [x] Scaffold: index.html, config, ores, upgrades, lore data files
- [x] WorldGen: seeded procedural generation, 7 tiers, caves, bedrock strips
- [x] GameState: persistent localStorage save/load, full upgrade system
- [x] Player: tile-based movement, drilling, fuel/hull, cave-ins, lava damage
- [x] TileRenderer: chunked rendering, fog of war, ore highlights
- [x] SoundManager: procedural WebAudio (drill, engine, ore collect, alarms, ambient)
- [x] InputManager: keyboard + mobile d-pad normalized actions
- [x] All scenes: Boot, Preload, Splash, Game, UI, Base, GameOver
- [x] BaseScene: sell cargo, 7-category upgrade shop, consumables store
- [x] UIScene: HUD bars, alerts, lore display, mobile d-pad, pause overlay
- [x] Launcher: added to gamedata.js

### Phase 2 — Polish
- [ ] Particle effects (drill sparks, ore collect burst, hull damage flash)
- [ ] Background gradient per tier (lerped as camera descends)
- [ ] Void anomaly entities (drifting hazards in Void Layer)
- [ ] Seismic scan consumable implementation
- [ ] Save explorer tiles to localStorage

### Phase 3 — Content & Endings
- [ ] Hostile entities (Crystal Golems tier 3, Alien Drones tier 5, Void Wraiths tier 6)
- [ ] 3-fragment Singing Vein quest + ending cutscene at 6400m
- [ ] Full lore log screen (accessible from base)
- [ ] Minimap (Depth Radar upgrade)

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `js/main.js` | Phaser.Game init, scene boot |
| `js/config.js` | All constants, depth tiers, color palette |
| `js/data/ores.js` | Block/ore definitions and tier spawn tables |
| `js/data/upgrades.js` | Upgrade tree + consumables catalog |
| `js/data/lore.js` | Depth milestone lore strings + story text |
| `js/systems/GameState.js` | Singleton persistent state, upgrade application |
| `js/systems/WorldGen.js` | Seeded procedural world generation |
| `js/systems/Player.js` | Machine movement, drilling, fuel/hull logic |
| `js/systems/TileRenderer.js` | Chunked tile drawing + fog of war |
| `js/systems/InputManager.js` | Keyboard + touch d-pad normalized to action booleans |
| `js/systems/SoundManager.js` | Procedural WebAudio sound effects + ambient |
| `js/scenes/BootScene.js` | Boot → Preload |
| `js/scenes/PreloadScene.js` | World gen, state load, passes data via registry |
| `js/scenes/SplashScene.js` | Title screen, new game / continue |
| `js/scenes/GameScene.js` | Core game loop, camera, lore triggers |
| `js/scenes/UIScene.js` | HUD, alerts, lore display, mobile d-pad |
| `js/scenes/BaseScene.js` | Sell cargo, upgrades, consumables shop |
| `js/scenes/GameOverScene.js` | Machine destroyed — rebuild or new game |

---

## Open Questions

- [ ] Should explored tiles persist across browser reloads? (currently lost on reload)
- [ ] Balance: is the early-game economy too tight or too generous?
- [ ] Should diagonal drilling be visible in the UI (diagonal move animation)?
- [ ] Void anomalies: patrol pattern or random drift?

---

## Changelog

### Phase 1 — Full Scaffold (2026-04-21)
- Full playable scaffold: world gen, drilling, fuel/hull, fog of war, 7 scenes
- 16 ore types, 38 upgrades, 10 consumables, 7 depth tiers
- Procedural WebAudio sounds, no external assets
- Mobile d-pad support, localStorage persistence
