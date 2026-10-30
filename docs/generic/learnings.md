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
- [Games 057–076: the shared template, and what broke after release](#games-057076-the-shared-template-and-what-broke-after-release)

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

### 4. Programmatic `.focus()` Loses to Native Click-Focus (Game 033, any DOM UI)

**Bug**: Calling `someOtherElement.focus()` synchronously inside a `click` handler on a focusable element (e.g. a `div` with `tabindex="0"`) has no visible effect — focus silently stays on (or returns to) the clicked element.

**Cause**: The browser's native "focus the element that was clicked" behavior for a focusable target runs **after** your click listener returns, not before. A synchronous `.focus()` call inside the handler gets clobbered by that native behavior a tick later.

**Symptoms:**
- Keyboard-accessibility code (auto-focus the next interactive element after a click-driven UI transition) works when triggered from a plain `<button>` click, but silently fails when triggered from a click on something you made focusable for its own keyboard support (e.g. a "click or press space to advance" text box with `tabindex="0"`).
- Only reproduces in a real browser — headless assertions that just check "did `.focus` get called" pass; the bug is specifically about *which element ends up focused after the click completes*.

**Solution**: Defer the `.focus()` call past the click's own focus handling:
```javascript
// Runs inside a click handler on a focusable element (tabindex="0"):
const nextBtn = renderNextInteractiveElement();
setTimeout(() => nextBtn.focus(), 0); // not nextBtn.focus() directly
```

**Prevention:**
- ✅ If a `click` handler on a focusable element re-focuses a *different* element, wrap that `.focus()` in `setTimeout(fn, 0)` (or `requestAnimationFrame`).
- ✅ Verify focus behavior with a real Playwright browser, not just unit tests — this class of bug is invisible to jsdom/unit-level checks.
- ✅ When restoring focus after closing a modal, don't assume "focus the button that opened it" — prefer focusing whatever the *current* on-screen state calls for (see Hearthbound's `restoreStageFocus()` in `vnRenderer.js`, called by every modal's close handler).

---

### 5. A Drag on a `touch-action: none` Canvas Swallows the Next Tap (Game 086, Chromium touch)

**Bug**: On a touch screen, after a one-finger drag on the painting canvas, the *next* tap anywhere on the page (a colour swatch, a tool button) did nothing. The tap after that worked.

**Cause**: `touch-action: none` stops the browser scrolling, but Chromium's gesture detector still turns the drag into a fling. The next tap is spent "stopping the fling" (tap suppression), so it never becomes a `click`. Pointer events for that tap still fire (`pointerdown`/`pointerup` on the button), which makes it look like the button is being hit but ignoring you.

**Solution**: Cancel the touch events on the canvas as well. Pointer events keep working.
```javascript
for (const t of ['touchstart', 'touchmove']) {
    canvas.addEventListener(t, (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
}
```

**Prevention:**
- ✅ Any canvas that handles its own drags with pointer events: `touch-action: none` **and** cancel `touchstart`/`touchmove`.
- ✅ Test with real touch input: Playwright `hasTouch` plus CDP `Input.dispatchTouchEvent` for drags and pinches, then `page.touchscreen.tap` on a button. `game-086/dev/browsertest.mjs` does this, and it's how the bug was found.

### 6. Pinch vs Paint: Undo the First Finger (Game 086)

A two-finger pinch always starts with one finger, which looks exactly like a tap-to-paint. Waiting before painting makes every tap feel laggy. Instead, paint at once, and if a second finger lands within ~260 ms, undo the stroke the first finger started and switch to pinching. After a pinch, ignore the remaining finger until every finger has lifted, or the hand coming off the glass paints a stray pixel. See `game-086/js/painter.js`.

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

### 5. Back-to-Launcher Link ⚠️ REQUIRED (All Games)

Every game must include a small "← Games" link back to the repo's root launcher (`index.html`), so players aren't stuck once they open a game. This is now baked into `/scaffold-game`'s templates for all three engines (Kaplay, Phaser, Three.js) — no manual step needed for new games. If you're hand-editing a game's `index.html` (not going through the scaffold command), add this as the **first element inside `<body>`**, before any canvas/overlay:

```html
<a href="../index.html" style="position:fixed;top:8px;left:8px;z-index:99999;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#fff;background:rgba(0,0,0,0.55);padding:6px 12px;border-radius:6px;text-decoration:none;pointer-events:auto;border:1px solid rgba(255,255,255,0.25);" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.55)'">← Games</a>
```

**Gotchas:**
- **Path is `../index.html`, NOT `../../index.html`.** Every `game-NNN/` folder sits directly under the repo root, so one `../` reaches it. Getting this wrong (using `../../`) 404s silently — verify with `ls ../index.html` from inside the game folder before trusting it.
- Fixed positioning + high `z-index` (`99999`) means it renders above a full-screen WebGL canvas or a `pointer-events:none` HUD overlay div — insert it as a sibling *before* those elements, not inside a `pointer-events:none` container, or clicks won't register.
- Engine-agnostic: this is plain HTML/CSS in `index.html`, so it works identically for Kaplay, Phaser, and Three.js games without touching engine scene code.
- If a game already has its own styled back link, keep one link, not two, and check it is **on screen**, not just that its path resolves. game-031's link sat under a 900 px cabinet, below the fold on a laptop, so it is now pinned to the corner like everyone else's. `dev/smoketest.mjs` checks every game's link is visible and not covered.

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

---

---

---

## Game 009: Chronicles of the Ember Crown — Turn-Based RPG (2026-02-25)

### Architecture: Turn-Based Combat State Machine

Game 009 is a classic turn-based RPG with a party of four heroes. The battle system is built around an explicit state machine in `battle.js` with phases: `idle → player → enemy → resolving → victory → defeat`.

**Why an explicit state machine:**
- Prevents concurrent turns (e.g., player input while enemy is resolving)
- Clear entry/exit conditions for each phase
- Easy to reason about what should happen at any point

```javascript
// Phase guard at the top of every action handler
function _onActionChosen(actor, action) {
    if (_phase !== 'player') return;  // ← Guard prevents double-fire
    _phase = 'resolving';
    // ... resolve action
}
```

**Key insight:** Always check the current phase before processing input. Without the guard, rapid key presses or event re-entrancy can trigger actions mid-resolution.

---

### Pattern: Key Handler Phase Management (commandMenu.js)

The command menu uses a single `_enterPhase()` function as the sole entry point for all menu transitions. This pattern solved "double-fire" bugs where a Space/Enter keypress that confirmed one menu phase would immediately trigger the next.

```javascript
function _enterPhase(phase, extra) {
    _cancelKeyHandlers();   // Always cancel first
    _phase = phase;

    if (phase === 'ability') {
        _renderAbilityMenu();
        _k.wait(0, _registerAbilityKeys);   // ← One-frame defer
    } else if (phase === 'item') {
        _renderItemMenu();
        _k.wait(0, _registerItemKeys);      // ← One-frame defer
    } else if (phase === 'target') {
        _currentTargets = extra ?? [];
        _renderTargetMenu();
        _k.wait(0, _registerTargetKeys);    // ← One-frame defer
    }
}
```

**Critical detail:** Key registration is deferred by one frame (`_k.wait(0, fn)`) whenever a phase is entered via a keypress. Without the defer, the Space/Enter that confirmed "Magic" would immediately confirm the first ability.

**Pattern rules:**
- Cancel all existing key handlers before entering a new phase
- Defer key registration by one frame for phases reached via keypress
- Never register keys from inside a key handler — always route through `_enterPhase`

---

### Pattern: `_done` Action Type for Inline Enemy Abilities

Some enemy abilities (Dragon fire breath, Lich King Death Curse) resolve all their effects inline in the AI function, then return a sentinel action object instead of a real action. The `_resolveAction` dispatcher handles this cleanly:

```javascript
// Enemy AI performs multi-target effect inline, then signals "done"
if (enemy.name === 'Dragon' && Math.random() < 0.35) {
    aliveParty.forEach(t => {
        const dmg = _magDmg(enemy, t, 1.6, 'fire');
        _applyDamage(t, dmg);
    });
    return { type: '_done' };  // ← No-op sentinel
}

// Dispatcher skips resolution and just waits
} else if (action.type === '_done') {
    _k.wait(0.6, done);
}
```

**Benefit:** Avoids creating special cases in the resolver. Inline complex abilities stay in the AI function where they belong; the resolver only handles the "continue turn" callback timing.

---

### Pattern: Branching Journey Map (Slay-the-Spire style)

Game 009 introduced a procedurally generated branching map (v0.4.0) as an alternative to linear encounter sequencing.

**Module split:** Map generation is separated into two modules:
- `mapGen.js` — pure graph generation, no Kaplay dependency, no circular imports
- `mapPanel.js` — Kaplay rendering and keyboard interaction

Separating generation from rendering means `state.js` can call `generateMapGraph()` on reset without importing Kaplay.

**Graph structure:**
```javascript
// 7 columns: Village → 5 branching cols → Boss
// Node: { id, col, row, type, encounterIdx, label, visited, available }
// Edges: [ [fromId, toId], ... ]
```

**Tiered encounter pools per column:**
```javascript
const colPools = [
    null,               // col 0 — start village
    tierPool(0, 1),     // col 1 — early (easy enemies)
    tierPool(0, 3),     // col 2 — early-mid
    tierPool(2, 5),     // col 3 — mid
    tierPool(4, 7),     // col 4 — mid-hard
    tierPool(6, 9),     // col 5 — hard (pre-boss)
    null,               // col 6 — boss
];
```

This creates natural difficulty progression without hand-crafting every run.

**Guarantee no orphan nodes:** After building edges row-by-row, ensure every destination node has at least one incoming edge:
```javascript
for (const t of toSorted) {
    if (!reached.has(t.id)) {
        // Connect nearest source to guarantee reachability
        edges.push([nearest.id, t.id]);
    }
}
```

---

### Pattern: Map Panel Key Defer (One-Frame Rule)

The map panel defers key registration by one frame after opening:

```javascript
export function showMapPanel(onNodeChosen) {
    _buildUI();
    // Defer so the Space/Enter that closed the victory screen
    // doesn't immediately confirm a map choice.
    _k.wait(0, _attachKeys);
}
```

This is the same pattern as the command menu — any overlay opened by a keypress must defer input registration by at least one frame.

**General rule:**
> Any UI panel opened via keypress must use `_k.wait(0, registerKeys)` to defer input registration. Forgetting this causes the opening keypress to immediately trigger an action in the new panel.

---

### Pattern: Line Rendering via Thin Rotated Rect

Kaplay v4000 has no native `drawLine` for persistent entities. Game 009 draws map edges as thin rotated rectangles:

```javascript
function _drawLine(x1, y1, x2, y2, col, opa) {
    const dx  = x2 - x1;
    const dy  = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    k.add([
        k.pos(cx, cy),
        k.rect(len, 2),       // length × 1px thick
        k.color(...col),
        k.opacity(opa),
        k.anchor('center'),
        k.rotate(angle * (180 / Math.PI)),
        k.z(MAP_Z + 3),
        'mapOverlay',
    ]);
}
```

`Math.atan2(dy, dx)` gives the angle in radians; Kaplay's `k.rotate()` takes degrees, so multiply by `180 / Math.PI`.

---

### Pattern: Animated Overlay via `onUpdate` on a Dummy Entity

For persistent per-frame animation (pulsing glow) tied to an overlay's lifetime, attach `onUpdate` to a dummy invisible entity that is part of the overlay tag group:

```javascript
// Invisible pulse controller entity
const pulseEnt = _add(k.pos(0, 0), k.rect(0, 0), k.color(0,0,0), k.opacity(0), k.z(MAP_Z));
pulseEnt.onUpdate(() => {
    _pulseTimer += _k.dt();
    const alpha = (Math.sin(_pulseTimer * Math.PI * 2) + 1) / 2;
    for (const { ent } of _pulseCursors) {
        ent.opacity = 0.15 + alpha * 0.35;
    }
});
```

When `k.destroyAll('mapOverlay')` is called to close the panel, the pulse controller is destroyed automatically — no manual cleanup needed.

---

### Pattern: Sprite Flip via `k.scale(-1, 1)`

To mirror a sprite horizontally (face right instead of left), use `k.scale(-1, 1)` as a component. This avoids needing separate left/right sprite sheets:

```javascript
const sprite = k.add([
    k.sprite(def.sprite, { width: heroW, height: heroH }),
    k.scale(def.flip ? -1 : 1, 1),  // ← Horizontal mirror
    k.anchor('center'),
    k.blend('add'),
    // ...
]);
```

`k.blend('add')` makes black backgrounds on JPEG sprites invisible — the sprite blends additively with the background so black pixels disappear.

---

### Pattern: Sprite Animation via `onUpdate` (No `k.tween`)

Game 009 implements three animation helpers in `battleRenderer.js` using `onUpdate` + manual timer, since `k.tween` is unconfirmed in Kaplay v4000:

**Hit flash** (red tint then restore):
```javascript
function _flashSprite(sprite) {
    let timer = 0;
    const orig = [sprite.color.r, sprite.color.g, sprite.color.b];
    const flashColor = isWhiteTint ? [255, 80, 80] : [255, 255, 255];

    const handle = sprite.onUpdate(() => {
        timer += _k.dt();
        if (timer < 0.075) sprite.color = _k.rgb(...flashColor);
        else { sprite.color = _k.rgb(...orig); handle.cancel(); }
    });
}
```

**Attack slide** (move forward then return):
```javascript
function _slideSprite(sprite, dx) {
    const origin = { x: sprite.pos.x, y: sprite.pos.y };
    let timer = 0;
    const DUR = 0.18;

    const handle = sprite.onUpdate(() => {
        timer += _k.dt();
        const t = Math.min(timer / DUR, 1);
        const offset = t < 0.5
            ? dx * (t / 0.5)
            : dx * (1 - (t - 0.5) / 0.5);
        sprite.pos = _k.vec2(origin.x + offset, origin.y);
        if (t >= 1) { sprite.pos = _k.vec2(origin.x, origin.y); handle.cancel(); }
    });
}
```

**Shudder/shake** (decaying oscillation):
```javascript
function _shudderSprite(sprite) {
    const origin = { x: sprite.pos.x, y: sprite.pos.y };
    let timer = 0;
    const DUR = 0.25, AMP = 6;

    const handle = sprite.onUpdate(() => {
        timer += _k.dt();
        const t = Math.min(timer / DUR, 1);
        const offset = Math.sin(timer * 80) * AMP * (1 - t);  // decaying sin
        sprite.pos = _k.vec2(origin.x + offset, origin.y);
        if (t >= 1) { sprite.pos = _k.vec2(origin.x, origin.y); handle.cancel(); }
    });
}
```

Always call `handle.cancel()` when done to prevent stale handlers.

---

### Pattern: Per-Entity Cleanup Tag (`enemySlot_${id}`)

When multiple entities belong to a single logical object (sprite + HP bar + label), tag them all with a unique per-instance tag so they can be destroyed together:

```javascript
const etag = `enemySlot_${enemy.id}`;

k.add([k.sprite(enemy.type, ...), 'enemySprite', etag]);
k.add([k.text(enemy.name, ...), 'enemySprite', etag]);
k.add([k.rect(hpBarW, 8), ..., 'enemySprite', etag]);  // HP bar bg
k.add([k.rect(hpBarW, 8), ..., 'enemySprite', etag]);  // HP bar fill

// On death — removes sprite, label, and HP bar in one call
k.destroyAll(`enemySlot_${combatant.id}`);
```

Benefits: No need to track individual entity references; no risk of orphaned visual elements.

---

### Pattern: New Game+ via `state.newGamePlus()`

Game 009 v0.5.0 introduced NG+ — replay with carried-over party levels and escalating enemy difficulty. The implementation pattern:

```javascript
newGamePlus() {
    // 1. Snapshot the party (levels, stats, HP restored)
    const savedParty = this._party.map(m => ({
        ...m,
        statusEffects: [],
        buffs: {},
        isKO: false,
        hp: m.maxHp,   // ← Full heal on carry-over
        mp: m.maxMp,
    }));
    const prevMultiplier = this.ngPlusMultiplier;

    // 2. Full reset (map, inventory, gold, lives all fresh)
    this.reset();

    // 3. Restore carry-over values
    this.ngPlusMultiplier = prevMultiplier * 1.35;
    this._party = savedParty;
}
```

**Enemy scaling applied at encounter start** (not at definition time):
```javascript
function _scaledEnemy(type) {
    const def = ENEMY_DEFS[type];
    const m = state.ngPlusMultiplier;
    if (m === 1.0) return { ...def, type };  // No-op for first run
    return {
        ...def, type,
        hp:  Math.round(def.hp  * m),
        atk: Math.round(def.atk * m),
        def: Math.round(def.def * m),
        mag: Math.round(def.mag * m),
    };
}
```

**Key insight:** Apply NG+ scaling dynamically at encounter start rather than mutating ENEMY_DEFS. This keeps the config data clean and lets scaling compound correctly across multiple NG+ cycles.

**Win screen guard (`_gameWon` flag):**
The scene-level R key (restart) must not fire while the win screen is up. Add a dedicated flag:
```javascript
let _gameWon = false;

k.onKeyPress('r', () => {
    if (_gameWon) return;  // ← Win screen handles its own R/N keys
    // ... normal restart
});
```

---

### Bug: `opacity(0)` on Border Entity Hides Outline

**Bug (Phase 1 fix):** A border entity was created with `k.opacity(0)` to try to make its fill transparent while keeping its `k.outline()` visible. This silently hides the outline too.

**Root cause:** `k.opacity(0)` makes the entire entity invisible, including its outline.

**Fix:** Either:
- Use an opaque fill with matching background color (effectively invisible fill)
- Or separate the fill entity from the outline entity (two entities, one fill-only, one outline-only)

---

### Pattern: Save/Load with `load()` → `reset()` First

The `state.load()` pattern calls `this.reset()` before applying saved data. This ensures all fields have valid defaults before any saved values are applied, preventing partial-load corruptions if the save format evolves:

```javascript
load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
        const data = JSON.parse(raw);
        this.reset();                    // ← Establish all defaults first
        this._score = data.score ?? this._score;  // Then override with saved
        // ...
        return true;
    } catch (e) {
        console.warn('Save load failed:', e);
        return false;  // Graceful failure — game continues with default state
    }
}
```

---

### RPG-Specific Design Patterns

**Status effect as object with `turnsLeft`:**
```javascript
member.statusEffects.push({ type: 'poison', turnsLeft: 4 });
// At end of round:
poison.turnsLeft--;
if (poison.turnsLeft <= 0) remove it;
```

**Buff as object with turn countdown (not a flag):**
```javascript
// Apply: actor.buffs.atkUp = 3 (lasts 3 turns)
// Tick:  for (const [buff, turns] of Object.entries(c.buffs)) { c.buffs[buff] = turns - 1; }
// Check: attacker.atk * (attacker.buffs.atkUp ? 1.5 : 1)
```

**Defending half-damage — clear on turn, not on hit:**
```javascript
function _doDefend(actor, done) {
    actor.buffs.defending = 1;   // Set on defend action
    // ... in _tickStatusEffects:
    if (buff === 'defending') delete c.buffs[buff];  // Clear at end of round
}
```

**Revive rebuilds turn order:**
When a revived party member is added back, the turn order must be rebuilt:
```javascript
} else if (item.effect === 'revive') {
    t.isKO = false;
    t.hp = Math.max(1, Math.floor(t.maxHp * (item.amount / 100)));
    state.turnOrder = _buildTurnOrder();  // ← Include revived member
}
```

**XP split only among survivors:**
```javascript
awardXP(total) {
    const share = Math.floor(total / this.aliveParty.length);
    for (const member of this.aliveParty) { ... }
}
```

---

### Lessons Learned

**Sprite rendering insights:**
- Use `k.blend('add')` for JPEG-background sprites — additive blend makes black invisible without needing transparent PNGs
- Use `k.scale(-1, 1)` to mirror sprites for characters facing the wrong direction
- Per-enemy tags (`enemySlot_${id}`) allow one-call cleanup of all related entities
- 2-column party layout (front/back row at different sizes) conveys depth without 3D

**Procedural map design:**
- Separating map generation (`mapGen.js`) from rendering (`mapPanel.js`) prevents circular imports
- Tiered encounter pools per column create natural difficulty curves automatically
- Always guarantee every destination node has an incoming edge to prevent soft-locks
- Diamond = village, circle = battle, H = rest, $ = shop, * = boss (text glyphs as node icons)

**Key handler management:**
- The one-frame defer rule (`k.wait(0, registerKeys)`) is essential for any overlay opened by a keypress
- A single `_enterPhase()` entry point with `_cancelKeyHandlers()` first prevents handler accumulation
- `_ifActive(fn)` wrapper blocks input while paused: `return (...args) => { if (!state.isPaused) fn(...args); }`

**Turn-based combat architecture:**
- State machine phases prevent concurrent turn processing
- `_done` action type lets inline enemy abilities skip the resolver cleanly
- Back-navigation in sub-menus (`_pendingItemId`/`_pendingAbilityId`) enables full depth-first menu traversal with proper back-steps

---

## Game 010: Tiny Town — City Builder Sandbox (2026-02-25)

### Architecture: Grid-Based Placement with Build Panel

Game 010 is a cozy city builder sandbox. The grid is the primary play surface; the right panel is a persistent build tool selector.

**Module layout:**
| File | Responsibility |
|------|---------------|
| `main.js` | Grid rendering, placement logic, hover highlight, drag-to-paint |
| `config.js` | Grid dims (24×16, TILE_SIZE=40), BUILDINGS defs, PANEL_WIDTH |
| `state.js` | Score, gold, 2D grid array (`state._grid[row][col]`), selectedTool |
| `ui.js` | Top HUD bar, right build panel with clickable tool buttons |
| `sounds.js` | Per-building-type placement sounds + "no gold" buzz |

---

### Pattern: 2D Grid State as Plain Array

The entire town is stored as a 2D array of strings (or null):

```javascript
// state.js
this._grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));

getTile(col, row) { return this._grid[row][col]; }
setTile(col, row, type) { this._grid[row][col] = type; }
```

Keeping the grid state separate from Kaplay entities makes reset trivial and allows future save/load via JSON.stringify.

---

### Pattern: Tile Entity Map for Redraws

Grid tile visuals are tracked by a `tileEntities` map keyed `"col,row"` → array of Kaplay entities. On redraw, old entities are destroyed and new ones created:

```javascript
function drawTile(col, row, type) {
    const key = `${col},${row}`;
    if (tileEntities[key]) {
        tileEntities[key].forEach(e => e.destroy());
    }
    if (!type) { delete tileEntities[key]; return; }
    // ... create new bg + label entities, store in tileEntities[key]
}
```

This avoids tracking individual entity references in state and keeps rendering fully derived from state.

---

### Pattern: Drag-to-Paint with Last-Placed Deduplication

Holding mouse down and dragging paints multiple tiles. A `lastPlacedKey` string prevents re-placing on the same tile during a single drag stroke:

```javascript
let isMouseDown = false;
let lastPlacedKey = null;

k.onMousePress('left', () => { isMouseDown = true; lastPlacedKey = null; /* place */ });
k.onMouseRelease('left', () => { isMouseDown = false; lastPlacedKey = null; });

k.onUpdate(() => {
    if (!isMouseDown) return;
    const key = `${col},${row}`;
    if (key !== lastPlacedKey) { placeTile(col, row); lastPlacedKey = key; }
});
```

Without `lastPlacedKey`, hovering over one tile while holding would repeatedly spend gold each frame.

---

### Pattern: Screen-to-Grid Coordinate Conversion

```javascript
function screenToGrid(wx, wy) {
    const col = Math.floor((wx - GRID_OFFSET_X) / TILE_SIZE);
    const row = Math.floor((wy - GRID_OFFSET_Y) / TILE_SIZE);
    return { col, row };
}

function isValidTile(col, row) {
    return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
}
```

Always validate with `isValidTile` before using col/row — mouse can be over the panel or HUD.

---

### Pattern: Build Panel Tool Buttons with Live Highlight

Panel buttons are Kaplay `k.area()` entities. The `selectedToolChanged` event updates all button backgrounds:

```javascript
events.on('selectedToolChanged', (tool) => {
    for (const [key, bg] of Object.entries(toolButtons)) {
        bg.color = k.Color.fromArray(key === tool ? COLORS.accent : [40, 40, 60]);
    }
});
```

`k.Color.fromArray([r, g, b])` converts a plain array to a Kaplay Color object for direct assignment to `entity.color`.

---

---

---

---

## Game 011: Nonogram Fleet (2026-02-26)

### Bug: `entity.onUpdate()` Returns a `KEventController`, Not a Function ⚠️ CRITICAL

**Symptom:** `off is not a function` error thrown inside a self-cancelling banner animation. The banner displayed correctly but crashed when it tried to stop its own update callback.

**Root Cause:** `entity.onUpdate(fn)` in Kaplay v4000 returns a **`KEventController` object**, not a bare function. The correct way to cancel it is `.cancel()`, not calling the return value directly.

```javascript
// ❌ BROKEN — off is an object, not a function
const off = banner.onUpdate(() => {
    if (t >= duration) { off(); k.destroy(banner); }  // TypeError: off is not a function
});

// ✅ CORRECT — use .cancel() on the returned controller
const ctrl = banner.onUpdate(() => {
    if (t >= duration) { ctrl.cancel(); k.destroy(banner); }
});
```

**Note:** `k.onUpdate(fn)` at the scene level also returns a `KEventController` — the same rule applies. Only `events.on(fn)` (the custom EventBus) returns a plain unsubscribe function.

**Prevention:** Name the return value `ctrl` (not `off` or `unsub`) to signal it's a controller object, and always use `.cancel()` to stop it.

---

---

---

## Game 012: Arcana Pull — Card-Based Auto Battler / Gacha (2026-03-03)

### Overview

Game 012 is a card-based auto battler with a gacha pull system built around the 78-card tarot deck. Five phases were completed: scaffold, gacha system, collection/party builder, auto battler, and "The Reading" (omen system). Key architectural patterns from earlier games were refined here, and several new patterns were introduced.

---

### Gacha / Pity System Implementation

**Pattern: weighted random rarity with pity guarantee**

Pre-index cards by rarity and pre-calculate total weight at module load time — O(1) per pull instead of scanning all 78 cards:

```javascript
// Pre-index at load time
const RARITY_POOL = Object.entries(RARITY).map(([key, def]) => ({
    rarity: key, weight: def.pullWeight,
}));
const TOTAL_WEIGHT = RARITY_POOL.reduce((s, r) => s + r.weight, 0);
const CARDS_BY_RARITY = {};
for (const r of Object.keys(RARITY)) {
    CARDS_BY_RARITY[r] = CARD_DEFS.filter(c => c.rarity === r);
}

function _rollRarity(forceLegendary = false) {
    if (forceLegendary) return 'LEGENDARY';
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const { rarity, weight } of RARITY_POOL) {
        roll -= weight;
        if (roll <= 0) return rarity;
    }
    return 'COMMON'; // fallback
}
```

**10-pull guarantee**: On the last card of a 10-pull, if no Rare+ appeared yet, force minimum Rare:

```javascript
if (i === 9 && !hasRarePlus) {
    if (rarity === 'COMMON' || rarity === 'UNCOMMON') rarity = 'RARE';
}
```

---

### localStorage Persistence Pattern

**Save party by UID, restore by lookup** — store only uid references for party, restore full objects from collection on load:

```javascript
// Save — store uid array, not full card objects
const save = {
    collection: state.collection,
    party: state.party.map(c => c.uid),   // uid references only
    gems: state.gems,
    pullCount: state.pullCount,
};
localStorage.setItem(STORAGE_KEY, JSON.stringify(save));

// Restore — re-link uids to collection objects
const partyCards = save.party
    .map(uid => state.collection.find(c => c.uid === uid))
    .filter(Boolean);  // drops any uid that no longer exists in collection
if (partyCards.length > 0) state.setParty(partyCards);
```

**Guard against load being called twice** with a `_loaded` flag:

```javascript
let _loaded = false;
export function initGacha() {
    if (_loaded) return;
    _loaded = true;
    loadCollection();
}
```

Each scene calls `initGacha()` at its top — the guard makes it safe to call multiple times.

---

### Sprite Asset Loading Pattern

When every entity in a large roster (78 cards) needs a sprite, loop over the definition array at init time:

```javascript
const CARD_IMG_BASE = 'res/tarot/cards/';
for (const card of CARD_DEFS) {
    k.loadSprite(card.img, `${CARD_IMG_BASE}${card.img}.jpg`);
}
```

Card definitions carry an `img` key that matches the filename — no separate asset manifest needed.

---

### Animation State Machine in `onUpdate`

Game-012 uses a multi-stage animation state machine entirely within `k.onUpdate()` — no Kaplay tweens, no external animation library. States advance by timer and set `entity.pos = k.vec2(...)` each frame.

**Gacha summon flow:** `idle → appearing → shaking → reveal`

```javascript
let animState = 'idle';
let animTimer = 0;

k.onUpdate(() => {
    const dt = k.dt();
    animTimer += dt;

    if (animState === 'appearing') {
        const t = Math.min(animTimer / 0.4, 1);
        const eased = 1 - Math.pow(1 - t, 3);  // ease-out cubic
        cardBack.pos = k.vec2(CARD_X, startY + (CARD_Y - startY) * eased);
        cardBack.opacity = eased;
        if (animTimer >= 0.4) { animState = 'shaking'; animTimer = 0; }

    } else if (animState === 'shaking') {
        const intensity = (animTimer / 0.7) * 8;
        cardBack.pos = k.vec2(
            CARD_X + (Math.random() - 0.5) * intensity * 2,
            CARD_Y + (Math.random() - 0.5) * intensity * 2,
        );
        if (animTimer >= 0.7) _showReveal(currentCard);
    }
});
```

**Key lesson**: A plain timer in `onUpdate` with named states is sufficient for multi-stage card reveal animations. Ease-out cubic (`1 - Math.pow(1-t, 3)`) gives a smooth drop-in feel.

---

### Sunburst Effect via Custom `draw()` Component

A rotating sunburst behind a card reveal is cleanly implemented as a custom component with a `draw()` method. This avoids creating and destroying ray entities every frame:

```javascript
k.add([
    k.pos(CARD_X, CARD_Y),
    k.z(3),
    k.opacity(1),
    {
        id: 'sunburst',
        draw() {
            if (burstOpacity <= 0) return;
            k.pushTransform();
            k.pushRotate(burstAngle);
            for (let i = 0; i < BURST_RAYS; i++) {
                const a = (i / BURST_RAYS) * Math.PI * 2;
                const aOff = Math.PI / BURST_RAYS;
                k.drawPolygon({
                    pts: [
                        k.vec2(Math.cos(a - aOff * 0.35) * BURST_INNER, Math.sin(a - aOff * 0.35) * BURST_INNER),
                        k.vec2(Math.cos(a) * BURST_OUTER,               Math.sin(a) * BURST_OUTER),
                        k.vec2(Math.cos(a + aOff * 0.35) * BURST_INNER, Math.sin(a + aOff * 0.35) * BURST_INNER),
                    ],
                    color: k.Color.fromArray([255, 210, 60]),
                    opacity: burstOpacity * 0.35,
                });
            }
            k.popTransform();
        },
    },
]);
```

`burstAngle` increments each frame; `burstOpacity` lerps toward a target. `k.pushTransform()` / `k.popTransform()` scope the rotation to the sunburst only.

**Key lesson**: Use a custom `draw()` component for procedural effects that repeat every frame. No entity creation overhead; `k.pushTransform()` / `k.popTransform()` cleanly isolate transform state.

---

### Particle Pool: Manual Lifetime + Gravity

A simple manual particle pool — no Kaplay particle system — gives full control:

```javascript
const particles = [];

function _spawnParticles(glowColor) {
    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 220;
        const life  = 0.5 + Math.random() * 0.6;
        const e = k.add([
            k.pos(CARD_X, CARD_Y),
            k.rect(3 + Math.random() * 7, ...),
            k.color(...glowColor),
            k.opacity(1),
            k.z(9),
            'particle',
        ]);
        particles.push({ e, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life });
    }
}

// In onUpdate:
for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { p.e.destroy(); particles.splice(i, 1); continue; }
    p.e.pos = k.vec2(p.e.pos.x + p.vx * dt, p.e.pos.y + p.vy * dt);
    p.vy   += 120 * dt;         // gravity
    p.e.opacity = (p.life / p.maxLife) ** 2;  // quadratic fade
}

// Cleanup on scene leave:
k.onSceneLeave(() => { for (const p of particles) p.e.destroy(); particles.length = 0; });
```

**Key lesson**: Iterate backwards when splicing a live array during iteration. Clean up particle entities explicitly in `onSceneLeave`.

---

### Multi-Card Reveal Queue

For a 10-pull that reveals cards one at a time, store pending cards in an array and advance after a short delay:

```javascript
let pendingCards = [];
let currentCard  = null;

function doTenPull() {
    const results = pullTen();
    if (!results) return;
    pendingCards = results.slice(1);   // queue remaining 9
    _startSummon(results[0]);          // start first immediately
}

// In reveal state:
} else if (animState === 'reveal') {
    animTimer += dt;
    if (pendingCards.length > 0 && animTimer >= 0.6) {
        _startSummon(pendingCards.shift());  // auto-advance after 0.6s
    }
    // If no pending cards, stay in reveal until next pull
}
```

---

### "New Run Only" Reset Guard

When a hub scene both loads saved data and handles new runs, guard the reset with a collection-empty check:

```javascript
k.scene('game', () => {
    initGacha();   // loads from localStorage
    if (state.collection.length === 0) state.reset();  // only reset if no save
    // ...
});
```

This prevents wiping a saved run when the player navigates back to the hub from battle.

---

### Tick-Based Auto Battle Architecture

The battle loop is timer-driven, not frame-driven. A single `onUpdate` accumulates `dt` until a tick fires:

```javascript
let tickTimer = 0;

k.onUpdate(() => {
    if (battle.phase !== 'fighting') return;
    tickTimer += k.dt();
    if (tickTimer < BATTLE_TICK_S) return;
    tickTimer -= BATTLE_TICK_S;  // subtract rather than reset, prevents drift
    _runTick();
});
```

**`_makePartyCombatant`** snapshots card stats into a fresh combatant object each battle start, applying omen modifiers at that point:

```javascript
function _makePartyCombatant(card) {
    const omen = state.activeOmen;
    let atk = card.atk;
    let spd = card.spd;
    if (omen?.id === 'blaze')    atk = Math.round(atk * 1.2);
    if (omen?.id === 'weakened') atk = Math.round(atk * 0.8);
    if (omen?.id === 'clarity')  spd += 1;
    if (omen?.id === 'slowed')   spd = Math.max(1, spd - 1);
    return { ...card, maxHp: card.hp, currentHp: card.hp, atk, spd, shielded: false, slowed: 0 };
}
```

Snapshotting on battle start means mid-battle omen changes don't retroactively affect stats — a deliberate design choice.

---

### Omen / Reading System: Instant vs Multi-Wave Effects

Some blessings are one-shot (heal, grant item) while others persist for 5 waves. The reading scene distinguishes them with an `instant: true` flag:

```javascript
function _applyInstantEffect(omen) {
    if (omen.id === 'mending') {
        state.applyOmen({ ...omen, instant: true });
        return;
    }
    if (omen.id === 'fortune') {
        if (state.items.length < MAX_ITEMS) {
            const item = LEGENDARY_ITEMS[Math.floor(Math.random() * LEGENDARY_ITEMS.length)];
            state.addItem(item);
        }
        state.applyOmen({ ...omen, instant: true });
        return;
    }
    state.applyOmen(omen);  // persistent omen
}
```

`state.applyOmen` checks for `instant` and skips setting `omenWavesLeft`, so the HUD never shows a duration for instant effects.

---

### Scene Refresh via `k.go('game')`

Items used from the hub need to refresh the UI without a full game reset. The simplest approach: go to the same scene:

```javascript
ibtn.onClick(() => {
    state.useItem(item.id);
    events.clearAll();
    k.go('game');  // reload hub scene — re-reads state.items
});
```

Since `initGacha()` is guarded by `_loaded`, re-entering the hub scene doesn't re-load from localStorage. The state is current in memory, so the new scene render picks up the updated items array.

---

### Battle → Reading Scene Handoff

When a wave that triggers a reading ends, redirect the result overlay to the reading scene instead of back to the hub:

```javascript
// In battle result overlay setup
const isReadingWave = state.isReadingWave(state.wave);
const continueScene = isReadingWave ? 'reading' : 'game';

contBtn.onClick(() => {
    events.clearAll();
    k.go(continueScene);
});
k.onKeyPress('enter', () => { events.clearAll(); k.go(continueScene); });
```

`state.isReadingWave(n)` checks `READING_WAVES.includes(n)`. The reading scene always returns to `game` when confirmed, completing the loop: battle → reading → hub.

---

### `events.clearAll()` as Scene Boundary Contract

Every scene transition uses `events.clearAll()` immediately before `k.go(...)`. This became the consistent pattern across all scenes in game-012:

```javascript
// Pattern used everywhere:
events.clearAll();
k.go('targetScene');

// Also in onSceneLeave:
k.onSceneLeave(() => events.clearAll());
```

This replaces the earlier per-event unsubscribe callback pattern from game-005. `clearAll()` is simpler when the entire event graph is scene-scoped.

---

### Inline Import for Sounds

In scenes where the sound module is imported conditionally (to avoid circular dep issues), use dynamic `import()`:

```javascript
import('./sounds.js').then(s => s.playCardFlip());
```

This defers the sound call without blocking the animation frame. Used in gacha.js where `sounds.js` couldn't be statically imported at the top.

---

**Document Version**: 2.3
**Last Updated**: 2026-05-21
**Games Covered**: 001-023
**Total Lines Analyzed**: ~60,000+
**Latest Enhancement**: Games 013-023 — three.js as a third engine (r165 via import map), Phaser multi-scene Boot/Preload/Game/UI pattern, DOM-canvas CRT overlay, software raycasting in Phaser

---

## Games 013–023 — New Patterns (2026-05-21)

This batch adds **three.js** as a third engine alongside Kaplay and Phaser, plus several cross-cutting patterns worth pulling out.

### Three.js arrives (games 014, 018, 023)

Three games in this batch use three.js for true 3D. We do **not** vendor three.js under `lib/` — it ships from a CDN by version pin. Three loading patterns appear, in increasing order of cleanliness:

1. **Global script tag (game-014, three r128)** — `<script src="https://cdnjs.cloudflare.com/.../three.min.js">`, then code uses the global `THREE.*`. Works but locks out ES modules and `examples/jsm/` addons. Do not copy for new games.
2. **Inline ES module URL in every file (game-018, three r165)** — every module starts with `import * as THREE from 'https://cdn.jsdelivr.net/.../three.module.js'`. Works, but bumping the version requires a project-wide find/replace.
3. **Import map (game-023, three r165) — the recommended pattern** — `index.html` declares an import map that aliases `"three"` to the CDN URL, and every module writes `import * as THREE from 'three'`. Version is pinned in one place.

```html
<script type="importmap">
{
    "imports": {
        "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
        "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
    }
}
</script>
```

Full reference: [threejs/threejs-api.md](../threejs/threejs-api.md).

### Three.js render loop — same shape in all three games

```js
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);   // cap — critical
    update(dt);
    renderer.render(scene, camera);
}
animate();
```

The `Math.min(clock.getDelta(), 0.05)` cap is non-optional. A backgrounded tab returns one giant `getDelta()` on first frame and physics goes through walls. Both game-018 and game-023 cap at 0.05–0.1s.

### Three.js resize — `updateProjectionMatrix()` is the silent killer

```js
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();        // forgetting this = silent stretching
    renderer.setSize(window.innerWidth, window.innerHeight);
});
```

Forgetting `updateProjectionMatrix()` is the equivalent of Kaplay's `entity.pos.x = value` — the line of code looks correct, nothing logs an error, but the visual result is wrong. Always include it.

### Three.js module organization (game-023)

The pattern that scaled best: `scene.js` exports live `renderer / scene / camera / clock` bindings, and every other module imports them and adds to `scene` directly. No DI, no singleton class, no event bus needed for the rendering layer specifically. Game state still uses the existing EventBus + state singleton pattern from Kaplay/Phaser games.

```js
// scene.js
export let renderer, scene, camera;
export const clock = new THREE.Clock();
export function initScene() { /* assign exports */ }

// player.js — just imports and uses
import { scene } from './scene.js';
scene.add(playerMesh);
```

This works because ES module instances are shared across importers.

### Three.js gotchas worth memorizing

- **`new THREE.Color(255, 0, 255)` is white**, not magenta. `Color` constructor takes floats 0..1, not 0..255. Use `0xff00ff` hex or a small `rgb([r,g,b])` helper that bit-shifts.
- **GPU resources don't auto-free** — `geometry.dispose()` and `material.dispose()` matter for procedural worlds (game-018 dungeon). For a fixed set of meshes you don't have to care.
- **`material.depthTest = false` + `mesh.renderOrder = N`** is how game-023 stacks the synthwave-sun stripe cutouts — useful for flat overlay layering without z-fighting.
- **`renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`** is the safe default. Some devices report `devicePixelRatio = 3`+ and a naive setting tanks frame rate.

---

### Phaser multi-scene architecture (games 021, 022)

By game-022 (Depths Unknown), the Phaser scene chain has grown beyond the simple `Splash → Game → UI` of the scaffold. Real game shape:

```
BootScene → PreloadScene → SplashScene → GameScene (+UIScene overlay) → BaseScene (overlay) → GameOverScene
```

- **BootScene**: minimal — sets up Scale plugin, loads font, transitions immediately.
- **PreloadScene**: where procedural world generation runs (slow, blocking) so SplashScene can show a loader bar. Stores generated data in `this.registry` so later scenes pick it up without circular imports.
- **GameScene + UIScene running in parallel** is the same pattern as the scaffold — UIScene listens to the shared EventBus and never knows about GameScene directly.
- **BaseScene** in game-022 is an overlay scene (player home base) that pauses GameScene rather than replacing it.

`this.registry` (Phaser's built-in shared store) is the right place for cross-scene data like a procgen seed or generated tile map — using a module-level singleton works but couples scene files together.

### Phaser CRT post-processing via DOM canvas overlay (game-019)

Game-019 (Synthwave Breakout) wanted scanlines + chromatic aberration + vignette. Rather than write a Phaser shader, it layers a second `<canvas id="crt-overlay">` on top of the Phaser canvas at `z-index: 9999` with `pointer-events: none`, and runs its own `requestAnimationFrame` loop drawing 2D effects over everything.

Why this is a good trade-off:
- No need to touch Phaser's render pipeline.
- Engine-agnostic: the same overlay would work over Kaplay or three.js.
- Easy to tune in DevTools without rebuilding shaders.
- One extra `requestAnimationFrame` cost; for a 2D canvas at typical resolutions it's negligible.

The effect anatomy (from game-019):
- **Rolling scanline bar**: linear gradient swept down `(frame * 1.8) % H`.
- **Static scanlines**: fill 1px rows every 3px with 18% black.
- **Chromatic aberration**: red gradient on left edge, blue on right, both ~0.6% of width.
- **Vignette**: radial gradient from transparent center to 55% black at edges.
- **Random flicker**: `if (Math.random() < 0.004) ctx.fillRect(0,0,W,H)` for occasional whole-frame brightness blip.

### Phaser software raycasting (game-021)

Dungeon Blobber renders a first-person dungeon view using a **DDA software raycaster drawing into Phaser's 2D context**, not 3D meshes. The Phaser 2D pipeline carries the column draws. Used because:
- The pixelated art style fit 2D column rasterizing better than GPU 3D.
- No three.js / WebGL dependency needed.
- Procedural brick texturing (mortar lines, cracks, moss) is trivially done per-column in 2D.

Pattern to remember: Phaser doesn't have to mean "sprite-based 2D arcade game" — its 2D context is fine for renderer-pretending-to-be-3D effects.

---

### Touch controls + import map (game-023)

Game-023 ships a working touch control layer: DOM buttons (`.touch-btn`) with `pointer-events: all` overlaid on the three.js canvas. The HUD overlay above uses `pointer-events: none` so taps fall through to the canvas; only the explicit touch buttons consume events. Pattern is engine-agnostic and slots in under any of Kaplay / Phaser / three.js.

### High-score persistence (game-023)

Trivial but standardize on it:

```js
let highScore = parseInt(localStorage.getItem('synthwave_hiscore') || '0', 10);
function saveHighScore(s) {
    if (s > highScore) {
        highScore = s;
        localStorage.setItem('synthwave_hiscore', String(highScore));
    }
}
```

Use a **game-prefixed key** (`synthwave_hiscore`, not `hiscore`). All games share `localStorage` for an origin — generic keys collide between game-001 and game-023.

---

## Game 034: Idle Delve — Idle/Incremental Dungeon Crawler (2026-09-03)

Vanilla HTML/CSS/JS, no engine, no image assets — the first purely idle-genre game in the collection. Same module + EventBus + state-singleton architecture as the Kaplay games, but the "engine" is just a raw `<canvas>` 2D context (`render.js`) plus a fixed-rate combat scheduler running independently of the `requestAnimationFrame` draw loop.

### Two independent loops: render (rAF) vs. simulation (setTimeout)

The visual loop (`requestAnimationFrame`) and the game-logic tick (one auto-battle "beat" per `BASE_TICK_MS / speed`) are deliberately **separate schedulers**:
- `loop(now)` — rAF, draws every frame, decays hit-flash/particle animations by real `dt`.
- `gameTick()` — a **self-rescheduling `setTimeout`**, not `setInterval`, so a speed-toggle click takes effect on the very next tick instead of waiting for a stale interval to fire once more at the old rate:
  ```js
  function scheduleNextTick() {
      setTimeout(() => { gameTick(); scheduleNextTick(); }, tickIntervalMs());
  }
  ```
  `setInterval(gameTick, ms)` would keep firing at whatever `ms` was when it was created — changing a variable it closed over doesn't re-arm it.

### Offline catch-up simulation — the classic idle-game feature, and its sharp edge

On boot, `state.load()` returns `Date.now() - lastSeenAt` from the save. If that's large, `simulateOffline()` fast-forwards a **non-visual** copy of the room loop (capped at a max iteration count as a safety net against a corrupted/absurd timestamp) using the exact same `CombatEngine` class as live play, just spun to completion in a tight loop instead of one tick per beat:
```js
function simulateCombatInstant(party, monsters) {
    const engine = new CombatEngine(party, monsters);
    let guard = 0;
    while (!engine.finished && guard < 500) { engine.tick(); guard++; }
    return engine.result;
}
```
Reusing the real combat class (rather than a separate "fast-forward math" approximation) guarantees the offline result matches what live play would have produced.

**Bug this caught**: the simulation loop advances `simRoomIdx` and only rolls over to the next floor at the *top* of the next iteration (`if (simRoomIdx >= rooms.length) { simFloor++; ... }`). If the iteration budget (`roomsToSim`) runs out on the exact tick that completed a floor's last room, the loop exits with `simRoomIdx === rooms.length` — one past the end — and that out-of-bounds index gets handed to the live scheduler, which immediately throws (`Cannot read properties of undefined (reading 'type')`) trying to read `currentFloor.rooms[roomIdx]`. Fix: normalize the floor/room pointer *after* the loop too, not just inside it:
```js
if (simRoomIdx >= simFloorDef.rooms.length) {
    simFloor += 1; floorsCleared += 1;
    simFloorDef = generateFloor(simFloor);
    simRoomIdx = 0;
}
```
Any "simulate N steps then hand off state to a live scheduler" loop needs this same boundary check on exit, not just mid-loop — a fixed iteration budget can always stop exactly on an edge.

### Testing an idle game's offline path with Playwright — `page.reload()` lies to you

To verify "away summary" behavior, the natural test is: load, mutate the saved `lastSeenAt` backward in `localStorage`, then `page.reload()`. **This doesn't work** — `beforeunload`/`visibilitychange` handlers in the page being reloaded fire *before* navigation completes and re-save `lastSeenAt: Date.now()`, silently overwriting the rewind before the new document ever reads it. `page.close()` has the same problem (Chromium still fires `beforeunload` on it).

The fix is to never let a live page with those listeners attached witness the rewritten timestamp: use `context.addInitScript()` to seed `localStorage` on a **fresh page** in the same browser context, before that page's own `main.js` ever runs:
```js
await context.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key, value: rewoundSave });
const page2 = await context.newPage();
await page2.goto(url);
```
This generalizes beyond this game: any test of "simulate the app being reopened after time has passed" that goes through `reload()`/`close()` on the same page that owns the save-on-unload logic will get its rewind clobbered. Use a new page/context instead.

### Local static-file serving gotcha: `serve` 301-redirects `index.html` → extensionless, breaking relative paths

Running `npx serve .` and navigating to `/game-034/index.html` gets a `301 Moved Permanently` to `/game-034/index` (no trailing `.html`), and that redirect resolves relative asset URLs (`css/style.css`, `js/main.js`) against a different base path than expected — silently 404ing them (or worse, loading the **launcher's** same-named `css/style.css`/`js/main.js` from the repo root instead, which fails in confusing, unrelated ways). Navigate to the **directory URL** (`/game-034/`) instead, which `serve` serves as `200` directly with no redirect.





---

## Game 036: Island Walker — Save/Load, Inventory & Quests in a Procedural World (2026-09-11)

### Save a procedural world by storing the seed, not the world

When the world is a pure function of a seed, the save file holds **only what the player did**. Terrain, vegetation, structures, item placement and item names are all re-derived on load by re-running the generator. game-036's save is ~0.8 KB after a short walk and 1.5 KB after charting 12% of the island.

```javascript
// Store the raw seed STRING, not the hashed integer — the hash is one-way, and
// boot has to reproduce the same string to regenerate the same world.
{ version: 1, savedAt: Date.now(), seedString,
  player: { pos, yaw, pitch },
  progress: { collectedIds: [...], booksShelved, artifactsDisplayed },
  inventory: inventory.serialize(),
  quests: { completed: [...] },
  collections: { shelvedBooks: 7, displayedArtifacts: 3 },  // counts only
  map: { size, cells: rle, spotted: [...], regions: [0,1,1,...] } }
```

**Refuse a save whose seed does not match the current world.** Restoring a position and a fog-of-war map onto different terrain puts the player inside a hill with a map of somewhere else:
```javascript
if (data.seedString !== seedString) return false;  // leave everything at fresh-start values
```

**Boot has to read the saved seed *before* it can build anything**, because the world must be generated from the saved seed for the save to be loadable at all — and at that point no SaveManager exists yet (constructing one needs the world). Hence a static read:
```javascript
static storedSeedString() {           // called from resolveSeed(), pre-World
    try { const d = JSON.parse(localStorage.getItem(SAVE_KEY));
          return (d && d.version === SAVE_VERSION) ? d.seedString : null; } catch { return null; }
}
```

### Derived geometry: persist the count, replay a pure slot function

Deposited items became world geometry placed with `this.rng()`, so the arrangement depended on **deposit order** and could not be reproduced from a count. Replacing the RNG with a pure function of the slot index made the save 2 numbers instead of a list of meshes and positions:

```javascript
// Deterministic pseudo-jitter: fractional part of an irrational multiple of the
// index. Still looks hand-placed, but slot N is always identical.
const j1 = ((slot * 0.7548776662) % 1) - 0.5;
const j2 = ((slot * 0.5698402909) % 1) - 0.5;
// A builder needing an rng gets a per-slot seeded one, not a shared stream:
const blobRng = makeRng(4400 + slot);
```
Test it by comparing geometry across a save/load: `JSON.stringify(before.map(b => b.pos)) === JSON.stringify(after.map(b => b.pos))`.

### Run-length encode fog-of-war grids; re-sample their colours

A 94×94 `Uint8Array` of 0/1 is ~18 KB as JSON. RLE takes it to a few hundred bytes, because revealed area is a disc swept along a walk and therefore strongly contiguous.

```javascript
// Flat array of run lengths, starting from UNKNOWN and alternating. A leading
// 0-length run handles a grid whose first cell is already revealed, so the
// decoder never needs to know the starting value.
function encodeCells(cells) { /* push run, flip value */ }
```
Measured: 0 cells → 0.4 KB · 823 cells (12% charted) → 1.5 KB · **all 8836 cells → 0.4 KB** · pathological alternating (unreachable in play) → 17.7 KB.

**Do not store per-cell map colours.** They are a deterministic sample of the heightmap + region map, so re-derive them on load — it quadruples the save otherwise. The bulk re-sample is the expensive operation the incremental reveal exists to avoid, but it costs a fraction of a second, once, on a frame where the title screen is still up. Recompute the seen-count from the grid rather than trusting the save, so a truncated file cannot desync the percentage.

### "Load" and "New Game" mid-session: reload the page, do not rebuild by hand

Restoring a save without a reload means regenerating the world, item placement, chunk cache and map grid — which is exactly what boot already does. A second construction path that only runs from one button **will** quietly diverge from the page-load path. Instead, put the target seed where boot looks for it and reload:

```javascript
reloadIntoSave() {
    sessionStorage.setItem(SEED_STORAGE_KEY, data.seedString);
    const url = new URL(location.href);
    url.searchParams.delete('seed');  // ?seed= outranks sessionStorage in resolveSeed()
    location.replace(url.toString());
}
```
Two gotchas: **strip `?seed=`**, or the reload lands on a different island than the one being loaded; and set `_enabled = false` before a "New Island" reload so no autosave fires in the gap and resurrects the discarded walk.

### Autosave: immediate on milestones, throttled on movement

Split the triggers by whether the player would be annoyed to lose the event:
```javascript
// Milestones — save immediately.
for (const ev of ['itemCollected','progressChanged','questCompleted','gameComplete'])
    events.on(ev, () => this.save());
// Walking — just mark dirty; the frame loop saves at most every 20s.
events.on('mapExplored', () => { this._dirty = true; });
```
Use `visibilitychange` + `pagehide` for the last-chance save, **not** `beforeunload` — it is unreliable on mobile and never fires when a backgrounded tab is discarded.

Handle a failed write: a blocked/full `localStorage` is not fatal (the game still plays) but the player must be told, or they will assume their walk is being kept.
```javascript
catch (err) { this._enabled = false; events.emit('saveFailed', { message: err.message }); }
```

### Event-driven quests: the active step must always be re-tested ⚠️

Quests as `{ id, title, detail, track, on: [events], test: () => bool }` need no polling — subscribe one listener per distinct event name and re-test only the quests that named it.

**The deadlock:** an ordered chain gated on "is this the active step" will hang if a step's condition gets satisfied by an event it does not subscribe to. It is never re-tested, and because *it* is the blocker, no later step can complete to trigger a cascade. In game-036, `find-library` listened for `mapExplored`/`regionEntered`, but shelving a book satisfied it via `progressChanged` — leaving the HUD on "Find the Library" with the books already on the shelf.

```javascript
// Fix: always fold the active step into the pass, whatever event fired.
const active = this.activeMain;
const pass = (active && !defs.includes(active)) ? [active, ...defs] : defs;
```
Also wrap `def.test()` in try/catch (a predicate reading not-yet-built world data must not kill the frame loop), loop `while (changed)` so a step already satisfied when it becomes active completes immediately, and drop unknown ids on load so deleting a quest cannot corrupt a save.

**Curate the chain against generator guarantees, not the seed.** Templated objectives ("bring 3 artifacts from the ruins") occasionally ask for something a given island cannot provide, or something already done by accident — both read as bugs. Hand-written steps keyed to regions the generator *always* seeds work on every seed.

### Inventory: keep the records, derive the counts

A `carriedBooks++` counter answers "how many do I owe the library" — all the HUD needs — but cannot answer "what did I find", "where", or "what does this say", and those are what make a pickup feel like a discovery. Store full records (id, kind, name, region found in, lore, pickup order) and treat the counts as the derived view; on load, rebuild the counters *from* the restored pack so the two can never disagree:

```javascript
state.restore({ ...saved, carriedBooks: inventory.countOf('book'),
                          carriedArtifacts: inventory.countOf('artifact') });
```
Persist only non-derivable fields — look `lore` up from the name on load, so editing the text never invalidates old saves. Give the pack a single owner: entries live there from pickup until `takeAll(kind)` hands them to the deposit site, so nothing is ever in two places.

### Restoring "on entry" triggers: seed the inside/outside flag

Any mechanic that fires on a *transition* (`if (inside && !wasInside)`) re-fires after a load, because the flag starts false. A player who saved standing in the library had their pack emptied by the first frame. Pass the restored position in and seed the flag:
```javascript
rebuildDisplays(bookCount, artifactCount, playerPos) { /* ... */
    if (playerPos) this._insideLibrary = dist(library, playerPos) < DEPOSIT_RADIUS;
}
```

### Load order at boot matters

```javascript
const resumed = save.load();      // 1. overwrites camera.pos
mapState.updateSilent(camera.pos);// 2. chart around where the player ACTUALLY is
quests.start();                   // 3. re-tests every predicate on subscribe, so a
                                  //    save from an older build completes what it earned
```
Also tell the player which they got: walking back onto a half-explored island unannounced is disorienting, since the fog map and shelves will not match a fresh start.

### Multiple full-screen overlays in a pointer-locked game

Each panel (map, journal, pause) hits the same two problems, so they should share one convention:
1. **Pointer lock** — a readable panel must release the cursor, but that fires `pointerlockchange`, which the main loop reads as "player pressed Esc" and answers with a click-to-resume hint *stacked on the panel*. Each panel exposes `suppressLockHint`, which the handler consults: `setLockHintVisible(started && !locked && !mapUI.suppressLockHint && !panels.suppressLockHint)`.
2. **Pausing** — an open panel must freeze the update phase. The cursor is gone so mouse-look is dead anyway, but letting gravity run drops the player off whatever ledge they stopped on.

Keep the flag set across `close()`: `exitLock()` and `requestLock()` both fire `pointerlockchange`, and clearing it first flashes the hint for a frame. Enforce one overlay at a time (opening any panel closes the others) so there is never a stack to dismiss. `preventDefault()` on `Tab` — otherwise it moves focus to on-page links and buttons, which in a pointer-locked game looks like nothing happening.

### Testing game systems headlessly against the real generator

Save/load, quest chains and inventory are pure logic; they do not need a browser. Stub the handful of globals the modules touch and drive the **real** world generator — which catches seed-dependent bugs a mocked world would hide:

```javascript
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null,
                            setItem: (k,v) => store.set(k,String(v)), removeItem: k => store.delete(k) };
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
globalThis.location = { search: '', href: 'http://x/', replace() {} };
globalThis.document = { getElementById: () => null, addEventListener: () => {} };
globalThis.window = { addEventListener: () => {}, confirm: () => true };
const { World } = await import('./js/world/world.js');   // real generator, real seed
```
Then snapshot state → save → reset the singletons → rebuild → load → compare field by field. This is what surfaced the quest deadlock and the shelf-geometry nondeterminism. Reserve Playwright for what genuinely needs a DOM (panel rendering, key handling, the reload-driven Load/New-Island paths) — and note that testing "Load" requires **diverging the live session from the save first**, or a no-op load passes trivially.

---

## Game 038: Emberbrood — Procedural Creatures, Turn-Based Battle & Breeding (2026-09-18)

### The genome is the single source of truth — including for the art

The temptation with a creature-collector is to store a sprite (or a sprite id)
next to the stats. Don't. Make the sprite a **pure function of the same genes
that decide the stats**, and a whole class of bugs disappears: a save can never
hold a dragon that looks like one thing and fights like another, breeding
automatically produces a child that *resembles its parents*, and the save file
stays tiny because there is nothing visual in it.

```javascript
// genes decide stats AND pixels; nothing visual is ever persisted
genes: { body, wings, horns, tail, crest, pattern, hue, hue2, sat, light, eye, size }
export const geneKey = d => [d.lineageId, d.stage, d.ashbound ? 'ash' : 'lit',
  g.body, g.wings, /* … */, d.elements[0], d.elements[1] || '-'].join('|');
```

`geneKey` doubles as the sprite cache key and the "have I seen this variation"
key for the collection log. A save of 20 dragons plus eggs is ~30 KB of JSON.

### Drawing a creature from parts: order matters more than the parts do

An indexed pixel buffer (`Uint8Array` of palette indices, 0 = transparent) beats
drawing straight to canvas, because the later passes need to know what a pixel
*is*, not what colour it is:

- the **pattern pass** (bands, spots, veins) paints only pixels already in the
  body mask, so a stripe can never leak outside the silhouette;
- the **outline pass** wraps any drawn pixel that borders empty space — that one
  pass is most of what makes it read as 8-bit;
- the **shade pass** lifts pixels with open space above them and drops ones with
  open space below, which fakes a light source for free.

Draw order that worked, after two rewrites: **wing → tail → far limbs → body →
near limbs → neck → head → jaw → crest → horns → pattern → shade → outline →
eye**. Two mistakes are worth stating outright because both produced garbage:

1. **Horns drawn from inside the skull** swallow the head. Anchor them at the
   top edge and grow outward only.
2. **A wing drawn on top of the body** reads as a smear. A side-on wing goes on
   *first*, so the torso overlaps it and it reads as being behind the shoulder.

Verify silhouettes headlessly with an ASCII dump (`0→' '`, outline→`#`, main→`o`)
rather than by eye in a browser — it is faster, diffable, and catches "drew 40
pixels" long before a screenshot would.

### Two baked frames and one shared clock beats per-frame redraws

Bake wings-up and wings-down into offscreen canvases once per gene key, then
animate by swapping `drawImage` source. Register every animated sprite in one
`Set` driven by a **single** `setInterval`, and drop entries whose canvas is no
longer `isConnected`:

```javascript
function tick() {
  frame ^= 1;
  for (const e of [...animated]) {
    if (!e.canvas.isConnected) { animated.delete(e); continue; }  // GC for free
    drawDragon(e.canvas, e.d, { scale: e.scale, frame, flip: e.flip });
  }
  if (!animated.size) { clearInterval(timer); timer = null; }
}
```

A roster screen with 20 dragons then costs 20 `drawImage` calls every 620ms, and
every wing on screen beats in time, which looks deliberate rather than noisy.

### Turn-based battle: resolve the whole round, then play it back

The engine resolves a complete round and returns an **event list**; the UI plays
that list back with delays. The payoff is that animation can never change what
happened, a "fast text" setting is a one-line change, and — critically — the
whole battle system is testable in node with no DOM:

```javascript
const events = battle.resolveRound();   // model is already final here
playEvents(events, 0);                  // pure presentation
```

This is what made it possible to simulate 200 random fights, every boss against
a matched and a mismatched party, and an entire playthrough, before the battle
UI existed at all. **Balance numbers should be found by simulation, not by
playing.** Three real problems surfaced this way and none would have been
obvious in a play session: fights averaging 3 rounds (HP pools too shallow), the
final boss healing more per turn than a full party could deal (an unwinnable
stalemate that read as "hard"), and levelling raising max HP without granting
it.

Add a hard round limit anyway. A stalemate is a bug, and a UI that waits forever
for a victor is worse than one that says "neither of you can keep this up".

### Balance by simulation: the numbers that mattered

- **Fight length** is set by the ratio of a pool to a hit. Aim for 4–6 rounds of
  regular combat and 8–12 for a boss; measure it, don't guess it.
- **XP rate** is best expressed as *fights per level*, and should stay roughly
  flat across the curve. `fightsPerLevel = toNext(L) / (foes × killXP(L) / party)`
  — solve for the divisor that keeps it near 4 at level 5 **and** level 50.
- **A boss's difficulty should come from its matchup, not its numbers.** The
  final boss here absorbs one element entirely; a party built on that element
  wins 2/12, a matched party wins 12/12. That is a puzzle. The same boss with a
  bigger health bar would just be tedious.

### Creature-collector economy traps, all found by simulation

- **A capture that sets bond to 5 is a soft lock** if bond is also the gate on
  breeding and only party members gain it. Give the reserve a trickle (resting
  at home), make feeding meaningful, and start a dragon you *rescued* higher
  than one you merely beat.
- **A lineage's own signature trait can undo the thing that removes it.** The
  "ashbound" lineage's signature trait was `hollowed`; the cleanse routine
  stripped `hollowed`, found the trait list empty, and helpfully re-added the
  lineage default — permanently re-cursing the dragon you had just saved.
- **Role names must not collide with your other vocabulary.** Breeding roles
  called `ember`/`ash` rendered next to elemental tags called Ember and Ash, so
  a dragon's card showed "EMBER" twice meaning two different things. Renamed to
  kindler/clutcher.

### Quest predicates as data, re-tested on every relevant event

Goals are `{ kind, count, element?, lineage?, node?, … }` and one evaluator
interprets them, so a quest can never depend on a system that is not watching
it. Two details do the heavy lifting:

**Snapshot a baseline when the quest is accepted.** Otherwise "defeat 3 Tide
dragons" completes instantly for a player who already killed 50.

```javascript
acceptQuest(q) { state.quests.active.push({ id: q.id, baseline: snapshot() }); }
const progress = counterNow(path) - (entry.baseline[path] ?? 0);
```

**Count what the player thinks they did, not what the flag says.** "Bring back
three ashbound dragons" was uncompletable, because the intended method —
cleansing one *before* binding it — cleared the `ashbound` flag before the
capture was counted. Keep a `wasAshbound` history and count either.

### Story beats must not live in the UI

Act advancement was originally applied by the dialogue screen when it finished
drawing a scene. That works until anything else needs the story to move — a
headless test, a save loaded mid-scene, a player who closes the tab. Move the
*effects* into a scene runner that applies them the moment a scene is
**requested**, and leave the UI to draw the lines:

```javascript
export function requestScene(id, meta = {}) {
  const s = scene(id);
  if (state.flags[`scene_${id}`] && !meta.replay) return null;   // each scene once
  setFlag(`scene_${id}`);
  applyEffects(s);        // act, key items, flags, ending — now, not on render
  queue.push({ scene: s, meta });
}
```

### Four UI bugs worth never repeating

1. **`display: flex` beats `[hidden]`.** A full-screen overlay panel styled
   `display: flex` stays laid out when you set `hidden`, so it swallows every
   tap on the page while being invisible. This cost an hour of "the button does
   not work". Put `[hidden] { display: none !important; }` in the reset, once.
2. **`pagehide` autosave fires on the title screen**, writing an empty save, so
   a first-time visitor is offered "continue where you left off" into a game
   that never existed. Gate saving on a "a game has actually begun" flag.
3. **A scene that ends in a choice must render the choice as its navigation.**
   The "next line" button was suppressed on the last line of a choice scene and
   the choice list was only built by the button that no longer existed — the
   final decision of the game was unreachable.
4. **Do not ask for a tap that has one possible answer.** Targeting prompts
   should resolve themselves when only one enemy is alive.

### Testing a game like this without a browser

Keep `js/game/` and `js/gen/` free of DOM references and the whole rules layer
runs in node. The suite that paid for itself, in rough order of value:

- **A full simulated playthrough** driving the real state, quests, encounters
  and battles with a crude "competent player" stand-in. It found the quest
  deadlock, the breeding soft lock and the act-gating dependency on the UI.
- **Cross-reference assertions over the data tables**: every move a lineage can
  learn exists, every status a move inflicts exists, every bad status has a cure
  item, every forge recipe and quest reward names a real item, the element chart
  is its own mirror, the map is connected and each act's boss is reachable under
  that act's gating. These are ten lines each and catch typos permanently.
- **Determinism checks**: same seed → same dragon → same sprite bytes; and a
  save round-trip that compares `statsOf()` and the rendered sprite before and
  after, which catches "a balance change silently invalidated old saves".

Then use Playwright for what genuinely needs a DOM. Two lessons there: clear any
open dialog before the next click (`dismiss()` helper) or a modal from step 3
fails step 7 with a confusing timeout; and prefer `locator(...)` over
`elementHandle` in any screen that re-renders, because a refresh detaches the
handle.

---

## Game 040: Starcadet — separating a game's simulation from its renderer (2026-09-22)

### The split that made everything else testable

`js/sim/` is a **pure simulation**: it imports no three.js, touches no DOM, never calls
`Math.random`, and never imports anything from `js/view/` or `js/ui/`. The world is plain arrays of
plain objects; the view reads them once a frame and syncs meshes. `dev/check.mjs` enforces the rule
by grepping the source, so it cannot rot:

```js
for (const file of listFiles(join(jsDir, 'sim'))) {
    const code = stripComments(readFileSync(file, 'utf8'));
    if (/from\s+['"]three/.test(code)) fail(`${file} imports three`);
    if (/\bdocument\.|\bwindow\.|localStorage/.test(code)) fail(`${file} touches the DOM`);
    if (/Math\.random\(/.test(code)) fail(`${file} is non-deterministic`);
}
```

The payoff is that a Node harness can play the actual game: `dev/playthrough.mjs` runs a full
six-level campaign to an ending in about four seconds of wall clock, and `dev/balance.mjs` plays
every level three times with different bots. Neither needs a browser or a mock of the game itself.

To let entities call back into the world without a circular import, the world hangs its API on the
world object (`w.fire()`, `w.spawnEnemy()`, `w.spawnPod()`, `w.fx()`), so `enemies.js` and
`bosses.js` never import `world.js` at all.

### Count the things you care about, not the containers that hold them

Starcadet's story promises 211 cadets. The level data had a `podBudget` totalling 211 — but each pod
carried 1–4 cadets, so a full campaign could return **357 cadets out of a roll of 211**. Nothing in
the code was wrong; the two numbers were just different nouns.

The fix generalises: when a resource has a headline number in the fiction, make that number the
budget, and let the containers draw down from it.

```js
const podsAfterThis = w.podBudget - w.podsSpawned;
const cadetsLeft = w.cadetBudget - w.cadetsAssigned;
cadets = podsAfterThis <= 0
    ? clamp(cadetsLeft, 1, 8)                       // last pod takes the remainder exactly
    : clamp(Math.round(cadetsLeft / (podsAfterThis + 1) + rng.range(-0.8, 0.8)),
            1, Math.max(1, Math.min(4, cadetsLeft - podsAfterThis)));
```

A full sweep now returns exactly the roll, and a unit test asserts it per level.

### Tune boss HP against *measured* DPS, not nominal DPS

The first pass set boss HP from the weapon table's damage-per-second. Three of six levels then could
not be finished inside seven minutes, because a player who is dodging lands roughly **35–45% of
nominal DPS** — they are out of line, out of range, or the boss is invulnerable between phases.

Measure it with a bot, then set HP for the fight length you want at that efficiency. Same lesson as
game-039's "tune difficulty with bots, not vibes", but the specific number is worth having: *assume
a dodging player does about 40% of paper DPS against a moving boss*.

### Fixed timestep + edge-triggered inputs

A `1/120s` accumulator keeps pattern timing identical at 60Hz and 144Hz. The catch: an input that is
an *event* (bomb, special) must only fire on the first sub-step, or one keypress spends four bombs
on a slow frame.

```js
accumulator += dt;
let steps = 0;
while (accumulator >= TICK && steps < 8) {
    stepWorld(world, snapshot, TICK);
    snapshot.flare = false;      // edge-triggered: first sub-step only
    snapshot.od = false;
    accumulator -= TICK;
    steps++;
}
if (steps >= 8) accumulator = 0;   // give up catching up rather than spiral
```

### A bounded event queue between the sim and everything else

The simulation announces events by pushing onto `world.fxQueue`; the frame loop drains it once and
hands each event to the view, the audio and the UI in turn. Two details matter:

1. **Bound the queue** (`if (q.length > 600) q.splice(0, q.length - 600)`). A headless harness never
   drains it, and without the bound a five-minute bot run allocates hundreds of thousands of events.
2. **Don't let the payload shadow the event name.** `w.fx('enemyDeath', { type: e.type })` produced
   events called `"skimmer"` because the payload spread over the `type` key. Name payload fields for
   what they are (`enemy`, not `type`).

### Symptom: "the keyboard stopped working" after touching the mouse

If the ship follows the pointer whenever `pointer.active` is true, a single stray mouse movement
disables the arrow keys forever. Hand control back the moment a movement key is pressed:

```js
if (input.ax !== 0 || input.ay !== 0) input.pointer.active = false;
```

### A state machine's wiring deserves its own test

`main.js` (modes, menu action names, element ids, the accumulator, the event drain) is the most
wiring-heavy module in a game and usually the least tested. Booting it under a fake DOM and walking
title → briefing → launch → pause → resume → level clear caught a real simulation bug in passing: a
boss whose HP reached zero by any path other than `damageBoss()` sat in its final phase forever.
Guard the state transition on the *state*, not on the code path that caused it.


## Making an action game genuinely playable on a phone (game-040 Starcadet, 2026-09-22)

"Responsive layout" is not the same as "playable on mobile". These are the things that decided it,
in the order they mattered.

### Relative dragging, not absolute

The obvious implementation — the ship goes where the finger is — is the wrong one for any game
where you need to *see* what you are flying into:

- the first touch teleports the ship across the arena (measured: 3.3 world units in Starcadet),
  which in a bullet hell means an instant death you did not cause;
- the hand sits on top of the part of the screen you are reading;
- the reachable area is the screen, so precision is whatever your thumb can do at full stretch.

Relative dragging fixes all three: record the finger *and* the ship position when the touch starts,
then move the ship by the finger's delta. Re-anchor on every new touch (that is what stops the
teleport), and also whenever the game moves the ship itself — respawn, level start, unpause —
or the next drag inherits a stale offset and lurches.

```js
if (input.pointer.rebase || !anchor) {
    input.pointer.rebase = false;
    anchor = { wx: p.x, wy: p.y, sx: player.x, sy: player.y };
}
const rawX = anchor.sx + (p.x - anchor.wx);
const tx = clamp(rawX, minX, maxX);
anchor.sx += tx - rawX;    // absorb overshoot: no dead zone on the way back
```

That last line matters more than it looks. Without it, dragging past the wall accumulates an
offset, and the first part of the drag back does nothing — the "sticky edge" feel.

### Test with real touch input, not synthesised TouchEvents

`new TouchEvent(...)` dispatched from `page.evaluate` does **not** make the browser synthesise a
`click`, so every menu button appears broken and you go looking for a bug that isn't there. Drive
CDP instead, which is real input:

```js
const cdp = await ctx.newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
```

Pair it with a context that actually is a phone: `{ hasTouch: true, isMobile: true,
deviceScaleFactor: 3, viewport: { width: 390, height: 844 } }`, and run the whole thing again at
844×390 for landscape.

### Assert the control layout, don't eyeball it

Two bugs in game-040 survived a screenshot review and were caught by geometry assertions:

- every on-screen control ≥44px (a CSS specificity slip — `#touch button` beating `#touch-pause` —
  had the pause button rendering at 64px and covering the ship readouts);
- no control's rect intersecting any HUD readout's rect.

```js
const overlap = await page.evaluate(() => { /* compare getBoundingClientRect() pairs */ });
```

### An overflowing flex row with `space-between` pushes its last child off-screen

The HUD kept landing under the pause button even after the margins "fixed" it. The cause: at 390px
the top row's content (launcher link + score + headcount + ship state + pause) was wider than the
viewport, and once a flex line overflows, `justify-content: space-between` has no free space to
distribute — the last item simply overhangs. Margins do not save you; the fix is to budget the
widths so the row fits, and to write the budget down in a comment next to the media query.

### Two thumbs, two corners

Action buttons in the bottom-left for the left thumb, drag anywhere with the right, pause in the
*top*-right where a thumb does not rest. And force any "auto" input mode the touch build depends
on: Starcadet has no fire button on purpose, so an autofire option left off would have handed a
phone player a ship that cannot shoot.

### Quality tiers, chosen by pointer type and then by measurement

Phone GPUs vary by an order of magnitude, and the expensive work is per-pixel (full-screen shaders,
bloom). Start a coarse-pointer device one tier down, then drop another only after several
consecutive bad frame-rate samples so one hitch never costs a player their visuals:

```js
if (state.fps > 0 && state.fps < 40) slowFrames++; else slowFrames = 0;
if (slowFrames >= 3 && tier < MAX) setQuality(tier + 1);
```

Tiers should move *pixels*, not features: pixel ratio, bloom strength, and shader loop counts (an
FBM at three octaves instead of five reads almost identically). Also drop full-screen blended
overlays (scanlines, grain) on mobile — they are pure fill rate for a subtle effect.

### Measure the simulation separately from the renderer

A headless sandbox only has software GL, so its frame rate says nothing about a real phone. The
simulation, though, is plain JavaScript and costs a phone the same work at a lower clock — so
measure it on its own (game-040: ~0.1ms p95 per frame at 200 live bullets, against a 16.7ms
budget). That splits "will it run on a phone?" into a CPU question you can answer headlessly and a
GPU question you answer with quality tiers.


## Atari 2600-idiom rendering without assets (game-039 Wakeform)

### The look comes from constraints, not filters
Draw into a **160x192** offscreen canvas (the 2600's real visible resolution)
and blit it up with `imageSmoothingEnabled = false` plus
`image-rendering: pixelated`. Give each buffer pixel a **2:1 aspect** when
blitting, because that is the shape a 2600 pixel actually was. Everything is
then forced to integer positions and chunky shapes for free, which no amount of
post-processing will fake.

### Generate the palette from the real hardware ramp
The TIA had 16 hues x 8 luminances. Store the 16 base RGBs and derive a
luminance step by interpolating toward white. Picking a run palette then means
picking hue *families* from that table, which keeps every seeded variation
inside the hardware gamut instead of drifting into arbitrary web colours.

One rule matters more than aesthetics: if two colours encode opposed game
states, force their hues far apart on the wheel (game-039 requires >= 5 of 16
steps). Reading state at a glance is load-bearing; a pretty analogous palette
makes the game unplayable.

### Symmetric bitmask sprites
Generate a left half at random, mirror it, and force the centre column on.
That is both how the 2600 drew playfields and why hand-drawn 2600 sprites read
as creatures rather than noise. Add a highlight value on any pixel whose
up/left neighbour is empty and you get free shading. Bake each mask into a
small offscreen canvas once at load; never draw per-pixel per-frame.

### A blocky font beats a web font
3x5 bitmaps in a lookup table, drawn as one `fillRect` per lit cell. No font
loading, no layout shift, no FOUT, and it matches the idiom. ~40 lines total.

---

## JavaScript `%` is a remainder, not a modulo

`Math.floor(t * 6) % frames.length` returns **-1** when `t` is a hair below
zero, and `drawImage(undefined, ...)` throws. Accumulated frame deltas *will*
land slightly negative (floating-point drift, or a non-monotonic timestamp).
Two defences, use both:

```js
dt = Math.min(Math.max((ts - last) / 1000, 0), 0.05);   // floor at 0, cap for stalls
const i = ((Math.floor(t) % len) + len) % len;          // true modulo for cyclic indices
```

This is invisible until the one frame it is not, and it presents as a crash in
the renderer far from its cause.

---

## Two keydown listeners will fight over one key

Registering game-input and menu-input as separate `window` `keydown`
listeners creates an ordering bug that is hard to read from the symptom. In
game-039, Escape closed the pause menu in the first listener, and the second
listener then observed the same event with **no menu open**, queued another
pause, and reopened it on the next frame: pause became impossible to exit.

Checking `menuOpen()` cannot fix it, because the state legitimately changed
mid-dispatch. Tag the event instead:

```js
// menu listener (runs first)
if (activeScreen) e.__menuHandled = true;
// input listener (runs second)
if (e.__menuHandled || menuOpen()) return;
```

Better still, have one listener and dispatch from it. If that is not practical,
the tag is the reliable fix: decide ownership from state captured *before* any
handler mutated it.

---

## Let the player win, but never let them stop the clock

A wave that ends only when the board is empty can be held open forever by a
player who is good at not-killing things. game-039's balance probe survived the
full 300s cap **at wave 1**: infinite survival, zero progress, unable to lose.
That is worse than dying.

Any "clear the board to advance" rule needs a grace timer. Give the player a
window to finish, then advance anyway and withhold the completion bonus. The
strategy stays viable and becomes a gamble instead of an exploit.

---

## Tune difficulty with bots, not vibes

Write 3-4 scripted players against the real game loop and print wave reached,
score, and death rate over a handful of fixed seeds. It takes about an hour and
replaces every "feels about right" argument with a table.

What it caught in game-039:
- An **idle** bot lost in 16s, leaving no room for a new player to learn. The
  early curve was softened until that was ~30s.
- The naive **chaser** out-scored the strategy the entire game was designed
  around, which is a design failure rather than a balance nit. It surfaced that
  the intended play (use the trail as an active tool while intercepting) had to
  win on *survival* rather than raw score: 2/5 deaths vs 3/5. That trade is the
  actual design, and the numbers are what found it.

Critically, the bot harness must mirror the real state machine. When the loop in
`main.js` changed, the probe kept measuring the old rules and reported a
stall that had already been fixed. Factor out the shared step, or comment loudly
in both places.

---

## Testing a canvas game in Node with a strict fake context

A `Proxy` standing in for `CanvasRenderingContext2D` that **throws** rather
than silently accepting is worth far more than a recording stub:

- unknown method called -> throw (catches typos and API drift)
- any non-finite coordinate -> throw (catches NaN propagation at its source)
- `fillStyle` set to undefined -> throw (catches missing palette keys)
- `drawImage(undefined)` -> throw (catches unbuilt or mis-keyed sprites)

Capturing the `requestAnimationFrame` callback then lets you pump exact frame
counts deterministically and walk every screen. This found the negative-modulo
crash above on a code path a browser would only have hit intermittently.

Two gotchas when faking the DOM for this:
- A real browser dispatches to **every** registered listener. If your fake
  `addEventListener` stores one function per event name you will silently test
  half the app, and worse, mask exactly the multi-listener bugs described above.
  Store an array and fan out.
- Menus that wrap cannot be "homed" by pressing Up a fixed number of times; you
  land on `(sel - n) mod rows`. Press a common multiple of every menu length,
  or expose the selection index for tests.


## A hand-written WebGL sprite renderer for pixel art (game-041 Burrowguard, 2026-09-23)

Burrowguard draws everything — terrain, sprites, text, touch controls, menus — as quads from one
atlas through ~450 lines of WebGL 1. Things worth reusing:

### Sharp bilinear, not nearest-neighbour

Nearest-neighbour at a non-integer scale (16px art at 3.7x on a phone) gives uneven pixel widths
that shimmer as sprites move. Integer-only scaling wastes a lot of a phone screen. The fix is a
few lines in the fragment shader, with the texture on `LINEAR`:

```glsl
vec2 px = vUV * uTexSize;
vec2 seam = floor(px + 0.5);
px = seam + clamp((px - seam) / max(fwidth(px), vec2(1e-4)), -0.5, 0.5);
gl_FragColor = texture2D(uTex, px / uTexSize);
```

Nearest inside each texel, a one-screen-pixel blend at its edges. Needs
`OES_standard_derivatives` in WebGL 1 (universal in practice); fall back to `NEAREST` without it.

### Extrude atlas sprites

Bilinear sampling at a sprite's edge reads the neighbouring atlas pixel. With transparent padding,
opaque tiles laid edge to edge (dirt) show faint seams. Pad each sprite by 2px copied from its own
edge pixels.

### Don't name a field after a method

`this.sprite = program(...)` in the constructor silently replaced the class's `sprite()` method,
and every draw threw "R.sprite is not a function". Name GL resources `spriteProg`, `vbo`, etc.

### Bloom threshold vs. terrain

The bright pass has to sit above the brightest *terrain* colour, or the whole playfield glows. A
sandy top stratum at 0.72 red bloomed into an orange haze at a 0.58 threshold; 0.7 keeps the glow
on neon edges, sparks and highlights only.

### Tint greyscale art, not coloured art

A sprite tinted by multiplication loses its hue if it isn't neutral: a cyan gem tinted magenta came
out a muddy purple. Author tintable sprites in greys.

### Auto-quality will fight your browser tests

Software GL in a sandbox runs at ~12fps, which trips a "drop to LOW after 3 slow seconds" rule
mid-test — changing the device-pixel ratio, the layout, and every coordinate the test computed
earlier. Pin the quality from the test (`ctx.addInitScript(() => localStorage.setItem(...))`).

### Immediate-mode UI for canvas-drawn controls

When the controls are drawn in WebGL too, let each draw call register its hit rect
(`view.buttons.push({ id, x, y, w, h })`) and hit-test pointer-downs against *last frame's* list.
Clearing the list before drawing a modal (pause, game over) makes the controls underneath inert
without any extra state.


## Procedural platformer levels you can prove are beatable (game-042 Popgun Pip, 2026-09-24)

### Validate with the real physics, not a jump table

A table of "max jump height / max gap" drifts from the game the moment someone tweaks gravity,
and it can't see ceilings, one-way platforms, springs or wall jumps. Popgun Pip's `validate.js`
imports the same `stepPlayer()` the game runs and **plays the level**: from every standable cell it
runs a handful of input programs (walk; run off the edge and jump in coyote time; standing jumps
held 3/8/14/∞ frames, with and without a running start; double jumps at three timings; a reactive
wall-climb; a ground pound), records every cell Pip's body passes through and every landing, and
BFSes over landings. ~115ms per level, cheap enough to run **at runtime** behind the level card and
re-roll a sub-seed on failure.

Three details that mattered:

- **Start programs from where Pip actually landed, not the cell centre.** A snapped start can hang
  over a pit edge and fall. Keep the exact landing x; add a centred start only for the programs that
  are sensitive to it (wall climbs).
- **Reactive programs need a way to stop.** The wall-climb program kicked off every wall it
  touched — including the walls of the room at the top of the shaft — so it never landed and the
  room's contents read as unreachable. Run it with a cap on kicks (2/5/8/12/∞) so one variant
  always runs out and lands.
- **Model breakables as what they become.** A cracked floor is "one-way": solid from above until
  you pound it, and a hole you can jump back up through afterwards. Hidden blocks likewise.

The test harness then asserts the Metroid contract per gate: *unreachable* with every gadget except
the one it needs, *reachable* with all of them. That caught a shaft room whose ceiling loop skipped
the same columns as its floor mouth — a hole in the roof that let Spring Boots in.

### Integer scaling without a blit: size the backing store, not the CSS

Instead of drawing into a fixed 256×240 buffer and scaling it to the screen, pick the scale first:
`s = min(floor(deviceH / 200), floor(deviceW / 300))`, then make the canvas backing store
`floor(deviceW / s) × floor(deviceH / s)` and its CSS size `W*s/dpr × H*s/dpr`, positioned on a
device-pixel boundary. Every game pixel is exactly `s` device pixels — crisp with
`image-rendering: pixelated`, no shimmer, no second canvas — and a wider screen simply sees more of
the level. On a 390×844@3 phone in portrait with a controller deck that is 234×326 at 5×.

### Bottomless pits need to be drawn

Parallax layers extended down to the bottom of the screen made pits look like more green hill.
Draw the pit: from the neighbouring ground height down, two dithered rows into a dark "abyss"
colour. A hazard must never share a colour with a floor.

### Platformer camera: anchor to the ground, chase only outside a band

Following Pip's y directly bobs the screen on every jump. Anchor the camera to the last ground Pip
stood on (feet ~25% up from the bottom edge) and only chase when Pip leaves a band near the top or
bottom of the view.

### Small interaction bugs worth a test each

- A stomped shell must ignore the stomper for a few frames, or the player is still overlapping it
  on the next frame and "kicks" it with the same stomp.
- A goal that triggers on overlap with a thin pole must also trigger on touching the block at its
  base, or a player who walks up to it at ground level just stands there.


## Pinball physics you can trust (game-045 PINBREAK '86, 2026-09-29)

[game-045](../../game-045/) is a pinball × breakout synthesis. Its simulation (`js/sim/world.js`) is
pure JS in the game-040 style, and `dev/simtest.mjs` has a bot play dozens of games, checking every
sub-step for a ball outside the table outline or inside a brick or bumper. Every bug below survived
the "looks fine when I play it" test and was caught by that check within seconds of bot time.

### A fixed 1/480 s sub-step makes capsule collision enough

Walls are capsule segments (closest point on segment, push out along the normal, reflect the normal
velocity). At 480 Hz a 42 u/s ball moves 0.09 units per step, far less than ball radius plus wall
radius, so nothing tunnels and no swept collision is needed. The sim is still ~300× faster than real
time in Node. The cost is one line in the frame loop: cap the sub-steps (`steps < 60`) and drop the
accumulator if you hit the cap.

### Flippers: put the surface velocity into the bounce

A flipper is a tapered capsule rotating about its pivot. The contact point's velocity is `ω × r`, and
the bounce uses the ball's velocity *relative* to that surface:

```js
const qx = cx + nx * r - f.px, qy = cy + ny * r - f.py;   // contact point relative to pivot
const svx = -f.omega * qy, svy = f.omega * qx;             // ω × r (CCW-positive ω)
const vn = (b.vx - svx) * nx + (b.vy - svy) * ny;
if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
```

That single formula gives real pinball aiming for free: a ball near the tip leaves faster and at a
different angle than one near the pivot, and a raised, stationary flipper cradles. Mirror the right
flipper with `dir = (-cos a, sin a)`, and remember its CCW angular velocity is `-da/dt`.

### Symptom: the ball appears *outside* the table, just below a funnel

A rising flipper can shove the ball past the centre line of a thin funnel wall. The two-sided capsule
test then sees the ball on the *far* side and pushes it out through the back. The fix is
**one-sided boundary walls**: give each boundary a normal pointing into the field, and whenever the
ball's centre projects inside the segment and sits within a small depth *behind* it, push it back to
the open side:

```js
if (s.nx !== undefined && t > 0 && t < 1) {
    const sd = dx * s.nx + dy * s.ny;          // signed distance from the wall's centre line
    if (sd >= rr || sd < -0.6) continue;       // clear, or far behind (another region entirely)
    nx = s.nx; ny = s.ny;                       // always push toward the open side
}
```

Keep the depth limit tight. With `-1.2` the right funnel's "behind" zone reached into the plunger
lane and grabbed the launching ball. Resolve walls **last** in the step (after flippers, bumpers
and bricks) so the table boundary always wins a squeeze.

### Every spawn point needs a clearance rule

Two more escapes were things *appearing* inside other things:

- **Multiball** cloned balls at the position of the ball that caught the pickup, often in the middle
  of the brick wall. Their overlap push shoved them into bricks. Spawn them from a place that is
  always clear by construction (here, the channel between the top arc and the bricks).
- **A new wave** materialised bricks around a ball that was already in flight. Those bricks start as
  ghosts (no collision) until no ball overlaps them.

A related one: a power-up bar across the drain wider than the gap between the flipper tips kicked a
drained ball up *under* a flipper and out behind the funnel. Close the space under the flippers with
drain guides, so a ball that has passed between the tips can only fall.

### Bots find the degenerate strategies

The first bot re-flipped on the same frame it released, so the flipper never dropped. Two balls sat
cradled on it for four minutes and the stuck-ball detector correctly ignored them (they were touching
a raised flipper). A 0.14 s release cooldown fixed it. The simtest now asserts a minimum number of
bricks and bumper hits per game, which is what flagged it.

### Juice needs a budget, not just intensity knobs

Every effect looked right on its own, but a fireball ploughing through 30 bricks in three frames
stacked 1,500 additive sparks, 30 flares and 30 surface lights into a white screen. Cap the *count*
per frame, not the brightness per effect: game-045 allows 260 sparks, 3 flares, 4 rings and 4 surface
lights per frame. A big chain still reads as a storm, and nothing else changes.

### One juice director, fed by the sim's event queue

The sim pushes events (`brickBreak`, `blast`, `bumper`, `drain`...) and one module, `juice.js`, maps
each to sound, particles, lights, shake, aberration, FOV punch, banners, hit-stop and slow-motion.
Tuning the game's feel happens in one table. A `quiet` flag reuses the same director for the
attract-mode demo behind the title, so you get the visuals without sounds or banners.


## Game 047: Ashes & Aces — a deck-builder with a 100-level campaign (2026-09-30)

### The simulation is done; the view plays catch-up
Every player action resolves instantly in `js/sim/combat.js` and leaves a list of events
(`place`, `fire`, `hitEnemy`, `death`, `seal`…). `battle.js` is a director: it pops one event at a
time and each handler returns how long to wait before the next. HP bars show values carried *in*
the events (`hitEnemy.hp`), not the final state, so bars move in step with the hits. When the queue
drains, one `sync()` reconciles every card, plate and bar with the true state — a flourish that
goes wrong can never leave a card in the wrong place. Input is accepted only while the queue is empty.

### Conserve the cards, and test the conservation
Cards move between draw, hand, table, discard and exhaust. The headless test checks after every
turn that each uid is in exactly one zone and that every deck card is somewhere. Temporary cards
(conjured Jokers, Ash) get uids from a separate range so they can never collide with the deck.

### Balance a long campaign with a per-world table
One win-rate number hides the shape of a 100-level curve. `BALANCE=1 node game-047/dev/simtest.mjs`
prints loss rate, turns and HP lost for battles, elites and Wardens per world. The first table
showed the curve upside down: world 1 was deadly (enemy damage tuned against a player with no
relics) and worlds 6–10 were trivial, because relics and deck upgrades compound faster than a linear
HP scale. The fix was a quadratic HP scale, a gentler damage scale, and per-Warden tuning until the
last two Wardens were the hardest fights. Targets that felt right: ~10–15% HP lost per normal
battle, ~20% per elite, ~35–45% per Warden.

### Make disruptive boss mechanics predictable
The Abbess first washed away the player's *fullest* row: fights ran 18 turns and felt random.
Making the tide rise from the bottom row, one row per cast, shown in the intent and as a red
overlay on the threatened cells, turned it into a puzzle with counterplay; the bot's average fight fell from 17.8 to
13.4 turns.

### Story beats as a queue on the run
The run carries `story: [{ kind, world }]` and `picks: [{ kind, count }]` queues. `advance()` shows
queued story, then queued card choices, then the node. Because they live in the saved run, a
reload in the middle of an interlude or a card removal resumes exactly there. An interlude records
its outcome on the queue item before saving, so it cannot be chosen twice.

### Test init scripts run on reload too
`context.addInitScript(() => localStorage.clear())` also runs on `page.reload()`, so a
"save survives a reload" test fails for the wrong reason. Guard it with a `sessionStorage` flag.


## Game 048: SPINFRAME — a slot machine as an RPG combat system (2026-10-01)

### Make every symbol fire; let lines be the bonus
A classic payline machine with 3 reels × 3 rows and 3 lines hits a line on well under half of spins, which as a
combat system means most turns do nothing. SPINFRAME's rule is that **every symbol that lands fires at base power**
and symbols on a winning line fire at a multiple instead. A dead spin still chips the enemy, raises a little shield,
banks a little energy — and lines, chains, Overdrive and the Jackpot are the spikes on top. Measured with the bot:
~0.5 lines per spin at 3×3/3 lines (with nudges), ~2.2 at 5×4/17 lines. That gap *is* the progression: the machine
upgrades (reels, rows, paylines) are what turn a trickle into chains, so they are gated by chapter and priced in Cores.

### Scroll the real strip
Each reel is a real strip (an array built from the loadout's symbol weights), and the view animates the strip itself,
so what spins past is what the Probability Engine actually wrote — including the Glitches the enemy inserted. A spin
is a tween of a float position: `D = mod(from − to, len) + len × loops`, `p = from − D × ease(u)`, draw indices with
a true modulo. A nudge is the same tween with `D = ±1`. When the sim's grid differs from the strip window (sticky
wilds, expanded reels, cascades) the reel shows an explicit override column until the next spin.

### The balance table is only as good as the bot's shopping
The first campaign table showed bosses that killed the bot half the time while skirmishes cost 4% hull. The enemy
curve was fine — the bot bought machine upgrades first and never touched hull or weapons (hull 67 at chapter 2).
Splitting the purse (half on the cheapest levelled system first, then machine upgrades, then save for the next
machine upgrade) made the table sane and showed the real outliers (Varga and the Determinant), which is where the
remaining tuning went. Check what the bot *owns* before blaming the curve.

### One exception in the render loop freezes the game
A wasp's wing flap computed `0.06 − sin(t) × 0.08` as an ellipse radius; Canvas throws on a negative radius. The
throw escaped `requestAnimationFrame`, the loop never re-armed, and because the fx clock (which resolves every
animation `wait()` the battle director awaits) only advances in that loop, the battle sat "busy" forever. Two fixes:
`Math.abs(...) + ε` on oscillating radii, and a `try/catch` around each frame so one bad draw costs one frame.

### Entrance animations fight positioning transforms
The tutorial tip was centred with `transform: translate(-50%, -100%)` and faded in with a shared `panelIn` keyframe
that animates `transform`. For the animation's duration the centring vanished and the tip jumped right and down.
Give positioned overlays their own keyframes that include the positioning transform.

### Transient overlays need an owner
Battle banners ("MEGA WIN", "VICTORY") sat at a higher z-index than the modal rewards panel and outlived the fight.
Banners now sit between the battle HUD and the screens layer, and leaving a battle clears banners, the chain counter
and the hover tip in one place (`endBattleUi`).

### ESM ignores NODE_PATH
A globally installed `playwright` is not found by `import` from an `.mjs` script, even with `NODE_PATH` set. Symlink
it into a `node_modules/` next to the script (ignored by git).


## Game 049: Lanterndeep — a 100-floor turn-based roguelike in three.js (2026-10-01)

### Fog of war is a texture, not a per-tile visibility flag
One `DataTexture` (one texel per tile: 0 unseen, 0.35 remembered, 1 visible) eased on the CPU every
frame and sampled with `LinearFilter` by **every** level material through one `onBeforeCompile`
patch. The bilinear filter gives soft edges for free, the easing makes the dark peel back instead
of popping, and remembered tiles fall back to a desaturated memory of their albedo
(`dot(diffuseColor.rgb, lum) * coldTint`) rather than going black. Three things to remember:
- Compute the world position yourself in the vertex patch (after `project_vertex`, applying
  `instanceMatrix` under `USE_INSTANCING`) — `worldpos_vertex` only runs for some defines.
- Lit tiles still need a floor: add `diffuseColor * 0.07` on visible fragments, or the far side of
  the light radius reads as unexplored.
- Set `customProgramCacheKey`, or two patched variants (walls with cutaway, floors without) share a
  compiled program.

### Cut walls away in the vertex shader
A tilted camera hides the hero behind any wall south of them. Instead of fading meshes, the wall
material's patch shrinks an instance's height when its centre (`modelMatrix * instanceMatrix * vec4(0,0,0,1)`)
lies just south of a `uHero` uniform. One uniform write per frame; no per-wall CPU work.

### Make the visual light radius match the gameplay radius
The FOV radius was 8 tiles but a physically-decaying point light (decay 1.4–2) made only ~3 tiles
bright, so the hero could "see" monsters standing in what looked like darkness. With `decay = 1`,
intensity `≈ 2 + radius` and `distance ≈ 1.5 × radius + 3`, the edge of the light lands on the edge
of sight. A pool of eight point lights reassigned (with fade-in) to the nearest *seen* static
sources keeps shader light counts constant.

### Teleports into sealed rooms, and other generator traps a bot finds in minutes
Every one of these survived "looks fine when I play it" and was caught by a bot playing 100 floors:
- **A random-floor-tile teleport landed inside a sealed vault** with no key. Exclude sealed rooms
  from random placement *and* let the door open from the inside.
- **Blocking objects (chests, braziers, NPCs) placed in a 1-wide corridor** cut the floor in two.
  Only place blocking things on tiles with ≥ 7 walkable neighbours.
- **Auto-explore that refuses to step on known traps** declares a floor "done" when the only way on
  is past one. Report that case (`{ stop: 'trap' }`) instead of claiming the floor is explored.
- **A bot that chases what it can see dithers** at the edge of sight (step towards, lose sight, step
  back to explore). Give it a short memory of the last target position.

### A per-world damage table beats a single curve
A linear monster-damage curve made worlds 1–7 trivial and 8–10 a wall, because gear and perks
compound. `dmgScale(L) * WORLD_DMG[world]` with values found by the balance table (deaths, lowest
HP %, potions per floor, HP lost to each Warden) flattened it. Two non-numeric fixes mattered more:
crowd-control immunity after a freeze/stun (chained freezes were the top killer in the ice world) and
weakening a boss's summons (the final boss's minions were full-strength floor-100 monsters).

### Software-GL browser tests: wait for state, and beware timers
- A 60 ms touch under SwiftShader can arrive after a 480 ms long-press timer and become an inspect.
  Dispatch `touchStart`/`touchEnd` back to back in the test.
- Camera smoothing and CSS fade-ins progress per frame; at 3 fps a screenshot lands mid-glide or
  mid-fade. Expose a debug `snap()` and wait for the screen, not the clock.
- "Not black" brightness checks should test for 0 (the NaN-bloom failure), not for "bright enough":
  boss arenas are legitimately dark.


## Game 050: Tomebound — a match-3 RPG with an idle town in three.js (2026-10-01)

### Test the event stream, not just the board
The board resolves a move instantly and emits `swap / clear / make / fall / shuffle / morph`
events that the 3D view replays. A board that ends up correct is not enough: if a `fall` names
a gem that isn't where the view thinks it is, the view desyncs even though the sim is right.
`dev/simtest.mjs` keeps a **mirror** (id → x, y, type, special) and applies every event to it
exactly as the view does, then compares it to the board after every action — over thousands of
random moves, spells and potions. It also asserts the usual invariants (full board, unique ids,
no standing match, a legal move exists). The view still calls `sync(board)` when the queue
drains, but with the mirror test passing that sync never has anything to fix.

### Linear curves, then a per-region trim
A quadratic monster-HP curve outgrew the hero's damage per turn (4 → 19 over 30 levels, while
HP grew 21×) and fights stretched to 40+ turns. Making monster HP and damage near-linear fixed
the baseline (`dev/duel.mjs` probes fixed levels with no books), but in the full campaign books,
spell ranks and forged gear compound and late fights dropped to 3 turns. A per-wing trim on top
(`WING_HP`, `WING_DMG`) restored them — weighted towards **HP rather than damage**: the damage
trim made big skull cascades one-shot the low-HP class (9% of max HP per skull), which reads as
unfair, while more HP just makes a fight longer.

### A class balance table, not a single win rate
The first campaign table looked fine overall and hid that the Warrior never lost while the Mage
lost 70% of boss fights. Per-class tables, plus a `BOSSLOG=1` line per boss attempt (turns, HP
left on both sides), showed the cause in minutes: deaths in 2–3 turns (spikes, not attrition),
and fire-resistant bosses walling a fire-heavy spell list. Fixes were a Mage start-of-fight
shield, stun immunity after a stun, and making the bot weigh resistances.

### An event with two paid choices is a soft-lock
The bot stalled in wing 2 with "nothing to do": the only open node was a merchant event whose
choices both cost gold, and it had none. Every event now has a free choice. Same family as
game-049's sealed-vault teleports — only a bot that plays the whole map finds them.

### Symptom: the grass is purple and has shadows on it
A hand-built polar-grid terrain was wound clockwise seen from above, so the whole top was
back-face culled — and what showed through was the *inside of the rocky cone underneath*,
purple, receiving the buildings' shadows. It looked like a lighting bug. For a y-up surface
built from `(ring r, angle s)`, the triangles are `(a, a+1, b)` and `(b, a+1, b+1)`.

### Bloom per scene
One bloom setting for a pastel daytime island and a gem board doesn't work: at threshold 0.82
the island's sky and white clouds bloomed into fog. `setActive()` now sets bloom threshold and
strength per scene (town 0.95 / 0.22, battle 0.9 / 0.42).

### Small DOM traps
- `Element.append(null)` appends the text **"null"** — filter optional children.
- A "value changed" pop animation that starts from `opacity: 0`, re-triggered every second by
  idle production, keeps the resource bar permanently invisible. Pulse `transform` only.
- SVG `<animate>` on a map node means Playwright never sees it as "stable" and `click()` times
  out; use `locator.dispatchEvent('click')` (real users are unaffected).

### Software-GL tests: the dt cap slows game time
At ~2 fps a 50 ms `dt` cap runs the game at 10% speed, so a cascade of 30 battle events took a
minute to replay and "victory panel within 20 s" failed. In `?debug=1` the cap is 200 ms.
Panels with entrance animations also need a beat before a screenshot or they're captured at
opacity 0.

### Off-centre models should face the camera
The monster stands to the right of the board; facing +Z, the camera saw its side. Rotate it by
`atan2(-x, cameraDistance)` when laying out.

### Invisible pick boxes must not be taller than what they stand for
Plot hit-boxes were 3.3×4×3.3 so a tap on a building's roof would register — but on an empty
plot that 4-unit-tall invisible box sat in front of the plot *behind* it, and on a phone's
steeper view a tap on a rear plot built on the front one. Empty plots now have flat boxes;
built plots get a box sized to the building. The touch test caught it by asserting **which**
plot was built, not just that something was.

### Assert a tap target isn't covered before tapping it
On an 844×390 phone the town's tutorial hint (bottom-centre) sat on top of the plots, and the
taps landed on the hint. The phone test now checks `document.elementFromPoint()` at the tap
point before every tap; that turned a vague "nothing happened" into "covered by #town-hint".


## Game 054: Pale Engine — a DOOM-style FPS with procedural levels in three.js (2026-10-03)

### Per-cell floor and ceiling heights are the whole level format
DOOM's sectors map neatly onto a grid where every open cell has its own floor and ceiling.
Stairs, daises, lava pits, crates you can shoot over, balconies and open-air courtyards all
fall out of it, and so do collision (a DOOM body is an axis-aligned square that can step up at
most `STEP`), ray casts (DDA through the grid, checking the ray's height against each cell's
floor and ceiling) and the mesh build (floors, ceilings, walls where open meets solid, step
faces and lintels where neighbouring heights differ).

### Make the room graph exactly the tree you asked for
Corridors are A*-routed with every room, every room's 8-ring and every earlier corridor's
8-ring marked impassable, and doors only on a room's ring away from its corners. A corridor
then never touches anything but its two rooms, so the generator *knows* the connectivity.
That's what makes keys sound: lock edges on the start→exit path, define zones as components
without the locks, put each key in the zone before its lock, and only add loop corridors
inside a zone so a loop can never bypass a door.

### Let the generator play its level, then let a bot walk it
The generator validates by flood fill (collect keys, open their doors, repeat) and retries
with the next attempt seed on failure. That proves the *graph* is right, not that a body fits
through it. `dev/simtest.mjs` therefore walks a bot along the BFS path with the real
`World.move` and the player's box: a stall of four simulated seconds fails the level. Two
things that check caught or guards against: a terminal whose front cell could be given to
solid decor (the cell wasn't reserved), and step heights after quantising stair interpolation
(keep the ideal step ≤ 0.25 m so rounding to quarter metres can never exceed 0.5).

### Wall winding: right = up × n
`n = (0,0,1)` gives `up × n = (1,0,0)`. Writing the right vector as `(-nz, nx)` instead of
`(nz, -nx)` silently flips every wall's winding — with `FrontSide` you see the sky through
the walls from inside and the backs of walls from outside, which looks like "the level is
open to the void". Floors and ceilings were right, so it only showed in the first screenshot.

### A lightmap over the XZ plane lights walls, floors *and* monsters
Bake light per texel (4 per 2 m cell) with hard line-of-sight against solid cells, blur once,
soft-clip (`x / (1 + 0.22x)`) so stacked lamps saturate rather than blow out, and dilate into
the walls so bilinear sampling beside a wall never pulls in black. The world shader samples it
at `worldPos.xz + normal.xz * 0.35`; the actor shader samples it at the monster's position, so
monsters walking under a lamp brighten without a single three.js light. Flickering lamps and
glowing liquids go into a second map whose alpha is a per-light phase. Dynamic lights
(muzzle flashes, rockets, explosions) are 8 uniform slots filled each frame by priority.

### Bump scale is a length, not a strength
With derivative bump mapping (`dFdx(height)` into `perturbNormalArb`), the gradient term is
`Δheight / pixelWorldSize`, so `uBump` should be the real relief depth in metres (~0.035).
7.0 (a typical "strength") turned every texture into noise.

### Merge rigid parts per bone
A procedural monster has 20–60 primitives (horns, teeth, plates, eyes). Merging every rigid
part of a bone into one geometry with vertex colours and a glow attribute makes a monster 6–14
draw calls; geometry is cached per species and shared by every instance, materials are per
instance (hit flash, dissolve, elite tint).

### First-person guns: keep the back of the gun 0.3 m from the camera
The first viewmodels put stocks and receivers ~0.1 m from the eye: they filled the screen as
dark planks, and the forearm cylinder pointed *at* the camera. Rest positions around
`(0.2, -0.22, -0.55)`, forearms rotated down and back out of the bottom of the frame, a rim
light behind the gun and lights tinted from the lightmap at the player's feet made them read.

### Test waits must not match their own command line
`until ! pgrep -f "dev/browsertest.mjs"; do sleep 5; done` never ends: `pgrep -f` matches the
waiting shell, whose command line contains the same string. Run the test itself in the
background and wait for it to exit instead.

### Pin the seed in debug runs and print it
A browser test that starts a fresh random campaign is a different level every run, so a
failure that depends on the layout (a terminal in an awkward corner) won't reproduce.
`?debug=1&seed=N` fixes the campaign seed, and the test prints the seed it used.

## Game 055: Rotorstorm — a helicopter bullet hell in hand-written WebGL2 (2026-10-03)

### One noise function, two machines
Ground units need to know where the water is, and the shader paints the water. Instead of
baking a heightmap on the CPU and uploading it, the same value noise is written twice: in JS
(`Math.imul`, `>>> 0`) and in GLSL ES 3.00 (`uint` arithmetic, which wraps mod 2³²). The two agree
bit for bit on the hash, and to within float32 rounding on the interpolation. Two details matter:
add 2³⁰ to the lattice coordinates *as integers* before hashing (converting a negative `int` to
`uint` is the one step the languages might disagree on), and reduce `sin()` phases on the CPU
before they become uniforms (mobile GPUs lose precision on large arguments). The browser test
reads random texels back from the baked chunk (`readPixels` on the FBO) and compares their
material with `terrain.kind()`. It has never disagreed.

### Premultiplied alpha makes additive free
With `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` and premultiplied output, a fragment with alpha 0
simply adds its colour. So every sprite (normal, shadow, glow, fire, bullet) shares one shader,
one blend state and one instanced draw per layer, and "additive" is a per-instance flag that zeroes
alpha. Upload atlases with `UNPACK_PREMULTIPLY_ALPHA_WEBGL` so filtering stays correct.

### Channel-coded bullets
Bullet sprites store *core* in R, *body* in G and *rim* in B, computed from an SDF with 3×3
supersampling. The shader builds `core·white + body·tint + rim·tint·0.22`, so one sprite serves
every palette colour and every bullet has a white core that the bloom picks up. Readability on
snow and sand came from the dark rim, not from making the bullets brighter.

### Stamp decals into the terrain, not on top of it
Craters, scorches, wrecks and tank treads are drawn with the sprite batch straight into the baked
chunk's albedo attachment (`drawBuffers([COLOR_ATTACHMENT0, NONE])`, `colorMask(…, false)` so the
material channel in alpha survives). They cost nothing per frame, scroll with the ground, and the
water shader still knows a crater on a beach is land.

### Name the unit in the signature
`smokePuff(x, y, s)` took `s` as a size in world units at every call site, but used it as a sprite
*scale*: every missile trail spawned puffs hundreds of units wide, and the whole screen filled with
grey. Unit tests can't see that; the first close-up combat screenshot did. Write the unit into the
parameter name and the JSDoc (`size` in world units, with the sprite's own size in the comment).

### Gated bosses: let shots pass the core while it's shielded
The dreadnought's missile silo sat directly behind its invulnerable bridge, so every bullet from
below hit the bridge and stopped: the "destroy all turrets" phase could never end without the
safety timeout. The headless god bot caught it at once (phase 1 took exactly 75 s). While a phase is
gated on parts, the core no longer absorbs shots. Shield plates (Bastion) still do, because
blocking is their job.

### Balance from a bot needs a realistic shopping list
The first balance table had ops 1–2 harder than ops 3–5, because the bot's assumed upgrades
(`typicalOwned`) were far stingier than the salvage an operation pays out. With budgets set from
measured income, an intensity ramp per operation (0.52 → 1.15) and boss HP set for 60–100 s fights,
the curve runs the right way. A dodging bot sees every bullet, so its hit count is a floor for a
human, not an average.

### `touch-action: none` on body blocks scrolling overlays too (again)
game-040 found this; it bit again. The canvas needs `touch-action: none`, but menus that overflow
on a landscape phone need `touch-action: pan-x pan-y` on the overlay and panel, or the Launch button
is unreachable. The phone test now scrolls the briefing with a real CDP touch drag rather than
setting `scrollTop`, which is how the earlier version missed it.

### SwiftShader runs the sim at a crawl
At one or two frames a second, a 1/120 s fixed-step loop capped at 0.05 s per frame runs the game
at about 7% speed, and a boss fight takes ten real minutes. A debug-only `fast=N` URL parameter
runs N times more simulation per frame, so the browser tests stay under ten minutes without
touching gameplay code paths.

---

## Early-games refresh: conventions retrofitted to games 001–036 (2026-10-04)

The full audit and backlog are in [docs/refresh-plan.md](../refresh-plan.md). These are the reusable lessons.

### Symptom: a game shows a blank page in some browsers → `localStorage` threw
Reading `window.localStorage` throws a `SecurityError` when the browser blocks site data (some private modes, strict privacy settings, sandboxed iframes). A bare `localStorage.getItem(...)` at module load stops the whole game. Nine early games did this. Guard **every** access, reads included, and fall back to defaults:

```js
let best = 0;
try { best = parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch { /* storage blocked */ }
```

Log a `console.warn`, not `console.error`, when storage is unavailable: it's an expected condition, and browser tests fail on console errors. `NOSTORAGE=1 node dev/smoketest.mjs` makes every access throw, so you can check all games at once.

### Silence a background tab without touching game code
[lib/page-audio.js](../../lib/page-audio.js) replaces `window.AudioContext` with a subclass that records each instance, and wraps `HTMLMediaElement.prototype.play`. On `visibilitychange` it suspends whatever was running and resumes exactly that when the tab returns. It must load before the game's own scripts, so it is a classic `<script>` in `<head>`. It works for Kaplay, Phaser, three.js and hand-written Web Audio because they all construct a standard `AudioContext`. It holds instances through `WeakRef`, so a game that makes a context per sound doesn't leak.

To test it, fake **both** `document.hidden` and `document.visibilityState`. Kaplay reads `visibilityState`, and with only `hidden` faked it resumed its own context the moment it was suspended. Phaser also suspends its context on window `blur`, which a real tab switch fires first. So dispatch `blur` before `visibilitychange`, or Phaser's focus handling will resume it.

### Symptom: the canvas is cut off on a phone, but nothing scrolls sideways
A fixed-width canvas (800 px) centred by a flex container overflows **both** sides. The left half can't be scrolled to, so `document.documentElement.scrollWidth` doesn't grow and an overflow check passes. Check each canvas's `getBoundingClientRect()` against `innerWidth` instead. To fix it, keep the backing size and scale with CSS: `width: min(800px, 100%, (100dvh - 150px) * 4 / 3); aspect-ratio: 4 / 3; height: auto` *(game-001)*.

**Kaplay 3001 exception** *(game-002)*: CSS-scaling a Kaplay canvas breaks input mapping. Kaplay maps `offsetX` through its own viewport, so taps land on the wrong gem. Pass Kaplay's own `scale` option instead, computed once at boot:

```js
const FIT_SCALE = Math.min(1, (innerWidth - 16) / 608, (innerHeight - 16) / 708);
const k = kaplay({ width: 600, height: 700, scale: FIT_SCALE });
```

### Kaplay v4000: three silent no-ops, verified in the browser *(game-032, game-016)*
- **`obj.scale = k.vec2(...)` without a `k.scale()` component** stores the value, but the transform stays at 1. The slime wobble in game-032 never moved for this reason.
- **`obj.color = k.color(255, 255, 255)`** assigns a *component object*, not a colour. Use `k.rgb(...)`. game-032's hit flash never showed for this reason.
- **A child at the same z as its parent is drawn under the parent's fill.** A text label added to a button rect was invisible until it got `k.z(parentZ + 1)`. A child placed *outside* the rect showed fine, which hides the bug.

### Kaplay: switch scene on touch *release*, not press *(game-016)*
In game-016, a global `k.onClick(next)` that called `k.go()` on a touch **press** left the new scene ignoring every later swipe. Kaplay's touch-to-mouse emulation never saw a fresh press. Moving the scene change to the release fixed it. Arm the handler after a short wait, and require a fresh press, so the release of the gesture that got you here doesn't count:

```js
function onNextTap(fn) {
    let pressed = false;
    k.wait(0.15, () => {
        k.onMousePress(() => { pressed = true; });
        k.onMouseRelease(() => { if (pressed) fn(); });
    });
}
```

### Tap targets in a fixed-resolution, letterboxed game
A game drawn at, say, 900×680 and letterboxed onto a 390 px-tall landscape phone is scaled by `min(vw / W, vh / H)` ≈ 0.57. A 44 px finger target therefore needs `44 / scale` ≈ 77 game pixels. Size touch buttons (and taller bars to hold them) from that, only on `(pointer: coarse)`, and have the browser test assert the on-screen size rather than the game-unit size *(game-016, game-017)*. In portrait the scale is smaller still; say so in the test output rather than pretending it's 44 px.

### Prove small puzzle levels solvable with a breadth-first search *(game-016)*
For Sokoban-sized levels, a BFS over `(player, sorted crate positions)` finishes instantly. It proves every level can be solved and gives the shortest solution, which the browser test then plays through the real UI. That's stronger than "verified solvable" in a comment, and it documents the par for each level.

### Floors you can trust: generate, flood-fill, retry *(game-032)*
Scatter pillars, flood-fill from the spawn, and reject the layout unless the fill reaches every floor tile. After 60 failed attempts, fall back to an open room. Put the exit in the farthest fifth of the reachable tiles, so every floor is a crossing. Expose `check()` on a `?debug=1` hook so the browser test can assert reachability, exit placement and the enemy mix over 60 generated floors.

### Software-GL: Phaser's clock runs slower than wall time *(game-022)*
Phaser caps its frame delta, so under SwiftShader a 4.5 s `time.delayedCall` can take longer than 5.5 s of wall clock. Wait for the state you need (`btn.input.enabled`), not a fixed sleep. This is the same lesson as the three.js notes under game-049 and game-050.


---

## Games 057–076: the shared template, and what broke after release (2026-10-14)

Twenty games went in between 2026-10-05 and 2026-10-13. Looking at them together: they
converged on one layout without anyone asking them to, and their patch releases
fixed the same few kinds of bug again and again. Both are now in the scaffold skill
([.claude/commands/scaffold-game.md](../../.claude/commands/scaffold-game.md)): the
layout as Section 2S, the default (its harnesses were run on the untouched
scaffold, with three.js and with Canvas 2D), and the bugs as the Step 5 checklist.
This section is the reasoning behind both.

### The layout they converged on

| | What | Why |
|---|---|---|
| `js/sim/` | Pure rules: no DOM, renderer, `Math.random`, clock or storage. `newGame(seed)`, `step(G, input, dt)`, `serialize`/`deserialize`, `G.events` | A bot plays the whole game in Node in seconds; a seed replays exactly; saves are a JSON round trip. Every `simtest.mjs` starts with a grep that enforces it |
| `js/sim/bot.js` | An auto-player that drives the same input as the player | It balances the game, proves it finishable, plays the attract-mode demo, and finds soft-locks (game-061, 062, 066, 069, 073) |
| `js/view/` | Reads `G`, answers events, never writes `G` | The game runs headless; the view can be rebuilt without touching rules |
| `js/main.js` | Fixed step (1/120 s), a 50 ms frame cap, `?debug=1` hooks on `window.__xx`, `&fast=N` | Tests under SwiftShader (a few fps) finish in minutes and wait on state, not time |
| `js/input.js` | Keyboard, gamepad and touch merged into one state, plus a press queue | See the input bugs below |
| `js/save.js` | Every `localStorage` access guarded; a format version | Blocked storage crashed nine early games at load |
| `dev/simtest.mjs` | purity · rules · generation over many seeds · determinism · save round trip · bot playthrough · balance table | |
| `dev/browsertest.mjs` | Desktop flow by real keys and clicks; touch-only phones at 390×844 and 844×390 with real CDP touches; blocked storage; fails on any console error | |
| `dev/play.mjs`, gallery pages | One screenshot after a snippet; models or sprites on a neutral page | Judging art in the scene hides what the geometry does (game-074) |

Seventeen of the twenty render with three.js r165 from unpkg through an import map;
game-075 and game-076 use Canvas 2D (075 adds a hand-written WebGL CRT); game-072 is
an imported single-file build on three.js r128. None used Kaplay or Phaser.

### What broke after release

The fixes that went out as patch versions, grouped. The ones already written up
elsewhere are linked; the rest are here.

**Input on phones** (the largest group)
- *The 100vh canvas* (game-058, game-067): see [§ The 100vh canvas bug, a second time](#the-100vh-canvas-bug-a-second-time).
- *Symptom: on phones, rapid attack taps are ignored, but not on desktop.* A frame shorter than the fixed step runs no sim step, and the loop cleared the frame's presses anyway. High-refresh phones run many such frames. Keep presses (and releases, and look deltas) set until a step has consumed them (game-059 `main.js` `carry`, game-071 v1.0.1). Queue a tap that arrives mid-swing and start it when the swing ends.
- *Symptom: a menu opens and instantly closes on a phone.* Touch buttons act on finger-down, so the menu opened under a pressed finger; lifting it sent a `click` to the menu's backdrop, which closed it. Ignore pointer clicks (`e.detail > 0`) whose `pointerdown` did not start inside that menu; keyboard clicks (detail 0) still count (game-071 v1.0.3).
- *Symptom: a right-click on the map opens the game's menu and the browser's.* The game opened its menu on `pointerdown`; on Windows `contextmenu` fires on mouse-up, landed on the new popup and was never cancelled. Open context menus from the `contextmenu` event and `preventDefault()` it, on the popup too (game-076).
- Menu presses merged at low frame rates, a key that closes a dialogue also opening a shop, the touch deck missing until the first in-game touch, and a scrolled button sitting under the back link: see game-074 and game-073 below.

**Rendering**
- *NaN pixels through bloom* (game-065, game-074): [§ a box blinks over the scene](#symptom-a-box-blinks-over-the-scene-every-few-seconds-in-a-different-place-each-time--a-nan-pixel-through-bloom), [§ `Color.copy(0xff8800)` is NaN](#symptom-the-frame-goes-black-except-a-strip-of-sky--colorcopy0xff8800-is-nan).
- *Symptom: barrels, pillars and candles look hollow and see-through.* A shared `Builder.cylinder` wound its wall quads clockwise seen from outside, so three.js culled the outer faces and only the inside of the far wall drew. Wind counter-clockwise from outside (game-071 v1.0.6). When a hand-built mesh looks wrong, try `side: DoubleSide` once: if it fixes it, the winding is backwards.
- *Symptom: whole buildings slowly roll.* The overworld registered every object with a moving part in `userData` (gear, needle, prop) as a spinner, so the building holding the gear spun with it. Register moving parts explicitly, by kind (game-066 v1.0.2).
- *Symptom: arriving in a dungeon shows a flat beige screen.* The third-person camera's wall check sampled every 1.6 m and skipped the end point, so a camera just inside a wall was never pulled in. Sample every 0.5 m including the end, and keep the camera 35 cm clear (game-071).
- *Symptom: cars sink into one side of a banked road and float on the other.* The model rolled by the track's banking with the wrong sign. Pose vehicles from the ground itself: sample the road height under the nose, tail and both sides, and derive pitch and roll from those (game-069 v1.0.1).
- The drill spinning about the wrong axis (game-073): [threejs-api § Common gotchas](../threejs/threejs-api.md#common-gotchas).
- Characters and portraits that read wrong (a naked-looking angel, a beard that looked like a huge grin, game-074 and game-073): build a neutral model page and look at every face at the size the player sees it.

**Rules and content**
- *Symptom: "Take all" freezes the game.* Coins rolled as a loot entry never left the container's list, so the loop never ended. Remove the entry when it is taken, and make every "until empty" loop stop when a pass makes no progress (game-071 v1.0.5).
- A quest that points at a locked feature, and an empty event page that silently replaces a chest: see game-076.

**Repo**
- *Five of the twenty were renumbered* after another session's game took their number on main first (062 → 064, 065 → 066, 068 → 069, 069 → 070, 072 → 073). Check `origin/main` and the open branches for the next free number before creating the folder, and when it happens anyway, rename everything in one commit, including the `game-NNN` paths and port numbers inside `dev/`.

### A browser test that checks state passes on a blank screen
While the Section 2S scaffold was being written, its portrait-phone run passed every check (the player moved, the dash fired, the buttons were 44 px) while the screenshot was empty: the camera had backed off to fit the field into a tall screen, and a fixed `Fog(…, 30, 70)` hid everything past 70 units. Set fog and the far plane from the fitted camera distance, and open the screenshots after every run. game-065's NaN box and game-074's angels were also found by looking, not by asserting.

## Game 057: Hivebreaker — a twin-stick shooter whose bot has a skill dial (2026-10-05)

### A fallible bot is a model of a player, not a slower perfect one
[game-057/js/sim/bot.js](../../game-057/js/sim/bot.js) takes a `skill` in [0, 1]. At 1 it sees every bullet and aims true. Below 1 it decides *once per bullet*, with its own seeded random, whether it noticed it (a `WeakMap` from bullet to "seen"), adds aim jitter that changes every 0.3 s and scales with `1 − skill`, and rolls away from danger only some of the time. A perfect bot that never dies tells you a level is possible; a skill-0.4 bot that dies a few times in the right places tells you it is fair. The balance table prints both, per sector and difficulty (`BALANCE=1`).

### Two generation rules that keep a swarm moving
Props keep either no gap or a two-tile gap to walls and to each other: a one-tile or diagonal gap pins the bigger bugs, and a pinned bug is a room that never unseals. And a bug that ends up outside its sealed room crawls back in through a vent, so a room can always be cleared. Both came from the bot getting stuck, not from playtesting.

### Step the sim from the test, and let events flow as usual
`__hb.advance(sec, input?)` steps the simulation synchronously and then drains its events into the view, sound and HUD the normal way, so a test reaches a boss in one call and the boss's arrival still plays its banner, music and camera. A hook that only moves the sim leaves the screen showing a state that never happened.

## Game 059: Sister Circuit — a beat-'em-up with sprites baked from a rig (2026-10-05)

### Bake sprites to a palette-index atlas, and swap palettes on the GPU
[game-059/js/art/bake.js](../../game-059/js/art/bake.js) poses a 2D rig for every frame of every animation, rasterises it into an atlas whose red channel is a *palette index*, and ships a 32-entry palette row per character. The sprite shader looks the index up in a palette texture, so a grunt variant, a boss's rage colours or the hero's Overdrive glow is one uniform instead of another atlas, and a palette entry with alpha 255 is emissive (neon, visors) and ignores the stage's tint. The baker is pure JS, so `dev/spritesheet.mjs`, `strip.mjs` and `portraits.mjs` render the same art to PNG in Node for checking without a browser. Per-frame metadata (where the front hand is, at what angle) lets weapons attach to any pose.

### Carry presses to the next sim step
At 60 Hz steps on a 120 Hz screen every other frame runs no step; a jab pressed in one of those frames was cleared before the sim saw it. `main.js` keeps a `carry` of edges from frames that ran no step and ORs them into the next one. game-071 needed the same fix after release; it is now in the scaffold's input.

## Game 061: STARWRIGHT — a seeded space sim, balanced by a macro bot (2026-10-05)

### A macro bot that plays the economy finds design traps a playtest won't
`dev/macrobot.mjs` plays the whole progression through the real `Game` actions (build, refine, research, upgrade, trade, missions, warp, story) and replaces flight with time costs derived from ship stats. It's a clumsy player, but every early run stalled on a real design problem, each in a few minutes of machine time:
- **The refinery ate the ore that builds needed.** Builds that cost raw ore never became affordable, because unloaded ore was refined within seconds. Fixes: a raw *reserve* the refinery won't touch, and build costs moved onto refined materials after the first two modules.
- **Serial production starved everything.** One recipe per cycle meant steel arrived at a trickle. Every enabled recipe now runs a batch each cycle, with a per-recipe stock cap so coolant can't eat the ice that polymer needs.
- **A story gate needed a tier the player couldn't reach yet.** "Befriend two species" required Warp II, which required the next hull. The chapter now uses the species next door.
- **Generated content outside the progression.** Story sites and the warlord's haven could land beyond the warp range of the chapter that sends you there. The generator now guarantees them by BFS jump count per warp tier, and the galaxy test asserts it on 50 seeds.
- **A cap chain:** Shipyard Lv 5 → module cap 5 → Command Core Lv 8 (70 000 credits) stood between the player and the ending. Check the transitive cost of anything the ending needs.

Log *time spent per activity*. "Waiting on the refinery: 190 minutes" pointed at the real bottleneck faster than any milestone table.

### Log-depth buffer + ShaderMaterial: every chunk on its own line
With `logarithmicDepthBuffer: true`, custom shaders need `#include <logdepthbuf_pars_vertex>` / `_vertex` / `_pars_fragment` / `_fragment`. A preprocessor directive must start a line, so `'#include <x>'` spliced into a one-line `main(){ … }` fails to compile, and so does `#endif varying vec2 vUv;` when the include string doesn't end in a newline. Shaders compile lazily on first draw, so the broken mining-beam shader only failed when the beam first appeared. The browser test caught it because it mines. **Make the browser test trigger every effect at least once.**

### The payload-shadows-event-name bug, again
`emit(type, data)` built `{ type, ...data }`, and a rock-break payload carrying `type: 'stony'` turned the event into `"stony"`. Spread the payload first (`{ ...data, type }`) and name payload fields for what they are (`rockType`). game-040 recorded the same trap.

### Autopilot: avoid bodies, and align before accelerating
The straight line from a belt to home went through the star, and cruise dropped out at the gravity well every time. Two rules fixed it: steer toward a waypoint that skirts the first star or planet blocking the line (closest point on the segment, pushed out to 3.2 radii), and scale cruise speed by alignment (`cos` of the heading error), so the ship turns before it accelerates.

### Async content that changes layout breaks touch tests (and taps)
The New Voyage panel added its species portraits a moment after opening, which pushed LAUNCH down by 60 px. A CDP touch measured before the shift landed on empty panel. Reserve the space (`min-height`), and have tests wait for the content.

### Keep the subject beside the panel
Docked menus fill the right-hand half of the screen, so the docked camera looks at a point *right* of the station (along the camera's right vector). The station then sits in the visible left half. The shipyard tab uses the same trick to frame the player's ship.

---

## Game 062: Rotten to the Core — a fruit Diablo, balanced by a bot that plays the real API (2026-10-06)

### Line of sight must be an exact grid traversal
Line of sight first sampled the segment every 0.3 tiles. Projectiles step every 0.25 tiles. Where a shot grazed a wall corner, one said "clear" and the other hit the wall, so a ranged hero standing in a corridor shot the same corner forever (the bot sat there for 150 simulated minutes). An Amanatides–Woo DDA visits every tile the segment touches, and when the ray passes exactly through a corner it requires both neighbours to be clear. Use one exact traversal for vision, aggro and "can I shoot that", and let projectiles be the generous one.

### Every position write needs the same collision check
Three different bugs put an actor inside a wall, and every one was an unchecked position write: a corner-slide nudge in `moveActor`, the fallback spot for a portal back down (`floor(x) + 0.5` of a spot that was already in a wall), and a knockback. Once embedded, `passable()` fails in every direction and the actor freezes. Two fixes: check every write, and as a safety net, if the hero ever starts a tick in a wall, spiral out to the nearest free spot (`unstick`).

### Don't find "new" events by index in a capped queue
The sim keeps its event queue bounded (game-040's advice). The game layer looked for the stairs event in `events.slice(before)`, where `before` was the length before the tick — but the cap had already trimmed the front, so the stairs event sat at an index below `before` and was never seen. In headless runs nothing drains the queue, so it was always at the cap. Count events with a sequence number and take the last `seq - seqBefore`.

### A bot finds the soft-locks a playtest won't
`js/sim/bot.js` explores every room, fights with a per-class rotation, loots, equips by score, uses Portal Pies, sells in town and takes the stairs. Each of its stalls was a real game bug: the corner shot above, a shrine that never worked (`{ ...defaults, ...mapSpec }` let the map's `kind: 'ripe'` overwrite the object's `kind: 'obj'`), a potion on the floor that could never be picked up with a full belt (and an intent that kept walking to it), and two equippable items that kept swapping (a two-hander pushes the shield out, the shield pushes the two-hander out). Give the bot an attention budget per target (`spent[id]`, then ignore it) so one unreachable chest doesn't stall a 40-minute run — and then go and fix why it was unreachable.

### Balance a loot game with the full loop, not with fights
The balance numbers that mattered came from the whole loop (explore → loot → equip → level → town → descend), not from duels: the first ranger died five times on floor 1 because a pack of six grapes outlasts a single-target seed shot at level 2. Seed Shot now pierces one enemy, and rangers start with a little more Freshness. Durian's summons (two Durian Brutes) were the top killer on floor 12; one brute plus three grapes keeps the fight hard without a wall. Final table: every class beats the game on three seeds in 33–55 simulated minutes, arriving at level 23–28 with 0–5 deaths.

### Re-rendering a panel on click breaks double-click
Selecting an inventory item rebuilt the panel's HTML, so the second click of a double-click landed on a brand-new element and `dblclick` never fired. Update the selection in place (move a `.sel` class, rebuild only the context row). The browser test caught it by double-clicking for real.

### Wait for frames, not milliseconds, before clicking the 3D world
Under SwiftShader the first frame after building a level can take seconds while shaders compile. A test that teleports the hero, waits 400 ms and projects an NPC's position to click it uses the *old* camera and clicks the HUD. Expose a frame counter from the view and wait for two new frames before projecting; also make the debug teleport clear the hero's path, or it keeps walking to the last click.

### Characters for a top-down camera: faces up, hats small
With the camera ~50° above the floor, a face placed at mid-height on a round fruit is foreshortened to nothing and a full-size helmet hides the fruit entirely. Faces sit higher on hero bodies (10% of the height above the profile's face line) and are 20% bigger; helms and caps are scaled to ~80% of the body radius at the top and sit on the crown. Decor attached to south-facing walls looked like it floated mid-room once those walls were cut away in the vertex shader — hang cobwebs and roots on north walls only.

### A more specific selector silently keeps its transform
On phones every panel was meant to stretch edge to edge with `.panel { left: 8px; right: 8px; transform: none }`, but the dialogue box kept `.panel.center { transform: translateX(-50%) }` — two classes beat one — and slid half off the left edge. Nothing in a desktop test notices. Override at the same specificity (`.panel.center { transform: none }`), and have the phone test open every kind of panel and assert its bounding box sits inside the viewport.

### An invisible joystick zone eats every tap under it
The floating stick was a transparent `#stick-zone` (bottom-left 44% × 55%) with `pointer-events: auto`, above the canvas and the loot labels. Tapping an item or its label there did nothing — on a phone that is a third of the screen, and the bug report was "items aren't getting picked up". Desktop tests never touch it. Make the zone `pointer-events: none` and treat it as a region: a canvas `pointerdown` inside it becomes a *pending* stick that only activates after ~14 px of drag; released before that, it's a tap. Test it by putting a label inside the zone and asserting `elementFromPoint` at its centre is the label. Also make pickup forgiving on touch: walk-over pickup (skip items the player dropped, or they bounce straight back) and an attack button that fetches loot when nothing is in range. *(game-062 `js/input.js`)*

## Game 063: Tee & Sorcery — a golf RPG whose courses the physics and the renderer share (2026-10-06)

### Paint a course from ordered layers, and give both sides the same grids
A hole is a list of shapes (ellipse, path, square), each with a surface and optional height operations (raise, plateau, flatten to the lake level, pyramid). Later layers paint over earlier ones, so an island green listed after its lake rises out of the water and an open-water hole listed after an ice sheet breaks through it. `buildCourse()` evaluates the layers once into three 0.5-unit grids — height, surface id and distance to playable ground — and everything reads those: the ball, the bot, the minimap and the terrain shader (which turns the surface grid into blurred per-surface mask textures). What you see is exactly what the ball hits. *(game-063 `js/sim/course.js`)*

### A golf search bot: geodesic distance, risk-aware refinement, scoring progress not HP
`dev/simtest.mjs` proves all twenty holes playable with a bot that clones the world (`structuredClone` of a plain-data state) and plays candidate shots out with the real physics. Four things made it trustworthy:
- **Geodesic, not straight-line, distance to the cup** (Dijkstra over a 2-unit grid, hazards passable at a cost), so doglegs and island greens are understood.
- **Symptom: the Dijkstra reached 3% of the grid.** Distances were stored in a `Float32Array`; the float64 key popped from the heap was then *greater* than the rounded stored value, so `if (d > dist[k]) continue` skipped almost every node. Use `Float64Array` for any priority-queue distance store.
- **Risk-aware refinement.** A bot that plans with perfect strikes but executes with timing errors is risk-blind: it kept hooking a "perfect" corner-cut into the woods. Re-score the best candidates under a hook, a slice, a fat and a thin strike and weight the average.
- **Score boss progress, not HP.** The final boss's HP resets when he transforms, so "HP before − HP after" made the killing blow worth −2 and the bot never took it. Count damage across phases.
Calibrate pars with the *noisy* bot. The perfect-strike search bot chips in from 100 yards and is no guide to a human. *(game-063 `js/sim/bot.js`)*

### Golf feel: backspin on the first landing, and a cup sized to dispersion
Keeping all the tangential speed at landing let a drive roll 85 yards. Each club now keeps only part of its speed on the first bounce (driver 42%, wedge 16%), which also makes wedges check up on greens. A stylised cup must still be small relative to *shot dispersion*: at 0.5 yd, chip-ins from 100 yards were routine; 0.34 yd with a 4.6 u/s capture speed feels right.

### Floating islands: never interpolate heights into the void
Bilinear sampling between a land cell and a void cell (−80) builds a fake cliff, and the contact code then teleports a ball falling past the edge back up onto it. On sky courses, a point over a void cell is void; a point over land replaces any void corners with the land corners' average, so the edge is sharp. *(game-063 `sampleH()`)*

### Fair moving bosses: move on their own turn
A sandworm circling in real time could not be hit from beyond six yards, because the swing meter makes timing a lead impossible. It now holds still while you aim and slithers during its turn. A boss that knocks your ball into a hazard returns it without a penalty stroke.

### Rendered portraits from the 3D characters
A second, tiny `WebGLRenderer` on an offscreen 160 px canvas (`preserveDrawingBuffer: true`) renders each speaker's rig head-and-shoulders and caches `canvas.toDataURL()` per speaker × expression. Dialogue portraits then always match the models, with no art files. *(game-063 `js/view/portrait.js`)*

## Game 064: Kraken's Gambit — chess with sea monsters, kept honest by perft (2026-10-06)

### Test the move generator with perft, then let chaos loose on top
Perft (counting the leaf nodes of the legal-move tree to a fixed depth) on five standard positions proves the move generator exact before anything else is built on it: the start position to depth 4, Kiwipete to depth 3, and three positions full of promotions, en passant and castling traps. Only then do the sea events go in, and the sim test plays 250 random Tempest games (about 35,000 plies) checking after every ply that both kings exist, no pawn sits on rank 1 or 8, the side that just moved is not in check, and each side still has 16 pieces between the board and the Locker.

### One function says how a record moves the pieces, and the view replays it
`Match.play()` returns records `{ move, event }`; `applyRecord(map, rec)` is the *only* description of how a record moves piece ids around, and the 3D view moves its ships with it. The sim test runs `applyRecord` on a mirror of piece ids for every ply of those 250 games and compares it square by square with the real board, so the fleet on screen can't drift from the game. When a view needs to animate what the sim did, give it a replayable description, not a second implementation.

### Random events need fairness rules, applied to a copy
Every candidate outcome of a sea event is applied to a copy of the position and rejected if a king is missing, a pawn is on its last rank, the side that just moved is in check (an illegal position), the side to move has no legal move, or the material is a dead draw. Up to ten candidates per event, then the next event type, then calm water. Castling and en passant rights are dropped when an event moves what they depend on. The test also checks that no event ever ends a game by itself.

### Search in a worker, with the clock injected
The negamax search runs in a module `Worker` (`new Worker(new URL('./aiWorker.js', import.meta.url), { type: 'module' })`) and falls back to the main thread if the worker fails. The search module takes `now` as an option instead of calling `performance.now()`, so it stays pure and the sim test can run it in Node with a fake clock.

## Game 065: Worldroot — an idle clicker whose progress bar is a tree that really grows (2026-10-06)

### An idle economy runs away unless something costs faster than everything else pays
The first draft used Cookie Clicker's spirit ladder plus a tree track (+5% per level, cost ×1.36) and stage upgrades (×1.5 each). The bot finished *the whole game* in 17 minutes: every purchase paid back in seconds, so the economy compounded faster than any cost grew. Two fixes made the first run take ~50 minutes: weaker per-level and per-stage multipliers (1.03, ×1.3), and tree costs that take a ×4 step at every new stage. Measure payback (cost ÷ added income), not prices: `dev/pace.mjs` printing "stage N at time T" for a bot that buys whatever pays back fastest found every problem in minutes.

### Prestige from total currency feeds back on itself; tie it to a bounded measure
Heartwood first came from `cbrt(all-time motes)`, Cookie Clicker style, at +1% production each. Because income compounds inside a run (motes in a fixed time grow like income⁴ or more here), doubling production more than octupled the motes of the next run, and heartwood doubled every minute after the first hour. A fourth root only delayed it. What worked was paying heartwood for **how tall the tree grew** (`40 × 1.12^(level − 50)`) and making the tree cost **super-exponential** past level 50 (`× e^(0.005 (L − 50)²)`): extra production buys fewer and fewer levels, so each rebirth plateaus instead of exploding. Check the loop gain, d(log reward)/d(log income), and keep it below 1.

### Growing a mesh in the vertex shader
The whole tree is one merged mesh built once from a seeded skeleton; every segment carries the levels at which it starts and finishes growing. The shader slides each segment out of its start point, and children are always born after the part of the parent they sit on has finished, so nothing ever detaches. Two details: a ring's radius depends on *how long since the tip passed it* (`uGrow − reached`), which gives the growing end a natural taper instead of a flat cut; and the bark repeat count around a branch is `floor(span × thickness)`, so the pattern doesn't get squeezed into stripes on thin new wood.

### Symptom: everything is pale lavender and the rim light is 1.0 everywhere → the tube is inside out
The bark looked washed out at every stage. Rendering each shader term on its own (`gl_FragColor = vec4(term, 1.0)` patched in through `material.fragmentShader` from the test page) showed the rim term at 1.0 across the whole trunk: the camera was looking at the *inside* faces of the tubes, so every normal pointed away. For a ring built as `n·cos + b·sin` with `b = d × n`, the quad must be `(a, b, c), (b, d, c)`. Bisecting a shader by its terms beats guessing.

### Frame the subject inside what the HUD leaves visible
`camera.setViewOffset` centres the tree in the uncovered part of the screen, but the fit distance must also be divided by the *fraction* of the screen left visible (`visibleHeight / height`, `visibleWidth / width`), or the tree overflows a phone whose bottom sheet covers half the screen. Fog density scaled to camera distance (`0.5 / distance`) keeps the subject clear from seed to World Tree while the forest beyond fades.

### Symptom: the distant trees hover over the hills → `CircleGeometry` has no inner vertices
`CircleGeometry(radius, segments)` is a triangle fan: one centre vertex and one ring at the rim. Displacing its vertices by a height function only moves the centre and the rim, so hills that rise at radius 34–94 simply weren't in the mesh, and props placed with the same height function floated up to 5 units above a straight slope. Use a polar grid with real rings (`polarGrid()` in game-065's `ground.js`, radii growing as `(i/n)^1.7` so the clearing stays fine), check every triangle faces up, and raycast the mesh against the height function at the radii where props stand.

### Symptom: a still cloud of dots builds up where particles faded → `gl_PointSize = 0` is not invisible
A pooled point system "killed" a spark by setting its size to 0 and leaving its position and colour alone. The spec only defines point sizes from 1 up, and many GPUs clamp 0 to one pixel, so every dead spark stayed as a dot at the spot it died, and clicking built a frozen cloud above the tree. SwiftShader drew them too, which made it testable: diff a screenshot after the sparks die against one from before the clicks. Kill a point by moving it outside the clip volume (`gl_Position = vec4(2.0, 2.0, 2.0, 1.0)`) and drive its colour by an alpha that reaches 0. Make sure the fade you compute is actually applied: this one was computed and never used.

### Walking round a circle: the heading is the tangent, −a − π/2
Models built facing +x and moved anticlockwise round the tree at angle `a` (position `(cos a, sin a)` in x/z) need `rotation.y = -a - π/2`. Three creatures used `-a - π`, which points the nose at the tree, so foxes, treants and stags slid sideways round it for a whole release and it read as "the fox looks weird". Check a heading with one case by hand: at `a = 0` the creature moves along +z, and `rotation.y = -π/2` turns +x onto +z.

### A creature that reads at a distance: one material, vertex colours, a faint self-glow
The polished Fox Spirit is smooth tapered tubes along Catmull-Rom curves (body, neck, muzzle, legs, tail) plus a few shaped spheres and cones, all sharing one `MeshPhysicalMaterial` with `vertexColors` (russet top and cream belly decided per vertex from the normal's y, dark socks and a cream tail tip from the position along the tube) and `sheen` for a fur rim. In a dark, foggy night scene it still turned into a silhouette away from the light, so `onBeforeCompile` swaps `totalEmissiveRadiance = emissive` for `emissive * vColor.rgb`: it glows faintly in its own colours. Frenet frames along a curve can flip handedness, so check the tube's normals point outward and flip the winding if not. Eyes are flattened spheres whose thin axis is aligned with the surface normal (`Matrix4.lookAt(dir, origin, up)`); aligned any other way, the dark rim swallows the iris. Build a close-up viewer page (`dev/creature.html`) before judging a model in the game, where it is a few dozen pixels tall.

### Detailed procedural models without a draw-call explosion
Remodelling six creatures from tubes, spheres and lathes took them from ~10 meshes each to 30–60, and a full grove from 548 draw calls to ~1000. Two fixes brought it to 406, below where it started: `bake()` merges, in every group, the child meshes that share a material (applying their local matrices, keeping only position, normal and colour), so animated joints stay separate groups while everything rigid inside them becomes one mesh; and all small features (eye rims, irises, pupils, glints, noses, blossoms) use one unlit `vertexColors` material so they merge too. Per-object animation that isn't needed goes as well: fourteen fluttering petals became one skirt that sways as a whole. Measure with `renderer.info` across the whole frame (`autoReset = false`, reset before `composer.render()`), or it reports only the last post-processing pass.

### A moving target in a slow browser test
Under SwiftShader a frame can take most of a second, so a test that reads a moving target's screen position and then taps can miss it. That isn't a flake to re-run: re-read and tap again, a few times, like a player chasing it.

### Adding side systems to a balanced idle game without moving its pacing
Worldroot v1.2.0 added ten side systems (kinship, expeditions, relics, a garden, quests, a shop, badges, feats) to a game whose pacing
was already tuned. What kept the core pacing in place:
- **Make the bot play the new systems**, the way a player would on each visit. Otherwise the pacing tests only measure players who ignore them.
- **Compare medians over many seeds, not one run.** Every new `rand()` call shifts the seeded stream, so each wisp after the first lands
  differently. One seed looked 30% faster; the same old code ranged 253–439 minutes to the World Tree across seeds. Twelve seeds settled it.
- **Switch off one system at a time** (copy `js/`, `sed` one effect out, rerun) to find what actually moves the pacing.
- **Anything that feeds the big temporary multipliers is worth far more than it reads.** "+10% duration" on a ×10 spell and a ×7 wisp
  gift, or "+40 sap" (half a spell), sped the late game up more than every "+X% production" relic together. Keep those bonuses to the new
  system's own effects.
- **Keep achievements that feed a multiplier apart from the new ones.** Radiance multiplies by the achievement count, so the new
  "feats" pay a side currency and `achCount()` skips their ids.

### Symptom: a box blinks over the scene every few seconds, in a different place each time → a NaN pixel through bloom
`UnrealBloomPass` blurs the frame through a chain of half-size buffers. One pixel whose colour is NaN (or infinite) poisons every
blur tap that touches it, so it comes out as a black or white rectangle (its size depends on the mip level it reaches) for one frame.
In Worldroot the NaN came from `pow(1.0 - abs(dot(n, v)), 3.0)`: when a face squares up to the camera, rounding pushes `|dot|` a hair
past 1, and `pow()` of a negative is undefined in GLSL (most GPUs compute `exp2(y * log2(x))` → NaN). The slowly orbiting camera lined a
forest tree up every few seconds. SwiftShader's `pow()` doesn't produce the NaN, so headless tests and screenshots never showed it.
- Clamp every `pow()` base to [0, 1] (`1 - dot`, `1 - uv`, `0.5 + 0.5 * sin`), and give degenerate triangles a real normal.
- Put a sanitize pass before the bloom that turns non-finite pixels black. Test the exponent bits
  (`(floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u`) rather than `isnan()`, which fast-math drivers may fold away.
- Test it by putting a quad that writes `uZero / uZero` in front of the camera: without the pass the whole test window changes.
- My first guess for this report (the panel's `backdrop-filter`, below) was plausible but wrong: if a blink can't be reproduced, build
  the suspected mechanism on purpose and see whether it produces the same picture.

### No `backdrop-filter` over a WebGL canvas
A frosted-glass panel (`backdrop-filter: blur(...)`) over a canvas that redraws every frame blinks in Chrome: when the panel repaints (hovering its buttons, quickly), the compositor can drop or show a stale backdrop for a frame, and a panel-sized box flashes over the scene. Headless SwiftShader never shows it, so tests can't catch it. Use a plain translucent tint (a little more opaque to make up for the blur). Related: a `transitionend` listener on a container also hears every child's hover transition bubbling up, so check `e.target === e.currentTarget`; and make resize code skip `renderer.setSize`/`composer.setSize` when nothing changed, since they reallocate the canvas and every render target.

### Small traps the browser test caught
- The Nourish button had no listener at all; only a test that clicks the real button finds that.
- `setPointerCapture` throws for synthetic pointers (and already-released ones), aborting the handler before the click counted. Wrap it.
- `navigator.clipboard.writeText()` rejects without permission; an unhandled rejection is a page error. Handle the promise.
- `readPixels` after the frame has been presented reads a cleared buffer (all zero). Render, then read, in the same task.
- Testing offline progress: seed the rewound save with `addInitScript` on a fresh page, never through `reload()` (game-034's lesson, again).

## Game 066: Scrapwright — a creature-collecting RPG whose creatures are built from parts (2026-10-06)

### One part list drives stats, techniques and the 3D model
Each COM-bot is a set of parts in seven slots (chassis, locomotion, head, eyes, arms, back, overlay). Base stats are a weighted sum of the parts and types, each part brings a technique, and `js/view/botgen.js` builds the model from the same list. Evolution is then data, not art: a stage adds or swaps parts, and the evolved screen lists exactly what was installed. 250 species came from 126 short line definitions, and they look and fight like what they are. *(game-066 `js/sim/dex.js`, `js/view/botgen.js`)*

### A banned word needs a test, not good intentions
The brief banned three letters in a row anywhere in the game. The first scan found 35 hits in the word for currency alone, plus more hidden inside ordinary words (a calendar unit, a gemstone, a preposition) and in comments, so the currency became cogs. The simtest now checks every file in the folder and every string the game can show (names, entries, techniques, traits, items, dialogue). Build the regex from pieces (`['m','o','n'].join('')`) so the test file passes its own check.

### Decide whether the player is free before the UI handles the press
The A that closed the last line of dialogue was also passed to the world in the same frame, so the player talked to the same person again, and the scripted flag never seemed to stick. Compute "free" (no dialogue, panel, prompt, pending prompt or transition) at the top of the frame, then let the UI consume input. *(game-066 `js/main.js`)*

### `{ ...null }` is `{}`, and `{}` is truthy
`setGauge(side, null)` stored `{ ...s }`, so clearing a gauge left an empty object that the draw code treated as a bot and crashed on. Spread only when there's something to spread.

### An autoplayer finds stalemates
With every technique out of PP, two bots that resist each other's struggle move fought forever. The struggle move (Sputter) is now typeless with recoil, so every fight ends. The same pilot found a warp into a wall, an Arena door that opened too early, a bot with no habitat, and a trait that let one boss sweep whole teams.

### Battle camera on a portrait phone: look down the line
A side-on view with both bots in frame needs a horizontal field of view a tall phone doesn't have; pulling the camera back just makes both bots tiny. On narrow screens the camera sits behind the player's bot, so the foe lines up above it.

### Point sprites: size them in world units, and remember SwiftShader caps them
`gl_PointSize = aSize * uScale / depth` with `uScale` set to 0.9 × the CSS height made a smoke puff thousands of pixels wide. SwiftShader clamps point sizes, so the headless tests and screenshots only looked a little hazy; a real phone GPU drew the full size, and leaving the first house showed a solid grey screen. Now `uScale` comes from the drawing-buffer height and the camera's field of view (so `aSize` is a world size), points are capped at 30% of the screen and fade out within a few units of the lens. The phone browser test compares the scene with particles on and off and fails if they wash it out. *(game-066 `js/view/fx.js`)*

### Tests that teleport must wait for the transition
`__rt.tp` swaps the world at once but the gear-iris transition runs for a few frames, and input is ignored meanwhile. The browser test's teleport waits until the view has caught up with the world and the iris is open before it presses anything.

## Game 067: Tootle Isles — a toy-train sandbox where the track is drawn, not placed (2026-10-06)

### A tile's track is six bits, and a switch is one counter
Two straights and four quarter curves of radius ½ cover every piece a toy railway needs: two straights make a crossing, a straight and a curve sharing an edge make a switch. A train entering through edge `e` takes `exits(e)[switch % exits(e).length]` with "straight ahead" listed first, so one byte per tile is the whole switch state and a tap just increments it. The same exits list drives routing, look-ahead, placement and the arrow drawn on the points. *(game-067 `js/sim/world.js`, `js/sim/grid.js`)*

### Draw track as a stroke that rewinds on every move
Laying track incrementally as the pointer moves goes wrong as soon as an end tile becomes a middle tile: it already got an end piece. Instead, snapshot the track at pointer-down and, on every move, rewind to the snapshot and lay the whole path again (including putting back any trees the stroke cleared). Three rules make drawing feel right: an end that reaches a single piece with a loose end *turns* that piece to meet it; a path that returns to its first tile closes a loop, so its first and last tiles are middles (otherwise the corner keeps a stray straight and becomes a fake switch); and an end beside a straight running across *branches* toward whichever end of the straight the finger is nearer, while dragging right across makes a crossing.

### Trains updated one after another can step into the same free tile
A ten-minute soak with several trains per island found overlaps the scripted tests never did: two trains approaching a free tile from opposite sides both saw it free in the same tick. Each train now reserves the next tile once it is within braking distance of it (and keeps the reservation while it stays the next tile), and claims its body tiles straight after its own update rather than at the end of the tick. Nose-to-nose trains then wait, and the lower id backs off; any train that waits nine seconds reverses.

### `Object.assign(el.style, { '--c': … })` does nothing
Custom properties are not style object properties: assigning them is silently ignored, so every brick in the title logo and every active tool rendered colourless. Use `el.style.setProperty('--c', value)` for keys starting with `--`. *(game-067 `js/ui.js` `h()`)*

### Darken in linear, judge in sRGB
Multiplying the sea's colour by 0.35 at night looked barely darker on screen: a linear 0.3 becomes about 0.58 after the sRGB transfer. Night needed a factor of about 0.16 to read as night. Pick night/shadow multipliers by looking at the output, not by the number.

### Hills that never spill onto the neighbouring track
The hill height field is the distance from the nearest non-hill ground, but a vertex counts as "inside" only if *every* tile touching it is a hill tile, so slopes reach zero exactly on the tile boundary and track running beside a hill is never covered. For tunnels, the portal's dark mouth sits exactly on the tile edge and the hill is forced steeply up just behind it, so the mouth is always in front of the hillside and the hill covers the train inside. Rebuild the hills only when terrain changes or the set of track tiles *on* hills changes; a track drag otherwise rebuilt them every frame.

### Celebrate what the player did, not what the generator did
Count-based stickers ("ten homes", "forty trees") fired the moment a starter town loaded. Count the player's own actions instead (homes built, trees planted, track tiles laid) and keep world totals for things that are naturally passive (rides, distance).

### Browser tests that tap tiles: let the layout settle, then check what's under the point
Opening a tray shifts the 3D view up (a view offset), one or two frames later, so a tile's screen position computed straight after a tool change is stale. Wait for frames, then confirm `document.elementFromPoint` is the canvas and recentre the camera on the tile if a panel covers it, rather than tapping blind and debugging phantom failures.

### The 100vh canvas bug, a second time
game-058 had taps landing one fruit too low; game-067 shipped the same bug a few days later because its CSS said `#gl { width: 100vw; height: 100vh }` while the renderer drew at `innerHeight` and taps were mapped against `innerHeight`. On a phone with a URL bar `100vh` is the *large* viewport, so the picture is stretched below where the maths thinks it is. Headless Chromium's phone emulation has no URL bar, so `100vh === innerHeight` there and no test can reproduce it. The fix is structural, so use it from the first line of every new three.js game: let `renderer.setSize(w, h)` set the canvas's CSS size in px (don't pass `false`), give the canvas no `vw`/`vh` size in CSS, map every tap and every `toScreen` through `canvas.getBoundingClientRect()`, and refit on `visualViewport` resize. The browser test can at least assert that the canvas's rect equals `innerWidth × innerHeight` and that its `style.height` is in px. *(game-067 `js/view/stage.js`)*

### Placement tools: tap to build, drag to look
Placing on pointer-down (or on every tile a drag crossed) meant a finger trying to scroll the view built a row of houses. For tools that put one thing somewhere, a drag should move the camera and only a press that never wandered more than ~10 px should place. Track the *maximum* distance from the start, not the end point, so a drag that comes back to where it started is still a drag. Painting tools (track, land, bulldozer) keep drag-to-paint, with two fingers for the camera.

## Game 068: Haven Road — a tower defense where the creeps are the people you heal (2026-10-07)

### Inverting a genre: the dead are weather, not targets
In a tower defense whose "creeps" are people to be saved, the towers act on the walkers (heal, cure, feed, warm, splint, calm) and the threat is a hazard that follows them. The lose condition is lives lost on the road, not enemies leaking. Two things keep that from collapsing into "build healers, wait": every walker starts hurt, with a clock (bleeding, spreading blight, rising cold) that kills them before the Haven without care, and the dead turn a cheap problem into an expensive one (a scratch adds a wound, blight and fear). Boss levels then hand the player the conventional "shoot the creeps" game, but the ammunition is a cure and the cured join your side. *(game-068 `js/sim/world.js`)*

### Hazards spawned among the walkers: only catch who you can keep up with
The dead spawn interleaved with the people, so later walkers come up behind slower zombies. The first balance runs lost most people to scratches *from behind*. Two rules fixed it and read naturally on screen: a zombie only scratches someone whose current speed is not faster than its own (the quick slip past; the limping, frozen, hungry and collapsed are caught), and walkers ease to the far side of the road when one of the dead is ahead in their lane. A scratch also gives the victim a short safety window and adrenaline, or one limping walker is mobbed by every zombie in the column in turn.

### A balance bot needs two placement rules a human uses without thinking
The bot's first heuristic, "the free tile whose range covers the most road", clustered every station where two roads overlapped and left the first third of the road bare, which is exactly where the hurt arrive. Weight road samples already covered by a station of the same kind at 0.3, put the first of each kind in a band of the road where that ailment bites, and the second early on the road. For boss levels it had to *leapfrog* volunteers (recall the ones the boss has walked past, redeploy ahead of it) before any boss was beatable without huge numbers; once a bot could do it, the bosses' blight could come down to where a human doing the same wins. Keep the bot in `js/sim/` and have the browser test import it to play levels out inside the page.

### Overhead bars and icons in screen pixels, not world units
A health bar sized in world units is a hair on a phone with the whole map in view. Billboard quads (one `InstancedBufferGeometry`, two draw calls for every bar and icon) whose vertex shader offsets the projected centre by a size in CSS pixels stay readable at any zoom: `c.xy += (position.xy * aSize + aOff) * 2.0 / uRes * c.w`. Draw them without depth test and with a high `renderOrder`. *(game-068 `js/view/actors.js`)*

### Portrait phones: turn the map, don't shrink it
A 24×15 map fitted into a 390×844 screen leaves tiles about 15 px wide. Turning the camera 90° on a portrait screen (yaw −π/2) so the long side of the map runs up the screen roughly doubles the tile size, and with the Haven at the top the road reads as a walk up toward safety. Fit the camera by binary-searching the distance at which all four map corners project inside the box the HUD leaves, after `setViewOffset` has centred that box.

### Kind words without a wall of words
Every heal can say something ("We've got you", "Almost there"), but at 3× speed with a dozen stations that is a wall of bubbles. Throttle in two places: the simulation emits at most one `say` event a second of sim time, and the UI shows at most one new word per 0.7 s of real time, never two at once over the same person, and five on screen in all.

## Game 069: Dirt Crown — a racing RPG whose bots found five design bugs (2026-10-07)

The career bot plays the whole game the way a player would: it races each event in its own car, buys the cheapest upgrade it can afford and retries what it loses, and must win the Dirt Crown in under 90 races with no event needing more than 12 tries. What it and the all-bot races found ([game-069/dev/README.md](../../game-069/dev/README.md)):

- **Good suspension swallowed every jump.** Takeoff needed the ground to fall away by more than a threshold that grew with suspension, so a maxed car never flew. Suspension now sets how far the tyres keep biting through small hops and how much a landing costs, not whether you fly.
- **The terrain sank under banked bends and tabletops.** The ground took the lowest road height of every nearby sample, including ones on the same stretch, so a tabletop's ramps pulled the ground under its top down and the road floated. The lowest-road rule now applies only between different stretches (a figure eight's bridge).
- **Races were processions.** With equal cars nobody passed. Grids are now seeded slowest-first, blocked drivers commit to a passing side, there is a slipstream, and champions start third with traffic of their own.
- **Fast cars flew off the ice.** The AI planned corner speeds with the track's base surface. It now plans with the grip under its racing line.
- **"Rating" flattered an even build.** Opponents all spent their spare levels on the most efficient parts, so a local could match a player rated 80 points higher. Each local now spends them somewhere different.

### Generated tracks need geometric proofs
For every track in both directions the sim test checks that no bend is tighter than the barrier can follow, separate parts of the loop never come close (bridges excepted, and each figure eight really crosses on a bridge), slopes are climbable, coins sit on the road and the grid is behind the line. `dev/geocheck.mjs` prints each track's tightest bend and closest approach while you design.

## Game 070: PHOSPHOR PATROL — a vector-monitor shooter drawn with one primitive (2026-10-08)

### Everything is a beam
[game-070/js/view/beams.js](../../game-070/js/view/beams.js) is the only thing the game draws: one instanced mesh where each instance is a line segment of light (two 3D endpoints, a colour, a brightness, a width). The vertex shader projects both ends and builds a screen-space quad around the segment wide enough for the halo; the fragment shader shades by distance to the segment, a white-hot core in a coloured glow; a segment whose ends meet is a dot. With additive blending, crossings add up the way they do on a vector CRT. Ships, text (a stroke font), explosions (the ship's own lines thrown at the glass) and the HUD all go through it, with phosphor persistence and bloom after.

### Let the bot set the boss health
The first pass let the bot kill the Harvester in five seconds on the easy setting; boss health was doubled. The Overseer's beam sweeps at 0.45 rad/s, slower than the ship can climb out of it at boss range, a number found by watching the bot die to a faster one. Under SwiftShader the screenshots show more phosphor trail than a real GPU, because frames are slower than the decay assumes; `__pp.ff(seconds)` runs the sim ahead when a screenshot needs a fight in progress.

## Game 072: Frosty Fling — an imported single-file game (2026-10-11)

Frosty Fling came in as a zip: a built single-file `index.html` plus readable source in `src/` (an HTML shell and six numbered script parts) and `src/build.sh`, which concatenates them. It is the one game of 057–076 outside the sim/view layout, on three.js r128 as a global script from cdnjs. When importing a game like this:

- Edit `src/`, then run `sh src/build.sh`; an edit to the built `index.html` is lost on the next build. The back link and `../lib/page-audio.js` are in `src/shell.html`, and the build reproduces the committed `index.html` byte for byte (checked 2026-10-14).
- Its own README suggests `npx serve`; in this repo use `python3 -m http.server` (see the serving gotcha in the scaffold skill).
- The repo smoke test is the first check. It passes on desktop and a touch-only phone, with and without storage (checked 2026-10-14, with r128 served from `dev/package-r128`). On a 390 px phone the `← Games` link overlaps the title logo; it stays clickable.
- Without a `dev/` harness, nothing checks it beyond boot and first input.

## Game 073: RUNEBORE — a story-driven digging game (2026-10-12)

### Dijkstra with a `Float32Array` of distances silently drops nodes
The bot's planner stored distances in a `Float32Array` and skipped stale heap entries with `if (d > dist[k]) continue`. `d` is a float64 sum and `dist[k]` its float32 rounding, so `d` is often a hair larger than what was stored, and the node is skipped as stale even though it is the live entry. Whole regions of the map became "unreachable" and the bot hovered over its own shaft. Use `Float64Array` for path costs. *(game-073 `js/sim/bot.js`)*

### An autoplayer must commit to a target
Re-choosing "the best ore" every time the bot entered a new cell made it oscillate between two targets across a cell boundary, hovering for a minute. Keep the chosen target until it is dug or out of reach, and only re-path to it. The same bot exposed a real economy bug in its own shopping: buying and burning a 650-crown recall scroll every trip kept it broke forever.

### The key that closes a dialogue must not also act in the world
At SwiftShader frame rates two Enter presses can queue in one frame: the first finished the last line of dialogue and the second opened the shop Thimble was parked at. A fast double-tap does the same on a real device. Swallow the rest of the frame's presses once a scene closes, and ignore world actions for ~250 ms of *real* time (`performance.now()`, not the capped game clock, which crawls under SwiftShader). Also blur the name field when play starts, or every key goes to a hidden `<input>` and the game seems frozen. *(game-073 `js/main.js`)*

### Fixed back links sit on top of scrolled sheets
On a landscape phone a long shop sheet scrolled a button under the fixed `← Games` link, and a test tap on the button followed the link out of the game. Give full-screen overlays top padding that clears the link, and in touch tests `scrollIntoView({ block: 'center' })` before tapping, as a finger would.

## Game 074: CINDERWING — an R-Type / Gradius shooter with a story (2026-10-12)

### Symptom: the frame goes black except a strip of sky → `Color.copy(0xff8800)` is NaN
A stage "look" table stored colours as hex numbers, and one call site did `uniform.value.copy(look.fog)` instead of `.set(look.fog)`. `Color.copy` reads `.r .g .b` off a number, gets `undefined`, and the fog colour becomes NaN. Every fragment that mixed in fog was NaN, and UnrealBloom's mip chain smeared it across most of the screen as black. Find a NaN source by rendering the scene into a HalfFloat render target, reading it back, and counting halves with exponent 31 and a non-zero mantissa while toggling objects one at a time; the culprit drops the count to zero. Then bisect its shader by swapping the final line for a constant. *(game-074 `js/view/terrain.js`)*

### Terrain that reads as solid exactly where it is solid
Under a perspective camera a floor's surface recedes toward the horizon, so anything behind the collision line projects *above* it and looks like ground you should be able to stand on. Build the floor as a rounded ridge whose crest sits on the collision line at z = 0 and falls away both toward the camera and behind it, then add a faint emissive line along the crest. The view samples the sim's own floor/ceiling functions, so the two can't drift apart. *(game-074 `js/view/terrain.js`)*

### Shmup scale: draw enemies bigger than their hitboxes suggest
A 32-unit field 1280 px wide makes a 1-unit imp about 40 px — 3% of the screen, where an arcade sprite is closer to 10%. The models read as smudges. Drawing every enemy model ~1.4× its first-pass size and raising the sim radii ~1.25× to match (shots must hit what you see) fixed readability without touching patterns. Keep the player's hitbox tiny and mark it with a glow at the chest.

### Light hell from the front, not just from the lava
A red hemisphere light, an orange key from below and a red rim made every model the same dark red as the sky. A neutral front fill per stage (0.8–1.0) plus a stronger rim gives forms back; the lava and the stage colour stay in the key and the rim.

### Tint enemy fire per stage
Pink bullets that read on lava vanish in the flesh labyrinth. One bullet shader (white core, colour body, dark rim, faint glow) with a per-stage colour table kept fire readable on all seven backdrops.

### Deterministic bot + checkpoints = the same death forever
On Seraph a death returns to the checkpoint, and the bot and the sim are both deterministic, so a death the bot couldn't dodge replayed identically until the continues ran out. The repeats are useful: they pointed at two real problems. The bot couldn't see a boss hand sweeping at 22 u/s (fix: predict boss parts from last frame's motion), and a stretch of the Foundry overlapped a pipe, two crushers and a pair of charging bulls into a trap with no exit (fix: the level, not the bot).

### Debug "skip to the boss" must skip the script too
Setting `scroll = len` without moving the script cursor fired every wave of the stage in the same frame. Advance the cursor and clear the spawn queue in the same hook.

### Sprites that live one frame must be drawn before they expire
The particle loop advanced time and dropped expired particles before drawing them, so a "one-frame" sprite (the hitbox glow, the charge orb) never appeared. Check expiry at the top of the loop, then advance and draw.

### Menu presses belong in a queue, not a set of edges
Edges collected in a `Set` between frames merge: at 1–2 fps (SwiftShader, or a phone under load) "Down, Down, Enter" arrives as one frame holding {Down, Enter}; the menu moved once and the confirm went to the wrong item (Restart instead of Options). Keep held keys and gameplay edges as they were, but push menu presses (arrows, confirm, back, and pad equivalents) onto a short FIFO, consume one per frame, and clear it while flying. *(game-074 `js/input.js`)*

### Touch mode must switch on from the menus too
The touch deck appeared only after a touch on the play area, so a phone player who tapped through the menus arrived in a stage with no BEAM button, and the test's tap on the missing button landed on the back link and left the page. Listen for `pointerdown` with `pointerType === 'touch'` on `window` in the capture phase, and start in touch mode when the only pointer is coarse.

### Judge character models in a neutral studio, not in the scene
In the game every angel sat under bloom, a red rim light and a spotlight, which hid what the geometry was actually doing: a sausage-shaped body with no neck or shoulders, a robe almost the colour of skin, a bright "heart-light" dot on the chest that read as a navel (the player looked naked), and grey wing-bone rods poking through the feathers. A plain page that renders the same model factories on grey with a key, fill and rim light (`game-074/dev/models.html`) made every one of those obvious in one screenshot. The fixes were anatomy and wardrobe: a neck, shoulders, a head with a face and a hair cap open over the face, sleeves with cuffs, a belt, a skirt that flows over the feet, a robe colour clearly unlike skin, coverts that hide the wing's leading edge. Then put the lights back and check them too: a point light parked on the player's chest blew his white robe to pure white under bloom. *(game-074 `js/view/models.js`)*

## Game 075: CHROME CHALICE — Adventure as a 1988 coin-op, in vanilla Canvas 2D + WebGL (2026-10-13)

### Prove key-and-door puzzles with a planner over lock states, then let the bot follow it
An Adventure-style realm is places joined by locks: gates (a key), cracked walls (a charge), a river (the bridge), a sealed wall (the grey pixel), the boss. [game-075/js/sim/plan.js](../../game-075/js/sim/plan.js) floods the tile grid once per *lock state* and searches those states breadth-first: a lock can be opened when its item and its approach tiles are both inside the current flood. The search returns the order to open them, or `null`. That one function proves every hand-made realm solvable, rejects unsolvable REMIX shuffles (`World.create` tries the next seed), and is the bot's whole strategy — it replans from the live world every second, so a bat stealing its key only costs time.

Two modelling details mattered. **A single-instance tool is a position, not a boolean**: the bridge can only span one river, so the state stores *which* spot it's on, and laying it elsewhere closes the old crossing. And **a gate that shuts behind you** (the boss arena) makes the realm look unsolvable mid-fight unless beating the boss also reopens it in the plan.

### Procedural pixel art: rasterise shapes into a material grid, then shade and outline like a sprite artist
Hand-drawing every dragon frame as character grids doesn't scale to six palettes and a 40 px boss. [game-075/js/view/sprites.js](../../game-075/js/view/sprites.js) describes one body plan as ellipses, polygons and thick lines in a 24-unit space, rasterises it at any size into an `Int8Array` of material ids, then shades per pixel — light where the pixel above is a different material, dark where the pixel below or to the right is — and draws a dark outline on every empty pixel touching the silhouette. Frames are parameters (wing up/down, jaw open, step), palettes are data, and the 40 px boss is the same code at `size = 40`. Bake once; draw with `imageSmoothingEnabled = false`.

### Symptom: a dim copy of the last screen hangs on the CRT for seconds → 8-bit phosphor persistence never reaches zero
`max(screen, previous × 0.5)` in an RGBA8 framebuffer rounds `0.5/255` back up to `1/255`, and a few such pixels plus bloom and the tube's gain stay visible as a ghost of the title's text in the HUD. Subtract a floor so trails always end:
```glsl
vec3 b = max(texture2D(prev, uv).rgb * decay - 0.025, 0.0);
```

### Don't read the screen back to light the room
Sampling the game canvas's average colour (`drawImage` to 4×3, `getImageData`) to tint the cabinet's glow forces the GPU to finish every queued draw: 166 ms a call under SwiftShader. Derive the spill colour from game state (the realm's palette, darker in a dark room, the flash colour during a flash). And don't feed it into a CSS custom property used inside large blurred `box-shadow`s, which repaints them on every change; draw the spill into a canvas that already redraws.

### Symptom: a perf bisect says every change makes it 6× faster → the first page of a fresh SwiftShader browser is slow
Shader compilation makes the first page's first seconds crawl (1–2 fps against ~14 afterwards). A bisect that measures the baseline first blames whichever variant ran first. Warm up with a throwaway page, or measure the baseline last; the browser test waits after boot for the same reason.

### Menu keys need an ordered queue, not polling
Reading held arrow keys once a frame loses a tap that is pressed and released between frames, and two presses in one frame collapse into one; at 14 fps a test's `Down, Down, Enter` became `Down, Enter`. Queue menu tokens (`up`, `down`, `confirm`, `back`) on `keydown` (and on touch/pad edges), consume one per frame, and flush the queue when entering play or a new screen so a mashed key can't fall through (game-074's `navQ` is the same idea).

### Small traps
- **A getter and a method with the same name in an object literal**: `{ get page() {…}, page(n) {…} }` — the later one silently wins, so `__cc.page` returned a function and a test compared it to a string.
- **Touching edges isn't overlap**: an 8 px square at `x` and an item at `x + 8` don't intersect with strict `<`, so a test that "places the sword against the player" never picks it up. Place it at `x + 6`.
- **A bridge you walk on must not be picked up by walking on it**: Adventure detected touches on the bridge's rails only. Lifting by the rails (`touchRails`) lets the deck be walked, and the bot's path avoids rail tiles.

## Game 076: TALEWRIGHT — an RPG maker that is also a game, in vanilla JS (2026-10-13)

### Export a runtime as one HTML file without a bundler: register functions, then `fn.toString()` them
The same RPG engine has to run inside the editor (playtest), inside an exported single HTML file and inside a standalone player, including from `file://`, where fetching your own source fails. [game-076/js/runtime/](../../game-076/js/runtime/) is classic scripts that each push one function into a registry; booting is running them in order, and exporting writes each function's source back out ([exporter.js](../../game-076/js/editor/exporter.js)):
```js
(window.TW_MODULES = window.TW_MODULES || []).push(['tiles', function (TW) { /* defines TW.tiles */ }]);
const TW = {}; for (const [, f] of TW_MODULES) f(TW);                       // boot
parts.push('TW_MODULES.push([' + JSON.stringify(name) + ', ' + fn.toString() + ']);');   // export
```
The export runs exactly the code that was just playtested. Rules that keep it safe, all checked by `dev/simtest.mjs`: no `import`/`export`, nothing outside `TW` and browser globals, never the characters `</script` in runtime source, the player's CSS kept as a string in `TW.css`, and the project JSON escaped (`<` → `<`, plus U+2028/2029) before it goes inside a `<script>`.

### Symptom: "Invalid regular expression: missing /" in a module that looks fine → a literal U+2028 in the source
Writing `/ /g` through a tool that unescapes `\u` sequences put a real LINE SEPARATOR inside the regex literal, which JavaScript treats as a line break. `node --check` didn't catch it; importing the module in Chromium did. Build such patterns with `new RegExp('\\u2028', 'g')`.

### Quests as pure checks, not scripts
Every tutorial quest is `check({ project, stats, flags }) → { progress, goal, done }`, re-run after each edit and each playtest hook ([quests.js](../../game-076/js/meta/quests.js)). Nothing railroads the player, an import or Free Mode project can satisfy them, and once a quest is recorded it stays done, so undo can't take it back. Playtest moments ("talk to someone", "win a battle") are runtime hooks recorded as flags. The harness proves each quest and trophy *can* be earned (against the sample, topped up) and that none fires on a blank project. Two traps: a copy of the sample game must not award "make a sprite"-style trophies for content the player didn't make (`meta.sample` skips project checks), and a chapter's closing scene must wait until no playtest or dialog is open, or it pops up over the game.

### A pixel layer and a crisp UI layer
The runtime draws tiles and sprites into a 320×240 canvas scaled with `image-rendering: pixelated`, and windows and text into a second canvas over it at full device resolution with `setTransform(scale * dpr)`, so every coordinate stays in virtual pixels while dialogue in any language (or emoji) is sharp. Taps are converted to the 320×240 space once and handed to whichever widget is on top.

### Map editor: a canvas under a transparent native scroller
The map canvas is sized to the viewport and sits under a transparent `overflow: auto` div whose only child is a spacer the size of the zoomed map ([mapview.js](../../game-076/js/editor/mapview.js)). Scrollbars, wheel and trackpad scrolling are native; `render()` draws only the visible part from three baked layer canvases, and painting redraws a 3×3 cell neighbourhood per stamp (edge shading depends on neighbours). Pointer events on the scroller give one-finger paint, two-finger pan and long-press menus.

### RPG Maker conventions worth copying, and two that bit
- **Empty last page = the event is gone.** A page with no graphic and no commands must not block movement, or every "erase after the quest" gate stays solid.
- **A scripted fade-out is not "busy".** Treating a black screen as busy stopped the next autorun cutscene from ever starting after `Fade Out → Transfer`.
- **The title cursor starts on Continue when a save exists**, which sends a test bot pressing OK into the load screen. Bots should set the menu index, not assume it.
- **A property and a method with the same name**: `game.battle` (the scene) shadowed `game.battle()` (start one) → "g.battle is not a function". Name the verb `startBattle`.

### Pixel-art monsters from canvas paths
Drawing each family with `ellipse`/`lineTo` at native size, then snapping alpha to 0/1, lightening pixels whose top or left neighbour is empty, darkening ones whose bottom or right neighbour is empty, and adding a one-pixel dark outline turns smooth canvas shapes into convincing pixel art at 32, 48 and 64 px from one description ([sprites.js](../../game-076/js/runtime/sprites.js) `pixelise`). The same `outline()` pass makes decor tiles read cleanly on any ground.

---

## Game 078: Sugarplum Drop — Suika-style disc physics (2026-10-14)

A Christmas merge puzzle in vanilla Canvas 2D on the Section 2S layout: eleven treats as discs in a jar, two of a kind that touch merge into the next one up. The physics is hand-written ([game-078/js/sim/game.js](../../game-078/js/sim/game.js)), and most of what was learned is about making a pile of very differently sized discs sit still.

### Stacking discs whose sizes differ by 7×
- **Speculative contacts stop fast drops sinking in.** Build contacts for every pair within a margin larger than `maxSpeed × step` (here 0.45 units), and let the normal impulse allow the pair to close the gap this step but not pass it: `target = gap > 0 ? -gap / dt : bias`. A falling treat then stops exactly on the pile with no bounce, which is the soft, candy feel the genre wants.
- **Accumulate the normal impulse and clamp friction to μ × the accumulated total.** Clamping to the current pass's impulse gives no friction after the first pass, because later passes see no approach speed; nothing then rolls, it slides.
- **Position-only push-out can't win against a pile.** With mass ∝ r², a peppermint wedged in a bottom corner under a present stayed 0.12 units (a third of its radius) inside it for 40 seconds: each position pass moved the present 1/20 of the way and the pile pushed it back. Two changes fixed it: **mass ∝ r^1.5** (a Jingle Bell is still 17× a peppermint, which still reads as heavy) and a **small velocity bias for overlaps** (10 % of the overlap a step, capped at 1.2 units/s). The deep-overlap samples went from about a thousand to fifteen across eight bot games.
- **Treating a wall-touching body as immovable made it far worse.** Giving the whole push to the free body when the other is against the glass sounds right, but deep samples went from 15 to 12,000. Removed; don't repeat it.
- **A merge can spawn outside the jar.** The new treat goes at the parents' midpoint, and a parent still swelling from its own merge can sit lower than the new one's radius allows. Clamp the spawn inside the walls.
- **Let a merge swell by position only.** The new treat starts at its parents' size and grows to its own over 0.14 s; push-out moves neighbours aside without adding speed, so a big merge in a tight heap never fires anything out of the jar.

### Testing overlap fairly
Measure overlap as a share of the **smaller** disc's radius (0.1 units is nothing between two presents and a third of a peppermint), skip fresh merges (they overlap by design while they swell), sample only while the jar isn't overflowing, and fail on how *often* it is deep (more than 25 % of a radius in over 2 % of samples), not on the single worst sample: a peppermint squeezed through a shifting pile can dip in for a moment. The [simtest](../../game-078/dev/simtest.mjs) does this for every bot game.

### The Space key and menu buttons
The Section 2S `input.js` called `preventDefault()` on every Space keydown so the page wouldn't scroll. That also cancels a focused button's click, so Space did nothing on Resume, New Game or Play Again. The template browser test never noticed because it clicks from inside the page. Leave Space alone when the target is a `<button>`, flush input when play resumes from a menu (the key that closed it must not also drop a treat), and press real keys on a focused button in the test. The skill's template and Step 5 list now include both.

## Game 079: VENDETTA OVERDRIVE — a procedural FPS balanced by a bot (2026-10-14)

### A held button needs a latch too
The Section 2S input latches *presses* until a sim step consumes them, but jump and fire are *held*, read from the key set each step. A `keyboard.press('Space')` (or a quick tap of a touch JUMP button, or a fast mouse click) puts keydown and keyup in the same frame, before any step runs, and the jump never happens. The browser test caught it. Latch the down edge as well (`tap.jump = true` on keydown, `jump = tap.jump || keys.has('Space')`, cleared in `consumeEdges()`).

### Objective reachability is not validation reachability
The generator's flood fill picks up keys as it goes and opens their doors, which is right for "can this level be finished". Reused to pick the next objective, it said the blue key (inside the red-locked vault) was reachable with no keys, and the bot walked at a wall forever. The objective fill must use only the keys in hand: `reachable(L, keys, collect = false)`.

### The bot's path finder and path follower must agree on corners
The bot's BFS allowed a diagonal step past a slime pit's corner (the pit cell is "passable"); the follower refused it (the pit cell has no field value). The bot stood at a local minimum of its own field. Give both the same corner rule: a diagonal needs both orthogonal cells walkable *and* dry.

### Let the bot find the design bugs
Every balance change here came from the bot table (`ONLY=bot SEEDS=6`): Fury filling seven times in 40 s (halved, and the Overdrive heal capped at 100); deaths 8 s after spawning on the Mothership (attack tokens, so at most 3–5 enemies wind up at once, and idle enemies only notice you in a forward cone); a level that could not be finished because the bot traded its bottomless pistol for a gun that ran dry during a boss (the pistol now rides outside the four swappable slots, and boss fights get supply drops); a bot hovering over pickups it could not take (one `canTake()` shared by the sim and the bot). A death report that lists the enemies near the player and the damage taken in the last four seconds found each of these in one run.

### Caches in the sim must be a function of saved state
Enemies follow a flow field from the player's cell. Recomputing it on a timer broke the save round trip (the loaded game computed a fresh field where the saved one used a stale one). Recompute it whenever a signature of (player cell, which doors block) changes: then the field is a pure function of saved state, and a loaded game recomputes exactly the field the saved one had.

### Raise an arm forward with +x, and build the gun down the arm
For a model facing −z, a pivot's `rotation.x > 0` swings a hanging arm *forward*; the first models had `−1.3` and every trooper aimed behind itself. Build a held gun or arm cannon along −z inside a holder rotated `−π/2` about x, so it points down the forearm and comes up with the arm. The same sign flip kept the chompers' jaws shut. All of it was invisible in play under bloom and fog, and obvious on the neutral `dev/models.html` page.

### Judge flashes by time, and don't judge them under SwiftShader
Hit flashes and screen flashes decay per *frame* by `dt`, which is capped at 0.05 s. SwiftShader draws this game at about one frame a second, so every enemy in a screenshot glowed white and a rocket blast whited out the screen. Some of that was real (an explosion light at 11× intensity under ACES and bloom); some was the test. Lower intensities until a single slow frame looks sane. UI timers that should be seconds (the delay before CONTINUE?, its countdown) run on the wall clock, not the capped frame time.

### Point the objective arrow along the walk, not as the crow flies
v1.0.0's arrow pointed straight at the keycard. In a city of building blocks the walk was 2.2× the straight line on a typical seed (up to 10×), and a player following the arrow met a wall about an eighth of the way there, with no door in sight: "the level is impossible". The bot never noticed, because the bot has its own BFS. Point the arrow at the farthest cell along the route that can be walked to in a straight line (and always at least one step along it, or the arrow spins round you when a corner clips the line), show the route's length, draw the route on a minimap, and put a beam over the objective that shows through walls. Test it with a walker that has *no* path finding: it may only follow the arrow and hop when stuck (`ONLY=guidance` in game-079's simtest). *(game-079 v1.0.1)*

### A direction marker needs a direction
A rotated `▲` is not an arrow: most fonts draw it nearly equilateral, so once it turns, any corner could be the point (game-079 v1.0.2). Draw an arrow with a shaft, a head and a notched tail (an SVG path), give it a fixed "straight ahead" tick to compare against, and change its colour when you're on course.

### A full-screen touch look pad swallows the HUD
The touch deck's right-half look pad sits above the HUD's stacking context (`#hud` is `position: fixed; z-index: 10`), so the ❚❚ button inside the HUD could not be tapped on a phone. A child's z-index can't escape its parent's context: move the button out of the HUD, above the deck.


## Game 080: EMBERLEAF — a Metroidvania proved by a planner (2026-10-15)

A cozy top-down adventure in vanilla Canvas 2D on the Section 2S layout: twelve grimoires, each a power that opens one kind of lock, across a 63-zone overworld, 30 interiors and 13 dungeons, with turn-based battles that nobody loses badly. [game-080/](../../game-080/).

### Prove the gating both ways: sufficient *and* necessary
Game-075's planner proved a realm *could* be finished. A Metroidvania also needs each lock to actually keep you out, or the progression silently collapses (a lake you can swim round, a gap in a hedge). [plan.js](../../game-080/js/sim/plan.js) floods every map at once holding a set of grimoires (dungeon keys picked up by fixpoint), and [simtest.mjs](../../game-080/dev/simtest.mjs) checks a requirements table in [story.js](../../game-080/js/sim/story.js) from both sides:
```js
// sufficient: reachable holding only its requirements (and theirs)
ok(bookReachable(reach(closure(REQ[b])), b));
// necessary: for each requirement r, unreachable holding EVERY grimoire that doesn't itself need r
for (const r of REQ[b]) ok(!bookReachable(reach(ALL.filter((x) => x !== r && x !== b && !closure(REQ[x]).includes(r))), b));
```
Two design rules fell out of it. **Pass-locks leak**: if swimming works on any water, a river drawn as water lets the Tidal Hymnal skip the Frost Psalter's crossing, so the river is drawn as *rapids* (never passable) with calm gaps you freeze. And **zone borders must be walls even in water** (reefs), or the sea joins every coast zone.

### A big hand-planned world from zone rules
Hand-drawing 216 × 112 tiles is out; pure noise can't be trusted to keep locks watertight. [worldgen.js](../../game-080/js/sim/worldgen.js) uses a zone grid: each zone has a one-tile border of its biome's wall, a connection list opens four-tile gaps (or whole edges, or gaps *filled with a lock*), features are stamped first (dungeon doors, cottages, chests, people, 5 × 5 "pockets" closed by one lock), wandering paths are carved from every doorway and feature to the zone's middle and *reserved*, and only then is scenery scattered by noise on unreserved tiles. A last flood fill per zone carves a straight L to anything still unreached. Town zones are 22 × 14 letter pictures where each capital letter's bounding box is a building and its door is the middle of the bottom row, which a test checks has a walkable doorstep.

### Two bot bugs that look like design bugs
- **Pressing forever.** The bot set a 0.4 s "think again" timer *every frame* it stood at its goal pressing Action, so the timer never ran out and it pressed at an opened chest for an hour of game time. Press once, then clear the goal.
- **Facing the wrong row.** Interaction looked at a point 0.85 tiles ahead of the feet, minus a little for the body. Standing at the very top of a tile (y = 12.03), that point fell in the row above, beside the chest. Look first at the tile straight ahead of the tile you stand on, then at the reach point.

### Battles: resolve the round at once, play it back beat by beat
The sim resolves a whole round in `act()` (your action, Wick's, every foe's, statuses) and pushes ordered `b_*` events; the UI's director plays them back with delays against a *display copy* of the hit points, so a bar drops when the hit is shown, not when it was computed. The menu is disabled until the queue is empty, and the in-browser autoplay bot waits for the same idle signal, so it plays at a person's pace without reaching into the director.

### Dialogue as data, tested at four points in the story
Every person's `talk(G)` returns a list of ops (`say`, `choice`, `give`, `quest`, `need`, `shop`…) built from the state when you speak; one runner executes them. That makes "does every script run to its end" a loop: the test runs all 80 people at the start, mid-game with no quests, mid-game with every quest active, and after the ending, through the real runner (395 scripts), and fails on an unknown op, label or item.

### Small traps
- **The purity grep matched a sentence.** `/\bwindow\./` fired on Wick's line "A window. I always kept…". Strip string literals as well as comments before grepping sim sources.
- **Symptom: after a battle, Space does nothing in the world → the focus is still on the hidden Continue button.** The game's keydown handler leaves Space alone on a focused `<button>` (so it can press it, game-078), but a button inside a container that has just been hidden keeps the focus until Chrome's next focus fix-up, which under a slow frame hasn't happened. Blur when returning to the world, and only treat a button as focused if `offsetParent !== null`. The browser test caught it as a flaky "Space at the counter talks to Pip".
- **Symptom: the Action key doesn't pick a dialogue choice, only Space does.** Space and Enter on a focused `<button>` are pressed by the browser itself, so a menu that relies on that works for those two keys and nothing else: Z, J, a gamepad's A and the touch A button all did nothing on choices and battle menus. Route every Action press that isn't already on a focused button to "press the focused button in this menu, or its first". And on a landscape phone the dialogue's full-width wrapper sat over the A button and ate its taps: give the wrapper `pointer-events: none` and only the box `auto`. Both found by a player, then tested with real Z presses and real taps (game-080).
- **Lock art over the wrong floor.** Fog drawn with its own grass underneath looked like turf inside a brick kiln. Bake the real floor into the ground chunk and draw animated locks as transparent overlays.
- **Symptom: on a phone, just after an update, the title screen shows but no button does anything → the browser mixed old and new modules.** GitHub Pages lets browsers keep each file about ten minutes, so a phone held the old `js/sim/game.js` and fetched the new `js/main.js`, whose `import { prompt }` failed to link. A link error stops the whole module graph, and the static title screen gives no hint. Fix: an import map in `index.html` that sends every module to `file.js?v=VERSION` (written by `dev/stamp.mjs` and checked by simtest, so a release can't forget it), plus a boot that does `import('./js/main.js').catch(...)` and shows a "couldn't start, Reload" card. The plain `<script type="module" src>` isn't mapped and can't catch its own failure. browsertest reproduces it by serving a game.js without the export.
- **Symptom: Save & Quit, reload, and the save is gone → a "save on hide" handler saved the title screen's demo game.** `visibilitychange` saved `G` whenever the page was hidden, and a reload hides the page. After quitting, `G` is the empty game drawn behind the title menu, so it overwrote the real save. Guard every opportunistic save (`visibilitychange`, `pagehide`, timers) with "is a game actually being played?". To test it, the harness's per-load `localStorage.clear()` has to become once-per-tab (a `sessionStorage` flag), or a reload can never be tested.


## Game 081: Salve & Scale — a first-person clinic around a ported puzzle (2026-10-15)

A first-person monster-healer adventure in three.js on the Section 2S layout, whose healing scans are Bumble Basket's (game-058) trail rules. [game-081/](../../game-081/).

### Port a puzzle class to plain state, RNG included, so it saves mid-puzzle
Bumble Basket's rules lived in a `Game` class holding a closure RNG, which is fine for a level that is never saved half-way. Here a scan can be interrupted by a pause, a tab switch or a quit, so [scan.js](../../game-081/js/sim/scan.js) keeps everything in a plain object `S` and every rule is a function of it. The generator's state lives on the object too: `objRng(S, 'rs')` reads and writes `S.rs` on each call, so `JSON.parse(JSON.stringify(S))` is a perfect save, and the simtest checks that a game saved in the middle of a scan plays on identically. Scan events go onto `S.events` and the campaign moves them into `G.events` as one `scanEvents` event, so the view sees the puzzle's flourishes through the same drain as everything else.

### Symptom: J, E or Space does nothing right after closing a menu → the "flush on resume" ate it
The Section 2S rule "flush the input when play resumes" stops the key that closed a menu from also acting in the world (game-078). Under SwiftShader a frame takes a second, so the next key a test pressed landed in the same frame as the close and was flushed too: J after Resume, E after closing the journal. Timestamp every queued press and, on the first running frame, drop only presses older than the moment the menu closed (`input.dropBefore(ui.closedAt)`); do it *before* handling that frame's presses, or the closing Space is read as "use" in the world first. Space activates a focused button on keyup, so its keydown is always older than the close.

### Symptom: a TypeError in the view after a fast-forward → events drained after the state moved on
The debug fast-forward runs the bot synchronously for minutes of game time and drains events at the end. By then a `scanStart` event refers to a scan that has already finished, and `G.scan` is null. Every handler that looks something up from an event must check the current state, not trust the event (`if (!G.scan) break;`). The same staleness hit the HUD: the objective was re-computed on a timer, so for a few slow frames after travelling it named a patient on the previous map. Recompute on a signature of the state (`map|wv|talk`) as well as on the timer.

### Prove traps are on chokepoints, and count the right things
A trap that can be walked round is decoration. The maps test disarms each reachable trap in turn and requires that at least one of them makes new entities reachable; a `mapview.mjs` printout of the cells reachable from the start (gate shut, traps armed) made moving them to real chokepoints quick. The first version of the test counted the trap itself among the reachable entities, so disarming it removed one and opened one, a net change of zero: exclude the thing being changed from the count.

### A ported puzzle needs re-balancing, not re-use
Bumble Basket's goal sizes did not carry over: a 7 × 8 body with holes, four kinds instead of three and the same senses made every scan trivially easy (the perfect bot kept 70–90% of its Focus). The scan table in the simtest (every story, quest and boss scan, plus generated walk-ins, at two bot skills on ten seeds) drove one global ×2.6 on count goals and then per-patient factors until the perfect bot kept 35–60% and the casual bot healed nearly everything with the tonic. Later acts get easy once the skill tree stacks; the campaign line in the simtest says so, and the plan's balance notes record it.

### Small traps
- **A legend letter that is also a scenery letter.** The clinic's exam table is `T`, which every other map uses for trees, and the level builder drew a stone pillar through the table. Skip the scenery pass for any cell the map's legend claims.
- **A shelf of bottles inside its own back panel.** The bottles sat at z = −0.42 inside a solid 0.5 m deep box. Build shelves from a thin back, sides and boards, and look at the prop from the front in a screenshot.
- **Symptom: stripes flicker across a rug on a phone → two rugs over the same cells.** The builder grew rugs as rectangles of `,` cells and let a later rectangle extend back over cells an earlier one had already claimed, so two coplanar rugs overlapped (and each had a gold "border" plane 4 mm beneath it). SwiftShader drew a few stray fragments; a phone striped whole patches. Grow one decal per connected patch, make borders rings rather than planes underneath, put floor decals on a polygon offset, and check in the browser test that no two flat meshes overlap at one height (game-081 v1.0.1).
- **Symptom: on a phone the scan grid is milky and the glyphs blur, but screenshots looked fine → additive layers summed into the bloom.** The X-ray patient was a double-sided additive shader, so a big model (the slime: a body, nine bubbles and a core) stacked a dozen surfaces behind every tile; under a 0.6 bloom threshold their sum glowed over everything. The screenshots had only checked a thin goblin. Keep see-through effects rim-only and front-faced, put an opaque-ish dark layer between them and anything that must be read, raise the bloom threshold where reading matters, and screenshot the biggest model, not the first one (game-081 v1.0.3).
- **Symptom: "there's no door" but the prompt says Head out → the prop is inside its own cell's wall block.** A legend letter that is solid *and* counted as wall gets an instanced wall box filling the cell, so a door model placed within ±1 m of the centre is buried. Mount anything set into a wall proud of the wall face (here z ≥ 1.06, past the wainscot), and don't wall a free-standing exit (the cart). A cheap browser check: the exit's bounding box must not fit inside any tall instanced box.
- **Symptom: a chest looks open when shut → a half-cylinder turned the wrong way.** `CylinderGeometry(r, r, len, n, 1, false, 0, Math.PI)` bulges along local +x; an Euler of `(π/2, 0, π/2)` lays the axis along x but points the curve forward (+z). Only `rotation.z = π/2` points it up. Hinge the lid group on the back top edge and lift with a negative `rotation.x`. Check a shut lid's lowest point is at the body's top.
- **Portraits from the models.** Dialogue portraits are the 3D models rendered to a render target and read back with `readRenderTargetPixels`, cached per speaker. Chromium logs a "GPU stall due to ReadPixels" performance warning (not an error) the first time each is drawn.



## Game 082: BUBBLE NEBULA — a single-screen platformer proved by jumping (2026-10-16)

Bubble Bobble in space, in three.js on the Section 2S layout: 25 hand-made sectors, bubbles that trap and chain, six crew types and a boss. [game-082/](../../game-082/).

### Prove platform levels reachable with the real body mover, not with geometry
Arguing that "platforms four rows apart and a 4.76-tile jump" make a sector climbable misses walls, ceilings, blocks you can't stand inside and the wrap. [nav.js](../../game-082/js/sim/nav.js) builds the graph by *doing it*: every run of standing surface is a node; from sample points on each one it simulates, with the same `moveBody` the player uses, a straight jump, jumps holding left or right for seven different times, and walking off each end, and the landing segment is an edge. It costs about 10 ms per sector and is cached per level (a pure function of the level, so it is safe in the sim). One graph does three jobs: the simtest proves every platform, every walker's spawn and the bubbles' air current reachable from the start; the bot plans routes on it and replays each edge's input from the take-off point; and the same mover proves that loot dropping in through the ceiling gap lands instead of wrapping forever. It caught two sectors whose air current (where every bubble gathers) no jump could reach.

### A dodging bot should score moves, not flee from the nearest thing
"Run from the closest shot" sidestepped one orb of a fan straight into the next, and "run from a close enemy" fled from the enemy it was lined up to bubble. The bot now forecasts each candidate move (left, right, still, each with or without a jump) for 1.2 s in straight lines, scores the closest approach to anything lethal, and takes the safest only when its planned move is in danger. Enemies in its line of fire are left out of the forecast, because firing is the answer to them. Regular-sector deaths halved.

### Let the bot table redesign the boss
The Baron first took bolts that flew straight along their row and hit him about a third of the time: the best bot needed 6 minutes and 67 deaths, and one seed never finished. Bolts that home in on him (and fewer, slower orbs) made it a 75-second fight where surviving is the skill. The rule that fell out: when the boss's weak point needs alignment *and* dodging, players get one of the two for free.

### Symptom: a TypeError deep in the item loop → a pickup that ends the sector
Collecting the Wormhole calls `startWarp()`, which replaces `G.items` with a new empty array, while `stepItems` is iterating the old one backwards by index. Any handler that can reset the world must stop the loop that called it (`if (G.phase === 'warp' || G.over) return;`). The campaign bot found it on its fourth seed.

### Small traps
- **The whole frame turned white after a death → an exposure "flash" decayed per frame.** Under SwiftShader a frame is a second, so `toneMappingExposure = 1 + flash` stayed lit for every screenshot (the game-079 lesson, again). Particle bursts carry the moment well enough without it.
- **A floating label clipped to "ongSho".** A canvas texture of fixed width cut long words. Measure the text first and size the canvas and the sprite's aspect from it; offset a new label that would land on one still rising from the same spot.
- **A torus scaled up to make a halo became a fat band.** Scaling a `TorusGeometry` scales its tube too; build a thin ring at the size you want. The model gallery showed it at once; in the game it read as a glowing belt.

## Game 083: WYRMZONE — a first-person vector world from one beam primitive (2026-10-16)

Battlezone on foot, then Star Wars on the wing, in three.js on the Section 2S layout, with every line drawn by game-070's beam primitive. [game-083/](../../game-083/).

### A beam the camera can walk through must be clipped against the near plane
game-070 looked at a flat playfield from far away, so its beam shader could clamp `w` and forget about it. In first person, segments of the ground, the obstacles and the dragon's own fireballs pass beside and behind the camera, and a clamped `w` flings the near end across the screen as a long streak. [beams.js](../../game-083/js/view/beams.js) clips in clip space before the divide: if one end has `w` below a small epsilon, slide it along the segment to the plane (`mix(ca, cb, (E - ca.w) / (cb.w - ca.w))`); if both do, send the quad off screen. Clip-space coordinates are linear along the segment, so this is exact. The same shader keeps widths constant in pixels (a vector monitor's beam does not get thinner with distance) and fades segments toward a far distance instead of popping them; a second instance with no far fade draws the horizon, moon and stars.

### A portrait phone gets a periscope, not a 110° field of view
Fitting a 70° horizontal field into a 390×844 window needs a vertical field over 100°, and everything at the edges stretches. Instead the world is drawn through a band of at least 1.2 : 1 (the render target's `viewport` set for the world pass only), framed like Battlezone's viewer, with the radar and score above it and the touch deck below. The beam shader's `uRes` must be the band's size, not the canvas's, or widths and halos come out wrong; the HUD keeps the whole screen in units where the shorter side is 300.

### Steering by aiming needs both a rate cursor and a placed one
Star Wars' yoke placed the cursor; arrow keys can only push it. The sim takes `{ x, y, abs }`: with `abs` (a touch stick, a gamepad stick, the mouse) the cursor chases the input and springs home when it is let go; without it, keys move the cursor at a rate and it drifts home slowly when nothing is held, so it never sticks in a corner. The mouse maps through the band and the camera's field of view back to aim angles (`screenToAim`), so the cross sits under the pointer.

### Small traps
- **The bot shot down every firebolt.** The first flight balance had both bots finishing Act II untouched; tightening fire rates moved the weaker bot to a few hits, but a perfect aimer still swats nearly everything. The balance notes say so: Act II is harder for a person than the bot table shows.
- **The game-over sheet's Title button did nothing → two elements with one id.** The heading was `<h2 id="over-title">` and the button `<button id="over-title">`; `getElementById` returns the first, so the handler went on the heading. A test that clicks "the Title button" by looking it up the same way clicks the heading and passes. Check that every id in the page is unique, and click buttons where they are drawn. *(game-083 v1.0.1)*
- **Radar blips vanished on a phone → marks sized in HUD units.** A HUD laid out so the shorter side is 300 units makes a unit about 1.3 px on a phone, so a 1.6-unit dot was 2 px. Size small marks that must be found (blips, pips) in screen pixels: convert with the band's CSS width over its width in units, and keep a floor. *(game-083 v1.1.1)*
- **Headless Chromium grants the pointer lock but never moves a locked mouse.** `requestPointerLock()` succeeds under Playwright, but synthetic moves then arrive with `movementX` 0 and a frozen `clientX`, so a test of mouse look sees nothing turn. Test the capture with a real click, dispatch the locked motion as a `PointerEvent` carrying `movementX`, and drive real moves through the uncaptured fallback (stub `requestPointerLock` to throw). Under the lock read only `movementX`: a fallback to the pointer's own step jumped the cross when a move arrived from a different position. *(game-083 v1.1.0)*
- **A "runaway spawning" invariant tripped on the ramparts.** Forty-six static towers live in `G.enemies`; the invariant had been written for the march's handful of walkers. Bound what can actually run away (missiles, spawned foes), not the list's length.

---

## Game 084: ROMANCER — a game-making game with an exportable fantasy console (2026-10-16)

### One runtime for the editor, the tests and the exported file — and prove it in a fresh realm
The VESTA-8 ([game-084/js/runtime/](../../game-084/js/runtime/)) is five ES modules, each exporting one function `part(V)` that adds to `V` and refers to nothing else; the app imports them, and `exportHTML()` writes `'(' + part.toString() + ')(V);'` for each, plus a standalone player and the cart, into one HTML file (TALEWRIGHT's trick, game-076, with modules instead of classic scripts). The test that makes it trustworthy: [simtest.mjs](../../game-084/dev/simtest.mjs) rebuilds the console from the stringified parts with `vm.runInContext` in a fresh realm, plays the RALLY cart to a win with the bot and checks it drew something. A part that reached for a module-level helper would pass every other test and fail only in exported files; this catches it in Node.

### A scripting language for players: budget every statement, and be forgiving where kids trip
VESTA SCRIPT ([lang.js](../../game-084/js/runtime/lang.js)) is lexed, parsed to an AST and compiled to closures; every statement increments a per-frame counter, so `while true do end` stops the game with "the script ran too long … line 2" instead of freezing the tab. Choices that saved support questions: an unset name reads as 0 (so `score += 1` just works), dividing by zero gives 0 (an `Infinity` position breaks everything downstream), bare names inside an object's script mean its own `x`, `vy`, `hp`… and every other name is shared, `me.thing` keeps per-object values, and a call to a function that exists nowhere is reported before the game runs, with its line. Handler headers need newlines: `on hit coin` takes the type only from the same line.

### Look-ahead bots on cloned runs, scored by distance left along the route
Frogger, Donkey Kong and Mario toys need a bot that sees what's coming. `V.cloneRun` copies a run (objects, map, globals, remapping object references held in variables) so [bots.js](../../game-084/js/meta/bots.js) `simulate()` can try each candidate input for 60–100 frames and keep the best. Two scoring traps: "floors climbed" let the Donkey Kong bot hide on a ladder (its x-distance stopped counting while climbing), fixed by scoring the remaining distance along the whole route, ladder by ladder; and a continuation policy of "hold right" walked every Mario candidate into the first enemy, fixed by a continuation that itself jumps at walls, gaps and walkers.

### A grid hop pins the other axis
A frog riding a log had `x += other.vx` applied mid-hop, so a hop up from the log clipped the corner of a bush beside the lily pad and was blocked. A grid hop now records the row or column it lands in and holds the other axis there until it lands ([core.js](../../game-084/js/runtime/core.js) `grid`).

### A repair task must check the result, not the absence of the damage
"No glitched tiles remain" was already true on a blank cart, so the test that no task fires on a blank cart failed for MAZE MUNCH and SCROLL RUN. The checks now ask that each damaged cell is **solid** again, which also stops a player "fixing" a maze wall by erasing it.

### Small traps
- **A camera glide timed in frames crawls under SwiftShader.** At about one frame a second, a 0.9 s glide with `dt` capped at 0.1 took nine seconds and the play screenshots showed the TV halfway there. Glides and power-on animations now run on `performance.now()`.
- **Menu keys in tests must wait for the queue.** Menus consume one press per frame (game-074); pressing Enter 120 times in 7 s at two frames a second left 100 presses queued. The test waits for the queue to drain after each press.
- **An auto-indenting code editor changes what a test types.** Backspacing over typed text left a fragment behind, because Enter had added indent. Clean up by setting the textarea's value and dispatching `input`.
- **Symptom: the title reads "ROMANCE" on a real machine → the tests never load the real font.** The harnesses answer Google Fonts with an empty stylesheet, so every screenshot used a narrow fallback; real Orbitron 900 overflowed the logo's column, and because the logo is `background-clip: text` gradient text the overflow was invisible rather than spilling out. Fit display text to its box after `document.fonts.ready`, and look at it once with the real font (game-084's `REAL_FONTS=1`).
- **A checklist task about one object must point at that object.** A player set the paddle control on the ball (the object that happened to be selected) and the task never ticked: it said "your paddle" while the object was called "player". Tasks now carry `obj`, their Go to button selects it, and a check that sees the right setting on the wrong object returns a `note` the checklist shows. A task that silently refuses a near-miss reads as a bug.
- **A workbench that covers the screen doesn't need the 3D scene at 60 fps**: it renders every sixth frame behind the panels.

## Game 085: WanderQuest — an idle caravan RPG on a pseudo-3D road (2026-10-18)

An idle game for phones in vanilla Canvas 2D: a caravan drives itself between towns, trades, fights and takes quests while the game is closed. The sim/view layout (Section 2S) with `RENDERER = canvas`, a DOM dock for almost all of the UI, and a racer-style road for the view.

### A pseudo-3D road with real boxes on it
- The road is the classic racer technique: segments of 200 units, each projected by a pinhole camera (`s = f / z`); curves are a sideways offset accumulated segment by segment (`x += dx; dx += curve(k)`), hills a height per segment. Both come from **stateless value noise over the segment index**, so the infinite road is never stored and looks the same after a reload or eight hours away.
- Carts are not billboards: every corner of a cart is projected through **the road's own projection**, with the road's sideways offset interpolated at that corner's depth (`roadX(z)`), so a cart on a bend turns with the road and its far end is smaller than its near end. Anything that only uses the segment under its base slides off the road on curves.
- Paint far to near and interleave: road quad of segment *n*, then every prop, house, cart and monster whose depth falls in segment *n*. Hills then hide what's behind them with no depth buffer.
- **Symptom: a page error on the very first frame of a new game only.** The camera starts 3,300 units behind mile 0, so segment indices are negative, and `Math.floor(k / 3) % 2` is `-1` in JavaScript: `palette[-1]` is `undefined`. Use `((x % n) + n) % n` for anything indexed by a world position.
- **Symptom: dollying the camera in for a fight shows only sky and road.** A pinhole camera looking straight ahead from 1,700 units up puts anything nearer than about twice its height below the bottom of the frame. Keep the camera at least ~3,500 units behind the subject and lower it a little instead of moving it close.
- Staging fights *behind* a train of carts hid them behind the last cart. Fights now happen on the verge to the right; the camera eases forward and sideways to frame them, and roadside props and town houses in that patch of verge are skipped while it does.
- Fog for free: blend each segment's colours towards the horizon colour by `(n / DRAW)^1.6`, and fill below the horizon with the fogged grass first so the gap between the last segment and the horizon isn't the clear colour.
- **Symptom: the distant mountains spin wildly as the caravan sets out (v1.0.1).** Their pan was `curve × dt × speed × MILE` in world units, then multiplied by the screen width: about a thousand pixels a second. Still screenshots never show it; a number does. Parallax layers should move by the **distance travelled this frame** (the change in the odometer, ignoring jumps from time away) times the bend, in **screen widths**. Measure it in the browser test as drift per mile.
- **Symptom: the town's houses slide along with the caravan and snap back once a second, out of step with the trees (v1.2.1).** The trees sit at fixed world positions; the town's position was `viewOdometer + milesLeft` every frame, where the view's odometer is interpolated between ticks but `milesLeft` only changes on the tick. Anything placed in the world from sim state must be built from **one clock**: the sim's odometer plus the sim's miles left, never the smoothed view value plus a sim value. The test that catches it samples the object's world position every frame and asserts it doesn't move.
- **Symptom: a cart's tailboard is solid black.** `shade()` returned `rgb(r,g,b)` and a second `shade()` of that parsed it as hex: NaN, drawn as black. A colour helper must return the same format it accepts.

### Scenery that looks natural: bands, groves and a hash per thing (v1.1.0)
One prop per segment at a fixed distance reads as a row of trees along a kerb. What fixed it (`js/view/scenery.js`): three bands per segment on each side (small things at the verge, the main props in the middle ground, big things far out that fade into the haze); a slow noise along each side that turns density up into groves and down into clearings; and every instance taking its size, lean, crown layout and colour from its own hash, so a forest of one species still has no two trees alike. Wide things (mesas, dunes, tree lines) must be pushed back by half their width, or their bases overlap the road; the sim test found that, not the screenshots. Animals and birds make it read as countryside rather than set dressing. With ~600 scattered things a frame, skip anything smaller than a pixel or two and draw grass only near the camera; the view stayed at ~7.5 ms a frame.

### Something for the player who's watching, without breaking time away (v1.1.0)
Sparkles are a reward for watching: tap one on the road before the caravan passes it. The trap is determinism: if spawning drew from `G.rng`, a session watched and the same session spent away would diverge, and the "play equals time away" test would fail. They spawn from a stateless `hash3(t, seed)` instead and expire on their own, so `advance()` creates and loses exactly the same sparkles nobody could tap; only the grab (a player command) draws from `G.rng`. The view records the sparkle's screen position and radius each frame so a tap is hit-tested through the canvas's own rect, with a 60 px target however small the star is drawn, plus a ✨ button and a key for anyone who misses it.

### Sounds and walks that follow what's on screen (v1.3.0)
- **Symptom: the fight's sounds stop part-way through a long fight.** They were scheduled up front from the battle event (`hits.slice(0, 14)`, with a timing formula copied from the view's), so anything past the cap was silent and any drift between the two formulas put sounds off their hits. Sounds for something the view animates should be triggered **by the view as it plays each beat** (`view.sfx.fightHit(h)`), at most one per frame. Then they can't outrun, undercount or drift from the picture.
- **Symptom: travellers glide back to their carts after a fight.** Their position was a blend between "home" and "fight spot" with a time factor, and their stride was tied to the caravan's odometer, which doesn't move while the caravan stands still. Give each walker its own offset that moves towards its target at a walking speed, and advance its stride phase by the distance it actually covered. Every move (to a fight, back, to the campfire) then walks for free.
- A player action that has "nothing to do" still needs a beat. Making camp at full health used to end on the next tick. A minimum length plus one line of dialogue from a traveller turns a no-op into a small moment. Pick the line from a hash of the clock, not the random stream, so time away stays identical.

### Time away is the same ticks, run quietly
- One tick is one real second. `step(G, inp, dt)` feeds an accumulator that runs whole ticks; `advance(G, secs)` runs the same `tick()` with events switched off. `simtest.mjs` checks that half an hour of 1/120 s steps and `advance(G, 1800)` produce byte-identical saves, and that a full day simulates in about 0.1 s.
- The cap (the Great Lantern, 8–24 h) is an upgrade, which turns "check in once a day" into something to work towards.
- The chronicle is a diff of `G.stats` before and after, plus the journal lines flagged as highlights when they were written. Logging every won fight buried the highlights (hundreds a day), so the journal gets one line per road ("Hearthford → Millbrook, 4 fights won (+44g)") and only losses, Elites, rare loot, recruits, quests and Waystones are highlights.
- The browser test opens a **fresh page** with a save rewound two hours by `addInitScript` (game-034's lesson) and checks the chronicle says 2h and the caravan really travelled 7,200 ticks.

### DOM panels that never rebuild under a finger
Every panel has `sig(G)`, a string of what its structure depends on, and is rebuilt only when that changes; numbers that tick every second are written in place through `data-t`/`data-w` attributes, and buttons with `data-gold` enable themselves when there's enough. Rebuilding a panel every second would replace a button between `pointerdown` and `click` and lose the tap. The catch is the signature has to name everything the markup reads: the tavern kept saying "No room in the caravan" after a level-up, because the Town panel's signature had the party size but not the number of slots. The browser test found it by levelling up while docked and clicking Hire.

### What the bot table found
- The first draft was beaten in **7 game hours**: Wardens acted once a round against eight travellers, and gear doubled a traveller's attack. Wardens now act 2–5 times a round, damage carries ±4% per level of difference, gear needs the wearer within two levels of it, and the XP curve is `25 l² × 1.075^l`. The attentive bot now takes 70–140 game hours.
- The casual bot (checking in every 8 hours) **never lit a Waystone**: it only challenged a Warden if it happened to be parked in that capital at check-in. A player reading the Town tab would set a course there, so the bot does too. A bot that doesn't use the UI's information measures a player who doesn't exist.
- A rout cost 10% of the purse, so a rich caravan bled hundreds of gold per lost fight. Cap a penalty by the fight's level, not by the player's wealth.

### A scrapbook the rules write, not the UI
- The Scrapbook tab (every person, monster, item, good, town, road and letter) is recorded by the simulation at the moment things happen (`js/sim/book.js`: `notePerson` on a hire, `noteFoes` in the fight, `noteItem` in `gainItem`, `noteLeg` on arrival). Reconstructing it from the journal would lose whatever scrolled out of the 400-line log; recording it in the sim also means time away fills the scrapbook exactly as watching does. `simtest.mjs` checks the records agree with the stats over a 12-hour run.
- Bound every list that grows with play (1,000 roads, the 500 most notable pieces of gear) and decide what to forget: the plainest, oldest gear goes, never the Legendary piece.
- A save from before the scrapbook gets one built from what it already knows (the party, the towns visited) in `deserialize`, rather than a format bump that would throw the save away.
- Undiscovered entries drawn as dark silhouettes marked ??? turn a record into a collection to fill. The portraits reuse the road's own drawing functions on a small canvas, so a monster looks the same in the book as on the road.
- Re-reading a letter opens the same sheet as new post; the sheet's button must know which it is, or closing a re-read letter would file away the next unread one.
- **Symptom: on a 360 px phone the gold counter slides under the ← Games link.** The HUD was right-aligned with a left margin, and once the purse reached seven figures its row grew wider than the space, overflowing to the left. Shrink the chips on narrow screens, and test with the biggest numbers the game can show.
## Game 086: Colorverse — pixel colour-by-number, rebuilt

v1 (an imported vector "fill the region" book) never worked and was scrapped. v2 is a pixel game.

### Art as code, sampled at pixel centres
- Every mosaic is a `draw(P)` function over a tiny pixel-art language (`js/pixelart.js`): `rect`, `ellipse`, `poly`, `ring`, `line`, ASCII `stamp`, `outline` (a 1-px halo around a set of colours), `edge` (rim shading: pixels whose neighbour in a direction differs), `mirror`, seeded `scatter`, plus `clip(keys)` and `within(rect)` masks. Shapes test the pixel centre `(x + 0.5, y + 0.5)`, so a circle of radius 3.2 is always the same pixels. The one grid gives the numbers, thumbnails, the portraits (crops) and the exported PNG.
- `edge` + `outline` do most of the work of looking "pixel arty": a dark rim under a shape and an ink outline around a character read well even at 16×16.
- A dev gallery page (`dev/gallery.html`) draws every mosaic with its palette, pixel counts and colour pairs that are too alike. `simtest.mjs` fails a colour used fewer than 3 times (a chore to find), and any two colours closer than redmean 48 (indistinguishable once painted, so a mistake can't be seen).

### Colour-by-number readability
- Unpainted pixels are greys that keep the picture's lightness. Their range matters: 212–250 was so pale that painted pastels (cloud, moonstone, pale sky) looked unpainted. 170–224 separates them. The selected colour's pixels are a darker violet-grey, so they stand out at any zoom, before numbers are readable.
- Numbers only from 15 px per cell, grid lines from 7 px; draw only the visible cells, every cell as a snapped `fillRect` in device pixels (no `drawImage` scaling, so grid lines and cells line up exactly).
- Bigger brushes are "smart": they only take pixels with the selected number, so only the centre pixel can ever be a mistake.

### Economy checked by a bot
- The first costs let a cheapest-first bot learn all 17 skills by the end of chapter 2 of 5: Streak ×2 stacked with Paint Pour (which never breaks a streak) doubled income. Streak now caps at ×1.5 and costs ramp by tier (≈120 → 3200); the bot finishes the tree in chapter 4.

See also Common Bugs §5 (a drag on a `touch-action: none` canvas swallowing the next tap) and §6 (pinch vs paint).

## Game 087: Quillsworn — a writing tool that is an RPG (2026-10-19)

[game-087](../../game-087/) is a DOM app (a novel-writing tool) wearing a guild RPG: XP from words, quests that walk you through writing a novel, ink duels, and binding to HTML, EPUB and PDF. Notes that carry over to any tool-shaped game.

### The sim/view layout without a frame loop
- Nothing moves on its own, so there is no fixed step. The sim is a set of pure actions `(S, ...args, ctx)` in [actions.js](../../game-087/js/sim/actions.js), each ending in `settle(S, ctx)`, which pays one-off awards, raises derived attributes, completes bounties and laurels and flags quests that just became ready (once, keyed in `S.player.awarded`). Time comes in as `ctx = { now, today: 'YYYY-MM-DD', hour }`; the debug hook `__qs.days(n)` shifts it, so streaks and daily bounties are testable.
- Every room calls `app.after()` after an action: it drains `S.events` into toasts and sounds and **returns the drained events**, so a room that wants its own (a duel's hits and taunts, a relic drop on the result card) reads them from the return value instead of racing the shell for them.
- Quests are pure checks `(S) => [done, of]` per step ([quests.js](../../game-087/js/sim/quests.js)), as in TALEWRIGHT. The data test walks the road and checks that the room each quest needs is open by the time it starts.

### XP from writing that can't be farmed
- Credit only words above each scene's **high-water mark** (`sc.peak`): deleting a paragraph and typing it again earns nothing, and neither does undo/redo.
- Paste is caught with `beforeinput` (flush the typed batch first) and `input` with `inputType === 'insertFromPaste' | 'insertFromDrop'`; those words raise the mark and go in the book but earn no XP. Find-and-replace also moves the mark, so replacing "dragon" with "great wyrm of the north" isn't income.
- Recount every scene from its text on load: a stored word count is a claim, not a fact.

### Markup that is always well-formed XHTML
- The EPUB is XHTML, so one unbalanced `<em>` breaks the whole book in a reader. [text.js](../../game-087/js/sim/text.js) `inlineHtml` pairs `**`, `*` and `_` with a stack: a marker that would cross another (`**a *b** c*`) is literal, anything left open at the end is unwound into literal text, `_` counts only at word edges (snake_case stays). The simtest fuzzes 400 strings of marker soup and checks the tags balance, and a tiny XML checker reads every file in the EPUB.
- XHTML has no `&nbsp;`; use `&#160;`. An XHTML file with inline SVG needs `properties="svg"` on its manifest item.

### An EPUB from a store-only zip
- [zip.js](../../game-087/js/book/zip.js) writes local headers, a central directory and the end record with a CRC-32 table, method 0 (stored), and no extra fields: that makes "`mimetype` first, uncompressed" true by construction and needs no deflate. A matching `unzip()` lets the tests read the book back. Add `toc.ncx` beside `nav.xhtml` for older readers, a `dcterms:modified`, and an SVG cover (`properties="cover-image"`): EPUBCheck 5.1 reports no errors or warnings, map plate and appendices included. Run it on the file the browser test downloads (see [dev/README.md](../../game-087/dev/README.md)).

### PDF without a library
- Build a print document with `@page { size: 6in 9in; margin: …; @bottom-center { content: counter(page) } }` and `@page :first` to drop the number, `break-before: page` per chapter, write it into a hidden iframe's `srcdoc`, wait for `contentDocument.fonts.ready`, then `contentWindow.print()`; the reader chooses Save as PDF. Chromium honours the margin boxes. Tests replace `app.printHtml` and inspect the HTML; `page.pdf({ preferCSSPageSize: true })` on the same HTML shows what a reader will get.

### Small traps
- **Symptom: on a phone, tapping into the editor pans the whole room sideways and the chapter drawer opens half off screen.** An inspector drawer parked off screen with `transform: translateX(105%)` inside an `overflow: hidden` scroller still widens the scroller's scrollable area, and `scrollIntoView()` (and focus) scroll an `overflow: hidden` box programmatically. Use `overflow: clip` (not scrollable at all) with `contain: paint` on the drawers' container. `contain: paint` makes a stacking context, so the drawer's scrim has to live inside it or it paints over the drawer.
- **Symptom: the finale's dialogue is replaced mid-speech by "another book finished".** A completion event queued a scene with `setTimeout`, and the queue decided whether to play it when it ran, after the player had already started the finale. Decide at event time, and chain scenes on one promise so a second scene waits for the first.
- A helper bubble from the mentor in a corner covered the page on a landscape phone. Asides close themselves on the first keystroke in a textarea or input, and lose their portrait on screens under 520 px tall.
- A writing app's toasts go where you aren't typing: bottom-left beside the dock on desktop, at the top on phones (the keyboard owns the bottom).
- Save each novel under its own key (`quillsworn.v1.p.<id>`) and the apprentice under another, so a keystroke in a 100,000-word book rewrites one key, not every book; on load, raise `nextId` above any id found in a saved novel in case the core was saved earlier than the book.
- A user-supplied pen name went into an SVG `aria-label` through `innerHTML`; an imported backup could have carried markup. Escape attribute values in every SVG string builder, not just text.

## Game 088: Curio Cove — a match-3 whose moves are scripts (2026-10-20)

### Resolve the whole move in the sim, then let the view play a script
[board.js](../../game-088/js/sim/board.js) resolves a swap completely and at once: the swap, every wave of clears and specials, gravity, relics leaving, cascades, the free shuffle. It pushes one event per step to `B.ev`, and each clear, special, crack or dig carries a delay `d` in "special depths" (a special that goes off at depth `d` hits its cells at `d + 1`; a trowel adds a little per cell of distance, a scarab's flight takes 3.8 units). [board3d.js](../../game-088/js/view/board3d.js) `schedule()` turns that list into timed actions: a `wave` starts a group at the current time, `clear`/`fire`/`soil` land at `start + d × 0.11 s`, a `create` waits for the wave's last clear, a `fall` starts after it and lasts as long as its longest path under gravity. The sim never waits for the view, the bot plays thousands of moves a second, a save mid-dig is one JSON object, and after every script the view calls `sync(B)` to snap to the true board, which hides any drift between animation and rules.

### Keep a board's random state inside the board
The board's RNG state is a number, `B.rs`, advanced by a pure `rngNext(s)`. A board is then plain data: `JSON.parse(JSON.stringify(B))` copies it for the bot's look-ahead (which scrambles `rs` on the copy so it can't see what will fall in) and for saves, and a reloaded dig plays on identically.

### Gravity past blockers, and pockets
Straight falls run to a fixed point, then one diagonal slide (from above-left or above-right into a cell that can't be fed from its own column), then straight falls again. A random fuzz over every level still found cells that nothing can reach: under a boulder with a hole and another boulder beside it. Other match-3 games leave such a cell empty until its blocker breaks; the test's board check now allows an empty cell only when it is that kind of pocket.

### Fit moves to a bot, not to a formula
The first levels were won by a half-skill bot in 3–20 moves. [tune.mjs](../../game-088/dev/tune.mjs) plays each level 16–24 times with no move limit and sets its moves to a quantile of the moves needed that falls with difficulty (95% for the first levels, 60% on the hard ones), and its star scores to percentiles of the winning scores, then writes the table into the level file. Relics were the slow goal (84 moves on one level): cap them, keep boulders out of a column's lowest cell, and teach the bot that a relic lower down is progress.

### A chapter's finale waits for its digs
The whole-game bot reached the last task before the last level, so the story ended one find short. A chapter's last task now also needs its twelve digs cleared.

### Bloom in a bright daytime scene
The composer's buffers are linear HDR before `OutputPass` tone-maps them, so sunlit sand at a sun intensity of 2.4 is well above 1 and a threshold of 0.85 bloomed the whole beach into fog. A threshold of 1.3 keeps only emissive, `toneMapped: false` effects (beams, rings, the sunstone) and the brightest gold highlights glowing.

### Tests that measure a button inside a pop-in sheet
Under SwiftShader a sheet's 0.3 s CSS pop-in (`scale(0.85) translateY(20px)`) had not drawn a single frame 800 ms after it opened, so a test measured Resume where it would be at the start of the animation and the tap, which forced a frame, landed on How to Play. Finish the animations up the element's tree before measuring. Two more from the same test: `offsetParent` is always null for a `position: fixed` element, so it can't be a visibility check; and `scrollIntoView()` can scroll the document root even with `overflow: hidden`, so the game pins `scrollX/Y` at 0.

### Measure flicker, don't eyeball it (v1.0.1)
A player reported that the gold coins flashed hard enough to worry about epilepsy. Polished metal (roughness 0.18 and a clearcoat) on a tile that swings ±0.5 rad sweeps the environment's bright reflection across its face; with bloom on, each pass blooms into a blinking blob. Headless screenshots showed only a bright coin or two. The measurement that caught it: arm a sampler that `gl.readPixels` the frame right after `composer.render()` (same task, so `preserveDrawingBuffer` isn't needed), keep each sample point's lowest and highest luminance over ~40 frames of a board nobody touches, and count the points that swung by more than 0.25. Freeze motion that moves edges (a bob of a pixel or two flips sample points between a dark rim and bright sand) so only changes of light count. The merged game swung 4.8% of the screen; satin gold (metalness 0.75, roughness 0.55) and a ±0.08 rad sway bring it to about 0.3%, and the browser test now fails above 1%. While there: cap and throttle full-screen flashes (no more than two a second, WCAG's limit is three) and offer a calm setting that defaults on with `prefers-reduced-motion`.

### Screens that share a z-index stack in page order, not open order
Settings opened from the pause menu was hidden under it, because both are `.screen` at z-index 50 and Settings comes first in the HTML. A test that tapped its checkbox hit the menu's Leave button instead. Give each screen a z-index from its place in the open stack.

### Growing the island tenfold (v1.1.0)
A player pointed out that an island barely bigger than the museum promises no exploring. The island ([island.js](../../game-088/js/view/island.js)) is now one height function built from a few pieces: a land field made of overlapping ellipses with noise on the coast and a disc cut out for the cove; a beach ramp on that field; noise hills only well inland; Gaussian bumps for named hills; a cone with a crater for the volcano; a highland bowl for the lake, a river bed cut along a polyline whose water level steps down at a waterfall; terraces snapped to 3.2-unit steps for the quarry; and flats blended in for the museum, the village and each dig camp. Three things to copy:
- **Never let noise dig inland land below the sea**: `h = max(h, shore + inland * 0.9)`. Without it the sea plane showed through as stray ponds. A browser-test check walks a grid inside the coast and counts points below the waterline, skipping the lake and the river.
- **Let the sea read the land**: a 320² float `DataTexture` of the height function, sampled in the sea shader, gives depth colour, shallows and foam that follow the real coast (the old shader assumed a circular island), and lets the sea discard itself under land.
- **Shadows follow the view**: one 2048 shadow map can't cover 260 units. The sun's target moves with the camera's target and its shadow box grows with the camera's distance (30 to 150 units), with `normalBias` scaled to match.
A map camera reads better than an orbit camera once there is somewhere to go: one finger pans the ground under it, two fingers pinch and twist, and a chip pinned to the screen edge points to the next dig.

### Outlines without -webkit-text-stroke (v1.1.1)
A player saw lines inside the t and d of "Great dig!". `-webkit-text-stroke` strokes every contour in the glyph, and many rounded and variable fonts (Fredoka here) draw a letter as overlapping shapes, a stem plus a bowl, so the stroke shows where they cross. `paint-order: stroke fill` would paint the fill over those inner lines, but not every browser honours it on HTML text. A ring of hard shadows outlines only the outside: `text-shadow` at radius `w` in 8 directions (16 from 2 px), with no blur, then the usual drop shadow after it. Check outlined text in a screenshot with the real font loaded; the test harnesses' empty font stylesheet falls back to a system font, whose letters don't overlap.

### A skippable rush, and signs that fit (v1.1.2)
Players found the Treasure Rush at the end of a won dig long, and asked to skip it. Because the sim resolves a move into a script at once, skipping is a view-only job: drop the timeline, the queue and the tweens, remove any meshes a cut-short animation had added to the tile layer (a cleared find waiting to shrink, a scarab in flight), `sync()` to the true board and call the same idle hook a finished script calls. The result screen, the score and the save need nothing new. The browser test checks that nothing stray is left behind and every find sits in its cell. Offer skip only once the rush has begun, so a tap during the winning cascade itself isn't swallowed.

The museum's sign drew "CURIO COVE MUSEUM" at a fixed size of 0.48 × the canvas height, which overran a 1024-pixel texture; at an angle it read "JRIO COVE MUSEU". `measureText` in a loop that shrinks the font until the words fit inside the frame fixes every sign at once.

### Scrollbars on rounded panels (v1.1.3)
A player on desktop saw How to Play's scrollbar poke out of the panel. A classic scrollbar is a square strip down the padding edge, so on a sheet with a 22 px radius its white track and arrow buttons painted over the rounded corners and the border. Phones and macOS use overlay scrollbars, and headless Chromium hides them altogether (`--hide-scrollbars` is a default argument), so no test or screenshot had shown it. The fix is a few rules: `::-webkit-scrollbar-track { background: transparent; margin: 22px 0 }` keeps the bar off the corners, a thumb with a transparent border and `background-clip: padding-box` gives a thin rounded pill, and the buttons are hidden. Firefox only has `scrollbar-width` and `scrollbar-color`, so put those behind `@supports (-moz-appearance: none)`: Chrome 121 and later ignore every `::-webkit-scrollbar` rule on an element once it has either standard property.

## Game 089: Dragonroll — a board game whose squares are an RPG (2026-10-21)

A Monopoly-style board (laps, salaries, deeds, tolls, two AI rivals) where encounters cut to Final Fantasy style turn-based battles, on the Section 2S layout with three.js. [game-089/](../../game-089/).

### Dice luck and RPG pacing fight each other: tie XP and monster levels to the party
With fixed XP per monster and monster levels set by the lap, one unlucky lap (few encounter squares, a lost fight) left the party behind the island for good: bots were knocked out seven times a game and reached the dragon at level 4. Two changes fixed it ([battle.js](../../game-089/js/sim/battle.js) `lootFrom`, [game.js](../../game-089/js/sim/game.js) `foeLevel`):
- **XP is a share of the party's next level** per enemy (weighted by the monster, a little more for tougher ones), so a fight is worth the same progress at level 3 or 13.
- **Monster levels follow the party** plus the region's danger, nudged up when the party falls behind the island's pace (`2 + 3 × lap`).
That alone overshot: a lap spent stopping at every dungeon (which also scaled with the party) carried bots to level 20 by lap 2. So XP falls off sharply once the party is more than two levels past the pace, and a cleared dungeon stays closed until the next lap. Run the whole game with a bot at two skills and print levels by lap: both failure modes were obvious there and invisible in a single fight.

### A board needs more fights than its encounter squares give
Twelve encounter squares in forty is about 1.5 fights a lap, too few for the RPG half. Wandering monsters that stand on squares and stop you when you walk into them (Fortune Street, Mario Party) add fights you can see coming, and a choice for the loaded die. Two rules keep them fair: never spawn one within three squares ahead, and a monster that beats you wanders off, or it pins the player in a loss loop (the fuzz found a 43-defeat game before this).

### One battle starter for everyone
`startBattle` runs enemy turns until a party member is up, so a battle can be lost before the player acts. The game's own path handled that; the test helpers and the `?debug=1` hooks called `startBattle` directly and left a finished battle in the `battle` phase ("no battle" errors). Export one wrapper (`beginBattle`) that starts the battle and settles it if it's already over, and use it in tests and debug hooks too.

### Two scenes, one event queue: don't cut away while the result card is up
Board and battle share one director. After a win, the sim's next events (gold, a roaming monster leaving) are board events, and playing them switched the view back to the island, so the Victory card showed over the board instead of the battlefield. While the phase is `reward`, `defeat` or a dungeon camp, board events are applied off screen at once; the view only cuts back when movement starts ([view.js](../../game-089/js/view/view.js)).

### A board camera: look out from the middle, and keep the middle low
Following the token from outside the ring put every town and landmark between the camera and the tiles. Looking out from the volcano side over the tile, its landmark, the beach and the sea frames everything and adds a horizon; inside the ring only low things grow (flowers, grass, rocks), or trees fill the foreground ([boardview.js](../../game-089/js/view/boardview.js) `focusOn`, [island.js](../../game-089/js/view/island.js) `buildScenery`).

### A Final Fantasy lineup on a portrait phone
Party right, monsters left needs about twelve units across; a 390×844 screen at 40° vertical field of view sees nine at a sensible distance, so the fighters sat at the edges behind the menu. On a tall screen the battle camera swings round to a diagonal: the party stacks at the bottom right, the monsters above them, and both clear the command menu.

### Dice that land on the sim's numbers
The sim rolls; the view only throws. Each die's final orientation is "face n up" (a quaternion taking that face's normal to +y) times a random yaw; during the throw it is that orientation times a spin about a random axis whose angle decays to zero, while the position follows a fall and two shrinking bounces ([dice.js](../../game-089/js/view/dice.js)). It always lands right, needs no physics, and the faces are fixed by the opposite-sides-add-to-seven rule.

### A toon sea that knows the shore
The sea shader samples a small height texture of the terrain to colour shallows, draw breathing foam at the waterline and roll foam lines in. Deep water must be fully opaque: at 94% the edge of the terrain mesh showed through as a dark square on the sea floor ([island.js](../../game-089/js/view/island.js) `buildSea`).

### Small traps
- **`getAnimations().forEach((a) => a.finish())` throws on an infinite animation** (a pulsing button). Finish only those whose `effect.getComputedTiming().endTime` is finite.
- **A companion on the bench crashed level-up**: the bench held member objects and the code wrapped them as if they were ids. The fuzz test found it on its first run.

## Game 090 Verdant Protocol: Press Turn, recoding, and a PS2 look in three.js (2026-10-21)

- **Press Turn in a pure sim.** Icons are `{f, h}` (full, half); normal spends a half first, weak/crit converts a full to a half, null/miss spends two, repel/drain all. Keep guard and every other command routing through the same `finishAction` and call `runEnemies` after each one: guard forgot it and the foes never moved (the sim test caught it by passing a turn and looking for the foes' phase events).
- **Per-boss extra icons must be counted from the living bosses each phase**, not summed once at spawn: a two-wave final fight kept the first boss's bonus and hit three times a phase.
- **Weakness-seeking enemy AI is lethal to a random party.** Weight weak targets ~2.2 not 3, and let your downed members cost half an icon to stand.
- **Test the dice out of the way.** Set plain attacks to 100% accuracy and the foes' Luck high in the harness so a 4% miss or 5% crit cannot flip an icon assertion; assert on events (`b_hit.res`, `b_icons.cost`) rather than HP after the enemy phase, because foes pay HP costs too.
- **Hex colour strings in canvas textures are not colour-managed.** `new THREE.Color('#4c5c5a').r` is linear (0.07): using it for 2D canvas pixels made every texture a black mud. Parse the hex yourself for canvas work.
- **Portraits: render once to a render target and cache.** The target is linear, so convert read-back pixels with an sRGB LUT; clear alpha 0 and skip the backdrop for cut-out busts; keep light intensities near 1 or toon-lit skin clips to white.
- **Toon + dither + bloom.** An ordered 4×4 dither to 5 bits in the last pass gives the PS2 grain for free; bloom before it. A back-face shell pushed out along normals in the vertex shader is a better "corrupted" look than a scaled copy (scaling moves off-centre parts).
- **Walls that hide the player:** sink wall instances near the camera-to-player line instead of making walls transparent; update only changed instance matrices.
- **A BoxGeometry with a material array works on an InstancedMesh**: give the tops a lighter material so low walls read as ledges from above.
- **Harnesses:** `pkill -f` with a pattern that appears in your own command line kills your shell; use `[b]rowsertest`. Under SwiftShader a typewriter line needs two Space presses (finish, then advance), so the test presses until the index moves.

## Game 091 STARSPIN: a slot machine roguelike with a path-shaped skill tree (2026-10-22)

- **Put a HUD snapshot on every event.** The sim resolves a whole FIRE at once (your hits, the enemy turn, jams, the next turn), so by the time the show starts G already holds the end of the turn and a HUD reading G shows the damage before the blow lands. `emit(G, e)` in [battle.js](../../game-091/js/sim/battle.js) attaches `e.s`, a dozen numbers (hull, Block, Energy, each enemy's HP, Block, Burn, strength and next move); [main.js](../../game-091/js/main.js) releases events one at a time and draws the HUD from the last released snapshot, then from G once the show is over. Cheaper to write than incremental HUD updates per event type, and it can't drift.
- **Hold actions while the show plays, don't refuse them.** Taps and keys go into a queue of at most three, taken one per frame only when no event is playing and no reel is turning, and checked with the sim's own `can(G, a)` when taken (a stale second FIRE is simply illegal by then). The bar's buttons read G, which is already ahead of the view, so FIRE is enabled while the reels are still landing and a tap on it plays out right after.
- **A Slay the Spire map from non-crossing walks.** Six random walks climb the rows, each step moving at most one column; edges (r, a→b) and (r, c→d) cross when `(a - c) * (b - d) < 0`, and a walk always has a legal step (the column straight ahead or the one an existing edge already reaches). The nodes are every visited cell, so rows hold two to four stars with no dead ends, and the simtest proves it over 300 seeds ([tree.js](../../game-091/js/sim/tree.js)). The path rule (light a star joined to the last one) makes a plain skill tree feel like the map.
- **Reels as a deck.** Adding a symbol to every reel at once keeps the strips' composition identical across reels, so a reward is a change in the odds of a match, which is what the player can reason about. Enemy jams go into a per-fight copy of the strips, so the real reels never collect Static.
- **Bosses are where runs end.** With enemy HP ×1.2 and damage ×1.3 the careful bot wins 63% and the careless one 27%, but nearly every lost run ends at a boss (most at the second). The table in the simtest prints where runs end; fit to that, not just to the win rate.
- **Small traps.**
  - A browser test measured the enemy tags right after New Run and found them at (0, 0): they are placed every frame, and under SwiftShader the next frame was a long way off. `startGame` now draws the HUD once itself.
  - Calling `preventDefault()` on Tab in the global keydown (to use it for targeting) stops keyboard users moving focus through every menu. Use a letter key.

## Game 092 NEONFALL: Pitfall! as a synthwave run, in Canvas 2D (2026-10-22)

- **Make every moving hazard a function of the clock.** Rolling logs, crocodile jaws, vine angle and scorpion patrols are `f(G.t)`, not stored state ([game.js](../../game-092/js/sim/game.js)). Nothing to save, nothing to drift, and a bot's rollout sees the exact same future as the real game.
- **A bot that plays the real sim forward is both the solver and the test.** [bot.js](../../game-092/js/sim/bot.js) clones the game (`{...G, p: {...G.p}, got: G.got.slice()}` is enough when the world is shared and immutable) and tries *run on* and *run/stand then jump at step j*; it keeps the survivor that lost the least time. It beats hand-tuned heuristics for crocodile rhythms and vine timing, and "the bot crosses every screen, both ways, without a hit" is the passability proof a generator needs (the planner of game-075 proves locks; this proves timing).
- **A rollout tail must be short.** Playing 30 steps past a landing rejected every jump over a cobra that sat 30 px from a ladder hole, because the run-on after landing fell down the hole. Judge the landing (14 steps), let the next decision handle the next hazard, and fix the generator instead: hazards keep a clearance from each other that a single jump can honour (56 px from the ladder here).
- **Compare candidates by time lost, not by progress.** Scoring plans of different lengths by `progress` made "stand still for 24 steps" beat "swing across the pit"; `0.65 × steps − progress` (the time lost against running) ranks them fairly, and waiting is expressed as a jump delay inside the plan, not as a plan of its own.
- **A mover can be unavoidable at the edge.** A log rolling across the edge Harry arrives at hit the bot at step 0 on 20 of 576 crossings. A 0.35 s grace after a screen change is a fairness rule, not a test hack.
- **Parallax on a ring needs an unwrapped camera.** The view keeps `base += dir × W` on every `screen` event and feeds `base + x` to the parallax, so the seam at screen 95 → 0 never jumps. Make the mountain and palm tiles periodic in x (whole sine cycles per 320 px) and blit them twice.
- **Reuse the CRT.** game-075's `makeCRT(canvas)` takes any 2D canvas as a texture; only its hard-coded 240 scanline rows needed to become a parameter (180 here). A WebGL canvas can't also have a 2D context, so the display canvas is sized to the picture (letterboxed) and the page background fills the rest; a body gradient with a CSS perspective grid stops a portrait phone looking like a black void.
- **Reuse the synth.** game-075's `audio.js` engine (buses, sidechain pump, gated reverb, delay, look-ahead sequencer) and `music.js` (songs from key, tempo, chords, seed) moved over with only the effects switch rewritten. One extra low-pass node on the music bus, ramped to 650 Hz, puts the whole mix "underground".
- **A fast-forward must not replay the show.** `ff(1300)` drained thousands of events into the view, which stacked popups and rings into mush. Drop everything but the `screen` events (the camera still has to follow) when the sim runs ahead of the view.
- **Small traps.** A test that jumps from a standstill never reaches the far side of a 34 px pit: air control is slow and a standing jump is 36 px, so tests run up first. Down-beside-the-hole beats walking-in as the way onto a ladder, because the floor under the hole is gone the moment the centre crosses it. A HUD counter updated on the next frame needs `until`, not `check`.

## Game 093 Dawnshard Saga: an HD-2D JRPG in three.js (2026-10-22)

- **Pixel sprites in a 3D world.** Sprites are painted into canvases by code and drawn as nearest-filtered billboards that face the camera yaw; a depth-only alpha-tested copy lets them cast sun shadows. Terrain and props are merged into a few vertex-coloured meshes per map, with a nearest-filtered tile atlas, baked ambient occlusion and stepped heights, so a whole town is a handful of draw calls.
- **Vertex colour times texture darkens twice.** Use near-white tints on textured geometry, or rocks and trees come out black.
- **A battle director plays resolved events.** The sim resolves a whole action at once and each event carries a snapshot of unit state; the director plays them as timed scripts and the UI draws from the snapshot, so health bars never run ahead of the blow. The turn-order preview excludes the unit already acting, so put the actor first yourself.
- **A bot that plays the whole game is the balance tool.** It found unreachable roads, doors inside footprints, a boss tuned too hard and every stall. Print a per-beat table of minutes, level and deaths, and tune to that.
- **Small traps.** `h('svg')` makes an HTML element, not an SVG one, so set `innerHTML` on a span. A test that waits on game time under SwiftShader needs `&fast=8` or more, because a frame never runs more than 0.05 s.

- **Procedural pixel art that looks hand-made (art pass, 2026-10-22).** Most of the gain came from the painter in `game-093/js/view/pixel.js`, not from the individual sprites. (1) *Volumetric shading*: for each mask pixel, count the run to the edge up/down/left/right and light it by where it sits between its top-left and bottom-right edges, then band into a 5-step ramp; the brightest band only on the rim. (2) *Hue-shifted ramps*: darken by multiplying the colour by itself (shadows stay saturated; skin goes warm instead of grey) plus a little violet, and lighten toward cream. Mixing toward a dark violet turns pale colours grey. (3) *Contact lines*: when a shape is painted over a different earlier one, darken the earlier pixels around it. Track a per-pixel "group" colour so parts of the same colour merge without a seam. (4) *Selective outline*: outline pixels are a deep shade of the sprite pixel they touch, lighter on the lit side. (5) *Textures as ramp offsets* (fur strokes, fish-scale crescents, stone, bark, bandages) rather than noise on top; random dots read as dirt. Fish scales are U-shaped arcs on offset 6×4 cells: 4×3 bricks and dot grids look like walls and polka dots. Build each sprite back to front (far limbs darker, then body, near limbs, face) and give every part its own colour. Faces need a lash row, iris, glint and blush to read at 32 px. Keep the original canvas sizes, because the world scale depends on them. Check at the battle camera's zoom, where every pixel shows.

## Game 094 THE LONG HELIX: a text adventure as a pure story machine with a Hercules face (2026-10-23)

- **A turn-based game keeps the sim/view split and drops the fixed step.** `choose(G, i)` is the only thing that moves the story, and everything the player sees is an event it appends to `G.events` (`choice`, `roll`, `result`, `notice`, `item`, `stat`, `codex`, `scene`, `end`). The view turns those into a transcript, the audio into sound, and the tests read them directly. The story is data (`js/sim/story.js`): nodes with text (an array, or a function of the state) and choices with `req`, `fx`, `check` and `to`. A choice with no `to` stays on its node and only prints its result, so a hub needs no sub-nodes for its small outcomes.
- **A whole-game bot is also a dead-end proof.** It plays every seed toward each ending, with the dice forced to pass, forced to fail and rolled, and the test fails if any state has nothing unlocked to choose, if the pack ever overflows, if an ending or a node is never visited. Two endings come by rule (health zero, the day-60 ship) and no path reaches them, so the test drives those by hand. A bot that always fails the dice dies of clarity at about step 60, which is how the scarcest resource showed itself.
- **A tap that finishes the typing can choose.** A tap's click is hit-tested where the finger is when it lifts, not where it went down. If the tap skipped the typewriter, the choices appear under the finger and it clicks one. The view remembers when a pointer last went down on the story and ignores every click for 450 ms if choices appear within 600 ms of it. A key that finishes the typing has the same problem one step later: Space activates a focused button on key-up, so choices that appear and take focus during a key's press get clicked by its release. Clicks with `detail === 0` are ignored for 350 ms after a skip. Both are in the browser test, with a real key and a real CDP touch.
- **Move focus in the key handler, not on the next frame.** The per-frame press queue is right for presses that change the game, but Down then Space within one frame (a fast typist, or a test) went down on one button and up on the next: Space activates a button on key-up, and a key-up on a different element than the key-down clicks nothing. It failed about 1 run in 25 until the arrows moved focus synchronously through an `onArrow` callback (`js/input.js`); a 60-run loop that presses Down, Space straight after the choices appear is how it was found.
- **A form control swallows Escape.** An input that ignores key presses while a range or select has focus also ignores Escape, so a settings screen could not be closed from the keyboard after touching a slider. Let Escape through from form controls.
- **1-bit pictures are brightness functions plus a Bayer dither.** Each scene is `lum(x, y) -> 0..1` written with a few helpers (soft discs, glows, lines, value-noise fbm, a hashed star field), dithered once through a 4×4 ordered matrix into 240×116 pixels (720×348 divided by three) and shown with `image-rendering: pixelated`. Drawing it row by row over 0.8 s, behind the floppy sound, is what makes it feel like hardware. Redraw from the stored bits when the phosphor colour changes.
- **One colour on black, in CSS custom properties.** `--ph-rgb: 255, 176, 0` drives text, borders, glow and the canvas pixels (read it back with `getComputedStyle`), so amber, green and paper-white are one attribute on `<body>`. Inverse video (the status bar, the selected choice, headings) is `background: var(--ph); color: #000`. Scanlines and a vignette are `::before` and `::after` on the root with `pointer-events: none`; the flicker is a 5 s keyframe that `prefers-reduced-motion` turns off.
- **A phone on its side needs its own layout.** Tabs, status bar and back link used up 190 of 390 pixels. In `max-height: 520px` the tabs became a column on the left and the status bar moved beside the back link, which gave the story 320 pixels.
- **Small traps.** `<link rel="icon" href="data:,">` stops the favicon 404 that every harness otherwise has to filter. A test helper that returns an index (`pick()`) must not be used as a boolean, because the first choice is `0`. The typed text node is appended to with `node.data += ch` (a text node, not `textContent`, so the cursor span is not rebuilt per character).

## Game 095 Hauntly Manor: a point-and-click mystery in cut-away dioramas (2026-10-23)

- **A point-and-click game keeps the sim/view split, and a tap is an action.** `act(G, { type: 'click' | 'use' | 'combine' | 'go' | 'code' | 'note' | 'accuse' | 'choose' | 'hint' })` applies the moment it happens, so no tap can be lost or merged, and `step(G, dt)` only moves the clock (an oven, ambient spooks, an idle timer). Hotspots are data (`name`, `show`, `click`, `use[item]`) with no positions; the view builds one model and one invisible hit box per id, and a test fails if a sim hotspot has none.
- **Wrong tries must cost nothing, and then a bot can prove there is no dead end.** Items are only consumed in the right place, doors only ever open, and a wrong use gets a silly line. The story is an ordered list of steps whose `done(G)` reads only the state, so the bot (and the hint button, and the idle nudge) can pick up from anywhere: the test plays 48 random games of taps, uses, combines and wrong codes, checks invariants after each action, and then lets the bot finish from wherever that left things.
- **One plan, three users.** Each step carries three hints (a nudge, a room, the exact thing), the hotspot to glint at level three, and the actions that finish it. The hint button asks for the next one at the same step, the hint button starts to glow after 45 s idle and a glint points at the hotspot after 90 s, and the bot runs the actions. A test walks the whole story one hinted step at a time.
- **Seeded puzzles stay fair when the text carries the numbers.** The pantry code is three digits shown on three objects in three rooms, the shelf order is a rhyme that names titles that the spines also show, the melody is crayon dots on a sheet and also their names. simtest parses each clue's text for the layout's values over 60 seeds, so a clue can't drift from its lock.
- **A cut-away diorama fits any screen with `setViewOffset`.** The room has no front wall or ceiling, the camera sits at a fixed pitch, and the distance is the larger of the one that fits its height and the one that fits its width (portrait phones just get a smaller room). `camera.aspect` is the free area's aspect and `setViewOffset(w, h', 0, -topUI, w, h)` places that frame between the HUD and the pack while the canvas stays the whole window, so `Raycaster.setFromCamera` still takes plain canvas NDC.
- **Hit boxes are bigger than models: nearest wins, and among boxes at nearly the same depth the smallest.** Each hotspot gets an invisible `BoxGeometry` (opacity 0, `colorWrite: false`). "Smallest of the nearest three" let a chandelier lose to the ballroom door behind it and a rocking horse lose to the mirror behind it; "nearest, then smallest within 0.6 units of it" is what the eye sees. A browser test projects every hotspot's box in every room on three screen shapes and checks that its centre is on screen between the HUD and the pack with the canvas (`elementFromPoint`) under it, and that a grid of taps over its footprint picks it somewhere (a table may hide the middle of a sofa).
- **A box that was never rendered has no world matrix.** A tap right after a room's first appearance missed everything because the room's `matrixWorld` is only computed at render, and the camera's inverse matrix went stale after a resize. Call `updateMatrixWorld(true)` on the room when it is shown and refresh the camera's matrices after `fit()`. The test that projects hotspots right after `go` found it.
- **A helper that returns its first argument invites a quiet bug.** `add(g, child).rotation.z = ...` rotated the parent group, which tilted whole windows and squashed the four friends flat; it looked "stylised" until the screenshot of a window on a side wall. `add` now returns the last child. When a builder helper is chained, return what the chain is about.
- **Z-fighting between a wall plane and the slab behind it.** The cut-away's wall slabs had inner faces at exactly the wall plane, and a jagged brown staircase shimmered up the side walls only in the render, never in a state test. Offset a slab 2 cm outward.
- **Emissive-mapped walls read in a dim room.** A wall plane with `emissive: white, emissiveMap: the same texture, emissiveIntensity: 0.2` keeps its pattern readable in lamp-lit rooms without adding lights, so the light count stays fixed (hemisphere, moon, two lamps and a pointer light) and no shader rebuilds between rooms.
- **A weak first random number picks the same choice every time.** The bot's LCG seeded with 1, 2, 3... returned about 0.236 for every seed, so "random" talk choices were all the first one and every run ended "warm". Hash the seed and discard a few outputs.
- **Small traps.** `Raycaster` ignores `visible`, so a hidden hotspot's box must be left out of the pick list rather than hidden. A mouse click leaves focus on the button, and then Space presses it again, so blur after a pointer click. A dialogue box that eats the tap which closed a menu must be checked in the frame loop, not the handler. `Math.random` in textures and sparkles is fine (the view isn't deterministic), but never in `js/sim`.

## Game 096 Homeward Hop: a 3D platformer whose levels are proved, not hoped (2026-10-24)

- **Write levels as scripts against a builder that checks the physics.** `L.ground(len, w)` lays a slab at a cursor, `L.gap(n)` leaves water, `L.corner(+1)` turns a quarter turn, and every new slab is judged against the previous one with `reach(mode, rise)`, which integrates the real jump (walk, jump, roll-jump, glide, spring hop, sponge, vent) with a safety factor. A hop the body cannot make, or one that needs a shell the world has not handed out yet, throws at build time. The same builder records a route (slab, via, shell needed) that the bot follows, so "the level loads" already means "the level is crossable" and a bot test only has to prove the rest (switches, barrels, bosses).
- **Quarter turns keep the collision cheap and the camera honest.** Heading is 0–3, so every slab stays an axis-aligned box and `forSolids` is a grid lookup. Corners are square pads; the camera yaw is eased toward the heading of the section the player stands in, and across a pad it is interpolated from where he is on it (`t = b/w + exit − 0.5`, smoothed). The sim owns that yaw and turns the stick through it, so the bot and a save round trip see the same frame as the player.
- **Camera-relative input belongs in the sim.** `wishDir(G, inp)` rotates the stick by `G.cam.yaw`. Keeping the yaw in G makes the fixed-step run deterministic and lets the bot ask "which way is up the screen" the same way.
- **The camera must not lose the player.** A sponge throws Pinch six metres up while a slow vertical follow lags behind; clamp the eased focus height to `[y − 2.4, y + 1.5]` so he is always on screen.
- **A hazard behind the camera is invisible.** A chase wave starting 24 m behind a camera that sits 9 m behind the player is never drawn. Film the chase from the front (add π to the camera yaw in a chase level) and the player runs toward the screen with the wave looming behind him; the stick keeps meaning "away from the camera", so it is Crash's run-at-the-screen. Look past him toward the camera, so the platforms ahead are visible.
- **Tall scenery near the path blocks the camera.** A palm leaning in from a six-metre slab's edge put a wall of fronds across the screen. Put tall things (palms, towers, lamp posts) only on broad slabs and never in a boss arena, small things at the edges of narrow ones, and the trees on little islets in the water at 5–15 m.
- **A deserialize must restore what the player stands on, not just numbers.** After a round trip the platform carry stopped because `p.ground` was a reference that came back null; store its kind and index (`gt`, `gi`) and look it up again. And `initWorld` resets `gatesOpen`, so a loaded game's gates shut: copy it across.
- **Presses and holds both need a latch.** The input layer reports a held button as held for at least one step even if the key came up inside the frame, so a tap on Power still raises the shield or starts a squash for one step. Edges (jump, spin, power, swap) wait until a step consumes them, as in the earlier games.
- **Bosses are a good place to teach the shells.** Each fight has one attack that only a particular shell answers (reflect a coconut, pound beside the golem and spin the crown, spin the gull when her dive sticks), and the bot has a tactic per boss, so the test proves the intended answer works and the others do not. A first version fell in under 15 s to a pound-then-spin loop; a short immunity after each hit (`shockCool`) fixed it.
- **Toon shading is cheap and reads at any size.** `MeshToonMaterial` with a four-step `DataTexture` ramp for everything, an ink outline made by pushing a copy of the geometry out along its normals and drawing it back-faced (smooth shapes only; boxes would split), and scenery merged into one vertex-coloured `BufferGeometry` per level (`Merger`). A whole level is 90–230 draw calls and 60–95 k triangles, shadows and sea included.
- **Shadow blobs beat shadow maps for depth.** A platformer needs to see where he will land. A flat dark disc under the player, every baddie and every shot, placed with the sim's own `groundBelow` and shrunk with height, does the job at any quality setting; the directional shadow map is a bonus that can be turned off.
- **A neutral model page finds what bloom and fog hide.** `dev/models.html` shows every character and prop on a flat floor. It found a boss's hat floating at 2.4× its height (a child of a scaled group positioned in already-scaled units) and a wing that reads as a line from one side.
- **Narrow phones need a second HUD row, not a squeeze.** Hearts, pearls, found-things and the pause button would not fit beside the back link at 390 px, so the pause button wrapped under the shell dock and a test tapped the wrong thing. Take the pause button out of the flex row, and below 560 px put the counters under the back link and the shell dock under that.
- **Small traps.** A toast raised by every checkpoint crate stacked three copies: a repeated message replaces its twin. Hold a dialogue's state in the UI and pause the sim with one flag (`ui.talking`) rather than a mode, so a boss's pre-fight talk plays over the arena. A pop animation that scales a badge by 1.5 covers its label: use 1.15. `100vh` and a phone with a notch: the safe-area insets go on the fixed controls, not just the sheets.

## Game 097 Hollow Gambit: a turn-based tactics game in the sim/view layout (2026-10-24)

- **A turn-based sim takes commands, not a stick.** `act(G, { t: 'move' | 'ability' | 'wait' | 'end' | 'start' | 'summon' | ... })` validates, resolves the whole action at once and pushes events (`move`, `battle` with every strike, `ability` with its effects, `death`, `levelup`, `phase`, `win`). The view queues the events and plays them one at a time; `step(G, { hold })` lets the enemy wait while the view animates. The bot, the UI and the tests all use the same `act()`, so the whole game (summon, party, chapter, every piece) is testable in Node.
- **For one frame the sim is ahead of the picture.** After a click the pieces have already moved in G, but the view only hears about it on the next frame, so `view.busy` is still false. A key pressed in that frame selected a piece, and the arriving animation then deselected it. Count undrained `G.events` as busy (`play.busy`), and have the tests wait for `events.length === 0 && !view.busy`.
- **One AI brain, two users.** `bestForUnit` scores every move, capture and ability one action ahead (expected damage from the same forecast the player sees, who is left where, how many pieces could take it there). The dead use it a unit at a time; the bot uses `bestForTeam`. Writing it once meant the balance bot tested the AI the player faces.
- **The bot found three stalemates.** (1) Both sides stood just outside each other's reach until the turn limit: the dead now weigh a threatened square at 0.4 and the bot's caution falls 8% a round. (2) Manhattan distance trapped pieces behind chasms: approach is scored from a BFS distance field that walks round walls and chasms. (3) A nightrider next to a king cannot take it, and every move looked "further away": score the captures a piece would have from each square it could move to.
- **Test the tables, not just the rules.** A data test checks every chapter's start squares (on the board, walkable, used once, a boss to slay) and that no two summonable pieces move alike. It caught a gargoyle spawned inside a chasm in the last chapter, which only the bot's per-action invariant ("no piece on a wall") noticed too.
- **A gacha is proved with numbers.** 30,000 simulated summons check the three rates, that a 5-star never takes more than 40 pulls and a 4-star-or-better more than 10, that duplicates stop at Bond 5 and then pay shards, and that a newcomer joins one level under the party average. "True hit" (the average of two dice) is checked the same way: 50% reads as 50%, 90% lands about 97%.
- **Fairy-chess rules are easier to get right as data.** Each piece's move is a list of `leap | slide | ride | hop | cannon` rules with a `m: 'move' | 'cap'` limit and a `phase` flag, and one `genMoves` handles all of them. The same list draws the 9×9 movement diagram on the roster, so the picture can never disagree with the rules. Each rule has a small-board test (a rook stops at the first enemy, a cannon needs exactly one screen, a hopper cannot jump two pieces).
- **A duel arena is the same scene, far away.** The two fighters are rebuilt at twice the size at x = 240 in the same scene, a second camera looks at them, and `render` picks the camera. The board never has to be hidden or rebuilt. The HUD panels cover the top of the screen, so the arena camera uses `setViewOffset` to push the frame down by their height; on a portrait phone the fighters stand closer and the camera backs off.
- **`Vector3.project` needs the camera's matrices.** Projecting for the floating damage numbers on the very first frame of a duel used a camera that had never rendered, and put the fighters in the wrong place. `project()` now updates the matrices itself.
- **Fit a board by projecting its corners.** An analytic distance was wrong at the near edge on a portrait phone (perspective makes it wider). The camera now backs off in 3% steps until the four corners, and the top of the tallest wall, all project inside the space the HUD leaves (`setPad`, with `setViewOffset` shifting the picture into it). The browser test checks the same corners.
- **A highlight needs a border.** A translucent blue square on a blue-black tile vanished. Each highlight is an additive plane with a bright 3 px border and a soft fill, tinted per kind (move blue, capture red, ability green, target gold, danger dim red).
- **Screens that are see-through hide the ones under them.** The sanctum and the chapter list sit beside the board on a wide screen with no background, so stacking them showed both. `openScreen` gives each screen the z-index of its place in the stack and sets `visibility: hidden` on every one it covers.
- **Lay a short landscape screen out differently, not smaller.** At 390 px high the menus went two columns, the chapter list and its details went side by side with March under the details, the dock became a column at the left, and the board fitted into what was left. The browser test lets a scrolling sheet keep controls below the fold but not off to the side.
- **Small traps.** A title tagline and the summon tags shared a `.tag` class, so one grew a border. A checkbox is 26 px but its whole row is the tap target, so the 44 px check reads the row. `page.keyboard.press` after a screenshot is fine; the lost press was the input race above.

## Game 098 Wyrmbond: Advance Wars battles plus an idle hatchery in the sim/view layout (2026-10-25)

- **Real time is a command, not a clock.** Eggs hatch and rings train in real time, but the sim never reads `Date.now()`. Every second, and on load and on `visibilitychange`, `main.js` works out the seconds since `G.meta.wall` and sends `act(G, { t: 'idle', sec, wall })`; the sim caps time away at 8 hours. One path covers play, a hidden tab and a week away, the purity test stays strict, and the bot and the tests simply send `idle` with whatever seconds they like.
- **A battle can push to the game's event list without saving it twice.** Battle code pushes to `B.events`, which is the game's own `G.events` array attached with `Object.defineProperty(..., { enumerable: false })`. `JSON.stringify` skips it, and `deserialize` re-attaches it. A test checks `copy.battle.events === copy.events` after a round trip.
- **The bot found the economy, not the tactics.** The first full campaign reached level 40 by chapter 10: fish gave 220 XP, the bot bought four a visit, and every level cost a flat 100. XP to the next level now rises 10% a level and food gives far less. Flat-cost food is a level printer once levels are cheap; price XP against the level curve.
- **"Spare the prisoners" made stalemates.** The bot won't knock out a collared dragon it could free, so a Wild Hunt with only strays left never ended. Strays are now prisoners, not soldiers: a rout ignores them. And the dragon chapter 8 asks you to free can't be knocked below 1 HP by your side, or any later, stronger flock kills it with the first blow.
- **The lord fell behind the army.** Kestrel only levelled from Kestrel's own actions, and by Act III was ten levels under the flock and dying to every hound. The tamer now levels with the flock (never more than one under the party's average). If losing a unit loses the battle, check its level against the party's in the bot's table.
- **Scenes must queue.** Chapter 12's turn-1 line arrived while the opening scene was still on screen, and `talk()` cancelled the scene in progress. `talk()` now chains onto a promise; Skip clears everything queued in the same tick.
- **Far-away sub-scenes need the sky to follow.** The duel arena and the roost diorama live 600 units from the board in the same scene; the 180-unit sky sphere and the sea stayed at the origin, so both rendered on black. `_follow(camera)` moves the sky, sea and clouds to whichever camera renders.
- **Inverted-hull ink on `MeshBasicMaterial`:** `objectNormal` only exists there with an env map or skinning. Push `transformed += normal * w` in `onBeforeCompile`. And `MeshToonMaterial` has no `flatShading`: passing it logs a warning per material, hundreds a frame.
- **Painted roads need two passes and orthogonal maps.** Stroking each road tile's verge and centre in turn drew the next tile's dark verge over the last one's centre: a chain of outlined pills. Draw every verge, then every centre. Then a script found the real problem: half the hand-written maps stepped roads diagonally, which can't join on a grid; it patched them through an orthogonal land tile.
- **Thumbnails from the main renderer.** Stable cards show 3D dragons rendered once into a `WebGLRenderTarget` (texture `colorSpace = SRGBColorSpace`, or the colours come out dark), read back with `readRenderTargetPixels`, flipped into a 2D canvas and cached as a data URL by species, hue and stage. No second WebGL context.
- **Portrait phones: open zoomed on the lord.** A 14×10 board fitted to a 390 px phone makes 26 px tiles, too small to tap. Battles on a portrait phone open at 1.6× on Kestrel, the camera eases to each move, and 🔍 toggles the overview; a drag pans and never acts. In landscape the HUD column has to start below the top bar, or End Turn ends up off the top of the screen (the phone test caught it).
- **A name clash:** `Audio` had a `step()` sound and a `this.step` beat counter. The constructor's `this.step = 0` shadowed the method.
- **A preview picture needs a scene, not a poke.** `dev/screenshots.mjs` clicks and presses keys to get past a title, but a game with a menu and a story before its first battle just photographs the title. `game-098/dev/preview.mjs` sets the moment up through the debug hooks (a grown flock, a sturdy target so the counter happens too), slows the view to a quarter speed and takes a frame every 0.4 s; pick one and copy it to `garden/img/games/`. Shooting it showed the breath was a few tiny sparks at 2.3× scale: it is now a flame cone with additive blending, which reads even at a few frames a second. During fights the HUD is hidden with `display: none`, not `visibility: hidden`: the enemy face and meter set `visibility: visible` on themselves, and so stayed on screen.
- **Stubbed fonts hide overflowing titles.** The harnesses answer Google Fonts with an empty stylesheet so they run offline, and the fallback for Cinzel Decorative is far narrower: the logo was 446 px in a 372 px sheet in a real browser while every test passed. The title now has a smaller size range, `white-space: nowrap`, and `fitText()` shrinks it once `document.fonts.ready` resolves (and on resize, and whenever the title opens). The browser test checks it fits, and `FONTS=1` runs the harness with the real fonts.

## Game 099 Fablecart: a block language, interpreted, with a live editor (2026-10-25)

- **Make the catalogue the single source of truth.** One table (`blocks.js`) of events, actions and conditions with typed parameters and label tokens drives the interpreter, the editor palette and controls, and the import sanitiser. The sanitiser rebuilds a cart from untrusted JSON key by key from that table, so a share code is data, never code. A test makes a fresh block of every type and checks it survives the sanitiser unchanged.
- **Plain objects keyed by player text are a trap.** `G.defs['constructor']` is a function. Tables keyed by sticker ids use `Object.create(null)`, ids are refused if `id in Object.prototype`, and a hostile-import test checks `{}.polluted` and the surviving keys.
- **A rules engine with no waits is fully serialisable.** Movement blocks set a motion that lasts a few tenths of a second (so `always` renews it and `every 3 s` can use it too), `touch` is edge-triggered with a refire timer, and everything else is instant. No block pauses, so there is no stack to save: a running world is plain JSON and the save round trip is a test.
- **Queue what could recurse.** `hurt` and `die` rules run from a queue after the damage, not inside it, with the dying handled in passes. A per-sticker budget per step and a live-sticker cap stop a sticker that makes stickers that make stickers.
- **Add the sticker's own id to its tags.** "Touch dragon" and "how many goblin" then work with nothing declared, which makes blocks read like sentences.
- **Doors carry the hero; the arrival edge decides where.** Reusing the next scene's own hero spot put you back at the start when you went *back*. Place by the entry edge, on the nearest spot clear of solids, doors and fire. A heart on that spot healed the hero for free; a test found it.
- **A bot's skill must change the outcome.** Lowering its aim did nothing because the first draft was a walkover; widening its reaction lag (recompute its plan every N steps) made 1.0 / 0.5 / 0.2 win about 90 / 50 / 8 percent.
- **Drag and drop on touch: pointer events, a threshold, and tap as the primary path.** Native HTML5 drag doesn't fire on touch. A chip starts a drag after 8 px and otherwise is a tap that adds to the lit rule; the strip has `touch-action: pan-x` so a sideways swipe scrolls it, and a block's grip has `touch-action: none`. Find the drop slot with `elementFromPoint` while the ghost has `pointer-events: none`.
- **Pixel art on a 2D canvas:** draw into a small buffer, scale by a whole number when ≥ 3× (fractional otherwise), and draw text and bubbles after the scale at full resolution so they stay sharp. A one-pixel white die-cut border baked once per sticker makes everything read as a sticker on any background.
- **Harness traps.** After a raw CDP `touchEnd`, Chromium swallows the click of the next tap (spend one on an empty bar). The Press scrolls smoothly to a new block, so measuring a control and tapping it a frame later hits whatever scrolled under the finger; wait first. A `sid: 'x'` substring match found the wrong art block in a scripted fix: when editing data in bulk, match on the whole key and look at the gallery after.

## Game 100 Glitterball Groove: a real-time match-3 whose sim animates itself, and a whole UI inside a CRT (2026-10-26)

- **A fast match-3 wants the sim to own the animation, not a script.** Curio Cove (088) resolves a move completely and instantly and plays the event list back; that is right for a cosy puzzle but wrong when the player may swap while tokens are still falling. Here a token sits in one cell and carries a visual offset (`ox`, `oy`, in cells) that shrinks to zero: a swap sets the offsets and a timer, a fall takes a cell at a time and keeps its speed across cells (`oy -= 1` as it moves down, so nothing jumps), a clear lingers for `clearAt`. Only *settled* tokens (idle, at rest) match or swap, so the view is a pure reader and a test can step the real game at 120 Hz.
- **Hold a swap that came too early.** A swap on tokens that are still busy goes into a one-slot queue with a 0.4 s lifetime and runs on the first step where both are settled. Without it every cascade eats the player's taps.
- **A bot that plays the real sim finds the economy bugs.** The first run never lost: specials, levels and a "+1 s every fourth combo" each added time, and a bot that made a special every ~8 swaps earned a second per second. The fixes were data (smaller bonuses, bonuses that shrink 10% per level, the every-fourth-combo bonus removed, a 1.6 s combo window, a level line of 10,000 points, Fever at 1.1% per token) and the test now asserts that a good Dance-Off ends in one to four minutes.
- **A shape detector, not a run detector, decides what a match makes.** Join runs that share a cell (union-find) and classify the shape: 5+ in a line, else a horizontal and a vertical run together (L, T, +), else 4. Put the new special where the player swapped, else the middle of the longest run, never on a token that is already special.
- **Draw the whole UI into one small canvas and send it through the tube.** The HUD, menus and board then share the CRT's curvature, scanlines and glow. The pieces that make it work: the canvas is a whole number of CSS px per UI px (≥ 2, so text is chunky on a phone and crisp on a monitor); the scanline count is the canvas height, so lines lock to UI pixel rows, and fade out when a row is under ~2 px (moiré); a control is a rectangle registered while drawing and padded to ≥ 44 CSS px; text sizes come from the pixel scale (`menuScale`, `titleMax`), not constants.
- **A bend needs an inverse.** Every pointer goes through the same barrel function the shader uses (`crtBend`) before it picks a board cell or a menu rectangle; a browser test drags and clicks real mouse events and fails if they disagree. Scale the curvature by aspect: the same bend pulled a tall phone's edges in too far.
- **Frame the board with `setViewOffset`.** The board's rectangle comes from the UI layout (centre and size in CSS px); distance gives the size, the view offset puts the centre in that rectangle without changing the perspective, and the sky and mirrorball are placed by unprojecting screen positions at a depth.
- **A sky sphere has to fit inside `camera.far`.** A radius-120 sphere and a far plane of 107 made the whole wall vanish: the screen was just the dark clear colour with beams in front of it. Scale it to `0.85 × far` every frame.
- **Cut tokens off at the board's edge with a clipping plane,** not by scaling: `renderer.localClippingEnabled`, one plane rebuilt each frame from the board root's matrix (normal down, through the top edge), on every token material. New tokens then slide in from above the frame.
- **A translucent board needs bars, not slabs, to show what is behind it.** Each tile is four thin glowing edge bars plus a 74%-opaque dark cover with `depthWrite: false`; the opaque tiles hid the mirrorball completely.
- **Look at screenshots in every size.** The functional checks passed while the portrait HUD floated on a busy background (give the HUD bands a scrim), the mirrorball dwarfed a narrow screen (scale it by aspect), the keypad's last row ran off the right edge (DEL and OK get their own row), and a landscape phone's menus ran off the bottom (lay rows in two columns when they won't fit).
- **WASD are letters on a text-entry screen.** The input layer aliases W, A, S and D to the arrows for menus; the initials screen reads the raw key code first, or typing an A moved the cursor.
- **UI timers run on capped frame time.** Under SwiftShader a boot, a countdown or a game-over delay takes ten times as long in real time; tests wait on `ui.t`, not on milliseconds.
- **Calm mode has to calm the right things.** Beat flashes on the sky, the bulb chase, the mirrorball's twinkling glints and polished tiles, the rainbow hue speed and the CRT's flicker, roll and glitch all follow one setting (which defaults from `prefers-reduced-motion`); a sampler reads frames back and the flicker script asserts under 1% of points swing by a quarter with it on.
- **Make the band follow a clock the view can read.** A look-ahead sequencer (a 25 ms timer scheduling 16ths 120 ms ahead) plus `beat()` (position and a `kick` that decays after each beat) lets the floor, tiles, ball and tokens pulse exactly on the kick; an `AnalyserNode` on the master bus lets a browser test assert the mix is audible and doesn't clip.
- **Pause when slow, not just when hidden.** On real hardware the game measures frame time during play and steps High → Medium → Low after two bad four-second windows; the harness turns this off.

## Game 101 PixelCrypt: an EGA first-person crawler, a bot that finds sim bugs, and a lost tap (2026-10-26)

- **EGA in three.js is a palette pass, not a texture trick.** Render the scene to a 320×200 `WebGLRenderTarget` (Nearest filters), then draw it through a full-screen shader that adds a 4×4 Bayer offset (`bayer − 0.47`, scaled 0.22) and snaps to the nearest of 16 constants. Colours that are already palette colours survive the dither (the spread is smaller than half the distance between palette entries), so sprites stay crisp and only gradients (fog, torch falloff) break into checkerboards. Set `THREE.ColorManagement.enabled = false` and leave textures in `NoColorSpace` so the values reach the shader raw.
- **Antialiased text breaks a palette.** Text drawn into a canvas texture (shop signs) is rendered into a scratch canvas and every pixel with alpha above ~0.47 is copied as a solid palette colour. Sprites get a one-pixel black outline from a post-pass over their alpha channel, which is what makes shapes read at 48×48.
- **Tile atlases from code:** brick courses, speckle and mortar from `hash3(x, y, seed)`, ten themes from three palette indices each (base, mortar, highlight). Keep highlights to the top row of each brick: speckled highlights turned into noise once dithered.
- **A bot finds the invariants you forgot.** The first bot run broke "HP ≤ max HP": swapping gear or a curse lowers the maximum, and nothing clamped the pool. The fix is central (`act()` clamps every member after every command), not at each call site. The same bot showed zero wipes at level 42 on floor 18: balance was fixed by making the monster level lean on the party (`depth + max(−4, avg − depth) × 0.55`) and raising attack, not by capping the player.
- **Prove generated secrets can't strand the player.** A secret door is only placed if BFS (ignoring secrets) still reaches the stairs and the sealed pocket is 2–40 cells; the test then checks 440 floors for reachability with and without secrets and that every "secret" chest is unreachable without one.
- **Idle income is the sim taking seconds as an argument.** `tickIdle(G, seconds)` turns real time into days at a fixed rate and the loader passes the time since `savedAt` (capped at 12 days), so the sim stays pure and offline earnings are testable by editing a timestamp in localStorage.
- **Don't replace the DOM under a finger.** A DOM panel rebuilt on every refresh lost a tap that landed between pointer-down and click (the buttons were new elements). The command panel now builds a signature of what it would show and keeps its buttons when it hasn't changed; tests also wait for the playback queue to settle before tapping.
- **Playback queue with held HUD values.** The sim resolves a round at once; the UI plays its events with delays and shows the pre-round HP until each hit arrives (`over[i]`), and input stays blocked until the queue drains. Treat a non-empty queue as busy.
- **A tap helper must refuse hidden elements.** A random encounter hid the touch pad, the test tapped a zero-size rect at (0, 0) and hit the `← Games` link, which navigated away: the flake looked like a game crash. Tests now refuse zero-size targets and turn random encounters off (`G.danger = -1e9`) while they walk.
- **Unwrapped yaw for a turning camera.** Keep the target yaw as a running angle and add the shortest quarter-turn (`((d − last + 6) % 4) − 2`) so a turn from West to North doesn't spin the long way; call the move "busy" until 45% of the tween has played so buffered key presses feel immediate but never skip a step.

## Game 101 v1.1 PixelCrypt: a battle room, effects that live on items, and a story made of existing objectives (2026-10-27)

- **Stage fights in a second scene, not in the corridor.** A closed hall built from the same atlas and material as the floor (so it matches its stone) sits in its own `Scene` with its own camera; entering it is a fade out, a swap and a fade in, and leaving it is the reverse, so the dungeon camera, its pose and the party's facing are never touched. Put the line-up of billboard enemies under whichever camera is active (`camera.add(group)` swaps parents) and project enemy tags through that camera.
- **A tap is aimed at what was on screen when the finger came down.** When a step triggers a fight the pad vanishes and a menu takes its place under the next tap. A transparent full-screen `div` that swallows pointer events for ~0.9 s at the start and ~0.7 s at the end of a fight fixes it; tests that tap right after must wait the shield out (and one test should assert that an early tap is ignored).
- **Item effects as data keys.** Artifacts carry `fx: { lifesteal, vorpal, thorns, regen, ... }`; `calc()` sums them across equipped items into `s.fx`, and each effect is one small hook in the battle (after a hit, when hurt, end of round, at victory) or the walk (every 5 steps). Booleans (`first`, `revive`) stay booleans. Once-per-battle state lives on the member's `cb` object that dies with the battle.
- **Gold-paying achievements change every exact-gold assertion.** Tests that compared gold to the cent broke when an unrelated milestone paid 150. Assert on the thing under test (a level, a counter), not the purse.
- **A saga needs no new systems.** Chapters are objectives (reach floor N, a guardian beaten, N tablets read) checked against counters the game already keeps, so it can be ignored, begun late, or finished out of order with no special cases; the only new world object is a tablet injected into floors on entry, like the quest relic.
- **Variety from knobs, not new generators.** Four floor layouts are the same maze generator with different room counts and sizes, door odds and loop odds; caverns are mazes with 30% of walls knocked out and no doors, halls are a few big rooms, warrens have none. The reachability proofs and tests stay valid for all of them.

## Game 102 STARSLING: a physics game in the sim/view layout (2026-10-27)

- **Write the solver yourself and keep it pure.** Box2D-lite's scheme (separating axis, incident-edge clipping, accumulated impulses) is about 300 lines in `js/sim/physics.js`, so a bot can play whole sectors in Node. Put the warm-start cache in the game state, or the save round trip stops being exact.
- **Start every piece asleep, and test the harder case.** A built stack never sags, but the test that matters forces everything awake and checks it still stands, because the game wakes bodies in the middle of a collapse. A sleeper counts as static for the step; wake it when a moving body touches it, when a neighbour is removed, and when an explosion reaches it.
- **Damage from reduced mass alone is wrong for light targets.** A heavy rock barely slows when it hits a glass pane, so `speed × reducedMass` says the pane is untouched. Use the mean of the reduced mass and the other body's mass, and let a static partner count as the body itself.
- **Settling jitter looks like impacts.** A three-floor stack woken from rest reaches about 1.5 u/s of approach speed between layers. Put the impact floor above it (2 u/s) or glass floors break under their own load.
- **A test world needs something left to win.** Strip a sector down to its islands and it counts as cleared the moment it starts; keep a decoy robot far from the action.
- **Narrow screens: pan, don't fit.** Fitting a 50-unit field into a 390 px portrait phone makes everything 8 px tall. Show a 34-unit window and pan it (home on the sling, then the lead asteroid, then the target), keeping room left of the sling for the pull.
- **A pull-to-aim game takes the drag from anywhere.** Aim is sling minus pointer in world units through the view's `screenToWorld`; a press that did not move is a tap, and a tap in flight is the special. The browser test puts a real finger where `worldToScreen` says the sling is.
- **Stacked sheets ghost.** A sheet opened over the title shows the title's panel through its own translucent one. Hide the panels of every screen beneath the top one (`.screen.under .sheet`).

## Game 103 Crown & Crumpet: an isometric tactics game on plain Canvas 2D (2026-10-27)

- **Play events back through a queue, with the view keeping its own picture.** The sim has already changed when `act()` returns, so the view holds `vis[id] = { x, y, hp, st, alive, ... }` and updates it only as each event plays (`move`, `skill`, `hit`, `heal`, `status`, `faint`, `talk`, `end`). Hp bars, positions and status pips then match the animation. A frame's time budget is spent across events in a loop (`left -= need`), so a fast-forward finishes many short events in one frame. `view.busy` and undrained `G.events` both gate input and the AI's next command (*game-097*, again).
- **Dialogue and cutscenes are just blocking events.** `talk` pushes a `{ type: 'talk', lines }` event; the view calls `onTalk(lines, done)` and waits (`c.wait`) until the UI's `done()`. The boss's mid-fight lines and surrender are in the sim's event stream, so a saved game and a test see them too.
- **One AI brain for enemy and bot, and make it stateless.** `aiCommand(G, u)` enumerates every standable tile and every skill target, scores damage/heal/buff plus a small position term, and returns the *next command* from the board and the turn flags alone (move first, then act). A game saved halfway through an enemy turn resumes exactly. A `skill` knob on the bot (skip 40% of turns) gives a "sloppy player" row in the balance table.
- **The bot found content bugs the data test then guarded.** A foe placed on a table tile (blocked terrain), a chapter that was unwinnable with the roster it actually has (five foes against two students), and chapters that were walks. The data test now checks every start, foe and guest is on its own walkable square and connected to the rest.
- **Isometric picking: units first, then tiles front to back.** A character's body overlaps the tiles behind it, so test sprite rectangles (nearest first), then each tile's top diamond at its own height from the back row forward reversed. The browser test asserts that every open tile centre picks that tile.
- **Select-then-confirm for touch, hover-then-click for mouse.** The first tap sets a cursor and previews the move or the damage; a second tap on the same tile does it, or a Go! button. A mouse has already hovered the tile, so one click confirms. Arrow keys pick the tile whose *screen* position best matches the key (score = distance × (2 − cosine)), because grid axes are diagonals on an isometric board.
- **Command buttons keep focus.** After tapping Wait the button stays focused and swallows Space and Enter for the rest of the battle. Blur it after every command click.
- **A landscape phone wants the commands in a column.** At 390 px high a bottom bar leaves a board 190 px tall. At `max-height: 460px` the card and commands go in a right-hand column, and the view's insets follow the column's width.
- **Fit the board by its own bounds.** `fit()` projects every tile (plus wall lift and sprite headroom) and scales to the space the HUD leaves, capped at 1.7×; the insets come from the DOM each frame (the bottom bar's height, the strip's height) so it works on desktop, portrait and landscape.
- **A tiny sticker look from ellipses and one outline colour.** Every character is a skin ellipse, a body trapezoid, a hair shape and one accessory, outlined in a translucent plum. Big eyes with two white highlights, a blush and a small smile carry the cuteness; per-character parts are functions in a table. A dev gallery page renders all of them and busts, and caught cropped hats before any map did.
- **Small traps.** Hit flash is `ctx.filter = 'brightness(...)'` around one `drawActor`. Seeded noise for the audio's percussion keeps `Math.random` out of everything but the view's petals. A screenshot right after a sheet opens catches its pop-in animation half-faded; wait before shooting. Dark themes need the HUD's text colour flipped (`body.dark`).


## Game 104 Hemlock Hollow: a parser-driven text adventure in the sim/view layout (2026-10-27)

- **A text game is still a pure sim.** `act(G, line)` is the whole input; the sim emits `say` events and the shell prints them. One tiny rule table (`rule(verbs, a, b, run)`, ids not names) holds every puzzle, so a walkthrough bot plays the real game in Node and the test can prove it winnable with a perfect score.
- **Give the bot the manners of a careful player.** The walkthrough hides on a patrol warning and waits out a patrol before walking into one. Without that it dies of dread; with it, dread never passes 12. Write the careless-player run too, and print what it costs.
- **One-bit art from anti-aliased canvas.** Draw with ordinary paths and 4×4 Bayer dither patterns, then threshold every pixel to black or near-white with `getImageData`. The edges stay crisp, scaling with `image-rendering: pixelated` keeps them so, and the browser test can assert there is no grey pixel. Draw the transient things (the dissolve, the dread vignette) before the threshold, the pale eyes after it.
- **Discovery by experiment needs the hint to say how.** A recipe the player has not learned cannot be brewed by name; the hints and the NPC lines must name the herbs ("brew valerian and elderflower"), or the first walkthrough dies on "you don't know that recipe".
- **A death should be funny and fair.** Every lethal option is telegraphed in the prose (a heron standing on nothing, "never taste what is black or purple-spotted") and each has its own test; the checkpoint stack skips a save made at 70+ dread so Restore never returns you into a doomed state, and a second Restore into the same checkpoint goes back a step.
- **Chips beat the on-screen keyboard.** On a phone the tap shortcuts (exits, a verb row, the things in the room) compose "use salve on bryony" without the keyboard; on desktop they are folded away behind a button so the transcript keeps its height. Don't focus the input on coarse pointers or the keyboard covers the page.
- **Never `100vh` for a column of text.** The page is one flex column exactly as tall as `visualViewport.height` (set as a CSS variable in px); the log is the flexible child and scrolls, so the input is never under the keyboard or the browser chrome.
- **A typewriter must be skippable.** Space, a tap on the transcript or the next command flushes it; `&fast=1` and reduced motion print instantly. Tests run instant.
- **Prose trips a purity grep.** The word "window." in a room description matched `window\.` in the sim's purity check; grep for `window\.[a-z]`.

## Game 105 Solder & Rain: a bench sim with a generator, a planner and a bot that proves every job (2026-10-28)

- **A planner serves two masters.** `nextGoal(G)` reads the sim and returns one atomic, physically possible step (unscrew this, unplug that, lift this, fetch that spare). The Hint button prints its text; the bot executes it through the same `act` commands a player uses. One function, two features, and a hint that can never ask for the impossible (a simtest checks it).
- **Prove procedural content, don't trust it.** The generator retries until `validate` passes (repair every fault in a copy, run the device's own test, check overlaps, spares and ports), then simtest has the bot repair 216 generated devices. It found real bugs in minutes: a planner that re-plugged a cable it had just pulled to reach something, and tools dispatched in the wrong order.
- **A part is free when nothing fastens, plugs into or covers it.** Layers plus overlapping footprints give a whole disassembly puzzle from one rule (`blockers()`), and the same rule decides what can be dropped back. Carrying a board carries the parts mounted on it.
- **Give the sim the point on the surface, not the point on the floor.** The pointer is a ray. The bench-plane intersection is several units from a screw head that stands on a cover plate, so a "tool lifts off if you wander" check fired immediately for a real mouse and never for the bot. The view sends the surface point under the cursor (`px`, `pz`) as well; the browsertest uses a real mouse.
- **Holding a button must be able to let go.** Sliding across a panel brushed past another screw, started it, and the stale "use" blocked chaining to the next. When the tool leaves a head the use ends and chaining resumes.
- **Frame the scene in the space the HUD leaves.** Measure the top and bottom bars from the DOM and use `camera.setViewOffset` plus a fit that uses the remaining height; otherwise the screws nearest the camera sit under the toolbar and a real mouse cannot reach them.
- **Tap-to-carry beats hold-to-drag on a phone.** A quick small press picks a part up and sticks it to the cursor; the next press puts it down. Dragging still works. Two fingers are always a camera gesture and cancel a press.
- **Merge per material.** Each part is a handful of primitives merged by material into one mesh each (a tiny non-indexed merge in `kit.js`), so a 20-part device with fasteners and cables is a few hundred draw calls, not thousands.
- **Cables rebuilt in place.** A tube along a CatmullRom curve with parallel-transport-ish frames, positions and normals rewritten into the same buffers only when an end moves; a severed cable collapses two rings to nothing for the gap.
- **A neon env map from a tiny scene** (`PMREMGenerator.fromScene` of a gradient sphere and four emissive strips) makes every bit of metal on the bench read as lit by the street.
- **Don't `pkill -f` a name your own shell command contains.** It killed the command that ran it.

## Game 106 INTRUDER ALERT '84: a survivors-like in the sim/view layout, tuned by a bot (2026-10-28)

- **A survivors-like fits the sim/view layout as-is.** Auto-aim, spawning, chips and levels are all sim rules; the only new shape is the level-up: `step()` returns early while `G.choice` is set, and a pure `choose(G, i)` applies the card. `main.js` opens the card screen when it sees a pending choice, the bot answers it with `botChoose(G)`, and a save made mid-choice reloads onto the same three cards (simtest checks it). Several levels at once queue as `G.pending` and come one set of cards at a time.
- **Let the bot find which threat is broken.** The first table said no robot ever touched the bot and the Grinner killed every run at 1:40 — an unkillable chaser faster than a player can escape in a walled room is a wall, not a threat. Giving it a recoil after each bite and letting lasers knock it back turned it into a fight that firepower wins. The next table said bolts did most of the damage. Count damage by cause in the probe (`hurt` events carry `cause`), not just survival time.
- **Berzerk's maze is one wall per post, and still needs proving.** 3 rooms in 200 sealed a door off. The generator now flood-fills a half-unit grid with a player-sized body and rerolls a room that can't reach all four doors; simtest checks 200 seeds with a finer grid.
- **Bloom inside the pixel buffer.** Shrinking the 512×288 buffer to half and quarter size with smoothing and adding them back with `lighter` *inside the buffer* costs almost nothing and the glow is upscaled with the pixels, which suits a 16-bit look.
- **Measure frame rate after a warm-up.** Under SwiftShader the first two seconds after a scene change run at 10–13 fps whatever is drawn. Turning effects off one at a time in that window blamed bloom for a 4× slowdown that wasn't there; measuring three times in a row showed 13, 61, 60.
- **Cap effects by count, not just by life.** A fast-forward drained minutes of kills at once and made 3,000 expanding rings; the page ran at 1.5 fps and a Playwright screenshot timed out. The same thing happens in real play when a sector purge wrecks 150 robots on one step. Rings are capped at 64, particles at 900, and the view only draws the last 400 events of a batch.
- **A crowded floor merges drops.** Past 120 chips, a new chip adds its value to the nearest one within 2.5 units, so a long run never draws or iterates hundreds of chips.
- **A portrait camera instead of a postage stamp.** A 16:9 room letterboxed on a 390×844 phone is 219 px tall. In portrait the view draws the room's full height but only 14 units of its width, panned after the player (`drawImage` with a source rect from the buffer), sits it at the top so the thumbs have the space below, and puts arrows on the edges for robots off camera. Nothing in the sim knows.
- **The key that closes a menu is flushed on the first frame back** (game-078's rule). A test that presses Space on Resume and then Space to dash straight away loses the second press in that same flush; the test waits for the sim clock to move first. Likewise a level-up pick swallows keys for 250 ms on purpose, so the test waits before pressing Escape.
- **Sprites with a weapon on one side flip the other way.** The gunner's arm cannon is drawn pointing left, so the "face the player" flip had to be inverted for it; the sprite gallery (`dev/gallery.html`, neutral grey, mirrored and hit-flash versions) is where that showed.
- **Speech synthesis as a sound effect.** `speechSynthesis` with `pitch: 0.1` makes a passable 1980 robot voice with no files; guard every call, cancel before speaking, follow the effects volume and give it its own off switch.

## Game 107 Kaiju Roll: Katamari growth, floor-stack buildings and a camera that hides a ball (2026-10-29)

- **Grow by volume, not radius.** Every swallowed thing adds a volume and the radius is its cube root, so the first people barely register and a bus or a slab of rubble is a visible step, and later growth slows by itself. One number then drives damage (`r²`), the camera distance, the swallow threshold (`size <= 0.9 r`) and the crush rule: a building whose height is under `0.9 r` is rolled over and ground down instead of bounced off, which is what turns a pest into a steamroller. The streets widen a little every city so the start-size ball still fits.
- **A ball that never stops is a breakout ball.** A minimum speed (it eases back up to 3.8 u/s along its last heading) plus steering as acceleration gives curved paths and ricochets with no paddle. The bot still plays it: aim at the near face of the nearest building, pounce when two are in the shockwave.
- **A building is a stack of floors.** The wall geometry is built floor by floor (24 indices each) and a floor falling is `setDrawRange(0, floors * 24)`; the roof is a separate mesh whose height eases down to the new top, so nothing is ever rebuilt and a hundred buildings cost two draw calls each. Lean is a small sine offset per ring, applied to the roof too so it still sits on the wall.
- **A paint mask keeps instance colours off the windows.** Instanced cars, trees and people tint through `instanceColor`, which also multiplies the wheels and windows. A per-vertex `aPaint` attribute and a one-line `onBeforeCompile` replacement of the colour (`mix(color, color * instanceColor, aPaint)`) in the `color_vertex` chunk tints only the body. The same geometry baked with its tint serves the things stuck on the ball.
- **Stuff that sticks to a ball is part of the sim.** `ball.stuck` holds `[kind, dir, size, colour]` rows drawn from the sim's RNG and a counter `sn` of everything ever pushed, so the view can add the new rows and drop the oldest without rebuilding 70 meshes per swallow, and a save restores the same coat.
- **Thin ground layers z-fight.** Road, sidewalk and lot slabs 0.02 apart under a camera with `near = 1` showed the island's tan plate through the roads in diagonal bands, but only in one harness's screenshots (SwiftShader's depth buffer is coarser than a real GPU's). `near = 3`, 0.04 or more between layers and no dashes across junctions fixed it. Look at screenshots from more than one harness before trusting a pretty one.
- **Find a ball hidden behind a skyscraper.** A second sphere with `depthFunc: GreaterDepth` draws only where something is in front of the ball, and a ground ring (gold when the pounce is ready) finds it in the dust cloud of its own collapse. Dust is capped at about 0.55 alpha for the same reason.
- **Aggregate score popups.** A rampage awards dozens of small scores a second; the view sums them and shows one number above the monster every third of a second, and only announces combo tiers up to 60 so a chain of 200 does not shout.
- **Prove the city before drawing it.** simtest builds 40 cities and checks that every building is on the plate and inside a block, nothing overlaps, and a flood fill of the free ground for a ball of the starting radius reaches every building. Test setups can fool you the other way: placing the ball "in the plaza" at fixed coordinates dropped it inside a building, so a power-up was never touched. Start from `layout.start`.
- **The bot found the army had no teeth.** A perfect bot cleared the first table in 30 s and lost no health. Building strength ×2.8, a shorter first-tank timer, more tanks and helicopters and a bigger shell put a perfect bot at 45–115 s a city and a sloppy one (skill 0.3) in real trouble on the last three; the army is chosen per city in `LEVELS[i].mil` so the table is one line to read.
- **A fast-forward hook must stop where the UI starts.** `ff()` runs the bot until the city is flattened and then returns, so the star sheet opens from the normal event path and the browser test can click a gift, not just assert a phase.
- **Cel shading in three.js is a ramp and an ink pass.** `MeshToonMaterial` with a 4-texel `NearestFilter` gradient map gives the bands (the kit's paint-mask patch still works, it hooks the same `color_vertex` chunk). Outlines come from the depth buffer, not a second hull: 1/z is an affine function of the depth value, so a flat face has a zero Laplacian in it and only silhouettes and creases light up (`|Σ neighbours − 4·centre| / centre` between 0.004 and 0.02 reads well). One pass works for instanced, merged and growing meshes alike.
- **Draw the see-through things after the ink.** Solid things (layer 0) go into a multisampled render target with a depth texture; a full-screen quad inks them onto the screen and writes `gl_FragDepth` (with `depthFunc: AlwaysDepth`, since depth writes need the test enabled); dust, shadows, rings and bubbles (layer 1, with `scene.background` removed for that pass) are then drawn onto the screen and depth-tested against it. Otherwise the outlines of buildings show through the dust. The quad's `#include <colorspace_fragment>` does the linear-to-sRGB step the render target skipped.
- **A character choice is a table of multipliers and a model.** `CHARS` holds health, steering, top speed, pounce cooldown, damage and power-up time; the sim reads them in the same five places a perk does, so perks and monsters stack and the old tests still describe the game. The save stores the id (an old save without one loads as the first monster), and simtest asserts each multiplier's direction on identical set-ups rather than absolute numbers, then has the perfect bot win as every monster.
- **Portraits from the real models, off screen.** The choose screen's pictures are the game's own geometry rendered once into a small `WebGLRenderTarget` (sRGB texture, transparent clear) and read back with `readRenderTargetPixels`; GL rows start at the bottom, so flip them when writing the `ImageData`. A page with one WebGL canvas needs no second context, and the cards can never drift from the models.
- **Commentary is a rationed script over the event stream.** An `Announcer` turns sim events into lines and decides whether each may be said: a cooldown per kind of remark, a gap per voice, a priority, and a "first of its kind" flag for the first floor to fall or the first bus eaten. Without the rationing a bot-played city produced one line a second. The announcer is pure (it calls an injected `say`), so simtest feeds it events and a whole bot city and asserts who spoke, what was said and how often.
- **Browser speech is a queue you manage yourself.** `speechSynthesis` plays utterances in order, so urgent lines need `cancel()` first (and a short delay before the next `speak()` or Chrome drops it), `onend` does not always fire (a timer from the line's length moves the queue on), voices arrive late (`voiceschanged`), and device voices have no gender field, so pick by name and fall back to pitch (about 1.4 for the reporter, 0.5 for the commander). Keep one pending slot and drop it if it is stale. Captions are the fallback for no voices, no sound or a quiet room, and should show whatever the speech setting.
- **A name that is also a method breaks quietly.** Adding a `level()` method to the music object collided with its `level` property (the city number) and threw only when a menu opened and the music ducked; the desktop browser test's pause step failed and pointed at it.

## Game 108 Oathstones: per-token match rules, a gacha that calls heroes to the board (2026-10-29)

A match-3 RPG where every token keeps its own rule for being matched. What cost time, or is worth
reusing:

- **Check every window, not maximal runs.** "Every token in the line accepts it" is evaluated per
  token (`fits(t, line)` in [board.js](../../game-108/js/sim/board.js)). Most rules are hereditary
  (a valid line's sub-lines are valid), but Host (four or more) is not, and a run that is invalid as a
  whole can hold a valid stretch. So for each row and column every window of 3+ contiguous lineable
  tokens is tested, and a token in any valid window is matched. At 7×7 that is a few hundred checks
  and the bot can still score every swap.
- **Matched is not cleared.** Cascade and Crossroads tokens join a line (so their partners clear) but
  only leave under a condition (a combo ≥ 2; a valid row and a valid column through them).
  `findClears` returns both sets; the vigil wake and rubble/ice adjacency use what actually cleared.
- **Mutation-check a rules test that passes first time.** All 134 rule checks passed on the first
  run; breaking `cross` and `host` on purpose and seeing the right two checks fail is what made the
  suite trustworthy.
- **A random-move bot is strong at match-3.** Cascades do much of the work, so a greedy one-step bot
  was no better than random. Scoring the swap through the clears and falls of the stones already on
  the board (gaps stay empty; it never peeks at the refills) separated the skills. Then the good bot
  lost *more* late in the campaign: it won fast, so fewer heroes arrived and it bound fewer. A
  swift-victory crystal bonus pays a quick player in summons instead.
- **`lib/a11y.js` moves focus into every screen it sees open.** Opening two at once (the camp and a
  stage brief) landed focus on the lower one, because its MutationObserver ran after the game had
  focused the top one. Re-focus the top screen in a `queueMicrotask` after opening; it runs after the
  observer's callbacks.
- **Portraits from the real figures, without a render target.** A render target skips tone mapping
  and the sRGB conversion, so a read-back portrait comes out dark and clipped. Instead render the
  figure into a scissored corner of the main canvas and `drawImage` it into a 2D canvas in the same
  task (no `preserveDrawingBuffer` needed); the frame's normal render overwrites the corner.
- **Extruded shapes look like plastic tiles from above.** A cut gem lofted through rings of one
  outline (a pointed pavilion, a girdle, crown facets with the ring turned half a step, a small
  table) and flat shaded reads as a jewel; a winding check per facet against the axis keeps every
  face outward. Keep the shapes' silhouettes distinct at 40 px: a chamfered square drifted toward the
  round brilliant until the chamfer was cut to 0.11.
- **A steep camera hides a screen-space sky behind the ground.** Put the board on a floating island
  with nothing around it, so the sky pass shows on every side.
- **On a landscape phone move the party bar to a column on the right**, and size the swipe threshold
  from a cell's on-screen width: at 844×390 with the bar at the bottom a cell was 18 px, shorter than
  the 18 px swipe threshold, and swipes did nothing.
- **Animation time under SwiftShader is slower than real time.** At ~4 fps with frames capped at
  0.05 s, a second of waiting is a fifth of a second of animation: a screenshot after an arrival still
  showed its light beam over the hero, which looked like a washed-out material. Wait on state, or
  open the game with a large `&fast=`.

## Game 109 STARBLAZER '86: a 2D arcade shooter in the sim/view layout, balanced by a bot with a reaction time (2026-10-30)

- **`lib/a11y.js` gives every screen's heading an id of `<screen id>-title`.** A `<div id="over">` with an `<h2>` makes `id="over-title"`; a Title button with that same id lost every `getElementById` to the heading, so its click did nothing while a listener added to the real element still fired (which made it look like the event system was broken). Never give anything an id of the form `<screen>-title`; `document.querySelectorAll('#x').length` is the one-line check.
- **A perfect-information bot is not the difficulty target.** The first bot dodged everything with no reaction delay and reached wave 68 with no deaths, at any "skill". Two changes made the table useful: skill became a *reaction time* (the bot re-decides every 0.08 s at skill 1 and every 0.5 s at skill 0.2 and holds its move in between), and the table prints the average number of enemy bullets on screen per wave. That second column is what showed the real fault: enemies fired 0-6 shots a wave, because a five-way spread killed each one within a second of arriving, before its first shot. The fixes were health that grows per type with the wave, a first-shot timer of half a second to the gap rather than a full gap, and fire rate and bullet speed that ramp harder. Result: the weak bot dies around wave 9, the middle one around 16, the perfect one around 47.
- **A bot that dies to a telegraph is a bot bug.** The Overlord's death-ray killed the perfect bot on wave 15 three times in six: its danger map treated the thin warning line as mild and only fled the lit beam. A player gets a full second of warning, so the warning line now counts as nearly as dangerous as the beam. Check what *killed* the bot (print the boss state at each death) before touching the boss.
- **A test that spans a wave boundary lies.** "Nothing shoots on wave 1" and "a bonus stage is all drones" both failed because the 20 s run went on into the next wave. Tests about one wave stop counting when `G.wave` changes.
- **Enemies as functions of their age.** A Bézier swoop, a sine drop, a Space-Invaders march (a ping-pong of the group centre that drops a row at each edge), a hover and a saucer's strafe are all `pathPos(path, t)`, so a formation of 24 costs a few numbers a head, a save is small, and the planner can check every order (finite positions, starts off screen) without simulating. Only the enemies that react to the player (a dive aimed at where you are, a dart that steers) integrate; a dive swaps in a fresh Bézier aimed at the player and carries its own path clock.
- **A planner of pieces, not a table of waves.** Wave n is a few "pieces" (a line, a V, a pincer, a Galaga grid, a march, saucers, darts ...) drawn by weight from those unlocked, and the first wave to use a piece is built around it ("featured"), so the game keeps showing something new without hand-authoring 60 waves. simtest plans 60 waves over five seeds and checks every order; and plays waves 1-40 with a bot that cannot be hurt, to prove none is unwinnable or stuck. Give that bot a weapon level a player would have by then, or the boss waves take eight minutes with the starting gun.
- **Hit flashes on things that are always being hit.** Swapping the sprite for its white silhouette made the boss solid white for the whole fight, because a spread gun hits it every frame. Draw the normal sprite and lay the white one over it at partial alpha instead (0.4 for a boss, 0.85 for a small enemy).
- **Explosions that read as colourful.** Layer them: a fireball (an outer disc one step down a colour ramp and a hot core on top, walking down white-yellow-orange-red-dark as it ages), a ring that races out, debris whose colour follows the same ramp, and a few delayed secondary pops. Pick the ramp from the enemy's colour family with a one-in-three chance of a second ramp (that is where the colour variety comes from), and give bosses a rainbow ramp. Size is the dial: 0 is a fireball and nine bits of debris, 3 is seven fireballs, 110 pieces of debris and three rings. Cap particles, fireballs and rings by count, limit full-screen flashes to two a second, and make a Calm setting (also `prefers-reduced-motion`) cut shake, flashes and particles.
- **Pixel-buffer scaling.** Draw into a small buffer, scale up by an integer with smoothing off into a second canvas, and then draw that to the screen with a bilinear step down to the exact size: pixels stay sharp and uneven pixel widths at a fractional scale (2.49x) disappear. Bake the scanlines, vignette and neon frame once per size. Put the field at the top of a tall phone screen with the touch controls in the empty space below, and keep a 44 px band at the top for the back link and the pause button.
- **A dithered sky instead of bands.** Two flat colour bands left hard seams across the screen; a Bayer-dithered gradient baked once per sector looks like the hardware and has no seams. Planets are shaded discs with the same dither between three tones.
- **A bitmap font is 40 lines.** 5×7 glyphs as slash-separated rows, baked to tiny canvases per colour on demand and drawn with `drawImage`; with a drop-shadow colour option it carries the HUD, banners and score popups, and looks like the rest of the screen.
- **Sprites as mirrored left halves plus an auto-outline.** Writing only the left half (the centre column is the last character) keeps them symmetric and halves the typing; a one-pixel outline pass gives them the arcade look, a short row is padded on the left so a miscounted row still lines up, and a recolour table (a palette per sector) gives four versions of every enemy for free. Look at them in a gallery (`dev/sprites.html`) before they go into the game.
- **A high-score table is a real `<input>`.** Three initials in a `maxlength=3` field with `autocapitalize="characters"`, saved into a top-five table that ships with default scores to beat. The game's key handler already ignores key events from inputs, so typing does not fire the guns.
- **Held fire needs an edge too.** A key held down is read every frame, but a tap shorter than a frame still has to fire once: a latched edge that a simulation step consumes. The touch FIRE button sets both, and auto-fire (the phone default, with the FIRE button hidden) is just "held" forever.
- **An attract mode is the bot plus a flag.** The same `botInput` that balances the game plays behind the title; its events go to the view (for the explosions) but not to the audio or the score table, and a new demo starts when it dies.
- **A shop is just two commands.** The hangar (game-109 v1.2) is a `dock` phase in the sim, `buy(G, id)` and `launch(G)`; the UI calls them, and so does the bot (`botInput` buys and launches the moment it is docked, so every existing test that loops over `botInput` flies through boss waves with no change). The ship flies itself in and out in `updatePlayer`, the sim just waits in the shop (the open screen pauses it), and a save made in the shop reopens it. Anything that gives the player power needs a test for each effect (price, limit and the number it changes) and a look at the balance table afterwards: the upgrades took the middling bot from wave 16 to 36 until the late waves got a health and fire-rate ramp.
- **Hide the touch deck behind a sheet.** A translucent screen over a fixed deck showed the stick ring and the BOMB button through it; a `screen-open` class on `<body>` and `visibility: hidden` on the deck fixed it. Put the primary action (Launch) in a fixed header, not under a scrolling list, and start focus on an item rather than on that button so a stray Space cannot press it.
- **A companion is data plus a box.** Mira (game-109 v1.3) is a script in a plain module (`story.js`: cutscenes, a line per wave, reaction pools, quips) and two renderers: a comm strip drawn into the pixel buffer for play, and a DOM cutscene screen over a painted canvas. Nothing in the sim knows about her; `main.js` turns sim events (`wave`, `pdie`, `dockopen`) into lines. Because it is data, a test can check every line fits its box (three lines of 30 characters is the longest the strip holds): the test caught a line that wrapped to four. Ration reactive lines (one every nine seconds) or she talks over everything, and hide the strip while the game is paused or it freezes half-drawn behind a cutscene.
- **A portrait is a mirrored map plus overlays.** The static parts (hair, head, headset, uniform) are a 12-column map mirrored to 24; the eyes, brows and mouth are drawn on top from the expression, so one small function gives neutral, smile, worry, wink, open and shut mouths and a blink, baked and cached per combination. A talking animation is just alternating the open and closed mouth while the text types.
- **Speech that must start after a pause.** Opening a screen hushes the audio, which cancels speech; if a cutscene speaks its first line in the same frame, the hush kills it. `hush()` only cancels on the transition into hushed, and the cutscene hushes first and then speaks.
- **Tests play without the story.** Every harness that clicks Start Game would otherwise stop at the intro, so the browser test writes `story: 'off'` into the settings before the page loads and the story has its own group; the debug `start()` hook skips the intro unless asked.
- **Every dialog must work with the game's own keys.** The fire key (Z) was a no-op in menus and cutscenes, and Space or Enter only worked if the right button happened to be focused: a keyboard player had to reach for the mouse. In the menus map the game's keys onto the dialog (arrows and W/S move the highlight, Z/J press it, X goes back); in a cutscene intercept in the *capture* phase and `stopImmediatePropagation()`, so the press cannot also click a focused button (a double step) or register as a shot in the input layer, and ignore `e.repeat` so a held key does not race through the lines. Test it with real key presses, once with focus on the button and once with focus nowhere, and assert each press is exactly one step.


## Game 110 Doom & Doilies: an idle clicker in the sim/view layout, with a mood meter that sets the scene (2026-10-30)

- **An idle game is commands, not a stick.** The sim exposes `act(G, cmd)` for everything the player does (craft, cackle, buy, upgrade, décor, hench, scheme, visitor, ability, relocate, perk, room, idle, clock) and `step(G, dt)` for time. Buttons, keys and canvas taps push commands into one queue that `main.js` drains in order at the start of a frame, with a callback for the result (`send(cmd, ok => …)`), so a flurry of taps is never lost or merged and the UI can flash a row or beep "no" from the real outcome. The bot sends the same commands, so the balance table measures the game the buttons play.
- **A step can be 1/30 s.** There is no physics, so `STEP = 1/30` and `MAX_FRAME = 0.1` (a slow phone still keeps real time). A frame gap over two seconds (a hidden tab, a sleeping laptop) is sent as `{ t: 'idle', sec }`; on load the gap comes from `G.wall`, which a `clock` command sets once a second. Time away runs the same `step()` in ten-second chunks at the offline rate with events muted except trophies and heirlooms, and a day away (counted up to the eight-hour cap) simulates in about 40 ms.
- **The bot's dry run must undo itself.** To rank purchases the bot applies each candidate to G, reads `rates()`, and reverts it (clearing the modifier cache both times). Its shopping list is computed on a temporarily mutated G that it rolls back before returning, and the caller applies the list with `act()`, which re-checks prices, so a stale entry is just refused. The balance table that came out of it: the first draft reached the first relocation in 22 minutes; a steeper minion curve, smaller dread tiers and a legend base of 1e12 moved it to 1.6 h for an attentive player, 2.3 h casual and 7 h for one who checks in every ten minutes.
- **One meter, many outputs.** Dread drives the charm multiplier and the tribute in the sim; in the view it drives the window sky (a pixelated shader blending a stormy night with stars into a day with clouds and, below a fifth, a rainbow), the moonlight, the grade (rosy and lifted when cosy, violet with a deeper vignette when dreadful), the HUD icon, and the music, which switches from C major to A minor at the next eight-bar phrase. One number, read everywhere, makes the meter legible without a tutorial.
- **Frame the room inside what the panels leave free.** The shop is a right-hand panel on desktop, a bottom sheet on portrait phones and a narrower side panel on short landscape phones. `ui.layout()` measures the panel, HUD and dock and returns insets; the view shifts the projection with `camera.setViewOffset(w, h, (right - left) / 2, (bottom - top) / 2, w, h)`, fits the room width to the free width, and moves the tilt-shift focus band to the free area's middle. Raycasts still work, because `setFromCamera` uses the offset projection.
- **A container with `pointer-events: none` disables its children too.** The ability buttons sat inside the dock, which passes clicks through to the canvas; they inherited `none` and could never be pressed. The desktop test only cackled with the C key, so it passed; the phone test, which taps, caught it. Give interactive children `pointer-events: auto`, and test every button by pointer at least once.
- **A per-item field read from the wrong table is NaN, silently.** `MINION[id]` (a lookup built with `index`) and `MINIONS` (the array) look alike; an animation phase read `m.index` from the array, every minion's world position became NaN, and only their blob shadows (positioned by the group, not the NaN child) showed. The same slip in `minionVisible` hid the first minion until 6 charm had been made. Check `getWorldPosition()` when a sprite is missing but its shadow isn't.
- **`waitForFunction` fails on the first throw.** A predicate like `!document.querySelector(x).classList.contains('no')` throws while `x` doesn't exist yet, and Playwright rejects instead of retrying. Write predicates that return falsy for a missing element (`document.querySelector('x:not(.no)')`).
- **Place sprites from the furniture's own boxes, not from a list you keep by hand (v1.0.1).** Minion slots were scattered with a hash and a keep-out zone for the centrepiece, and a gingerbread golem's back-row slot landed inside the kitchen counter. Now `castle.js` builds the room first, then measures every mesh in its furniture, its décor (bought or not) and its windows with `Box3.setFromObject`, and `layout.js` (pure, so Node tests it) keeps a slot only if the sprite's box, grown by its bob or flutter, touches none of them; a wall portrait also claims the wall in front of it, so nothing hides it. The browser test buys everything and runs `view.clipReport()`, which intersects every real sprite with every visible mesh; it fails without the fix. Its first run caught something else: décor popped in by scaling about the room's origin, sliding outwards; recentre a group over its own footprint before animating its scale.
- **Anything that walks needs a way through, and a path in the right coordinates (v1.0.2).** Visitors walked in "from outside" by starting beyond a side wall, so they passed through it; and the start was a room-local x stored as a world x, so in any room but the first they slid across the whole castle first. Neither showed in the tests, which only checked that a visitor arrived and could be clicked. Now every side wall is built in three pieces around a doorway on the visitors' lane, with a portcullis the view raises while someone is in it, and visitors keep a room-local x that is turned into a world position every frame. `view.laneReport()` sweeps the biggest visitor's box along every room's lane against every wall and visible piece of furniture, and the browser test follows a visitor in the last room and checks it never leaves.
- **A locked look needs a locked rule (v1.1.0).** Empty rooms were dimmed, cobwebbed and greyed out in the room bar, but nothing in the sim stopped `{ t: 'room' }`, so a player could walk in and craft, levelling a room's mastery before owning anything there. Put the lock in the sim (`roomOpen()`, checked by `act`), make every route (button, keys, the overview's tap) ask it and explain the refusal, and repair saves that were made in a now-locked state on load.
- **A mini-game inside an idle game (v1.2.0).** Skull Swap's rules are a pure module whose board is plain JSON with its random state inside it, stored in `G.yard` (kept through relocation), so a board saves mid-level and replays exactly; the castle's sim only adds commands (`m3start`, `m3swap`) and events, and pays rewards in charm and gold so the mini-game feeds the main loop. The board view plays back each swap's steps (swap, clear, fall, shuffle) and, when the queue empties, compares itself with the sim and resyncs if they differ. Two traps: the bot can send swaps faster than the board animates, and under SwiftShader twenty moves of animation outlast a minute, so the board's animation speed follows the debug `fast` factor; and a cemetery fence of a hundred separate meshes was enough to slow the software renderer until a visitor test timed out, so repeated bars are one `InstancedMesh`. Goals are fitted to what a bot without look-ahead reaches per move, as a share that rises by level.
- **Coplanar foundations z-fight.** The stone plinth under the rooms had its top exactly at floor level; in the gloomy first lair it was invisible, in the bright Caldera it striped the floor. Sink anything that sits under a floor a few centimetres below it.

## Game 111 NEON ARCANA: a block-placement puzzle in the sim/view layout, neon under bloom (2026-10-30)

- **A placement puzzle is commands with no clock.** `act(G, { t: 'place', i, x, y })` and `{ t: 'power', p, ... }` resolve at once (fill, clear rows and columns, score, rekindle, seed the next omens, redeal an empty hand, check stuck or over) and push events; `step()` only counts play time. Drags, tap-tap, keys, the gamepad, the bot and both test harnesses all go through `act()`, so the whole game is testable in Node and a seed replays exactly.
- **Stuck is not over.** When nothing in the hand fits but a power could help (Transmute always could; Turn only if a turned glyph fits), the sim sets `G.stuck` and waits; the reading ends only when no rescue is left, or the player concedes. Without this a player with sparks in hand lost to a board they could still save.
- **A deal with mercy, measured.** Each hand is redrawn up to `mercyFor(arc)` times looking for one where every glyph fits somewhere; mercy falls from 10 tries to 1 as the arcana climb. `simtest.mjs` checks the effect on 300 crowded boards rather than trusting the loop.
- **Progress that survives a failed run.** The arcana are rekindled in order and stay lit, and the light a reading had gathered toward the next card is kept as embers. Without embers the bot table showed a wall: a careless bot reached the 13th card in its first reading and then needed 50 more readings, because each late goal had to be met from an empty board in one go. With embers every reading counts and it finishes in about 11.
- **Planted obstacles must not complete a line.** Blight is a filled cell; planted on a row with seven filled cells it would make a full line of glyphs that nothing clears until the next move. `plantBlight` skips cells whose row or column already has seven, and the simtest checks 200 seeds at the last arcanum.
- **Neon under bloom wants no tone mapping.** ACES desaturates bright colours toward white, so every glyph read as white glass. `NoToneMapping`, edge intensities a little over 1, and a bloom threshold of about 0.6 keep magenta magenta. The colour stays in the edge and the rune; the glass body stays dark, so the threshold catches only the neon.
- **Find the white-out by switching effects off.** Three effects each washed the screen white under bloom: god rays scaled to the whole screen, a shock ring as thick as a fifth of its radius, and line beams with a wide soft term. Each looked fine without bloom. `play.mjs` with one effect's material hidden at a time (`material.visible = false`) found each in a minute; the fixes were narrower profiles and lower intensities, not a lower bloom.
- **Floating words need normal blending.** Additive text can't draw its dark outline, so under bloom "+300" became a white smear. The words use normal blending with a dark stroke and a coloured fill.
- **A drag on touch floats the piece above the finger.** The dragged glyph's centre sits `h/2 + 1.1` cells above the touch point, its anchor is `round(centre − size/2)`, and a ghost shows where it will land plus the rows and columns it would clear. Under a mouse the piece is centred on the pointer. The browser test drags with real CDP touches and checks the glyph lands where the ghost said.
- **A test that presses a key the frame play resumes loses it, on purpose.** The loop flushes queued presses on the frame play resumes from a menu (game-078), so a key the test sends in the same frame as the click that closed the pause is dropped. The test's `ready()` waits for two frames after the state is playable; a person can't press that fast.
