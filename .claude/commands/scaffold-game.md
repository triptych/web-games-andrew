# scaffold-game

Scaffold a new web game in the web-games-andrew project.

**Arguments:** `$ARGUMENTS`

Parse the arguments as: `[game-folder] [game-title] [genre/concept]`

Examples:
- `/scaffold-game game-009 "Breakout Royale" "brick breaker with powerups"`
- `/scaffold-game "Asteroid Miner" "mining rocks in space"`
- `/scaffold-game` (auto-detect next number, then ask for title/concept)

---

## Step 1: Determine game info

From `$ARGUMENTS`:
- **Game folder**: First token starting with `game-` (e.g. `game-009`). If not given, list existing `game-NNN` folders in `c:\Users\andre\OneDrive\Documents\web-games-andrew\` and use the next number.
- **Game title**: The quoted string after the folder, or the first quoted string if no folder was given.
- **Concept**: Everything after the title, or ask the user if missing. Keep it to 1–2 sentences.
- **Engine**: If the arguments contain `phaser` or `phaser4` (case-insensitive), use Phaser. If they contain `kaplay`, use Kaplay. Otherwise, ask the user: "Which engine? **Kaplay** (default) or **Phaser 4**?"

Set these variables for use below:
- `GAME_FOLDER` — e.g. `game-009`
- `GAME_TITLE` — e.g. `Breakout Royale`
- `GAME_CONCEPT` — e.g. `A brick breaker game with powerups and boss levels.`
- `GAME_NUMBER` — numeric part, e.g. `009`
- `GAME_DIR` — `c:\Users\andre\OneDrive\Documents\web-games-andrew\GAME_FOLDER`
- `ENGINE` — `kaplay` or `phaser`

---

## Step 2: Create all scaffold files

Create each file below. Substitute `GAME_TITLE`, `GAME_CONCEPT`, `GAME_FOLDER`, `GAME_NUMBER` where indicated.

**If ENGINE = `kaplay`**: use the Kaplay templates (Sections 2A).
**If ENGINE = `phaser`**: use the Phaser templates (Section 2B) instead — skip the Kaplay templates entirely.

---

# 2A — Kaplay scaffold (skip if ENGINE = phaser)

---

### File: `GAME_DIR/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GAME_TITLE</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #000;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100vw;
            height: 100vh;
        }
        canvas { display: block; }
    </style>
</head>
<body>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

---

### File: `GAME_DIR/js/config.js`

```js
// ============================================================
// GAME_TITLE — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Color palette ---
export const COLORS = {
    bg:       [10, 10, 20],
    text:     [220, 220, 240],
    accent:   [100, 200, 255],
    danger:   [255, 80, 80],
    success:  [80, 220, 100],
    gold:     [255, 215, 0],
};

// --- TODO: Add game-specific constants below ---
// export const PLAYER_SPEED = 200;
// export const ENEMY_DEFS = { ... };
```

---

### File: `GAME_DIR/js/events.js`

```js
/**
 * EventBus — lightweight pub/sub for cross-module communication.
 *
 * Usage:
 *   import { events } from './events.js';
 *
 *   const off = events.on('someEvent', (data) => { ... });
 *   off();                        // unsubscribe
 *   events.emit('someEvent', data);
 *   events.clearAll();            // call in k.onSceneLeave()
 *
 * Event catalog:
 *   scoreChanged(newScore)
 *   livesChanged(newLives)
 *   gameOver()
 *   gameWon()
 *   TODO: add game-specific events here
 */
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

    clearAll() {
        this._listeners.clear();
    }
}

export const events = new EventBus();
```

---

### File: `GAME_DIR/js/state.js`

```js
import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES } from './config.js';

/**
 * Global game state.
 * Setters auto-emit events so UI stays in sync.
 * Call state.reset() on game restart.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._score      = STARTING_SCORE;
        this._lives      = STARTING_LIVES;
        this._isGameOver = false;
        this._isPaused   = false;

        // TODO: add game-specific state properties here
    }

    // --- Score ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }

    addScore(n) { this.score += n; }

    // --- Lives ---
    get lives() { return this._lives; }
    set lives(val) {
        this._lives = Math.max(0, val);
        events.emit('livesChanged', this._lives);
        if (this._lives <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }

    loseLife() { this.lives -= 1; }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
}

export const state = new GameState();
```

