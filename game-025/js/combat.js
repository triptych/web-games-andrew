/**
 * combat.js — Player attacks, projectiles, and damage resolution.
 *
 * Two attack styles, chosen by the class's `range` (config.js → CLASSES):
 *   range === 0  → MELEE: instant damage to every enemy/nest inside a short arc
 *                  in front of the player (MELEE_RANGE, MELEE_ARC half-angle).
 *   range  >  0  → RANGED: fires a projectile along the player's facing that
 *                  travels at SHOT_SPEED, lives SHOT_LIFETIME seconds, and is
 *                  consumed on the first enemy/nest it touches or on a wall.
 *
 * Attacks are gated by ATTACK_COOLDOWN and fired on Space or left-click. This
 * module owns its own input listeners (mirroring player.js) and queries
 * enemies.js / nests.js to apply damage.
 *
 * GPU memory: one shared geometry + per-class-color material for shots; shot
 * meshes are removed (not disposed) on despawn (THREE.JS GOTCHA #4).
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { collidesCircle } from './maze.js';
import { getPlayerPos, getPlayerFacing } from './player.js';
import { getEnemies, damageEnemy } from './enemies.js';
import { getNests, damageNest } from './nests.js';
import { state } from './state.js';
import { ATTACK_COOLDOWN, SHOT_SPEED, SHOT_LIFETIME } from './config.js';
import { playAttack, playShot, playHit } from './sounds.js';

const MELEE_RANGE = 3.2;    // reach of a melee swing (world units, center-to-center)
const MELEE_ARC   = 0.9;    // half-angle (radians) of the swing cone (~51°)
const SHOT_RADIUS = 0.5;    // projectile hit radius
const NEST_HALF   = 1.3;    // nest half-extent for shot/melee overlap (matches 2.4 box)

let _power  = 20;    // damage per hit (from class.power)
let _range  = 0;     // 0 = melee, >0 = ranged
let _color  = 0xffffff;
let _cooldown = 0;   // seconds until the next attack is allowed

let _wantAttack = false;   // set by input, consumed in update

// --- Shared shot geometry + per-run material (created once / per class color) ---
const _shotGeo = new THREE.SphereGeometry(SHOT_RADIUS, 8, 6);
let _shotMat = null;

// Active projectiles: { mesh, vx, vz, life }
let _shots = [];

function _onKeyDown(e) {
    if (e.key === ' ' || e.code === 'Space') { _wantAttack = true; e.preventDefault(); }
}
function _onMouseDown(e) {
    if (e.button === 0) _wantAttack = true;   // left click
}

export function attachCombatInput() {
    window.addEventListener('keydown', _onKeyDown);
    window.addEventListener('mousedown', _onMouseDown);
}
export function detachCombatInput() {
    window.removeEventListener('keydown', _onKeyDown);
    window.removeEventListener('mousedown', _onMouseDown);
    _wantAttack = false;
}

/**
 * Configure combat for a class and clear any leftover shots. Call on spawn.
 * Wires input listeners (idempotent via attach/detach in main.js's flow).
 */
export function initCombat(cls) {
    _power = cls.power;
    _range = cls.range;
    _color = cls.color;
    _cooldown = 0;
    _wantAttack = false;

    if (_shotMat) _shotMat.dispose();
    _shotMat = new THREE.MeshBasicMaterial({ color: _color });

    _clearShots();
    attachCombatInput();
}

function _clearShots() {
    for (const s of _shots) scene.remove(s.mesh);
    _shots = [];
}

/** Per-frame: handle cooldown, fire queued attacks, advance projectiles. */
export function updateCombat(dt) {
    _cooldown -= dt;

    if (_wantAttack) {
        _wantAttack = false;
        if (_cooldown <= 0) {
            _cooldown = ATTACK_COOLDOWN;
            if (_range > 0) _fireShot();
            else            _meleeSwing();
        }
    }

    _updateShots(dt);
}

// --- Melee: instant cone damage in front of the player ---
function _meleeSwing() {
    playAttack();

    const p = getPlayerPos();
    const f = getPlayerFacing();   // unit XZ vector
    let landed = false;

    // Enemies inside the cone.
    for (const e of getEnemies().slice()) {   // slice: damageEnemy mutates the list
        const dx = e.mesh.position.x - p.x;
        const dz = e.mesh.position.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > MELEE_RANGE || dist < 0.0001) continue;
        // Angle between facing and the direction to the enemy.
        const dot = (dx / dist) * f.x + (dz / dist) * f.z;
        if (dot < Math.cos(MELEE_ARC)) continue;
        damageEnemy(e, _power);
        landed = true;
    }

    // Nests inside the cone (treat as a point at the nest center).
    for (const n of getNests().slice()) {
        const dx = n.mesh.position.x - p.x;
        const dz = n.mesh.position.z - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > MELEE_RANGE + NEST_HALF || dist < 0.0001) continue;
        const dot = (dx / dist) * f.x + (dz / dist) * f.z;
        if (dot < Math.cos(MELEE_ARC)) continue;
        damageNest(n, _power);
        landed = true;
    }

    if (landed) playHit();
}

// --- Ranged: spawn a projectile along the player's facing ---
function _fireShot() {
    playShot();

    const p = getPlayerPos();
    const f = getPlayerFacing();

    const mesh = new THREE.Mesh(_shotGeo, _shotMat);
    // Start a little ahead of the player so it doesn't self-collide.
    mesh.position.set(p.x + f.x * 1.2, 0.9, p.z + f.z * 1.2);
    scene.add(mesh);

    _shots.push({
        mesh,
        vx: f.x * SHOT_SPEED,
        vz: f.z * SHOT_SPEED,
        life: SHOT_LIFETIME,
    });
}

function _updateShots(dt) {
    if (!_shots.length) return;

    for (let i = _shots.length - 1; i >= 0; i--) {
        const s = _shots[i];
        s.life -= dt;

        const x = s.mesh.position.x + s.vx * dt;
        const z = s.mesh.position.z + s.vz * dt;
        s.mesh.position.set(x, 0.9, z);

        let consumed = s.life <= 0 || collidesCircle(x, z, SHOT_RADIUS);

        // Enemy hits.
        if (!consumed) {
            for (const e of getEnemies()) {
                const dx = e.mesh.position.x - x;
                const dz = e.mesh.position.z - z;
                if (dx * dx + dz * dz <= (SHOT_RADIUS + 0.9) ** 2) {
                    damageEnemy(e, _power);
                    playHit();
                    consumed = true;
                    break;
                }
            }
        }

        // Nest hits.
        if (!consumed) {
            for (const n of getNests()) {
                const dx = Math.abs(n.mesh.position.x - x);
                const dz = Math.abs(n.mesh.position.z - z);
                if (dx <= NEST_HALF + SHOT_RADIUS && dz <= NEST_HALF + SHOT_RADIUS) {
                    damageNest(n, _power);
                    playHit();
                    consumed = true;
                    break;
                }
            }
        }

        if (consumed) {
            scene.remove(s.mesh);   // shared geo/mat — do NOT dispose
            _shots.splice(i, 1);
        }
    }
}
