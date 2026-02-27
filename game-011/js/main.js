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

import { GAME_WIDTH, GAME_HEIGHT, COLORS, LEVEL_CONFIGS } from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, initTally, showLevelTally } from './ui.js';
import { initAudio, playMusic, playUiClick, playFire, playMiss } from './sounds.js';
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
// Asset loading
// ============================================================

k.loadSprite('airship', 'sprites/airship.png');

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

    _spawnStarfield();

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
        k.text('Solve the grid. Destroy the armada.', { size: 18 }),
        k.color(100, 140, 200),
        k.anchor('center'),
        k.z(1),
    ]);

    // Airship sprite — centred between subtitle and prompt
    const splashShip = k.add([
        k.pos(CX, CY - 20),
        k.sprite('airship'),
        k.scale(0.053),
        k.anchor('center'),
        k.opacity(1),
        k.z(1),
    ]);
    // Gentle bob animation
    let splashBobTimer = 0;
    splashShip.onUpdate(() => {
        splashBobTimer += k.dt();
        splashShip.pos = k.vec2(CX, CY - 20 + Math.sin(splashBobTimer * 0.8) * 6);
    });

    // Blinking start prompt
    // NOTE: k.opacity(1) MUST be included — setting entity.opacity only works
    // if the opacity component was declared at creation time.
    const prompt = k.add([
        k.pos(CX, CY + 80),
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
        k.text('Phase 3', { size: 10 }),
        k.color(40, 50, 80),
        k.anchor('botright'),
        k.z(1),
    ]);

    // Sprite credit
    k.add([
        k.pos(10, GAME_HEIGHT - 22),
        k.text('Sprite by bevouliin.com', { size: 10 }),
        k.color(40, 50, 80),
        k.anchor('botleft'),
        k.z(1),
    ]);

    // Music credit
    k.add([
        k.pos(10, GAME_HEIGHT - 10),
        k.text('Music by Cleyton Kauffman - soundcloud.com/cleytonkauffman', { size: 10 }),
        k.color(40, 50, 80),
        k.anchor('botleft'),
        k.z(1),
    ]);

    // Start on any key or click — go to intro, not directly to game
    let started = false;

    function goToIntro() {
        if (started) return;
        started = true;
        initAudio();
        playMusic('sounds/Exploration Theme.ogg', 0.5);
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

    _spawnStarfield(80);

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
        'Fill every vessel cell correctly to solve the puzzle.',
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
        'Use the nonogram clues to locate enemy vessels.',
        'Left-click to fill a cell, right-click to mark empty.',
        'Solving the puzzle reveals every vessel position.',
        'You can fire without solving — but it costs more missiles.',
    ]);

    // Fire Mode box — right half
    _drawModeBox(k, 660, SEC2_Y + 28, 'FIRE MODE', COLORS.danger, [
        'Left-click a cell to launch a missile.',
        'HIT destroys a vessel segment.',
        'MISS wastes a missile.',
        'You have limited missiles — every one counts!',
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
        'Solve first for guaranteed accuracy — or fire blind and rely on missile count.',
        'Running out of missiles costs a life.  Destroying all vessels earns bonus points.',
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
        k.go('briefing');
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
// SCENE: briefing — story crawl before mission starts
// ============================================================

k.scene('briefing', () => {
    const CX = GAME_WIDTH  / 2;
    const CY = GAME_HEIGHT / 2;

    k.add([k.pos(0, 0), k.rect(GAME_WIDTH, GAME_HEIGHT), k.color(...COLORS.bg), k.z(0)]);
    _spawnStarfield(100);

    // The story lines — each entry is a paragraph / beat.
    // Empty strings become vertical spacers.
    const STORY = [
        'STARDATE 2247.  SECTOR 7-GAMMA.',
        '',
        'The alien armada has crossed the outer beacon line.',
        'Fourteen dreadnoughts.  Forty escort cruisers.',
        'Earth has less than six hours.',
        '',
        'Every long-range defence platform has been silenced.',
        'Every fleet carrier has been destroyed or retreated.',
        '',
        'Only one vessel remains operational:',
        '',
        'SCOUT SHIP  UES  ARGONAUT  —  DESIGNATION  SC-7.',
        '',
        'You are her crew.  You are her captain.',
        'You are all that stands between the armada',
        'and eight billion lives.',
        '',
        'Argonaut\'s sensor array can pierce the armada\'s',
        'cloaking fields — but only for a fraction of a second.',
        'That fraction is enough.',
        '',
        'Solve the sensor ghost-images.  Pinpoint every hull.',
        'Fire every torpedo with precision.',
        '',
        'One scout ship.  One chance.',
        '',
        'GOOD LUCK,  COMMANDER.',
    ];

    const LINE_H    = 26;   // px per line
    const FONT_SIZE = 16;
    const REVEAL_SPEED = 28; // characters revealed per second
    const SCROLL_DELAY = 1.6; // seconds to pause before crawl begins scrolling

    // We render lines as individual text objects so we can reveal char-by-char
    // and scroll the whole block upward.
    // Start position: lines begin just below bottom of screen, crawl upward
    const START_Y   = GAME_HEIGHT + 30;   // y of top line at t=0
    const SCROLL_PX_PER_SEC = 52;         // px per second the block scrolls up

    // Header
    k.add([
        k.pos(CX, 28),
        k.text('MISSION BRIEFING', { size: 22 }),
        k.color(...COLORS.gold),
        k.anchor('center'),
        k.opacity(1),
        k.z(5),
    ]);

    // Horizontal rule under header
    k.add([
        k.pos(CX - 260, 48),
        k.rect(520, 1),
        k.color(...COLORS.accent),
        k.opacity(0.4),
        k.z(5),
    ]);

    // Mask — opaque strips above and below the scroll window so lines
    // appear to emerge from / fade into the void.
    k.add([k.pos(0, 0),            k.rect(GAME_WIDTH, 60),              k.color(...COLORS.bg), k.z(6)]);
    k.add([k.pos(0, GAME_HEIGHT - 60), k.rect(GAME_WIDTH, 60),          k.color(...COLORS.bg), k.z(6)]);

    // Skip hint
    k.add([
        k.pos(CX, GAME_HEIGHT - 16),
        k.text('SPACE / ENTER — skip to mission', { size: 11 }),
        k.color(60, 80, 120),
        k.anchor('bot'),
        k.z(7),
    ]);

    // Build one text entity per story line
    const lineObjs = STORY.map((line, i) => {
        const col = STORY_LINE_COLOR(line);
        const obj = k.add([
            k.pos(CX, START_Y + i * LINE_H),
            k.text('', { size: FONT_SIZE }),
            k.color(...col),
            k.anchor('center'),
            k.opacity(1),
            k.z(4),
        ]);
        obj._full   = line;        // full string to reveal
        obj._shown  = 0;           // chars revealed so far (float)
        return obj;
    });

    let elapsed    = 0;
    let scrolled   = 0;   // total px scrolled so far
    let done       = false;

    function _launch() {
        if (done) return;
        done = true;
        k.go('game');
    }

    const updateCtrl = k.onUpdate(() => {
        elapsed += k.dt();
        if (elapsed < SCROLL_DELAY) return;

        const dt = k.dt();

        // Scroll all lines upward
        scrolled += SCROLL_PX_PER_SEC * dt;
        lineObjs.forEach((obj, i) => {
            obj.pos = k.vec2(CX, START_Y + i * LINE_H - scrolled);
        });

        // Reveal characters for lines currently on screen
        const charsThisFrame = REVEAL_SPEED * dt;
        lineObjs.forEach(obj => {
            if (obj._shown >= obj._full.length) return;
            const lineY = obj.pos.y;
            if (lineY < 60 || lineY > GAME_HEIGHT - 60) return; // outside window
            obj._shown = Math.min(obj._full.length, obj._shown + charsThisFrame);
            obj.text   = obj._full.slice(0, Math.ceil(obj._shown));
        });

        // Auto-advance once the last line has scrolled well past centre
        const lastY = START_Y + (STORY.length - 1) * LINE_H - scrolled;
        if (lastY < CY - 60 && !done) {
            k.wait(1.2, _launch);
            done = true; // prevent double-scheduling
        }
    });

    function onSkip(e) {
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        _launch();
    }
    document.addEventListener('keydown', onSkip);

    k.onClick(_launch);

    k.onSceneLeave(() => {
        updateCtrl.cancel();
        document.removeEventListener('keydown', onSkip);
    });
});

// Helper — pick a colour for a story line based on content
function STORY_LINE_COLOR(line) {
    if (line === line.toUpperCase() && line.trim().length > 0) return COLORS.gold;
    return COLORS.text;
}

// ============================================================
// SCENE: game
// ============================================================

k.scene('game', () => {
    // resetLevel() preserves score/lives/level across retries and level advances.
    // state.reset() (full wipe) is only called when starting fresh from splash.
    const levelCfg = LEVEL_CONFIGS[Math.min(state.level - 1, LEVEL_CONFIGS.length - 1)];
    state.resetLevel(levelCfg.shots);

    _spawnStarfield(120);

    // --- Setup subsystems ---
    initUI(k);
    initFleet(levelCfg);
    initTally();
    initPuzzle();
    initGrid(k);

    // Airship — left panel, slowly bobbing
    const SHIP_X = 195;
    const SHIP_BASE_Y = GAME_HEIGHT / 2;
    const gameShip = k.add([
        k.pos(SHIP_X, SHIP_BASE_Y),
        k.sprite('airship'),
        k.scale(0.053),
        k.anchor('center'),
        k.opacity(0.85),
        k.z(5),
    ]);
    let gameBobTimer = 0;
    gameShip.onUpdate(() => {
        gameBobTimer += k.dt();
        gameShip.pos = k.vec2(SHIP_X, SHIP_BASE_Y + Math.sin(gameBobTimer * 0.6) * 8);
    });

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
        k.wait(1.0, () => {
            showLevelTally(() => {
                events.clearAll();
                state.nextLevel();
                k.go('game');
            });
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
    // dragValue: the cell state to paint while dragging ('filled', 'empty', or null to clear)
    // dragButton: 'left' | 'right' — tracks which button started the drag
    let dragValue  = null;
    let dragButton = null;
    let dragLastCell = null;   // avoid re-applying to the same cell

    k.onMousePress('left', () => {
        if (state.isGameOver || state.isPaused) return;
        const mp = k.mousePos();
        const cell = pixelToCell(mp.x, mp.y);
        if (!cell) return;
        const { row, col } = cell;

        if (fireMode) {
            _doFire(row, col);
        } else {
            // Decide paint value: toggle filled on first click, then hold that value for drag
            const current = state.playerGrid[row][col];
            dragValue  = current === 'filled' ? null : 'filled';
            dragButton = 'left';
            dragLastCell = `${row},${col}`;
            setCell(row, col, dragValue);
        }
    });

    k.onMousePress('right', () => {
        if (state.isGameOver || state.isPaused || fireMode) return;
        const mp = k.mousePos();
        const cell = pixelToCell(mp.x, mp.y);
        if (!cell) return;
        const { row, col } = cell;
        const current = state.playerGrid[row][col];
        dragValue  = current === 'empty' ? null : 'empty';
        dragButton = 'right';
        dragLastCell = `${row},${col}`;
        setCell(row, col, dragValue);
    });

    k.onMouseRelease('left',  () => { if (dragButton === 'left')  { dragValue = null; dragButton = null; dragLastCell = null; } });
    k.onMouseRelease('right', () => { if (dragButton === 'right') { dragValue = null; dragButton = null; dragLastCell = null; } });

    k.onMouseMove(() => {
        if (state.isGameOver || state.isPaused || fireMode) return;
        if (dragButton === null) return;
        const mp = k.mousePos();
        const cell = pixelToCell(mp.x, mp.y);
        if (!cell) return;
        const key = `${cell.row},${cell.col}`;
        if (key === dragLastCell) return;
        dragLastCell = key;
        setCell(cell.row, cell.col, dragValue);
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
        playFire();
        refreshGrid();
        if (result === 'hit') {
            _showBanner('HIT!', COLORS.shipHit, 1.2);
        } else {
            playMiss();
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
// Starfield helper
// ============================================================

/**
 * Spawns a static layer of star dots and a second slower-drifting layer
 * to give a parallax space feel.  All stars are tagged 'star' so they
 * can be bulk-destroyed on scene leave if needed (they auto-clear with
 * the scene anyway).
 */
function _spawnStarfield(numStars = 160) {
    for (let i = 0; i < numStars; i++) {
        const x    = Math.random() * GAME_WIDTH;
        const y    = Math.random() * GAME_HEIGHT;
        const size = Math.random() < 0.15 ? 2 : 1;          // 15% bright stars
        const br   = 120 + Math.floor(Math.random() * 136); // 120–255 brightness
        const op   = 0.3 + Math.random() * 0.7;             // vary opacity

        k.add([
            k.pos(x, y),
            k.circle(size),
            k.color(br, br, Math.min(255, br + 40)),         // slight blue tint
            k.opacity(op),
            k.anchor('center'),
            k.z(1),
            'star',
        ]);
    }

    // Occasional larger "distant nebula" blobs
    for (let i = 0; i < 6; i++) {
        const x  = Math.random() * GAME_WIDTH;
        const y  = Math.random() * GAME_HEIGHT;
        const r  = 28 + Math.floor(Math.random() * 40);
        // Random cool hue: blue-purple-teal palette
        const hues = [
            [30, 40, 120],
            [20, 20, 90],
            [10, 50, 110],
            [40, 20, 100],
        ];
        const [nr, ng, nb] = hues[i % hues.length];
        k.add([
            k.pos(x, y),
            k.circle(r),
            k.color(nr, ng, nb),
            k.opacity(0.08 + Math.random() * 0.07),
            k.anchor('center'),
            k.z(1),
            'star',
        ]);
    }
}

// ============================================================
// Start
// ============================================================

k.go('splash');
