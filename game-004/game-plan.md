# Tower Defense Game Plan

## Current Status
**Phase 4 (Upgrades & Economy) - ✅ COMPLETED**

Complete tower upgrade and economy system with strategic depth:
- **Tower Upgrades**: 3-tier upgrade system for all tower types with visual progression
- **Upgrade Stats**: Damage, range, attack speed, and tower-specific bonuses (splash radius, chain count, slow effect)
- **Sell System**: Sell towers for 75% refund, freeing up space for strategic repositioning
- **Targeting Priorities**: Choose between First, Last, Strongest, Weakest targeting for each tower
- **Tower Info Panel**: Detailed stats display with upgrade/sell buttons and targeting controls
- **Keyboard Shortcuts**: U to upgrade, S to sell selected towers
- **Dynamic Balance**: Upgrade costs scale appropriately, maintaining economic challenge throughout all 20 waves

Previous phases completed: Core Mechanics (Phase 1), Tower Variety (Phase 2), Enemy Variety & Waves (Phase 3)

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

### Phase 3: Enemy Variety & Waves ✅ COMPLETED
- [x] Add multiple enemy types
- [x] Wave progression system
- [x] Enemy stats scaling
- [x] Boss enemies
- [x] Wave preview

**Completed Features:**
- ✅ 5 enemy types: Scout, Soldier, Tank, Speedster, Boss
- ✅ Unique visual designs for each enemy (Tank has armor plating, Boss has crown spikes, Speedster streamlined)
- ✅ Armor system with damage reduction mechanics
- ✅ Sniper tower armor pierce (50% armor ignore)
- ✅ 20 progressive waves with increasing difficulty
- ✅ Boss waves every 5 waves (waves 5, 10, 15, 20)
- ✅ Boss wave warning banner with visual effects
- ✅ Wave preview UI showing upcoming enemy composition
- ✅ Mixed enemy types in later waves for strategic variety
- ✅ Proper enemy stat scaling (HP, speed, armor, rewards)

### Phase 4: Upgrades & Economy ✅ COMPLETED
- [x] Tower upgrade system (3 tiers)
- [x] Sell towers for refund
- [x] Gold earning tweaks
- [x] Balance costs and rewards
- [x] Tower targeting priorities

**Completed Features:**
- ✅ 3-tier upgrade system for all 5 tower types with balanced costs
- ✅ Upgrades boost damage, range, attack speed, and tower-specific stats
- ✅ Visual upgrade effects and level indicators (stars)
- ✅ Sell towers for 75% refund of total investment
- ✅ Tower info panel with stats, upgrade/sell buttons, and targeting controls
- ✅ 4 targeting priorities: First (closest to exit), Last (furthest), Strongest (highest HP), Weakest (lowest HP)
- ✅ Keyboard shortcuts: U to upgrade, S to sell
- ✅ Dynamic UI updates showing affordability and refund values
- ✅ Cell management allowing towers to be sold and replaced

### Phase 5: Polish & Features 🎨

#### Visual Polish - High Priority (Quick Wins)
- [x] **Tower Visuals**: Add gradients, shadows, and 3D-looking depth
- [x] **Tower Animations**: Rotating turrets, aiming at targets, firing animations
- [x] **Projectile Trails**: Glowing trails behind projectiles
- [x] **Better Explosions**: Rings, shockwaves, expanding particles
- [x] **Enemy Movement**: Animation instead of sliding (rotation, bobbing, shadows)
- [x] **Damage Numbers**: Pop-up numbers on hit with animations and critical hits
- [x] **Button Hover States**: Visual feedback for all UI buttons
- [x] **Enhanced HP Bars**: Better design with borders, gradients, and smooth color transitions
- [x] **Muzzle Flash**: Flash effects when towers fire
- [x] **Enhanced Slow Effect**: Icy particles orbiting slowed enemies with snowflake icon

#### Tower Enhancements
- [ ] More distinct tower designs with unique silhouettes
- [ ] Upgrade visual progression (size, color, decorations)
- [ ] Idle animations (pulsing crystals, spinning coils)
- [ ] Muzzle flash and recoil effects when firing
- [ ] Glowing effects for max-level towers
- [ ] Shadow beneath towers
- [ ] Foundation/platform appearance

#### Enemy Enhancements
- [ ] Distinctive designs: Scout (wheels/legs), Tank (treads), Boss (aura)
- [ ] Walking/rolling animations
- [ ] Motion blur trails for speedsters
- [ ] Shadow beneath enemies
- [ ] Death animations with more particles
- [ ] Status effect icons above HP bar
- [ ] Armor visual indicators

#### Effects & Particles
- [ ] Projectile improvements (rotation, different shapes, glow)
- [ ] Impact sparks/flashes on hit
- [ ] Branching lightning effects
- [ ] Slow effect particles (icy blue)
- [ ] Critical hit effects
- [ ] Screen shake for big impacts

#### Map & Background
- [ ] Textured ground tiles (grass, dirt, stone)
- [ ] Path looks like worn road/pavement
- [ ] Grid highlights on hover
- [ ] Environmental decorations (trees, rocks, fences)
- [ ] Animated background elements (clouds, flags)

#### UI Improvements
- [ ] Gradient backgrounds instead of solid colors
- [ ] Actual icons instead of text symbols (coin, heart)
- [ ] Button press animations
- [ ] Tooltip system for tower stats
- [ ] Animated gold counter
- [ ] Tower thumbnail previews
- [ ] Range preview on tower button hover
- [ ] Better tower info panel with stat bars and icons

#### Game State Screens
- [ ] Enhanced victory/defeat screens with animations
- [ ] Star rating system based on performance
- [ ] Particle confetti on victory
- [ ] Stats summary with animated bars
- [ ] Medals/achievements display

#### Advanced Polish
- [ ] Refined color palette with better contrast
- [ ] Lighting effects (glow, bloom)
- [ ] Vignette effect around edges
- [ ] Shadows cast by towers
- [ ] Ambient particles (dust, fireflies)
- [ ] Elastic easing on UI elements
- [ ] Camera shake on boss spawn
- [ ] Slow-motion effect on victory

#### Audio Integration
- [ ] Sound effects (already implemented)
- [ ] Music system
- [ ] Sound-visual sync (flashes with sounds)
- [ ] Boss entry dramatic audio+visual

#### Quality of Life
- [ ] Coverage heat map
- [ ] Enemy path arrows
- [ ] Danger indicators near exit
- [ ] Wave difficulty indicator
- [ ] Settings menu for effects quality

#### Progression Systems
- [ ] Save/load progress
- [ ] Stats tracking (kills, damage, accuracy)
- [ ] Achievement system
- [ ] Leaderboards

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
