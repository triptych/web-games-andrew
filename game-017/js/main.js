/**
 * Pixel Picross — classic nonogram puzzle game.
 * Engine: Kaplay v4000
 *
 * Scenes:
 *   splash   — title screen
 *   game     — main puzzle (receives puzzleIndex)
 *   complete — all puzzles finished
 *
 * KAPLAY GOTCHAS:
 *  1. entity.pos.x = v  is BROKEN — use entity.pos = k.vec2(x, y)
 *  2. opacity animation requires k.opacity() in the component list at creation
 *  3. Square brackets in k.text() are parsed as style tags — use parentheses
 *  4. k.rgba() does not exist — use k.rgb(r,g,b) for colour assignment
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';
import { PUZZLES } from './puzzles.js';
import { initAudio, playFill, playMark, playWin, playUiClick, playAllComplete } from './sounds.js';

// ─── Canvas ───────────────────────────────────────────────────────────────────

const WIDTH  = 900;
const HEIGHT = 680;

const k = kaplay({
    width:        WIDTH,
    height:       HEIGHT,
    letterbox:    true,
    background:   [12, 14, 22],
    crisp:        true,
    pixelDensity: Math.min(window.devicePixelRatio || 1, 2),
});

// ─── Colour palette ───────────────────────────────────────────────────────────

const C = {
    bg:       [12,  14,  22],
    panel:    [20,  24,  38],
    border:   [40,  48,  72],
    gridLine: [30,  36,  55],
    unknown:  [24,  30,  48],
    hovered:  [36,  44,  68],
    filled:   [210, 220, 255],
    marked:   [55,  32,  32],
    correct:  [60,  200, 110],
    wrong:    [200,  60,  60],
    clue:     [145, 155, 190],
    clueOk:   [60,  160,  90],
    xMark:    [190,  80,  80],
    text:     [220, 225, 245],
    accent:   [100, 185, 255],
    gold:     [255, 215,  55],
    dim:      [68,  76, 108],
};

// ─── Clue helpers ─────────────────────────────────────────────────────────────

function rowClueFor(solution, r) {
    const clue = [];
    let run = 0;
    for (const v of solution[r]) {
        if (v === 1) { run++; }
        else if (run > 0) { clue.push(run); run = 0; }
    }
    if (run > 0) clue.push(run);
    return clue.length ? clue : [0];
}

function colClueFor(solution, c) {
    const clue = [];
    let run = 0;
    for (let r = 0; r < solution.length; r++) {
        if (solution[r][c] === 1) { run++; }
        else if (run > 0) { clue.push(run); run = 0; }
    }
    if (run > 0) clue.push(run);
    return clue.length ? clue : [0];
}

// ─── Scene: splash ────────────────────────────────────────────────────────────

k.scene('splash', () => {
    const CX = WIDTH  / 2;
    const CY = HEIGHT / 2;

    k.add([k.rect(WIDTH, HEIGHT), k.pos(0, 0), k.color(...C.bg), k.z(0)]);

    // Decorative checker background
    const SQ = 56;
    const cols = Math.ceil(WIDTH  / SQ) + 1;
    const rows = Math.ceil(HEIGHT / SQ) + 1;
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const shade = (c + r) % 2 === 0 ? C.panel : C.gridLine;
            k.add([
                k.rect(SQ - 1, SQ - 1),
                k.pos(c * SQ, r * SQ),
                k.color(...shade),
                k.opacity(0.35),
                k.z(0),
            ]);
        }
    }

    k.add([
        k.text('PIXEL PICROSS', { size: 68 }),
        k.pos(CX, CY - 148),
        k.color(...C.gold),
        k.anchor('center'),
        k.z(2),
    ]);

    k.add([
        k.text('Reveal pixel art one square at a time', { size: 18 }),
        k.pos(CX, CY - 84),
        k.color(...C.dim),
        k.anchor('center'),
        k.z(2),
    ]);

    // Controls
    const lines = [
        'Left Click    Fill a square',
        'Right Click   Mark as empty (X)',
        '      R       Restart current puzzle',
        '     ESC      Return to menu',
    ];
    lines.forEach((line, i) => {
        k.add([
            k.text(line, { size: 15 }),
            k.pos(CX, CY - 16 + i * 27),
            k.color(...C.clue),
            k.anchor('center'),
            k.z(2),
        ]);
    });

    k.add([
        k.text(`${PUZZLES.length} puzzles to solve`, { size: 15 }),
        k.pos(CX, CY + 118),
        k.color(...C.dim),
        k.anchor('center'),
        k.z(2),
    ]);

    const prompt = k.add([
        k.text('Press any key or click to start', { size: 20 }),
        k.pos(CX, CY + 160),
        k.color(...C.accent),
        k.anchor('center'),
        k.opacity(1),
        k.z(2),
    ]);
    let t = 0;
    prompt.onUpdate(() => {
        t += k.dt();
        prompt.opacity = 0.38 + 0.62 * ((Math.sin(t * 2.6) + 1) / 2);
    });

    let started = false;

    function goToGame() {
        if (started) return;
        started = true;
        initAudio();
        playUiClick();
        document.removeEventListener('keydown', _onAnyKey);
        k.go('game', 0);
    }

    function _onAnyKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        goToGame();
    }

    document.addEventListener('keydown', _onAnyKey);
    k.onClick(goToGame);
    k.onSceneLeave(() => document.removeEventListener('keydown', _onAnyKey));
});

// ─── Scene: game ──────────────────────────────────────────────────────────────

k.scene('game', (puzzleIndex) => {
    const puzzle   = PUZZLES[puzzleIndex];
    const solution = puzzle.solution;
    const ROWS     = solution.length;
    const COLS     = solution[0].length;

    // ── Compute clues ──────────────────────────────────────────────────────────
    const rowClues = solution.map((_, r) => rowClueFor(solution, r));
    const colClues = solution[0].map((_, c) => colClueFor(solution, c));

    const maxRowNums = Math.max(...rowClues.map(c => c.length));
    const maxColNums = Math.max(...colClues.map(c => c.length));

    // ── Layout ────────────────────────────────────────────────────────────────
    const FONT_SZ   = 13;
    const NUM_W     = FONT_SZ + 5;   // pixels per digit in a row-clue
    const NUM_H     = FONT_SZ + 5;   // pixels per number line in a col-clue
    const CLUE_W    = maxRowNums * NUM_W + 16;   // left margin for row clues
    const CLUE_H    = maxColNums * NUM_H + 14;   // top margin for col clues
    const HEADER_H  = 38;
    const FOOTER_H  = 24;
    const MARGIN    = 28;

    const availW = WIDTH  - CLUE_W  - MARGIN * 2;
    const availH = HEIGHT - CLUE_H  - MARGIN * 2 - HEADER_H - FOOTER_H;
    const CELL   = Math.min(50, Math.floor(availW / COLS), Math.floor(availH / ROWS));

    const gridW  = CELL * COLS;
    const gridH  = CELL * ROWS;
    const ox     = Math.floor((WIDTH  - CLUE_W  - gridW) / 2) + CLUE_W;
    const oy     = Math.floor((HEIGHT - CLUE_H  - gridH) / 2) + CLUE_H + Math.floor(HEADER_H / 2);

    // ── Game state ────────────────────────────────────────────────────────────
    // 0 = unknown, 1 = filled, 2 = marked (X)
    const pg  = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    let won   = false;

    // Drag-paint state
    let dragBtn   = null;   // 'left' | 'right'
    let dragValue = null;   // what we're painting (0, 1, or 2)
    let dragLast  = null;   // 'r,c' key of last painted cell

    // ── Background ────────────────────────────────────────────────────────────
    k.add([k.rect(WIDTH, HEIGHT), k.pos(0, 0), k.color(...C.bg), k.z(0)]);

    // ── Puzzle header ─────────────────────────────────────────────────────────
    k.add([
        k.text(`${puzzle.emoji}  Puzzle ${puzzleIndex + 1} / ${PUZZLES.length}  —  ${puzzle.name}`, { size: 16 }),
        k.pos(WIDTH / 2, 18),
        k.color(...C.text),
        k.anchor('center'),
        k.z(5),
    ]);

    // ── Row clue labels ───────────────────────────────────────────────────────
    const rowClueObjs = rowClues.map((clue, r) => {
        const y = oy + r * CELL + CELL / 2;
        return k.add([
            k.pos(ox - 10, y),
            k.text(clue.join(' '), { size: FONT_SZ }),
            k.color(...C.clue),
            k.anchor('right'),
            k.z(5),
        ]);
    });

    // ── Col clue labels ───────────────────────────────────────────────────────
    const colClueObjs = colClues.map((clue, c) => {
        const x = ox + c * CELL + Math.floor(CELL / 2);
        return k.add([
            k.pos(x, oy - 10),
            k.text(clue.join('\n'), { size: FONT_SZ, align: 'center' }),
            k.color(...C.clue),
            k.anchor('bot'),
            k.z(5),
        ]);
    });

    // ── Grid border rect ──────────────────────────────────────────────────────
    k.add([
        k.rect(gridW + 2, gridH + 2),
        k.pos(ox - 1, oy - 1),
        k.color(...C.border),
        k.z(7),
    ]);

    // ── Per-cell objects ──────────────────────────────────────────────────────
    const PAD   = 1;
    const bgObj = [];   // cell fill rectangles
    const xObj  = [];   // X mark text objects

    for (let r = 0; r < ROWS; r++) {
        bgObj[r] = [];
        xObj[r]  = [];

        for (let c = 0; c < COLS; c++) {
            const px = ox + c * CELL;
            const py = oy + r * CELL;

            // Grid line border
            k.add([k.rect(CELL, CELL), k.pos(px, py), k.color(...C.gridLine), k.z(8)]);

            // Cell fill
            const bg = k.add([
                k.rect(CELL - PAD * 2, CELL - PAD * 2),
                k.pos(px + PAD, py + PAD),
                k.color(...C.unknown),
                k.z(9),
            ]);

            // X mark (initially invisible)
            const xm = k.add([
                k.pos(px + Math.floor(CELL / 2), py + Math.floor(CELL / 2)),
                k.text('x', { size: Math.max(10, Math.floor(CELL * 0.52)) }),
                k.color(...C.xMark),
                k.anchor('center'),
                k.opacity(0),
                k.z(11),
            ]);

            bgObj[r][c] = bg;
            xObj[r][c]  = xm;
        }
    }

    // ── Helper: screen coords → grid cell ────────────────────────────────────
    function cellAt(mx, my) {
        if (mx < ox || mx >= ox + gridW || my < oy || my >= oy + gridH) return null;
        const c = Math.floor((mx - ox) / CELL);
        const r = Math.floor((my - oy) / CELL);
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
        return { r, c };
    }

    // ── Helper: apply a state value to a cell ─────────────────────────────────
    function applyCell(r, c, val) {
        pg[r][c] = val;
        if (val === 1) {
            bgObj[r][c].color = k.rgb(...C.filled);
            xObj[r][c].opacity = 0;
        } else if (val === 2) {
            bgObj[r][c].color = k.rgb(...C.marked);
            xObj[r][c].opacity = 1;
        } else {
            bgObj[r][c].color = k.rgb(...C.unknown);
            xObj[r][c].opacity = 0;
        }
    }

    // ── Win check ────────────────────────────────────────────────────────────
    function checkWin() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if ((solution[r][c] === 1) !== (pg[r][c] === 1)) return;
            }
        }
        won = true;
        onWin();
    }

    // ── Win celebration ───────────────────────────────────────────────────────
    function onWin() {
        const isFinal = puzzleIndex + 1 >= PUZZLES.length;
        if (isFinal) playAllComplete(); else playWin();

        // Flash correct cells green
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (solution[r][c] === 1) {
                    bgObj[r][c].color = k.rgb(...C.correct);
                    xObj[r][c].opacity = 0;
                }
            }
        }
        rowClueObjs.forEach(o => o.color = k.rgb(...C.clueOk));
        colClueObjs.forEach(o => o.color = k.rgb(...C.clueOk));

        const CX = WIDTH  / 2;
        const CY = HEIGHT / 2;

        k.add([
            k.rect(WIDTH, HEIGHT), k.pos(0, 0),
            k.color(0, 0, 0), k.opacity(0.55), k.z(50),
        ]);

        k.add([
            k.text('Solved!', { size: 58 }),
            k.pos(CX, CY - 65),
            k.color(...C.gold),
            k.anchor('center'),
            k.z(51),
        ]);

        k.add([
            k.text(`${puzzle.emoji}  ${puzzle.name}`, { size: 30 }),
            k.pos(CX, CY - 3),
            k.color(...C.text),
            k.anchor('center'),
            k.z(51),
        ]);

        if (!isFinal) {
            k.add([
                k.text('SPACE — next puzzle', { size: 17 }),
                k.pos(CX, CY + 55),
                k.color(...C.accent),
                k.anchor('center'),
                k.z(51),
            ]);
        } else {
            k.add([
                k.text('All puzzles complete!', { size: 20 }),
                k.pos(CX, CY + 55),
                k.color(...C.accent),
                k.anchor('center'),
                k.z(51),
            ]);
            k.add([
                k.text('SPACE — play again from start', { size: 14 }),
                k.pos(CX, CY + 87),
                k.color(...C.dim),
                k.anchor('center'),
                k.z(51),
            ]);
        }

        k.add([
            k.text('R — replay  |  ESC — menu', { size: 13 }),
            k.pos(CX, CY + 118),
            k.color(...C.dim),
            k.anchor('center'),
            k.z(51),
        ]);

        k.onKeyPress('space', () => {
            if (isFinal) { k.go('complete'); }
            else         { k.go('game', puzzleIndex + 1); }
        });
    }

    // ── Mouse: left click — fill/unfill ───────────────────────────────────────
    k.onMousePress('left', () => {
        if (won) return;
        const mp  = k.mousePos();
        const hit = cellAt(mp.x, mp.y);
        if (!hit) return;
        const { r, c } = hit;
        const cur  = pg[r][c];
        dragValue  = cur === 1 ? 0 : 1;
        dragBtn    = 'left';
        dragLast   = `${r},${c}`;
        applyCell(r, c, dragValue);
        playFill();
        checkWin();
    });

    // ── Mouse: right click — mark/unmark ──────────────────────────────────────
    k.onMousePress('right', () => {
        if (won) return;
        const mp  = k.mousePos();
        const hit = cellAt(mp.x, mp.y);
        if (!hit) return;
        const { r, c } = hit;
        const cur  = pg[r][c];
        dragValue  = cur === 2 ? 0 : 2;
        dragBtn    = 'right';
        dragLast   = `${r},${c}`;
        applyCell(r, c, dragValue);
        playMark();
    });

    // ── Mouse: release — end drag ─────────────────────────────────────────────
    k.onMouseRelease('left',  () => { if (dragBtn === 'left')  { dragBtn = null; dragValue = null; dragLast = null; } });
    k.onMouseRelease('right', () => { if (dragBtn === 'right') { dragBtn = null; dragValue = null; dragLast = null; } });

    // ── Mouse: move — drag-paint ──────────────────────────────────────────────
    k.onMouseMove(() => {
        if (won || dragBtn === null) return;
        const mp  = k.mousePos();
        const hit = cellAt(mp.x, mp.y);
        if (!hit) return;
        const key = `${hit.r},${hit.c}`;
        if (key === dragLast) return;
        dragLast = key;
        applyCell(hit.r, hit.c, dragValue);
        if (dragBtn === 'left') { playFill(); checkWin(); }
        else                    { playMark(); }
    });

    // ── Keyboard ──────────────────────────────────────────────────────────────
    k.onKeyPress('r',      () => k.go('game', puzzleIndex));
    k.onKeyPress('escape', () => k.go('splash'));

    // ── Footer hint ───────────────────────────────────────────────────────────
    k.add([
        k.text('Left Click: fill  |  Right Click: mark X  |  R: restart  |  ESC: menu', { size: 11 }),
        k.pos(WIDTH / 2, HEIGHT - 8),
        k.color(...C.dim),
        k.anchor('bot'),
        k.z(5),
    ]);
});

// ─── Scene: complete ──────────────────────────────────────────────────────────

k.scene('complete', () => {
    const CX = WIDTH  / 2;
    const CY = HEIGHT / 2;

    k.add([k.rect(WIDTH, HEIGHT), k.pos(0, 0), k.color(...C.bg), k.z(0)]);

    k.add([
        k.text('All Puzzles Solved!', { size: 56 }),
        k.pos(CX, CY - 110),
        k.color(...C.gold),
        k.anchor('center'),
        k.z(1),
    ]);

    // Show all puzzle emojis in a row
    const emojis = PUZZLES.map(p => p.emoji).join('  ');
    k.add([
        k.text(emojis, { size: 36 }),
        k.pos(CX, CY - 38),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.text(`You completed all ${PUZZLES.length} Pixel Picross puzzles!`, { size: 19 }),
        k.pos(CX, CY + 30),
        k.color(...C.text),
        k.anchor('center'),
        k.z(1),
    ]);

    const prompt = k.add([
        k.text('SPACE — play again  |  ESC — menu', { size: 18 }),
        k.pos(CX, CY + 90),
        k.color(...C.accent),
        k.anchor('center'),
        k.opacity(1),
        k.z(1),
    ]);
    let t = 0;
    prompt.onUpdate(() => {
        t += k.dt();
        prompt.opacity = 0.4 + 0.6 * ((Math.sin(t * 2.4) + 1) / 2);
    });

    k.onKeyPress('space',  () => k.go('game', 0));
    k.onKeyPress('escape', () => k.go('splash'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

k.go('splash');
