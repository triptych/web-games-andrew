/**
 * dungeon.js — Tile grid data + level mesh generation.
 *
 * The dungeon is a 2D grid of tiles. Each cell is one of:
 *   '#' wall   '.' floor   'S' start (floor)   '>' descent stairs (floor)
 *
 * World mapping: tile (x, z) maps to world position
 *   worldX = x * TILE_SIZE,  worldZ = z * TILE_SIZE
 * so the grid lies in the XZ plane with +Z running "south" (matches DIRS).
 *
 * Call initDungeon() once after initScene(). Re-call buildLevel() to swap levels.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { TILE_SIZE, WALL_HEIGHT, COLORS } from './config.js';

// Hand-authored first level. Rows are Z (north→south), columns are X (west→east).
// Keep the outer ring solid wall so the player can never walk off the grid.
const LEVEL_1 = [
    '###############',
    '#S....#.....>..#',
    '#.###.#.###.##.#',
    '#.#...#...#....#',
    '#.#.#####.#.##.#',
    '#...#.....#.#..#',
    '###.#.###.#.#.##',
    '#...#.#.#.#.#..#',
    '#.###.#.#.#.##.#',
    '#.....#...#....#',
    '###############',
];

export let grid = [];          // 2D array of chars, grid[z][x]
export let gridW = 0, gridH = 0;
export let startTile = { x: 1, z: 1 };

let _group = null;             // THREE.Group holding all level meshes (for disposal)

// Shared materials — created once, reused across all tiles (don't dispose per-mesh).
let _matWall, _matFloor, _matCeil, _matStairs;

export function initDungeon() {
    _matWall   = new THREE.MeshStandardMaterial({ color: COLORS.wall,    roughness: 0.95 });
    _matFloor  = new THREE.MeshStandardMaterial({ color: COLORS.floor,   roughness: 1.0 });
    _matCeil   = new THREE.MeshStandardMaterial({ color: COLORS.ceiling, roughness: 1.0 });
    _matStairs = new THREE.MeshStandardMaterial({ color: COLORS.accent,  roughness: 0.6, emissive: 0x0a2030 });
    buildLevel(LEVEL_1);
}

/** Returns true if the tile at (x, z) is passable (inside grid and not a wall). */
export function isWalkable(x, z) {
    if (z < 0 || z >= gridH || x < 0 || x >= gridW) return false;
    return grid[z][x] !== '#';
}

/** Char at a tile, or '#' if out of bounds. */
export function tileAt(x, z) {
    if (z < 0 || z >= gridH || x < 0 || x >= gridW) return '#';
    return grid[z][x];
}

export function buildLevel(layout) {
    _disposeLevel();

    grid  = layout.map(row => row.split(''));
    gridH = grid.length;
    gridW = grid[0].length;

    _group = new THREE.Group();

    // Reusable unit geometries, scaled per instance via mesh.scale where needed.
    const floorGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const ceilGeo  = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
    const wallGeo  = new THREE.BoxGeometry(TILE_SIZE, WALL_HEIGHT, TILE_SIZE);

    for (let z = 0; z < gridH; z++) {
        for (let x = 0; x < gridW; x++) {
            const ch = grid[z][x];
            const wx = x * TILE_SIZE;
            const wz = z * TILE_SIZE;

            if (ch === 'S') startTile = { x, z };

            if (ch === '#') {
                const wall = new THREE.Mesh(wallGeo, _matWall);
                wall.position.set(wx, WALL_HEIGHT / 2, wz);
                _group.add(wall);
            } else {
                // Floor (face up)
                const floor = new THREE.Mesh(floorGeo, ch === '>' ? _matStairs : _matFloor);
                floor.rotation.x = -Math.PI / 2;
                floor.position.set(wx, 0, wz);
                _group.add(floor);

                // Ceiling (face down)
                const ceil = new THREE.Mesh(ceilGeo, _matCeil);
                ceil.rotation.x = Math.PI / 2;
                ceil.position.set(wx, WALL_HEIGHT, wz);
                _group.add(ceil);
            }
        }
    }

    scene.add(_group);
}

function _disposeLevel() {
    if (!_group) return;
    scene.remove(_group);
    // Geometries are per-build (created above), so free them; materials are shared.
    _group.traverse(obj => {
        if (obj.isMesh) obj.geometry.dispose();
    });
    _group = null;
}
