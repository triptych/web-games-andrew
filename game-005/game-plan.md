# Game 005: Bullet Heaven Shmup

## Recent Updates

### 2026-02-13 - Phase 5: Upgrade System Complete
**New Features:**
- ✅ Full upgrade system with 5 upgrades (Power Shot, Rapid Fire, Swift Boots, Vitality Boost, Magnetism)
- ✅ Level-up UI that pauses game and shows 3 random upgrade choices
- ✅ Interactive upgrade cards with hover effects and click selection
- ✅ Upgrade tracking system (each upgrade has 5 levels)
- ✅ Player stat multipliers (damage, fire rate, move speed, max HP, pickup radius)
- ✅ Vitality Boost heals 20 HP when selected
- ✅ Magnetism increases pickup attraction radius dynamically

**Upgrade System Details:**
- **Power Shot**: +25% damage per level (max 5 levels)
- **Rapid Fire**: 20% faster shooting per level (max 5 levels)
- **Swift Boots**: +20% movement speed per level (max 5 levels)
- **Vitality Boost**: +20 max HP and heals 20 HP per level (max 5 levels)
- **Magnetism**: +30% pickup range per level (max 5 levels)

**Technical Implementation:**
- Created upgrades.js module with upgrade definitions and selection system
- Integrated upgrade initialization into main game loop
- Extended UI system with upgrade selection screen
- Refactored XP collection to work with upgrade-driven level-up logic

### 2026-02-13 - Bug Fixes & Health System
**Fixed Critical Issues:**
- ✅ Fixed wave progress not updating on kills - implemented proper wave tracking system
- ✅ Fixed game state reset issues on restart (R key) - event listeners now properly cleaned up
- ✅ Added health pickup system - enemies now drop health pickups (15% chance)

**New Features:**
- Health pickups (red with white + symbol) that heal 25 HP
- Wave completion UI with notifications
- Wave counter display in HUD
- Proper wave progression with 30% more enemies per wave
- 2-second break between waves
- All modules now properly clean up event listeners to prevent bugs on restart

**Technical Improvements:**
- Event listener cleanup in all modules (waves.js, enemies.js, player.js, projectiles.js, ui.js, upgrades.js)
- Proper state reset between games
- Manual collision detection for improved reliability
- Added healthGained event to event catalog

---

## Genre Definition
A web-based "bullet heaven" or "reverse bullet hell" shoot 'em up combining the best elements of traditional shmups with modern auto-shooter mechanics inspired by Vampire Survivors.

## Core Concept
Players control a character that automatically shoots while maneuvering through waves of enemies. Survival requires pattern recognition, positioning, and smart upgrade choices. Each run is a roguelike experience with unlockable progression.

---

## Phase 1: Core Gameplay Foundation

### Player Character
- **Movement System**
  - 8-directional movement (WASD or Arrow keys)
  - Smooth, precise movement without acceleration/friction for tight control
  - Centered hitbox (small, clearly visible indicator)
  - Adjustable movement speed (base + upgrades)

- **Auto-Shooting Mechanic**
  - Character shoots automatically in the direction of nearest enemy
  - Thick, fast, visible bullet streams
  - Clear visual feedback for shooting
  - Base weapon starts simple, scales with upgrades

### Enemy System
- **Wave-Based Spawning**
  - Continuous waves of enemies with increasing difficulty
  - Clear spawn indicators (visual telegraphing)
  - Multiple enemy types with distinct behaviors
  - Auto-generated wave patterns

- **Basic Enemy Types**
  - **Charger**: Moves directly toward player
  - **Circler**: Orbits around player
  - **Shooter**: Stops and fires projectiles
  - **Tanky**: Slow but high health

### Visual Design
- **Clarity First**
  - High contrast between player, enemies, bullets, and background
  - Bright colors for projectiles (player = blue/green, enemy = red/orange)
  - Clear point of origin for all projectiles
  - Minimal background complexity to avoid visual noise
  - Screen edge indicators for off-screen threats

---

## Phase 2: Upgrade & Progression System

### Level-Up Mechanics
- **Experience System**
  - Enemies drop XP gems on death
  - Auto-collect within small radius
  - Level up every X amount of XP
  - Screen pause on level-up for upgrade selection

### Upgrade Categories
1. **Weapon Upgrades**
   - Additional projectiles (dual shot, spread shot, 360° attack)
   - Faster fire rate
   - Piercing bullets
   - Homing missiles
   - Orbital satellites
   - Chain lightning

2. **Passive Upgrades**
   - Movement speed increase
   - Max health increase
   - Pickup radius expansion
   - Damage boost
   - Critical hit chance
   - Regeneration

3. **Special Abilities**
   - Screen-clearing bomb (limited uses)
   - Temporary invincibility shield
   - Magnetic field (pulls all XP)
   - Time slow

