/**
 * main.js — Kaplay initialisation and scene definitions for Tiny Town.
 *
 * Scenes:
 *   'splash' — Title screen, waits for any key or click
 *   'game'   — Main sandbox city builder scene
 *
 * Library: ../../lib/kaplay/kaplay.mjs (shared root lib)
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';

import {
    GAME_WIDTH, GAME_HEIGHT, COLORS,
    TILE_SIZE, GRID_COLS, GRID_ROWS, GRID_OFFSET_X, GRID_OFFSET_Y,
    BUILDINGS, PANEL_WIDTH, CLEAR_REFUND_RATE,
} from './config.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI }    from './ui.js';
import { initAudio, playUiClick, playPlace, playPlaceRoad, playPlacePark, playClear, playNoGold, startAmbient, stopAmbient, toggleAmbient } from './sounds.js';
import { hasAdjacentRoad, recalcBonuses } from './adjacency.js';
import { recalcPopulation, startIncomeTick } from './population.js';
import { saveGame, loadGame } from './storage.js';
import { initAnimations } from './animations.js';
import { generateTerrain, drawTerrainLayer } from './terrain.js';

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
        k.pos(CX, CY - 120),
        k.text('Tiny Town', { size: 72 }),
        k.color(...COLORS.accent),
        k.anchor('center'),
        k.z(1),
    ]);

    k.add([
        k.pos(CX, CY - 50),
        k.text('A cozy city builder sandbox', { size: 18 }),
        k.color(...COLORS.text),
        k.anchor('center'),
        k.z(1),
    ]);

    // Blinking start prompt
    const prompt = k.add([
        k.pos(CX, CY + 20),
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

    // Controls hint
    k.add([
        k.pos(CX, CY + 90),
        k.text('Click tiles to place  |  1-9 keys select tool  |  Ctrl+Z: Undo  Ctrl+S/L: Save/Load  M: Music', { size: 12 }),
        k.color(80, 80, 120),
        k.anchor('center'),
        k.z(1),
    ]);

    // Version tag
    k.add([
        k.pos(GAME_WIDTH - 10, GAME_HEIGHT - 10),
        k.text('Phase 4', { size: 10 }),
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
    generateTerrain();

    // ---- Grid area setup ----
    // Grid occupies the left portion; right PANEL_WIDTH px is the build panel.
    const GRID_AREA_W = GAME_WIDTH - PANEL_WIDTH;

    // In-memory map of tile entities so we can redraw them: key = "col,row"
    const tileEntities = {};

    // Bonus overlay entities (star badge on bonus tiles): key = "col,row"
    const bonusOverlays = {};

    // Undo stack: each entry = { col, row, prevType, prevGold, prevScore }
    const undoStack = [];

    // ---- Draw grid background ----
    k.add([
        k.pos(0, 42),
        k.rect(GRID_AREA_W, GAME_HEIGHT - 42),
        k.color(25, 30, 40),
        k.z(0),
    ]);

    // Draw grid lines
    for (let col = 0; col <= GRID_COLS; col++) {
        const x = GRID_OFFSET_X + col * TILE_SIZE;
        k.add([
            k.pos(x, GRID_OFFSET_Y),
            k.rect(1, GRID_ROWS * TILE_SIZE),
            k.color(40, 45, 60),
            k.z(1),
        ]);
    }
    for (let row = 0; row <= GRID_ROWS; row++) {
        const y = GRID_OFFSET_Y + row * TILE_SIZE;
        k.add([
            k.pos(GRID_OFFSET_X, y),
            k.rect(GRID_COLS * TILE_SIZE, 1),
            k.color(40, 45, 60),
            k.z(1),
        ]);
    }

    // ---- Hover highlight ----
    const hoverTile = k.add([
        k.pos(-100, -100),
        k.rect(TILE_SIZE, TILE_SIZE),
        k.color(255, 255, 255),
        k.opacity(0.15),
        k.z(50),
    ]);

    // ---- Helper: world pos → grid col/row ----
    function screenToGrid(wx, wy) {
        const col = Math.floor((wx - GRID_OFFSET_X) / TILE_SIZE);
        const row = Math.floor((wy - GRID_OFFSET_Y) / TILE_SIZE);
        return { col, row };
    }

    function isValidTile(col, row) {
        return col >= 0 && col < GRID_COLS && row >= 0 && row < GRID_ROWS;
    }

    function gridToScreen(col, row) {
        return {
            x: GRID_OFFSET_X + col * TILE_SIZE,
            y: GRID_OFFSET_Y + row * TILE_SIZE,
        };
    }

    // ---- Draw terrain background (biome tiles) ----
    drawTerrainLayer(k, gridToScreen);

    // ---- Helper: destroy bonus overlay for a tile ----
    function clearBonusOverlay(key) {
        if (bonusOverlays[key]) {
            bonusOverlays[key].destroy();
            delete bonusOverlays[key];
        }
    }

    // ---- Helper: draw (or refresh) the bonus star on a tile ----
    function drawBonusOverlay(col, row) {
        const key = `${col},${row}`;
        clearBonusOverlay(key);
        const { x, y } = gridToScreen(col, row);
        bonusOverlays[key] = k.add([
            k.pos(x + TILE_SIZE - 2, y + 2),
            k.text('+', { size: 10 }),
            k.color(255, 240, 80),
            k.anchor('topright'),
            k.z(15),
        ]);
    }

    // ---- Helper: redraw a tile entity (animate=true → pop-in scale) ----
    function drawTile(col, row, type, animate = false) {
        const key = `${col},${row}`;
        // Remove old entity if any
        if (tileEntities[key]) {
            tileEntities[key].forEach(e => e.destroy());
        }
        if (!type) {
            delete tileEntities[key];
            clearBonusOverlay(key);
            return;
        }

        const def = BUILDINGS[type];
        const { x, y } = gridToScreen(col, row);
        const pad = 2;
        const tileW = TILE_SIZE - pad * 2;
        const tileH = TILE_SIZE - pad * 2;
        // Center of this tile
        const cx = x + TILE_SIZE / 2;
        const cy = y + TILE_SIZE / 2;

        // Use anchor('center') so scale animates from the tile center
        const bg = k.add([
            k.pos(cx, cy),
            k.rect(tileW, tileH),
            k.color(...def.color),
            k.anchor('center'),
            k.scale(animate ? 0.4 : 1),
            k.z(10),
        ]);

        // Small icon label for tiles that have one
        let labelEnt = null;
        if (def.icon) {
            const emoji = def.icon;
            labelEnt = k.add([
                k.pos(cx, cy),
                k.text(emoji, { size: 14 }),
                k.color(255, 255, 255),
                k.anchor('center'),
                k.scale(animate ? 0.4 : 1),
                k.z(11),
            ]);
        }

        // Pop-in animation: lerp scale 0.4 → 1.0 over POP_DURATION seconds
        if (animate) {
            const POP_DURATION = 0.12;
            let t = 0;
            bg.onUpdate(() => {
                if (t >= POP_DURATION) return;
                t += k.dt();
                const s = 0.4 + 0.6 * Math.min(1, t / POP_DURATION);
                bg.scale = k.vec2(s, s);
                if (labelEnt) labelEnt.scale = k.vec2(s, s);
            });
        }

        tileEntities[key] = labelEnt ? [bg, labelEnt] : [bg];

        // Restore bonus overlay if this tile already has a bonus
        if (state.adjacencyBonuses.has(key)) {
            drawBonusOverlay(col, row);
        }
    }

    // ---- Place a building ----
    function placeTile(col, row) {
        if (!isValidTile(col, row)) return;
        const tool = state.selectedTool;
        const def  = BUILDINGS[tool];

        if (tool === 'clear') {
            const existing = state.getTile(col, row);
            if (!existing) return; // nothing to clear
            const refund = Math.floor((BUILDINGS[existing].cost || 0) * CLEAR_REFUND_RATE);
            undoStack.push({ col, row, prevType: existing, prevGold: state.gold, prevScore: state.score });
            state.setTile(col, row, null);
            drawTile(col, row, null);
            if (refund > 0) state.addGold(refund);
            playClear();
            events.emit('buildingCleared', col, row);
            recalcBonuses();
            recalcPopulation();
            return;
        }

        // Block placement on an already-occupied tile
        if (state.getTile(col, row)) return;

        // Commercial/civic buildings require an adjacent road tile
        const NEEDS_ROAD = new Set(['shop', 'office', 'bank', 'government']);
        if (NEEDS_ROAD.has(tool) && !hasAdjacentRoad(col, row)) {
            playNoGold(); // reuse "can't do it" sound
            return;
        }

        // Check gold
        if (!state.spendGold(def.cost)) {
            playNoGold();
            return;
        }

        undoStack.push({ col, row, prevType: null, prevGold: state.gold + def.cost, prevScore: state.score });
        state.setTile(col, row, tool);
        drawTile(col, row, tool, true); // animate pop-in
        state.addScore(def.scoreValue);

        // Play placement sound
        if (tool === 'road')  playPlaceRoad();
        else if (tool === 'park')  playPlacePark();
        else                       playPlace();

        events.emit('buildingPlaced', col, row, tool);
        recalcBonuses();
        recalcPopulation();
    }

    // ---- Mouse hover ----
    k.onUpdate(() => {
        if (state.isPaused) return;
        const mp = k.mousePos();
        const { col, row } = screenToGrid(mp.x, mp.y);
        if (isValidTile(col, row)) {
            const { x, y } = gridToScreen(col, row);
            hoverTile.pos = k.vec2(x, y);
        } else {
            hoverTile.pos = k.vec2(-100, -100);
        }
    });

    // ---- Mouse click → place tile ----
    let isMouseDown = false;
    let lastPlacedKey = null;

    k.onMousePress('left', () => {
        if (state.isPaused) return;
        isMouseDown = true;
        lastPlacedKey = null;
        const mp = k.mousePos();
        const { col, row } = screenToGrid(mp.x, mp.y);
        if (isValidTile(col, row)) {
            const key = `${col},${row}`;
            if (key !== lastPlacedKey) {
                placeTile(col, row);
                lastPlacedKey = key;
            }
        }
    });

    k.onMouseRelease('left', () => {
        isMouseDown = false;
        lastPlacedKey = null;
    });

    // Drag-to-paint
    k.onUpdate(() => {
        if (!isMouseDown || state.isPaused) return;
        const mp = k.mousePos();
        const { col, row } = screenToGrid(mp.x, mp.y);
        if (isValidTile(col, row)) {
            const key = `${col},${row}`;
            if (key !== lastPlacedKey) {
                placeTile(col, row);
                lastPlacedKey = key;
            }
        }
    });

    // ---- Right-click → clear (without changing selected tool) ----
    let isRightDown = false;
    let lastClearedKey = null;

    function clearTileAt(col, row) {
        if (!isValidTile(col, row)) return;
        const existing = state.getTile(col, row);
        if (!existing) return;
        const refund = Math.floor((BUILDINGS[existing].cost || 0) * CLEAR_REFUND_RATE);
        undoStack.push({ col, row, prevType: existing, prevGold: state.gold, prevScore: state.score });
        state.setTile(col, row, null);
        drawTile(col, row, null);
        if (refund > 0) state.addGold(refund);
        playClear();
        events.emit('buildingCleared', col, row);
        recalcBonuses();
        recalcPopulation();
    }

    k.onMousePress('right', () => {
        if (state.isPaused) return;
        isRightDown = true;
        lastClearedKey = null;
        const mp = k.mousePos();
        const { col, row } = screenToGrid(mp.x, mp.y);
        if (isValidTile(col, row)) {
            const key = `${col},${row}`;
            if (key !== lastClearedKey) {
                clearTileAt(col, row);
                lastClearedKey = key;
            }
        }
    });

    k.onMouseRelease('right', () => {
        isRightDown = false;
        lastClearedKey = null;
    });

    k.onUpdate(() => {
        if (!isRightDown || state.isPaused) return;
        const mp = k.mousePos();
        const { col, row } = screenToGrid(mp.x, mp.y);
        if (isValidTile(col, row)) {
            const key = `${col},${row}`;
            if (key !== lastClearedKey) {
                clearTileAt(col, row);
                lastClearedKey = key;
            }
        }
    });

    // ---- Keyboard tool shortcuts (1–9 mapped to BUILDINGS order) ----
    const toolKeys = {};
    Object.keys(BUILDINGS).forEach((tool, idx) => {
        toolKeys[String(idx + 1)] = tool;
    });
    for (const [key, tool] of Object.entries(toolKeys)) {
        k.onKeyPress(key, () => {
            state.selectedTool = tool;
            playUiClick();
        });
    }

    // ---- Standard key bindings ----
    k.onKeyPress('r', () => {
        events.clearAll();
        k.go('game');
    });

    k.onKeyPress('p', () => {
        state.isPaused = !state.isPaused;
    });

    // ---- Escape — "Return to menu?" overlay ----
    let menuDialogOpen = false;
    let menuDialogObjs = [];

    function showMenuDialog() {
        if (menuDialogOpen) return;
        menuDialogOpen = true;
        state.isPaused = true;
        const cx = GAME_WIDTH / 2;
        const cy = GAME_HEIGHT / 2;
        menuDialogObjs = [
            k.add([k.rect(420, 160, { radius: 8 }), k.pos(cx, cy), k.anchor('center'), k.color(20, 20, 30), k.outline(2, k.rgb(180, 180, 220)), k.opacity(0.95), k.z(100)]),
            k.add([k.text('Return to main menu?', { size: 22 }), k.pos(cx, cy - 30), k.anchor('center'), k.color(240, 240, 255), k.z(102)]),
            k.add([k.text('Unsaved progress will be lost.', { size: 14 }), k.pos(cx, cy + 6), k.anchor('center'), k.color(180, 180, 200), k.z(102)]),
            k.add([k.text('(Y) Yes     (N) / (Esc) No', { size: 16 }), k.pos(cx, cy + 44), k.anchor('center'), k.color(140, 220, 140), k.z(102)]),
        ];
    }

    function hideMenuDialog() {
        menuDialogObjs.forEach(o => k.destroy(o));
        menuDialogObjs = [];
        menuDialogOpen = false;
        state.isPaused = false;
    }

    const onEscapeKey = (e) => {
        if (e.key === 'Escape') {
            if (menuDialogOpen) {
                hideMenuDialog();
            } else {
                showMenuDialog();
            }
        } else if (e.key === 'y' || e.key === 'Y') {
            if (menuDialogOpen) {
                hideMenuDialog();
                events.clearAll();
                document.removeEventListener('keydown', onEscapeKey);
                k.go('splash');
            }
        } else if (e.key === 'n' || e.key === 'N') {
            if (menuDialogOpen) hideMenuDialog();
        }
    };
    document.addEventListener('keydown', onEscapeKey);
    k.onSceneLeave(() => {
        document.removeEventListener('keydown', onEscapeKey);
        menuDialogObjs.forEach(o => k.destroy(o));
    });

    // ---- Undo (Ctrl+Z) ----
    function performUndo() {
        if (undoStack.length === 0) return;
        const { col, row, prevType, prevGold, prevScore } = undoStack.pop();
        state.setTile(col, row, prevType);
        state.gold  = prevGold;
        state.score = prevScore;
        drawTile(col, row, prevType);
        playClear();
        recalcBonuses();
        recalcPopulation();
    }

    const onUndoKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (!state.isPaused) performUndo();
        }
    };
    document.addEventListener('keydown', onUndoKey);
    k.onSceneLeave(() => document.removeEventListener('keydown', onUndoKey));

    // ---- Save / Load (Ctrl+S / Ctrl+L) ----
    const onSaveLoadKey = (e) => {
        if (!(e.ctrlKey || e.metaKey)) return;
        if (e.key === 's') {
            e.preventDefault();
            saveGame(state);
            events.emit('toastMessage', 'Town saved!');
        } else if (e.key === 'l') {
            e.preventDefault();
            if (loadGame(state)) {
                // Redraw entire grid from restored state
                for (let r = 0; r < GRID_ROWS; r++) {
                    for (let c = 0; c < GRID_COLS; c++) {
                        drawTile(c, r, state.getTile(c, r));
                    }
                }
                recalcBonuses();
                recalcPopulation();
                undoStack.length = 0;
                events.emit('toastMessage', 'Town loaded!');
            }
        }
    };
    document.addEventListener('keydown', onSaveLoadKey);
    k.onSceneLeave(() => document.removeEventListener('keydown', onSaveLoadKey));

    // ---- Respond to adjacency bonus changes ----
    events.on('adjacencyChanged', (changedKeys) => {
        for (const key of changedKeys) {
            const [col, row] = key.split(',').map(Number);
            if (state.adjacencyBonuses.has(key)) {
                drawBonusOverlay(col, row);
            } else {
                clearBonusOverlay(key);
            }
        }
    });

    // ---- M key: toggle ambient music ----
    k.onKeyPress('m', () => {
        toggleAmbient();
    });

    // ---- Init HUD / panel ----
    initUI(k);

    // ---- Init ambient animations (cars, dollar signs) ----
    initAnimations(k, { gridToScreen });

    // ---- Start passive income tick ----
    startIncomeTick(k);

    // ---- Start ambient music ----
    startAmbient();

    k.onSceneLeave(() => {
        stopAmbient();
        events.clearAll();
    });
});

// ============================================================
// Start
// ============================================================

k.go('splash');
