/**
 * Crate Pusher — a Sokoban-style puzzle game.
 * Engine: Kaplay v4000
 *
 * Scenes:
 *   splash  — title / controls screen
 *   game    — main puzzle (receives levelIndex)
 *   complete — all levels finished
 *
 * KAPLAY GOTCHAS (from docs/learnings.md):
 *  1. entity.pos.x = v  is BROKEN — use  entity.pos = k.vec2(x, y)
 *  2. opacity animation requires k.opacity() in the component list
 *  3. Square brackets in k.text() are parsed as style tags — use parentheses
 *  4. k.rgba() does not exist — use k.rgb(r,g,b) for draw-param colours
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';
import { LEVELS, LEVEL_NAMES } from './levels.js';

// ─── Canvas ──────────────────────────────────────────────────────────────────

const WIDTH  = 800;
const HEIGHT = 560;
const TILE   = 48;       // max tile size; scales down for wide/tall levels

const k = kaplay({
    width:        WIDTH,
    height:       HEIGHT,
    letterbox:    true,
    background:   [15, 18, 28],
    crisp:        true,
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
});

// ─── Colour palette ──────────────────────────────────────────────────────────
// Arrays used with spread: k.color(...C.wall)

const C = {
    bg:        [15,  18,  28],
    panel:     [22,  26,  40],
    wall:      [55,  62,  80],
    wallHi:    [80,  90, 115],
    floor:     [30,  35,  48],
    target:    [38,  85,  55],
    targetDot: [75, 175,  98],
    crate:     [188, 136,  52],
    crateDk:   [138,  96,  34],
    crateOK:   [65,  195,  88],
    crateOKDk: [42,  145,  60],
    player:    [88,  142, 232],
    playerHi:  [140, 190, 255],
    white:     [255, 255, 255],
    dim:       [148, 155, 178],
    gold:      [255, 208,  55],
    accent:    [96,  196, 255],
};

// ─── Level parsing ────────────────────────────────────────────────────────────

/**
 * Parse a level string-array into separate data structures.
 * Returns { grid, crates, player, rows, cols }.
 * grid[r][c] = '#' | ' ' | '.'
 */
function parseLevel(strings) {
    const rows = strings.length;
    const cols  = Math.max(...strings.map(s => s.length));
    const grid  = [];
    const crates = [];
    let player   = { x: 1, y: 1 };

    for (let r = 0; r < rows; r++) {
        grid[r] = [];
        const line = strings[r] || '';
        for (let c = 0; c < cols; c++) {
            const ch = c < line.length ? line[c] : ' ';
            switch (ch) {
                case '#': grid[r][c] = '#'; break;
                case '.': grid[r][c] = '.'; break;
                case '$': grid[r][c] = ' '; crates.push({ x: c, y: r }); break;
                case '*': grid[r][c] = '.'; crates.push({ x: c, y: r }); break;
                case '@': grid[r][c] = ' '; player = { x: c, y: r };     break;
                case '+': grid[r][c] = '.'; player = { x: c, y: r };     break;
                default:  grid[r][c] = ' '; break;
            }
        }
    }
    return { grid, crates, player, rows, cols };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isWall(grid, x, y) {
    if (y < 0 || y >= grid.length || !grid[y]) return true;
    if (x < 0 || x >= grid[y].length)           return true;
    return grid[y][x] === '#';
}

function crateAt(crates, x, y) {
    return crates.findIndex(c => c.x === x && c.y === y);
}

function isTarget(grid, x, y) {
    return !!(grid[y] && grid[y][x] === '.');
}

function isComplete(grid, crates) {
    return crates.every(c => isTarget(grid, c.x, c.y));
}

// ─── Progress (saved if the browser allows storage) ──────────────────────────

const SAVE_KEY = 'cratePusher_progress';

/** { unlocked: highest playable level index, best: { [levelIndex]: fewest moves } } */
function loadProgress() {
    try {
        const p = JSON.parse(localStorage.getItem(SAVE_KEY));
        if (p && typeof p.unlocked === 'number') return { unlocked: p.unlocked, best: p.best || {} };
    } catch { /* storage blocked or corrupt */ }
    return { unlocked: 0, best: {} };
}

function saveProgress(p) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(p)); } catch { /* storage blocked */ }
}

const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

// ?debug=1 exposes the current scene's state as window.__cp for dev/browsertest.mjs
const DEBUG = new URLSearchParams(location.search).has('debug');