### Upgrade Selection
- Present 3 random upgrades on level-up
- Each upgrade has multiple levels (1-5 stars)
- Visual representation of current build
- Synergies between certain upgrades highlighted

---

## Phase 3: Enemy Variety & Bullet Patterns

### Advanced Enemy Types
- **Mini-Boss**: Appears every 5 minutes, complex bullet patterns
- **Swarm Spawner**: Releases multiple small enemies
- **Fortress**: Stationary, multiple turrets
- **Teleporter**: Blinks around the arena
- **Splitter**: Divides into smaller enemies on death

### Bullet Pattern Design
- **Pattern Philosophy**: "Lanes" of safe spaces within bullet curtains
- **Visual Communication**: Clear telegraphing before complex patterns
- **Fair Design**: Always provide a skillful dodge path
- **Escalation**: Start simple, introduce new patterns over time

### Difficulty Scaling
- Enemy health scales with time survived
- Spawn rate increases gradually
- More complex enemy combinations
- Bullet density increases
- Boss-style encounters at 10, 20, 30 minute marks

---

## Phase 4: Meta-Progression & Replayability

### Permanent Unlocks
- **Character Roster**
  - Multiple characters with unique starting weapons
  - Different stat distributions (speed/health/damage)
  - Special passive abilities per character
  - Unlocked by achieving specific milestones

- **Weapon Unlocks**
  - New base weapons added to upgrade pool
  - Unlocked through experimentation and survival

- **Artifact System**
  - Permanent items that modify each run
  - Mix positive and negative effects
  - Can equip multiple for customization

### Achievement System
- Survive X minutes
- Defeat X enemies
- Reach level X
- Unlock all weapons
- Complete specific challenge runs

---

## Phase 5: Polish & Game Feel

### Visual Polish
- **Particle Effects**
  - Satisfying enemy death explosions
  - XP gem sparkles and trails
  - Weapon upgrade visual feedback
  - Screen shake on big hits

- **Animation**
  - Smooth sprite animations
  - Attack windup/recovery animations
  - Idle animations with personality
  - Upgrade selection animations

### Audio Design
- **Sound Effects**
  - Satisfying shooting sounds
  - Distinct enemy hit/death sounds
  - Level-up chime
  - Warning sounds for danger
  - Power-up collection jingles

- **Music**
  - Energetic, escalating background music
  - Intensity increases with survival time
  - Boss encounter music shifts

### UI/UX
- **HUD Elements**
  - Health bar (top-left)
  - XP bar (bottom of screen)
  - Timer (top-center)
  - Kill count (top-right)
  - Current upgrades display

- **Menu System**
  - Clean main menu
  - Character selection screen
  - Upgrade/unlock progression view
  - Settings (audio, controls, graphics)
  - Pause menu with stats

