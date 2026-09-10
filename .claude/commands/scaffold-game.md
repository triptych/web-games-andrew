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
- **Engine**: If the arguments contain `phaser` or `phaser4` (case-insensitive), use Phaser. If they contain `three`, `threejs`, or `three.js`, use Three.js. If they contain `kaplay`, use Kaplay. If they contain `vanilla 3d`, `software 3d`, `software3d`, `no engine`, `from scratch`, or `own renderer`, use Vanilla 3D. Otherwise, ask the user: "Which engine? **Kaplay** (default), **Phaser 4**, **Three.js**, or **Vanilla 3D** (hand-written software renderer, no library)?"

> Note: **plain "vanilla" alone does not mean Vanilla 3D.** Several 2D games here
> (game-007, game-033, game-034) are "vanilla JS" with no 3D at all. If the user
> says "vanilla" without indicating 3D, ask what they mean — a 2D vanilla game
> needs no scaffold section, just DOM/Canvas2D and the shared
> `events.js`/`state.js`/`sounds.js`.
>
> Note: **raycasting is a different technique** and Section 2D does not implement
> it. A DOOM/Wolfenstein-style column caster with a palette framebuffer is
> `game-031/js/engine/` — copy from there instead.

Set these variables for use below:
- `GAME_FOLDER` — e.g. `game-009`
- `GAME_TITLE` — e.g. `Breakout Royale`
- `GAME_CONCEPT` — e.g. `A brick breaker game with powerups and boss levels.`
- `GAME_NUMBER` — numeric part, e.g. `009`
- `GAME_DIR` — `c:\Users\andre\OneDrive\Documents\web-games-andrew\GAME_FOLDER`
- `ENGINE` — `kaplay`, `phaser`, `three`, or `vanilla3d`

### Choosing between Three.js and Vanilla 3D

Both do 3D, but they are not interchangeable. If the user asks for 3D without specifying, ask which they want using this table:

| | **Three.js** (Section 2C) | **Vanilla 3D** (Section 2D) |
|---|---|---|
| Rendering | GPU via WebGL | CPU: JS rasterizes triangles into Canvas2D |
| Budget | ~1M+ triangles | ~20k triangles at 60 fps |
| Get | Lights, shadows, materials, textures, post-processing, glTF loading | Flat-shaded polygons only |
| Best for | Anything visually rich; the default choice for 3D | The look/constraint *is* the point — PS1-era low-poly, "no libraries" as a design goal, teaching how a pipeline works |
| Cost | A CDN dependency | ~600 lines of engine you own and must debug |

**Default to Three.js for 3D.** Only pick Vanilla 3D when writing the renderer is itself the goal. Say so plainly if the user seems to want Vanilla 3D for a visually ambitious game — they will hit the triangle ceiling.

---

## Step 2: Create all scaffold files

Create each file below. Substitute `GAME_TITLE`, `GAME_CONCEPT`, `GAME_FOLDER`, `GAME_NUMBER` where indicated.

**If ENGINE = `kaplay`**: use the Kaplay templates (Section 2A).
**If ENGINE = `phaser`**: use the Phaser templates (Section 2B) instead — skip the Kaplay templates entirely.
**If ENGINE = `three`**: use the Three.js templates (Section 2C) instead — skip the other engine sections entirely.
**If ENGINE = `vanilla3d`**: use the Vanilla 3D templates (Section 2D) instead — skip the other engine sections entirely.

> ⚠️ **Write `index.html` with the Write tool and nothing else.** Never build it by
> shell redirection/append, and never dictate into it. A stray character before
> `<!DOCTYPE html>` makes the browser render it as page text — and because
> browsers hoist pre-DOCTYPE text out of `<body>`, it will *not* show up if you
> check `document.body.childNodes`. This actually happened to game-036 and was
> misdiagnosed as a screenshot artifact. Verify with:
> ```bash
> head -c 20 GAME_DIR/index.html          # must start with <!DOCTYPE html>
> ```

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
    <a href="../index.html" style="position:fixed;top:8px;left:8px;z-index:99999;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#fff;background:rgba(0,0,0,0.55);padding:6px 12px;border-radius:6px;text-decoration:none;pointer-events:auto;border:1px solid rgba(255,255,255,0.25);" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.55)'">← Games</a>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

> **Back-to-launcher link:** every game must include this. It must be the first element inside `<body>` (before the canvas/overlay) so its `z-index` and `pointer-events` win. Path is `../index.html` — one level up from `GAME_DIR/` reaches the repo root. See [docs/generic/learnings.md](../../docs/generic/learnings.md#5-back-to-launcher-link-️-required-all-games).

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
**Engine:** Kaplay v4000 (ES6 modules)   ← use "Phaser 4.0.0" if ENGINE = phaser, "three.js r165" if ENGINE = three, or "None — custom software 3D rasterizer on Canvas2D" if ENGINE = vanilla3d
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

*(Three.js — replace above table if ENGINE = three)*

| File | Responsibility |
|------|---------------|
| `main.js`   | Game state machine, animate() loop, module orchestration |
| `scene.js`  | Renderer, scene, camera, clock — exports live bindings |
| `config.js` | Constants and definitions |
| `events.js` | EventBus singleton |
| `state.js`  | GameState singleton |
| `sounds.js` | Web Audio API sound effects |
| `ui.js`     | DOM HUD bindings and game-over overlay |

*(Vanilla 3D — replace above table if ENGINE = vanilla3d)*

| File | Responsibility |
|------|---------------|
| `main.js`             | Boot, seed, Pointer Lock flow, frame loop |
| `config.js`           | Constants (render distances, fog, player, palette) |
| `events.js`           | EventBus singleton |
| `state.js`            | GameState singleton |
| `sounds.js`           | Web Audio API sound effects |
| `ui.js`               | DOM HUD bindings |
| `engine/math.js`      | Vec3 / Mat4 |
| `engine/mesh.js`      | Mesh format, primitives, winding assertion |
| `engine/renderer.js`  | Software triangle rasterizer |
| `engine/camera.js`    | First-person camera + mouse-look |
| `world/noise.js`      | Seeded PRNG + value noise |
| `game/player.js`      | Movement and ground collision |

*(Vanilla 3D only — add this section, it's the part of the project with real engineering in it)*

## Renderer contract

Six rules every mesh must honour. See
[docs/software3d/software3d-api.md](../docs/software3d/software3d-api.md).

1. Wind triangles CCW viewed from outside; assert numerically, never by eye.
2. Clip against the near plane; never reject (or the ground under the player
   develops a hole).
3. Fill *and* stroke every triangle (Canvas2D seam fix).
4. Half-Lambert lighting, not `max(dot,0)`.
5. Painter's algorithm can't do interiors — render those exclusively.
6. `FOG_NEAR < FOG_FAR <= DRAW_DISTANCE < RENDER_FAR`.

Deliberately not implemented: z-buffer, texturing, per-pixel lighting, clipping
against the side planes. Triangle budget is ~20k/frame at 60 fps.

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
    <a href="../index.html" style="position:fixed;top:8px;left:8px;z-index:99999;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#fff;background:rgba(0,0,0,0.55);padding:6px 12px;border-radius:6px;text-decoration:none;pointer-events:auto;border:1px solid rgba(255,255,255,0.25);" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.55)'">← Games</a>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

> **Back-to-launcher link:** required on every game (see Section 2A note above) — first element in `<body>`, path `../index.html`.

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
 */

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';

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

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
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

import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
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
import * as Phaser from '../../lib/phaser/phaser-4.0.0/dist/phaser.esm.js';
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

# 2C — Three.js scaffold (skip if ENGINE = kaplay or phaser)

Create the following files when ENGINE = `three`. The shared `events.js` and `state.js` are identical to the Kaplay versions in Section 2A — create them unchanged. The `sounds.js` is also identical to the Kaplay version. Only the files below differ.

Three.js is loaded **from a CDN via an import map**, not from `lib/`. The reference version is **three r165**.

---

### File: `GAME_DIR/index.html` (Three.js version)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>GAME_TITLE</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #000;
            overflow: hidden;
            width: 100vw;
            height: 100vh;
            font-family: 'Courier New', monospace;
        }
        canvas { display: block; }

        /* HUD overlay — drawn over the WebGL canvas */
        #ui-overlay {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none;
            color: #dcdcf0;
        }
        #hud {
            display: flex;
            justify-content: space-between;
            padding: 12px 20px;
            font-size: 16px;
            letter-spacing: 2px;
            text-transform: uppercase;
        }
        #message {
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
        }
        #message h1 {
            font-size: 52px;
            letter-spacing: 6px;
            text-transform: uppercase;
            margin-bottom: 16px;
            color: #64c8ff;
        }
        #message p { font-size: 16px; margin-top: 6px; letter-spacing: 2px; }
        .hidden { display: none !important; }
    </style>
