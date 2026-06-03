/**
 * enemies.js — Enemy ships with pluggable movement patterns.
 *
 * Each enemy is spawned with a named pattern (see config.PATTERNS) that drives
 * its motion every frame. Patterns are pure functions of the enemy's own state
 * plus elapsed time, so they compose cleanly and stay framerate-independent.
 *
 * Enemies share a geometry + material per "type" (cheap; no per-enemy GPU
 * allocation). Collision (bullets → enemies, enemies → player) lives in
 * collisions.js and reads the live list via getEnemies().
 *
 * Public API:
 *   initEnemies()          — wire up. Call once.
 *   spawnEnemy(opts)       — add one enemy running a pattern.
 *   updateEnemies(dt)      — advance all enemies + cull off-field. Call each frame.
 *   resetEnemies()         — remove all live enemies on (re)start.
 *   getEnemies()           — the live enemy array (for collisions).
 *   removeEnemy(enemy)     — destroy a single enemy (used by collisions on a kill).
 */

import * as THREE from 'three';

import { scene } from './scene.js';
import {
    ENEMY_RADIUS,
    ENEMY_BASE_HP,
    FIELD_HALF_W,
    FIELD_HALF_H,
    PATTERNS,
    COLORS,
} from './config.js';

// Shared per-type resources. Enemies reuse these; only the Mesh wrappers are
// added/removed from the scene, so we never dispose these per-enemy.
let _geo = null;
let _mat = null;

// Live enemies. Each is a plain object holding its mesh + pattern state:
//   { mesh, hp, radius, pattern, t, speed, vx, vz, amp, freq, phase,
//     cx, cz, orbitR, orbitW, baseX, descend, exiting }
const enemies = [];

function _ensureResources() {
    if (_geo) return;
    // Octahedron reads as a sharp diamond from overhead — clearly "not the ship".
    _geo = new THREE.OctahedronGeometry(ENEMY_RADIUS, 0);
    _mat = new THREE.MeshStandardMaterial({
        color: COLORS.danger,
        emissive: COLORS.danger,
        emissiveIntensity: 1.2,
        metalness: 0.3,
        roughness: 0.5,
    });
}

// ============================================================
// Lifecycle
// ============================================================

export function initEnemies() {
    _ensureResources();
}

export function getEnemies() { return enemies; }

export function resetEnemies() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
}

/**
 * Spawn an enemy. All fields optional except a starting position is derived
 * from the pattern when not given.
 *
 * opts:
 *   pattern  — one of PATTERNS.* (default DIVE)
 *   x, z     — start position (defaults chosen per-pattern, off the top edge)
 *   hp       — hit points (default ENEMY_BASE_HP)
 *   speed    — forward (descend) speed, world units/sec
 *   amp      — sine horizontal amplitude
 *   freq     — sine / orbit angular speed (rad/sec)
 *   cx, cz   — orbit center
 *   orbitR   — orbit radius
 */
export function spawnEnemy(opts = {}) {
    _ensureResources();

    const pattern = opts.pattern || PATTERNS.DIVE;

    // Sensible per-pattern defaults so a bare spawnEnemy({pattern}) still works.
    const topZ = -FIELD_HALF_H - ENEMY_RADIUS;       // just off the top edge
    const baseX = (opts.x !== undefined)
        ? opts.x
        : (Math.random() * 2 - 1) * (FIELD_HALF_W - ENEMY_RADIUS);

    const mesh = new THREE.Mesh(_geo, _mat);
    const startX = baseX;
    const startZ = (opts.z !== undefined) ? opts.z : topZ;
    mesh.position.set(startX, 0, startZ);
    scene.add(mesh);

    const e = {
        mesh,
        hp:      opts.hp     ?? ENEMY_BASE_HP,
        radius:  ENEMY_RADIUS,
        pattern,
        t:       0,
        speed:   opts.speed  ?? 6,
        amp:     opts.amp    ?? (FIELD_HALF_W * 0.6),
        freq:    opts.freq   ?? 2.0,
        phase:   opts.phase  ?? Math.random() * Math.PI * 2,
        baseX:   startX,
        // Orbit params
        cx:      opts.cx     ?? 0,
        cz:      opts.cz     ?? -FIELD_HALF_H * 0.35,
        orbitR:  opts.orbitR ?? (FIELD_HALF_W * 0.4),
        // Swoop: which side it enters from (-1 left, +1 right)
        side:    opts.side   ?? (Math.random() < 0.5 ? -1 : 1),
        // Score awarded on kill (set by waves later; default modest)
        value:   opts.value  ?? 100,
    };

    // Swoop starts off a side edge rather than the top.
    if (pattern === PATTERNS.SWOOP) {
        mesh.position.x = e.side * (FIELD_HALF_W + ENEMY_RADIUS);
        mesh.position.z = -FIELD_HALF_H * 0.5;
        e.baseX = mesh.position.x;
    }

    enemies.push(e);
    return e;
}