### Quality of Life
- **Player-Friendly Features**
  - "Bullet sealing" - ground enemies don't shoot if player directly above
  - Safe spawn zone (enemies don't spawn too close)
  - Forgiving hitbox (slightly smaller than visual)
  - Brief invincibility after taking damage
  - Screen edge safe zone (can't trap player)

---

## Technical Implementation

### Technology Stack
- **Kaplay** - Modern game framework (from `../lib/kaplay/kaplay.mjs`)
- **ES6 Modules** - Modular JavaScript architecture
- **Custom EventBus** - Event propagation system for cross-module communication
- **Prefab Pattern** - Reusable game object factories using Kaplay components
- **Web Audio API** - Procedurally generated sound effects
- **LocalStorage** - Save data persistence

### Performance Targets
- 60 FPS on modern browsers
- Efficient particle management (object pooling via Kaplay)
- Optimized collision detection (Kaplay's built-in spatial partitioning)
- Event-driven architecture to minimize coupling

### Project Structure
```
game-005/
├── index.html           # Entry point, loads main.js as module
├── lib/
│   └── kaplay/
│       └── kaplay.mjs   # Kaplay game framework (shared library)
├── js/
│   ├── main.js          # Game initialization, Kaplay setup, splash screen
│   ├── config.js        # Constants, game configuration, entity definitions
│   ├── events.js        # EventBus class and event catalog
│   ├── state.js         # Global game state management
│   ├── player.js        # Player entity creation and controls
│   ├── enemies.js       # Enemy spawning, AI, and behaviors
│   ├── projectiles.js   # Player/enemy bullet systems
│   ├── upgrades.js      # Upgrade definitions and level-up system
│   ├── particles.js     # Particle effects (explosions, trails, etc.)
│   ├── ui.js            # HUD, menus, upgrade selection UI
│   ├── waves.js         # Wave spawning logic and difficulty scaling
│   ├── sounds.js        # Web Audio API sound generation
│   └── prefabs.js       # Reusable entity factory functions
└── game-plan.md         # This file
```

---

## Architecture Deep Dive

### 1. Kaplay Integration

**Import and Initialize**
```javascript
// js/main.js
import kaplay from '../lib/kaplay/kaplay.mjs';

const k = kaplay({
    width: 1280,
    height: 720,
    background: [10, 10, 15],
    scale: 1,
    pixelDensity: window.devicePixelRatio || 1,
});

export default k;
```

**Why Kaplay?**
- Built-in game loop and scene management
- Component-based entity system (perfect for prefabs)
- Efficient rendering and collision detection
- Input handling (keyboard, mouse, gamepad)
- Built-in sprite, animation, and particle systems
- Active development and modern API

### 2. Modular JavaScript Architecture

**ES6 Module Pattern**
- Each system is a separate module with clear exports
- Modules communicate via EventBus (loose coupling)
- Kaplay instance passed to modules that need it
- No global variables except event bus

**Example Module Structure**
```javascript
// js/enemies.js
import { events } from './events.js';
import { state } from './state.js';
import { createEnemyPrefab } from './prefabs.js';

let k; // Local kaplay reference

export function initEnemies(kaplay) {
    k = kaplay;

    // Listen for events
    events.on('spawnEnemy', (type, pos) => {
        spawnEnemy(type, pos);
    });
}

export function spawnEnemy(type, pos) {
    const enemy = createEnemyPrefab(k, type, pos);
    events.emit('enemySpawned', enemy);
    return enemy;
}
```

### 3. Event Propagation System

**EventBus Implementation**
```javascript
// js/events.js
export class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    on(event, fn) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(fn);
        return () => this.off(event, fn);
    }

    off(event, fn) {
        const set = this._listeners.get(event);
        if (set) set.delete(fn);
    }

    emit(event, ...args) {
        const set = this._listeners.get(event);
        if (set) {
            for (const fn of set) {
                fn(...args);
            }
        }
    }
}

// Singleton event bus
export const events = new EventBus();
```

**Event Catalog for Bullet Heaven**
```javascript
/*
 * Game Events:
 *
 * playerDamaged(damage)           - Player takes damage
 * playerLevelUp(level)            - Player reaches new level
 * playerDied()                    - Player health reaches zero
 *
 * enemySpawned(enemy)             - Enemy enters the game
 * enemyKilled(enemy)              - Enemy destroyed
 * enemyDamaged(enemy, damage)     - Enemy takes damage
 *
 * xpGained(amount)                - XP collected
 * xpDropped(pos, amount)          - XP gem spawned
 *
 * upgradeSelected(upgrade)        - Player picks an upgrade
 * weaponUnlocked(weaponType)      - New weapon available
 *
 * waveChanged(waveNumber)         - New difficulty wave
 * bossSpawned(boss)               - Boss enemy appears
 *
 * gameOver(survived)              - Game ended
 * gamePaused()                    - Game paused
 * gameResumed()                   - Game resumed
 */
```

**Benefits of EventBus**
- Decoupled architecture (modules don't import each other)
- Easy to add new features without breaking existing code
- Clear data flow and debugging
- Extensible for achievements, analytics, etc.

### 4. Prefab Pattern (Entity Factories)

**Prefabs using Kaplay Components**
```javascript
// js/prefabs.js
import { ENEMY_DEFS } from './config.js';
import { events } from './events.js';

export function createPlayerPrefab(k, pos) {
    // Shadow
    const shadow = k.add([
        k.pos(pos.x + 2, pos.y + 2),
        k.circle(12),
        k.color(0, 0, 0),
        k.opacity(0.3),
        k.anchor("center"),
        k.z(9),
        "playerShadow",
    ]);

    // Player entity
    const player = k.add([
        k.pos(pos),
        k.circle(12),
        k.color(100, 200, 255),
        k.outline(3, k.rgb(200, 230, 255)),
        k.anchor("center"),
        k.area(),
        k.z(10),
        "player",
    ]);

    // Custom properties
    player.shadow = shadow;
    player.hp = 100;
    player.maxHp = 100;
    player.speed = 200;
    player.level = 1;
    player.xp = 0;
    player.xpToNext = 10;
    player.invincible = false;
    player.invincibleTimer = 0;

    // Hitbox indicator (small core)
    player.add([
        k.circle(3),
        k.color(255, 255, 255),
        k.anchor("center"),
        k.opacity(0.8),
    ]);

    // Update logic
    player.onUpdate(() => {
        // Sync shadow position
        shadow.pos = k.vec2(player.pos.x + 2, player.pos.y + 2);

        // Invincibility frames
        if (player.invincible) {
            player.invincibleTimer -= k.dt();
            player.opacity = Math.sin(k.time() * 30) * 0.5 + 0.5;
            if (player.invincibleTimer <= 0) {
                player.invincible = false;
                player.opacity = 1;
            }
        }
    });

    // Collision handling
    player.onCollide("enemy", (enemy) => {
        if (!player.invincible) {
            takeDamage(player, enemy.damage);
        }
    });

    return player;
}

export function createEnemyPrefab(k, type, pos) {
    const def = ENEMY_DEFS[type];

    const shadow = k.add([
        k.pos(pos.x + 1, pos.y + 2),
        k.circle(def.size * 0.9),
        k.color(0, 0, 0),
        k.opacity(0.25),
        k.anchor("center"),
        k.z(9),
        "enemyShadow",
    ]);

    const enemy = k.add([
        k.pos(pos),
        k.circle(def.size),
        k.color(def.color),
        k.outline(2, def.outlineColor),
        k.anchor("center"),
        k.area(),
        k.z(10),
        "enemy",
    ]);

    enemy.shadow = shadow;
    enemy.hp = def.hp;
    enemy.maxHp = def.hp;
    enemy.speed = def.speed;
    enemy.damage = def.damage;
    enemy.xpValue = def.xpValue;
    enemy.enemyType = type;

    // HP bar
    createHPBar(k, enemy);

    enemy.onUpdate(() => {
        shadow.pos = k.vec2(enemy.pos.x + 1, enemy.pos.y + 2);

        // Move toward player
        const player = k.get("player")[0];
        if (player) {
            const dir = player.pos.sub(enemy.pos).unit();
            enemy.pos = enemy.pos.add(dir.scale(enemy.speed * k.dt()));
        }
    });

    return enemy;
}

export function createProjectilePrefab(k, pos, dir, damage, owner) {
    const projectile = k.add([
        k.pos(pos),
        k.circle(4),
        k.color(owner === "player" ? [100, 200, 255] : [255, 100, 50]),
        k.outline(1, k.rgb(255, 255, 255)),
        k.anchor("center"),
        k.area(),
        k.z(5),
        owner === "player" ? "playerBullet" : "enemyBullet",
    ]);

    projectile.damage = damage;
    projectile.vel = dir.scale(400);
    projectile.lifetime = 3;

    // Trail effect
    projectile.onUpdate(() => {
        projectile.pos = projectile.pos.add(projectile.vel.scale(k.dt()));
        projectile.lifetime -= k.dt();

        if (projectile.lifetime <= 0 ||
            projectile.pos.x < 0 || projectile.pos.x > k.width() ||
            projectile.pos.y < 0 || projectile.pos.y > k.height()) {
            k.destroy(projectile);
        }
    });

    return projectile;
}

export function createXPGemPrefab(k, pos, value) {
    const gem = k.add([
        k.pos(pos),
        k.circle(6),
        k.color(50, 255, 150),
        k.outline(2, k.rgb(150, 255, 200)),
        k.anchor("center"),
        k.area(),
        k.z(8),
        "xpGem",
    ]);

    gem.value = value;
    gem.attractRadius = 100;
    gem.attractSpeed = 300;
    gem.bobOffset = Math.random() * Math.PI * 2;

    gem.onUpdate(() => {
        // Bob animation
        gem.pos.y += Math.sin(k.time() * 5 + gem.bobOffset) * 0.5;

        // Magnetic attraction to player
        const player = k.get("player")[0];
        if (player && gem.pos.dist(player.pos) < gem.attractRadius) {
            const dir = player.pos.sub(gem.pos).unit();
            gem.pos = gem.pos.add(dir.scale(gem.attractSpeed * k.dt()));
        }
    });

    return gem;
}
```

**Prefab Benefits**
- Consistent entity creation across the game
- Easy to modify entity behaviors in one place
- Encapsulates visual appearance, physics, and logic
- Reusable and composable using Kaplay components

### 5. Web Audio API Sound System

**Sound Generation Module**
```javascript
// js/sounds.js
let audioContext = null;
let masterGain = null;
let soundEnabled = true;

export function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioContext.destination);
    }
    return audioContext;
}

export function toggleSound() {
    soundEnabled = !soundEnabled;
    return soundEnabled;
}

// Helper: Play tone with envelope
function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!soundEnabled || !audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    gainNode.gain.value = volume;
    gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + duration
    );

    oscillator.connect(gainNode);
    gainNode.connect(masterGain);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// Helper: Play chord (multiple frequencies)
function playChord(frequencies, duration, type = 'sine', volume = 0.2) {
    if (!soundEnabled || !audioContext) return;
    frequencies.forEach(freq => {
        playTone(freq, duration, type, volume / frequencies.length);
    });
}

// Sound effects library
export const sounds = {
    // Player shoots
    playerShoot() {
        playTone(600, 0.08, 'square', 0.15);
    },

    // Enemy hit
    enemyHit() {
        playTone(150, 0.08, 'square', 0.15);
    },

    // Enemy death
    enemyDeath() {
        if (!soundEnabled || !audioContext) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            50,
            audioContext.currentTime + 0.3
        );

        gain.gain.setValueAtTime(0.2, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.3
        );

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.3);
    },

    // XP pickup
    xpCollect() {
        playChord([523, 659, 784], 0.15, 'sine', 0.2);
    },

    // Level up
    levelUp() {
        playChord([523, 659, 784, 1047], 0.4, 'triangle', 0.3);
    },

    // Power-up/upgrade selected
    powerUp() {
        playChord([440, 554, 659, 880], 0.3, 'square', 0.25);
    },

    // Player hurt
    playerHurt() {
        if (!soundEnabled || !audioContext) return;

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(
            100,
            audioContext.currentTime + 0.2
        );

        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
            0.01,
            audioContext.currentTime + 0.2
        );

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + 0.2);
    },

    // Boss warning
    bossWarning() {
        playTone(100, 0.5, 'triangle', 0.4);
        setTimeout(() => playTone(150, 0.5, 'triangle', 0.4), 100);
    },

    // UI click
    uiClick() {
        playChord([440, 554], 0.1, 'square', 0.2);
    },
};
```

**Web Audio API Benefits**
- Zero asset dependencies (no audio files needed)
- Procedurally generated SFX
- Real-time synthesis and effects
- Small file size and instant loading
- Full control over sound parameters
- No copyright issues

---

## Module Communication Flow

```
┌─────────────┐
│   main.js   │ - Initializes Kaplay
│             │ - Creates splash screen
│             │ - Calls init functions
└──────┬──────┘
       │
       ├──────────────────────────────────┐
       │                                  │
       ▼                                  ▼
┌─────────────┐                    ┌─────────────┐
│  events.js  │◄──────────────────►│  state.js   │
│ (EventBus)  │   All modules      │ (Global     │
│             │   communicate      │  State)     │
└──────┬──────┘   via events       └─────────────┘
       │
       │ Events flow through bus
       │
       ├──────┬──────┬──────┬──────┬──────┬──────┐
       ▼      ▼      ▼      ▼      ▼      ▼      ▼
   player  enemies  proj  waves  upgr  ui  sounds
     .js     .js    .js    .js    .js  .js   .js
       │      │      │      │      │    │      │
       └──────┴──────┴──────┴──────┴────┴──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ prefabs.js  │
                  │ (Factories) │
                  └─────────────┘
```

**Example Flow: Enemy Death**
1. `projectiles.js` detects collision → emits `'enemyDamaged'`
2. `enemies.js` listens, checks HP → emits `'enemyKilled'`
3. `sounds.js` listens → plays death sound
4. `particles.js` listens → spawns explosion
5. `ui.js` listens → updates kill counter
6. `waves.js` listens → checks if wave complete
7. `enemies.js` spawns XP gem → emits `'xpDropped'`

---

## Development Roadmap

### Phase 1: Foundation (Files: main.js, config.js, events.js, state.js, sounds.js)
**Goal:** Core infrastructure and basic systems ✅ **COMPLETED**

- [x] Create `index.html` with module script loading
- [x] Set up `main.js` with Kaplay initialization
- [x] Implement `events.js` with EventBus class and event catalog
- [x] Create `state.js` for global game state management
- [x] Set up `config.js` with game constants and entity definitions
- [x] Implement `sounds.js` with Web Audio API sound generation
- [x] Create splash screen with "Start Game" button
- [x] Test event system and sound playback

### Phase 2: Player & Movement (Files: player.js, prefabs.js)
**Goal:** Player entity with smooth controls ✅ **COMPLETED**

- [x] Create `prefabs.js` module
- [x] Implement `createPlayerPrefab()` with shadow and hitbox
- [x] Add player movement (WASD/Arrow keys) in `player.js`
- [x] Implement player health system
- [x] Add invincibility frames after taking damage
- [x] Test movement feel and responsiveness
- [x] Hook up player damage events

### Phase 3: Auto-Shooting (Files: projectiles.js)
**Goal:** Player automatically shoots toward nearest enemy ✅ **COMPLETED**

- [x] Create `projectiles.js` module
- [x] Implement `createProjectilePrefab()` in prefabs
- [x] Add auto-targeting logic (find nearest enemy)
- [x] Implement bullet spawning system
- [x] Add bullet collision detection
- [x] Manual collision detection for reliability
- [x] Hook up shooting sound effects

### Phase 4: Basic Enemies (Files: enemies.js, waves.js)
**Goal:** Functional enemy spawning and behavior ✅ **COMPLETED**

- [x] Create `enemies.js` module
- [x] Implement `createEnemyPrefab()` with 3 basic types (Charger, Fast, Tank)
- [x] Add enemy AI (move toward player)
- [x] Implement enemy health and damage system
- [x] Create `waves.js` for spawn timing
- [x] Add HP bars above enemies
- [x] Hook up enemy death events and XP drops
- [x] Test collision and combat feel
- [x] Implement proper wave progression system with kill tracking
- [x] Add wave completion UI and notifications
- [x] Scale difficulty between waves

### Phase 4.5: Health System Enhancement
**Goal:** Add health pickups for sustainability ✅ **COMPLETED**

- [x] Create health pickup prefab (separate from XP gems)
- [x] Add health pickup drop chance from enemies (15%)
- [x] Implement health pickup collision and healing
- [x] Add health pickup sound effect
- [x] Add magnetic attraction to player for pickups

### Phase 5: XP & Leveling (Files: upgrades.js)
**Goal:** Progression loop with XP collection ✅ **COMPLETED**

- [x] Implement `createXPGemPrefab()` with magnetic attraction
- [x] Add XP collection on player collision
- [x] Create level-up system with XP thresholds
- [x] Implement `upgrades.js` module
- [x] Create upgrade selection UI (pause on level-up)
- [x] Add 5 basic upgrades (damage, fire rate, speed, health, pickup radius)
- [x] Hook up level-up sound and visual feedback
- [x] Test progression pacing

### Phase 6: UI System (Files: ui.js)
**Goal:** HUD and menus ✅ **COMPLETED**

- [x] Create `ui.js` module
- [x] Implement HUD (health bar, XP bar, timer, kills)
- [x] Add wave counter display
- [x] Create wave completion notifications
- [ ] Create upgrade selection screen
- [ ] Add pause menu
- [ ] Create game over screen with stats
- [ ] Add UI sound effects
- [ ] Style with consistent visual theme

### Phase 7: Advanced Enemies (Files: enemies.js, waves.js)
**Goal:** Enemy variety and challenge

- [ ] Add 5 more enemy types (Swarm, Teleporter, Splitter, Mini-Boss, Fortress)
- [ ] Implement enemy bullet patterns for Shooter types
- [ ] Add wave progression system with difficulty scaling
- [ ] Implement boss spawn at 10/20/30 minute marks
- [ ] Create enemy spawn patterns (not just random)
- [ ] Balance enemy health/damage scaling
- [ ] Test difficulty curve

### Phase 8: Weapon Variety (Files: upgrades.js, projectiles.js)
**Goal:** Diverse build options

- [ ] Add 10+ weapon upgrade types (spread shot, homing, orbital, piercing, etc.)
- [ ] Implement weapon synergies
- [ ] Create visual distinction for each weapon
- [ ] Add weapon evolution system (tier 2 upgrades)
- [ ] Balance weapon effectiveness
- [ ] Test different build strategies

### Phase 9: Particles & Polish (Files: particles.js)
**Goal:** Game feel and visual feedback

- [ ] Create `particles.js` module
- [ ] Implement explosion effects on enemy death
- [ ] Add muzzle flash for shooting
- [ ] Create level-up visual burst
- [ ] Add damage number pop-ups
- [ ] Implement screen shake on big hits
- [ ] Polish animations and transitions
- [ ] Test visual clarity (no noise)

### Phase 10: Meta-Progression (Files: state.js, ui.js)
**Goal:** Replayability and unlocks

- [ ] Implement character unlock system
- [ ] Add permanent artifacts system
- [ ] Create achievement tracking
- [ ] Implement LocalStorage save/load
- [ ] Build character selection screen
- [ ] Add statistics tracking (total kills, best time, etc.)
- [ ] Create progression UI to show unlocks
- [ ] Test save data persistence

### Phase 11: Final Polish
**Goal:** Release-ready experience

- [ ] Balance all systems (playtesting)
- [ ] Optimize performance (60 FPS target)
- [ ] Add keyboard shortcuts and controls screen
- [ ] Implement settings menu (volume, graphics)
- [ ] Add death animations and transitions
- [ ] Polish all UI screens
- [ ] Add juice to all interactions
- [ ] Final bug fixes and testing

---

## Complete Code Example: Module Integration

Here's how all the pieces work together in practice:

**index.html**
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bullet Heaven Shmup - Game 005</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #0a0a0f;
        }
        body {
            display: flex;
            justify-content: center;
            align-items: center;
        }
        canvas {
            display: block;
        }
    </style>
</head>
<body>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

**js/main.js** (Entry Point)
```javascript
import kaplay from '../lib/kaplay/kaplay.mjs';
import { GAME_WIDTH, GAME_HEIGHT } from './config.js';
import { initAudioContext } from './sounds.js';
import { initPlayer } from './player.js';
import { initEnemies } from './enemies.js';
import { initProjectiles } from './projectiles.js';
import { initUpgrades } from './upgrades.js';
import { initWaves } from './waves.js';
import { initUI } from './ui.js';
import { events } from './events.js';

// Initialize Kaplay
const k = kaplay({
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    background: [10, 10, 15],
    scale: 1,
    pixelDensity: window.devicePixelRatio || 1,
});

// Make kaplay globally accessible
window.k = k;

// Create splash screen
function createSplashScreen() {
    const splash = document.createElement('div');
    splash.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: linear-gradient(135deg, #1a1c24 0%, #2d3142 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        font-family: sans-serif;
    `;

    const title = document.createElement('h1');
    title.textContent = 'Bullet Heaven';
    title.style.cssText = `
        color: #ffffff;
        font-size: 4rem;
        margin-bottom: 2rem;
        text-shadow: 0 0 20px rgba(100, 200, 255, 0.5);
    `;
    splash.appendChild(title);

    const startBtn = document.createElement('button');
    startBtn.textContent = 'Start Game';
    startBtn.style.cssText = `
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        padding: 1rem 3rem;
        font-size: 1.5rem;
        border-radius: 50px;
        cursor: pointer;
        box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
    `;

    startBtn.onclick = () => {
        initAudioContext();
        splash.style.transition = 'opacity 0.5s';
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.remove();
            startGame();
        }, 500);
    };

    splash.appendChild(startBtn);
    document.body.appendChild(splash);
}