/** A clickable / tappable label button. */
function addButton(label, x, y, w, h, onPress, { size = 18, color = C.accent, z = 20, enabled = true } = {}) {
    const btn = k.add([
        k.rect(w, h, { radius: 6 }),
        k.pos(x, y),
        k.anchor('center'),
        k.color(...C.panel),
        k.outline(2, k.rgb(...(enabled ? color : C.wall))),
        k.area(),
        k.z(z),
        'btn',
    ]);
    // z above the button's own, or the button's fill is drawn over its label
    btn.add([k.text(label, { size }), k.pos(0, 0), k.anchor('center'), k.color(...(enabled ? color : C.wall)), k.z(z + 1)]);
    if (enabled) {
        btn.onClick(onPress);
        btn.onHover(() => { btn.color = k.rgb(...C.wall); });
        btn.onHoverEnd(() => { btn.color = k.rgb(...C.panel); });
    }
    return btn;
}

// ─── Scene: splash ────────────────────────────────────────────────────────────

k.scene('splash', () => {
    if (DEBUG) window.__cp = { scene: 'splash' };
    const CX = WIDTH  / 2;
    const CY = HEIGHT / 2;

    k.add([k.rect(WIDTH, HEIGHT), k.pos(0, 0), k.color(...C.bg)]);

    // Title
    k.add([
        k.text('CRATE PUSHER', { size: 58 }),
        k.pos(CX, CY - 145),
        k.color(...C.gold),
        k.anchor('center'),
        k.z(1),
    ]);

    // Subtitle
    k.add([
        k.text('A Sokoban Puzzle Game', { size: 22 }),
        k.pos(CX, CY - 88),
        k.color(...C.dim),
        k.anchor('center'),
        k.z(1),
    ]);

    // Divider line (thin rect)
    k.add([k.rect(320, 2), k.pos(CX - 160, CY - 58), k.color(...C.dim), k.opacity(0.4), k.z(1)]);

    // Controls
    const controlRows = IS_TOUCH ? [
        'Swipe, or tap beside the pusher, to move',
        'Undo and Restart are in the top bar',
    ] : [
        'Arrow Keys / WASD   Move / Push crates',
        '    U               Undo last move',
        '    R               Restart level',
        '   ESC              Return to menu',
    ];
    controlRows.forEach((line, i) => {
        k.add([
            k.text(line, { size: 17 }),
            k.pos(CX, CY - 30 + i * 28),
            k.color(...C.dim),
            k.anchor('center'),
            k.z(1),
        ]);
    });

    // Level picker: solved levels show their best, locked ones are dimmed
    const progress = loadProgress();
    const startLevel = Math.min(progress.unlocked, LEVELS.length - 1);
    const n = LEVELS.length, bw = 64, gap = 12;
    const x0 = CX - ((n - 1) * (bw + gap)) / 2;
    LEVELS.forEach((_, i) => {
        const open = i <= progress.unlocked;
        const solved = progress.best[i] !== undefined;
        const b = addButton(String(i + 1), x0 + i * (bw + gap), CY + 126, bw, 48, () => k.go('game', i), {
            size: 22, enabled: open, color: solved ? C.crateOK : C.accent, z: 2,
        });
        if (solved) {
            b.add([k.text(String(progress.best[i]), { size: 11 }), k.pos(0, 34), k.anchor('center'), k.color(...C.dim), k.z(3)]);
        }
    });
    k.add([
        k.text(`${LEVELS.length} hand-crafted puzzles  -  green = solved (best moves below)`, { size: 14 }),
        k.pos(CX, CY + 86),
        k.color(...C.dim),
        k.anchor('center'),
        k.z(1),
    ]);

    // Start prompt (blinking)
    const prompt = k.add([
        k.text(IS_TOUCH ? 'Tap a level to play' : `Press SPACE or ENTER to play level ${startLevel + 1}`, { size: 22 }),
        k.pos(CX, CY + 200),
        k.color(...C.accent),
        k.anchor('center'),
        k.opacity(1),
        k.z(1),
    ]);
    let t = 0;
    prompt.onUpdate(() => {
        t += k.dt();
        prompt.opacity = 0.45 + 0.55 * ((Math.sin(t * 2.8) + 1) / 2);
    });

    k.onKeyPress(['space', 'enter'], () => k.go('game', startLevel));
    for (let i = 0; i < Math.min(9, LEVELS.length); i++) {
        k.onKeyPress(String(i + 1), () => { if (i <= progress.unlocked) k.go('game', i); });
    }
});