</head>
<body>
    <a href="../index.html" style="position:fixed;top:8px;left:8px;z-index:99999;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#fff;background:rgba(0,0,0,0.55);padding:6px 12px;border-radius:6px;text-decoration:none;pointer-events:auto;border:1px solid rgba(255,255,255,0.25);" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.55)'">← Games</a>
    <div id="ui-overlay">
        <div id="hud">
            <div><div>SCORE</div><div id="score-val">0</div></div>
            <div><div>LIVES</div><div id="lives-val">3</div></div>
        </div>
        <div id="message">
            <h1>GAME_TITLE</h1>
            <p>PRESS ANY KEY OR CLICK TO START</p>
            <p style="opacity:0.6">TODO: add controls hint here</p>
        </div>
    </div>

    <script type="importmap">
    {
        "imports": {
            "three": "https://unpkg.com/three@0.165.0/build/three.module.js",
            "three/addons/": "https://unpkg.com/three@0.165.0/examples/jsm/"
        }
    }
    </script>
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

> **Why an import map?** Lets every JS module write `import * as THREE from 'three'` instead of repeating the full CDN URL. Bumping the three.js version is then a one-line change in `index.html`. See [docs/threejs/threejs-api.md](../../docs/threejs/threejs-api.md).

> **Back-to-launcher link:** required on every game (see Section 2A note above). Note it's placed *before* `#ui-overlay` (not inside it) since that div has `pointer-events: none`, which would swallow clicks on the link.

---

### File: `GAME_DIR/js/config.js` (Three.js version)

```js
// ============================================================
// GAME_TITLE — Configuration
// ============================================================

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Camera ---
export const CAM_FOV     = 60;
export const CAM_NEAR    = 0.1;
export const CAM_FAR     = 200;
export const CAM_POS     = [0, 3, 12];   // x, y, z

// --- Color palette (hex integers — three.js wants 0xRRGGBB, not [r,g,b]) ---
export const COLORS = {
    bg:       0x0a0a14,
    text:     '#dcdcf0',
    accent:   0x64c8ff,
    danger:   0xff5050,
    success:  0x50dc64,
    gold:     0xffd700,
};

// --- TODO: Add game-specific constants below ---
```

> **Note**: Three.js takes `0xRRGGBB` integers for material colors, not the `[r,g,b]` tuples Kaplay uses. The `#RRGGBB` string is for DOM/CSS HUD text.

---

### File: `GAME_DIR/js/scene.js`

```js
/**
 * scene.js — Three.js renderer, scene, camera.
 * Exports live bindings — every other module imports and uses these directly.
 *
 * Call initScene() once before adding anything to the scene.
 */

import * as THREE from 'three';
import { CAM_FOV, CAM_NEAR, CAM_FAR, CAM_POS, COLORS } from './config.js';

export let renderer, scene, camera;
export const clock = new THREE.Clock();

export function initScene() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(COLORS.bg);
    document.body.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();

    // Camera
    camera = new THREE.PerspectiveCamera(
        CAM_FOV,
        window.innerWidth / window.innerHeight,
        CAM_NEAR,
        CAM_FAR,
    );
    camera.position.set(...CAM_POS);

    // Lights — basic ambient + directional (delete if using only MeshBasicMaterial)
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 5);
    scene.add(dir);

    window.addEventListener('resize', _onResize);
}

function _onResize() {
    // IMPORTANT: updateProjectionMatrix() is required, or aspect change has no effect.
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
```

---

### File: `GAME_DIR/js/ui.js` (Three.js version — DOM-based HUD)

```js
/**
 * ui.js — DOM HUD bindings. The HUD lives in index.html as fixed DOM elements;
 * this module just hooks up event listeners and shows/hides overlays.
 */

import { state }  from './state.js';
import { events } from './events.js';

let $score, $lives, $message;

export function initUI() {
    $score   = document.getElementById('score-val');
    $lives   = document.getElementById('lives-val');
    $message = document.getElementById('message');

    _render();

    events.on('scoreChanged', _render);
    events.on('livesChanged', _render);
    events.on('gameOver',     _showGameOver);
}

function _render() {
    if ($score) $score.textContent = String(state.score);
    if ($lives) $lives.textContent = String(state.lives);
}

export function hideSplash() {
    if ($message) $message.classList.add('hidden');
}

function _showGameOver() {
    if (!$message) return;
    $message.innerHTML = `
        <h1 style="color:#ff5050">GAME OVER</h1>
        <p>Final Score: ${state.score}</p>
        <p style="opacity:0.6">Press R to restart  |  ESC for menu</p>
    `;
    $message.classList.remove('hidden');
}
```

---

### File: `GAME_DIR/js/main.js` (Three.js version)

```js
/**
 * main.js — Three.js entry point.
 *
 * Game states: 'splash' → 'playing' → 'gameover'
 *
 * Library: three.js r165 via import map (see index.html)
 */

import * as THREE from 'three';

import { initScene, renderer, scene, camera, clock } from './scene.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, hideSplash } from './ui.js';
import { initAudio, playUiClick } from './sounds.js';

// TODO: import your game-specific modules here
// import { initPlayer, updatePlayer } from './player.js';

// ============================================================
// THREE.JS GOTCHAS (read before adding anything)
// ============================================================
//
// 1. RESIZE — camera.updateProjectionMatrix() is REQUIRED after changing
//    camera.aspect. The scaffold does this in scene.js — don't remove it.
//
// 2. CLOCK CAP — Math.min(clock.getDelta(), 0.05) is mandatory. A backgrounded
//    tab returns a huge delta on first frame after unhide; without the cap
//    physics will tunnel through walls.
//
// 3. COLOR — new THREE.Color(255, 0, 255) is WHITE, not magenta. Color takes
//    floats 0..1. Use 0xRRGGBB hex integers everywhere instead.
//
// 4. GPU MEMORY — three.js does not auto-free geometries/materials. If you
//    spawn/destroy lots of meshes, call mesh.geometry.dispose() and
//    mesh.material.dispose() before removing. Negligible for a fixed scene.
//
// ============================================================
// Init
// ============================================================

initScene();
initUI();

// TODO: initialize game-specific modules
// initPlayer();

// ============================================================
// Game state machine
// ============================================================

let mode = 'splash';   // 'splash' | 'playing' | 'gameover'

function startGame() {
    if (mode === 'playing') return;
    mode = 'playing';
    state.reset();
    initAudio();
    playUiClick();
    hideSplash();
}

events.on('gameOver', () => { mode = 'gameover'; });

// ============================================================
// Input
// ============================================================

function onAnyKey(e) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (mode === 'splash') {
        startGame();
        return;
    }
    if (e.key === 'r' || e.key === 'R') {
        // Restart
        location.reload();
    }
    if (e.key === 'Escape') {
        // Back to splash
        location.reload();
    }
}
document.addEventListener('keydown', onAnyKey);
document.addEventListener('click',   () => { if (mode === 'splash') startGame(); });

// ============================================================
// Render loop
// ============================================================

function animate() {
    requestAnimationFrame(animate);

    // Cap dt — a hidden tab returns one giant delta on first frame.
    const dt = Math.min(clock.getDelta(), 0.05);

    if (mode === 'playing') {
        // TODO: update game objects here
        // updatePlayer(dt);
    }

    renderer.render(scene, camera);
}
animate();
```

---

### File: `GAME_DIR/js/sounds.js` (Three.js version)

Use the **same `sounds.js` as the Kaplay scaffold in Section 2A** — Web Audio API is engine-agnostic. Copy it verbatim.

---

### File: `GAME_DIR/js/events.js` and `GAME_DIR/js/state.js`

Use the **same files as the Kaplay scaffold in Section 2A** — these are engine-agnostic. Copy them verbatim.

---

# 2D — Vanilla 3D scaffold (skip unless ENGINE = vanilla3d)

A hand-written software 3D renderer: **no library at all**. JavaScript transforms,
culls, shades and depth-sorts triangles, then fills them into a Canvas2D context
with `Path2D`.

