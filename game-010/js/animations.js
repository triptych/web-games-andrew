/**
 * animations.js — Ambient visual animations for Tiny Town.
 *
 * Exports:
 *   initAnimations(k, gridHelpers) — call once per game scene after grid setup
 *
 * Animations:
 *   Cars        — small rectangles that drive along road tiles
 *   Dollar signs — float up from shop tiles on each income tick
 *
 * gridHelpers = { gridToScreen, isValidTile, TILE_SIZE }
 * All animation entities are tagged 'anim' so k.destroyAll('anim') cleans them up.
 */

import { state }  from './state.js';
import { events } from './events.js';
import { GRID_COLS, GRID_ROWS } from './config.js';

// ---- Constants ----
const MAX_CARS       = 10;   // max concurrent car entities
const CAR_SPEED      = 55;   // pixels per second along a road
const CAR_W          = 10;
const CAR_H          = 6;
const CAR_Z          = 20;

// Dollar sign float
const DOLLAR_SPEED   = 38;   // px/s upward
const DOLLAR_LIFE    = 1.6;  // seconds before fully faded
const DOLLAR_Z       = 25;

// ---- Car color pool ----
const CAR_COLORS = [
    [220,  80,  80],   // red
    [80,  140, 220],   // blue
    [ 80, 200,  80],   // green
    [220, 180,  60],   // yellow
    [200,  80, 200],   // purple
    [255, 160,  60],   // orange
];

// ---- Module-level state (reset on each call to initAnimations) ----
let _k = null;
let _gridToScreen = null;
let _activeCars   = 0;

// ---- Helpers ----

/** Return all road tile coords as [{col, row}] */
function _allRoadTiles() {
    const roads = [];
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            if (state.getTile(col, row) === 'road') roads.push({ col, row });
        }
    }
    return roads;
}

/** Return all shop tile coords as [{col, row}] */
function _allShopTiles() {
    const shops = [];
    for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
            if (state.getTile(col, row) === 'shop') shops.push({ col, row });
        }
    }
    return shops;
}

/** Orthogonal neighbours that are road tiles */
function _roadNeighbours(col, row) {
    return [
        { col: col - 1, row },
        { col: col + 1, row },
        { col, row: row - 1 },
        { col, row: row + 1 },
    ].filter(({ col: c, row: r }) =>
        c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS &&
        state.getTile(c, r) === 'road'
    );
}

