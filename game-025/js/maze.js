/**
 * maze.js — Grid maze layout, wall/floor meshes, and a level loader.
 *
 * A level is an array of strings, one per row. Characters:
 *   '#' wall    '.' floor    'S' player spawn (floor)
 *   'N' nest (floor under it) 'F' food   'T' treasure   'K' key
 *   'D' door    'X' exit
 * Non-'#' cells are all walkable floor; the extra letters mark where
 * Phase 3/4 systems will place entities. For Phase 2 we render walls + floor
 * and expose collision + spawn lookup.
 *
 * Coordinate system: cell (col, row) maps to world (x, z):
 *   x = col * TILE_SIZE ,  z = row * TILE_SIZE  (y is up)
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { TILE_SIZE, WALL_HEIGHT, COLORS } from './config.js';

// --- Hand-authored levels (Phase 2: one starter level; more added in Phase 4) ---
export const LEVELS = [
    [
        '####################',
        '#S...#......#.....F.#',
        '#.##.#.####.#.###.#.#',
        '#.#..K.#..#...#.T#.#.#',
        '#.#.####.#.#####.#.#.#',
        '#.#......#.....#.#..N#',
        '#.######.#####.#.####',
        '#......#.....#.#....#',
        '#.####.#####.#.####.#',
        '#.#N.#.....#.....#..#',
        '#.#.#####.#######.#.#',
        '#.#.....#.......#.#.#',
        '#.#####.#######.#.#.#',
        '#.....#...F...#...#.#',
        '#.###.#######.###.#.#',
        '#...#...T...#...#...#',
        '#.#.###.###.#.#.###.#',
        '#.#.......#...#....X#',
        '####################',
    ],
];

let _grid       = [];      // array of strings (current level)
let _cols       = 0;
let _rows       = 0;
let _wallGroup  = null;    // THREE.Group holding all wall + floor meshes

// Shared geometries/materials (dispose-friendly: created once, reused).
const _wallGeo   = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);
const _wallMat   = new THREE.MeshLambertMaterial({ color: COLORS.wall });
const _wallTopMat = new THREE.MeshLambertMaterial({ color: COLORS.wallTop });

/** World position (center) of a grid cell. */
export function cellToWorld(col, row) {
    return { x: col * TILE_SIZE, z: row * TILE_SIZE };
}

/** Grid cell containing a world position. */
export function worldToCell(x, z) {
    return {
        col: Math.round(x / TILE_SIZE),
        row: Math.round(z / TILE_SIZE),
    };
}

/** Is this cell a wall (or out of bounds)? */
export function isWall(col, row) {
    if (row < 0 || row >= _rows || col < 0 || col >= _cols) return true;
    return _grid[row][col] === '#';
}

/** True if a circle of `radius` centered at world (x,z) overlaps any wall. */
export function collidesCircle(x, z, radius) {
    const { col, row } = worldToCell(x, z);
    // Check the 3x3 block of cells around the position.
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const c = col + dc, r = row + dr;
            if (!isWall(c, r)) continue;
            // Closest point on this cell's AABB to (x,z).
            const cw = cellToWorld(c, r);
            const halfT = TILE_SIZE / 2;
            const nx = Math.max(cw.x - halfT, Math.min(x, cw.x + halfT));
            const nz = Math.max(cw.z - halfT, Math.min(z, cw.z + halfT));
            const dx = x - nx, dz = z - nz;
            if (dx * dx + dz * dz < radius * radius) return true;
        }
    }
    return false;
}

/** Find the (world) position of the first cell matching `ch`, or null. */
export function findCell(ch) {
    for (let row = 0; row < _rows; row++) {
        const col = _grid[row].indexOf(ch);
        if (col !== -1) return { ...cellToWorld(col, row), col, row };
    }
    return null;
}

/** Find ALL cells matching any char in `chars`. Returns [{x,z,col,row,ch}]. */
export function findCells(chars) {
    const out = [];
    for (let row = 0; row < _rows; row++) {
        for (let col = 0; col < _cols; col++) {
            const ch = _grid[row][col];
            if (chars.includes(ch)) out.push({ ...cellToWorld(col, row), col, row, ch });
        }
    }
    return out;
}

/** Player spawn world position (the 'S' cell, fallback to first floor). */
export function getSpawn() {
    return findCell('S') || findCells('.')[0] || { x: TILE_SIZE, z: TILE_SIZE };
}

/**
 * Build meshes for a level index and add them to the scene.
 * Disposes the previous level's wall group first.
 */
export function loadLevel(levelIndex) {
    disposeMaze();

    _grid = LEVELS[levelIndex % LEVELS.length];
    _rows = _grid.length;
    _cols = _grid[0].length;

    _wallGroup = new THREE.Group();

    // Floor — one big plane under everything.
    const floorW = _cols * TILE_SIZE;
    const floorD = _rows * TILE_SIZE;
    const floorGeo = new THREE.PlaneGeometry(floorW, floorD);
    const floorMat = new THREE.MeshLambertMaterial({ color: COLORS.floor });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((_cols - 1) * TILE_SIZE / 2, 0, (_rows - 1) * TILE_SIZE / 2);
    _wallGroup.add(floor);

    // Walls — one box per '#' cell (top face uses a brighter material via groups
    // would be overkill; a single lit box reads fine for retro).
    for (let row = 0; row < _rows; row++) {
        for (let col = 0; col < _cols; col++) {
            if (_grid[row][col] !== '#') continue;
            const { x, z } = cellToWorld(col, row);
            const wall = new THREE.Mesh(_wallGeo, _wallMat);
            wall.position.set(x, WALL_HEIGHT / 2, z);
            _wallGroup.add(wall);
        }
    }

    scene.add(_wallGroup);
    return { cols: _cols, rows: _rows };
}

/** Remove and dispose the current level's meshes. */
export function disposeMaze() {
    if (!_wallGroup) return;
    scene.remove(_wallGroup);
    _wallGroup.traverse((obj) => {
        if (obj.isMesh) {
            // Floor geo/mat are per-level; dispose them. Shared wall geo/mat are NOT
            // disposed here (reused across levels) — guard by identity.
            if (obj.geometry !== _wallGeo) obj.geometry.dispose();
            if (obj.material !== _wallMat && obj.material !== _wallTopMat) {
                obj.material.dispose();
            }
        }
    });
    _wallGroup = null;
}