---

### File: `GAME_DIR/js/sounds.js`

```js
/**
 * sounds.js — Web Audio API procedural sound effects.
 * All sounds require a prior user interaction (browser policy).
 * Call initAudio() on the first user gesture (click / key press).
 */

let audioCtx   = null;
let masterGain = null;
let _enabled   = true;

export function initAudio() {
    if (audioCtx) return;
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.25;
    masterGain.connect(audioCtx.destination);
}

export function setSoundEnabled(val) { _enabled = val; }
export function isSoundEnabled()     { return _enabled; }
export function toggleSound()        { _enabled = !_enabled; return _enabled; }

// --- Internal helpers ---

function _osc(type, freq, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    osc.type            = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
}

function _sweep(type, freqStart, freqEnd, duration, vol = 0.3, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
}

function _noise(duration, vol = 0.15, startDelay = 0) {
    if (!_enabled || !audioCtx) return;
    const bufSize = Math.floor(audioCtx.sampleRate * duration);
    const buf     = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const src  = audioCtx.createBufferSource();
    src.buffer = buf;
    const gain = audioCtx.createGain();
    const t    = audioCtx.currentTime + startDelay;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(gain);
    gain.connect(masterGain);
    src.start(t);
}

// --- Sound effects ---
// TODO: replace / extend these stubs with game-appropriate sounds

export function playUiClick() {
    _osc('sine', 660, 0.06, 0.15);
}

export function playSuccess() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _osc('sine', f, 0.15, 0.2, i * 0.08));
}

export function playFailure() {
    _sweep('sawtooth', 400, 80, 0.5, 0.3);
    _noise(0.3, 0.1, 0.1);
}

export function playHit() {
    _sweep('square', 300, 80, 0.1, 0.25);
}

export function playPickup() {
    _osc('sine', 880, 0.08, 0.2);
    _osc('sine', 1100, 0.1, 0.15, 0.07);
}

export function playGameOver() {
    _sweep('sawtooth', 400, 50, 0.8, 0.4);
    _noise(0.5, 0.15, 0.2);
}
```

---

### File: `GAME_DIR/js/ui.js`

```js
/**
 * ui.js — HUD and in-game UI.
 * Call initUI(k) once per scene.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

let k;
let scoreLabel, livesLabel;

export function initUI(kaplay) {
    k = kaplay;
    _buildHUD();
    _subscribeEvents();
}

function _buildHUD() {
    // Score — top-left
    scoreLabel = k.add([
        k.pos(12, 10),
        k.text(`SCORE  ${state.score}`, { size: 16 }),
        k.color(...COLORS.text),
        k.anchor('topleft'),
        k.z(100),
    ]);

    // Lives — top-right
    livesLabel = k.add([
        k.pos(GAME_WIDTH - 12, 10),
        k.text(`LIVES  ${state.lives}`, { size: 16 }),
        k.color(...COLORS.danger),
        k.anchor('topright'),
        k.z(100),
    ]);

    // TODO: add more HUD elements as needed
}

function _subscribeEvents() {
    const offs = [
        events.on('scoreChanged', (v) => {
            scoreLabel.text = `SCORE  ${v}`;
        }),
        events.on('livesChanged', (v) => {
            livesLabel.text = `LIVES  ${v}`;
        }),
        events.on('gameOver', () => {
            _showGameOver();
        }),
    ];

    k.onSceneLeave(() => offs.forEach(off => off()));
}

function _showGameOver() {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    // Dim overlay
    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(0, 0, 0),
        k.opacity(0.6),
        k.z(200),
    ]);

    k.add([
        k.pos(CX, CY - 40),
        k.text('GAME OVER', { size: 56 }),
        k.color(...COLORS.danger),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 30),
        k.text(`Final Score: ${state.score}`, { size: 24 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.z(201),
    ]);

    k.add([
        k.pos(CX, CY + 80),
        k.text('Press R to restart  |  ESC for menu', { size: 14 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(201),
    ]);
}
```

