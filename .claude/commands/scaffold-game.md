# scaffold-game

Scaffold a new web game in the web-games-andrew project.

**Arguments:** `$ARGUMENTS`

Parse the arguments as: `[game-folder] [game-title] [genre/concept]`

Examples:
- `/scaffold-game game-078 "Breakout Royale" "brick breaker with powerups"`
- `/scaffold-game "Asteroid Miner" "mining rocks in space" three`
- `/scaffold-game "Pixel Picnic" "a cozy 2D farming sim" canvas`
- `/scaffold-game` (pick the next number, then ask for title/concept)

Everything here is plain HTML, CSS and JavaScript ES modules with no build step and
no npm dependencies at runtime. three.js comes from a CDN through an import map;
Kaplay and Phaser come from the shared copies in `/lib`.

**Read first:** the "Before you call it done" list in Step 5. It is the bugs that
shipped in games 057–076 and were fixed in patch releases afterwards; most of them
are one line to avoid up front and a version bump to fix later.

---

## Step 1: Determine game info

The repo root is wherever this repo is checked out (`git rev-parse --show-toplevel`);
all paths below are relative to it.

- **Game folder**: First token starting with `game-` (e.g. `game-078`). If not given, use the next free number, checked against **main and every open branch**, not just your checkout:
  ```bash
  git fetch origin main && git ls-tree -d --name-only origin/main | grep '^game-' | tail -3
  git branch -r | grep -v HEAD | xargs -I{} git ls-tree -d --name-only {} | grep '^game-' | sort -u | tail -3
  ```
  Games are built in parallel sessions, and five of the last twenty had to be renumbered after another game took their number on main first (Kraken's Gambit 062 → 064, Scrapwright 065 → 066, Dirt Crown 068 → 069, PHOSPHOR PATROL 069 → 070, RUNEBORE 072 → 073). If it happens anyway, renumber everything in one commit: the folder, `js/gamedata.js`, the card class in `css/styles.css`, README, status, CHANGELOG, docs, and the `game-NNN` paths and port inside `dev/`.
- **Game title**: The quoted string after the folder, or the first quoted string if no folder was given.
- **Concept**: Everything after the title, or ask the user if missing. Keep it to 1–2 sentences.
- **Engine** (case-insensitive):
  - `kaplay` → Kaplay (Section 2A). `phaser` or `phaser4` → Phaser 4 (Section 2B).
  - `vanilla 3d`, `software 3d`, `software3d`, `no engine`, `from scratch` or `own renderer` → Vanilla 3D (Section 2D).
  - `three`, `threejs`, `three.js` or `3d` → **Sim/view with three.js** (Section 2S, `RENDERER = three`). Add `minimal`, `prototype` or `quick` to get the small single-module Three.js template instead (Section 2C).
  - `canvas`, `2d`, or `vanilla` with nothing saying 3D → **Sim/view with Canvas 2D** (Section 2S, `RENDERER = canvas`).
  - Nothing given → ask: "Which engine? **three.js** (recommended, sim/view layout with tests), **Canvas 2D** (same layout, no library), **Kaplay**, **Phaser 4**, or **Vanilla 3D** (a hand-written software renderer)?"

> **Section 2S is the default for anything bigger than a weekend toy.** It is what
> games 057–076 all converged on: a pure, seeded simulation that a bot can play in
> Node, a view that only reads it, and harnesses that play the game headlessly and
> in a real browser on desktop and phones. The engine templates (2A–2D) are older
> and lighter: no sim split, no bot, no harnesses. Use them for a small game, or
> when the engine itself is the point, and add a `dev/` harness before calling the
> game finished (the repo's smoke test is a floor, not a playtest).
>
> Note: **raycasting is a different technique** and Section 2D does not implement
> it. A DOOM/Wolfenstein-style column caster with a palette framebuffer is
> `game-031/js/engine/` — copy from there instead. game-054 does a DOOM-style FPS
> in three.js.

Set these variables for use below:
- `GAME_FOLDER` — e.g. `game-078`
- `GAME_TITLE` — e.g. `Breakout Royale`
- `GAME_CONCEPT` — e.g. `A brick breaker game with powerups and boss levels.`
- `GAME_NUMBER` — numeric part, e.g. `078`
- `GAME_DIR` — `GAME_FOLDER` under the repo root
- `ENGINE` — `sim`, `kaplay`, `phaser`, `three`, or `vanilla3d`

### Choosing between Three.js and Vanilla 3D

Both do 3D, but they are not interchangeable. If the user asks for 3D without specifying, ask which they want using this table:

| | **Three.js** (Section 2S, or 2C for a minimal one) | **Vanilla 3D** (Section 2D) |
|---|---|---|
| Rendering | GPU via WebGL | CPU: JS rasterizes triangles into Canvas2D |
| Budget | ~1M+ triangles | ~20k triangles at 60 fps |
| Get | Lights, shadows, materials, textures, post-processing, glTF loading | Flat-shaded polygons only |
| Best for | Anything visually rich; the default choice for 3D | The look/constraint *is* the point — PS1-era low-poly, "no libraries" as a design goal, teaching how a pipeline works |
| Cost | A CDN dependency | ~600 lines of engine you own and must debug |

**Default to Three.js for 3D.** Only pick Vanilla 3D when writing the renderer is itself the goal. Say so plainly if the user seems to want Vanilla 3D for a visually ambitious game — they will hit the triangle ceiling.

---

## Step 2: Create all scaffold files

Create each file below. Substitute `GAME_TITLE`, `GAME_CONCEPT`, `GAME_FOLDER`, `GAME_NUMBER` (and for Section 2S `DEBUG_NS`, `PORT`, `SAVE_SLUG`) where indicated.

**If ENGINE = `sim`**: use the sim/view templates (Section 2S) — skip the engine sections.
**If ENGINE = `kaplay`**: use the Kaplay templates (Section 2A).
**If ENGINE = `phaser`**: use the Phaser templates (Section 2B) instead — skip the Kaplay templates entirely.
**If ENGINE = `three`**: use the Three.js templates (Section 2C) instead — skip the other engine sections entirely.
**If ENGINE = `vanilla3d`**: use the Vanilla 3D templates (Section 2D) instead — skip the other engine sections entirely.

All games make their art, models and sound in code: no image or audio files. Every
one of games 057–076 says so in its credits, and the itch.io export
(`dev/itch/export.mjs`) assumes it.

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

# 2S — Sim/view scaffold (the default)

This is the layout every game from 057 to 075 uses, except game-072 (an imported
single-file build); game-076 keeps the same split with its pure runtime in
`js/runtime/`. None of those twenty used Kaplay or Phaser: seventeen render with
three.js r165 and two with Canvas 2D (game-075 adds a hand-written WebGL CRT pass,
game-076 a two-canvas pixel/UI split). Everything below was run before it was written
down: `dev/simtest.mjs`, `dev/browsertest.mjs` (desktop, two touch-only phones,
blocked storage) and the repo's `dev/smoketest.mjs` all pass on the untouched
scaffold, with either renderer.

It ships a tiny playable placeholder (collect pickups for 60 seconds, a dash on the
action button) so every harness has something real to drive on day one. Replace the
rules; keep the shape.

### The rules this layout keeps

Most are here because a game broke without them; the game that did is named.

1. **`js/sim/` is pure.** No DOM, no three.js, no `Math.random`, no clock, no
   storage, no imports from the view, UI, audio or input. Randomness comes from
   `js/rng.js` with a seed; time comes in as `dt`. The sim test greps for all of
   it. This is what lets a bot play the whole game in Node in seconds, makes a
   seed replay exactly, and makes save/load a JSON round trip.
2. **The view reads `G` and drains `G.events`; it never writes `G`.** Effects,
   sounds and HUD flashes answer events (`{ type: 'pickup', x, y }`), drained once
   per frame in `main.js` and handed to the view, the audio and the UI.
3. **One fixed step.** `STEP = 1/120`, an accumulator, a frame capped at
   `MAX_FRAME = 0.05`, at most `12 × FAST` steps a frame. `?debug=1&fast=N` runs N×
   the simulation per frame so tests finish under SwiftShader.
4. **Presses are never lost or merged.** Action presses are edges that stay set
   until a sim step consumes them: a frame shorter than `STEP` runs no step, and a
   tap made in it would vanish (game-059, game-071). Menu presses go into a FIFO and
   one is consumed per frame: at 2 fps "Down, Down, Enter" arrives in one frame
   (game-074, game-075). Starting play flushes the queue and blurs the focused
   button.
5. **Storage is guarded.** Every `localStorage` access is in `try`/`catch`; with
   storage blocked the game plays and just can't save. Saves carry a version `v`,
   and `deserialize` rejects an unknown one instead of half-loading it.
6. **The canvas is sized in px from `visualViewport`, never `100vw`/`100vh`.** On
   phones `100vh` is taller than the visible area, so the picture sits lower than
   where taps are mapped and things get built below the finger (game-058, then
   game-067 a week later). Map pointers through the canvas's
   `getBoundingClientRect()`.
7. **Touch is first-class.** The deck switches on from a capture-phase
   `pointerdown` on `window`, so a tap on any menu enables it before play starts
   (game-074). Touch buttons act on finger-down. A screen ignores the click from a
   press that began outside it, so the finger that opened a menu doesn't close it
   on lift (game-071). Every control is at least 44 px, and full-screen sheets have
   top padding that clears the fixed `← Games` link (game-073).
8. **`?debug=1` exposes `window.DEBUG_NS`** with the live game, a count of every
   sim event seen, `start(seed)`, `autoplay(on)` and `ff(seconds)`. Tests wait on
   that state, never on the clock.
9. **Silent and saved in the background.** `../lib/page-audio.js` suspends audio in
   a hidden tab; `visibilitychange` also pauses and saves, and `pagehide` saves.

### Variables for this section

As well as the ones from Step 1:
- `RENDERER`: `three` (default for 3D) or `canvas` (2D)
- `DEBUG_NS`: `__` plus the title's initials, e.g. `__rb` for RUNEBORE, `__cc` for CHROME CHALICE
- `PORT`: `8` + `GAME_NUMBER`, e.g. `8078` (each game's harness has its own port, so two can run at once)
- `SAVE_SLUG`: kebab-case title, e.g. `chrome-chalice`. The save key is `SAVE_SLUG.v1`.

### Directory layout

```
GAME_FOLDER/
├── index.html          # meta tags, back link, canvas, HUD, touch deck, screens
├── style.css           # phone first; safe-area insets; 44 px controls
├── game-plan.md        # design, module overview, testing, changelog
├── js/
│   ├── main.js         # boot, mode machine, fixed-step loop, input routing, debug hooks
│   ├── config.js       # VERSION, SAVE_KEY, STEP, tuning (shared with the tests)
│   ├── rng.js          # seeded mulberry32 + hash (pure)
│   ├── sim/
│   │   ├── game.js     # newGame(seed), step(G, inp, dt), serialize, deserialize (pure)
│   │   └── bot.js      # an auto-player for tests, balance and attract mode (pure)
│   ├── view/
│   │   └── view.js     # three.js or Canvas 2D; reads G, answers events
│   ├── ui.js           # DOM screens, HUD, toasts, settings, touch deck
│   ├── input.js        # keyboard + gamepad + touch → { x, y, a } and a press queue
│   ├── audio.js        # Web Audio, no files; answers events
│   └── save.js         # guarded localStorage
└── dev/
    ├── README.md       # every harness, its env vars, the debug hooks
    ├── simtest.mjs     # Node: purity, rules, determinism, save round trip, bot + balance
    ├── browsertest.mjs # Chromium: desktop flow, touch phones both ways, blocked storage
    └── play.mjs        # one screenshot after a snippet, for iterating on visuals
```

As the game grows, split by layer, not by feature: `js/sim/world.js`,
`enemies.js`, `bosses.js`, `story.js` and `js/sim/data/*.js` for tables;
`js/view/stage.js` (renderer, camera, post), `models.js`, `fx.js`; `js/ui/hud.js`,
`menus.js`, `dialogue.js`. [game-073](../../game-073/) (three.js) and
[game-075](../../game-075/) (Canvas 2D + WebGL) are good references at full size.

### File: `GAME_DIR/index.html`

For `RENDERER = canvas`, delete the `<script type="importmap">` block; nothing else changes. Add a Google Fonts `<link>` (with `preconnect`) if the game has a typeface; the harnesses answer font requests with an empty stylesheet, so always give a system fallback.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="theme-color" content="#0b0d14">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="description" content="GAME_TITLE — GAME_CONCEPT">
    <title>GAME_TITLE</title>
    <script src="../lib/page-audio.js"></script>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <a id="back-link" href="../index.html">← Games</a>

    <canvas id="view" aria-label="GAME_TITLE game view"></canvas>

    <!-- HUD -->
    <div id="hud" hidden>
        <div id="hud-score">0</div>
        <div id="hud-time">0</div>
        <button id="btn-pause" class="ibtn" aria-label="Pause">❚❚</button>
    </div>

    <!-- Touch deck: shown on coarse pointers or after the first touch -->
    <div id="touch" hidden>
        <div id="stick-zone"><div id="stick"><div class="ring"></div><div class="knob"></div></div></div>
        <button id="btn-a" class="tbtn" aria-label="Action">A</button>
    </div>

    <!-- Screens -->
    <div id="title" class="screen">
        <div class="sheet">
            <h1 class="logo">GAME_TITLE</h1>
            <nav class="menu" id="title-menu">
                <button data-act="continue" id="btn-continue" class="btn primary" hidden>Continue</button>
                <button data-act="new" class="btn primary">New Game</button>
                <button data-act="howto" class="btn">How to Play</button>
                <button data-act="settings" class="btn">Settings</button>
            </nav>
            <div class="version" id="version"></div>
        </div>
    </div>

    <div id="howto" class="screen" hidden>
        <div class="sheet">
            <h2>How to Play</h2>
            <table>
                <tr><td>Arrows / WASD</td><td>Move</td></tr>
                <tr><td>Space / Z</td><td>Action</td></tr>
                <tr><td>P / Esc</td><td>Pause</td></tr>
            </table>
            <p>Touch: drag on the left half to move, tap <b>A</b> for the action. Gamepad: stick or d-pad, A, Start.</p>
            <div class="sheet-foot"><button class="btn primary" data-close>Got it</button></div>
        </div>
    </div>

    <div id="settings" class="screen" hidden>
        <div class="sheet">
            <h2>Settings</h2>
            <label class="row">Sound <input type="range" id="set-sfx" min="0" max="1" step="0.05"></label>
            <label class="row">Music <input type="range" id="set-music" min="0" max="1" step="0.05"></label>
            <label class="row">Touch controls
                <select id="set-touch"><option value="auto">Automatic</option><option value="on">Always</option><option value="off">Never</option></select>
            </label>
            <button id="set-delete" class="btn danger">Delete saved game</button>
            <div class="sheet-foot"><button class="btn primary" data-close>Done</button></div>
        </div>
    </div>

    <div id="pause" class="screen" hidden>
        <div class="sheet">
            <h2>Paused</h2>
            <nav class="menu" id="pause-menu">
                <button data-act="resume" class="btn primary">Resume</button>
                <button data-act="howto" class="btn">How to Play</button>
                <button data-act="settings" class="btn">Settings</button>
                <button data-act="quit" class="btn">Save &amp; Quit to Title</button>
            </nav>
        </div>
    </div>

    <div id="over" class="screen" hidden>
        <div class="sheet">
            <h2>Time!</h2>
            <p id="over-text"></p>
            <div class="sheet-foot"><button id="over-again" class="btn primary">Play Again</button></div>
        </div>
    </div>

    <div id="toasts"></div>
    <noscript><p class="noscript">GAME_TITLE needs JavaScript.</p></noscript>

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

### File: `GAME_DIR/style.css`

```css
/* GAME_TITLE. Phone first: everything fits 360 px wide. */
:root {
    --bg: #0b0d14;
    --panel: rgba(16, 20, 34, 0.94);
    --line: rgba(255, 255, 255, 0.18);
    --text: #eef2ff;
    --dim: #9aa4c4;
    --accent: #ffcc4d;
    --safe-t: env(safe-area-inset-top, 0px);
    --safe-b: env(safe-area-inset-bottom, 0px);
    --safe-l: env(safe-area-inset-left, 0px);
    --safe-r: env(safe-area-inset-right, 0px);
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body {
    margin: 0; padding: 0; height: 100%;
    background: var(--bg); color: var(--text);
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    overflow: hidden; overscroll-behavior: none;
    user-select: none; -webkit-user-select: none;
}
[hidden] { display: none !important; }

/* The view sizes the canvas in px from JS. Never 100vw/100vh: on phones 100vh is taller than
   the visible area, and taps land below the finger. */
#view { position: fixed; left: 0; top: 0; display: block; touch-action: none; }

#back-link {
    position: fixed; top: calc(8px + var(--safe-t)); left: calc(8px + var(--safe-l)); z-index: 99999;
    font: 13px Arial, Helvetica, sans-serif; color: #fff; text-decoration: none;
    background: rgba(0, 0, 0, 0.55); padding: 6px 12px; border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.25);
}
#back-link:hover { background: rgba(0, 0, 0, 0.8); }

/* ---------------------------------------------------------------- buttons */
.btn, .ibtn, .tbtn {
    font: inherit; color: var(--text); cursor: pointer;
    min-height: 44px; min-width: 44px;           /* finger-sized */
    border: 1px solid var(--line); border-radius: 10px;
    background: rgba(255, 255, 255, 0.08);
}
.btn { padding: 10px 18px; font-size: 16px; }
.btn.primary { background: var(--accent); color: #1a1405; border-color: transparent; font-weight: 700; }
.btn.danger { border-color: #ff6b6b; color: #ffb3b3; }
.btn:focus-visible, .ibtn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* ---------------------------------------------------------------- HUD */
#hud {
    position: fixed; z-index: 10; pointer-events: none;
    top: calc(8px + var(--safe-t)); right: calc(8px + var(--safe-r)); left: calc(110px + var(--safe-l));
    display: flex; justify-content: flex-end; align-items: center; gap: 14px;
    font-weight: 700; font-size: 20px; text-shadow: 0 2px 4px #000;
}
#hud .ibtn { pointer-events: auto; }

/* ---------------------------------------------------------------- touch deck */
#touch { position: fixed; inset: 0; z-index: 20; pointer-events: none; }
#stick-zone { position: absolute; left: 0; bottom: 0; width: 50%; height: 60%; pointer-events: auto; touch-action: none; }
#stick { position: absolute; width: 0; height: 0; opacity: 0.35; left: 90px; bottom: 120px; }
#stick.on { opacity: 0.9; }
#stick .ring { position: absolute; width: 120px; height: 120px; left: -60px; top: -60px; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.5); }
#stick .knob { position: absolute; width: 54px; height: 54px; left: -27px; top: -27px; border-radius: 50%; background: rgba(255, 255, 255, 0.55); }
.tbtn {
    position: absolute; pointer-events: auto; touch-action: none;
    right: calc(24px + var(--safe-r)); bottom: calc(40px + var(--safe-b));
    width: 76px; height: 76px; border-radius: 50%; font-size: 22px; font-weight: 700;
    background: rgba(255, 204, 77, 0.3);
}

/* ---------------------------------------------------------------- screens */
.screen {
    position: fixed; inset: 0; z-index: 50;
    display: flex; align-items: center; justify-content: center;
    /* top padding clears the fixed back link, so a scrolled button never sits under it */
    padding: calc(52px + var(--safe-t)) calc(12px + var(--safe-r)) calc(12px + var(--safe-b)) calc(12px + var(--safe-l));
    background: rgba(5, 7, 12, 0.55); overflow-y: auto;
}
.sheet {
    width: min(460px, 100%); max-height: 100%; overflow-y: auto; touch-action: pan-y;
    background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 18px;
}
.sheet h1, .sheet h2 { margin: 0 0 12px; }
.logo { font-size: clamp(32px, 9vw, 56px); text-align: center; color: var(--accent); letter-spacing: 0.04em; }
.menu { display: flex; flex-direction: column; gap: 10px; }
.sheet-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; }
.row { display: flex; justify-content: space-between; align-items: center; gap: 12px; min-height: 44px; }
.version { text-align: center; color: var(--dim); font-size: 12px; margin-top: 12px; }
table { border-collapse: collapse; width: 100%; }
td { padding: 6px 4px; border-bottom: 1px solid var(--line); }
td:first-child { color: var(--accent); white-space: nowrap; }

#toasts { position: fixed; left: 50%; bottom: calc(16px + var(--safe-b)); transform: translateX(-50%); z-index: 60; pointer-events: none; display: flex; flex-direction: column; gap: 6px; align-items: center; }
.toast { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 8px 14px; animation: toast 2.4s forwards; }
@keyframes toast { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
.noscript { position: fixed; inset: 0; display: grid; place-items: center; }
```

### File: `GAME_DIR/js/config.js`

```js
// GAME_TITLE — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'SAVE_SLUG.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const FIELD = { w: 32, h: 18 };    // world units; the view fits this to any screen
export const PLAYER = { speed: 9, radius: 0.6 };
export const PICKUP = { radius: 0.45, count: 5, score: 10 };
export const ROUND = { seconds: 60 };
```

### File: `GAME_DIR/js/rng.js`

```js
// Seeded randomness. The simulation never calls Math.random: one seed rebuilds the same game.

/** mulberry32 with a saveable state. */
export function makeRng(seed) {
    let a = seed >>> 0;
    const rng = () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rng.int = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
    rng.pick = (arr) => arr[Math.floor(rng() * arr.length)];
    rng.range = (lo, hi) => lo + rng() * (hi - lo);
    rng.state = () => a;
    rng.setState = (s) => { a = s | 0; };
    return rng;
}

/** Integer hash of a few numbers → [0, 1). Stateless, so it never shifts with call order. */
export function hash3(x, y, z = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
```

### File: `GAME_DIR/js/sim/game.js`

```js
// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.

import { FIELD, PLAYER, PICKUP, ROUND } from '../config.js';
import { makeRng } from '../rng.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function newGame(seed = 1) {
    const G = {
        v: 1,                       // save format version
        seed,
        rng: makeRng(seed),
        t: 0,
        score: 0,
        over: false,
        player: { x: FIELD.w / 2, y: FIELD.h / 2, vx: 0, vy: 0, dash: 0 },
        pickups: [],
        events: [],                 // { type, ... } since the last drain; never saved
    };
    for (let i = 0; i < PICKUP.count; i++) spawnPickup(G);
    return G;
}

function spawnPickup(G) {
    G.pickups.push({ x: G.rng.range(1, FIELD.w - 1), y: G.rng.range(1, FIELD.h - 1) });
}

/** Advance one fixed step. inp = { x, y, a }: x and y in [-1, 1] (y down), a = pressed since the last step. */
export function step(G, inp, dt) {
    if (G.over) return;
    G.t += dt;
    const p = G.player;
    const len = Math.hypot(inp.x, inp.y);
    const k = len > 1 ? 1 / len : 1;              // diagonals are not faster
    if (inp.a && p.dash <= 0) { p.dash = 0.25; G.events.push({ type: 'dash' }); }
    const speed = PLAYER.speed * (p.dash > 0 ? 2.2 : 1);
    p.dash = Math.max(0, p.dash - dt);
    p.vx = inp.x * k * speed;
    p.vy = inp.y * k * speed;
    p.x = clamp(p.x + p.vx * dt, PLAYER.radius, FIELD.w - PLAYER.radius);
    p.y = clamp(p.y + p.vy * dt, PLAYER.radius, FIELD.h - PLAYER.radius);

    for (let i = G.pickups.length - 1; i >= 0; i--) {
        const c = G.pickups[i];
        if (Math.hypot(c.x - p.x, c.y - p.y) < PLAYER.radius + PICKUP.radius) {
            G.pickups.splice(i, 1);
            G.score += PICKUP.score;
            G.events.push({ type: 'pickup', x: c.x, y: c.y });
            spawnPickup(G);
        }
    }
    if (G.t >= ROUND.seconds) {
        G.over = true;
        G.events.push({ type: 'over', score: G.score });
    }
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}
```

### File: `GAME_DIR/js/sim/bot.js`

```js
// An auto-player. It plays through the same input the player uses, so the tests, the balance
// table and an attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.

export function makeBot({ skill = 1 } = {}) {
    return { skill, target: null };
}

export function botInput(G, bot) {
    const p = G.player;
    // commit to a target until it is gone, or the bot dithers between two across a boundary
    if (!bot.target || !G.pickups.includes(bot.target)) {
        let best = null, bd = Infinity;
        for (const c of G.pickups) {
            const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
            if (d < bd) { bd = d; best = c; }
        }
        bot.target = best;
    }
    const t = bot.target;
    if (!t) return { x: 0, y: 0, a: false };
    const dx = t.x - p.x, dy = t.y - p.y, l = Math.hypot(dx, dy) || 1;
    return { x: (dx / l) * bot.skill, y: (dy / l) * bot.skill, a: false };
}
```

### File: `GAME_DIR/js/save.js`

```js
// Saves and settings in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.6, touch: 'auto' };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveGame(G) { return !G.over && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }
```

### File: `GAME_DIR/js/input.js`

```js
// Keyboard, gamepad and touch merged into one state, { x, y, a }, plus an ordered queue of presses.
//
// - Held directions are read every frame.
// - Action presses are *edges* that stay set until a simulation step consumes them: a frame
//   shorter than the fixed step runs no step, and a tap made in it must not be lost.
// - Menu presses go into a FIFO, one consumed per frame: at 2 fps "Down, Down, Enter" must not
//   collapse into one frame's worth of keys.

const ACTION_KEYS = ['Space', 'KeyZ', 'KeyJ'];
const NO_SCROLL = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
const PAD_KEYS = { 0: 'Enter', 1: 'Escape', 9: 'KeyP', 12: 'ArrowUp', 13: 'ArrowDown' };

export class Input {
    constructor() {
        this.keys = new Set();
        this.queue = [];                    // { key } in the order they were pressed
        this.edges = { a: false };
        this.stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
        this.pad = { x: 0, y: 0, prev: [] };
        this.lastDevice = 'keys';
        this.onTouch = null;                // called once when a touch is first seen

        window.addEventListener('keydown', (e) => {
            const tag = e.target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            // Space and the arrows must not scroll the page, but Space must still press a focused
            // button: preventDefault() on it cancels the click (game-078)
            if (NO_SCROLL.includes(e.code) && !(e.code === 'Space' && tag === 'BUTTON')) e.preventDefault();
            this.lastDevice = 'keys';
            if (e.repeat) return;
            this.queue.push({ key: e.code });
            if (ACTION_KEYS.includes(e.code)) this.edges.a = true;
            this.keys.add(e.code);
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.clear());
        // Capture phase, so a touch on any menu switches the touch deck on before play starts.
        window.addEventListener('pointerdown', (e) => {
            if (e.pointerType !== 'touch' || this.lastDevice === 'touch') return;
            this.lastDevice = 'touch';
            this.onTouch?.();
        }, { capture: true });
    }

    /** A floating stick: zone captures the thumb, el is the visual ring, knob follows the thumb. */
    bindStick(zone, el, knob) {
        const R = () => Math.min(70, Math.max(48, window.innerWidth * 0.12));
        const end = (e) => {
            if (e.pointerId !== this.stick.id) return;
            this.stick.active = false;
            this.stick.x = this.stick.y = 0;
            knob.style.transform = '';
            el.classList.remove('on');
        };
        zone.addEventListener('pointerdown', (e) => {
            if (this.stick.active) return;
            e.preventDefault();
            const r = zone.getBoundingClientRect();
            Object.assign(this.stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0 });
            el.style.left = `${e.clientX - r.left}px`;
            el.style.top = `${e.clientY - r.top}px`;
            el.style.bottom = 'auto';
            el.classList.add('on');
            try { zone.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        });
        zone.addEventListener('pointermove', (e) => {
            if (!this.stick.active || e.pointerId !== this.stick.id) return;
            e.preventDefault();
            const rad = R();
            let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
            const d = Math.hypot(dx, dy);
            if (d > rad) {
                // drag the base along so the thumb never runs off the end
                const k = (d - rad) / d;
                this.stick.ox += dx * k; this.stick.oy += dy * k;
                const r = zone.getBoundingClientRect();
                el.style.left = `${this.stick.ox - r.left}px`;
                el.style.top = `${this.stick.oy - r.top}px`;
                dx = e.clientX - this.stick.ox; dy = e.clientY - this.stick.oy;
            }
            this.stick.x = dx / rad; this.stick.y = dy / rad;
            knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });
        for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, end);
    }

    /** A touch button that acts on finger-down (a click waits for the lift and feels late). */
    bindButton(btn, onPress) {
        btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onPress(); });
    }

    pressA() { this.edges.a = true; }

    _pollPad() {
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = [...pads].find((p) => p && p.connected);
        if (!gp) { this.pad.x = this.pad.y = 0; return; }
        const b = (i) => !!gp.buttons[i]?.pressed;
        const dead = (v) => (Math.abs(v) > 0.25 ? v : 0);
        this.pad.x = b(14) ? -1 : b(15) ? 1 : dead(gp.axes[0] || 0);
        this.pad.y = b(12) ? -1 : b(13) ? 1 : dead(gp.axes[1] || 0);
        for (const i in PAD_KEYS) {
            if (b(+i) && !this.pad.prev[i]) { this.queue.push({ key: PAD_KEYS[i], pad: true }); this.lastDevice = 'pad'; }
            this.pad.prev[i] = b(+i);
        }
        if (b(0) && !this.pad.prev.a) this.edges.a = true;
        this.pad.prev.a = b(0);
    }

    /** The held state for this frame. Edges stay set until consumeEdges(). */
    state() {
        this._pollPad();
        const k = this.keys;
        let x = (k.has('ArrowRight') || k.has('KeyD') ? 1 : 0) - (k.has('ArrowLeft') || k.has('KeyA') ? 1 : 0);
        let y = (k.has('ArrowDown') || k.has('KeyS') ? 1 : 0) - (k.has('ArrowUp') || k.has('KeyW') ? 1 : 0);
        if (this.pad.x || this.pad.y) { x = this.pad.x; y = this.pad.y; }
        if (this.stick.active) {
            const sx = this.stick.x, sy = this.stick.y;
            if (Math.hypot(sx, sy) > 0.2) { x = sx; y = sy; }
        }
        return { x, y, a: this.edges.a };
    }

    consumeEdges() { this.edges.a = false; }
    /** The next queued press, or null. Menus take one per frame. */
    next() { return this.queue.shift() || null; }
    /** Drop queued presses, so a mashed key can't fall through into the next screen. */
    flush() { this.queue.length = 0; this.edges.a = false; }
    clear() {
        this.keys.clear();
        this.flush();
        this.stick.active = false;
        this.stick.x = this.stick.y = 0;
    }
}
```

### File: `GAME_DIR/js/audio.js`

A starting point. [docs/generic/sounds.md](../../docs/generic/sounds.md) has the recipes the later games use: a look-ahead sequencer for music, generated melodies, reverb from a noise impulse, ambience.

```js
// Procedural sound, all Web Audio, no files. Effects answer simulation events.
// The context is made on the first user gesture (browsers block audio before one), and
// ../lib/page-audio.js suspends it while the tab is hidden.

export class Audio {
    constructor() {
        this.ctx = null;
        this.sfxVol = 0.8;
        this.musicVol = 0.6;
    }

    init() {
        if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = this.ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 4;
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxVol; this.sfx.connect(comp);
        this.music = ctx.createGain(); this.music.gain.value = this.musicVol * 0.5; this.music.connect(comp);
    }

    setVolumes(sfx, music) {
        this.sfxVol = sfx; this.musicVol = music;
        if (!this.ctx) return;
        this.sfx.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.02);
        this.music.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.02);
    }

    /** One enveloped oscillator: a blip, a sweep or a thud. */
    tone({ freq = 440, to = freq, dur = 0.12, type = 'square', vol = 0.2, delay = 0 } = {}) {
        if (!this.ctx || this.ctx.state !== 'running') return;
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(this.sfx);
        o.start(t); o.stop(t + dur + 0.02);
    }

    ui(kind) {
        if (kind === 'click') this.tone({ freq: 660, dur: 0.05, type: 'triangle', vol: 0.12 });
        else if (kind === 'open') this.tone({ freq: 440, to: 660, dur: 0.08, type: 'triangle', vol: 0.12 });
        else if (kind === 'close') this.tone({ freq: 660, to: 440, dur: 0.08, type: 'triangle', vol: 0.12 });
    }

    onEvents(G, events) {
        for (const e of events) {
            if (e.type === 'pickup') this.tone({ freq: 880, to: 1320, dur: 0.1, vol: 0.15 });
            else if (e.type === 'dash') this.tone({ freq: 220, to: 110, dur: 0.15, type: 'sawtooth', vol: 0.12 });
            else if (e.type === 'over') [523, 659, 784].forEach((f, i) => this.tone({ freq: f, dur: 0.25, type: 'triangle', delay: i * 0.12 }));
        }
    }
}
```

### File: `GAME_DIR/js/ui.js`

```js
// The DOM layer: screens, the HUD, toasts, settings and the touch deck. Reads the sim; never changes it.

import { VERSION, ROUND } from './config.js';

const $ = (id) => document.getElementById(id);

export class UI {
    constructor({ audio, settings, onSettings, onDeleteSave }) {
        this.audio = audio;
        this.settings = settings;
        this.stack = [];                   // open screens, top last
        this.touchOn = false;
        $('version').textContent = 'v' + VERSION;

        // A press that began outside a screen (the finger that opened it) must not click inside it
        // when it lifts. Keyboard clicks have detail 0 and always count.
        this.downIn = null;
        window.addEventListener('pointerdown', (e) => { this.downIn = e.target.closest('.screen'); }, { capture: true });
        for (const el of document.querySelectorAll('.screen')) {
            el.addEventListener('click', (e) => {
                if (e.detail && this.downIn !== el) { e.stopImmediatePropagation(); e.preventDefault(); }
            }, { capture: true });
        }
        for (const b of document.querySelectorAll('[data-close]')) {
            b.addEventListener('click', () => { audio.ui('close'); this.closeTop(); });
        }

        const sfx = $('set-sfx'), music = $('set-music'), touch = $('set-touch');
        sfx.value = settings.sfx; music.value = settings.music; touch.value = settings.touch;
        const changed = () => {
            Object.assign(settings, { sfx: +sfx.value, music: +music.value, touch: touch.value });
            onSettings(settings);
        };
        for (const el of [sfx, music, touch]) el.addEventListener('change', changed);
        $('set-delete').addEventListener('click', () => { onDeleteSave(); this.toast('Saved game deleted.'); });
    }

    // ------------------------------------------------------------------ screens
    openScreen(id) {
        if (this.top() === id) return;
        $(id).hidden = false;
        this.stack = this.stack.filter((s) => s !== id).concat(id);
        this.focusFirst(id);
    }
    closeScreen(id) {
        $(id).hidden = true;
        this.stack = this.stack.filter((s) => s !== id);
        if (this.top()) this.focusFirst(this.top());
    }
    closeTop() { if (this.top()) this.closeScreen(this.top()); }
    top() { return this.stack[this.stack.length - 1] || null; }
    anyScreen() { return this.stack.length > 0; }

    buttons(id) { return [...$(id).querySelectorAll('button, select, input')].filter((b) => !b.hidden && b.offsetParent !== null); }
    focusFirst(id) { this.buttons(id)[0]?.focus({ preventScroll: true }); }
    /** Arrow keys move focus through the top screen's controls; Enter is the browser's own click. */
    moveFocus(dir) {
        const list = this.buttons(this.top());
        if (!list.length) return;
        const i = list.indexOf(document.activeElement);
        list[(i + dir + list.length) % list.length].focus();
    }

    // ------------------------------------------------------------------ HUD
    showHud(on) { $('hud').hidden = !on; this.setTouch(this.touchOn, on); }
    hud(G) {
        $('hud-score').textContent = G.score;
        $('hud-time').textContent = Math.max(0, Math.ceil(ROUND.seconds - G.t));
    }
    setTouch(on, playing = !$('hud').hidden) {
        this.touchOn = on;
        $('touch').hidden = !(on && playing);
    }
    toast(text) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = text;
        $('toasts').appendChild(el);
        setTimeout(() => el.remove(), 2500);
    }
    onEvents(G, events) {
        for (const e of events) if (e.type === 'over') $('over-text').textContent = `You collected ${G.score / 10} sparks.`;
    }
}
```

### File: `GAME_DIR/js/view/view.js` (RENDERER = three)

For post-processing, outlines, instancing and the gotchas, see [docs/threejs/threejs-api.md](../../docs/threejs/threejs-api.md). If you add `UnrealBloomPass`, clamp every `pow()` base in your shaders (Step 5).

```js
// The three.js view: reads G every frame and turns sim events into effects. Never changes G.
// Sim (x, y) maps to world (x, 0, y): the camera looks down at the field from the south.

import * as THREE from 'three';
import { FIELD, PLAYER, PICKUP } from '../config.js';

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setClearColor(0x0b0d14);
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0b0d14, 30, 70);   // near and far are set in resize()
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);

        this.scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x20182a, 0.9));
        const sun = new THREE.DirectionalLight(0xffffff, 1.6);
        sun.position.set(8, 20, 10);
        this.scene.add(sun);

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(FIELD.w, FIELD.h),
            new THREE.MeshStandardMaterial({ color: 0x1d2440, roughness: 0.9 }),
        );
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(FIELD.w / 2, 0, FIELD.h / 2);
        this.scene.add(floor);

        this.player = new THREE.Mesh(
            new THREE.SphereGeometry(PLAYER.radius, 24, 16),
            new THREE.MeshStandardMaterial({ color: 0x6fe0ff, emissive: 0x0a3040 }),
        );
        this.scene.add(this.player);

        // One draw call for every pickup; the matrix of each instance follows G.pickups.
        this.pickups = new THREE.InstancedMesh(
            new THREE.OctahedronGeometry(PICKUP.radius),
            new THREE.MeshStandardMaterial({ color: 0xffcc4d, emissive: 0x664400 }),
            32,
        );
        this.scene.add(this.pickups);
        this.tmp = new THREE.Object3D();
        this.flash = 0;

        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        if (w === this.w && h === this.h) return;
        this.w = w; this.h = h;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.setSize(w, h);          // also sets the canvas CSS size in px (no 100vh trap)
        this.camera.aspect = w / h;
        // Fit the whole field at any aspect, portrait phones included.
        const fitH = Math.max(FIELD.h, FIELD.w / this.camera.aspect) * 0.62;
        const dist = fitH / Math.tan((this.camera.fov * Math.PI) / 360);
        this.camera.position.set(FIELD.w / 2, dist * 0.9, FIELD.h / 2 + dist * 0.45);
        this.camera.lookAt(FIELD.w / 2, 0, FIELD.h / 2);
        // Fog and the far plane follow the fitted distance: a portrait phone backs the camera off
        // far enough that fixed fog would hide the whole field.
        this.camera.far = dist * 4;
        this.scene.fog.near = dist * 1.2;
        this.scene.fog.far = dist * 3;
        this.camera.updateProjectionMatrix();
    }

    onEvents(G, events) {
        for (const e of events) if (e.type === 'pickup') this.flash = 1;
    }

    frame(G, dt, time) {
        this.resize();
        const p = G.player;
        this.player.position.set(p.x, PLAYER.radius, p.y);
        this.flash = Math.max(0, this.flash - dt * 4);
        this.player.scale.setScalar(1 + this.flash * 0.3);
        G.pickups.forEach((c, i) => {
            this.tmp.position.set(c.x, 0.6 + Math.sin(time * 3 + i) * 0.15, c.y);
            this.tmp.rotation.y = time * 2 + i;
            this.tmp.updateMatrix();
            this.pickups.setMatrixAt(i, this.tmp.matrix);
        });
        this.pickups.count = G.pickups.length;
        this.pickups.instanceMatrix.needsUpdate = true;
        this.renderer.render(this.scene, this.camera);
    }
}
```

### File: `GAME_DIR/js/view/view.js` (RENDERER = canvas)

For pixel art at a fixed virtual resolution, draw into a small canvas scaled with `image-rendering: pixelated` and put text on a second, full-resolution canvas over it (game-076), or bake procedural sprites once and draw them with `imageSmoothingEnabled = false` (game-075).

```js
// The Canvas 2D view: reads G every frame and turns sim events into effects. Never changes G.
// The field is fitted to the window, letterboxed, and drawn at device resolution.

import { FIELD, PLAYER, PICKUP } from '../config.js';

export class View {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.flash = 0;
        this.resize();
        const onResize = () => this.resize();
        window.addEventListener('resize', onResize);
        window.visualViewport?.addEventListener('resize', onResize);
    }

    resize() {
        const vv = window.visualViewport;
        const w = Math.max(1, Math.round(vv ? vv.width : innerWidth));
        const h = Math.max(1, Math.round(vv ? vv.height : innerHeight));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (w === this.w && h === this.h && dpr === this.dpr) return;
        this.w = w; this.h = h; this.dpr = dpr;
        // CSS size in px, never 100vw/100vh; backing store at device pixels.
        this.canvas.style.width = w + 'px';
        this.canvas.style.height = h + 'px';
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        // world units → CSS px, with a margin for the HUD
        this.scale = Math.min(w / (FIELD.w + 2), (h - 56) / (FIELD.h + 2));
        this.ox = (w - FIELD.w * this.scale) / 2;
        this.oy = 56 + (h - 56 - FIELD.h * this.scale) / 2;
    }

    /** Screen (client) px → world units, through the canvas's own rect. */
    toWorld(clientX, clientY) {
        const r = this.canvas.getBoundingClientRect();
        return { x: (clientX - r.left - this.ox) / this.scale, y: (clientY - r.top - this.oy) / this.scale };
    }

    onEvents(G, events) {
        for (const e of events) if (e.type === 'pickup') this.flash = 1;
    }

    frame(G, dt, time) {
        this.resize();
        const { ctx, scale: s } = this;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = '#0b0d14';
        ctx.fillRect(0, 0, this.w, this.h);
        ctx.translate(this.ox, this.oy);
        ctx.fillStyle = '#1d2440';
        ctx.fillRect(0, 0, FIELD.w * s, FIELD.h * s);

        ctx.fillStyle = '#ffcc4d';
        G.pickups.forEach((c, i) => {
            const r = PICKUP.radius * s * (1 + Math.sin(time * 4 + i) * 0.12);
            ctx.beginPath();
            ctx.moveTo(c.x * s, c.y * s - r); ctx.lineTo(c.x * s + r, c.y * s);
            ctx.lineTo(c.x * s, c.y * s + r); ctx.lineTo(c.x * s - r, c.y * s);
            ctx.fill();
        });

        this.flash = Math.max(0, this.flash - dt * 4);
        const p = G.player;
        ctx.fillStyle = '#6fe0ff';
        ctx.beginPath();
        ctx.arc(p.x * s, p.y * s, PLAYER.radius * s * (1 + this.flash * 0.3), 0, Math.PI * 2);
        ctx.fill();
    }
}
```

### File: `GAME_DIR/js/main.js`

```js
// GAME_TITLE — entry point. Boots the view, runs the fixed-step simulation, routes input and
// events, and moves between the title, play, pause and game over.
//
// ?debug=1 exposes window.DEBUG_NS for the dev/ harnesses; &fast=N runs N× simulation per frame.

import { STEP, MAX_FRAME } from './config.js';
import { View } from './view/view.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { loadSettings, saveSettings, hasSave, saveGame, loadGame, clearSave } from './save.js';
import { newGame, step } from './sim/game.js';
import { makeBot, botInput } from './sim/bot.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.get('debug') === '1';
const FAST = DEBUG ? Math.max(1, Math.min(40, +(params.get('fast') || 1))) : 1;

const settings = loadSettings();
const audio = new Audio();
audio.setVolumes(settings.sfx, settings.music);
const input = new Input();
const view = new View(document.getElementById('view'));
const ui = new UI({
    audio, settings,
    onSettings: (s) => { saveSettings(s); audio.setVolumes(s.sfx, s.music); updateTouch(); },
    onDeleteSave: () => { clearSave(); refreshTitle(); },
});

let G = newGame(1);          // the title screen shows a game in the background
let mode = 'title';          // title | play | over
let acc = 0;
let time = 0;
let last = performance.now();
let saveT = 0;
let bot = null;
let wasRunning = false;
const seen = {};             // a count of every sim event drained, for the tests

// ------------------------------------------------------------------ menus
function refreshTitle() { document.getElementById('btn-continue').hidden = !hasSave(); }
refreshTitle();
ui.openScreen('title');

const unlock = () => audio.init();
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlock, { capture: true });

document.getElementById('title-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'new') startGame(newGame((Date.now() % 1e9) | 0));
    else if (act === 'continue') {
        const g = loadGame();
        if (g) startGame(g); else ui.toast('That save could not be read.');
    } else ui.openScreen(act);
});
document.getElementById('pause-menu').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    audio.ui('click');
    const act = b.dataset.act;
    if (act === 'resume') ui.closeScreen('pause');
    else if (act === 'quit') { saveGame(G); toTitle(); }
    else ui.openScreen(act);
});
document.getElementById('btn-pause').addEventListener('click', () => pause());
document.getElementById('over-again').addEventListener('click', () => { audio.ui('click'); startGame(newGame((Date.now() % 1e9) | 0)); });

function startGame(g) {
    G = g;
    for (const id of [...ui.stack]) ui.closeScreen(id);
    // a focused button would swallow Space and Enter for the whole game
    document.activeElement?.blur?.();
    mode = 'play';
    acc = 0;
    input.flush();
    ui.showHud(true);
    updateTouch();
    saveGame(G);
}

function toTitle() {
    for (const id of [...ui.stack]) ui.closeScreen(id);
    mode = 'title';
    ui.showHud(false);
    G = newGame(1);
    refreshTitle();
    ui.openScreen('title');
}

function pause() {
    if (mode !== 'play' || ui.anyScreen()) return;
    audio.ui('open');
    saveGame(G);
    ui.openScreen('pause');
}

function updateTouch() {
    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    ui.setTouch(settings.touch === 'on' || (settings.touch === 'auto' && (coarse || input.lastDevice === 'touch')));
}
input.onTouch = updateTouch;
input.bindStick(document.getElementById('stick-zone'), document.getElementById('stick'), document.querySelector('#stick .knob'));
input.bindButton(document.getElementById('btn-a'), () => input.pressA());

// ------------------------------------------------------------------ input routing
function handlePresses() {
    const press = input.next();               // one per frame: presses never merge
    if (!press) return;
    const key = press.key;
    if (ui.anyScreen()) {
        if (key === 'ArrowDown') ui.moveFocus(1);
        else if (key === 'ArrowUp') ui.moveFocus(-1);
        else if ((key === 'Escape' || key === 'KeyP') && ui.top() !== 'title' && ui.top() !== 'over') { audio.ui('close'); ui.closeTop(); }
        else if (key === 'Enter' && press.pad) document.activeElement?.click?.();
        return;
    }
    if (mode === 'play' && (key === 'Escape' || key === 'KeyP')) pause();
}

// ------------------------------------------------------------------ events
function flushEvents() {
    if (!G.events.length) return;
    const ev = G.events.splice(0);
    for (const e of ev) seen[e.type] = (seen[e.type] || 0) + 1;
    view.onEvents(G, ev);
    audio.onEvents(G, ev);
    ui.onEvents(G, ev);
    if (ev.some((e) => e.type === 'over')) {
        mode = 'over';
        clearSave();
        ui.showHud(false);
        ui.openScreen('over');
    }
}

// ------------------------------------------------------------------ frame loop
function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    time += dt;
    handlePresses();

    const running = mode === 'play' && !ui.anyScreen();
    // back from a menu: the key or tap that closed it must not also act in the game (game-078)
    if (running && !wasRunning) input.flush();
    wasRunning = running;
    if (running) {
        acc += dt * FAST;
        let n = 0;
        while (acc >= STEP && n < 12 * FAST) {
            const inp = bot ? botInput(G, bot) : input.state();
            step(G, inp, STEP);
            input.consumeEdges();             // only once a step has seen them
            acc -= STEP;
            n++;
        }
        saveT += dt;
        if (saveT > 20) { saveT = 0; saveGame(G); }
    } else acc = 0;
    flushEvents();
    view.frame(G, dt, time);
    if (mode === 'play') ui.hud(G);
}

document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { if (mode === 'play') saveGame(G); });

requestAnimationFrame((t) => { last = t; frame(t); });

// ------------------------------------------------------------------ debug hooks (?debug=1)
if (DEBUG) {
    window.DEBUG_NS = {
        get G() { return G; },
        get mode() { return mode; },
        seen, view, ui, audio, input,
        start(seed = 1) { startGame(newGame(seed)); return G; },
        autoplay(on = true) { bot = on ? makeBot() : null; },
        /** Run the sim ahead synchronously with the bot playing; events reach the view as usual. */
        ff(sec) { const b = makeBot(); for (let t = 0; t < sec && !G.over; t += STEP) step(G, botInput(G, b), STEP); flushEvents(); },
        save: () => saveGame(G),
        hasSave,
    };
}
```

### File: `GAME_DIR/dev/simtest.mjs`

```js
/**
 * simtest.mjs — headless checks of GAME_TITLE's simulation. No browser.
 *
 *   node GAME_FOLDER/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node GAME_FOLDER/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node GAME_FOLDER/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: moving, walls, pickups and scoring, the dash, the round ending.
 * 3. determinism: the same seed and inputs give the same game; a save round trip mid-game
 *    plays on identically.
 * 4. bot: the bot plays a whole round on SEEDS seeds with per-step invariants (finite numbers,
 *    nothing outside the field) and the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 8);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const NONE = { x: 0, y: 0, a: false };

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    ok(G.pickups.length === C.PICKUP.count, 'a new game has every pickup');
    const x0 = G.player.x;
    run(G, { x: 1, y: 0, a: false }, 0.5);
    ok(Math.abs(G.player.x - (x0 + C.PLAYER.speed * 0.5)) < 0.1, 'moves right at PLAYER.speed');
    run(G, { x: 1, y: 0, a: false }, 10);
    ok(G.player.x <= C.FIELD.w - C.PLAYER.radius + 1e-9, 'stops at the wall');
    run(G, { x: 1, y: 1, a: false }, 0.2);
    ok(Math.hypot(G.player.vx, G.player.vy) <= C.PLAYER.speed + 1e-6, 'diagonals are no faster');

    G = Gm.newGame(2);
    const c = G.pickups[0];
    G.player.x = c.x; G.player.y = c.y;
    Gm.step(G, NONE, DT);
    ok(G.score === C.PICKUP.score, 'touching a pickup scores');
    ok(G.pickups.length === C.PICKUP.count, 'a new pickup replaces it');
    ok(G.events.some((e) => e.type === 'pickup'), 'and emits a pickup event');

    G = Gm.newGame(3);
    Gm.step(G, { x: 1, y: 0, a: true }, DT);
    ok(G.player.dash > 0 && G.events.some((e) => e.type === 'dash'), 'the action button dashes');

    G = Gm.newGame(4);
    run(G, NONE, C.ROUND.seconds + 1);
    ok(G.over && G.events.some((e) => e.type === 'over'), 'the round ends on time');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), 20); return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');

    const G = Gm.newGame(7);
    const bot = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, bot), 10);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, b1), 10);
    run(copy, (g) => Bt.botInput(g, b2), 10);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.6]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill });
            let bad = null;
            while (!G.over) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                G.events.length = 0;
                const p = G.player;
                if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) bad = 'non-finite position';
                else if (p.x < 0 || p.y < 0 || p.x > C.FIELD.w || p.y > C.FIELD.h) bad = 'outside the field';
                if (bad) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ seed: s, skill, score: G.score });
        }
    }
    const avg = (k) => Math.round(rows.filter((r) => r.skill === k).reduce((a, r) => a + r.score, 0) / SEEDS);
    ok(avg(1) > avg(0.6), 'a better bot scores more');
    ok(avg(1) >= 200, `the perfect bot scores at least 200 (got ${avg(1)})`);
    console.log(`  ${rows.length} rounds · average score: perfect ${avg(1)}, skill 0.6 ${avg(0.6)}`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
```

### File: `GAME_DIR/dev/browsertest.mjs`

For a Canvas 2D game the three.js routing does nothing and can stay. Under SwiftShader Playwright's own `click()` waits forever for frames to settle, so the test clicks from inside the page; real touches go through CDP `Input.dispatchTouchEvent`.

```js
/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game by
 *   click → real key presses move the player → Escape pauses and the sim stops → Resume →
 *   the action key dashes → Save & Quit → Continue restores the game → the round ends →
 *   Play Again. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the
 *   touch deck appears, the stick moves the player, A dashes, controls ≥ 44 px and on screen,
 *   no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server PORT          # from the REPO ROOT
 *   node GAME_FOLDER/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:PORT), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:PORT';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    if (PKG) {
        // No network to the CDN? Serve the genuine three.js package from disk.
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/GAME_FOLDER/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.DEBUG_NS && DEBUG_NS.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport;
    const c = document.getElementById('view').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => DEBUG_NS.mode === 'play' && document.getElementById('title').hidden, 'New Game starts play');

    const x0 = await Q(page, () => DEBUG_NS.G.player.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => DEBUG_NS.G.player.x > x + 2, 'holding → moves the player right', 30000, x0);
    await page.keyboard.up('ArrowRight');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => DEBUG_NS.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => DEBUG_NS.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden && DEBUG_NS.G.t > 0, 'Resume closes the pause screen');

    await page.keyboard.press('Space');
    await until(page, () => DEBUG_NS.seen.dash >= 1, 'Space dashes (the press reaches a sim step)');

    await shot(page, 'desktop-play');
    const score = await Q(page, () => { DEBUG_NS.ff(5); return DEBUG_NS.G.score; });
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => DEBUG_NS.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => DEBUG_NS.mode === 'play' && DEBUG_NS.G.score === s, 'Continue restores the saved game', 30000, score);

    await Q(page, () => DEBUG_NS.ff(120));
    await until(page, () => DEBUG_NS.mode === 'over' && !document.getElementById('over').hidden, 'the round ends and shows the score');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => DEBUG_NS.mode === 'play' && DEBUG_NS.G.t < 5, 'Play Again starts a fresh round');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => DEBUG_NS.mode === 'play', 'a tap on New Game starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#btn-a', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // drag the stick right with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => DEBUG_NS.G.player.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => DEBUG_NS.G.player.x > x + 1, 'dragging the stick moves the player', 30000, x0);
    await touch('touchEnd', 0, 0);

    const dashes = await Q(page, () => DEBUG_NS.seen.dash || 0);
    await tapSel('#btn-a');
    await until(page, (n) => (DEBUG_NS.seen.dash || 0) > n, 'tapping A dashes', 30000, dashes);
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => DEBUG_NS.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => DEBUG_NS.ff(3));
    check(await Q(page, () => DEBUG_NS.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);
```

### File: `GAME_DIR/dev/play.mjs`

```js
/**
 * play.mjs — open the real game, run a snippet, take a screenshot. For iterating on visuals.
 *
 *   node GAME_FOLDER/dev/play.mjs <name> "<js run after boot>" [waitMs] [w h] [touch]
 *   node GAME_FOLDER/dev/play.mjs start "DEBUG_NS.start(3); DEBUG_NS.ff(5); return DEBUG_NS.G.score" 800
 *   node GAME_FOLDER/dev/play.mjs phone "DEBUG_NS.start(3)" 800 390 844 touch
 *
 * The snippet runs with ?debug=1, so window.DEBUG_NS is there (see dev/README.md). It is the body of
 * an async function: `return` a value to print it. Q='&fast=4' adds URL parameters.
 * Screenshot: GAME_FOLDER/dev/shots/<name>.png.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:PORT';
const [name = 'shot', code = '', wait = '1000', w = '1280', h = '760', touch = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const isTouch = touch === 'touch';
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/GAME_FOLDER/index.html?debug=1${process.env.Q || ''}`);
await page.waitForFunction(() => window.DEBUG_NS, null, { timeout: 60000 });
if (code) {
    const out = await page.evaluate(`(async () => { ${code} })()`);
    if (out !== undefined) console.log(JSON.stringify(out, null, 1));
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();
```

### File: `GAME_DIR/dev/README.md`

Keep it current: every later script (a `shot.mjs`, a `probe.mjs`, a gallery page) gets a row, and every debug hook a mention.

````markdown
# GAME_TITLE — dev harnesses

Plain Node scripts, no build step, no test framework. Run from the repo root.

| Command | What it does |
|---|---|
| `node GAME_FOLDER/dev/simtest.mjs` | Headless, in Node. **purity**: `js/sim/`, `js/rng.js` and `js/config.js` never touch the DOM, a renderer, storage, `Math.random` or the clock. **rules**: moving, walls, pickups, the dash, the round ending. **determinism**: same seed and inputs → same game; a save round trip plays on identically. **bot**: the bot plays whole rounds on `SEEDS` seeds with per-step invariants and prints the balance table. `ONLY=purity,rules,determinism,bot`, `SEEDS=n`, `VERBOSE=1`. |
| `node GAME_FOLDER/dev/browsertest.mjs` | Real Chromium + WebGL (SwiftShader). **desktop**: title and back link, New Game, real keys move and dash, pause freezes the sim, Save & Quit → Continue, the round ends, Play Again. **phones** (touch only, real CDP touches) at 390×844 and 844×390: taps through menus, the touch deck, the stick moves, A dashes, controls ≥ 44 px, no sideways scroll, the canvas matches the visible viewport. **nostorage**: boots and plays with `localStorage` throwing. Fails on any console error, page error or failed request. `ONLY=desktop,phones,nostorage`. Screenshots in `dev/shots/`. |
| `node GAME_FOLDER/dev/play.mjs name "js" [waitMs] [w h] [touch]` | Opens the game with `?debug=1`, runs a snippet (`return` prints a value), screenshots to `dev/shots/name.png`. |

The browser scripts need `playwright` and a static server on port PORT:

```bash
python3 -m http.server PORT          # repo root
mkdir -p dev/node_modules && ln -s "$(npm root -g)/playwright" dev/node_modules/playwright
ln -s ../../dev/node_modules GAME_FOLDER/dev/node_modules
```

No network to unpkg.com? `npm pack three@0.165.0 && tar xzf three-0.165.0.tgz && mv package dev/package` (repo root); the scripts serve three.js from there, or set `THREE_PKG`. Chromium somewhere unusual? Set `PW_CHROMIUM_PATH`.

SwiftShader draws a few frames a second and the loop caps a frame at 0.05 s, so the tests open the game with `&fast=4` and wait on state, never on the clock. Passing tests don't mean the screen shows anything: look at the screenshots.

## Debug hooks (`?debug=1`)

`window.DEBUG_NS`: `G` (the game), `mode`, `seen` (a count of every sim event drained), `view`, `ui`, `audio`, `input`, `start(seed)` (skips the title), `autoplay(on)` (the bot plays the real game), `ff(seconds)` (run the sim ahead with the bot), `save()`, `hasSave()`. `&fast=N` runs N× the simulation per frame; it does nothing without `debug=1`.
````

### File: `GAME_DIR/game-plan.md` (sim/view version)

Write a real design document, not a stub: the later games' plans run 100 to 700
lines, and the story, the content tables and the balance notes all live here.
Keep it true as the game changes; it is what the next agent reads first.

```markdown
# GAME_TITLE

**Genre:** [derive from concept]
**Engine:** three.js r165, no asset files   ← or "Vanilla JS: Canvas 2D, no asset files" if RENDERER = canvas
**Status:** v1.0.0 in progress

---

## Concept

GAME_CONCEPT

[What the player does minute to minute, what they're working toward, and the tone. Name the games it riffs on.]

## Core loop

[One run, round, level or day from start to finish.]

## Mechanics

### [Mechanic]
[Rules precise enough to write a sim test against.]

## Content

[Tables: enemies, levels, items, upgrades, characters. Numbers go in js/config.js or js/sim/data/; this says what they are for.]

## Story

[Optional. Characters, chapters, the ending. A defined ending, or say plainly that the game is endless.]

## Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Move | Arrows / WASD | Stick / d-pad | Drag on the left half |
| Action | Space / Z | A | A button |
| Pause | P / Esc | Start | ❚❚ |

## Look and sound

[Palette, camera, models or sprites (all procedural), post-processing. Music and effects (all Web Audio).]

## Module overview

| Path | Responsibility |
|---|---|
| `js/main.js` | Boot, modes, the fixed-step loop, input routing, debug hooks |
| `js/sim/` | Pure simulation: no DOM, renderer, `Math.random` or clock. `game.js` rules, `bot.js` auto-player |
| `js/view/` | Reads the sim and answers its events |
| `js/ui.js` | DOM screens, HUD, settings, touch deck |
| `js/input.js`, `js/audio.js`, `js/save.js`, `js/rng.js`, `js/config.js` | Input merge, sound, guarded storage, seeded RNG, tuning |

## Testing

See [dev/README.md](dev/README.md). `simtest.mjs` checks purity, the rules, determinism and save round trips, and has the bot play [the whole game]. `browsertest.mjs` drives the real game on desktop, touch-only phones in both orientations and with storage blocked.

## Balance notes

[What the bot found and what was changed because of it.]

## Open questions / next steps

- A human pass on real hardware: the bot is not a person, and SwiftShader is not a GPU.

## Changelog

### v1.0.0 (YYYY-MM-DD)
- First release: [one line per feature].
```

Fill in today's date where `YYYY-MM-DD` appears.


### Growing the placeholder into the game

- **Rules** go in `js/sim/`. Keep `newGame(seed)`, `step(G, inp, dt)`,
  `serialize`/`deserialize` and `G.events`. Anything random takes `G.rng`;
  anything procedural takes a seed.
- **Every rule gets a line in `simtest.mjs`** under `rules`, and the bot learns to
  play it. Tune difficulty against the bot at two skill levels and print the
  table (the `bot` section does); a mortal bot that never dies, or a
  perfect one that can't finish, is a design bug.
- **Generated content gets proved.** Levels reachable, puzzles solvable (a planner
  over lock states, game-075), tracks drivable (game-069): check it over many
  seeds in `simtest.mjs`, and reject a bad seed at generation time.
- **Every screen and control gets a step in `browsertest.mjs`** on desktop and on
  the phones, driven by real keys, clicks and touches.
- **Add a dev gallery page** once there are models, sprites or portraits:
  `dev/models.html`, `dev/sprites.html` or `dev/gallery.html` renders them on a
  neutral background, and `dev/shot.mjs` screenshots it. Judging a character
  under bloom and coloured rim lights hid broken anatomy in game-074.

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

## Step 3: Add it to the collection

A new game touches six files outside its own folder. Every "Add game-NNN" commit from
057 to 076 changed all six; missing one leaves a hole someone finds later (game-030 was
built but never listed; game-038 shipped without its card style).

1. **`js/gamedata.js`**: append an entry to the `games` array before the closing `];`. Set `genre` to one of `arcade`, `puzzle`, `dungeon`, `rpg`, `story`, `strategy` or `cozy` — it decides which path of the 3D garden launcher the game's statue stands on (the garden grows to fit; see `garden/js/genres.js`). New games start at `version: '1.0.0'` (shown as a badge next to the title). The description can be long: the later games use a full paragraph, and the garden and the classic grid both show it. Make the last tag the renderer (`three.js`, `Canvas 2D`, `Kaplay`, …).
   ```js
   {
       id: 'GAME_FOLDER',
       title: 'GAME_TITLE',
       description: 'GAME_CONCEPT',
       icon: '[pick a fitting emoji]',
       folder: 'GAME_FOLDER',
       version: '1.0.0',
       cssClass: '[kebab-case of game title]',
       genre: '[arcade|puzzle|dungeon|rpg|story|strategy|cozy]',
       tags: [
           { emoji: '[emoji]', label: '[genre]' },
           { emoji: '[emoji]', label: '[style]' },
           { emoji: '🧊', label: 'three.js' }
       ]
   },
   ```
2. **`css/styles.css`**: a card style for `cssClass`, after the last game's, before `footer {`. Two rules, a background for the preview and the carousel, and a themed play button:
   ```css
   .game-preview.CSS_CLASS,
   .carousel-slide-bg.CSS_CLASS {
       background: [a gradient that evokes the game: its sky, its palette];
   }

   .game-card.CSS_CLASS .play-button {
       background: linear-gradient(135deg, [two or three of the game's colours]);
       color: [readable on that];
       box-shadow: 0 0 14px [the glow colour];
   }
   ```
3. **`README.md`**: bump the count in "Games Included" (`N games, game-001 through game-NNN`) and add a row to the games table: `| NNN | [GAME_TITLE](GAME_FOLDER/) | one-line pitch | three.js |`.
4. **`status.md`**: bump the count in the launcher note and add a row: `| [GAME_FOLDER](GAME_FOLDER/index.html) | GAME_TITLE | **Complete** / Solid / Prototype | what is in it; what the harnesses check; Open: what isn't done |`. Be honest in "Open" (the later games all say balance was tuned by a bot and the game has only run under SwiftShader).
5. **`CHANGELOG.md`**: under `## [Unreleased]`, an `### Added` entry: `**GAME_TITLE** (GAME_FOLDER) v1.0.0: ...`, with sub-bullets for the systems, the look, the sound and the tests, linking the files. Then a line for the launcher entry and one for any docs.
6. **`docs/`**: what you learned that the next game should know, in [docs/generic/learnings.md](../../docs/generic/learnings.md) (or the engine's doc, or [sounds.md](../../docs/generic/sounds.md)), attributed to the game; refresh its line in [docs/README.md](../../docs/README.md). See "Maintaining these docs" in that README. If a learning changes how games should be scaffolded, update this skill too.

---

## Step 4: Confirm

After creating all files, report:
1. List every file created (with full path).
2. State which engine and layout were used (Sim/view with three.js or Canvas 2D, Kaplay, Phaser 4, Three.js minimal, or Vanilla 3D).
3. Note any TODOs the user should address next (e.g., filling in `game-plan.md`, replacing the placeholder rules).
4. Run the checks (all from the repo root):
   ```bash
   head -c 20 GAME_DIR/index.html           # expect: <!DOCTYPE html>
   grep -c '← Games' GAME_DIR/index.html     # expect: 1, pointing at ../index.html
   python3 -m http.server 8000 &             # not npx serve, see below
   ONLY=GAME_FOLDER node dev/smoketest.mjs
   NOSTORAGE=1 ONLY=GAME_FOLDER node dev/smoketest.mjs
   ```
   For Section 2S also run the game's own harnesses (see `GAME_DIR/dev/README.md` for the Playwright link and the offline three.js package):
   ```bash
   node GAME_FOLDER/dev/simtest.mjs
   python3 -m http.server PORT &
   node GAME_FOLDER/dev/browsertest.mjs
   ```
   **Then open the screenshots in `GAME_DIR/dev/shots/` and look at them.** A browser
   test that checks state passes with a blank screen: while this scaffold was being
   written, the portrait-phone run passed every check while fixed fog hid the whole
   field.
5. All of these load as ES modules, so opening `index.html` from `file://` fails with CORS errors. Serve it.

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
5. **If the page renders stray text**, check the file's first bytes (step 4
   above) rather than assuming a screenshot artifact. Browsers hoist pre-doctype
   text out of `<body>`, so a `document.body.childNodes` check will **not** find
   it — use `document.body.innerText` instead. This exact mistake was made on
   game-036.

> **Serving gotcha:** don't use `npx serve` for this repo. It 301-redirects
> `/GAME_FOLDER/index.html` → `/GAME_FOLDER/index` → `/GAME_FOLDER`, and the
> fallback serves the **root launcher**, whose scripts then throw confusing
> errors that look like they come from your game. Use
> `python3 -m http.server 8000` (or VS Code Live Server) instead.

---

## Step 5: Before you call it done

Each of these shipped in one of games 057–076 and needed a patch release. Check the
game against the list before the first commit, and add a test for anything that
applies. Details and code are in [docs/generic/learnings.md](../../docs/generic/learnings.md)
§ "Games 057–076" and the per-game sections.

**Phones and input**
- [ ] Taps land under the finger: canvas sized in px, pointers mapped through its `getBoundingClientRect()` (game-058, game-067).
- [ ] A fast tap is never dropped: presses carried to the next sim step (game-059, game-071).
- [ ] A *held* button (fire, jump) is latched too: a keydown and keyup in the same frame, before any step runs, still fire or jump once (game-079).
- [ ] A queued key or a double-tap that closes a dialogue doesn't also act in the world: swallow the rest of the frame and ~250 ms of real time (game-073).
- [ ] Space presses a focused menu button: a keydown handler that calls `preventDefault()` on Space to stop scrolling also cancels the button's click, so Resume and Play Again did nothing from the keyboard (game-078). Test it with a real key press, not `element.click()`.
- [ ] A menu opened by a finger-down button doesn't close when the finger lifts (game-071).
- [ ] The touch deck is on before the first stage, not after the first touch on it (game-074).
- [ ] No sheet scrolls a button under the fixed `← Games` link (game-073); centre panels stay on screen on a 390 px phone (game-062); HUD gauges sit next to what they describe in both orientations (game-066).
- [ ] Right-click menus open on `contextmenu` and cancel it; opening on `pointerdown` lets the browser's own menu appear on top (game-076).
- [ ] An off-screen drawer (`translateX(105%)`) doesn't make its scroller scrollable: `overflow: clip` and `contain: paint` on its container, or `scrollIntoView()` pans the room sideways on a phone (game-087).
- [ ] A browser test that taps a button in a sheet with a pop-in animation finishes the animation first (`el.getAnimations().forEach(a => a.finish())` up the tree): SwiftShader may not have drawn a frame of it, and the tap lands on the next button (game-088). And a visibility check can't use `offsetParent` on a `position: fixed` screen: it is always null.
- [ ] On-screen button labels match the keys (the cabinet said A B C; the keys were Z X C, game-075).
- [ ] A drag that moves the camera never also places or builds; a press that wandered ~10 px isn't a tap (game-067).

**Rendering (three.js)**
- [ ] Every `pow()` base in a shader is clamped to [0, 1]; with bloom, a single NaN pixel smears into a blinking box. SwiftShader doesn't produce the NaN, so headless tests never show it (game-065). A colour set with `.copy(0xff8800)` instead of `.set()` is NaN too (game-074).
- [ ] Hand-built geometry is wound counter-clockwise from outside, or every barrel and pillar looks hollow (game-071's shared cylinder).
- [ ] A part that is tilted and spun gets a holder group for the tilt; one mesh with both rotations spins about the wrong axis (game-073's drill).
- [ ] Bloom's threshold is above 1 in a sunlit scene: the composer works in linear HDR before tone mapping, so bright sand under a 2.4 sun blooms into a milky haze over everything (game-088). Let only emissive, `toneMapped: false` glows cross it.
- [ ] A leaf or banner drawn from both sides gets a second set of vertices for its back: one set with both windings averages its normals to zero, which is NaN in the shader (game-088's palm fronds).
- [ ] Only the parts meant to move are registered as moving; auto-collecting everything with a `userData` reference spun whole buildings (game-066).
- [ ] Vehicles and characters are posed from the ground sampled under them, not from a banking angle with a sign to get wrong (game-069).
- [ ] A third-person camera's wall check samples densely and includes its end point (game-071).
- [ ] Indoors, the outside world is hidden, or the sea shows through the floor (game-071).
- [ ] Characters are judged on a neutral dev page before they go under bloom and coloured lights (game-074); portraits are checked for faces that read wrong (game-073's beard read as a huge grin).

**Rules and content**
- [ ] Every loop that consumes a list stops when a pass makes no progress (Take All froze game-071).
- [ ] A handler that can reset the world (a warp, a level change, a game over) returns out of the loop that called it: a pickup that warped replaced the list `stepItems` was iterating (game-082).
- [ ] A platformer's levels are proved reachable by jumping with the real body mover, not by geometry: a jump graph also proves where bubbles or loot gather can be reached, and that nothing falls through the wrap forever (game-082's `nav.js`).
- [ ] Hints and quests never point at something still locked (game-076); the simtest checks every one.
- [ ] Nothing empty silently overrides something real (a blank later event page replaced a chest, game-076).

**Collection**
- [ ] All six files of Step 3 are updated, and `dev/smoketest.mjs` passes with and without storage.

---

## Step 6: Changing a game later

- Bump `version` in `js/gamedata.js` (and `VERSION` in the game's `config.js`, if it has one): the minor for new features, the patch for fixes.
- Add the version to the game's `game-plan.md` changelog and a `### Fixed` or `### Added` entry to the root `CHANGELOG.md` that leads with the symptom a player saw ("cars sit flat on banked turns"), then the cause.
- Add a test that fails without the fix, in `simtest.mjs` or `browsertest.mjs`.
- If the cause is a trap the next game could fall into, add it to the docs and, if it belongs on the Step 5 list, here.
