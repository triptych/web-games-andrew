/**
 * pickups.js — Floor pickups (food / treasure / key), key-gated doors, and the
 * level exit.
 *
 * On level load this module scans the maze grid (maze.js → findCells) and places:
 *   'F' food     → walk over to restore health
 *   'T' treasure → walk over for pure score
 *   'K' key      → walk over to gain a key (opens one door)
 *   'D' door     → blocks movement (registered closed in maze.js) until the
 *                  player approaches with a key, which is spent to open it
 *   'X' exit      → walk over to descend; emits 'levelExit' (main.js handles
 *                  the transition / victory)
 *
 * Player collection is proximity based: each frame we test the player's distance
 * against every live item. Doors aren't "collected" — when the player nears a
 * closed door and holds at least one key, the key is spent and the door opens
 * (maze.js.openDoorCell clears its collision, and the mesh animates down).
 *
 * GPU memory (THREE.JS GOTCHA #4): one shared geometry per item shape and one
 * shared material per pickup type are created once and reused. Collected item
 * meshes are removed (not disposed). Door meshes use a shared material too and
 * are removed on teardown. Per-level item lists are rebuilt each load.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import {
    findCells, cellToWorld, worldToCell, closeDoorCell, openDoorCell,
} from './maze.js';
import { getPlayerPos } from './player.js';
import { state } from './state.js';
import { events } from './events.js';
import { PICKUP_DEFS, COLORS, TILE_SIZE } from './config.js';
import { playPickup, playKey, playDoor } from './sounds.js';
import { spawnPopup } from './effects.js';

const ITEM_Y       = 0.7;    // pickups hover just off the floor
const PICKUP_DIST  = 1.6;    // center distance at which the player collects an item
const DOOR_TOUCH_DIST = 3.1; // Gauntlet-style: a held key opens a door the moment
                             // the player presses against it. The door cell is solid,
                             // so the player's center can't get closer than
                             // TILE_SIZE/2 + player RADIUS = 3.0; this is just past that.
const EXIT_DIST    = 1.8;    // distance at which the exit triggers a descend

// --- Shared geometries (one per shape, reused across all instances) ---
const _foodGeo     = new THREE.SphereGeometry(0.5, 10, 8);
const _treasureGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const _keyGeo      = new THREE.TorusGeometry(0.35, 0.14, 8, 14);
const _doorGeo     = new THREE.BoxGeometry(TILE_SIZE, 2.6, TILE_SIZE);
const _exitGeo     = new THREE.CylinderGeometry(1.3, 1.3, 0.3, 16);

// --- Shared materials (one per pickup type / fixture, reused) ---
const _mats = {
    food:     new THREE.MeshLambertMaterial({ color: PICKUP_DEFS.food.color,     emissive: 0x401020 }),
    treasure: new THREE.MeshLambertMaterial({ color: PICKUP_DEFS.treasure.color, emissive: 0x403000 }),
    key:      new THREE.MeshLambertMaterial({ color: PICKUP_DEFS.key.color,      emissive: 0x403010 }),
};
const _doorMat = new THREE.MeshLambertMaterial({ color: COLORS.door, emissive: 0x241404 });
const _exitMat = new THREE.MeshBasicMaterial({ color: COLORS.success });

function _itemGeo(type) {
    if (type === 'food')     return _foodGeo;
    if (type === 'treasure') return _treasureGeo;
    return _keyGeo;   // 'key'
}

// Active items: { type, def, mesh, col, row }  (food/treasure/key)
let _items = [];
// Active doors: { mesh, col, row, baseY, opening }
let _doors = [];
// The exit fixture, or null if the level has none.
let _exit = null;
let _spin = 0;   // shared spin accumulator for idle item animation

/**
 * Build all pickups, doors and the exit for the current level. Call AFTER
 * maze.loadLevel() (which clears door collision state we re-register here).
 */