---

### File: `GAME_DIR/js/main.js`

```js
/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash' — Title screen, waits for any key or click
 *   'game'   — Main gameplay scene
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI }    from './ui.js';
import { initAudio, playUiClick } from './sounds.js';
// TODO: import your game-specific modules here
// import { initPlayer } from './player.js';

// ============================================================
// KAPLAY API GOTCHAS (read before adding entities)
// ============================================================
//
// 1. POSITION — entity.pos is a getter/setter, NOT a plain field.
//    Mutating the returned Vec2 has NO visual effect:
//      BAD:  entity.pos.x = 100;          // silently broken
//      GOOD: entity.pos = k.vec2(100, y); // correct
//
// 2. OPACITY — setting entity.opacity only works if k.opacity()
//    was declared in the k.add([...]) component list at creation:
//      BAD:  k.add([k.pos(x,y), k.rect(w,h)])  → entity.opacity = 0.5; // ignored
//      GOOD: k.add([k.pos(x,y), k.rect(w,h), k.opacity(1)]) → entity.opacity = 0.5; // works
//
// 3. TEXT — square brackets in k.text() strings are parsed as style tags.
//    Use parentheses instead:
//      BAD:  k.text('[Space] to fire')    // "Styled text error: unclosed tags"
//      GOOD: k.text('(Space) to fire')
//
// 4. COLOR — k.rgba() does not exist. Use k.color(r,g,b,a) or k.color(r,g,b).
//    For outline/fill params use k.rgb(r,g,b).
//
// ============================================================
// Kaplay init
// ============================================================

const k = kaplay({
    width:        GAME_WIDTH,
    height:       GAME_HEIGHT,
    background:   COLORS.bg,
    letterbox:    true,
    crisp:        true,
    pixelDensity: Math.min(window.devicePixelRatio, 2),
});

// ============================================================
// SCENE: splash
// ============================================================

k.scene('splash', () => {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([
        k.pos(0, 0),
        k.rect(GAME_WIDTH, GAME_HEIGHT),
        k.color(...COLORS.bg),
        k.z(0),
    ]);

    // Title
    k.add([
        k.pos(CX, CY - 100),
        k.text('GAME_TITLE', { size: 64 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    // Blinking start prompt
    // NOTE: k.opacity(1) MUST be included — setting entity.opacity only works
    // if the opacity component was declared at creation time.
    const prompt = k.add([
        k.pos(CX, CY + 40),
        k.text('PRESS ANY KEY OR CLICK TO START', { size: 16 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.opacity(1),   // required for prompt.opacity = ... to work below
        k.z(1),
    ]);
    let blinkTimer = 0;
    prompt.onUpdate(() => {
        blinkTimer += k.dt();
        prompt.opacity = (Math.sin(blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
    });

    // Controls hint
    k.add([
        k.pos(CX, CY + 100),
        k.text('TODO: add controls hint here', { size: 12 }),
        k.color(80, 80, 120),
        k.anchor('center'),
        k.z(1),
    ]);

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 1', { size: 10 }),
        k.color(50, 50, 80),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Start on any key or click
    let started = false;

    function goToGame() {
        if (started) return;
        started = true;
        initAudio();
        playUiClick();
        document.removeEventListener('keydown', onAnyKey);
        k.go('game');
    }

    function onAnyKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        goToGame();
    }

    document.addEventListener('keydown', onAnyKey);
    k.onClick(goToGame);
    k.onSceneLeave(() => document.removeEventListener('keydown', onAnyKey));
});

// ============================================================
// SCENE: game
// ============================================================

k.scene('game', () => {
    state.reset();

    initUI(k);

    // TODO: call your game-specific init functions here
    // initPlayer(k);
    // initEnemies(k);

    // Key bindings
    k.onKeyPress('r', () => {
        events.clearAll();
        k.go('game');
    });

    k.onKeyPress('p', () => {
        state.isPaused = !state.isPaused;
    });

    k.onKeyPress('escape', () => {
        events.clearAll();
        k.go('splash');
    });

    k.onSceneLeave(() => {
        events.clearAll();
    });
});

// ============================================================
// Start
// ============================================================

k.go('splash');
```

