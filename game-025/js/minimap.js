/**
 * minimap.js — A small top-down overview drawn to a DOM <canvas> in the corner.
 *
 * Each frame it paints the current maze grid plus live entity positions:
 *   walls (dark), open floor (faint), closed doors (brown), exit (green),
 *   nests (red squares), enemies (small red dots), and the player (bright dot).
 *
 * It reads the grid + dims straight from maze.js and entity positions from
 * enemies.js / nests.js. The canvas is built in JS (index.html stays untouched)
 * and sits in #ui-overlay, never intercepting pointer events. Cell size scales
 * to the level so bigger mazes still fit the same box.
 */

import { worldToCell, getGrid, getGridDims, isDoorClosed } from './maze.js';
import { getPlayerPos } from './player.js';
import { getEnemies } from './enemies.js';
import { getNests } from './nests.js';
import { COLORS } from './config.js';

const BOX = 150;   // on-screen pixel size of the (square) minimap box

let _canvas = null;
let _ctx    = null;
let _cell   = 6;   // px per maze cell (recomputed per level to fit BOX)

export function initMinimap() {
    if (!_canvas) {
        _canvas = document.createElement('canvas');
        _canvas.width = BOX;
        _canvas.height = BOX;
        _canvas.style.cssText = `
            position: absolute; right: 14px; bottom: 14px;
            border: 2px solid #2a2a4a; background: rgba(10,10,20,0.6);
            pointer-events: none; image-rendering: pixelated;`;
        (document.getElementById('ui-overlay') || document.body).appendChild(_canvas);
        _ctx = _canvas.getContext('2d');
    }
    show();
    _fitToLevel();
}

/** Recompute cell size so the current level fills the box. Call per level load. */
function _fitToLevel() {
    const { cols, rows } = getGridDims();
    if (!cols || !rows) return;
    _cell = Math.floor(BOX / Math.max(cols, rows));
}

export function show() { if (_canvas) _canvas.style.display = 'block'; }
export function hide() { if (_canvas) _canvas.style.display = 'none'; }

function _hex(n) { return '#' + n.toString(16).padStart(6, '0'); }

/** Redraw the minimap. Call each frame while a run is active. */
export function updateMinimap() {
    if (!_ctx) return;
    const grid = getGrid();
    const { cols, rows } = getGridDims();
    if (!grid.length || !cols) return;

    const c = _cell;
    const w = cols * c, h = rows * c;
    // Center the grid in the box.
    const ox = Math.floor((BOX - w) / 2);
    const oy = Math.floor((BOX - h) / 2);

    _ctx.clearRect(0, 0, BOX, BOX);

    // --- Cells: walls, floor, doors, exit ---
    for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
            const ch = grid[r][col];
            let fill = null;
            if (ch === '#')      fill = _hex(COLORS.wall);
            else if (ch === 'X') fill = _hex(COLORS.success);
            else if (ch === 'D') fill = isDoorClosed(col, r) ? _hex(COLORS.door) : 'rgba(40,40,64,0.5)';
            else                 fill = 'rgba(40,40,64,0.5)';   // floor
            _ctx.fillStyle = fill;
            _ctx.fillRect(ox + col * c, oy + r * c, c, c);
        }
    }

    // --- Nests (red squares) ---
    _ctx.fillStyle = _hex(COLORS.danger);
    for (const n of getNests()) {
        const cell = worldToCell(n.mesh.position.x, n.mesh.position.z);
        _ctx.fillRect(ox + cell.col * c, oy + cell.row * c, c, c);
    }

    // --- Enemies (small dots) ---
    _ctx.fillStyle = '#ff9090';
    for (const e of getEnemies()) {
        const cell = worldToCell(e.mesh.position.x, e.mesh.position.z);
        const px = ox + cell.col * c + c / 2;
        const py = oy + cell.row * c + c / 2;
        _ctx.fillRect(px - 1, py - 1, 2, 2);
    }

    // --- Player (bright dot) ---
    const p = getPlayerPos();
    const pc = worldToCell(p.x, p.z);
    _ctx.fillStyle = _hex(COLORS.accent);
    _ctx.beginPath();
    _ctx.arc(ox + pc.col * c + c / 2, oy + pc.row * c + c / 2, Math.max(2, c / 2), 0, Math.PI * 2);
    _ctx.fill();
}
