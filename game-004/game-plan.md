# Tower Defense Game Plan

## Current Status
**Phase 2 (Tower Variety) - ✅ COMPLETED**

Expanded from single tower type to 5 distinct tower types with unique attack patterns:
- **Archer**: Fast attacks, medium range (balanced starter tower)
- **Cannon**: Slow, powerful splash damage attacks
- **Mage**: Magic attacks that slow enemies
- **Tesla**: Chain lightning hitting multiple enemies
- **Sniper**: Long-range, high-damage armor-piercing shots

Each tower has unique visuals, projectiles, and special effects. Ready for Phase 3: Enemy variety!

## Game Overview
A classic tower defense game built with Kaplay.js where players strategically place towers to defend against waves of enemies following a path from start to finish. Features multiple tower types, enemy varieties, upgrades, and progressive difficulty.

## Core Features

### 1. Map & Pathfinding
- **Pre-defined Path**: Enemies follow a winding path from spawn to base
- **Grid System**: Tile-based grid for tower placement
- **Buildable Zones**: Areas where towers can be placed
- **No-Build Zones**: Path tiles and special areas blocked from building
- **Visual Indicators**: Highlight valid placement zones and range circles

### 2. Tower Types
- **Basic Tower (Archer)**
  - Low cost, moderate damage, medium range
  - Fast attack speed
  - Good early game option

- **Cannon Tower**
  - High cost, high damage, long range
  - Slow attack speed
  - Splash damage (area of effect)

- **Mage Tower**
  - Medium cost, medium damage, medium range
  - Slowing effect on hit
  - Magic damage (good vs armored enemies)

- **Tesla Tower**
  - High cost, chain lightning effect
  - Hits multiple enemies
  - Short range but fast attack

- **Sniper Tower**
  - Very long range, high single-target damage
  - Very slow attack speed
  - Ignores some armor

### 3. Tower Mechanics
- **Placement**: Click tower button, then click valid grid position
- **Upgrades**: 3 upgrade tiers per tower (damage, range, attack speed)
- **Selling**: Sell towers for 75% of total investment
- **Targeting Priority**:
  - First: Target enemy closest to exit
  - Last: Target enemy furthest from exit
  - Strongest: Target highest HP enemy
  - Weakest: Target lowest HP enemy
- **Range Display**: Show tower range on hover/select

### 4. Enemy System
- **Enemy Types**:
  - **Scout**: Fast, low HP, low reward
  - **Soldier**: Medium speed, medium HP, normal reward
  - **Tank**: Slow, high HP/armor, high reward
  - **Speedster**: Very fast, medium HP, medium reward
  - **Flying**: Ignores ground pathing, requires special towers
  - **Boss**: Massive HP, special abilities, huge reward

- **Enemy Stats**:
  - Health points (HP)
  - Armor (damage reduction)
  - Speed (movement rate)
  - Gold reward (on kill)
  - Damage to base (if reaches end)

- **Wave System**:
  - 20+ waves with increasing difficulty
  - Mixed enemy types in later waves
  - Boss waves every 5 waves
  - Short break between waves for building

### 5. Resource Management
- **Gold**: Currency for building/upgrading towers
  - Starting gold: 500
  - Earn gold by defeating enemies
  - Bonus gold for completing waves
  - Interest system (optional): +5% of current gold per wave

- **Lives**: Base health
  - Starting lives: 20
  - Lose lives when enemies reach the end
  - Game over at 0 lives

### 6. User Interface
- **Top Bar**:
  - Current gold
  - Current lives
  - Wave number
  - Start wave button (for manual wave control)

- **Tower Menu**:
  - Tower icons with costs
  - Hotkeys (1-5 for quick selection)
  - Disable buttons when insufficient gold

- **Tower Info Panel**:
  - Selected tower stats
  - Upgrade buttons with costs
  - Sell button with refund amount

- **Game State Screens**:
  - Main menu / Start screen
  - Pause menu
  - Victory screen
  - Defeat screen with stats

### 7. Game Flow
1. **Start**: Player begins with starting gold and lives
2. **Build Phase**: Place towers before wave starts
3. **Wave Phase**: Enemies spawn and follow path
4. **Between Waves**: Short break to adjust strategy
5. **Win Condition**: Complete all waves
6. **Lose Condition**: Lives reach zero

### 8. Controls
- **Mouse**:
  - Left click: Select tower / Place tower / Click UI buttons
  - Right click: Cancel tower placement / Deselect
  - Hover: Show tower ranges and info

- **Keyboard**:
  - `1-5`: Quick select tower types
  - `Space`: Start next wave
  - `Esc`: Pause / Cancel placement
  - `U`: Upgrade selected tower
  - `S`: Sell selected tower

## Technical Implementation

### Architecture
```
game-004/
├── index.html          # Entry point HTML
├── game-plan.md        # This file
├── js/                 # ✅ Modular ES6 modules
│   ├── main.js        # ✅ Game initialization
│   ├── config.js      # ✅ Game constants and definitions
│   ├── state.js       # ✅ Global game state management
│   ├── events.js      # ✅ Event system for module communication
│   ├── map.js         # ✅ Grid system and pathfinding
│   ├── towers.js      # ✅ Tower placement and combat
│   ├── enemies.js     # ✅ Enemy spawning and behavior
│   ├── waves.js       # ✅ Wave progression system
│   └── ui.js          # ✅ HUD and user interface
├── lib/
│   └── kaplay/        # Kaplay library
│       ├── kaplay.js
│       └── kaplay.mjs
└── assets/            # (Future) Custom graphics/sounds
```