Proven by **[game-036 Island Walker](../../game-036/)**. Full reference:
[docs/software3d/software3d-api.md](../../docs/software3d/software3d-api.md).

The engine below is **already debugged** — it ships with fixes for the winding,
seam, lighting, fog and aspect bugs that cost real time in game-036. Copy it
verbatim and resist "simplifying" the parts marked with a warning comment; each
one encodes a specific failure.

**Reuse from Section 2A unchanged:** `events.js`, `state.js`, `sounds.js`
(all engine-agnostic).

### Directory layout

Keep `engine/` free of any import from `world/` or `game/` — that separation is
what makes the renderer liftable into the next project.

```
GAME_DIR/
├── index.html
├── game-plan.md
└── js/
    ├── main.js          # boot, pointer lock, frame loop
    ├── config.js        # all tunables
    ├── events.js        # from 2A
    ├── state.js         # from 2A
    ├── sounds.js        # from 2A
    ├── ui.js            # DOM HUD
    ├── engine/
    │   ├── math.js      # Vec3 + Mat4
    │   ├── mesh.js      # mesh format + primitives
    │   ├── renderer.js  # the rasterizer
    │   └── camera.js    # FPS camera + pointer lock
    ├── world/
    │   └── noise.js     # seeded PRNG + value noise
    └── game/
        └── player.js    # movement + collision
```

---

### The six rules of this renderer

State these in `game-plan.md` and honour them in every mesh you add. Each one
is a bug that shipped in game-036 first — none of them raise an error, the
scene just looks wrong.

1. **Wind counter-clockwise viewed from the outside.** Wrong winding = normal
   points away = triangle silently backface-culled. On a flat test scene you
   will not notice; the moment geometry tilts, whole surfaces vanish. **Assert
   it numerically** (see `assertWindingUp` in `mesh.js`), never by eye.
2. **Clip against the near plane; never reject.** Dropping a triangle because
   one vertex is behind the plane punches a hole in the ground under the player.
3. **Fill *and* stroke every triangle** in the same colour, or a hairline
   wireframe appears between neighbours from fill antialiasing.
4. **Light with half-Lambert**, not `max(dot,0)`, or every pale material reads
   as brown mud because you usually face the unlit side.
5. **Painter's algorithm cannot render interiors.** If the camera can go inside
   something, render that interior *exclusively*.
6. **Fog must finish before the draw distance**, or chunks pop in at full
   saturation.

---

### File: `GAME_DIR/index.html` (Vanilla 3D version)

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>GAME_TITLE</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
        width: 100%; height: 100%;
        background: #0a0f14;
        overflow: hidden;
        font-family: 'Courier New', monospace;
        color: #eef2f2;
    }
    #game-canvas { display: block; width: 100vw; height: 100vh; cursor: crosshair; }

    #hud {
        position: fixed; inset: 0;
        pointer-events: none;
        display: flex; flex-direction: column; justify-content: space-between;
    }
    /* Left padding clears the fixed "← Games" link, which would otherwise
       overlap the first HUD panel. */
    #hud-top {
        display: flex; justify-content: space-between; align-items: flex-start;
        padding: 14px 18px 14px 130px;
    }
    .hud-panel {
        background: rgba(10, 14, 18, 0.55);
        border: 1px solid rgba(255,255,255,0.18);
        border-radius: 8px;
        padding: 8px 14px;
        font-size: 13px;
        letter-spacing: 1px;
    }
    #crosshair {
        position: absolute; top: 50%; left: 50%;
        width: 6px; height: 6px; margin: -3px 0 0 -3px;
        border-radius: 50%;
        background: rgba(255,255,255,0.85);
        box-shadow: 0 0 3px rgba(0,0,0,0.6);
    }
    #controls-hint { padding: 14px 18px; font-size: 11px; opacity: 0.65; letter-spacing: 1px; }
    #debug-stats {
        position: fixed; bottom: 8px; right: 10px;
        font-size: 11px; opacity: 0.5; text-align: right;
    }
    .hidden { display: none !important; }

    #start-overlay, #lock-hint {
        position: fixed; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; text-align: center;
        background: rgba(6, 10, 14, 0.88);
        z-index: 50;
    }
    #lock-hint { background: rgba(6,10,14,0.55); z-index: 40; pointer-events: none; }
    #start-overlay h1 {
        font-size: 42px; letter-spacing: 6px; text-transform: uppercase;
        color: #8fd0ff; margin-bottom: 18px;
    }
    #start-overlay p, #lock-hint p {
        font-size: 14px; letter-spacing: 1px; max-width: 520px;
        line-height: 1.7; opacity: 0.85; margin-bottom: 8px;
    }
    #start-btn {
        margin-top: 22px; padding: 12px 32px;
        font-size: 15px; letter-spacing: 2px; text-transform: uppercase;
        background: #1c6fa8; color: #fff;
        border: none; border-radius: 6px; cursor: pointer; font-family: inherit;
    }
    #start-btn:hover { background: #2688c9; }
    #lock-hint p { font-size: 16px; color: #ffd27a; }
</style>
</head>
<body>
    <a href="../index.html" style="position:fixed;top:8px;left:8px;z-index:99999;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#fff;background:rgba(0,0,0,0.55);padding:6px 12px;border-radius:6px;text-decoration:none;pointer-events:auto;border:1px solid rgba(255,255,255,0.25);" onmouseover="this.style.background='rgba(0,0,0,0.8)'" onmouseout="this.style.background='rgba(0,0,0,0.55)'">← Games</a>

    <canvas id="game-canvas"></canvas>

    <div id="hud">
        <div id="hud-top">
            <div class="hud-panel" id="status-label">TODO: status</div>
            <div class="hud-panel" id="score-panel">SCORE <span id="score-val">0</span></div>
        </div>
        <div id="controls-hint">WASD move · SHIFT sprint · SPACE jump · MOUSE look · ESC release cursor</div>
    </div>

    <div id="crosshair"></div>
    <div id="debug-stats" class="hidden"></div>

    <div id="start-overlay">
        <h1>GAME_TITLE</h1>
        <p>GAME_CONCEPT</p>
        <p style="opacity:0.55">Rendered by a hand-written software 3D engine — no WebGL, no libraries.</p>
        <button id="start-btn">Start</button>
    </div>

    <div id="lock-hint" class="hidden">
        <p>Click anywhere to re-lock the mouse and keep playing</p>
    </div>

    <script type="module" src="js/main.js"></script>
</body>
</html>
```

> **Pointer Lock needs a real click.** Request it from a button/canvas click
> handler — calling it on page load is rejected by the browser. The same click
> is also what allows Web Audio to start.

---

### File: `GAME_DIR/js/engine/math.js`

```js
/**
 * math.js — minimal 3D math. Vec3 is a plain [x,y,z] array (fast, no GC
 * pressure); Mat4 is a flat Float32Array(16), column-major like GL.
 */

export function v3add(a, b)   { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
export function v3sub(a, b)   { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
export function v3scale(a, s) { return [a[0]*s, a[1]*s, a[2]*s]; }
export function v3dot(a, b)   { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

export function v3cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0],
    ];
}

export function v3len(a) { return Math.sqrt(v3dot(a, a)); }

export function v3norm(a) {
    const l = v3len(a);
    return l < 1e-8 ? [0, 0, 0] : [a[0]/l, a[1]/l, a[2]/l];
}

export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }

export function mat4Identity() {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
}

/** Perspective projection. fovY in radians. */
export function mat4Perspective(fovY, aspect, near, far) {
    const f = 1 / Math.tan(fovY / 2);
    const out = mat4Identity();
    out[0]  = f / aspect;
    out[5]  = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    out[15] = 0;
    return out;
}

/** Right-handed look-at view matrix. */
export function mat4LookAt(eye, target, up) {
    const z = v3norm(v3sub(eye, target));   // forward is -z
    const x = v3norm(v3cross(up, z));
    const y = v3cross(z, x);
    const out = mat4Identity();
    out[0] = x[0]; out[4] = x[1]; out[8]  = x[2];
    out[1] = y[0]; out[5] = y[1]; out[9]  = y[2];
    out[2] = z[0]; out[6] = z[1]; out[10] = z[2];
    out[12] = -v3dot(x, eye);
    out[13] = -v3dot(y, eye);
    out[14] = -v3dot(z, eye);
    return out;
}

/**
 * View matrix from position + yaw/pitch. Prefer this over mat4LookAt for an
 * FPS camera — it can't gimbal-lock when looking straight up or down.
 *
 * Forward convention (must match camera.forwardXZ()):
 *   forward = [sin(yaw)*cos(pitch), sin(pitch), -cos(yaw)*cos(pitch)]
 * so yaw 0 looks down -Z.
 */