---

### File: `GAME_DIR/game-plan.md`

Write a proper game-plan document. Use the concept and title to fill in meaningful content. Follow this structure — expand each section with specifics based on GAME_CONCEPT:

```markdown
# GAME_TITLE

**Genre:** [derive from concept]
**Engine:** Kaplay v4000 (ES6 modules)   ← use "Phaser 4.0.0" here if ENGINE = phaser
**Target Resolution:** 1280 × 720
**Status:** Planning — Phase 1

---

## Concept

GAME_CONCEPT

[2–3 more sentences expanding on the game idea, tone, and target experience.]

---

## Core Mechanics

[List 3–6 core mechanics with brief descriptions. Each mechanic is a subsection.]

### 1. [Mechanic Name]
...

### 2. [Mechanic Name]
...

---

## Game Loop

[Describe the primary game loop: what does a "round" or "session" look like from start to finish?]

---

## Player Controls

| Action | Key(s) |
|--------|--------|
| Move   | WASD / Arrow keys |
| Action | Space / Left Click |
| Pause  | P |
| Restart | R |
| Menu   | Escape |

[Adjust as needed for the game type.]

---

## Progression / Difficulty

[How does the game get harder over time? Waves, levels, score thresholds, etc.]

---

## UI / HUD

[Describe what's shown on screen: score, lives, health bars, resource counters, etc.]

---

## Sound Design

[List the key sound effects needed. Use Web Audio API — no file assets.]

| Sound | Trigger | Style |
|-------|---------|-------|
| UI Click | Button press | Short sine blip |
| [Add more] | ... | ... |

---

## Phases

### Phase 1 — Foundation (current)
- [x] Scaffold: index.html, config, events, state, sounds, ui, main
- [ ] TODO: first gameplay feature

### Phase 2 — [Name]
- [ ] TODO

### Phase 3 — [Name]
- [ ] TODO

---

## Event Catalog

| Event | Payload | Emitted by | Consumed by |
|-------|---------|-----------|-------------|
| `scoreChanged` | newScore | state | ui |
| `livesChanged` | newLives | state | ui |
| `gameOver`     | —        | state | ui |

---

## Module Overview

*(Kaplay)*

| File | Responsibility |
|------|---------------|
| `main.js`   | Kaplay init, scene definitions |
| `config.js` | Constants and definitions |
| `events.js` | EventBus singleton |
| `state.js`  | GameState singleton |
| `sounds.js` | Web Audio API sound effects |
| `ui.js`     | HUD rendering and game-over screen |

*(Phaser — replace above table if ENGINE = phaser)*

| File | Responsibility |
|------|---------------|
| `main.js`   | Phaser.Game init, scene boot |
| `config.js` | Constants and definitions |
| `events.js` | EventBus singleton |
| `state.js`  | GameState singleton |
| `sounds.js` | Web Audio API sound effects |
| `SplashScene.js` | Title screen scene |
| `GameScene.js`   | Main gameplay scene |
| `UIScene.js`     | HUD overlay scene (runs in parallel) |

---

## Open Questions

- [ ] TODO: list design decisions still to be made

---

## Changelog

### Phase 1 — Scaffold (YYYY-MM-DD)
- Initial scaffold: index.html, config, events, state, sounds, ui, main
```

Fill in today's date where `YYYY-MM-DD` appears.

---

# 2B — Phaser scaffold (skip if ENGINE = kaplay)

Create the following files when ENGINE = `phaser`. The shared `events.js`, `state.js`, `sounds.js`, and `config.js` are identical to the Kaplay versions above — create them unchanged. Only the files below differ.

---

### File: `GAME_DIR/index.html` (Phaser version)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GAME_TITLE</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #000;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 100vw;
            height: 100vh;
        }
        canvas { display: block; }
    </style>
</head>
<body>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

> **Why no `<script src>` for Phaser?** The `../../lib/phaser/phaser.js` path works on Live Server (which roots at the repo) but 404s on GitHub Pages (which roots at the game subfolder, making `../../` escape the repo). Use the ESM import in `main.js` instead — it resolves correctly in both environments.