// Start the game
function startGame() {
    k.scene("game", () => {
        // Initialize all systems (pass kaplay instance)
        initPlayer(k);
        initEnemies(k);
        initProjectiles(k);
        initUpgrades(k);
        initWaves(k);
        initUI(k);

        // Start spawning enemies
        events.emit('gameStarted');
    });

    k.go("game");
}

// Initialize splash screen
createSplashScreen();
```

**js/config.js** (Shared Constants)
```javascript
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PLAYER_CONFIG = {
    startingHp: 100,
    startingSpeed: 200,
    fireRate: 0.5, // seconds between shots
    baseDamage: 10,
};

export const ENEMY_DEFS = {
    basic: {
        hp: 50,
        speed: 80,
        damage: 10,
        size: 12,
        xpValue: 5,
        color: [255, 100, 80],
        outlineColor: [200, 50, 30],
    },
    fast: {
        hp: 30,
        speed: 150,
        damage: 5,
        size: 10,
        xpValue: 8,
        color: [255, 200, 80],
        outlineColor: [200, 150, 30],
    },
    tank: {
        hp: 200,
        speed: 40,
        damage: 25,
        size: 20,
        xpValue: 20,
        color: [150, 150, 150],
        outlineColor: [80, 80, 80],
    },
};

export const UPGRADE_DEFS = {
    damage: {
        name: "Damage Boost",
        description: "Increase damage by 20%",
        maxLevel: 5,
        apply: (state) => { state.player.damage *= 1.2; },
    },
    fireRate: {
        name: "Faster Shots",
        description: "Shoot 15% faster",
        maxLevel: 5,
        apply: (state) => { state.player.fireRate *= 0.85; },
    },
    // ... more upgrades
};
```

**js/player.js** (Player System)
```javascript
import { events } from './events.js';
import { state } from './state.js';
import { createPlayerPrefab } from './prefabs.js';
import { sounds } from './sounds.js';