export function mat4ViewFromYawPitch(pos, yaw, pitch) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const forward = [sy * cp, sp, -cy * cp];
    return mat4LookAt(pos, v3add(pos, forward), [0, 1, 0]);
}

export function v3transformMat4(v, m) {
    const x = v[0], y = v[1], z = v[2];
    return {
        x: m[0]*x + m[4]*y + m[8]*z  + m[12],
        y: m[1]*x + m[5]*y + m[9]*z  + m[13],
        z: m[2]*x + m[6]*y + m[10]*z + m[14],
        w: m[3]*x + m[7]*y + m[11]*z + m[15],
    };
}
```

---

### File: `GAME_DIR/js/engine/mesh.js`

```js
/**
 * mesh.js — mesh format and primitive builders.
 *
 * A mesh is:  { verts: [[x,y,z], ...], tris: [[i0,i1,i2,[r,g,b]], ...] }
 * Colour lives per-triangle; the renderer shades it by face normal.
 *
 * ⚠️ WINDING: counter-clockwise viewed from OUTSIDE the surface, so the normal
 * (e1 × e2) points outward. Get this wrong and the triangle is backface-culled
 * — invisible, with no error. Use assertWindingUp() on any new flat builder.
 */

export function makeMesh() { return { verts: [], tris: [] }; }

export function addVert(mesh, x, y, z) {
    mesh.verts.push([x, y, z]);
    return mesh.verts.length - 1;
}

export function addTri(mesh, a, b, c, color) {
    mesh.tris.push([a, b, c, color]);
}

/** World-space normal of triangle `i`. Use this to verify winding. */
export function triNormal(mesh, i) {
    const [ia, ib, ic] = mesh.tris[i];
    const a = mesh.verts[ia], b = mesh.verts[ib], c = mesh.verts[ic];
    const e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const e2 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const n = [
        e1[1]*e2[2] - e1[2]*e2[1],
        e1[2]*e2[0] - e1[0]*e2[2],
        e1[0]*e2[1] - e1[1]*e2[0],
    ];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0]/l, n[1]/l, n[2]/l];
}

/**
 * Dev check for ground/water/floor meshes: every normal must point up.
 * Call it once after writing a new flat-surface builder — this is the single
 * highest-value assertion in the whole engine.
 */
export function assertWindingUp(mesh, label = 'mesh') {
    for (let i = 0; i < mesh.tris.length; i++) {
        const ny = triNormal(mesh, i)[1];
        if (ny <= 0) {
            console.error(`[winding] ${label} tri ${i} normalY=${ny.toFixed(3)} — should be > 0. Swap two indices.`);
            return false;
        }
    }
    return true;
}

/** Merge src into dst, applying offset / Y-rotation / uniform scale. */
export function mergeMesh(dst, src, ox = 0, oy = 0, oz = 0, rotY = 0, scale = 1) {
    const base = dst.verts.length;
    const cy = Math.cos(rotY), sy = Math.sin(rotY);
    for (const [x, y, z] of src.verts) {
        dst.verts.push([
            (x * cy + z * sy) * scale + ox,
            y * scale + oy,
            (-x * sy + z * cy) * scale + oz,
        ]);
    }
    for (const [a, b, c, color] of src.tris) {
        dst.tris.push([a + base, b + base, c + base, color]);
    }
}

/** Box centred at origin. */
export function buildBox(w, h, d, color) {
    const m = makeMesh();
    const x = w/2, y = h/2, z = d/2;
    const p = [
        [-x,-y,-z], [x,-y,-z], [x,y,-z], [-x,y,-z],
        [-x,-y, z], [x,-y, z], [x,y, z], [-x,y, z],
    ].map(v => addVert(m, ...v));
    // Each quad wound CCW seen from outside.
    const faces = [
        [0,1,2,3], // -Z
        [5,4,7,6], // +Z
        [4,0,3,7], // -X
        [1,5,6,2], // +X
        [3,2,6,7], // +Y
        [4,5,1,0], // -Y
    ];
    for (const [a,b,c,d2] of faces) {
        addTri(m, p[a], p[b], p[c], color);
        addTri(m, p[a], p[c], p[d2], color);
    }
    return m;
}

/** Cylinder / truncated cone along Y, centred at origin. */
export function buildCylinder(radius, height, segs, color, capTop = true, capBottom = true, topRadius = radius) {
    const m = makeMesh();
    const y0 = -height/2, y1 = height/2;
    const bot = [], top = [];
    for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        bot.push(addVert(m, Math.cos(a)*radius,    y0, Math.sin(a)*radius));
        top.push(addVert(m, Math.cos(a)*topRadius, y1, Math.sin(a)*topRadius));
    }
    for (let i = 0; i < segs; i++) {
        const j = (i + 1) % segs;
        addTri(m, bot[i], top[i], top[j], color);
        addTri(m, bot[i], top[j], bot[j], color);
    }
    if (capBottom) {
        const c = addVert(m, 0, y0, 0);
        for (let i = 0; i < segs; i++) addTri(m, c, bot[(i+1)%segs], bot[i], color);
    }
    if (capTop) {
        const c = addVert(m, 0, y1, 0);
        for (let i = 0; i < segs; i++) addTri(m, c, top[i], top[(i+1)%segs], color);
    }
    return m;
}

/** Cone along Y, apex up. */
export function buildCone(radius, height, segs, color) {
    return buildCylinder(radius, height, segs, color, false, true, 0.001);
}

/**
 * Low-poly blob from a subdivided octahedron, optionally jittered.
 * `detail` is your main LOD lever: 0 => 8 tris, 1 => 32, 2 => 128.
 */
export function buildBlob(radius, detail, color, jitter = 0.15, rng = Math.random) {
    let verts = [[0,1,0], [0,-1,0], [1,0,0], [-1,0,0], [0,0,1], [0,0,-1]];
    let faces = [
        [0,2,4],[0,4,3],[0,3,5],[0,5,2],
        [1,4,2],[1,3,4],[1,5,3],[1,2,5],
    ];
    for (let d = 0; d < detail; d++) {
        const cache = new Map(), next = [];
        const mid = (i, j) => {
            const key = i < j ? `${i}_${j}` : `${j}_${i}`;
            if (cache.has(key)) return cache.get(key);
            const a = verts[i], b = verts[j];
            let v = [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2];
            const l = Math.hypot(v[0], v[1], v[2]) || 1;
            v = [v[0]/l, v[1]/l, v[2]/l];
            const idx = verts.length;
            verts.push(v); cache.set(key, idx);
            return idx;
        };
        for (const [a,b,c] of faces) {
            const ab = mid(a,b), bc = mid(b,c), ca = mid(c,a);
            next.push([a,ab,ca], [b,bc,ab], [c,ca,bc], [ab,bc,ca]);
        }
        faces = next;
    }
    const m = makeMesh();
    const idx = verts.map(v => {
        const j = 1 + (rng() * 2 - 1) * jitter;
        return addVert(m, v[0]*radius*j, v[1]*radius*j, v[2]*radius*j);
    });
    for (const [a,b,c] of faces) addTri(m, idx[a], idx[b], idx[c], color);
    return m;
}

/**
 * Flat horizontal grid in the XZ plane, y from heightFn(x, z).
 * Use for terrain/floors. Winding is CCW-from-above => normals up.
 */
