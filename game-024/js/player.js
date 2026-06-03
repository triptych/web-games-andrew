/**
 * player.js — The player ship: 8-directional movement, field bounds, and
 * auto-fire while holding Space / left mouse button.
 *
 * The ship is an emissive neon mesh on the XZ plane (the camera looks straight
 * down). Movement is read from a keyboard state map so diagonal input combines
 * cleanly and is normalized to keep diagonal speed equal to straight speed.
 *
 * Firing is decoupled from the (Phase 2) bullet system: each shot emits a
 * `playerFired` event carrying the spawn position and direction. Whatever owns
 * bullets subscribes and spawns the projectile — player.js never touches bullets.
 *
 * Public API:
 *   initPlayer()      — build the mesh, add to scene, wire input. Call once.
 *   updatePlayer(dt)  — move + handle fire cooldown. Call each playing frame.
 *   resetPlayer()     — recenter and clear cooldown on (re)start.
 *   getPlayer()       — the THREE.Mesh (for collision checks in Phase 2).
 */

import * as THREE from 'three';

import { scene } from './scene.js';
import { events } from './events.js';
import { playShoot } from './sounds.js';
import {
    PLAYER_SPEED,
    PLAYER_RADIUS,
    FIRE_COOLDOWN,
    FIELD_HALF_W,
    FIELD_HALF_H,
    COLORS,
} from './config.js';

let ship = null;
let fireTimer = 0;          // counts down to the next allowed shot

// Live keyboard / mouse state. We poll these in updatePlayer() rather than
// acting on keydown directly so movement is frame-rate independent and
// diagonals combine naturally.
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
};

// Scratch vector reused each frame to avoid per-frame allocation.
const _move = new THREE.Vector3();

// ============================================================
// Mesh
// ============================================================

function _buildShip() {
    // A flat triangular "arrow" pointing up-field (toward -Z, the way enemies
    // come from). ConeGeometry gives us a clean triangle when viewed top-down;
    // laid flat and rotated so its point faces -Z.
    const geo = new THREE.ConeGeometry(PLAYER_RADIUS, PLAYER_RADIUS * 2.4, 3);
    geo.rotateX(-Math.PI / 2);         // lay flat; nose points toward -Z (up-field)

    const mat = new THREE.MeshStandardMaterial({
        color: COLORS.player,
        emissive: COLORS.player,
        emissiveIntensity: 1.4,
        metalness: 0.3,
        roughness: 0.4,
    });

    ship = new THREE.Mesh(geo, mat);
    ship.position.set(0, 0, FIELD_HALF_H - 2);   // start near the bottom edge

    // A soft point light riding with the ship sells the neon glow against the
    // dark floor without needing post-processing bloom.
    const glow = new THREE.PointLight(COLORS.player, 6, 8, 2);
    glow.position.set(0, 1.5, 0);
    ship.add(glow);

    scene.add(ship);
}

// ============================================================
// Input
// ============================================================

function _onKeyDown(e) { _setKey(e, true); }
function _onKeyUp(e)   { _setKey(e, false); }

function _setKey(e, pressed) {
    switch (e.key) {
        case 'w': case 'W': case 'ArrowUp':    keys.up = pressed; break;
        case 's': case 'S': case 'ArrowDown':  keys.down = pressed; break;
        case 'a': case 'A': case 'ArrowLeft':  keys.left = pressed; break;
        case 'd': case 'D': case 'ArrowRight': keys.right = pressed; break;
        case ' ': case 'Spacebar':             keys.fire = pressed; break;
        default: return;
    }
    // Arrows/space would otherwise scroll the page while playing.
    e.preventDefault();
}

function _onMouseDown(e) { if (e.button === 0) keys.fire = true; }
function _onMouseUp(e)   { if (e.button === 0) keys.fire = false; }

// ============================================================
// Lifecycle
// ============================================================

export function initPlayer() {
    if (!ship) _buildShip();

    window.addEventListener('keydown', _onKeyDown);
    window.addEventListener('keyup',   _onKeyUp);
    window.addEventListener('mousedown', _onMouseDown);
    window.addEventListener('mouseup',   _onMouseUp);
    // Releasing focus (alt-tab) leaves keys "stuck" down — clear on blur.
    window.addEventListener('blur', resetInput);
}

export function getPlayer() { return ship; }

export function resetPlayer() {
    if (ship) ship.position.set(0, 0, FIELD_HALF_H - 2);
    fireTimer = 0;
    resetInput();
}

export function resetInput() {
    keys.up = keys.down = keys.left = keys.right = keys.fire = false;
}

// ============================================================
// Per-frame update
// ============================================================

export function updatePlayer(dt) {
    if (!ship) return;

    // --- Movement: build a direction from the held keys, normalize so a
    // diagonal isn't faster than a cardinal move. ---
    _move.set(
        (keys.right ? 1 : 0) - (keys.left ? 1 : 0),
        0,
        (keys.down  ? 1 : 0) - (keys.up   ? 1 : 0),
    );

    if (_move.lengthSq() > 0) {
        _move.normalize().multiplyScalar(PLAYER_SPEED * dt);
        ship.position.x += _move.x;
        ship.position.z += _move.z;

        // Keep the ship inside the field, accounting for its radius.
        const maxX = FIELD_HALF_W - PLAYER_RADIUS;
        const maxZ = FIELD_HALF_H - PLAYER_RADIUS;
        ship.position.x = Math.max(-maxX, Math.min(maxX, ship.position.x));
        ship.position.z = Math.max(-maxZ, Math.min(maxZ, ship.position.z));
    }

    // --- Firing: auto-fire while held, gated by the cooldown timer. ---
    fireTimer -= dt;
    if (keys.fire && fireTimer <= 0) {
        fireTimer = FIRE_COOLDOWN;
        _fire();
    }
}

function _fire() {
    playShoot();
    // Spawn just ahead of the nose; bullets travel up-field (toward -Z).
    events.emit('playerFired', {
        x: ship.position.x,
        z: ship.position.z - (PLAYER_RADIUS * 1.4),
        dirX: 0,
        dirZ: -1,
    });
}