---

### File: `GAME_DIR/js/main.js` (Phaser version)

```js
/**
 * main.js — Phaser 4 game entry point.
 *
 * Scenes (loaded in order):
 *   SplashScene — Title / start screen
 *   GameScene   — Main gameplay
 *   UIScene     — HUD overlay (runs in parallel with GameScene)
 *
 * Library: ../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js (ESM build)
 * Imported as a module and assigned to window.Phaser so scene classes
 * (which extend Phaser.Scene) can reference the global before their
 * own module code runs.
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
window.Phaser = Phaser;

import { SplashScene } from './SplashScene.js';
import { GameScene }   from './GameScene.js';
import { UIScene }     from './UIScene.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

// Helper: convert [r,g,b] array to Phaser hex integer 0xRRGGBB
function rgb(arr) {
    return (arr[0] << 16) | (arr[1] << 8) | arr[2];
}

const config = {
    type: Phaser.AUTO,
    width:  GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: rgb(COLORS.bg),
    scale: {
        mode:            Phaser.Scale.FIT,
        autoCenter:      Phaser.Scale.CENTER_BOTH,
    },
    scene: [SplashScene, GameScene, UIScene],
};

new Phaser.Game(config);
```

---

### File: `GAME_DIR/js/SplashScene.js`

```js
/**
 * SplashScene — Title screen.
 * Waits for any key or pointer click, then starts GameScene + UIScene.
 */

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio, playUiClick } from './sounds.js';

function rgb(arr) { return (arr[0] << 16) | (arr[1] << 8) | arr[2]; }
function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class SplashScene extends Phaser.Scene {
    constructor() { super({ key: 'SplashScene' }); }

    create() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Title
        this.add.text(CX, CY - 100, 'GAME_TITLE', {
            fontSize: '64px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Blinking prompt
        this._prompt = this.add.text(CX, CY + 40, 'PRESS ANY KEY OR CLICK TO START', {
            fontSize: '16px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Controls hint
        this.add.text(CX, CY + 100, 'TODO: add controls hint here', {
            fontSize: '12px',
            color: '#505078',
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        // Version tag
        this.add.text(GAME_WIDTH - 10, GAME_HEIGHT - 10, 'Phase 1', {
            fontSize: '10px',
            color: '#323250',
            fontFamily: 'monospace',
        }).setOrigin(1, 1);

        // Input
        this._started = false;
        this.input.keyboard.on('keydown', (e) => {
            if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
            this._goToGame();
        });
        this.input.on('pointerdown', () => this._goToGame());

        // Blink timer
        this._blinkTimer = 0;
    }

    update(time, delta) {
        this._blinkTimer += delta / 1000;
        const alpha = (Math.sin(this._blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
        this._prompt.setAlpha(alpha);
    }

    _goToGame() {
        if (this._started) return;
        this._started = true;
        initAudio();
        playUiClick();
        this.scene.start('GameScene');
        this.scene.start('UIScene');
        this.scene.stop('SplashScene');
    }
}
```

---

### File: `GAME_DIR/js/GameScene.js`

```js
/**
 * GameScene — Main gameplay scene.
 *
 * Communicates with UIScene via the shared EventBus (events.js).
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { initAudio } from './sounds.js';

// TODO: import game-specific modules here
// import { initPlayer } from './player.js';

export class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'GameScene' }); }

    create() {
        state.reset();

        // TODO: initialise game objects, physics, etc.
        // initPlayer(this);

        // Key bindings
        this._keys = this.input.keyboard.addKeys({
            restart: Phaser.Input.Keyboard.KeyCodes.R,
            pause:   Phaser.Input.Keyboard.KeyCodes.P,
            escape:  Phaser.Input.Keyboard.KeyCodes.ESC,
        });

        // Game-over handler
        this._offGameOver = events.on('gameOver', () => this._handleGameOver());
    }

    update(time, delta) {
        if (state.isGameOver) return;
        if (state.isPaused)   return;

        const dt = delta / 1000; // seconds

        // TODO: update game objects here

        // Key handling
        if (Phaser.Input.Keyboard.JustDown(this._keys.restart)) {
            this._restart();
        }
        if (Phaser.Input.Keyboard.JustDown(this._keys.pause)) {
            state.isPaused = !state.isPaused;
        }
        if (Phaser.Input.Keyboard.JustDown(this._keys.escape)) {
            this._goToMenu();
        }
    }

    _handleGameOver() {
        // GameScene freezes; UIScene shows the overlay
    }

    _restart() {
        events.clearAll();
        this.scene.restart();
        this.scene.get('UIScene').scene.restart();
    }

    _goToMenu() {
        events.clearAll();
        this.scene.stop('UIScene');
        this.scene.start('SplashScene');
    }

    shutdown() {
        if (this._offGameOver) this._offGameOver();
    }
}
```