// ─── Scene: game ──────────────────────────────────────────────────────────────

k.scene('game', (levelIndex) => {
    const data   = parseLevel(LEVELS[levelIndex]);
    const { grid, rows, cols } = data;

    // Compute tile size so the grid fits with UI header (UI_H px) + 16px margin
    const UI_H = IS_TOUCH ? 100 : 58;   // a taller bar gives fingers bigger buttons
    const MARGIN = 16;
    const availW = WIDTH  - MARGIN * 2;
    const availH = HEIGHT - UI_H - MARGIN * 2;
    const T      = Math.min(TILE, Math.floor(availW / cols), Math.floor(availH / rows));

    // Centre the grid below the UI header
    const ox = Math.floor((WIDTH  - cols * T) / 2);
    const oy = UI_H + Math.floor((HEIGHT - UI_H - rows * T) / 2);

    // ── Mutable state ────────────────────────────────────────────────────────
    let player = { ...data.player };
    let crates = data.crates.map(c => ({ ...c }));
    let moves  = 0;
    const history = [];  // undo stack: array of { player, crates, moves }
    let won = false;
    if (DEBUG) {
        window.__cp = {
            scene: 'game', level: levelIndex, tile: T, origin: { x: ox, y: oy },
            get moves() { return moves; }, get player() { return player; }, get won() { return won; },
        };
    }

    function snapshot() {
        return {
            player: { ...player },
            crates: crates.map(c => ({ ...c })),
            moves,
        };
    }

    // ── Static tiles (added once) ─────────────────────────────────────────────
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = grid[r][c];
            const px = ox + c * T;
            const py = oy + r * T;

            if (cell === '#') {
                // Wall body
                k.add([k.rect(T, T), k.pos(px, py), k.color(...C.wall), k.z(0)]);
                // Top highlight strip
                k.add([k.rect(T, Math.max(3, Math.floor(T * 0.07))), k.pos(px, py), k.color(...C.wallHi), k.z(1)]);
            } else {
                // Floor
                k.add([k.rect(T, T), k.pos(px, py), k.color(...C.floor), k.z(0)]);
                if (cell === '.') {
                    // Target tile tint
                    k.add([k.rect(T, T), k.pos(px, py), k.color(...C.target), k.z(1)]);
                    // Cross marker
                    const arm = Math.max(3, Math.floor(T * 0.28));
                    const mx  = px + Math.floor(T / 2) - 2;
                    const my  = py + Math.floor(T / 2) - 2;
                    k.add([k.rect(4, arm * 2), k.pos(mx, my - arm), k.color(...C.targetDot), k.z(2)]);
                    k.add([k.rect(arm * 2, 4), k.pos(mx - arm, my), k.color(...C.targetDot), k.z(2)]);
                }
            }
        }
    }

    // ── Dynamic game objects ──────────────────────────────────────────────────
    const mg = Math.max(2, Math.floor(T * 0.07));  // margin around crate/player

    // Crate objects (index matches crates[])
    const crateObjs = crates.map((c) =>
        k.add([
            k.rect(T - mg * 2, T - mg * 2),
            k.pos(ox + c.x * T + mg, oy + c.y * T + mg),
            k.color(...C.crate),
            k.z(5),
        ])
    );

    // Player object (rounded via radius not available without shader, use smaller rect)
    const playerObj = k.add([
        k.rect(T - mg * 2 - 4, T - mg * 2 - 4),
        k.pos(ox + player.x * T + mg + 2, oy + player.y * T + mg + 2),
        k.color(...C.player),
        k.z(6),
    ]);

    // Dot on player for direction feel
    const playerDot = k.add([
        k.rect(Math.max(4, Math.floor(T * 0.22)), Math.max(4, Math.floor(T * 0.22))),
        k.pos(
            ox + player.x * T + Math.floor(T * 0.35),
            oy + player.y * T + Math.floor(T * 0.35)
        ),
        k.color(...C.playerHi),
        k.z(7),
    ]);

    // ── UI bar ───────────────────────────────────────────────────────────────
    k.add([k.rect(WIDTH, UI_H), k.pos(0, 0), k.color(...C.panel), k.z(10)]);

    k.add([
        k.text(`Level ${levelIndex + 1}  ${LEVEL_NAMES[levelIndex]}`, { size: 18 }),
        k.pos(16, 14),
        k.color(...C.accent),
        k.z(11),
    ]);

    const moveText = k.add([
        k.text('Moves: 0', { size: 21 }),
        k.pos(WIDTH - 16, 14),
        k.color(...C.dim),
        k.anchor('right'),
        k.z(11),
    ]);

    const best = loadProgress().best[levelIndex];
    k.add([
        k.text(best !== undefined ? `Best: ${best}` : 'Unsolved', { size: 15 }),
        k.pos(WIDTH - 16, 40),
        k.color(...C.dim),
        k.anchor('right'),
        k.z(11),
    ]);

    // Buttons for touch and mouse; the keys still work
    const BH = UI_H - 14;
    addButton(IS_TOUCH ? 'Undo' : 'Undo (U)', 340, UI_H / 2, 104, BH, () => undo(), { size: 15, z: 12 });
    addButton(IS_TOUCH ? 'Restart' : 'Restart (R)', 468, UI_H / 2, 124, BH, () => k.go('game', levelIndex), { size: 15, z: 12 });
    addButton('Menu', 586, UI_H / 2, 84, BH, () => k.go('splash'), { size: 15, z: 12 });

    // ── Visual update ─────────────────────────────────────────────────────────
    function refreshVisuals() {
        // Update player positions
        playerObj.pos  = k.vec2(ox + player.x * T + mg + 2, oy + player.y * T + mg + 2);
        playerDot.pos  = k.vec2(
            ox + player.x * T + Math.floor(T * 0.35),
            oy + player.y * T + Math.floor(T * 0.35)
        );

        // Update crate positions and colours
        crates.forEach((c, i) => {
            crateObjs[i].pos   = k.vec2(ox + c.x * T + mg, oy + c.y * T + mg);
            crateObjs[i].color = isTarget(grid, c.x, c.y)
                ? k.rgb(...C.crateOK)
                : k.rgb(...C.crate);
        });

        moveText.text = `Moves: ${moves}`;
    }

    // ── Movement ──────────────────────────────────────────────────────────────
    function tryMove(dx, dy) {
        if (won) return;
        const nx = player.x + dx;
        const ny = player.y + dy;

        if (isWall(grid, nx, ny)) return;

        const ci = crateAt(crates, nx, ny);
        if (ci >= 0) {
            // A crate is in the way — try to push it
            const bx = nx + dx;
            const by = ny + dy;
            if (isWall(grid, bx, by))           return;
            if (crateAt(crates, bx, by) >= 0)  return;

            history.push(snapshot());
            crates[ci] = { x: bx, y: by };
        } else {
            history.push(snapshot());
        }

        player = { x: nx, y: ny };
        moves++;
        refreshVisuals();

        if (isComplete(grid, crates)) {
            won = true;
            showWinOverlay();
        }
    }

    function undo() {
        if (won || history.length === 0) return;
        const snap = history.pop();
        player = snap.player;
        crates = snap.crates;
        moves  = snap.moves;
        refreshVisuals();
    }

    // ── Win overlay ───────────────────────────────────────────────────────────
    function showWinOverlay() {
        const progress = loadProgress();
        const prevBest = progress.best[levelIndex];
        const isBest = prevBest === undefined || moves < prevBest;
        if (isBest) progress.best[levelIndex] = moves;
        progress.unlocked = Math.max(progress.unlocked, Math.min(levelIndex + 1, LEVELS.length - 1));
        saveProgress(progress);

        k.add([k.rect(WIDTH, HEIGHT), k.pos(0, 0), k.color(...C.bg), k.opacity(0.75), k.z(50)]);

        k.add([
            k.text('Level Complete!', { size: 46 }),
            k.pos(WIDTH / 2, HEIGHT / 2 - 55),
            k.color(...C.crateOK),
            k.anchor('center'),
            k.z(51),
        ]);

        k.add([
            k.text(`Solved in ${moves} move${moves === 1 ? '' : 's'}${isBest && prevBest !== undefined ? '  -  new best!' : ''}`, { size: 26 }),
            k.pos(WIDTH / 2, HEIGHT / 2 + 10),
            k.color(...C.white),
            k.anchor('center'),
            k.z(51),
        ]);

        const nextIdx = levelIndex + 1;
        const next = () => { if (won) k.go(nextIdx < LEVELS.length ? 'game' : 'complete', nextIdx); };
        // Tap or click to skip the wait. On release, not press: switching scene
        // in the middle of a touch leaves Kaplay's touch input stuck, and every
        // later swipe is ignored. Armed after a moment so the release that
        // made the winning move doesn't skip straight past this screen.
        k.wait(0.25, () => k.onMouseRelease(next));
        if (nextIdx < LEVELS.length) {
            k.add([
                k.text(`Next: Level ${nextIdx + 1} - ${LEVEL_NAMES[nextIdx]}`, { size: 20 }),
                k.pos(WIDTH / 2, HEIGHT / 2 + 60),
                k.color(...C.dim),
                k.anchor('center'),
                k.z(51),
            ]);
            k.add([
                k.text(IS_TOUCH ? 'Tap or wait to continue...' : 'Click or wait to continue...', { size: 18 }),
                k.pos(WIDTH / 2, HEIGHT / 2 + 90),
                k.color(...C.dim),
                k.anchor('center'),
                k.z(51),
            ]);
            k.wait(2, next);
        } else {
            k.wait(2, next);
        }
    }

    // ── Input ─────────────────────────────────────────────────────────────────
    k.onKeyPress(['left', 'a'],  () => tryMove(-1,  0));
    k.onKeyPress(['right', 'd'], () => tryMove( 1,  0));
    k.onKeyPress(['up', 'w'],    () => tryMove( 0, -1));
    k.onKeyPress(['down', 's'],  () => tryMove( 0,  1));

    // Touch and mouse: swipe to move, or tap a square beside the pusher to step
    // that way (the dominant direction from the pusher to the tap). Kaplay turns
    // touches into mouse events, and mousePos() is already in game coordinates.
    let pressAt = null;
    k.onMousePress(() => {
        const onButton = k.get('btn').some((b) => b.isHovering());
        pressAt = onButton || k.mousePos().y < UI_H ? null : k.mousePos();
    });
    k.onMouseRelease(() => {
        if (!pressAt) return;
        const end = k.mousePos();
        let dx = end.x - pressAt.x, dy = end.y - pressAt.y;
        if (Math.hypot(dx, dy) < 24) {
            // A tap: step towards it, relative to the pusher's centre
            dx = pressAt.x - (ox + (player.x + 0.5) * T);
            dy = pressAt.y - (oy + (player.y + 0.5) * T);
            if (Math.abs(dx) < T / 2 && Math.abs(dy) < T / 2) { pressAt = null; return; }
        }
        pressAt = null;
        if (Math.abs(dx) > Math.abs(dy)) tryMove(Math.sign(dx), 0);
        else tryMove(0, Math.sign(dy));
    });
    k.onKeyPress('u',      undo);
    k.onKeyPress('r',      () => k.go('game', levelIndex));
    k.onKeyPress('escape', () => k.go('splash'));
});