/** Pick a random element from an array, or null if empty */
function _pick(arr) {
    if (arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

// ---- Car spawning ----

/**
 * Spawn one car that drives along road tiles.
 * The car starts at the center of a random road tile and moves
 * toward a random adjacent road tile. It repeats tile-by-tile until
 * it ends up on a dead-end (no more road neighbours in its direction),
 * at which point it is destroyed.
 */
function _spawnCar() {
    if (_activeCars >= MAX_CARS) return;

    const roads = _allRoadTiles();
    if (roads.length === 0) return;

    // Pick a start tile that has at least one road neighbour
    const starts = roads.filter(({ col, row }) => _roadNeighbours(col, row).length > 0);
    if (starts.length === 0) return;

    const start = _pick(starts);
    let { col: curCol, row: curRow } = start;

    // Pick initial target neighbour, preferring a different direction from where we came
    let prevCol = curCol;
    let prevRow = curRow;
    let nextNeighbours = _roadNeighbours(curCol, curRow);
    if (nextNeighbours.length === 0) return;
    let target = _pick(nextNeighbours);

    const { x: sx, y: sy } = _gridToScreen(curCol, curRow);
    const TILE_SIZE = 40;
    const startX = sx + TILE_SIZE / 2;
    const startY = sy + TILE_SIZE / 2;

    const colorArr = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];

    const car = _k.add([
        _k.pos(startX, startY),
        _k.rect(CAR_W, CAR_H),
        _k.color(...colorArr),
        _k.anchor('center'),
        _k.z(CAR_Z),
        'anim',
    ]);

    _activeCars++;

    car.onUpdate(() => {
        if (state.isPaused) return;

        // Current position
        const px = car.pos.x;
        const py = car.pos.y;

        // Target screen position (center of target tile)
        const { x: tx, y: ty } = _gridToScreen(target.col, target.row);
        const targetX = tx + TILE_SIZE / 2;
        const targetY = ty + TILE_SIZE / 2;

        // Vector toward target
        const dx = targetX - px;
        const dy = targetY - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = CAR_SPEED * _k.dt();

        // Rotate car to face direction of travel
        if (Math.abs(dx) > Math.abs(dy)) {
            car.width  = CAR_W;
            car.height = CAR_H;
        } else {
            car.width  = CAR_H;
            car.height = CAR_W;
        }

        if (dist <= step) {
            // Arrived at target tile — snap and pick next tile
            car.pos = _k.vec2(targetX, targetY);
            prevCol = curCol;
            prevRow = curRow;
            curCol  = target.col;
            curRow  = target.row;

            // Make sure target tile is still a road (may have been cleared)
            if (state.getTile(curCol, curRow) !== 'road') {
                car.destroy();
                _activeCars--;
                return;
            }

            // Pick next tile: prefer not going back the way we came
            const neighbours = _roadNeighbours(curCol, curRow);
            const forward = neighbours.filter(n => !(n.col === prevCol && n.row === prevRow));
            const nextTile = forward.length > 0 ? _pick(forward) : _pick(neighbours);

            if (!nextTile) {
                // Dead end — destroy the car
                car.destroy();
                _activeCars--;
                return;
            }
            target = nextTile;

        } else {
            // Move toward target
            car.pos = _k.vec2(
                px + (dx / dist) * step,
                py + (dy / dist) * step
            );
        }
    });

    car.onDestroy(() => {
        // Guard against double-decrement
        if (_activeCars > 0) _activeCars--;
    });
}

/** Try to top up to MAX_CARS */
function _fillCars() {
    const roads = _allRoadTiles();
    if (roads.length === 0) return;
    // Stagger spawns so they don't all appear at once
    const needed = Math.min(MAX_CARS - _activeCars, roads.length);
    for (let i = 0; i < needed; i++) {
        _k.wait(i * 0.4 + Math.random() * 0.3, _spawnCar);
    }
}

// ---- Dollar sign floaters ----

/**
 * Spawn a floating "$" above a specific shop tile.
 * Drifts upward and fades out over DOLLAR_LIFE seconds.
 */
function _spawnDollarAt(col, row) {
    const { x, y } = _gridToScreen(col, row);
    const TILE_SIZE = 40;

    // Randomise horizontal start slightly within the tile
    const startX = x + TILE_SIZE / 2 + (Math.random() - 0.5) * 12;
    const startY = y + TILE_SIZE / 2;

    const dollar = _k.add([
        _k.pos(startX, startY),
        _k.text('$', { size: 12 }),
        _k.color(255, 235, 80),
        _k.anchor('center'),
        _k.opacity(1),
        _k.z(DOLLAR_Z),
        'anim',
    ]);

    let elapsed = 0;
    dollar.onUpdate(() => {
        elapsed += _k.dt();
        dollar.pos = _k.vec2(
            dollar.pos.x,
            dollar.pos.y - DOLLAR_SPEED * _k.dt()
        );
        // Fade out in the second half
        const fadeStart = DOLLAR_LIFE * 0.5;
        if (elapsed > fadeStart) {
            dollar.opacity = Math.max(0, 1 - (elapsed - fadeStart) / (DOLLAR_LIFE - fadeStart));
        }
        if (elapsed >= DOLLAR_LIFE) {
            dollar.destroy();
        }
    });
}

/** Spawn dollar signs on all current shop tiles */
function _spawnDollarsFromAllShops() {
    const shops = _allShopTiles();
    shops.forEach(({ col, row }) => {
        // Small stagger per shop so they don't all pop at exactly the same frame
        _k.wait(Math.random() * 0.3, () => _spawnDollarAt(col, row));
    });
}

// ---- Public init ----

/**
 * initAnimations(k, gridHelpers)
 *   k            — Kaplay instance
 *   gridHelpers  — { gridToScreen: (col,row)=>{x,y} }
 */
export function initAnimations(k, { gridToScreen }) {
    _k            = k;
    _gridToScreen = gridToScreen;
    _activeCars   = 0;

    // Start filling cars after a short delay (let player place some roads first)
    // Re-check every few seconds so new roads get cars
    function carRefreshLoop() {
        _fillCars();
        k.wait(6 + Math.random() * 2, carRefreshLoop);
    }
    k.wait(1.5, carRefreshLoop);

    // Also spawn a new car whenever a road is placed
    events.on('buildingPlaced', (col, row, type) => {
        if (type === 'road') {
            k.wait(0.2, _spawnCar);
        }
    });

    // Dollar signs rise from shops on each income tick
    events.on('incomeTick', () => {
        _spawnDollarsFromAllShops();
    });

    // Clean up when scene is torn down
    k.onSceneLeave(() => {
        _activeCars = 0;
    });
}
