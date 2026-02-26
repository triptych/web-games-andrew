/**
 * main.js — Kaplay initialisation and scene definitions.
 *
 * Scenes:
 *   'splash' — Title screen, waits for any key or click
 *   'game'   — Main gameplay scene
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 *
 * Game: Nonogram Fleet
 * Concept: Solve nonogram puzzles to reveal the hidden positions of
 *          enemy spaceships, then fire torpedoes to sink the fleet.
 *          Limited shots per puzzle create tension — every cell counts.
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI } from './ui.js';
import { initAudio, playUiClick } from './sounds.js';
import { initFleet, fireAt } from './fleet.js';
import { initPuzzle, setCell } from './puzzle.js';
import { initGrid, pixelToCell, setFireMode, refreshGrid } from './grid.js';

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
        k.pos(CX, CY - 130),
        k.text('NONOGRAM FLEET', { size: 64 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    // Subtitle
    k.add([
        k.pos(CX, CY - 65),
        k.text('Solve the grid. Sink the fleet.', { size: 18 }),
        k.color(100, 140, 200),
        k.anchor('center'),
        k.z(1),
    ]);

    // Blinking start prompt
    // NOTE: k.opacity(1) MUST be included — setting entity.opacity only works
    // if the opacity component was declared at creation time.
    const prompt = k.add([
        k.pos(CX, CY + 30),
        k.text('PRESS ANY KEY OR CLICK TO START', { size: 16 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.opacity(1),
        k.z(1),
    ]);
    let blinkTimer = 0;
    prompt.onUpdate(() => {
        blinkTimer += k.dt();
        prompt.opacity = (Math.sin(blinkTimer * Math.PI * 1.5) + 1) / 2 * 0.7 + 0.3;
    });

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 2', { size: 10 }),
        k.color(40, 50, 80),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Start on any key or click — go to intro, not directly to game
    let started = false;

    function goToIntro() {
        if (started) return;
        started = true;
        initAudio();
        playUiClick();
        document.removeEventListener('keydown', onAnyKey);
        k.go('intro');
    }

    function onAnyKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        goToIntro();
    }

    document.addEventListener('keydown', onAnyKey);
    k.onClick(goToIntro);
    k.onSceneLeave(() => document.removeEventListener('keydown', onAnyKey));
});

// ============================================================
// SCENE: intro — How to play
// ============================================================

k.scene('intro', () => {
    const CX = GAME_WIDTH / 2;

    // Background
    k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(...COLORS.bg), k.z(0)]);

    // Title
    k.add([
        k.pos(CX, 36),
        k.text('HOW TO PLAY', { size: 36 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    // ── Section 1: The Nonogram ──────────────────────────────
    // Text on the left, diagram on the right — both share the same row.
    const SEC1_Y = 88;
    k.add([
        k.pos(80, SEC1_Y),
        k.text('STEP 1 — SOLVE THE NONOGRAM', { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('topleft'),
        k.z(1),
    ]);
    const solveLines = [
        'Read the clue numbers along each row and column.',
        'They tell you the sizes of consecutive filled blocks in that line.',
        'Left-click a cell to fill it.  Right-click to mark it empty (X).',
        'Fill every ship cell correctly to solve the puzzle.',
        '',
        'Solving the puzzle auto-switches you to Fire Mode.',
    ];
    solveLines.forEach((line, i) => {
        k.add([
            k.pos(96, SEC1_Y + 26 + i * 20),
            k.text(line, { size: 13 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(1),
        ]);
    });

    // Mini nonogram diagram — right column, aligned with section 1
    _drawMiniNonogram(k, 700, SEC1_Y);

    // ── Section 2: The Modes ─────────────────────────────────
    const SEC2_Y = 290;
    k.add([
        k.pos(80, SEC2_Y),
        k.text('STEP 2 — SWITCH MODES  (Tab key or the in-game button)', { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('topleft'),
        k.z(1),
    ]);

    // Solve Mode box — left half
    _drawModeBox(k, 80, SEC2_Y + 28, 'SOLVE MODE', COLORS.accent, [
        'Use the nonogram clues to find the ships.',
        'Left-click to fill a cell, right-click to mark empty.',
        'Solving the puzzle reveals every ship position.',
        'You can fire without solving — but it costs more shots.',
    ]);

    // Fire Mode box — right half
    _drawModeBox(k, 660, SEC2_Y + 28, 'FIRE MODE', COLORS.danger, [
        'Left-click a cell to launch a torpedo.',
        'HIT destroys a ship segment.',
        'MISS wastes a shot.',
        'You have limited shots — every one counts!',
    ]);

    // ── Section 3: Tips ──────────────────────────────────────
    const SEC3_Y = 510;
    k.add([
        k.pos(80, SEC3_Y),
        k.text('TIPS', { size: 16 }),
        k.color(...COLORS.gold),
        k.anchor('topleft'),
        k.z(1),
    ]);
    const tips = [
        'Solve first for guaranteed accuracy — or fire blind and rely on shot count.',
        'Running out of shots costs a life.  Sinking all ships earns bonus points.',
    ];
    tips.forEach((tip, i) => {
        k.add([
            k.pos(96, SEC3_Y + 26 + i * 22),
            k.text(tip, { size: 13 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(1),
        ]);
    });

    // ── Start button ─────────────────────────────────────────
    const btnY = GAME_HEIGHT - 44;
    const btnW = 320;
    const btnH = 44;
    const btnBg = k.add([
        k.pos(CX - btnW / 2, btnY - btnH / 2),
        k.rect(btnW, btnH, { radius: 6 }),
        k.color(20, 60, 120),
        k.outline(2, k.rgb(...COLORS.accent)),
        k.opacity(1),
        k.z(10),
        k.area(),
    ]);
    k.add([
        k.pos(CX, btnY),
        k.text('START MISSION', { size: 18 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(11),
    ]);

    // Hover effect
    btnBg.onHover(() => { btnBg.color = k.rgb(30, 90, 180); });
    btnBg.onHoverEnd(() => { btnBg.color = k.rgb(20, 60, 120); });

    let going = false;
    function startGame() {
        if (going) return;
        going = true;
        playUiClick();
        state.reset();
        document.removeEventListener('keydown', onKey);
        k.go('game');
    }

    btnBg.onClick(startGame);

    function onKey(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        if (e.key === 'Escape') {
            document.removeEventListener('keydown', onKey);
            k.go('splash');
            return;
        }
        startGame();
    }
    document.addEventListener('keydown', onKey);
    k.onSceneLeave(() => document.removeEventListener('keydown', onKey));

    // ESC hint
    k.add([
        k.pos(CX, GAME_HEIGHT - 12),
        k.text('ESC — back to title    any key — start', { size: 11 }),
        k.color(60, 80, 120),
        k.anchor('bot'),
        k.z(1),
    ]);
});

// ============================================================
// SCENE: game
// ============================================================

k.scene('game', () => {
    // resetLevel() preserves score/lives/level across retries and level advances.
    // state.reset() (full wipe) is only called when starting fresh from splash.
    state.resetLevel();

    // --- Setup subsystems ---
    initUI(k);
    initFleet();
    initPuzzle();
    initGrid(k);

    // --- Mode state ---
    let fireMode = false;

    // Mode switch button (bottom-centre)
    const BTN_W = 240;
    const BTN_H = 30;
    const BTN_CX = GAME_WIDTH / 2;
    const BTN_Y  = GAME_HEIGHT - 22;

    const modeBtnBg = k.add([
        k.pos(BTN_CX - BTN_W / 2, BTN_Y - BTN_H / 2),
        k.rect(BTN_W, BTN_H, { radius: 4 }),
        k.color(20, 50, 100),
        k.outline(2, k.rgb(...COLORS.accent)),
        k.opacity(1),
        k.z(100),
        k.area(),
    ]);
    const modeBtnLabel = k.add([
        k.pos(BTN_CX, BTN_Y),
        k.text('SOLVE MODE  (Tab)', { size: 13 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(101),
    ]);

    function _setMode(fire) {
        fireMode = fire;
        setFireMode(fire);
        if (fire) {
            modeBtnLabel.text  = 'FIRE MODE  (Tab)';
            modeBtnLabel.color = k.rgb(...COLORS.danger);
            modeBtnBg.outline  = { width: 2, color: k.rgb(...COLORS.danger) };
        } else {
            modeBtnLabel.text  = 'SOLVE MODE  (Tab)';
            modeBtnLabel.color = k.rgb(...COLORS.accent);
            modeBtnBg.outline  = { width: 2, color: k.rgb(...COLORS.accent) };
        }
    }

    modeBtnBg.onClick(() => {
        if (state.isGameOver || state.isPaused) return;
        _setMode(!fireMode);
    });
    modeBtnBg.onHover(() => { modeBtnBg.color = k.rgb(30, 70, 150); });
    modeBtnBg.onHoverEnd(() => { modeBtnBg.color = k.rgb(20, 50, 100); });

    // --- Puzzle solved: auto-switch to fire mode ---
    const offSolved = events.on('puzzleSolved', () => {
        _showBanner('PUZZLE SOLVED!', COLORS.success, 1.8);
        _setMode(true);
    });

    // --- Level complete / failed: restart after delay ---
    const offComplete = events.on('levelComplete', () => {
        k.wait(2.0, () => {
            events.clearAll();
            state.nextLevel();
            k.go('game');
        });
    });

    const offFailed = events.on('puzzleFailed', () => {
        state.loseLife();
        if (!state.isGameOver) {
            k.wait(2.0, () => {
                events.clearAll();
                k.go('game');
            });
        }
    });

    // --- Mouse input ---
    k.onMousePress('left', () => {
        if (state.isGameOver || state.isPaused) return;
        const mp = k.mousePos();
        const cell = pixelToCell(mp.x, mp.y);
        if (!cell) return;
        const { row, col } = cell;

        if (fireMode) {
            // Fire mode: handled by Space or left-click
            _doFire(row, col);
        } else {
            // Solve mode: toggle filled / null
            const current = state.playerGrid[row][col];
            setCell(row, col, current === 'filled' ? null : 'filled');
        }
    });

    k.onMousePress('right', () => {
        if (state.isGameOver || state.isPaused || fireMode) return;
        const mp = k.mousePos();
        const cell = pixelToCell(mp.x, mp.y);
        if (!cell) return;
        const { row, col } = cell;
        // Toggle empty mark / null
        const current = state.playerGrid[row][col];
        setCell(row, col, current === 'empty' ? null : 'empty');
    });

    // --- Keyboard ---
    k.onKeyPress('tab', () => {
        _setMode(!fireMode);
    });

    k.onKeyPress('space', () => {
        if (!fireMode || state.isGameOver || state.isPaused) return;
        const mp = k.mousePos();
        const cell = pixelToCell(mp.x, mp.y);
        if (cell) _doFire(cell.row, cell.col);
    });

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
        offSolved();
        offComplete();
        offFailed();
        events.clearAll();
    });

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    function _doFire(row, col) {
        if (state.shotsLeft <= 0) return;
        const result = fireAt(row, col);
        if (result === 'already_fired') return;
        refreshGrid();
        if (result === 'hit') {
            _showBanner('HIT!', COLORS.shipHit, 1.2);
        } else {
            _showBanner('MISS', COLORS.accent, 1.0);
        }
    }

    function _showBanner(msg, color, duration) {
        const banner = k.add([
            k.pos(GAME_WIDTH / 2, 50),
            k.text(msg, { size: 32 }),
            k.color(...color),
            k.anchor('center'),
            k.opacity(1),
            k.z(150),
        ]);
        let t = 0;
        const ctrl = banner.onUpdate(() => {
            t += k.dt();
            if (t > duration - 0.3) banner.opacity = Math.max(0, 1 - (t - (duration - 0.3)) / 0.3);
            if (t >= duration) { ctrl.cancel(); k.destroy(banner); }
        });
    }
});

// ============================================================
// Intro helpers
// ============================================================

/**
 * Draw a small 5×5 nonogram example with clues to illustrate how it works.
 * Draws at (ox, oy) using the passed kaplay instance.
 */