// ─── Scene: complete ──────────────────────────────────────────────────────────

k.scene('complete', () => {
    if (DEBUG) window.__cp = { scene: 'complete' };
    const CX = WIDTH  / 2;
    const CY = HEIGHT / 2;

    k.add([k.rect(WIDTH, HEIGHT), k.pos(0, 0), k.color(...C.bg)]);

    k.add([
        k.text('All Puzzles Solved!', { size: 48 }),
        k.pos(CX, CY - 110),
        k.color(...C.gold),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.text('Every crate has found its target.', { size: 24 }),
        k.pos(CX, CY - 42),
        k.color(...C.white),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.text(`You completed all ${LEVELS.length} levels!`, { size: 20 }),
        k.pos(CX, CY + 10),
        k.color(...C.dim),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([k.rect(280, 2), k.pos(CX - 140, CY + 55), k.color(...C.dim), k.opacity(0.4), k.z(1)]);

    k.add([
        k.text(IS_TOUCH ? 'Tap to play again' : 'Press SPACE or click to play again', { size: 22 }),
        k.pos(CX, CY + 90),
        k.color(...C.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.text(IS_TOUCH ? '' : 'Press ESC for the title screen', { size: 18 }),
        k.pos(CX, CY + 130),
        k.color(...C.dim),
        k.anchor('center'),
        k.z(1),
    ]);

    k.onKeyPress(['space', 'enter'], () => k.go('game', 0));
    k.onKeyPress('escape',          () => k.go('splash'));
    k.wait(0.25, () => k.onMouseRelease(() => k.go('game', 0)));   // on release: see showWinOverlay
});

// ─── Start ────────────────────────────────────────────────────────────────────

k.go('splash');
