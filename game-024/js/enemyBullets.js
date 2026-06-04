/**
 * enemyBullets.js — Projectiles fired by enemies at the player.
 *
 * Mirrors bullets.js (player shots) but in the danger color and travelling in
 * an arbitrary aimed direction rather than always "up". Enemies call
 * spawnEnemyBullet(x, z, dirX, dirZ) when they fire; collisions.js tests these
 * against the player.
 *
 * Like player bullets, all shots share one cached geometry + material and only
 * the Mesh wrappers churn. Additive blending so they glow red against the grid.
 *
 * Public API:
 *   initEnemyBullets()      — call once (currently a no-op; kept for symmetry).
 *   spawnEnemyBullet(x, z, dirX, dirZ) — fire one shot (dir is a unit vector).
 *   updateEnemyBullets(dt)  — advance + cull. Call each playing frame.
 *   resetEnemyBullets()     — remove all live shots on (re)start.
 *   getEnemyBullets()       — the live array (for collisions).
 */

import * as THREE from 'three';

import { scene } from './scene.js';
import {
    ENEMY_BULLET_SPEED,
    ENEMY_BULLET_RADIUS,
    FIELD_HALF_W,
    FIELD_HALF_H,
    COLORS,
} from './config.js';

let _geo = null;
let _mat = null;

// Live shots: { mesh, vx, vz }.
const shots = [];

function _ensureResources() {
    if (_geo) return;
    _geo = new THREE.SphereGeometry(ENEMY_BULLET_RADIUS, 8, 8);
    _mat = new THREE.MeshBasicMaterial({
        color: COLORS.danger,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    });
}

export function initEnemyBullets() { /* nothing to pre-build */ }

export function getEnemyBullets() { return shots; }

export function resetEnemyBullets() {
    for (const s of shots) scene.remove(s.mesh);
    shots.length = 0;
}

export function spawnEnemyBullet(x, z, dirX, dirZ) {
    _ensureResources();
    const mesh = new THREE.Mesh(_geo, _mat);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    shots.push({
        mesh,
        vx: dirX * ENEMY_BULLET_SPEED,
        vz: dirZ * ENEMY_BULLET_SPEED,
    });
}

export function updateEnemyBullets(dt) {
    const limX = FIELD_HALF_W + ENEMY_BULLET_RADIUS;
    const limZ = FIELD_HALF_H + ENEMY_BULLET_RADIUS;
    for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.mesh.position.x += s.vx * dt;
        s.mesh.position.z += s.vz * dt;

        const p = s.mesh.position;
        if (p.x < -limX || p.x > limX || p.z < -limZ || p.z > limZ) {
            scene.remove(s.mesh);
            shots.splice(i, 1);
        }
    }
}
