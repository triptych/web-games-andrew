/**
 * player.js — player mesh, movement, and sword swing arc/hitbox. Camera
 * trails the player (see updatePlayer()).
 *
 * Movement model: state.distance is the authoritative forward position,
 * advanced by main.js each frame at WALK_SPEED *only while no encounter is
 * locked* (main.js tracks the locked chunk and skips the advance). While
 * combat-locked, forward auto walk halts and this module adds a bounded
 * fwd/back offset (_zOffset) on top of the frozen state.distance so the
 * player can move within the arena; setCombatLock()/clearCombatLock()
 * toggle this and reset the offset.
 */

import * as THREE from 'three';
import { scene, camera } from './scene.js';
import { state } from './state.js';
import { events } from './events.js';
import { playSwordSwing } from './sounds.js';
import {
    PLAYER_STEER_SPEED, SWORD_RANGE, SWORD_ARC_HALF_WIDTH,
    SWORD_SWING_DURATION, SWORD_SWING_COOLDOWN, CAM_POS, ARENA_Z_RADIUS,
} from './config.js';
import { getRoadHalfWidth } from './path.js';

let mesh, swordPivot;
let _x = 0;                 // lateral offset from road center
let _steerDir = 0;          // -1, 0, 1 — set by input
let _moveDir = 0;           // -1, 0, 1 — forward/back input, only applied while combat-locked
let _swingTimer = 0;        // >0 while the swing hitbox is active
let _swingCooldown = 0;
let _hitThisSwing = new Set(); // monster objects already hit during the current swing
let _inCombat = false;
let _lockedZ = 0;           // state.distance at the moment combat locked
let _zOffset = 0;           // fwd/back offset from _lockedZ, only nonzero while _inCombat

export function initPlayer() {
    _x = 0;
    _steerDir = 0;
    _moveDir = 0;
    _swingTimer = 0;
    _swingCooldown = 0;
    _hitThisSwing.clear();
    _inCombat = false;
    _lockedZ = 0;
    _zOffset = 0;

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

    // Lateral steering, clamped to the road width. Armor's moveSpeed is a
    // flat bonus added to the base steer speed.
    const armor = state.equipped.armor;
    const moveSpeed = PLAYER_STEER_SPEED + (armor ? armor.moveSpeed : 0);
    const halfWidth = getRoadHalfWidth() - 0.6;
    _x = Math.max(-halfWidth, Math.min(halfWidth, _x + _steerDir * moveSpeed * dt));

    // Forward/back movement only applies while combat-locked — otherwise
    // state.distance itself is the forward position (see main.js).
    if (_inCombat) {
        _zOffset = Math.max(-ARENA_Z_RADIUS, Math.min(ARENA_Z_RADIUS, _zOffset + _moveDir * moveSpeed * dt));
    }

    const z = _inCombat ? _lockedZ + _zOffset : state.distance;
    mesh.position.set(_x, 0, z);

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
    camera.position.set(0, CAM_POS[1], z - CAM_POS[2]);
    camera.lookAt(0, 1, z + 20);
}

export function getPlayerX() { return _x; }
export function getPlayerZ() { return _inCombat ? _lockedZ + _zOffset : state.distance; }

/** Locks forward auto-walk and lets the player move fwd/back within the arena. */
export function setCombatLock() {
    if (_inCombat) return;
    _inCombat = true;
    _lockedZ = state.distance;
    _zOffset = 0;
}

/** Releases the combat lock; the player's world Z snaps back to state.distance. */
export function clearCombatLock() {
    _inCombat = false;
    _zOffset = 0;
}

export function isCombatLocked() { return _inCombat; }

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
    // Symmetric fwd/back reach — in the arena, monsters can be on either
    // side of the player, not just strictly ahead.
    const dz = targetZ - (_inCombat ? _lockedZ + _zOffset : state.distance);
    const dx = targetX - _x;
    if (Math.abs(dz) > SWORD_RANGE) return false;
    if (Math.abs(dx) > SWORD_ARC_HALF_WIDTH) return false;
    _hitThisSwing.add(target);
    return true;
}

function _swing() {
    if (_swingCooldown > 0) return;
    // Weapon attackSpeed scales the cooldown down (higher attackSpeed =
    // faster swings); bare-handed baseline is 1.0, matching BASE_WEAPON.
    const weapon = state.equipped.weapon;
    const attackSpeed = weapon ? weapon.attackSpeed : 1.0;
    _swingTimer = SWORD_SWING_DURATION;
    _swingCooldown = SWORD_SWING_COOLDOWN / attackSpeed;
    _hitThisSwing.clear();
    playSwordSwing();
    events.emit('swordSwing');
}

function _onKeyDown(e) {
    if (state.isGameOver || state.isPaused) return;
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft')  _steerDir = 1;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') _steerDir = -1;
    // Fwd/back only has an effect while combat-locked (see updatePlayer).
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp')   _moveDir = 1;
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') _moveDir = -1;
    if (e.key === ' ') _swing();
}

function _onKeyUp(e) {
    if ((e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') && _steerDir === 1) _steerDir = 0;
    if ((e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') && _steerDir === -1) _steerDir = 0;
    if ((e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') && _moveDir === 1) _moveDir = 0;
    if ((e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') && _moveDir === -1) _moveDir = 0;
}