---

### File: `GAME_DIR/js/UIScene.js`

```js
/**
 * UIScene — HUD overlay, runs in parallel with GameScene.
 * Listens to EventBus for state changes and updates labels.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';

function hex(arr) { return '#' + arr.map(v => v.toString(16).padStart(2, '0')).join(''); }

export class UIScene extends Phaser.Scene {
    constructor() { super({ key: 'UIScene' }); }

    create() {
        // Score — top-left
        this._scoreLabel = this.add.text(12, 10, `SCORE  ${state.score}`, {
            fontSize: '16px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0, 0);

        // Lives — top-right
        this._livesLabel = this.add.text(GAME_WIDTH - 12, 10, `LIVES  ${state.lives}`, {
            fontSize: '16px',
            color: hex(COLORS.danger),
            fontFamily: 'monospace',
        }).setOrigin(1, 0);

        // TODO: add more HUD elements as needed

        // Subscribe to state events
        this._offs = [
            events.on('scoreChanged', (v) => { this._scoreLabel.setText(`SCORE  ${v}`); }),
            events.on('livesChanged', (v) => { this._livesLabel.setText(`LIVES  ${v}`); }),
            events.on('gameOver',     ()  => { this._showGameOver(); }),
        ];
    }

    _showGameOver() {
        const CX = GAME_WIDTH  / 2;
        const CY = GAME_HEIGHT / 2;

        // Dim overlay
        this.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);

        this.add.text(CX, CY - 40, 'GAME OVER', {
            fontSize: '56px',
            color: hex(COLORS.danger),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(CX, CY + 30, `Final Score: ${state.score}`, {
            fontSize: '24px',
            color: hex(COLORS.text),
            fontFamily: 'monospace',
        }).setOrigin(0.5);

        this.add.text(CX, CY + 80, 'Press R to restart  |  ESC for menu', {
            fontSize: '14px',
            color: hex(COLORS.accent),
            fontFamily: 'monospace',
        }).setOrigin(0.5);
    }

    shutdown() {
        this._offs.forEach(off => off());
    }
}
```

---

## Step 3: Update the launcher

Read `c:\Users\andre\OneDrive\Documents\web-games-andrew\js\gamedata.js` and add an entry for the new game. Append it to the `games` array before the closing `];`. Use a suitable emoji icon and appropriate tags based on the concept.

Template:
```js
{
    id: 'GAME_FOLDER',
    title: 'GAME_TITLE',
    description: 'GAME_CONCEPT',
    icon: '[pick a fitting emoji]',
    folder: 'GAME_FOLDER',
    cssClass: '[kebab-case of game title]',
    tags: [
        { emoji: '[emoji]', label: '[genre]' },
        { emoji: '⌨️', label: 'Keyboard' },
        { emoji: '[emoji]', label: '[style]' }
    ]
},
```

---

## Step 4: Confirm

After creating all files, report:
1. List every file created (with full path).
2. State which engine was used (Kaplay or Phaser 4).
3. Note any TODOs the user should address next (e.g., updating the `game-plan.md` phases, adding player/enemy modules).
4. Tell the user to open `GAME_DIR/index.html` in a browser to verify the splash screen loads.
   - **Phaser note**: Phaser is loaded as an ES module — opening `index.html` directly via `file://` will fail with CORS errors. Serve via VS Code Live Server or `npx serve .` from the repo root.
