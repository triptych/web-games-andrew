# Web Games Development Learnings

This document captures the key learnings, patterns, and insights gained from developing the first 5 web games in this project.

## Table of Contents
- [Evolution Overview](#evolution-overview)
- [Technical Architecture](#technical-architecture)
- [Framework & Libraries](#framework--libraries)
- [Audio System](#audio-system)
- [Common Bugs & Fixes](#common-bugs--fixes)
- [Performance Optimizations](#performance-optimizations)
- [UI/UX Patterns](#uiux-patterns)
- [Code Organization](#code-organization)
- [Testing & Debugging](#testing--debugging)
- [Game-Specific Insights](#game-specific-insights)

---

## Evolution Overview

### Timeline of Architectural Improvements

**Game 001: Space Shooter**
- Pure vanilla JavaScript with Canvas API
- Single HTML file with inline JavaScript (~700 lines)
- Manual sprite rendering and collision detection
- First implementation of Web Audio API for sound
- **Key Learning**: Simple is good for prototyping, but becomes unwieldy quickly

**Game 002: Match-3 Puzzle**
- First adoption of **Kaplay framework**
- Still single-file architecture but more organized
- Discovered scoring bug (continuous increase after first match)
- **Key Learning**: Frameworks save time but require understanding their lifecycle

**Game 003: NetHack Roguelike**
- Complex single-file game (~2000+ lines)
- Implemented save/load system with localStorage
- Advanced algorithms (BSP dungeon generation, shadowcasting FOV, A* pathfinding)
- **Key Learning**: Single-file approach hits limits around 1500-2000 lines

**Game 004: Tower Defense**
- **First modular architecture** with ES6 modules
- Separated concerns: config, state, events, map, towers, enemies, waves, ui
- Event-driven communication between modules
- **Key Learning**: Modular architecture is essential for maintainability

**Game 005: Bullet Heaven Shmup**
- **Refined modular architecture** with EventBus pattern
- Prefab pattern for reusable game objects
- Comprehensive event catalog for cross-module communication
- Event listener cleanup to prevent memory leaks
- **Key Learning**: Proper event management prevents cascading bugs

---

## Technical Architecture

### Recommended Architecture Pattern (Based on Game 004 & 005)

```
project/
├── index.html              # Entry point (minimal)
├── lib/
│   └── kaplay/            # Shared library
│       └── kaplay.mjs
├── js/
│   ├── main.js            # Game initialization
│   ├── config.js          # Constants and definitions
│   ├── events.js          # EventBus system
│   ├── state.js           # Global state management
│   ├── prefabs.js         # Entity factory functions
│   ├── [feature].js       # Feature-specific modules
│   └── sounds.js          # Audio system
├── game-plan.md           # Design document
└── CHANGELOG.md           # Track changes and fixes
```

### EventBus Pattern (Critical Learning from Game 005)

**Implementation:**
```javascript
// events.js
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
            for (const fn of set) fn(...args);
        }
    }
}

export const events = new EventBus();
```

**Benefits:**
- Loose coupling between modules
- Easy to add features without breaking existing code
- Clear data flow for debugging
- Extensible for achievements, analytics, etc.

**Critical Bug Fix (Game 005):**
- **Problem**: Event listeners accumulated on game restart, causing:
  - Multiple enemy deaths from single hit
  - Multiple pickups dropping
  - Incorrect damage calculations
- **Solution**: Store unsubscribe callbacks and clean up on scene restart

```javascript
// Pattern for proper cleanup
let unsubscribeCallbacks = [];

export function initModule(kaplay) {
    k = kaplay;

    // Store cleanup function
    unsubscribeCallbacks.push(
        events.on('someEvent', handleEvent)
    );
}

// Call on scene restart
k.onSceneLeave(() => {
    unsubscribeCallbacks.forEach(unsub => unsub());
    unsubscribeCallbacks = [];
});
```

### Prefab Pattern (Game 005)

Reusable entity factory functions using Kaplay components:

```javascript
export function createEnemyPrefab(k, type, pos) {
    const def = ENEMY_DEFS[type];

    const shadow = k.add([
        k.pos(pos.x + 1, pos.y + 2),
        k.circle(def.size * 0.9),
        k.color(0, 0, 0),
        k.opacity(0.25),
        "enemyShadow",
    ]);

    const enemy = k.add([
        k.pos(pos),
        k.circle(def.size),
        k.color(def.color),
        k.area(),
        "enemy",
    ]);

    enemy.shadow = shadow;
    enemy.hp = def.hp;
    // ... more properties

    return enemy;
}
```

**Benefits:**
- Consistent entity creation
- Easy to modify behavior in one place
- Encapsulates visual, physics, and logic

---

## Framework & Libraries

### Kaplay Framework (Games 002-006)

**Why Kaplay:**
- Modern, actively developed game framework
- Component-based entity system
- Built-in game loop and scene management
- Efficient rendering and collision detection
- Input handling (keyboard, mouse, gamepad)
- Built-in sprite, animation, and particle systems

**Common Pattern:**
```javascript
import kaplay from '../lib/kaplay/kaplay.mjs';

const k = kaplay({
    width: 1280,
    height: 720,
    background: [10, 10, 15],
    scale: 1,
    pixelDensity: window.devicePixelRatio || 1,
});
```

**High-DPI Display Fix (Game 004):**
```javascript
// Always set pixelDensity for crisp rendering on retina displays
pixelDensity: window.devicePixelRatio || 1
```

### Kaplay v4000 Color API ⚠️ CRITICAL

**RGBA Colors in Kaplay v4000:**

Kaplay v4000 does **NOT** have a `k.rgba()` function. Colors with alpha transparency are represented as **arrays**, not function calls.

**Correct Color Syntax:**
```javascript
// ✅ Opaque colors - use k.rgb()
k.rgb(255, 200, 100)      // RGB function
k.rgb("#ff6600")          // Hex string
k.rgb("slateblue")        // CSS color keyword

// ✅ Colors with alpha - use array format [r, g, b, a]
[255, 200, 100, 0.8]      // Array with alpha
[50, 50, 50, 0.5]         // 50% transparent gray
[255, 255, 150, alpha]    // Variable alpha

// ❌ WRONG - This function does not exist!
k.rgba(255, 200, 100, 0.8)  // ERROR: k.rgba is not a function
```

**RGBAValue Type Definition:**
- Format: `[number, number, number, number]`
- RGB values: 0-255
- Alpha value: 0-1 (0 = fully transparent, 1 = fully opaque)

**Common Use Cases:**
```javascript
// Damage flash effect
k.drawRect({
    color: [255, 0, 0, alpha],  // Red with variable alpha
});

// Particle effects
k.drawCircle({
    color: [255, 200, 100, 0.5],  // Semi-transparent orange
});

// Fog/smoke effects
k.drawRect({
    color: [50, 50, 50, 0.3],  // Translucent gray
});
```

**API Documentation:**
- RGB: https://v4000.kaplayjs.com/docs/api/ctx/rgb/
- RGBAValue: https://v4000.kaplayjs.com/docs/api/RGBAValue/

**Bug Example (Game 006):**
```javascript
// ❌ Original (broken)
k.drawCircle({
    color: k.rgba(255, 200, 100, alpha * 0.8),  // ERROR!
});

// ✅ Fixed
k.drawCircle({
    color: [255, 200, 100, alpha * 0.8],  // Works!
});
```

**Important:**
> Every time we mistakenly used `k.rgba()`, it caused engine crashes. Always use array format `[r, g, b, a]` for colors with transparency in Kaplay v4000.

### Alternative: Vanilla Canvas (Game 001)

**When to use:**
- Very simple games (< 500 lines)
- Learning fundamentals
- No dependencies required

**Pros:**
- No framework overhead
- Full control
- Zero dependencies

**Cons:**
- Must implement everything manually
- No component system
- Harder to organize large codebases

---

## Audio System

### Web Audio API Pattern (All Games)

**Zero-asset sound generation** using oscillators and envelopes:

```javascript
// sounds.js module
let audioContext = null;
let masterGain = null;

export function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 0.3;
        masterGain.connect(audioContext.destination);
    }
}

function playTone(frequency, duration, type = 'sine', volume = 0.3) {
    if (!audioContext) return;

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
```

**Sound Effect Recipes:**

| Effect | Oscillator Type | Frequency Pattern | Duration |
|--------|----------------|-------------------|----------|
| Laser Shoot | square | 600 Hz constant | 0.08s |
| Enemy Hit | square | 150 Hz constant | 0.08s |
| Enemy Death | sawtooth | 300→50 Hz ramp | 0.3s |
| XP Collect | sine chord | [523, 659, 784] Hz | 0.15s |
| Level Up | triangle chord | [523, 659, 784, 1047] Hz | 0.4s |
| Player Hurt | sawtooth | 200→100 Hz ramp | 0.2s |

**Benefits:**
- No audio file assets needed
- Instant loading
- Small file size
- Full control over parameters
- No copyright issues

**Browser Compatibility Note:**
Always resume audio context on user interaction:
```javascript
resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume();
    }
}
```

---

## Common Bugs & Fixes

### 1. Event Listener Accumulation (Game 005) ⚠️ CRITICAL

**Bug**: Event listeners accumulate on game restart, causing duplicate events

**Symptoms:**
- Multiple enemy deaths from single hit
- Multiple pickups spawning
- Exponentially increasing effects

**Solution:**
```javascript
let unsubscribeCallbacks = [];

export function initModule(k) {
    unsubscribeCallbacks.push(events.on('event', handler));
}

k.onSceneLeave(() => {
    unsubscribeCallbacks.forEach(unsub => unsub());
    unsubscribeCallbacks = [];
});
```

### 2. Scoring Bug (Game 002)

**Bug**: Score continuously increased after first match

**Cause**: Match detection running in update loop without proper state check

**Solution**: Add flag to prevent repeated scoring
```javascript
if (isMatching) return; // Skip if already processing
isMatching = true;
// ... process match
isMatching = false;
```

### 3. Collision Detection Reliability (Game 005)

**Bug**: Kaplay's automatic collision sometimes missed

**Solution**: Implement manual collision detection
```javascript
k.onUpdate(() => {
    const playerBullets = k.get("playerBullet");
    const enemies = k.get("enemy");

    for (const bullet of playerBullets) {
        for (const enemy of enemies) {
            if (bullet.pos.dist(enemy.pos) < enemy.radius + bullet.radius) {
                events.emit('enemyDamaged', enemy, bullet.damage);
                k.destroy(bullet);
                break;
            }
        }
    }
});
```

### 4. UI Clickability Issues (Game 004)

**Bug**: Tower selection panel not clickable

**Cause**: z-index conflicts and area component issues

**Solution**:
- Use proper z-index layering (background: 0, game: 10, UI: 100)
- Add `k.area()` to clickable UI elements
- Use `onClick()` handler with proper event propagation

### 5. Wave Progress Not Updating (Game 005)

**Bug**: Wave counter stuck even when enemies killed

**Cause**: Wave system not listening to enemy death events

**Solution**: Proper event wiring
```javascript
events.on('enemyKilled', (enemy) => {
    state.enemiesKilledThisWave++;
    if (state.enemiesKilledThisWave >= state.enemiesToSpawn) {
        advanceWave();
    }
});
```

### 6. Behavior Component Override Bug (Game 005) ⚠️ CRITICAL

**Bug**: Enemies with custom behaviors (orbit, shoot, teleport, swarm) broke base functionality - collision detection failed, HP bars disappeared, shadows didn't follow, boundary checks stopped working. Only 4 of 5 enemies spawned per wave.

**Symptoms:**
- Enemies not moving correctly
- Collision detection not working
- HP bars not updating
- Shadows disconnected from enemies
- Enemies appearing then immediately vanishing
- Wave completion stalling with "ghost" enemies

**Root Cause**: Behavior components were **replacing** the base `onUpdate` function instead of **adding** to it.

**Broken Pattern:**
```javascript
function addSwarmBehavior(entity, k, def) {
    const originalUpdate = entity.onUpdate;  // ❌ This doesn't work!
    entity.onUpdate = () => {                // ❌ This REPLACES all updates
        if (originalUpdate) originalUpdate();
        // behavior code...
    };
}
```

**Why It Failed:**
- In Kaplay, `entity.onUpdate` is a **registration function**, not the callback itself
- Storing it and calling it doesn't preserve the original behavior
- Assigning a new function to `entity.onUpdate` **replaces** the registration function
- All base functionality (collision, HP bars, shadows, boundaries) gets lost

**Correct Pattern:**
```javascript
function addSwarmBehavior(entity, k, def) {
    // ✅ Just call onUpdate() to ADD another callback
    entity.onUpdate(() => {
        // behavior code...
    });
}
```

**Why It Works:**
- Multiple `onUpdate()` callbacks can be registered on the same entity
- Each callback runs independently
- Base enemy behavior and custom behavior coexist
- No functionality is lost

**Solution Applied:**
- Fixed all behavior component functions (orbit, shoot, teleport, swarm)
- Changed from replacing to adding callbacks
- All enemy functionality now works correctly

**Related Issues Fixed:**
1. **Wave Tracking**: Implemented tag-based system (`wave_1`, `wave_2`) instead of counters
2. **Spawn Speed**: Reduced interval from 2.0s to 0.8s to prevent empty screens
3. **Off-screen Cleanup**: Added automatic killing of enemies beyond 100 pixels off-screen
4. **Enemy Visibility**: Increased swarm size from 9 to 12 pixels with bright colors

**Prevention:**
- ✅ **Never replace** `entity.onUpdate` - always **add** to it
- ✅ Test all custom behaviors thoroughly
- ✅ Verify base functionality (collision, rendering) still works
- ✅ Use Kaplay's component composition as intended

**Key Lesson:**
> In Kaplay's component system, `entity.onUpdate()` **registers** a callback, it doesn't **define** behavior. Multiple callbacks can and should coexist. Replacing the registration function breaks everything.

---

## Performance Optimizations

### 1. Object Pooling (Not Yet Implemented)

**Current Approach**: Create/destroy entities dynamically
**Future Optimization**: Reuse bullet/particle objects
```javascript
// Recommended for games with many projectiles
const bulletPool = [];
function getBullet() {
    return bulletPool.pop() || createNewBullet();
}
function returnBullet(bullet) {
    bullet.hidden = true;
    bulletPool.push(bullet);
}
```

### 2. Spatial Partitioning

**Learning**: Kaplay handles this internally, but be aware of:
- Don't check collisions between distant objects manually
- Use Kaplay's built-in collision system when possible
- Tag-based queries are optimized (e.g., `k.get("enemy")`)

### 3. Render Optimization

**Key Insights:**
- Minimize state changes (color, opacity) in render loop
- Use sprite batching when possible
- Limit particle effects (cap at 100-200 particles)
- Remove off-screen entities promptly

### 4. Update Loop Efficiency

**Pattern:**
```javascript
k.onUpdate(() => {
    // Cache frequently accessed collections
    const enemies = k.get("enemy");
    const bullets = k.get("bullet");

    // Early exit conditions
    if (enemies.length === 0) return;

    // Process in chunks if needed
    // ...
});
```

---

## UI/UX Patterns

### 1. HUD Design (Games 003-005)

**Effective Layout:**
```
┌─────────────────────────────────────┐
│ HP: ████████░░ XP: ███░░░░░  Time: 5:32  Kills: 142  Wave: 3 │
│                                                                 │
│                  [Game Area]                                    │
│                                                                 │
│                                                                 │
└─────────────────────────────────────┘
```

**Key Principles:**
- Top-left: Player stats (HP, resources)
- Top-center: Timer/progress
- Top-right: Score/kill count/wave
- Bottom: Inventory/abilities (if needed)
- Avoid center screen clutter

### 2. Visual Feedback (Games 004-005)

**Essential Feedback Elements:**
1. **Hit Feedback**: Flash enemy color, spawn particles, play sound
2. **Damage Numbers**: Floating text showing damage dealt
3. **State Indicators**: Health bars, status icons, cooldown timers
4. **Range Indicators**: Show tower/ability range on hover
5. **Highlighting**: Selected entities, valid placement zones

**Implementation Example (Game 004):**
```javascript
// Hit flash effect
enemy.color = k.rgb(255, 255, 255);
k.wait(0.1, () => {
    enemy.color = originalColor;
});

// Damage numbers
k.add([
    k.text(`-${damage}`, { size: 16 }),
    k.pos(enemy.pos),
    k.color(255, 100, 100),
    k.lifespan(0.5),
    k.move(k.UP, 50),
]);
```

### 3. Menu Systems (Game 005)

**Splash Screen Pattern:**
```javascript
function createSplashScreen() {
    const splash = document.createElement('div');
    // ... styling

    const startBtn = document.createElement('button');
    startBtn.onclick = () => {
        initAudioContext(); // Resume audio context
        splash.style.transition = 'opacity 0.5s';
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.remove();
            startGame();
        }, 500);
    };
}
```

### 4. Game Over Screens

**Good Practice:**
- Show final stats (score, time, kills)
- Provide clear restart option
- Optional: Share/leaderboard buttons
- Smooth transitions in/out

---

## Code Organization

### 1. Configuration Separation (Games 004-005)

**config.js Pattern:**
```javascript
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PLAYER_CONFIG = {
    startingHp: 100,
    speed: 200,
    fireRate: 0.5,
};

export const ENEMY_DEFS = {
    basic: { hp: 50, speed: 80, /* ... */ },
    fast: { hp: 30, speed: 150, /* ... */ },
    // ...
};
```

**Benefits:**
- Easy balancing (all numbers in one place)
- No magic numbers scattered in code
- Can load from JSON in future

### 2. State Management (Games 004-005)

**state.js Pattern:**
```javascript
export const state = {
    // Game state
    isPaused: false,
    gameOver: false,

    // Player reference
    player: null,

    // Progression
    wave: 1,
    score: 0,
    kills: 0,

    // Economy
    gold: 500,
    lives: 20,

    // UI state
    selectedTower: null,
    placingTowerType: null,
};
```

**Warning**: Don't abuse global state. Use events for cross-module communication.

### 3. Module Initialization Pattern

**Consistent across all modules:**
```javascript
let k; // Local kaplay reference

export function initModule(kaplay) {
    k = kaplay;

    // Set up event listeners
    events.on('someEvent', handleEvent);

    // Initialize module state
    // ...
}
```

### 4. File Size Guidelines

**Based on experience:**
- Single file: OK up to ~1500 lines
- Module: Keep under 500 lines
- Config file: No limit (data definitions)
- If module > 500 lines: Consider splitting

---

## Testing & Debugging

### 1. Console Logging Strategy

**Game State Logging:**
```javascript
// Add to main.js for debugging
window.debugState = () => {
    console.log('Game State:', state);
    console.log('Entities:', {
        enemies: k.get('enemy').length,
        bullets: k.get('bullet').length,
        pickups: k.get('pickup').length,
    });
};
```

**Event Flow Debugging:**
```javascript
// Temporary event spy
events.on('*', (eventName, ...args) => {
    console.log(`Event: ${eventName}`, args);
});
```

### 2. Visual Debugging

**Collision Boxes (Game 005):**
```javascript
// Add debug outlines
entity.add([
    k.outline(2, k.rgb(255, 0, 0)),
]);
```

**Grid Overlay (Game 004):**
```javascript
// Draw grid for tile-based games
for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
        k.add([
            k.rect(tileSize, tileSize),
            k.outline(1, k.rgb(50, 50, 50)),
            k.pos(x * tileSize, y * tileSize),
        ]);
    }
}
```

### 3. Common Debug Commands

**Add to window for quick access:**
```javascript
window.debug = {
    // Skip to wave
    setWave: (n) => { state.wave = n; },

    // Add resources
    addGold: (n) => { state.gold += n; },

    // Toggle invincibility
    godMode: () => { state.player.invincible = !state.player.invincible; },

    // Spawn enemy
    spawn: (type) => events.emit('spawnEnemy', type, somePos),
};
```

### 4. Performance Profiling

**Browser DevTools:**
- Performance tab: Record game session, look for long frames
- Memory tab: Check for memory leaks (entities not destroyed)
- Console: `console.time()` / `console.timeEnd()` for specific functions

**Entity Count Monitoring:**
```javascript
k.onUpdate(() => {
    if (k.debug.fps) {
        k.debug.log(`Entities: ${k.get('*').length}`);
    }
});
```

---

## Game-Specific Insights

### Game 001: Space Shooter (Vanilla JS)

**What Worked:**
- Simple collision detection (circle-based)
- Gradual difficulty increase (speed + spawn rate)
- Clear visual design (high contrast)

**What Could Improve:**
- Better sprite handling (use sprite sheets)
- More enemy variety
- Power-up system

**Key Code Pattern:**
```javascript
// Main game loop
function gameLoop() {
    if (gameOver) return;

    update();
    render();

    requestAnimationFrame(gameLoop);
}
```

### Game 002: Match-3 Puzzle (Kaplay Introduction)

**What Worked:**
- Kaplay made animation much easier
- Component-based entities simplified code
- Cascade matching felt great

**What Could Improve:**
- Better gem swap animation (arc motion)
- Special gems (bombs, line clears)
- Combo system

**Critical Bug:**
- Scoring in update loop caused runaway scores
- **Fix**: Use state flags to gate scoring

### Game 003: NetHack Roguelike (Complex Single-File)

**What Worked:**
- BSP dungeon generation created interesting layouts
- Shadowcasting FOV was immersive
- Save/load system with localStorage
- Turn-based system felt strategic

**What Could Improve:**
- Should have used modules (~2000 lines in one file)
- Item identification system was complex
- Needed better UI feedback

**Technical Achievements:**
- A* pathfinding for enemy AI
- Cellular automata for organic caves
- Item enchantment system
- Multi-floor dungeon with stairs

**Architecture Lesson:**
> This was the tipping point. After this game, modular architecture became mandatory.

### Game 004: Tower Defense (First Modular Architecture)

**What Worked:**
- **ES6 modules greatly improved organization**
- Event-driven communication reduced coupling
- Separate config file made balancing easy
- Tower upgrade system added depth

**What Could Improve:**
- More enemy types
- Path variety (multiple maps)
- Active abilities for towers

**Architectural Win:**
```
8 modules × ~200 lines each = maintainable codebase
1 file × 1600 lines = nightmare
```

**Key Features:**
- 5 tower types with unique mechanics
- 4 targeting priorities (First, Last, Strongest, Weakest)
- 3-tier upgrade system with visual progression
- 20 balanced waves with boss encounters
- Modular event system

### Game 005: Bullet Heaven Shmup (Refined Architecture)

**What Worked:**
- **EventBus pattern perfected**
- Prefab factories for consistent entities
- Manual collision detection more reliable
- Wave progression system felt good

**What Could Improve:**
- More weapon variety (only basic shooting so far)
- Upgrade system not yet implemented
- Need more enemy types and patterns

**Critical Bugs Fixed:**
- Event listener cleanup prevents cascading bugs
- Manual collision detection for reliability
- Behavior component override bug (onUpdate replacement)
- Wave tracking with tag-based system instead of counters
- Off-screen enemy cleanup for wave progression
- Spawn rate optimization (2.0s → 0.8s)

**Architectural Refinement:**
- Event catalog documentation
- Cleanup callbacks pattern
- Prefab pattern for reusability
- Web Audio API sound library

**Current Status:**
- ✅ Phase 1-4.5 complete (core gameplay, enemies, waves, health system)
- ⏳ Phase 5: Upgrade system in progress
- 📋 Phases 6-11: UI polish, meta-progression, final polish

---

## Best Practices Summary

### Do's ✅

1. **Use modular architecture** for any game > 1000 lines
2. **Implement event-driven communication** between modules
3. **Centralize configuration** in config.js
4. **Clean up event listeners** on scene restart
5. **Use prefab pattern** for consistent entity creation
6. **Implement Web Audio API** for zero-asset sounds
7. **Add visual feedback** for all player actions
8. **Keep modules under 500 lines** each
9. **Document your event catalog** clearly
10. **Test on high-DPI displays** (set pixelDensity)
11. **Write game plans** before coding (game-plan.md)
12. **Track changes** in CHANGELOG.md
13. **Use git commits** to mark milestones

### Don'ts ❌

1. **Don't accumulate event listeners** without cleanup
2. **Don't put everything in one file** (> 1500 lines)
3. **Don't use magic numbers** (use config instead)
4. **Don't tightly couple modules** (use events instead)
5. **Don't skip audio context resume** (browser requirement)
6. **Don't ignore z-index** for UI clickability
7. **Don't forget collision detection** (manual if needed)
8. **Don't skip visual feedback** (players need it)
9. **Don't hardcode entity properties** (use definitions)
10. **Don't rely only on automatic collision** (test thoroughly)

---

## Future Improvements

### Architecture
- [ ] Implement object pooling for projectiles
- [ ] Add asset loading system (when needed)
- [ ] Create animation system/helper
- [ ] Build component composition helpers

### Tooling
- [ ] Add build system (bundler)
- [ ] Implement hot reload for development
- [ ] Create debugging overlay tool
- [ ] Add automated testing framework

### Features
- [ ] Cloud save system
- [ ] Leaderboards
- [ ] Achievement system
- [ ] Analytics integration

### Performance
- [ ] Benchmark and profile all games
- [ ] Optimize particle systems
- [ ] Implement spatial hashing (if needed)
- [ ] Web Worker for heavy computation

---

## Conclusion

The evolution from Game 001 (vanilla JS single file) to Game 005 (modular EventBus architecture) demonstrates clear patterns:

1. **Start simple** - Vanilla JS is fine for learning
2. **Adopt frameworks early** - Kaplay saved significant time
3. **Modularize at scale** - Essential beyond 1500 lines
4. **Event-driven wins** - Loose coupling prevents bugs
5. **Clean up resources** - Event listeners, entities, timers
6. **Visual feedback matters** - Players need confirmation
7. **Plan before coding** - game-plan.md is invaluable
8. **Document changes** - CHANGELOG.md tracks lessons

**Most Important Learning:**
> Proper architecture isn't over-engineering—it's the difference between maintainable code and a tangled mess. The EventBus pattern with cleanup callbacks (Game 005) solved problems we didn't know we had.

**Next Games Should:**
- Use modular architecture from day 1
- Implement EventBus with cleanup callbacks
- Use prefab pattern for entities
- Centralize configuration
- Plan first, code second

---

---

## Advanced Prefab System (Game 005 Enhancement - 2026-02-14)

### Overview

Enhanced Game 005 with a sophisticated prefab system featuring:
1. RPG-style player classes with distinct archetypes
2. 8 diverse enemy types with unique AI behaviors
3. Component-based behavior system for modular enemy design
4. Interactive class selection UI
5. Progressive difficulty with enemy type unlocks

### Player Class System

**Three Distinct Archetypes:**

| Class | HP | Speed | Damage | Fire Rate | Playstyle |
|-------|-----|-------|--------|-----------|-----------|
| Warrior | 150 | 180 | 15 | 0.7s | Tank/Bruiser - High HP, powerful hits |
| Ranger | 100 | 220 | 10 | 0.35s | Balanced - Fast attacks, mobility |
| Mage | 70 | 200 | 18 | 0.6s | Glass Cannon - High damage, low HP |

**Each class includes:**
- Unique color scheme and visual design
- RPG stat distribution (STR, DEX, INT, VIT)
- Directional indicator pointing at enemies
- Multi-layered character model (shadow, body, core, hitbox)

**Implementation Pattern:**
```javascript
export function createPlayerPrefab(k, pos, playerClass = 'ranger') {
    const classDef = PLAYER_CLASSES[playerClass];

    const player = k.add([
        k.pos(pos),
        k.circle(14),
        k.color(classDef.color),
        k.outline(4, k.rgb(classDef.outlineColor)),
        // ... more components
    ]);

    // Assign class-specific properties
    player.hp = classDef.hp;
    player.speed = classDef.speed;
    player.damage = classDef.damage;
    player.stats = { ...classDef.stats };

    return player;
}
```

### Enemy Behavior Components

**Component-Based AI Architecture:**

Each behavior is a reusable component function that modifies an enemy's update loop:

```javascript
function addOrbitBehavior(entity, k, def) {
    entity.orbitAngle = Math.random() * Math.PI * 2;
    entity.orbitDistance = def.orbitDistance || 150;

    const originalUpdate = entity.onUpdate;
    entity.onUpdate = () => {
        if (originalUpdate) originalUpdate();

        // Calculate circular path around player
        const player = k.get("player")[0];
        entity.orbitAngle += entity.orbitSpeed * k.dt();
        const targetX = player.pos.x + Math.cos(entity.orbitAngle) * entity.orbitDistance;
        const targetY = player.pos.y + Math.sin(entity.orbitAngle) * entity.orbitDistance;
        // Move toward orbit position...
    };
}
```

**Benefits of Component Pattern:**
- ✅ **Reusable** - Behaviors can be applied to any enemy
- ✅ **Maintainable** - Each behavior isolated in its own function
- ✅ **Extensible** - Easy to add new behaviors
- ✅ **Composable** - Could combine multiple behaviors
- ✅ **Clean Code** - Separates behavior logic from entity creation

### Enemy Type Breakdown

| Enemy | Behavior | HP | Speed | Damage | Special Ability | XP | Unlock Wave |
|-------|----------|-----|-------|--------|----------------|-----|-------------|
| Charger | Chase | 50 | 80 | 10 | Basic rush | 5 | 1 |
| Fast | Chase | 30 | 150 | 5 | Speed demon | 8 | 1 |
| Swarm | Erratic | 20 | 120 | 3 | Unpredictable | 3 | 1 |
| Tank | Chase | 200 | 40 | 25 | High HP | 20 | 2 |
| Circler | Orbit | 60 | 100 | 8 | Orbits player | 10 | 3 |
| Shooter | Ranged | 40 | 60 | 5 | Fires projectiles | 12 | 4 |
| Teleporter | Blink | 45 | 0 | 12 | Teleports nearby | 15 | 6 |
| Splitter | Chase | 70 | 70 | 10 | Splits into 3 on death | 18 | 8 |

**Visual Distinctions:**
- **Teleporter**: Cyan with glowing core, fade effect during blink
- **Shooter**: Pink with barrel indicator
- **Splitter**: Lime with segmented appearance
- **Circler**: Purple with orbital ring outline
- **Swarm**: Lavender, small and numerous

### Weighted Spawn System

**Progressive Difficulty:**

Enemies unlock as waves progress, creating natural difficulty curve:

```javascript
function getAvailableEnemyTypes() {
    const wave = state.currentWave;
    const types = ['charger', 'fast', 'swarm']; // Always available

    if (wave >= 2) types.push('tank');
    if (wave >= 3) types.push('circler');
    if (wave >= 4) types.push('shooter');
    if (wave >= 6) types.push('teleporter');
    if (wave >= 8) types.push('splitter');

    return types;
}
```

**Spawn Weights (Higher = More Common):**
```javascript
const weights = {
    swarm: 12,      // Very common (cannon fodder)
    charger: 10,    // Common
    fast: 8,        // Common
    circler: 6,     // Uncommon
    shooter: 5,     // Uncommon
    tank: 4,        // Rare
    teleporter: 3,  // Rare
    splitter: 2,    // Very rare (dangerous when it splits)
};
```

This creates varied enemy compositions while preventing overwhelming difficulty spikes.

### Class Selection UI

**Interactive Card-Based Interface:**

```javascript
function showClassSelection() {
    // Create card for each class
    Object.entries(PLAYER_CLASSES).forEach(([classKey, classDef]) => {
        const card = document.createElement('div');

        // Display:
        // - Class name and description
        // - Base stats (HP, Speed, Damage, Fire Rate)
        // - RPG stats (STR, DEX, INT, VIT)
        // - Hover effects with glow animations

        card.onclick = () => startGame(classKey);
    });
}
```

**Features:**
- Beautiful gradient backgrounds
- Class-specific color schemes
- Hover effects with dynamic glow
- Smooth transitions
- Complete stat breakdown

### Implementation Files Modified

**config.js**
- Added `PLAYER_CLASSES` with 3 class definitions
- Expanded `ENEMY_DEFS` with 5 new enemy types
- Added behavior-specific properties (orbitDistance, shootRange, etc.)

**prefabs.js**
- Enhanced `createPlayerPrefab()` with class parameter
- Added 5 behavior component functions:
  - `addOrbitBehavior()`
  - `addShooterBehavior()`
  - `addTeleportBehavior()`
  - `addSwarmBehavior()`
- Enhanced `createEnemyPrefab()` with behavior components
- Added visual distinctions per enemy type
- Implemented splitter death behavior

**player.js**
- Added `playerClass` parameter to `initPlayer()`
- Passes class selection to prefab creation

**main.js**
- Created `showClassSelection()` UI function
- Modified game flow: Splash → Class Selection → Game
- Updated `startGame()` to accept player class

**waves.js**
- Implemented `getAvailableEnemyTypes()` for progressive unlocks
- Added weighted spawn system with `spawnRandomEnemy()`

**ui.js**
- Added class name display to HUD
- Shows below health bar in top-left

**state.js**
- Added `playerClass` property
- Preserved between game restarts

### Gameplay Impact

**Strategic Depth:**
- Class choice affects viable strategies
- Warrior can facetank, Mage must kite
- Enemy variety requires adaptation
- Splitters punish clustering
- Teleporters disrupt positioning
- Shooters force movement

**Visual Clarity:**
- Each enemy instantly recognizable by color and shape
- Player direction indicator improves awareness
- Class-specific colors aid identification

**Progression:**
- Natural difficulty curve through enemy unlocks
- New mechanics introduced gradually
- Weighted spawns prevent overwhelming compositions

### Performance Considerations

**Efficient Implementation:**
- Behavior components don't create extra objects
- Manual collision detection for reliability
- Event-driven communication minimizes coupling
- Component composition is zero-overhead

**Entity Counts:**
- Swarm enemies are lightweight (small, simple AI)
- Splitters carefully weighted (2/22 probability)
- Projectiles from shooters reuse existing system

### Lessons Learned

**Component Pattern Success:**
> Behavior components proved highly effective. Adding a new enemy behavior takes ~30 lines of isolated code. No modifications to existing enemies needed.

**Visual Design Matters:**
> Distinct enemy appearances (colors, shapes, effects) dramatically improved readability. Players can identify threats at a glance.

**Progressive Unlocks Work:**
> Introducing enemy types gradually (waves 1→2→3→4→6→8) creates natural learning curve without explicit tutorial.

**Class System Adds Replay Value:**
> Three distinct playstyles encourage multiple runs. Each class feels meaningfully different, not just stat tweaks.

### Future Enhancements

**Potential Additions:**
- More classes (Assassin, Paladin, Necromancer)
- Class-specific ultimate abilities
- Enemy variants (Elite versions)
- Boss enemies with complex patterns
- Upgrade synergies with classes
- Class-specific weapon types

### Wave Tracking System (2026-02-14 Fix)

**Problem:**
Original system used simple counters (`enemiesSpawnedThisWave`, `enemiesKilledThisWave`) which failed when:
- Splitter enemies spawned additional enemies on death (not counted)
- Enemies wandered off-screen and became "orphaned"
- Spawn rate too slow caused empty screens mid-wave
- Behavior components broke enemy functionality

**Solution: Tag-Based Tracking**

**1. Wave Number Tags**
```javascript
// Enemy creation with wave tag
const tags = ["enemy"];
if (isWaveEnemy && waveNumber !== null) {
    tags.push(`wave_${waveNumber}`);
}

const enemy = k.add([
    k.pos(pos),
    k.circle(def.size),
    ...tags,  // Adds both "enemy" and "wave_1" tags
]);
```

**Benefits:**
- Query specific wave enemies: `k.get('wave_1')`
- Bonus enemies (splitters) don't interfere: marked as non-wave enemies
- Wave completion checks actual living enemies, not counters

**2. Wave Completion Check**
```javascript
function checkWaveCompletion() {
    const waveTag = `wave_${state.currentWave}`;
    const waveEnemies = k.get(waveTag);

    // Kill off-screen enemies
    waveEnemies.forEach(enemy => {
        if (isOffScreen(enemy, 100)) {
            events.emit('enemyDamaged', enemy, 9999);
        }
    });

    // Complete when all wave-tagged enemies dead
    if (enemiesSpawnedThisWave >= enemiesPerWave &&
        k.get(waveTag).length === 0) {
        completeWave();
    }
}
```

**3. Off-Screen Cleanup**
- Automatically kills enemies >100 pixels beyond screen bounds
- Prevents "ghost" enemies from blocking progression
- Logs which enemies are killed for debugging

**4. Spawn Rate Optimization**
- Reduced from 2.0s to 0.8s between spawns
- 5 enemies now spawn in 4 seconds instead of 10
- Prevents empty screens during active waves

**Results:**
- ✅ Wave progression always completes correctly
- ✅ Splitter enemies don't break tracking
- ✅ No more orphaned enemies
- ✅ Faster, more engaging gameplay
- ✅ Better debugging with detailed logs

### Code Quality Metrics

**Lines Added/Modified:**
- config.js: +120 lines (class/enemy definitions)
- prefabs.js: +180 lines (behaviors and enhancements)
- main.js: +90 lines (class selection UI)
- waves.js: +95 lines (tag tracking + weighted spawning)
- enemies.js: +15 lines (wave number parameters)
- ui.js: +15 lines (class display)
- player.js: +5 lines (class parameter)
- state.js: +5 lines (class property)

**Total Enhancement:** ~525 lines of new code
**Bugs Fixed:** 5 critical bugs (behavior override, wave tracking, spawn rate, off-screen enemies, swarm visibility)
**Breaking Changes:** None (backward compatible)

---

---

## Game 006: Wolfenstein-like Raycasting FPS

### Phase 3: Enemy System & AI (2026-02-15)

**Implementation Overview:**

Game 006 Phase 3 introduced a complete enemy system with AI behaviors, all rendered using Kaplay's drawing API rather than sprites. This was a significant architectural choice that proved highly effective.

### Enemy Rendering with Kaplay Drawing API

**Design Decision:**
Instead of using sprite assets, enemies are rendered as procedurally-generated billboards using Kaplay's primitive drawing functions (`drawRect`, `drawCircle`, `drawEllipse`).

**Benefits:**
- ✅ **Zero Assets**: No image files needed, faster loading
- ✅ **Distinctive Visuals**: Each enemy type has unique color and shape
- ✅ **Billboard Rendering**: Sprites always face camera naturally
- ✅ **Easy Customization**: Change colors/sizes without editing sprites
- ✅ **Depth Sorting**: Integrates seamlessly with raycasting z-buffer

**Implementation Pattern:**
```javascript
// Enemy sprite rendering (renderer.js)
function drawEnemySprite(enemy, screenX, spriteHeight, distance) {
    const spriteWidth = spriteHeight * 0.8;
    const drawY = screenCenterY - spriteHeight / 2;

    // Body (colored rectangle based on enemy type)
    k.drawRect({
        width: spriteWidth,
        height: spriteHeight * 0.7,
        pos: vec2(screenX - spriteWidth / 2, drawY + spriteHeight * 0.3),
        color: k.rgb(enemy.type.color),
    });

    // Head (lighter circle)
    k.drawCircle({
        radius: spriteWidth * 0.3,
        pos: vec2(screenX, drawY + spriteHeight * 0.15),
        color: k.rgb(headColor),
    });

    // Arms (darker rectangles)
    // ... etc
}
```

**Visual Design Per Enemy Type:**
- **Guard**: Green uniform (50 HP, 2 u/s)
- **Officer**: Blue uniform (75 HP, 3 u/s)
- **SS Trooper**: Dark gray uniform (100 HP, 4 u/s)
- **Dog**: Brown, smaller size (30 HP, 5 u/s, melee only)
- **Boss**: Red armor, larger size (500 HP, 2 u/s)

### AI State Machine Implementation

**Four-State FSM:**

1. **PATROL** - Default idle state
   - Rotates slowly (30°/s) scanning for player
   - Checks FOV cone for player detection
   - Transitions to ALERT when player spotted

2. **ALERT** - Investigation state
   - Rotates faster (60°/s) looking around
   - Stores last known player position
   - 5-second timeout returns to PATROL
   - Transitions to CHASE if player found

3. **CHASE** - Active pursuit
   - Direct movement toward player
   - Collision detection with walls
   - Updates facing angle to player direction
   - Transitions to ATTACK when in weapon range

4. **ATTACK** - Combat engagement
   - Stops moving, faces player
   - Fires weapon based on fire rate
   - Occasional strafing (10% chance per frame)
   - Returns to CHASE if player escapes range

**Key AI Features:**
- FOV-based detection (customizable angle per enemy type)
- Line-of-sight raycasting (can't see through walls)
- Distance-based accuracy for enemy shooting
- Smooth state transitions with logging

### Critical Bug: Missing Enemy Reference in Hit Objects

**The Problem:**

During Phase 3 testing, players could shoot enemies (checkEnemyHit was working), but enemies weren't taking damage. Console logs showed:

```
✅✅✅ RETURNING HIT: Officer at 1.28 units
```

But no damage was being applied. The bug was **subtle and easy to miss**.

**Root Cause:**

In `weapons.js`, the hit detection was working perfectly, but when creating the hit object to return, we forgot to copy the `enemy` reference:

```javascript
// ❌ BROKEN CODE (lines 310-317)
if (hit && hit.distance <= weapon.range) {
    const damage = calculateDamage(weapon, hit.distance);

    hits.push({
        target: hit.target,
        // MISSING: enemy: hit.enemy,  ← THIS LINE WAS MISSING!
        damage: damage,
        distance: hit.distance,
        x: hit.x,
        y: hit.y,
        weapon: weapon.id,
    });
}
```

**Why It Failed:**

The call chain was: `raycaster.js` → `weapons.js` → `input.js` → `enemies.js`

1. `castSingleRay()` in raycaster.js correctly returned `{ target: 'enemy', enemy: enemyObj }`
2. `fireWeapon()` in weapons.js received this hit, calculated damage
3. BUT when pushing to `hits` array, it **didn't copy the `enemy` property**
4. `input.js` tried to call `hit.enemy.takeDamage()` on undefined
5. No error thrown (just silent failure), no damage applied

**The Fix:**

```javascript
// ✅ FIXED CODE
hits.push({
    target: hit.target,
    enemy: hit.enemy,  // ← Added this line!
    damage: damage,
    distance: hit.distance,
    x: hit.x,
    y: hit.y,
    weapon: weapon.id,
});
```

**Lessons Learned:**

> **Critical Lesson**: When passing data through multiple function calls, **always verify that all necessary properties are being copied/forwarded correctly**. Silent failures (undefined properties) can be harder to debug than explicit errors.

**Debugging Process:**
1. Added extensive logging to `checkEnemyHit()` - confirmed it was working
2. User provided console output showing hits were being detected
3. Noticed no `takeDamage()` logs despite hit detection working
4. Traced the data flow: raycaster → weapons → input
5. Found the missing property copy in the middle of the chain

**Prevention:**
- ✅ Use TypeScript or JSDoc for type checking
- ✅ Add logging at each step of data transformation
- ✅ Verify object properties are complete after copying/transforming
- ✅ Test integration points between modules thoroughly

### Enemy Hit Detection System

**Hit Detection Algorithm:**

Uses dot product and perpendicular distance for generous hit detection:

```javascript
export function checkEnemyHit(rayDirX, rayDirY, playerX, playerY, maxDistance) {
    for (const enemy of state.enemies) {
        if (!enemy.alive) continue;

        const dx = enemy.x - playerX;
        const dy = enemy.y - playerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > maxDistance) continue;

        const dirX = dx / distance;
        const dirY = dy / distance;

        // Dot product: 1 = perfect aim, 0 = perpendicular
        const dot = dirX * rayDirX + dirY * rayDirY;

        if (dot > 0.7) {  // Enemy roughly in front
            // Perpendicular distance from ray to enemy
            const perpDist = Math.abs(dirX * rayDirY - dirY * rayDirX) * distance;

            if (perpDist < 0.8) {  // Generous hit radius
                if (distance < closestDist) {
                    closestHit = enemy;
                    closestDist = distance;
                }
            }
        }
    }
    return closestHit;
}
```

**Tuning Notes:**
- Initial dot product threshold of 0.98 was too strict (almost impossible to hit)
- Changed to 0.7 for more forgiving gameplay
- Perpendicular distance of 0.8 provides good balance

### Integration with Weapon System

**All Four Weapons Work with Enemies:**

1. **Pistol**: Hitscan, infinite ammo, reliable damage
2. **Machine Gun**: Rapid hitscan with slight spread
3. **Shotgun**: Multiple pellets (5), wide spread, distance falloff
4. **Rocket Launcher**: Projectile with splash damage to multiple enemies

**Splash Damage Implementation:**

Rockets check all enemies within splash radius on explosion:

```javascript
function handleProjectileExplosion(projectile) {
    if (state.enemies && projectile.splashRadius) {
        for (const enemy of state.enemies) {
            if (!enemy.alive) continue;

            const dx = enemy.x - projectile.x;
            const dy = enemy.y - projectile.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance <= projectile.splashRadius) {
                const distanceFactor = 1 - (distance / projectile.splashRadius);
                const damage = projectile.damage * distanceFactor;
                enemy.takeDamage(damage);
            }
        }
    }
}
```

### Performance Considerations

**Optimizations:**
- Maximum 20 enemies active at once (configurable)
- Enemies beyond 20 units culled (not rendered or updated)
- Enemies behind camera skipped entirely
- Dead enemies removed after 3-second death animation
- Per-column depth testing prevents overdraw

**Frame Rate:**
- Maintains 60 FPS with 6 active enemies
- Raycasting + enemy rendering + AI all complete within 16ms

### Architecture Patterns Used

**1. Separation of Concerns:**
- `enemies.js`: Enemy class, AI logic, spawn system
- `renderer.js`: Enemy rendering, depth sorting, billboarding
- `raycaster.js`: Hit detection integration
- `weapons.js`: Damage application, projectile collision
- `input.js`: Player shooting, damage application

**2. Data Flow:**
```
Player fires → castSingleRay() → checkEnemyHit() → fireWeapon() →
handleShoot() → enemy.takeDamage() → enemy.die() → state.enemiesKilled++
```

**3. Event-Driven Updates:**
- Enemy AI runs in `updateEnemies()` called from main game loop
- Rendering happens in `renderEnemies()` called from player's draw()
- Clean separation between logic and rendering

### Visual Feedback System

**Enemy Rendering Features:**
- Health bars above damaged enemies (green → yellow → red)
- Muzzle flash when enemy shoots (bright yellow circle)
- Death animation (enemy falls to ground as flat ellipse)
- Depth sorting (far to near, painter's algorithm)
- Z-buffering (don't render behind walls)
- Proper 3D perspective scaling

**Console Logging:**
```
✓ Spawned Guard at (5.5, 5.5) - HP: 50, Speed: 2
Guard → PATROL
Guard → ALERT (Player detected!)
Guard → CHASE (Pursuing player!)
Guard → ATTACK (In range!)
Guard hit player for 8 damage! (92 HP remaining)
⚔️ Guard took 18.3 damage! HP: 50.0 → 31.7/50
⚔️ Guard took 22.1 damage! HP: 31.7 → 9.6/50
⚔️ Guard took 17.4 damage! HP: 9.6 → 0.0/50 💀 KILLED!
Guard killed! Total kills: 1
```

### Testing Insights

**Debug Helper:**
```javascript
window.debugEnemies = () => {
    console.log('=== ENEMY STATUS ===');
    state.enemies.forEach((enemy, i) => {
        const dist = Math.sqrt(
            (enemy.x - state.player.x) ** 2 +
            (enemy.y - state.player.y) ** 2
        ).toFixed(1);
        console.log(`${i + 1}. ${enemy.type.name} - HP: ${enemy.hp.toFixed(0)}/${enemy.maxHp} - State: ${enemy.state} - Alive: ${enemy.alive} - Dist: ${dist} units`);
    });
};
```

Call `debugEnemies()` in browser console to inspect all enemy states in real-time.

### Key Takeaways

**What Worked Well:**
✅ Kaplay drawing API for enemy rendering (no sprites needed)
✅ Four-state AI FSM is simple but effective
✅ Billboard rendering integrates perfectly with raycasting
✅ FOV-based detection feels fair and realistic
✅ Extensive logging made debugging much easier

**What Was Challenging:**
❌ Hit detection initially too strict (dot product tuning)
❌ Missing property in object copying caused silent failure
❌ Debugging data flow across 4 modules took careful tracing
❌ Balancing enemy movement speed vs player movement

**Architecture Success:**
> The modular architecture from game-005 proved invaluable. Having enemies, weapons, raycasting, and rendering in separate modules made it easy to debug the missing enemy reference bug by isolating each step of the data flow.

**Phase 3 Complete:** ✅ All 5 enemy types working, AI behaviors functional, weapon integration complete, rendering optimized.

### Phase 4-6 Findings (2026-02-16)

These findings come from reviewing the current `game-006` implementation and its phase docs/changelog.

#### 1) Scene-safe input handlers prevent cross-scene bugs

Issue pattern: Global click/key handlers in menu systems can continue firing after scene changes.

Working pattern (game-006):
- Gate menu actions with a scene check before executing:
  - `if (k.getSceneName() === "menu") { k.go("game"); }`
- This avoids gameplay clicks being interpreted as menu clicks.

Files:
- `game-006/js/menu.js`
- `game-006/CHANGELOG.md`

#### 2) Spawn validation should be mandatory for runtime entities

Issue pattern: Procedural or configured spawns can land inside walls, creating invisible/invalid entities.

Working pattern (game-006):
- Validate tile walkability at spawn time for both enemies and items:
  - Reject spawn when `getTile(x, y) !== 0`
  - Return `null` and log the failure reason
- This gives safe failure behavior and actionable debugging output.

Files:
- `game-006/js/enemies.js`
- `game-006/js/items.js`

#### 3) Gate the update loop until async floor load completes

Issue pattern: Systems update before map/state is initialized, causing transient null/state errors.

Working pattern (game-006):
- Use an explicit `floorLoaded` guard:
  - Start floor load (`loadFloor(1)`), set flag only on completion
  - Early-return in `onUpdate()` until ready
- This keeps startup deterministic and prevents race conditions.

Files:
- `game-006/js/main.js`
- `game-006/js/floor.js`

#### 4) Progression clarity: expose objective state in HUD

Design insight: "Kill all enemies to unlock exit" is clearer when the UI shows remaining count.

Working pattern (game-006):
- Add `Enemies Left` to HUD with color state:
  - Red when enemies remain
  - Green when clear
- Couple this with runtime door spawning when alive enemy count reaches zero.

Files:
- `game-006/js/ui.js`
- `game-006/js/main.js`

#### 5) Large procedural maps require spawn-density tuning, not just size scaling

Issue pattern: Bigger maps alone often reduce engagement density (long downtime between encounters).

Tuning pattern used:
- Reduce map dimensions to improve pacing (`160x160 -> 80x80`)
- Increase enemy baseline and scaling
- Guarantee a nearby-enemy subset on floor start
- Add bonus enemies in larger rooms
- Increase item spawn rate and per-room item cap
- Increase view distance to improve encounter visibility

Files:
- `game-006/js/config.js`
- `game-006/js/procgen.js`
- `game-006/CHANGELOG.md`

#### 6) Keep planning docs synced with implementation values

`game-006/game-plan.md` still describes older targets in several places (for example older map-size/ray-distance assumptions), while current implementation has moved on. For fast-moving game iterations, include a lightweight "current defaults" section in the plan and update it whenever config baselines change.`r`n`r`n---

---

## Game 007: Interactive Fiction Text Adventure (2026-02-19)

### Architecture: DOM-Based Text Engine vs Kaplay

**Design Decision:**
Game 007 uses a pure DOM-based text rendering system instead of Kaplay, despite the game plan originally specifying Kaplay. This is the right call for text-heavy games.

**Why DOM works better for text adventures:**
- ✅ Native text rendering (no manual word-wrap math, just CSS)
- ✅ Scrollable text buffer is trivially a CSS `overflow-y: scroll`
- ✅ Typewriter effect runs on `requestAnimationFrame` without a Kaplay game loop
- ✅ Browser handles accessibility (screen readers, text selection)
- ✅ Simpler module structure — no Kaplay initialization overhead

**Pattern used:**
```javascript
// TextEngine creates DOM elements per line
addLineToBuffer(text, colorClass) {
    const line = document.createElement('div');
    line.className = `text-line ${colorClass}`;
    line.textContent = '';  // Filled by typewriter
    this.textBuffer.appendChild(line);
}
```

**Key Lesson:**
> Kaplay is ideal for sprite/canvas games. For text-heavy interactive fiction, standard DOM + CSS is simpler, more accessible, and equally performant.

---

### Examinable Objects Pattern for Interactive Scenery

**Problem:** Text adventure rooms need interactive scenery (carvings, bookshelves, murals) that isn't a carriable item, but is still examinable and potentially hides secrets.

**Solution:** Add an `examinable` map to room data alongside the items array.

**Room data structure:**
```javascript
{
    id: "library",
    items: ["old_manuscript"],
    examinable: {
        "bookshelf": {
            description: "You notice one section is slightly out of alignment...",
            revealsExit: { direction: "west", roomId: "hidden_passage" },
            aliases: ["bookshelves", "shelves", "shelf"]
        },
        "scroll": {
            description: "The scroll reads: '...'",
            aliases: ["open scroll", "desk"]
        }
    }
}
```

**World method:**
```javascript
examineObject(searchTerm) {
    const room = this.getCurrentRoom();
    for (const [key, obj] of Object.entries(room.examinable)) {
        const match = key.toLowerCase().includes(search) ||
            obj.aliases?.some(a => a.toLowerCase().includes(search));
        if (match) {
            if (obj.revealsExit && !obj.revealed) {
                obj.revealed = true;
                room.exits[obj.revealsExit.direction] = obj.revealsExit.roomId;
            }
            return { description: obj.description, revealedExit: ... };
        }
    }
    return null;
}
```

**Benefits:**
- Scenery stays separate from inventory items
- Aliases allow flexible player input ("shelf", "bookshelves", "west bookshelf" all work)
- `revealsExit` enables hidden passages discovered through exploration
- `revealed` flag prevents double-triggering

---

### Bug: Key Items Never Unlocking Doors (Dead Code Pattern)

**Bug:** `USE iron_key` or `USE bronze_key` printed a generic "You use the Iron Key." but never unlocked any doors.

**Root cause:**
In `parser.js`, `handleItemUse(itemId, targetId)` was only called when `result.target` was truthy:
```javascript
// ❌ BROKEN: handleItemUse only called with a target
if (result.target) {
    this.handleItemUse(itemId, result.target);
}
```

And `inventory.useItem` only sets `result.target` when the item has a `useWith` list that includes the specific target. Keys had empty or missing `useWith`, so `result.target` was always undefined — the key unlock code was **dead code**.

**Fix:** Always call `handleItemUse`, and have it return a boolean indicating whether it handled the interaction:
```javascript
// ✅ FIXED
const specialHandled = this.handleItemUse(itemId, targetId || result.target || null);
if (!specialHandled) {
    this.textEngine.print(result.message);  // Generic fallback
}
```

`handleItemUse` returns `true` if it printed its own message (suppresses generic), `false` to allow generic message.

**Key lesson:**
> When building command handlers that need special-case behavior, always call the special-case handler first and use a return value to control whether the generic fallback runs. Never gate special handling on data that might not be set.

---

### Lock System: Custom Messages and Item Name Display

**Two improvements to the locked exit system:**

**1. Show item name not ID in lock messages:**
```javascript
// ❌ "The way north is locked. You need rope_and_hook."
// ✅ "The way north is locked. You need Rope with Grappling Hook."
const keyName = getItemName(room.locked.requiresKey);
return { success: false, message: `The way ${direction} is locked. You need ${keyName}.` };
```

**2. Custom lock messages for non-key barriers:**
Some "locks" aren't literal locks (e.g., a high window you need to climb). Add an optional `message` field:
```javascript
locked: {
    direction: "north",
    requiresKey: "rope_and_hook",
    message: "The high window is far out of reach. You need something to climb."
}
```
World checks `room.locked.message` first before falling back to the generic format.

---

### Text Adventure World Design: Key Progression Paths

**Pattern for designing interconnected rooms with gated progression:**

Draw out the key chain before writing room descriptions:
```
Player needs:     To get:        Located in:      Which requires:
iron_key       →  temple door  ←  dark_alcove   ←  equip torch (light)
bronze_key     →  library      ←  collapsed_tunnel ← dark_alcove (light)
rope_and_hook  →  upper_balcony ← rope (stream) + hook (armory)
```

**This reveals design requirements before coding:**
- Which rooms MUST have light (dark rooms gating key items)
- Which items must be placed in which rooms for a solvable path
- Whether any items are unreachable (soft-lock check)

**Soft-lock prevention checklist:**
- Every dark room's key item must be reachable with available light sources
- No locked door should require a key that's behind that same door
- Combinable items (rope + hook) must not both be gated by the same lock

---

---

---

## Game 008: Centipede Tower Defense (2026-02-21)

### Bug: Entity Position Not Updating Visually

**Symptom:** Centipede segments appeared frozen at spawn position despite internal state updating correctly. Player ship did not move when arrow/WASD keys were pressed, even though internal coordinate values were changing.

**Root Cause:** `entity.pos` in Kaplay v4000 is a **getter/setter pair**, not a plain Vec2 field. Reading `entity.pos` returns a temporary Vec2 object. Mutating `.x` or `.y` on that temporary object has no effect on the rendered position.

```javascript
// ❌ BROKEN — mutates a throwaway Vec2, no visual effect
ent.pos.x = w.x;
ent.pos.y = w.y;

// ✅ CORRECT — triggers the pos setter, updates rendered position
ent.pos = k.vec2(w.x, w.y);
```

**Prevention:** Always use `entity.pos = k.vec2(x, y)` to move entities. Never use `entity.pos.x = value`.

---

### Bug: Opacity Assignment Silently Ignored

**Symptom:** Invincibility flash effect had no visible effect — `entity.opacity = 0` did nothing.

**Root Cause:** `entity.opacity` is a Kaplay component property that only exists when the entity was created with `k.opacity(initialValue)` in its component list. Without the component, the assignment is silently ignored.

```javascript
// ❌ BROKEN — no opacity component, setting .opacity does nothing
k.add([k.pos(x, y), k.rect(w, h), k.color(r, g, b)]);
entity.opacity = 0;  // silently ignored

// ✅ CORRECT — include k.opacity() so the component is registered
k.add([k.pos(x, y), k.rect(w, h), k.color(r, g, b), k.opacity(1)]);
entity.opacity = 0;  // works
```

**Prevention:** Any entity that will have its `.opacity` changed after creation must include `k.opacity(1)` in its `k.add([...])` component array.

---

### Architecture: Hybrid Canvas + DOM Shop

A shop that needs both quick in-game access and a richer between-wave layout works well as a hybrid:
- **In-game sidebar** (Kaplay canvas): tower buttons drawn as canvas entities with `k.area()` + `onClick()`
- **Between-wave overlay** (DOM): pauses the game, shows full stats table, close button resumes

```javascript
// In-game sidebar (Kaplay canvas)
k.add([k.rect(w, h), k.pos(x, y), k.area(), k.color(...)]);
entity.onClick(() => events.emit('towerTypeSelected', type));

// Between-wave overlay (DOM)
const overlay = document.createElement('div');
overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;...';
document.body.appendChild(overlay);
```

Kaplay canvas buttons are pixel-perfect with the game grid; the DOM overlay can use full CSS layout without z-index conflicts.

---

### Pattern: Tag-Based Temporary Overlay Entities

Decorative entities (range circles, hover highlights) that need easy cleanup should be tagged rather than referenced:

```javascript
function showRangeFor(col, row, range) {
    k.destroyAll('towerRange');
    k.add([
        k.circle(range * TILE_SIZE),
        k.pos(cx, cy),
        k.color(100, 180, 255),
        k.opacity(0.15),
        k.anchor('center'),
        'towerRange',
    ]);
}
// On any cleanup: k.destroyAll('towerRange')
```

No reference variable needed — `k.destroyAll('towerRange')` handles scene restarts and state changes cleanly.

---

### Pattern: Chain-Wide Slow Debuff

For chained enemies (centipede), applying a slow to the entire chain is simpler and feels better than per-segment tracking:

```javascript
// In Centipede class
applySlow(factor, duration) {
    this.slowFactor = factor;   // e.g. 0.4 = 60% slow
    this.slowTimer = duration;
}
// In update():
if (this.slowTimer > 0) {
    this.slowTimer -= dt;
    if (this.slowTimer <= 0) this.slowFactor = 1.0;
}
const effectiveSpeed = this.baseSpeed * this.slowFactor;
```

The visual of the whole centipede crawling slowly is more impactful than individual segments reacting independently.

---

### Pattern: Placement Mode State Flag

UI modes (e.g., tower placement) should be managed with a single module-level flag and a paired ESC cancel:

```javascript
let _placingType = null;
export function enterPlacementMode(type) { _placingType = type; }
export function exitPlacementMode()      { _placingType = null; }

// In main.js
k.onKeyPress('escape', () => { if (_placingType) exitPlacementMode(); });
```

---

---

---

## Game 008: Code Logic Pass — Full Module Review (2026-02-21)

This section captures logic patterns, edge cases, and subtle design decisions observed across all 11 game-008 modules during a full code review.

---

### 1. Smart Bomb Kills Must Snapshot Positions First

**File**: `player.js` — `_detonateSmartBomb()`

When a smart bomb kills all centipede segments, each kill can split the centipede and create new children that inherit the same tile positions. If you call `hitCentipedeAt()` live while iterating, new split children are immediately live and their segments match the same positions from the snapshot — so subsequent calls in the loop naturally kill them too.

The pattern that makes this safe:

```javascript
// Snapshot ALL segment positions first (before any kills trigger splits)
const positions = [];
for (const c of state.centipedes) {
    for (const seg of c.segments) {
        positions.push({ col: seg.col, row: seg.row });
    }
}
// Now kill each snapshot position — split children inherit same positions
for (const { col, row } of positions) {
    hitCentipedeAt(col, row);
}
```

**Key Lesson**: When a kill action creates new entities that share positions with the original, snapshot first and iterate the snapshot. New children will be caught by subsequent hits in the same loop without needing special-case handling.

---

### 2. Spawn Immunity via `growingSteps` Counter

**File**: `centipede.js` — `Centipede.create()` / `hitAt()`

Fresh centipedes spawn with all segments stacked on the same starting tile. Without immunity, a bullet hitting that tile would kill all segments at once before the centipede even starts moving. The solution: track a `growingSteps` countdown equal to `segCount - 1`.

```javascript
// Centipede.create() sets spawn immunity
return new Centipede(k, type, segments, history, dirX, segCount > 1 ? segCount - 1 : 0);

// hitAt() returns false while immune
if (this.growingSteps > 0) return false;
```

`_step()` decrements `growingSteps` each tick. Once it hits 0, the centipede is fully spread and can take damage. Immunity is also signalled visually via an opacity pulse (`_flashTimer`).

**Key Lesson**: For enemies that stack on spawn, use a step-countdown for damage immunity rather than a time-based timer — the countdown naturally synchronises with actual movement.

---

### 3. Module-Level Variables Are NOT Reset Between Scene Restarts

**Files**: `player.js`, `towers.js`, `enemies.js`, `waves.js`, `ui.js`, `shop.js`

Each module uses top-level `let` variables for per-scene state (`_bullets`, `_hoverEnt`, `_placementMode`, etc.). These persist across scene restarts because ES modules are only initialised once. Each `init*()` function must **explicitly reset** these variables:

```javascript
// player.js — explicit reset every scene start
export function initPlayer(k) {
    _invincTimer = 0;
    _flashTimer  = 0;
    _fireTimer   = 0;
    _bullets     = [];
    ...
}
```

`ui.js` additionally uses "last seen" values (`_lastLives`, `_lastScore`, etc.) to avoid redundant text updates. These must also be reset, but `initUI` re-initialises them from `state` on every `_createHUD()` call — so they are correct.

**Key Lesson**: Module-level variables that hold per-scene state MUST be reset inside `init*()`. Forgetting this causes stale data from a previous run to bleed into the new scene.

---

### 4. Dual `onUpdate` Registrations in `towers.js`

**File**: `towers.js` — `initTowers()`

`initTowers()` registers two separate `k.onUpdate()` callbacks — one for tower auto-fire logic and one for the placement hover highlight. Both are registered unconditionally on every scene start. This is safe because `events.clearAll()` is called in `onSceneLeave()`, and Kaplay's own `onUpdate` registrations are also tied to the scene lifecycle (they are automatically removed when the scene exits).

This confirms that **multiple `k.onUpdate()` callbacks on the module level are fine** as long as they are all registered inside the scene init (not at module load time).

---

### 5. `_dealDamage` Loop Has a Hidden Limit

**File**: `towers.js` — `_dealDamage()`

The damage helper applies multiple HP points by calling `hitCentipedeAt` / `hitEnemyAt` in a loop:

```javascript
function _dealDamage(col, row, damage) {
    for (let i = 0; i < damage; i++) {
        if (hitCentipedeAt(col, row)) continue;
        if (hitEnemyAt(col, row)) continue;
        break; // nothing left at this tile
    }
}
```

The `break` exits early when neither call succeeds, preventing wasted iterations. However, this means **overkill damage is silently discarded** — a 40-damage sniper shot against a 1-HP segment only applies 1 damage (the target is gone on the first hit, then the loop breaks). This is the intended behaviour since segments have low HP, but it's a subtle interaction to remember when tuning high-damage towers.

---

### 6. Scatter Tower Uses `pellets` as an Array Slice Count

**File**: `towers.js` — `_fireScatter()`

```javascript
const offsets = [-1, 0, 1];
for (const off of offsets.slice(0, tower.pellets)) {
    ...
}
```

The `offsets` array has 3 entries and `pellets` starts at 3. The T2 upgrade adds 2 more pellets (`pellets += 2`), but `offsets` only has 3 elements — `slice(0, 5)` on a 3-element array just returns all 3. So the upgrade has no visible effect on pellet count beyond 3. This is a latent bug: the upgrade appears to add pellets but the visual/logic cap is `offsets.length` (3).

---

### 7. Shop Overlay Auto-Countdown Uses `setInterval`, Not Kaplay's `k.wait`

**File**: `shop.js` — `openShopOverlay()`

The 15-second auto-close countdown uses `setInterval` (a DOM/browser API), not Kaplay's game-loop time. This means it continues ticking even while the game is paused (`state.isPaused = true`). In practice this is fine for the shop (which itself pauses the game while open), but it's a reminder that **DOM timers are independent of the game's pause state**.

`destroyShopDOM()` properly calls `clearInterval` via `closeShopOverlay()`, and `onSceneLeave` also calls `closeShopOverlay()` — so the interval is always cleaned up.

---

### 8. Wave Completion Requires Both Centipede AND Flea Counts

**File**: `waves.js` — `_checkWaveComplete()`

The wave is considered complete only when:
1. `state.centipedes` is either empty or all entries have 0 segments, AND
2. There are no active fleas in `state.enemies`

Spiders and scorpions do NOT block wave completion. This asymmetry is intentional: fleas drop nodes and can block the spawn area, so they must be cleared. Spiders/scorpions are merely nuisances and are cleared by `_clearLeftoverEnemies()` when the wave ends.

---

### 9. Node March: Destination Occupied = Node Lost (Silent)

**File**: `waves.js` — `_runCleanupSequence()`

When nodes march down one row at wave end, if the destination `(col, newRow)` already has a node or tower, the marching node is silently discarded:

```javascript
} else if (!state.hasNode(n.col, newRow) && !state.hasTower(n.col, newRow)) {
    // Place at new row
    state.setNode(n.col, newRow, nodeData);
    ...
}
// If destination is occupied (tower/node), the node is lost
```

This prevents node pile-ups but means late-game boards with many towers will see node density drop faster than expected. It's correct behaviour, just worth documenting.

---

### 10. `_getPlayerTile()` Reads From Kaplay Entity Tag, Not Shared State

**File**: `enemies.js` — `_getPlayerTile()`

Rather than sharing player position via state or events, `enemies.js` queries the live Kaplay entity:

```javascript
function _getPlayerTile() {
    const ships = _k.get('playerShip');
    if (!ships || ships.length === 0) return null;
    const ship = ships[0];
    return worldToTile(ship.pos.x, ship.pos.y);
}
```

This works because `player.js` calls `_updateShipVisuals()` every frame, keeping the entity's `.pos` in sync with the internal `_shipX / _shipY` values. The pattern avoids coupling `enemies.js` to `player.js` directly, but it relies on the Kaplay entity existing and being current.

**Gotcha**: `k.get('playerShip')` returns an array; only the first element is used. If the player ship is destroyed (game over), `ships.length === 0` and `null` is returned safely.

---

### 11. `state.enemies` Array Is Compacted Each Frame

**File**: `enemies.js` — `initEnemies()` update loop

Dead enemies are not removed immediately on kill — they are flagged `enemy.dead = true` and their visuals are destroyed. A separate filter at the end of the update loop rebuilds the array:

```javascript
const alive = state.enemies.filter(e => !e.dead);
state.enemies.length = 0;
state.enemies.push(...alive);
```

This pattern avoids modifying the array while iterating it (the main loop uses `[...state.enemies]` spread for safety). The trade-off is an allocation per frame, but for the small enemy counts in this game it's negligible.

---

### 12. `goldChanged` Emitted Redundantly After Transactions

**Files**: `towers.js` — `placeTowerAt()`, `sellTowerAt()`, `upgradeTowerAt()`

These functions call `state.earn()` or `state.spend()`, which already triggers `events.emit('goldChanged', ...)` via the state setter. Each function then also explicitly calls `events.emit('goldChanged', state.gold)` a second time. This means the shop panel re-renders twice per transaction — harmless but redundant.

---

### 13. HUD Update Uses Polling + Dirty Check, Not Pure Events

**File**: `ui.js` — `_startUpdateLoop()`

The HUD uses a hybrid pattern: it checks `_lastXxx` vs `state.xxx` every frame and only updates the text entity if something changed. It also subscribes to events for overlays (`gameOver`, `gameWon`, `waveStarted`, `waveComplete`). Both mechanisms are active simultaneously.

The polling approach avoids having to emit events for every property change (e.g., smartBombs is never emitted as an event — it's only polled). This is a pragmatic pattern: use events for complex side effects, use polling for simple display values.

---

### 14. Scatter Upgrade Bug: `pellets` Array Slice Cap

*(Listed as finding #6 above — summary here for quick reference)*

`_fireScatter` uses `offsets.slice(0, tower.pellets)` where `offsets` only has 3 entries. Upgrading `pellets` beyond 3 has no effect. The upgrade definition in `config.js` adds `pellets: 2` at T2, making the total 5 — but visually only 3 shots fire. **Potential fix**: expand `offsets` to 5 entries (e.g., `[-2, -1, 0, 1, 2]`) or clamp the upgrade delta.

---

---

---

## Game 008: Polish, Particles & Production Patterns (2026-02-22)

This section captures the learnings from game-008's v1.0.x polish cycle and architectural patterns not previously documented.

---

### Barrel Rotation via `atan2(dx, -dy)`

Towers that need to rotate a barrel sprite/entity toward a target use this formula:

```javascript
const dx = targetWorld.x - towerWorld.x;
const dy = targetWorld.y - towerWorld.y;
const angleDeg = Math.atan2(dx, -dy) * 180 / Math.PI;
```

The negated `dy` converts from Y-up math to Y-down screen space. Result: 0° = pointing up, 90° = pointing right, 180° = pointing down. Apply with `barrel.angle = angleDeg`.

---

### Particle Burst Pattern (Radial)

Evenly distributed particles with randomness feel natural:

```javascript
const COUNT = 8;
for (let i = 0; i < COUNT; i++) {
    const angle = (i / COUNT) * Math.PI * 2 + Math.random() * 0.4;
    const speed = 60 + Math.random() * 90;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    const p = k.add([k.circle(r), k.pos(cx, cy), k.color(...col), k.opacity(1), 'particle']);
    p.onUpdate(() => {
        p.pos = k.vec2(p.pos.x + vx * k.dt(), p.pos.y + vy * k.dt());
        p.opacity = Math.max(0, p.opacity - k.dt() / lifetime);
        if (p.opacity <= 0) k.destroy(p);
    });
}
```

Key points:
- Add a small random offset to the even angle distribution to prevent mechanical regularity
- Use `k.opacity(1)` in component list so `p.opacity` assignments work
- Destroy the particle when opacity reaches 0 (no leak)

---

### Persistent Flame & Smoke Effect (Per-Tile)

For a permanently burned tile (e.g., a destroyed tower slot), spawn continuous particle controllers:

```javascript
function spawnBurnEffect(k, col, row) {
    const { x, y } = tileToWorld(col, row);

    // Permanent scorched overlay
    k.add([k.rect(TILE_SIZE, TILE_SIZE), k.pos(x, y), k.color(20, 10, 5), k.opacity(0.7), k.z(1), 'burnedOverlay']);

    // Flame controller — fires every 0.10s
    const flame = k.add([k.pos(x, y), 'burnEffect']);
    flame.onUpdate(() => {
        flame._t = (flame._t || 0) + k.dt();
        if (flame._t < 0.10) return;
        flame._t = 0;
        // Spawn a rising orange/yellow particle...
    });

    // Smoke controller — fires every 0.28s (similar pattern, grey, larger, slower)
}
```

The controllers (flame, smoke) are lightweight Kaplay entities with no visuals themselves — they just spawn short-lived child particles on a timer. Tag them (`'burnEffect'`) for cleanup via `k.destroyAll('burnEffect')`.

---

### Click Debounce via `k.wait()`

When a single click should trigger one action but might cascade (e.g., placing a tower opens its popup), use a short debounce:

```javascript
let _clickDebounce = false;

function onTileClick(col, row) {
    if (_clickDebounce) return;

    placeTower(col, row);

    _clickDebounce = true;
    k.wait(0.25, () => { _clickDebounce = false; });
}
```

`k.wait()` integrates with Kaplay's frame timing (respects pause) and is cleaner than `setTimeout` for in-game debouncing.

---

### Chain Mechanic with Visited Set

For chain-lightning or tesla-style effects that jump between targets, use a visited set to prevent infinite loops:

```javascript
function fireChain(startCol, startRow, damage, chainCount) {
    const visited = new Set([`${startCol},${startRow}`]);
    let frontier = [{ col: startCol, row: startRow }];

    for (let chain = 0; chain < chainCount; chain++) {
        const next = findClosestUnvisited(frontier, visited, chainRange);
        if (!next) break;
        visited.add(`${next.col},${next.row}`);
        applyDamage(next.col, next.row, damage);
        spawnArc(frontier[frontier.length - 1], next);  // visual
        frontier.push(next);
    }
}
```

---

### Sniper Piercing: Column-Based Instant Hit

Instead of a projectile, sniper towers find all targets in a column and hit them instantly:

```javascript
function fireSniper(tower) {
    const col = target.col;
    // Find ALL segments in this column within range
    for (const c of state.centipedes) {
        for (const seg of c.segments) {
            if (seg.col === col && inRange(tower, seg)) {
                dealDamage(seg.col, seg.row, tower.damage);
            }
        }
    }
    spawnBeam(tower, col);  // white vertical line
}
```

This avoids projectile collision complexity and feels appropriately powerful.

---

### Smart Bomb: Snapshot Before Kill Loop ⚠️ CRITICAL

When killing all enemies at once may cause splits/spawns during iteration, **snapshot positions first**:

```javascript
function detonateSmartBomb() {
    // 1. Snapshot ALL positions BEFORE any kills
    const positions = [];
    for (const c of state.centipedes) {
        for (const seg of c.segments) {
            positions.push({ col: seg.col, row: seg.row });
        }
    }

    // 2. Kill from snapshot — split children inherit same positions
    //    and will be hit by subsequent iterations
    for (const { col, row } of positions) {
        hitCentipedeAt(col, row);
    }
}
```

If you iterate `state.centipedes` live while killing, splits create new live centipedes mid-loop — unpredictable behavior.

---

### Staggered Column March Effect

For a grid of items that need to descend/march (classic arcade style), stagger per-column with `k.wait()`:

```javascript
const COLS = 24;
const STEP_DELAY = 0.045;  // 45ms per column

for (let col = 0; col < COLS; col++) {
    k.wait(col * STEP_DELAY, () => {
        marchColumn(col);
        playMarchSound(col);  // pitch varies by column for musicality
    });
}
```

Creates a satisfying wave-from-left motion rather than a jarring simultaneous jump.

---

### Map-Based O(1) Tile Lookups

For tile-based games with frequent "is there a tower/node at this tile?" queries, use a `Map` keyed by `"col,row"` strings instead of a 2D array:

```javascript
// In state.js
this._towers = new Map();  // key: "col,row"

hasTower(col, row) { return this._towers.has(`${col},${row}`); }
getTower(col, row) { return this._towers.get(`${col},${row}`); }
setTower(col, row, data) { this._towers.set(`${col},${row}`, data); }
removeTower(col, row) { this._towers.delete(`${col},${row}`); }
```

Benefits: O(1) access, no sparse-array overhead, easy iteration with `.values()`.

---

### Timer-Driven Special Enemy AI

Simple arcade enemies don't need pathfinding — use a per-enemy countdown timer:

```javascript
class SpecialEnemy {
    constructor() {
        this._timer = this.stepInterval;  // e.g. 0.3s
    }

    update(dt) {
        this._timer -= dt;
        if (this._timer <= 0) {
            this._timer = this.stepInterval;
            this._step();
        }
    }

    _step() {
        // Move one tile, change direction, fire, etc.
    }
}
```

The timer-based approach decouples movement from frame rate, makes speed easy to tune, and avoids jitter.

---

### Spawn Immunity via Step Countdown

Enemies that spawn stacked on one tile need immunity to prevent instant kill before spreading:

```javascript
class Centipede {
    constructor(segments) {
        this.growingSteps = segments.length - 1;  // steps until spread
    }

    hitAt(col, row) {
        if (this.growingSteps > 0) return false;  // immune
        // ... normal hit logic
    }

    _step() {
        if (this.growingSteps > 0) this.growingSteps--;
        // ... move logic
    }
}
```

The countdown syncs naturally with actual movement — the entity becomes vulnerable exactly when it finishes spreading. Time-based immunity would be less precise.

---

### Between-Wave DOM Shop + In-Game Kaplay Sidebar (Hybrid UI)

When a game needs both a rich shop screen (between waves) and quick in-game access (during play), a hybrid works well:

- **In-game sidebar**: Kaplay canvas entities with `k.area()` + `onClick()` — pixel-perfect with game grid
- **Between-wave overlay**: DOM `div` with CSS layout, appended to `document.body`

```javascript
// DOM overlay
const overlay = document.createElement('div');
overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;...';
document.body.appendChild(overlay);

// Cleanup on close / scene leave
function closeShop() {
    clearInterval(countdownInterval);
    overlay.remove();
}
k.onSceneLeave(closeShop);
```

Important: DOM timers (`setInterval`) run independently of game pause — always `clearInterval` in `closeShop` and in `onSceneLeave`.

---

### HUD Polling + Dirty Check Pattern

For HUD values that update frequently (score, gold), polling with a dirty-check is simpler than emitting events for every change:

```javascript
let _lastScore = -1;

function _updateLoop() {
    if (state.score !== _lastScore) {
        _lastScore = state.score;
        scoreLabel.text = `SCORE  ${state.score}`;
    }
    // Check other values...
}

k.onUpdate(_updateLoop);
```

Use events for complex side effects (game over overlay, wave banners); use polling for simple display-only values.

---

### `goldChanged` Double-Emit (Anti-Pattern to Avoid)

In game-008, `towers.js` functions (`placeTowerAt`, `sellTowerAt`, `upgradeTowerAt`) call `state.spend()` / `state.earn()` which already emit `goldChanged`, then also manually emit `goldChanged` again. This causes the shop UI to re-render twice per transaction.

**Prevention**: If the state setter already emits the event, don't emit it again in the caller.

---

**Document Version**: 1.8
**Last Updated**: 2026-02-22
**Games Covered**: 001-008
**Total Lines Analyzed**: ~23,000+
**Latest Enhancement**: Game 008 polish cycle — barrel rotation, particles, debounce, chain mechanics, smart bomb snapshot pattern