### Kaplay Components
- **Sprite**: Visual representation of towers and enemies
- **Area**: Collision detection and click handling
- **Position**: Grid-based positioning
- **Health**: Enemy HP tracking
- **Timer**: Wave timers, attack cooldowns
- **Text**: UI elements and damage numbers

### Core Systems
```javascript
// Game state management
const gameState = {
    gold: 500,
    lives: 20,
    wave: 0,
    isWaveActive: false,
    selectedTower: null,
    placingTowerType: null
}

// Tower management
class Tower {
    constructor(type, x, y) { }
    upgrade() { }
    attack(enemies) { }
    findTarget(enemies) { }
}

// Enemy management
class Enemy {
    constructor(type, path) { }
    takeDamage(amount) { }
    move(dt) { }
    reachedEnd() { }
}

// Wave spawner
class WaveManager {
    spawnWave(waveNumber) { }
    getWaveEnemies(wave) { }
}
```

### Pathfinding
- Pre-computed waypoint path
- Enemies interpolate between waypoints
- Simple but effective for fixed paths

### Collision Detection
- Range-based detection (circle collision)
- Check distance between tower and enemy
- Attack when enemy enters range

## Development Phases

### Phase 1: Core Mechanics (MVP) ✅ COMPLETED
- [x] Setup Kaplay and basic canvas
- [x] Create grid system and path
- [x] Implement basic tower placement
- [x] Single tower type (basic shooter)
- [x] Single enemy type following path
- [x] Simple wave spawning
- [x] Basic UI (gold, lives display)

**Completed Features:**
- ✅ Modular architecture with event-driven system
- ✅ Grid-based map with pre-defined winding path
- ✅ Tower placement with ghost preview and range indicators
- ✅ Archer tower with projectile targeting and damage
- ✅ Scout enemy with HP bars, movement along waypoints
- ✅ 10 progressive waves with increasing difficulty
- ✅ Complete HUD (gold, lives, wave counter, start wave button)
- ✅ Toolbar with tower selection
- ✅ Victory/Defeat game states
- ✅ Visual polish (death particles, floating gold text, flash on hit)
- ✅ Input handling (mouse clicks, keyboard hotkeys, ESC to cancel)
- ✅ Wave completion bonus gold system

### Phase 2: Tower Variety ✅ COMPLETED
- [x] Add 3-5 tower types
- [x] Implement different attack patterns
- [x] Tower selection menu
- [x] Range indicators
- [x] Projectile animations

**Completed Features:**
- ✅ 5 tower types with balanced stats matching game plan
- ✅ Unique visual design for each tower (Archer arrows, Cannon barrel, Mage crystal, Tesla coil, Sniper rifle)
- ✅ Cannon: Splash damage with explosion effects
- ✅ Mage: Slow effect with visual indicator and duration system
- ✅ Tesla: Chain lightning that jumps between enemies
- ✅ Sniper: Long-range with impact effects
- ✅ Different projectile colors and sizes per tower type
- ✅ Hotkeys 1-5 for quick tower selection
- ✅ Updated starting gold to 500 for better balance
- ✅ Visual effects: explosions, lightning bolts, slow indicators

### Phase 3: Enemy Variety & Waves
- [ ] Add multiple enemy types
- [ ] Wave progression system
- [ ] Enemy stats scaling
- [ ] Boss enemies
- [ ] Wave preview

### Phase 4: Upgrades & Economy
- [ ] Tower upgrade system (3 tiers)
- [ ] Sell towers for refund
- [ ] Gold earning tweaks
- [ ] Balance costs and rewards
- [ ] Tower targeting priorities

### Phase 5: Polish & Features
- [ ] Particle effects
- [ ] Sound effects
- [ ] Music
- [ ] Damage numbers
- [ ] Victory/defeat screens
- [ ] Save/load progress
- [ ] Stats tracking
- [ ] Achievement system

## Game Balance Considerations

### Economy Balance
- Early game: Focus on cheap towers
- Mid game: Save for upgrades and advanced towers
- Late game: Optimize placement and max upgrades
- Gold scaling: Wave rewards match increasing costs

### Difficulty Curve
- Waves 1-5: Tutorial difficulty, single enemy types
- Waves 6-10: Multiple types, increased spawn rate
- Waves 11-15: Fast enemies, armored units
- Waves 16-20: Mixed waves, flying enemies
- Boss waves: Significant challenge requiring good setup

### Tower Balance
| Tower Type | Cost | DPS | Range | Special |
|------------|------|-----|-------|---------|
| Archer     | 100  | 10  | 150   | Fast attack |
| Cannon     | 250  | 25  | 200   | Splash damage |
| Mage       | 200  | 15  | 175   | Slow effect |
| Tesla      | 300  | 20  | 100   | Chain lightning |
| Sniper     | 350  | 40  | 300   | Armor pierce |

## Inspirations & References
- Bloons TD (clean mechanics, variety)
- Kingdom Rush (hero units, active abilities)
- Defense Grid (3D perspective but similar gameplay)
- Element TD (element combinations)

## Success Metrics
- Players reach wave 10+ (good retention)
- Average session: 20-30 minutes
- Strategic depth: Multiple viable strategies
- Replayability: Try different tower combinations
- Satisfying feedback: Visual/audio on kills

## Future Expansion Ideas
- Multiple maps with different path layouts
- Hero units with active abilities
- Tower synergies and combo effects
- Challenge modes (limited tower types, fast forward)
- Endless mode after completing campaign
- Custom map editor
- Multiplayer co-op mode
- Prestige/progression system across runs