export function buildGrid(originX, originZ, size, subdiv, heightFn, colorFn) {
    const m = makeMesh();
    const step = size / subdiv;
    const grid = [];
    for (let gz = 0; gz <= subdiv; gz++) {
        const row = [];
        for (let gx = 0; gx <= subdiv; gx++) {
            const wx = originX + gx * step, wz = originZ + gz * step;
            row.push(addVert(m, wx, heightFn(wx, wz), wz));
        }
        grid.push(row);
    }
    for (let gz = 0; gz < subdiv; gz++) {
        for (let gx = 0; gx < subdiv; gx++) {
            const cx = originX + (gx + 0.5) * step, cz = originZ + (gz + 0.5) * step;
            const color = colorFn(cx, cz);
            const a = grid[gz][gx], b = grid[gz][gx+1];
            const c = grid[gz+1][gx+1], d = grid[gz+1][gx];
            // ⚠️ CCW from above. Reversing these flips every normal downward
            // and the whole surface disappears.
            addTri(m, a, c, b, color);
            addTri(m, a, d, c, color);
        }
    }
    return m;
}
```

---

### File: `GAME_DIR/js/engine/renderer.js`

```js
/**
 * renderer.js — software 3D rasterizer on Canvas2D.
 *
 * Per frame, per instance ({ mesh, pos, rotY, scale, ...flags }):
 *   1. Transform verts local -> world -> view (once per instance, not per tri).
 *   2. Clip each triangle against the near plane (may yield 3 or 4 verts).
 *   3. Fan the result and project to screen space.
 *   4. Backface cull by screen-space signed area.
 *   5. Flat shade: half-Lambert key + hemisphere fill + ambient.
 *   6. Distance fog.
 *   7. Sort all triangles back-to-front, fill + stroke each.
 *
 * Deliberately omitted, and why:
 *   - Z-buffer: per-pixel depth in JS is far too slow. Consequence: painter's
 *     algorithm, so large/intersecting triangles can sort wrong. Interiors must
 *     be rendered exclusively (see `noFarCull` usage and rule 4).
 *   - Clipping against the side planes: unnecessary at this poly budget;
 *     off-screen triangles are cheap to discard after projection.
 *   - Texturing / per-pixel light: cost. Flat colour per triangle is the look.
 *
 * Per-instance flags:
 *   doubleSided — skip backface cull (procedurally traced ribbons, interiors)
 *   noFarCull   — exempt from far-plane cull (sky/ocean backdrops)
 *   noFogFade   — never fog (backdrops that own their own colour)
 *   colorMul    — [r,g,b] multiplier for tinting/flashing an instance
 */

import { v3sub, v3cross, v3norm, v3dot, mat4Perspective, mat4ViewFromYawPitch, clamp } from './math.js';