let k;
let player;
let shootTimer = 0;

export function initPlayer(kaplay) {
    k = kaplay;

    // Create player at center
    player = createPlayerPrefab(k, k.vec2(k.width() / 2, k.height() / 2));
    state.player = player;

    // Listen for damage events
    events.on('playerDamaged', (damage) => {
        if (!player.invincible) {
            player.hp -= damage;
            player.invincible = true;
            player.invincibleTimer = 1.0;
            sounds.playerHurt();

            if (player.hp <= 0) {
                events.emit('playerDied');
            }
        }
    });

    // Movement
    k.onUpdate(() => {
        if (!player.exists()) return;

        const speed = player.speed;
        const movement = k.vec2(0, 0);

        if (k.isKeyDown("left") || k.isKeyDown("a")) movement.x -= 1;
        if (k.isKeyDown("right") || k.isKeyDown("d")) movement.x += 1;
        if (k.isKeyDown("up") || k.isKeyDown("w")) movement.y -= 1;
        if (k.isKeyDown("down") || k.isKeyDown("s")) movement.y += 1;

        if (movement.len() > 0) {
            player.pos = player.pos.add(
                movement.unit().scale(speed * k.dt())
            );
        }

        // Keep player in bounds
        player.pos.x = Math.max(20, Math.min(k.width() - 20, player.pos.x));
        player.pos.y = Math.max(20, Math.min(k.height() - 20, player.pos.y));

        // Auto-shooting
        shootTimer += k.dt();
        if (shootTimer >= player.fireRate) {
            const nearestEnemy = findNearestEnemy();
            if (nearestEnemy) {
                events.emit('playerShoot', player.pos, nearestEnemy.pos);
                shootTimer = 0;
            }
        }
    });
}

