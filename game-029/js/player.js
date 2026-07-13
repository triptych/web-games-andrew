/**
 * player.js — player mesh, left/right steering, forward auto-walk distance,
 * and sword swing arc/hitbox. Camera trails the player (see updatePlayer()).
 *
 * Movement model: state.distance is the authoritative forward position
 * (advanced by main.js each frame at WALK_SPEED). This module only owns
 * lateral (x) position within the road and the sword swing state.
 */

import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { state } from './state.js';
import { events } from './events.js';
import { playSwordSwing } from './sounds.js';
import {
    PLAYER_STEER_SPEED, SWORD_RANGE, SWORD_ARC_HALF_WIDTH,
    SWORD_SWING_DURATION, SWORD_SWING_COOLDOWN, CAM_POS,
} from './config.js';
import { getRoadHalfWidth } from './path.js';

let mesh, swordPivot;
let _x = 0;                 // lateral offset from road center
let _steerDir = 0;          // -1, 0, 1 — set by input
let _swingTimer = 0;        // >0 while the swing hitbox is active
let _swingCooldown = 0;
let _hitThisSwing = new Set(); // monster objects already hit during the current swing

export function initPlayer() {
    _x = 0;
    _steerDir = 0;
    _swingTimer = 0;
    _swingCooldown = 0;
    _hitThisSwing.clear();

    const group = new THREE.Group();

    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.5, 1.2, 4, 8),
        new THREE.MeshStandardMaterial({ color: 0x64c8ff }),
    );
    body.position.y = 1.1;
    group.add(body);

    // Pivot sits at the hilt, near the player's hand; the blade extends
    // forward from there so rotating the pivot swings the sword like an
    // arm swinging from the shoulder, instead of spinning around its middle.
    swordPivot = new THREE.Group();
    swordPivot.position.set(0.5, 1.0, 0);
    swordPivot.visible = false;
    group.add(swordPivot);

    const swordMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.15, SWORD_RANGE),
        new THREE.MeshStandardMaterial({ color: 0xdcdcf0 }),
    );
    swordMesh.position.set(0, 0, SWORD_RANGE / 2);
    swordPivot.add(swordMesh);

    mesh = group;
    scene.add(mesh);

    document.addEventListener('keydown', _onKeyDown);
    document.addEventListener('keyup', _onKeyUp);
}

export function teardownPlayer() {
    document.removeEventListener('keydown', _onKeyDown);
    document.removeEventListener('keyup', _onKeyUp);
    if (mesh) {
        scene.remove(mesh);
        mesh.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });
        mesh = null;
    }
}

export function updatePlayer(dt) {
    if (!mesh) return;

    // Lateral steering, clamped to the road width.
    const halfWidth = getRoadHalfWidth() - 0.6;
    _x = Math.max(-halfWidth, Math.min(halfWidth, _x + _steerDir * PLAYER_STEER_SPEED * dt));

    mesh.position.set(_x, 0, state.distance);

    // Sword swing timers.
    if (_swingCooldown > 0) _swingCooldown -= dt;
    if (_swingTimer > 0) {
        _swingTimer -= dt;
        swordPivot.visible = true;
        swordPivot.rotation.y = Math.sin((1 - _swingTimer / SWORD_SWING_DURATION) * Math.PI) * 1.2 - 0.6;
        if (_swingTimer <= 0) swordPivot.visible = false;
    }

    // Camera trails behind/above the player but stays fixed laterally, so
    // steering visibly moves the player left/right on screen instead of
    // the whole rig (and the road) sliding the opposite way.
    camera.position.set(0, CAM_POS[1], state.distance - CAM_POS[2]);
    camera.lookAt(0, 1, state.distance + 20);
}

export function getPlayerX() { return _x; }

/** True while the sword hitbox is active this frame. */
export function isSwordActive() { return _swingTimer > 0; }

/**
 * Returns true at most once per swing per target — callers (monsters.js)
 * pass a stable identity (the monster object) so each swing can only land
 * on a given monster a single time regardless of how many frames the
 * hitbox overlaps it. Caller passes the monster's (x, z) world position.
 */
export function trySwordHit(target, targetX, targetZ) {
    if (_swingTimer <= 0) return false;
    if (_hitThisSwing.has(target)) return false;
    const dz = targetZ - state.distance;
    const dx = targetX - _x;
    if (dz < 0 || dz > SWORD_RANGE) return false;
    if (Math.abs(dx) > SWORD_ARC_HALF_WIDTH) return false;
    _hitThisSwing.add(target);
    return true;
}

function _swing() {
    if (_swingCooldown > 0) return;
    _swingTimer = SWORD_SWING_DURATION;
    _swingCooldown = SWORD_SWING_COOLDOWN;
    _hitThisSwing.clear();
    playSwordSwing();
    events.emit('swordSwing');
}

function _onKeyDown(e) {
    if (state.isGameOver || state.isPaused) return;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft')  _steerDir = 1;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') _steerDir = -1;
    if (e.key === ' ') _swing();
}

function _onKeyUp(e) {
    if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && _steerDir === 1) _steerDir = 0;
    if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && _steerDir === -1) _steerDir = 0;
}