export class Renderer {
    constructor(canvas, opts = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });

        this.fov  = opts.fov  ?? (70 * Math.PI / 180);
        this.near = opts.near ?? 0.1;
        this.far  = opts.far  ?? 400;

        this.lightDir = v3norm(opts.lightDir ?? [0.5, 0.9, 0.3]);

        // Lighting: additive, clamped in render(). Because the half-Lambert wrap
        // term never reaches 0, ambient only has to cover the fully back-lit
        // case. Tuned so shade lands ~0.62 at worst, ~1.05 fully lit.
        this.ambient   = opts.ambient   ?? 0.38;
        this.fillLight = opts.fillLight ?? 0.14;
        this.keyLight  = opts.keyLight  ?? 0.55;

        // ⚠️ Fog must FINISH at or before the draw distance, or chunks get
        // culled at full saturation and pop in as hard-edged blocks.
        this.fogColor = opts.fogColor ?? [162, 194, 216];
        this.fogNear  = opts.fogNear  ?? 55;
        this.fogFar   = opts.fogFar   ?? 100;

        this.trisDrawn = 0;   // last frame, for the debug HUD
        this._buf = [];       // reused across frames to avoid GC churn
        this._clipBuf = [];   // reused by _clipTriNear for the same reason
        this._resize();
    }

    _resize() {
        // Cap DPR: this is a CPU rasterizer, so every extra pixel costs real time.
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        this.canvas.width  = Math.max(1, Math.floor(this.canvas.clientWidth  * dpr));
        this.canvas.height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
        this.width  = this.canvas.width;
        this.height = this.canvas.height;
        this.proj = mat4Perspective(this.fov, this.width / this.height, this.near, this.far);
    }

    onResize() { this._resize(); }

    /** Fill the frame with a vertical gradient. Doubles as the clear. */
    drawBackdrop(topColor, bottomColor) {
        const g = this.ctx.createLinearGradient(0, 0, 0, this.height);
        g.addColorStop(0, `rgb(${topColor.join(',')})`);
        g.addColorStop(1, `rgb(${bottomColor.join(',')})`);
        this.ctx.fillStyle = g;
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /** camera: { pos:[x,y,z], yaw, pitch } */
    render(camera, instances) {
        const view = mat4ViewFromYawPitch(camera.pos, camera.yaw, camera.pitch);
        const halfW = this.width / 2, halfH = this.height / 2;
        const buf = this._buf;
        buf.length = 0;

        for (const inst of instances) {
            const mesh = inst.mesh;
            if (!mesh || !mesh.tris.length) continue;

            const rotY = inst.rotY || 0;
            const cy = Math.cos(rotY), sy = Math.sin(rotY);
            const ox = inst.pos[0], oy = inst.pos[1], oz = inst.pos[2];
            const scale = inst.scale ?? 1;
            const cmul = inst.colorMul;

            const n = mesh.verts.length;
            const world = new Array(n), viewV = new Array(n);
            for (let i = 0; i < n; i++) {
                const v = mesh.verts[i];
                const wx = (v[0] * cy + v[2] * sy) * scale + ox;
                const wy = v[1] * scale + oy;
                const wz = (-v[0] * sy + v[2] * cy) * scale + oz;
                world[i] = [wx, wy, wz];
                viewV[i] = {
                    x: view[0]*wx + view[4]*wy + view[8]*wz  + view[12],
                    y: view[1]*wx + view[5]*wy + view[9]*wz  + view[13],
                    z: view[2]*wx + view[6]*wy + view[10]*wz + view[14],
                };
            }

            for (const tri of mesh.tris) {
                const ia = tri[0], ib = tri[1], ic = tri[2], color = tri[3];

                // ⚠️ CLIP against the near plane; do NOT just drop triangles that
                // cross it. A ground quad spans several world units while the eye
                // sits ~1.7 units up, so the triangle directly under the player
                // almost always has one vertex behind the plane. Rejecting it
                // punches a hole in the floor you're standing on and you see
                // straight through to the backdrop.
                const poly = this._clipTriNear(viewV[ia], viewV[ib], viewV[ic]);
                if (poly.length < 3) continue;

                // Shade from the ORIGINAL world verts: a clipped face is still
                // flat so its normal is unchanged, and using clipped verts would
                // make the fan's pieces shade inconsistently.
                const wa = world[ia], wb = world[ib], wc = world[ic];
                for (let f = 0; f + 2 < poly.length; f++) {
                    this._emitTri(poly[0], poly[f + 1], poly[f + 2],
                        wa, wb, wc, color, cmul, inst, halfW, halfH, buf);
                }
            }
        }

        // Painter's algorithm: far to near.
        buf.sort((p, q) => q.depth - p.depth);

        // ⚠️ Fill AND stroke in the same colour. Canvas2D antialiases fill edges
        // to partial coverage, so triangles sharing an edge blend with what's
        // underneath — showing up as a hairline wireframe across the scene.
        // Stroking widens coverage ~0.5px and closes the seam.
        const ctx = this.ctx;
        ctx.lineJoin = 'round';
        ctx.lineWidth = 1;
        for (let i = 0; i < buf.length; i++) {
            const t = buf[i];
            const style = `rgb(${t.r},${t.g},${t.b})`;
            ctx.fillStyle = style;
            ctx.strokeStyle = style;
            ctx.beginPath();
            ctx.moveTo(t.sax, t.say);
            ctx.lineTo(t.sbx, t.sby);
            ctx.lineTo(t.scx, t.scy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
        this.trisDrawn = buf.length;
    }

    /**
     * Clip a view-space triangle against the near plane (Sutherland-Hodgman on a
     * single plane). Visible half-space is z <= -near; returns 0, 3 or 4 verts in
     * the input winding order. The returned array is reused between calls — fan
     * over it before clipping again.
     */
    _clipTriNear(a, b, c) {
        const near = this.near;
        // Signed distance into the visible half-space; positive means inside.
        const da = -a.z - near, db = -b.z - near, dc = -c.z - near;

        const out = this._clipBuf;
        out.length = 0;
        // Fast paths: fully inside is the common case and needs no lerps at all.
        if (da >= 0 && db >= 0 && dc >= 0) { out.push(a, b, c); return out; }
        if (da < 0 && db < 0 && dc < 0) return out;

        const verts = [a, b, c], dists = [da, db, dc];
        for (let i = 0; i < 3; i++) {
            const j = (i + 1) % 3;
            const cur = verts[i], nxt = verts[j];
            const dCur = dists[i], dNxt = dists[j];
            if (dCur >= 0) out.push(cur);
            // An edge crossing the plane in either direction contributes its
            // intersection point, keeping the output polygon closed.
            if ((dCur >= 0) !== (dNxt >= 0)) {
                const t = dCur / (dCur - dNxt);
                out.push({
                    x: cur.x + (nxt.x - cur.x) * t,
                    y: cur.y + (nxt.y - cur.y) * t,
                    z: cur.z + (nxt.z - cur.z) * t,
                });
            }
        }
        return out;
    }

    /**
     * Project one already-clipped view-space triangle, cull and shade it, then
     * push it to the draw buffer. wa/wb/wc are the source face's *unclipped*
     * world verts, used only for the flat normal.
     */
    _emitTri(a, b, c, wa, wb, wc, color, cmul, inst, halfW, halfH, buf) {
        const az = -a.z, bz = -b.z, cz = -c.z;

        // ⚠️ Use proj[5] (= 1/tan(fov/2)) for BOTH axes and multiply by halfH.
        // proj[0] is f/aspect; combining it with halfW (= halfH*aspect) applies
        // aspect twice and squashes the scene horizontally.
        const f = this.proj[5];
        const sax = halfW + (a.x / az) * f * halfH;
        const say = halfH - (a.y / az) * f * halfH;
        const sbx = halfW + (b.x / bz) * f * halfH;
        const sby = halfH - (b.y / bz) * f * halfH;
        const scx = halfW + (c.x / cz) * f * halfH;
        const scy = halfH - (c.y / cz) * f * halfH;

        const area = (sbx - sax) * (scy - say) - (sby - say) * (scx - sax);
        if (area === 0) return;
        // Front faces wind negative under this projection.
        if (!inst.doubleSided && area > 0) return;

        const depth = (az + bz + cz) / 3;
        if (depth > this.far && !inst.noFarCull) return;

        let nrm = v3norm(v3cross(v3sub(wb, wa), v3sub(wc, wa)));
        // A back-facing double-sided tri has its normal pointing away, which
        // would shade it as unlit. Flip it toward the viewer.
        if (inst.doubleSided && area > 0) nrm = [-nrm[0], -nrm[1], -nrm[2]];

        // ⚠️ Half-Lambert, NOT max(dot,0). In first person the faces you look at
        // are usually turned away from the light; clamping makes them collapse
        // to ambient and every pale material reads brown.
        const wrap    = v3dot(nrm, this.lightDir) * 0.5 + 0.5;
        const skyFill = (nrm[1] * 0.5 + 0.5) * this.fillLight;
        const shade   = clamp(this.ambient + skyFill + wrap * this.keyLight, 0, 1.15);

        let r = color[0] * shade, g = color[1] * shade, bl = color[2] * shade;
        if (cmul) { r *= cmul[0]; g *= cmul[1]; bl *= cmul[2]; }

        if (!inst.noFogFade) {
            const t = clamp((depth - this.fogNear) / (this.fogFar - this.fogNear), 0, 1);
            if (t > 0) {
                r  += (this.fogColor[0] - r)  * t;
                g  += (this.fogColor[1] - g)  * t;
                bl += (this.fogColor[2] - bl) * t;
            }
        }

        buf.push({
            depth, sax, say, sbx, sby, scx, scy,
            // shade can exceed 1, so clamp before packing to bytes.
            r: r  > 255 ? 255 : r  | 0,
            g: g  > 255 ? 255 : g  | 0,
            b: bl > 255 ? 255 : bl | 0,
        });
    }
}
```

> **Why clip instead of reject?** A ground quad spans several world units while
> the eye sits ~1.7 units up, so the triangle directly beneath the player almost
> always has a vertex behind the near plane. Dropping it punches a hole in the
> floor you're standing on. This is rule 5's sibling and just as easy to miss.

---

### File: `GAME_DIR/js/engine/camera.js`

```js
/**
 * camera.js — first-person camera pose + Pointer Lock mouse-look.
 * Owns only the pose and look input; movement/collision live in game/player.js.
 */

import { clamp } from './math.js';

export class FirstPersonCamera {
    constructor(canvas) {
        this.canvas = canvas;
        this.pos = [0, 1.7, 0];
        this.yaw = 0;      // 0 looks down -Z
        this.pitch = 0;
        this.sensitivity = 0.0022;
        this.locked = false;

        this._onMouseMove  = this._onMouseMove.bind(this);
        this._onLockChange = this._onLockChange.bind(this);
        document.addEventListener('pointerlockchange', this._onLockChange);
    }

    /** Must be called from a user gesture (click), or the browser rejects it. */
    requestLock() {
        if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock();
    }

    exitLock() {
        if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }

    _onLockChange() {
        this.locked = document.pointerLockElement === this.canvas;
        if (this.locked) document.addEventListener('mousemove', this._onMouseMove);
        else             document.removeEventListener('mousemove', this._onMouseMove);
    }

    _onMouseMove(e) {
        this.yaw   += e.movementX * this.sensitivity;
        this.pitch -= e.movementY * this.sensitivity;
        // Stop just short of vertical: at exactly ±90° the view basis degenerates.
        this.pitch = clamp(this.pitch, -Math.PI/2 + 0.05, Math.PI/2 - 0.05);
    }

    /** Must match the forward convention in mat4ViewFromYawPitch. */
    forwardXZ() { return [Math.sin(this.yaw), 0, -Math.cos(this.yaw)]; }
    rightXZ()   { return [Math.cos(this.yaw), 0,  Math.sin(this.yaw)]; }

    destroy() {
        document.removeEventListener('pointerlockchange', this._onLockChange);
        document.removeEventListener('mousemove', this._onMouseMove);
    }
}
```

---

### File: `GAME_DIR/js/world/noise.js`

```js
/**
 * noise.js — seeded PRNG + 2D value noise. Everything procedural should derive
 * from one root seed through here, so a seed always rebuilds the same world.
 */

/** mulberry32 — small, fast, adequate quality. */
export function makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashSeedFromString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
}

export class ValueNoise2D {
    constructor(seed, gridSize = 256) {
        this.gridSize = gridSize;
        const rng = makeRng(seed);
        this.grid = new Float32Array(gridSize * gridSize);
        for (let i = 0; i < this.grid.length; i++) this.grid[i] = rng();
    }

    _sample(ix, iy) {
        const g = this.gridSize;
        return this.grid[(((iy % g) + g) % g) * g + (((ix % g) + g) % g)];
    }

    get(x, y) {
        const x0 = Math.floor(x), y0 = Math.floor(y);
        const tx = x - x0, ty = y - y0;
        const sx = tx * tx * (3 - 2 * tx);   // smoothstep
        const sy = ty * ty * (3 - 2 * ty);
        const v00 = this._sample(x0, y0),     v10 = this._sample(x0+1, y0);
        const v01 = this._sample(x0, y0+1),   v11 = this._sample(x0+1, y0+1);
        const a = v00 + (v10 - v00) * sx;
        const b = v01 + (v11 - v01) * sx;
        return a + (b - a) * sy;
    }

    /** Fractal sum of octaves. Returns roughly [0,1]. */
    fbm(x, y, octaves = 4, scale = 0.02, persistence = 0.5) {
        let amp = 1, freq = scale, sum = 0, norm = 0;
        for (let o = 0; o < octaves; o++) {
            sum  += this.get(x * freq, y * freq) * amp;
            norm += amp;
            amp  *= persistence;
            freq *= 2;
        }
        return sum / norm;
    }
}
```

> **Vertical scale matters more than you expect.** A 260-unit-wide island peaking
> at 17 units read as a flat sheet from a 1.7-unit eye height. Aim for roughly
> **1:4 height-to-radius**. Raise the radial falloff to a power > 1 to keep
> coasts gentle while letting the interior climb.

---

### File: `GAME_DIR/js/game/player.js`

```js
/**
 * player.js — first-person movement, ground collision, gravity/jump, footsteps.
 *
 * Collision is against a height function, which is enough when the world has no
 * geometry the player can walk *under*. If you add a tunnel, cave or building
 * interior, give it its own floor query and override here — a plain heightmap
 * lookup will shove the player up through the roof and they can never get in.
 */

import { PLAYER_EYE_HEIGHT, PLAYER_SPEED, PLAYER_SPRINT_MULT, GRAVITY, JUMP_SPEED } from '../config.js';
import { playFootstep } from '../sounds.js';

export class Player {
    /** @param groundAt (x, z, currentY) => surface height */
    constructor(camera, groundAt, startPos) {
        this.camera = camera;
        this.groundAt = groundAt;
        this.camera.pos = [startPos[0], groundAt(startPos[0], startPos[2], 0) + PLAYER_EYE_HEIGHT, startPos[2]];
        this.velY = 0;
        this.grounded = true;
        this.keys = new Set();
        this._footstepDist = 0;

        this._onKeyDown = (e) => this.keys.add(e.code);
        this._onKeyUp   = (e) => this.keys.delete(e.code);
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    destroy() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
    }

    update(dt) {
        const cam = this.camera;
        const fwd = cam.forwardXZ(), right = cam.rightXZ();

        let mx = 0, mz = 0;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))    { mx += fwd[0];   mz += fwd[2]; }
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))  { mx -= fwd[0];   mz -= fwd[2]; }
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) { mx += right[0]; mz += right[2]; }
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))  { mx -= right[0]; mz -= right[2]; }

        const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        const speed = PLAYER_SPEED * (sprinting ? PLAYER_SPRINT_MULT : 1);

        const prevX = cam.pos[0], prevZ = cam.pos[2];
        let moved = 0;
        const len = Math.hypot(mx, mz);
        if (len > 0.001) {
            const dx = (mx / len) * speed * dt, dz = (mz / len) * speed * dt;
            cam.pos[0] += dx;
            cam.pos[2] += dz;
            moved = Math.hypot(dx, dz);
        }

        // TODO: reject the step here for out-of-bounds / blocked terrain, e.g.
        //   if (tooSteep(cam.pos[0], cam.pos[2])) { cam.pos[0] = prevX; cam.pos[2] = prevZ; moved = 0; }
        // Resolve the surface only AFTER the position is final, so a reverted
        // step doesn't take its height from the rejected location.

        const feetY = cam.pos[1] - PLAYER_EYE_HEIGHT;
        const feetTarget = this.groundAt(cam.pos[0], cam.pos[2], feetY);

        if (this.keys.has('Space') && this.grounded) {
            this.velY = JUMP_SPEED;
            this.grounded = false;
        }

        this.velY -= GRAVITY * dt;
        let newFeetY = feetY + this.velY * dt;
        if (newFeetY <= feetTarget) {
            newFeetY = feetTarget;
            this.velY = 0;
            this.grounded = true;
        }
        cam.pos[1] = newFeetY + PLAYER_EYE_HEIGHT;

        // Cadence from distance travelled, not time — so it matches walk vs sprint.
        if (this.grounded && moved > 0) {
            this._footstepDist += moved;
            if (this._footstepDist > 2.2) {
                this._footstepDist = 0;
                playFootstep();
            }
        }
    }
}
```

---

### File: `GAME_DIR/js/config.js` (Vanilla 3D version)

```js
// ============================================================
// GAME_TITLE — Configuration
// ============================================================