function findNearestEnemy() {
    const enemies = k.get("enemy");
    if (enemies.length === 0) return null;

    let nearest = enemies[0];
    let minDist = player.pos.dist(nearest.pos);

    for (const enemy of enemies) {
        const dist = player.pos.dist(enemy.pos);
        if (dist < minDist) {
            minDist = dist;
            nearest = enemy;
        }
    }

    return nearest;
}
```

**js/enemies.js** (Enemy System)
```javascript
import { events } from './events.js';
import { createEnemyPrefab, createXPGemPrefab } from './prefabs.js';
import { sounds } from './sounds.js';

let k;

export function initEnemies(kaplay) {
    k = kaplay;

    // Listen for spawn requests
    events.on('spawnEnemy', (type, pos) => {
        spawnEnemy(type, pos);
    });

    // Listen for damage events
    events.on('enemyDamaged', (enemy, damage) => {
        if (!enemy.exists()) return;

        enemy.hp -= damage;

        if (enemy.hp <= 0) {
            killEnemy(enemy);
        } else {
            sounds.enemyHit();
        }
    });
}

function spawnEnemy(type, pos) {
    const enemy = createEnemyPrefab(k, type, pos);
    events.emit('enemySpawned', enemy);
    return enemy;
}

function killEnemy(enemy) {
    sounds.enemyDeath();

    // Drop XP
    const xpGem = createXPGemPrefab(k, enemy.pos, enemy.xpValue);

    // Destroy enemy and shadow
    k.destroy(enemy.shadow);
    k.destroy(enemy);

    events.emit('enemyKilled', enemy);
}
```

This architecture provides:
- **Clear separation of concerns** - each file has one job
- **Loose coupling** - modules communicate via events
- **Easy testing** - modules can be tested independently
- **Scalability** - easy to add new features without refactoring
- **Maintainability** - bugs are isolated to specific modules

---

## Design Pillars

1. **Clarity Over Chaos**: Every element should be readable at a glance
2. **Meaningful Choices**: Each upgrade should feel impactful
3. **Fair Challenge**: Difficult but never unfair; skill should matter
4. **Satisfying Feedback**: Every action should feel good
5. **Replayability**: Each run should feel unique and exciting

---

## Success Metrics

- Players survive 10+ minutes on their first few runs
- Clear build diversity (multiple viable strategies)
- "One more run" factor (high replay value)
- Smooth performance on target browsers
- Positive playtest feedback on game feel

---

## Research Sources

### Bullet Heaven Game Design
- [Vampire Survivors–like - Wikipedia](https://en.wikipedia.org/wiki/Vampire_Survivors%E2%80%93like)
- [Bullet Heavens: games like Vampire Survivors - Rogueliker](https://rogueliker.com/bullet-heaven-games-like-vampire-survivors/)
- [Vampire Survivors, bullet heaven? - Medium](https://rajaarh.medium.com/vampire-survivors-bullet-heaven-c70ed722fc32)
- [Bullet Heaven Tag Discussion - Steam Community](https://steamcommunity.com/discussions/forum/10/3543798390544389532/)

### Shmup Game Design
- [Boghog's bullet hell shmup 101 - Shmups Wiki](https://shmups.wiki/library/Boghog's_bullet_hell_shmup_101)
- [(Breaking) The Shmup Dogma - Game Developer](https://www.gamedeveloper.com/design/-breaking-the-shmup-dogma)
- [Designing smart, meaningful SHMUPs - Game Developer](https://www.gamedeveloper.com/design/designing-smart-meaningful-shmups)
- [Pixelblog 31 & 32 - Shmup Design - SLYNYRD](https://www.slynyrd.com/blog/2020/12/14/pixelblog-31-shmup-sprite-design)
- [Sparen's Danmaku Design Studio](https://sparen.github.io/ph3tutorials/ddsga2.html)

### Additional Resources
- [Mixing bullet hell shmup with roguelike - Game Developer](https://www.gamedeveloper.com/design/mixing-bullet-hell-shmup-with-roguelike-in-team-d-13-s-i-monolith-i-)
- [Shoot'em Up Mechanics - Chaotik Blog](https://chaotik.co.za/shootem-up-mechanics/)

---

## Next Steps

1. Set up basic HTML5 Canvas project structure
2. Implement player movement and rendering
3. Create basic enemy spawning
4. Add auto-shooting mechanic
5. Begin iterative development following Phase 1

**Ready to create something addictive! 🎮**
