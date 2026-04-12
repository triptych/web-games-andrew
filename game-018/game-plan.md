# Village of the Wandering Blade

**Genre:** Action RPG / Village Builder
**Engine:** Three.js r165 (ES6 modules, CDN)
**Target Resolution:** 1280 × 720 (responsive)
**Status:** Phase 2 — Polish Complete

---

## Concept

An action RPG built with Three.js where you explore a 3D countryside, slay monsters for resources, and return to build and develop a village. The loop is: venture out, fight, gather, come back, build, grow stronger, venture farther.

The tone is low-fantasy and handcrafted — a lone wandering hero who builds a village from scratch. Each building unlocks new powers, and the monsters scale as your village grows. The target experience is a satisfying loop of combat → reward → construction that feels like a lite Diablo meets city-builder.

---

## Core Mechanics

### 1. Exploration
The player moves freely in a 3D open world (120×120 unit plane) with a third-person camera. Monster zone begins 22+ units from village center. The village is a safe radius (18 units) the player returns to.

### 2. Combat
Melee attacks on nearby monsters (Space/F). Attack range ~2.5 units, cooldown 0.55s. Damage = player ATK + random 0–5. Monsters have HP bars, chase/attack AI, and flee to their aggro range.

### 3. Resource Gathering
Monsters drop resources (wood, stone, iron, herbs) on death. Resource orbs are also scattered in the world — walk over them to collect. Resources are used to construct village buildings.

### 4. Village Building
Press E near the campfire to open the Build Panel. Buildings are constructed with resources/gold. Each has up to 3 levels; cost scales ×1.8 per level. Buildings grant permanent bonuses (ATK, max HP, sell price, radar range).

### 5. Character Progression
Killing monsters earns XP. On level-up: max HP +20, ATK +3, XP threshold scales ×1.4. Building bonuses stack with level bonuses.

### 6. Economy
Monsters drop gold directly. Market building lets you sell resources for gold (sell price bonus per level). Gold is a secondary currency for some buildings.

---

## Game Loop

1. Start at the village campfire with basic stats and empty resource counts.
2. Wander outward past the village boundary into monster territory.
3. Slay monsters → earn XP, gold, and resource drops; collect resource orbs.
4. Return to village (campfire safe zone).
5. Press E → Build Panel → construct or upgrade buildings.
6. Buildings grant permanent stat bonuses.
7. Repeat with harder monsters (trolls, wolves) as the player grows stronger.
8. Survive — death means game over (refresh to restart).

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Move | WASD / Arrow keys |
| Rotate camera | Mouse (click canvas to lock pointer) |
| Attack | Space or F |
| Interact / Build | E (when near village) |
| Toggle mode | Tab (Explore / Village) |
| Unlock pointer | Escape |

---

## Monsters

| Type | HP | ATK | Speed | XP | Gold | Drops |
|------|-----|-----|-------|----|------|-------|
| Slime | 30 | 8 | 2.5 | 12 | 3 | 1 herb |
| Goblin | 55 | 14 | 4.0 | 25 | 7 | 1 wood, 1 iron |
| Wolf | 45 | 18 | 5.5 | 20 | 5 | 2 herbs |
| Troll | 140 | 28 | 1.8 | 60 | 18 | 2 wood, 3 stone, 1 iron |

All monsters have chase/attack AI and a visible HP bar. They do not enter the village radius.

---

## Village Buildings

| Building | Effect | Max Level | Base Cost |
|----------|--------|-----------|-----------|
| Blacksmith | +5 ATK per level | 3 | 10w, 5s, 8i |
| Healer's Hut | +20 max HP per level | 3 | 8w, 5g |
| Market | +25% sell price per level | 3 | 12w, 6s, 2i |
| Watchtower | Expand radar range | 2 | 6w, 8s, 3i |
| Tavern | Restore full HP on visit | 1 | 15w, 5s, 10g |

Cost scales ×1.8 per existing level.

---

## UI / HUD

- **Top-left:** HP bar, XP bar, Level, Gold
- **Top-right:** Resource counts (Wood, Stone, Iron, Herbs)
- **Bottom-center:** Mode indicator (EXPLORING / VILLAGE)
- **Bottom-right:** Controls hint
- **Bottom-left:** Scrolling message log (last 5 events, fade out after 3s)
- **Center:** Build Panel modal (opens with E near campfire)