// --- Starting resources ---
// Required by the shared state.js from Section 2A. Keep these exported even if
// this game has no lives — state.js imports them by name, and a missing export
// fails the whole module graph at load with
// "does not provide an export named 'STARTING_LIVES'".
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Camera / render ---
export const FOV_DEG = 70;

// ⚠️ Ordering matters: FOG_NEAR < FOG_FAR <= DRAW_DISTANCE < RENDER_FAR.
// Fog has to finish fading before geometry is culled, or chunks pop in at full
// colour. RENDER_FAR sits beyond everything so `noFarCull` backdrops (sky,
// ocean) still reach the horizon.
export const DRAW_DISTANCE = 105;
export const LOD_DISTANCE  = 45;    // beyond this, rebuild props at low detail
export const FOG_NEAR      = 55;
export const FOG_FAR       = 100;
export const RENDER_FAR    = 400;

// --- Player ---
export const PLAYER_EYE_HEIGHT  = 1.7;
export const PLAYER_SPEED       = 5.2;
export const PLAYER_SPRINT_MULT = 1.7;
export const GRAVITY            = 18;
export const JUMP_SPEED         = 6.2;

// --- Colours (flat-shaded palette; the renderer shades these per face) ---
export const SKY_TOP    = [92, 148, 208];
export const SKY_BOTTOM = [178, 208, 226];
// Haze a touch deeper/bluer than SKY_BOTTOM, so distance recedes into
// atmosphere instead of bleaching to near-white.
export const FOG_COLOR  = [162, 194, 216];

// Light direction points TOWARD the light. Off-axis so different faces catch
// it at different angles instead of flattening out.
export const SUN_DIR = [0.5, 0.9, 0.3];

// --- Seed ---
export const SEED_STORAGE_KEY = 'GAME_FOLDER-seed';

// --- TODO: game-specific constants below ---
```

---

### File: `GAME_DIR/js/ui.js` (Vanilla 3D version)

```js
/**
 * ui.js — DOM HUD bindings. Markup lives in index.html; this only wires it up.
 * Keep the HUD in DOM rather than drawing it into the canvas: text is the most
 * expensive thing a CPU rasterizer can draw, and DOM text stays crisp for free.
 */

import { state } from './state.js';
import { events } from './events.js';

let $status, $score, $lockHint, $debug;

export function initUI() {
    $status   = document.getElementById('status-label');
    $score    = document.getElementById('score-val');
    $lockHint = document.getElementById('lock-hint');
    $debug    = document.getElementById('debug-stats');

    _render();
    events.on('scoreChanged', _render);
    // TODO: subscribe to game-specific events
}

function _render() {
    if ($score) $score.textContent = String(state.score);
}

export function setStatus(text) {
    if ($status) $status.textContent = text;
}

export function setLockHintVisible(visible) {
    if ($lockHint) $lockHint.classList.toggle('hidden', !visible);
}

/** Shown only with ?debug=1 — triangle count is the fastest way to see if LOD works. */
export function setDebugStats(text) {
    if (!$debug) return;
    $debug.classList.remove('hidden');
    $debug.textContent = text;
}
```

---

### File: `GAME_DIR/js/main.js` (Vanilla 3D version)

```js
/**
 * main.js — GAME_TITLE entry point.
 *
 * Boot: resolve seed -> build world -> wait for a click (Pointer Lock + audio
 * both need a user gesture) -> run the frame loop.
 *
 * No engine: js/engine/renderer.js is a from-scratch Canvas2D triangle
 * rasterizer. Read its header before changing anything about how meshes are
 * built — especially triangle winding.
 */

import { Renderer } from './engine/renderer.js';
import { FirstPersonCamera } from './engine/camera.js';
import { buildGrid, assertWindingUp } from './engine/mesh.js';
import { v3norm } from './engine/math.js';
import { ValueNoise2D, hashSeedFromString } from './world/noise.js';
import { Player } from './game/player.js';
import { initUI, setDebugStats } from './ui.js';
import { state } from './state.js';
import { events } from './events.js';
import { initAudio, playUiClick } from './sounds.js';
import {
    FOV_DEG, DRAW_DISTANCE, FOG_NEAR, FOG_FAR, RENDER_FAR,
    SKY_TOP, SKY_BOTTOM, FOG_COLOR, SUN_DIR,
    PLAYER_EYE_HEIGHT, SEED_STORAGE_KEY,
} from './config.js';

const DEBUG = new URLSearchParams(location.search).has('debug');

// ---------- Seed ----------
function resolveSeed() {
    const fromUrl = new URLSearchParams(location.search).get('seed');
    if (fromUrl) return hashSeedFromString(fromUrl);
    let stored = sessionStorage.getItem(SEED_STORAGE_KEY);
    if (!stored) {
        stored = String(Math.floor(Math.random() * 1e9));
        sessionStorage.setItem(SEED_STORAGE_KEY, stored);
    }
    return hashSeedFromString(stored);
}
const seed = resolveSeed();

// ---------- Renderer + camera ----------
const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas, {
    fov: FOV_DEG * Math.PI / 180,
    far: RENDER_FAR,
    fogColor: FOG_COLOR,
    fogNear: FOG_NEAR,
    fogFar: FOG_FAR,
});
const camera = new FirstPersonCamera(canvas);

// Pre-normalised: assigning renderer.lightDir directly skips the constructor's
// normalisation, and the shading dot products assume a unit vector.
const SUN_DIR_N = v3norm(SUN_DIR);
renderer.lightDir = SUN_DIR_N;

// ---------- World (TODO: replace this placeholder) ----------
const noise = new ValueNoise2D(seed);
const groundHeight = (x, z) => (noise.fbm(x, z, 4, 0.02, 0.5) - 0.5) * 12;