function _drawMiniNonogram(k, ox, oy) {
    // Solution: 5×5 grid — an "L" shape ship pattern
    //   row 0: [1,0,0,0,0]  → clue: [1]
    //   row 1: [1,0,0,0,0]  → clue: [1]
    //   row 2: [1,1,1,1,1]  → clue: [5]
    //   row 3: [0,0,0,0,0]  → clue: [0]
    //   row 4: [0,0,0,0,0]  → clue: [0]
    // col clues: [3],[1],[1],[1],[1]
    const GRID = [
        [1,0,0,0,0],
        [1,0,0,0,0],
        [1,1,1,1,1],
        [0,0,0,0,0],
        [0,0,0,0,0],
    ];
    const ROW_CLUES = ['1','1','5','0','0'];
    const COL_CLUES = ['3','1','1','1','1'];
    const CS  = 22;   // cell size
    const CM  = 26;   // clue margin

    // Label
    k.add([
        k.pos(ox, oy),
        k.text('Example:', { size: 12 }),
        k.color(100, 130, 180),
        k.anchor('topleft'),
        k.z(1),
    ]);

    const gx = ox + CM;
    const gy = oy + 16 + CM;

    // Column clues
    for (let c = 0; c < 5; c++) {
        k.add([
            k.pos(gx + c * CS + CS / 2, gy - 6),
            k.text(COL_CLUES[c], { size: 11 }),
            k.color(...COLORS.text),
            k.anchor('bot'),
            k.z(1),
        ]);
    }

    // Row clues + cells
    for (let r = 0; r < 5; r++) {
        k.add([
            k.pos(gx - 6, gy + r * CS + CS / 2),
            k.text(ROW_CLUES[r], { size: 11 }),
            k.color(...COLORS.text),
            k.anchor('right'),
            k.z(1),
        ]);
        for (let c = 0; c < 5; c++) {
            const filled = GRID[r][c] === 1;
            k.add([
                k.pos(gx + c * CS, gy + r * CS),
                k.rect(CS - 2, CS - 2),
                k.color(...(filled ? COLORS.cellFill : COLORS.cellEmpty)),
                k.outline(1, k.rgb(...COLORS.gridLine)),
                k.z(1),
            ]);
        }
    }

    // Annotations (right of the grid only — avoids overflow)
    k.add([
        k.pos(gx + 5 * CS + 8, gy + 0 * CS + (CS - 2) / 2),
        k.text('← row clue "1"', { size: 11 }),
        k.color(...COLORS.gold),
        k.anchor('left'),
        k.z(1),
    ]);
    k.add([
        k.pos(gx + 5 * CS + 8, gy + 2 * CS + (CS - 2) / 2),
        k.text('← row clue "5" = 5 in a row', { size: 11 }),
        k.color(...COLORS.gold),
        k.anchor('left'),
        k.z(1),
    ]);
    k.add([
        k.pos(gx + 0 * CS + (CS - 2) / 2, gy - 22),
        k.text('col "3"', { size: 11 }),
        k.color(...COLORS.accent),
        k.anchor('bot'),
        k.z(1),
    ]);
}

/**
 * Draw a labelled mode-description box.
 */
function _drawModeBox(k, x, y, title, titleColor, lines) {
    const W = 560;
    const H = 110;

    k.add([
        k.pos(x, y),
        k.rect(W, H, { radius: 6 }),
        k.color(14, 20, 44),
        k.outline(2, k.rgb(...titleColor)),
        k.z(2),
    ]);
    k.add([
        k.pos(x + 14, y + 12),
        k.text(title, { size: 15 }),
        k.color(...titleColor),
        k.anchor('topleft'),
        k.z(3),
    ]);
    lines.forEach((line, i) => {
        k.add([
            k.pos(x + 14, y + 36 + i * 19),
            k.text(line, { size: 12 }),
            k.color(...COLORS.text),
            k.anchor('topleft'),
            k.z(3),
        ]);
    });
}

// ============================================================
// Start
// ============================================================

k.go('splash');