export function removeEnemy(enemy) {
    const i = enemies.indexOf(enemy);
    if (i === -1) return;
    scene.remove(enemy.mesh);
    enemies.splice(i, 1);
}

// ============================================================
// Movement patterns
// ============================================================
//
// Each pattern mutates the enemy's mesh.position from its state + dt. They all
// generally drift "down-field" (+Z, toward the player at the bottom) so the
// game keeps flowing; horizontal motion is what distinguishes them.

const _patternFns = {
    // DIVE — straight down toward the player rows.
    [PATTERNS.DIVE](e, dt) {
        e.mesh.position.z += e.speed * dt;
    },

    // SINE — weave horizontally while descending.
    [PATTERNS.SINE](e, dt) {
        e.mesh.position.z += e.speed * dt;
        const x = e.baseX + Math.sin(e.t * e.freq + e.phase) * e.amp;
        e.mesh.position.x = _clampX(x);
    },

    // ORBIT — circle a center point while the center itself drifts down, so the
    // enemy spirals toward the player rather than looping forever off-screen.
    [PATTERNS.ORBIT](e, dt) {
        e.cz += e.speed * 0.45 * dt;            // center drifts down slowly
        const a = e.t * e.freq + e.phase;
        e.mesh.position.x = _clampX(e.cx + Math.cos(a) * e.orbitR);
        e.mesh.position.z = e.cz + Math.sin(a) * e.orbitR;
    },

    // SWOOP — arc in from a side edge: sweep across in X while descending, the
    // X velocity easing as it crosses so it carves a curve rather than a line.
    [PATTERNS.SWOOP](e, dt) {
        e.mesh.position.z += e.speed * dt;
        // Move toward the opposite edge, decelerating as it nears center-ish.
        const targetX = -e.side * (FIELD_HALF_W * 0.7);
        e.mesh.position.x += (targetX - e.mesh.position.x) * Math.min(1, e.freq * 0.5 * dt);
    },
};

function _clampX(x) {
    const lim = FIELD_HALF_W - ENEMY_RADIUS;
    return Math.max(-lim, Math.min(lim, x));
}

// ============================================================
// Per-frame update
// ============================================================

export function updateEnemies(dt) {
    // Cull margin: enemies that pass below the player edge are gone for good.
    const cullZ = FIELD_HALF_H + ENEMY_RADIUS * 2;
    const cullX = FIELD_HALF_W + ENEMY_RADIUS * 4;

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.t += dt;

        const fn = _patternFns[e.pattern] || _patternFns[PATTERNS.DIVE];
        fn(e, dt);

        // Spin for a little life (purely cosmetic).
        e.mesh.rotation.y += dt * 1.5;
        e.mesh.rotation.x += dt * 0.8;

        // Cull anything that has left the field on the bottom or far sides.
        const p = e.mesh.position;
        if (p.z > cullZ || p.x < -cullX || p.x > cullX) {
            scene.remove(e.mesh);
            enemies.splice(i, 1);
        }
    }
}