export function initPickups() {
    _teardown();

    // --- Pickups: food / treasure / key ---
    for (const cell of findCells('FTK')) {
        const type = cell.ch === 'F' ? 'food' : cell.ch === 'T' ? 'treasure' : 'key';
        const mesh = new THREE.Mesh(_itemGeo(type), _mats[type]);
        mesh.position.set(cell.x, ITEM_Y, cell.z);
        scene.add(mesh);
        _items.push({ type, def: PICKUP_DEFS[type], mesh, col: cell.col, row: cell.row });
    }

    // --- Doors: render + register as closed collision ---
    for (const cell of findCells('D')) {
        const mesh = new THREE.Mesh(_doorGeo, _doorMat);
        mesh.position.set(cell.x, 1.3, cell.z);
        scene.add(mesh);
        closeDoorCell(cell.col, cell.row);
        _doors.push({ mesh, col: cell.col, row: cell.row, baseY: 1.3, opening: false });
    }

    // --- Exit ---
    const ex = findCells('X')[0];
    if (ex) {
        const mesh = new THREE.Mesh(_exitGeo, _exitMat);
        mesh.position.set(ex.x, 0.15, ex.z);
        scene.add(mesh);
        _exit = { mesh, col: ex.col, row: ex.row };
    } else {
        _exit = null;
    }
}

/** Remove all item/door/exit meshes from the scene (shared geo/mat — not disposed). */
function _teardown() {
    for (const it of _items) scene.remove(it.mesh);
    for (const d of _doors)  scene.remove(d.mesh);
    if (_exit) scene.remove(_exit.mesh);
    _items = [];
    _doors = [];
    _exit = null;
}

/** Public teardown for level swaps / restart. */
export function clearPickups() { _teardown(); }

function _collect(item, i) {
    _items.splice(i, 1);
    const { x, z } = item.mesh.position;
    scene.remove(item.mesh);   // shared geo/mat — do NOT dispose

    if (item.type === 'key') {
        state.addKey();
        playKey();
        spawnPopup(x, z, 'KEY', '#ffe070');
        events.emit('pickup', 'key', 1);
        return;
    }

    if (item.def.heal)  { state.heal(item.def.heal);   spawnPopup(x, z, `+${item.def.heal} HP`, '#60ff90'); }
    if (item.def.score) { state.addScore(item.def.score); spawnPopup(x, z, `+${item.def.score}`, '#ffd700'); }
    playPickup();
    events.emit('pickup', item.type, item.def.score || item.def.heal);
}

function _openDoor(door) {
    if (!state.useKey()) return;        // no key to spend
    door.opening = true;                // mesh slides down in updatePickups
    openDoorCell(door.col, door.row);   // clear collision immediately
    playDoor();
    events.emit('doorOpened', `${door.col},${door.row}`);
}

/** Per-frame: spin idle items, test collection, doors, and the exit. */
export function updatePickups(dt) {
    const p = getPlayerPos();
    _spin += dt;

    // --- Items: idle bob/spin + proximity collection ---
    for (let i = _items.length - 1; i >= 0; i--) {
        const it = _items[i];
        it.mesh.rotation.y = _spin * 1.5;
        it.mesh.position.y = ITEM_Y + Math.sin(_spin * 3 + it.col) * 0.12;

        const dx = it.mesh.position.x - p.x;
        const dz = it.mesh.position.z - p.z;
        if (dx * dx + dz * dz <= PICKUP_DIST * PICKUP_DIST) _collect(it, i);
    }

    // --- Doors: open when the player nears one with a key in hand; animate ---
    for (let i = _doors.length - 1; i >= 0; i--) {
        const d = _doors[i];
        if (!d.opening) {
            // Gauntlet-style: open only when the player is touching the door (and
            // holds a key). The door cell is solid, so "touching" means pressed up
            // against it — DOOR_TOUCH_DIST is just past the closest reachable center.
            if (state.keys > 0) {
                const dx = d.mesh.position.x - p.x;
                const dz = d.mesh.position.z - p.z;
                if (dx * dx + dz * dz <= DOOR_TOUCH_DIST * DOOR_TOUCH_DIST) _openDoor(d);
            }
            continue;
        }
        // Slide the door down into the floor, then remove it.
        d.mesh.position.y -= dt * 6;
        if (d.mesh.position.y <= d.baseY - 2.8) {
            scene.remove(d.mesh);
            _doors.splice(i, 1);
        }
    }

    // --- Exit: descend when the player steps on it ---
    if (_exit) {
        _exit.mesh.rotation.y = _spin * 2;
        const dx = _exit.mesh.position.x - p.x;
        const dz = _exit.mesh.position.z - p.z;
        if (dx * dx + dz * dz <= EXIT_DIST * EXIT_DIST) {
            const exit = _exit;
            _exit = null;   // consume once so we don't fire every frame
            scene.remove(exit.mesh);
            events.emit('levelExit');
        }
    }
}