const groundMesh = buildGrid(-80, -80, 160, 32, groundHeight, (x, z) => {
    const h = groundHeight(x, z);
    return h > 3 ? [128, 124, 116] : [86, 132, 66];
});
// Cheap insurance against the engine's worst bug. Runs once at startup.
if (DEBUG) assertWindingUp(groundMesh, 'groundMesh');

const staticInstances = [
    { mesh: groundMesh, pos: [0, 0, 0], rotY: 0, scale: 1 },
];

const player = new Player(camera, (x, z) => groundHeight(x, z), [0, 0, 0]);

initUI();

// ---------- Start / Pointer Lock ----------
const $start = document.getElementById('start-overlay');
let started = false;

function beginGame() {
    if (started) return;
    started = true;
    initAudio();       // needs this same user gesture
    playUiClick();
    camera.requestLock();
    $start.classList.add('hidden');
}

document.getElementById('start-btn').addEventListener('click', beginGame);

// Losing lock (Esc) isn't a pause — without lock there's simply no look input.
document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    document.getElementById('lock-hint')?.classList.toggle('hidden', !(started && !locked));
});
canvas.addEventListener('click', () => {
    if (started && document.pointerLockElement !== canvas) camera.requestLock();
});

window.addEventListener('resize', () => renderer.onResize());

// ---------- Frame loop ----------
let last = performance.now();
let fpsFrames = 0, fpsSince = last, fpsValue = 0;

function frame(now) {
    requestAnimationFrame(frame);

    // Cap dt — a backgrounded tab returns one huge delta on the first frame
    // back, which tunnels the player through the ground.
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const time = now / 1000;

    if (started && !state.isPaused) {
        player.update(dt);
        // TODO: update game objects
    }

    // The gradient fills the whole canvas, so it doubles as the clear.
    renderer.drawBackdrop(SKY_TOP, SKY_BOTTOM);

    const instances = staticInstances.slice();
    // TODO: push dynamic instances (enemies, pickups, effects)

    renderer.render(camera, instances);

    if (DEBUG) {
        fpsFrames++;
        if (now - fpsSince >= 500) {
            fpsValue = Math.round((fpsFrames * 1000) / (now - fpsSince));
            fpsFrames = 0; fpsSince = now;
        }
        setDebugStats(`${fpsValue} fps · ${renderer.trisDrawn} tris · seed ${seed}`);
    }
}
requestAnimationFrame(frame);

// Debug hooks, opt-in only: handy for QA (teleport, inspect) but they expose
// mutable engine internals, so they stay off by default.
if (DEBUG) {
    window.__debugTeleport = (x, z) => {
        camera.pos = [x, groundHeight(x, z) + PLAYER_EYE_HEIGHT, z];
    };
    window.__debugCamera = camera;
    window.__debugRenderer = renderer;
}
```

---

### Extending it

**Chunked terrain + LOD** (needed past ~20k triangles). Split the world into
fixed-size chunks, build each lazily, bake props into one mesh per chunk, and
rebuild distant chunks at lower detail. Two non-obvious requirements:

```js
// 1. Hysteresis, or a player standing at the threshold rebuilds every frame.
if (d < LOD_DISTANCE * 0.85)      detail = 1;
else if (d > LOD_DISTANCE * 1.15) detail = 0;
else detail = cached ? cached.detail : (d > LOD_DISTANCE ? 0 : 1);

// 2. Consume the RNG in the SAME ORDER at every detail level, or props
//    shuffle when a chunk crosses the threshold.
const wx = x0 + rng() * SIZE, wz = z0 + rng() * SIZE;
const pick = rng(), rot = rng();     // draw these even if unused in this branch
```

LOD on your most numerous prop is the highest-value optimisation by far — in
game-036, dropping distant tree canopies from 32 triangles to 8 took the scene
from 47,750 tris / 38 fps to 19,268 tris / 60 fps. Evict cached chunks past a
distance to keep memory bounded.

**Water / traced ribbons:** submit with `doubleSided: true` — a procedurally
traced path heads any direction, so its winding isn't predictable. Place it
slightly *above* the terrain, never below: there's no depth buffer, so anything
tucked under the surface is simply overpainted.

**Interiors (caves, buildings):** rule 4. Detect containment explicitly
(distance to a centreline), then render only interior geometry plus a dark
backdrop, and give the player a floor query that overrides the terrain.

**Validate procedural placement across many seeds, not one.** Fixed radius
fractions put game-036's landmarks below sea level on most seeds. Score
candidates against a target and assert over 40+ seeds.

---

### File: `GAME_DIR/js/events.js` and `GAME_DIR/js/state.js`

Use the **same files as the Kaplay scaffold in Section 2A** — engine-agnostic,
copy verbatim.

---

### File: `GAME_DIR/js/sounds.js` (Vanilla 3D version)

Start from Section 2A's `sounds.js`, then **append the two functions below**.
`player.js` imports `playFootstep`, so omitting it breaks the module graph on
first load with `does not provide an export named 'playFootstep'`.

```js
// ---- Append to the Section 2A sounds.js ----

/**
 * Soft filtered-noise thud. Called on distance travelled rather than a timer,
 * so cadence matches walking vs sprinting automatically (see player.js).
 */
export function playFootstep() {
    if (!_enabled || !audioCtx) return;
    const dur = 0.06;
    const buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = audioCtx.createGain();
    gain.gain.value = 0.06;
    src.connect(filter); filter.connect(gain); gain.connect(masterGain);
    src.start();
}

/**
 * Looping wind bed from filtered noise — started once and left running.
 * Cheap, and never loops audibly because noise has no features. An exploration
 * game has no combat to carry the audio, so it needs a continuous bed.
 * Call from initAudio() if you want ambience.
 */
export function startAmbience() {
    if (!audioCtx) return;
    const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 4, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;   // low cutoff => wind, not hiss
    const gain = audioCtx.createGain();
    gain.gain.value = 0.05;         // must sit under everything else
    src.connect(filter); filter.connect(gain); gain.connect(masterGain);
    src.start();
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
2. State which engine was used (Kaplay, Phaser 4, Three.js, or Vanilla 3D).
3. Note any TODOs the user should address next (e.g., updating the `game-plan.md` phases, adding player/enemy modules).
4. Tell the user to open `GAME_DIR/index.html` in a browser to verify the splash screen loads.
   - **Phaser / Three.js / Vanilla 3D note**: all load as ES modules — opening `index.html` directly via `file://` fails with CORS errors. Serve it instead (see the serving warning below).
5. Confirm the "← Games" back-to-launcher link is present in `GAME_DIR/index.html` (`grep -c '← Games' GAME_DIR/index.html` should return `1`) and that it points to `../index.html`.
6. Confirm `index.html` starts with the doctype and nothing precedes it:
   ```bash
   head -c 20 GAME_DIR/index.html    # expect: <!DOCTYPE html>
   ```

### Extra checks when ENGINE = vanilla3d

The renderer's worst failures are silent — nothing errors, geometry just
disappears or looks subtly wrong. Verify explicitly:

1. **Load with `?debug=1`** and confirm the corner readout shows a plausible
   fps and a **non-zero triangle count**. Zero triangles with no console error
   almost always means inverted winding (everything backface-culled).
2. **Winding assertion passes** — `assertWindingUp` logs a `[winding]` error for
   any downward-facing ground triangle. A clean console means it passed.
3. **Move, don't teleport.** Drive the real input path so the player controller
   and collision actually run:
   ```js
   await page.keyboard.down('KeyW'); await page.waitForTimeout(2000); await page.keyboard.up('KeyW');
   ```
   A teleport hook skips physics and hides collision bugs.
4. **Screenshot and actually look at it.** Check for: hairline wireframe between
   triangles (missing stroke), pale materials reading brown (clamped instead of
   half-Lambert), surfaces missing entirely (winding), hard-edged geometry
   popping at the draw distance (fog range), and terrain that reads flat
   (vertical scale too low).
5. **If the page renders stray text**, check the file's first bytes (step 6
   above) rather than assuming a screenshot artifact. Browsers hoist pre-doctype
   text out of `<body>`, so a `document.body.childNodes` check will **not** find
   it — use `document.body.innerText` instead. This exact mistake was made on
   game-036.

> **Serving gotcha:** don't use `npx serve` for this repo. It 301-redirects
> `/GAME_FOLDER/index.html` → `/GAME_FOLDER/index` → `/GAME_FOLDER`, and the
> fallback serves the **root launcher**, whose scripts then throw confusing
> errors that look like they come from your game. Use
> `python -m http.server 8000` (or VS Code Live Server) instead.
