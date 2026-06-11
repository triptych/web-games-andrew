/**
 * player.js — Player avatar: class-driven 8-direction movement with wall
 * collision (axis-separated so you slide along walls instead of sticking).
 *
 * Input is read from a small key-set this module owns; main.js just calls
 * initPlayer(cls) on spawn and updatePlayer(dt) each frame.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { collidesCircle, getSpawn } from './maze.js';
import { events } from './events.js';

const RADIUS     = 1.0;    // collision radius (world units)
const HURT_FLASH = 0.18;   // seconds the avatar glows red after taking a hit

let _mesh   = null;
let _speed  = 6;
let _color  = 0x64c8ff;
let _hurt   = 0;           // remaining hurt-flash time (seconds)

const _keys = new Set();

function _onKeyDown(e) { _keys.add(e.key.toLowerCase()); }
function _onKeyUp(e)   { _keys.delete(e.key.toLowerCase()); }

// Subscribe ONCE at module load (initPlayer runs per level — subscribing there
// would stack listeners). The flash is rendered/decayed in updatePlayer.
events.on('playerHurt', () => { _hurt = HURT_FLASH; });

/** Wire up movement key listeners (idempotent). */
export function attachPlayerInput() {
    window.addEventListener('keydown', _onKeyDown);
    window.addEventListener('keyup',   _onKeyUp);
}
export function detachPlayerInput() {
    window.removeEventListener('keydown', _onKeyDown);
    window.removeEventListener('keyup',   _onKeyUp);
    _keys.clear();
}

/** Spawn (or respawn) the player for a given class definition. */
export function initPlayer(cls) {
    _speed = cls.speed;
    _color = cls.color;

    if (!_mesh) {
        // A simple capsule-ish avatar: a colored box with a brighter "head".
        const geo = new THREE.BoxGeometry(1.4, 1.6, 1.4);
        const mat = new THREE.MeshLambertMaterial({ color: _color });
        _mesh = new THREE.Mesh(geo, mat);
        scene.add(_mesh);
    } else {
        _mesh.material.color.setHex(_color);
    }

    _hurt = 0;
    _mesh.material.emissive.setHex(0x000000);

    const spawn = getSpawn();
    _mesh.position.set(spawn.x, 0.8, spawn.z);
    attachPlayerInput();
}

/** Current player world position (Vector3). */
export function getPlayerPos() {
    return _mesh ? _mesh.position : new THREE.Vector3();
}

/** Facing as a unit vector in the XZ plane (for aiming shots later). */
let _facing = new THREE.Vector3(0, 0, 1);
export function getPlayerFacing() { return _facing.clone(); }

/** Per-frame update. dt in seconds. */
export function updatePlayer(dt) {
    if (!_mesh) return;

    // Hurt flash: glow red, fading out. Decay before the no-input early return
    // so the flash still fades when the player is standing still.
    if (_hurt > 0) {
        _hurt -= dt;
        const k = Math.max(0, _hurt / HURT_FLASH);
        _mesh.material.emissive.setRGB(k, 0, 0);
    }

    let dx = 0, dz = 0;
    if (_keys.has('arrowup')    || _keys.has('w')) dz -= 1;
    if (_keys.has('arrowdown')  || _keys.has('s')) dz += 1;
    if (_keys.has('arrowleft')  || _keys.has('a')) dx -= 1;
    if (_keys.has('arrowright') || _keys.has('d')) dx += 1;

    if (dx === 0 && dz === 0) return;

    // Normalize so diagonal movement isn't faster.
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
    _facing.set(dx, 0, dz);

    const step = _speed * dt;
    const px = _mesh.position.x;
    const pz = _mesh.position.z;

    // Axis-separated collision → slide along walls.
    const nx = px + dx * step;
    if (!collidesCircle(nx, pz, RADIUS)) _mesh.position.x = nx;

    const nz = pz + dz * step;
    if (!collidesCircle(_mesh.position.x, nz, RADIUS)) _mesh.position.z = nz;

    // Face the direction of travel (yaw only).
    _mesh.rotation.y = Math.atan2(dx, dz);
}