---

## Sound Design (Web Audio API — no file assets)

| Sound | Trigger | Style |
|-------|---------|-------|
| Sword swing | Player attack | Sawtooth sweep down |
| Monster hit | Successful hit | Square thud + noise |
| Monster die | Monster killed | Sawtooth fall + noise |
| Player hurt | Player takes damage | Square sweep + noise |
| Pickup | Resource collected | Sine double blip |
| Gold pickup | Gold collected | Rising sine triple |
| Build | Building constructed | Triangle chord arpeggio |
| Level up | Player levels up | Sine pentatonic fanfare |
| Footstep | Player moving | Very quiet noise burst |
| Game over | Player dies | Sawtooth fall + long noise |

---

## Phases

### Phase 1 — Foundation (2026-04-09)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [x] Three.js world: terrain, village area, campfire, trees, rocks, lighting
- [x] Player: 3D mesh, WASD movement, mouse-look camera, sword swing
- [x] Monsters: 4 types with chase/attack AI, HP bars, loot drops
- [x] Resource orbs: scatter in world, bob animation, auto-collect on walk-over
- [x] Village buildings: 5 buildings, Build Panel UI, cost/upgrade system
- [x] Full HUD: HP/XP bars, resource counters, message log, mode indicator
- [x] Sound effects: all key sounds procedurally generated

### Phase 2 — Polish (2026-04-11)
- [x] Weapon system: sword, axe, bow with distinct attack arcs and ranges
- [x] Inventory screen: view carried items and equip weapons (press I)
- [x] Tavern: walk up to building to heal instead of build-panel button
- [x] Visual hit flash on monsters when damaged
- [x] Death animation (fade out) for monsters
- [x] Day/night cycle with torch lighting

### Phase 3 — Depth
- [ ] Quest system: simple "kill 10 goblins" style objectives
- [ ] More monster types: skeleton, dragon boss
- [ ] Village NPCs (static characters that give quests/tips)
- [ ] Save/load game state to localStorage
- [ ] Map screen (Tab could open minimap)
- [ ] Crafting: combine resources at blacksmith for weapons/potions

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `playerMoved` | position | player.js | (future minimap) |
| `playerHpChanged` | hp, maxHp | state | ui |
| `playerXpChanged` | xp, xpNext | state | ui |
| `playerLevelUp` | newLevel | state | ui, main (sound) |
| `playerGoldChanged` | gold | state | ui |
| `resourceChanged` | type, amount | state | ui |
| `monsterDied` | def, position | monsters | (future drops) |
| `itemPickedUp` | type, amount | pickups | (future stats) |
| `buildingBuilt` | id, level | state | village, ui |
| `modeChanged` | mode | state | ui, village |
| `gameOver` | — | state | ui, main (sound) |
| `message` | text, color | everywhere | ui (msg log) |

---

## Module Overview

| File | Responsibility |
|------|---------------|
| `main.js` | Entry point, game loop, system wiring |
| `world.js` | Three.js scene: terrain, lighting, campfire, trees, rocks |
| `player.js` | Player mesh, WASD movement, mouse-look camera, melee attack |
| `monsters.js` | Monster types, chase/attack AI, HP bars, loot drops |
| `pickups.js` | Resource orb spawning, bob animation, collection |
| `village.js` | Building meshes, village mode management |
| `ui.js` | DOM HUD: HP/XP bars, resource panel, message log, build panel |
| `config.js` | All constants: world size, monster defs, building defs |
| `events.js` | EventBus singleton |
| `state.js` | GameState: player stats, resources, buildings, XP |
| `sounds.js` | Web Audio API procedural sound effects |

---

## Open Questions

- [ ] Should the game have an explicit win condition, or is it endless?
- [ ] Should monster difficulty scale over time (waves) or by distance from village?
- [ ] Should resources be infinite or finite (depletable nodes)?
- [ ] Should there be permadeath or a respawn penalty?

---

## Changelog

### Phase 1 — Foundation (2026-04-09)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
- Three.js world: terrain, village area, campfire, trees, rocks, lighting
- Player movement, camera, melee attack
- 4 monster types with AI and drops
- Resource pickups with bob animation
- Village building system (5 buildings, cost/upgrade)
- Full DOM HUD, message log, build panel
- Procedural sound effects for all game events
