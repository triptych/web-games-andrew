/**
 * bullets.js — Player projectiles.
 *
 * Subscribes to the `playerFired` event (emitted by player.js) and spawns a
 * glowing neon bullet that travels in the given direction until it leaves the
 * field, then is removed.
 *
 * Bullets use a shared geometry + material (cheap; no per-bullet GPU allocation)
 * and additive blending so they glow against the dark grid. Phase 2 collision
 * with enemies will hook into the live bullet list via getBullets().
 *
 * Public API:
 *   initBullets()      — wire the playerFired subscription. Call once.
 *   updateBullets(dt)  — advance + cull bullets. Call each playing frame.
 *   resetBullets()     — remove all live bullets on (re)start.
 *   getBullets()       — the live bullet array (for Phase 2 collisions).
 */

import * as THREE from 'three';

import { scene } from './scene.js';
import { events } from './events.js';
import {
    BULLET_SPEED,
    BULLET_RADIUS,
    FIELD_HALF_W,
    FIELD_HALF_H,
    COLORS,
} from './config.js';

// Shared resources — every bullet reuses these, so we never dispose them
// per-bullet (only the Mesh wrappers are added/removed from the scene).
let _geo = null;
let _mat = null;

// Live bullets: each is { mesh, vx, vz }.
const bullets = [];

function _ensureResources() {
    if (_geo) return;
    _geo = new THREE.SphereGeometry(BULLET_RADIUS, 8, 8);
    _mat = new THREE.MeshBasicMaterial({
        color: COLORS.bullet,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
    });
}

function _spawn({ x, z, dirX, dirZ }) {
    _ensureResources();
    const mesh = new THREE.Mesh(_geo, _mat);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    bullets.push({
        mesh,
        vx: dirX * BULLET_SPEED,
        vz: dirZ * BULLET_SPEED,
    });
}

// ============================================================
// Lifecycle
// ============================================================

export function initBullets() {
    events.on('playerFired', _spawn);
}

export function getBullets() { return bullets; }

export function resetBullets() {
    for (const b of bullets) scene.remove(b.mesh);
    bullets.length = 0;
}

// ============================================================
// Per-frame update
// ============================================================

export function updateBullets(dt) {
    // Iterate backward so we can splice culled bullets without skipping any.
    const limX = FIELD_HALF_W + BULLET_RADIUS;
    const limZ = FIELD_HALF_H + BULLET_RADIUS;
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.mesh.position.x += b.vx * dt;
        b.mesh.position.z += b.vz * dt;

        const p = b.mesh.position;
        if (p.x < -limX || p.x > limX || p.z < -limZ || p.z > limZ) {
            scene.remove(b.mesh);
            bullets.splice(i, 1);
        }
    }
}
