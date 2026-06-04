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
import { getPlayer } from './player.js';
import { spawnEnemyBullet } from './enemyBullets.js';
import { playEnemyShoot } from './sounds.js';
import {
    ENEMY_RADIUS,
    ENEMY_BASE_HP,
    BOSS_RADIUS,
    FIELD_HALF_W,
    FIELD_HALF_H,
    ENEMY_FIRE_COOLDOWN,
    ENEMY_TYPES,
    PATTERNS,
    COLORS,
} from './config.js';

// Shared per-type resources. Enemies reuse these; only the Mesh wrappers are
// added/removed from the scene, so we never dispose these per-enemy.
//
// _typeRes caches { geo, mat } per enemy archetype (config.ENEMY_TYPES). Every
// enemy of a type shares one geometry + material — only the Mesh wrappers churn.
const _typeRes = new Map();
let _bGeo = null;   // mini-boss geometry (bigger, busier shape)
let _bMat = null;   // mini-boss material (magenta, hotter glow)

// Live enemies. Each is a plain object holding its mesh + pattern state:
//   { mesh, hp, radius, pattern, t, speed, ... , isBoss, canFire, fireCd, fireTimer }
const enemies = [];

// Build the geometry for a type's `geo` key, sized to the base ENEMY_RADIUS
// (per-spawn radiusMul is applied via mesh.scale, so one geometry serves all).
function _buildGeo(geoKey) {
    const r = ENEMY_RADIUS;
    switch (geoKey) {
        case 'tetrahedron':  return new THREE.TetrahedronGeometry(r, 0);
        case 'box':          return new THREE.BoxGeometry(r * 1.4, r * 1.4, r * 1.4);
        case 'dodecahedron': return new THREE.DodecahedronGeometry(r, 0);
        case 'octahedron':
        default:             return new THREE.OctahedronGeometry(r, 0);
    }
}

// Look up (or lazily build) the shared geometry + material for an enemy type.
function _resourcesFor(type) {
    let res = _typeRes.get(type.key);
    if (res) return res;
    res = {
        geo: _buildGeo(type.geo),
        mat: new THREE.MeshStandardMaterial({
            color: type.color,
            emissive: type.color,
            emissiveIntensity: 1.2,
            metalness: 0.3,
            roughness: 0.5,
        }),
    };
    _typeRes.set(type.key, res);
    return res;
}

function _ensureResources() {
    // Pre-build every enemy archetype so the first spawn of each isn't a stutter.
    for (const t of Object.values(ENEMY_TYPES)) _resourcesFor(t);

    if (_bGeo) return;
    // Mini-boss: a larger, faceted icosahedron in neon magenta so it reads as
    // a distinct threat at a glance.
    _bGeo = new THREE.IcosahedronGeometry(BOSS_RADIUS, 0);
    _bMat = new THREE.MeshStandardMaterial({
        color: COLORS.magenta,
        emissive: COLORS.magenta,
        emissiveIntensity: 1.4,
        metalness: 0.4,
        roughness: 0.4,
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
 *   isBoss   — bigger mesh, BOSS_RADIUS, heavier fire (default false)
 *   type     — an ENEMY_TYPES.* profile (default GRUNT); ignored for bosses.
 *              Supplies the mesh shape/color and multiplies hp/speed/radius/value.
 *   canFire  — whether this enemy shoots at the player (default false)
 *   fireCd   — seconds between this enemy's shots (default ENEMY_FIRE_COOLDOWN)
 */
export function spawnEnemy(opts = {}) {
    _ensureResources();

    const pattern = opts.pattern || PATTERNS.DIVE;
    const isBoss  = !!opts.isBoss;
    const type    = opts.type || ENEMY_TYPES.GRUNT;
    const radius  = isBoss ? BOSS_RADIUS : ENEMY_RADIUS * type.radiusMul;

    // Sensible per-pattern defaults so a bare spawnEnemy({pattern}) still works.
    const topZ = -FIELD_HALF_H - radius;             // just off the top edge
    const baseX = (opts.x !== undefined)
        ? opts.x
        : (Math.random() * 2 - 1) * (FIELD_HALF_W - radius);

    let mesh;
    if (isBoss) {
        mesh = new THREE.Mesh(_bGeo, _bMat);
    } else {
        const res = _resourcesFor(type);
        mesh = new THREE.Mesh(res.geo, res.mat);
        // The geometry is built at base radius; per-type size comes from scale.
        if (type.radiusMul !== 1) mesh.scale.setScalar(type.radiusMul);
    }
    const startX = baseX;
    const startZ = (opts.z !== undefined) ? opts.z : topZ;
    mesh.position.set(startX, 0, startZ);
    scene.add(mesh);

    // Base descent speed, then scaled by the type (darters fast, brutes slow).
    const baseSpeed = opts.speed ?? 6;

    const e = {
        mesh,
        isBoss,
        type,
        hp:      opts.hp     ?? (isBoss ? ENEMY_BASE_HP : type.hp),
        radius,
        pattern,
        t:       0,
        speed:   isBoss ? baseSpeed : baseSpeed * type.speedMul,
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
        // Score awarded on kill: explicit > type profile > modest default.
        value:   opts.value  ?? (isBoss ? 1000 : type.value),
        // Firing
        canFire:   !!opts.canFire,
        fireCd:    opts.fireCd ?? ENEMY_FIRE_COOLDOWN,
        // Stagger initial shots so a wave doesn't volley in unison.
        fireTimer: (opts.fireCd ?? ENEMY_FIRE_COOLDOWN) * (0.5 + Math.random()),
    };

    // Swoop starts off a side edge rather than the top.
    if (pattern === PATTERNS.SWOOP) {
        mesh.position.x = e.side * (FIELD_HALF_W + radius);
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

// Tick an enemy's fire cooldown and, when ready, loose a shot aimed at the
// player's current position. Only fires while the enemy is actually on-field
// (past the top edge) so off-screen spawns don't shoot blind.
function _tryFire(e, dt) {
    if (!e.canFire) return;
    const ep = e.mesh.position;
    if (ep.z < -FIELD_HALF_H) return;   // still entering from the top

    e.fireTimer -= dt;
    if (e.fireTimer > 0) return;
    e.fireTimer = e.fireCd;

    const ship = getPlayer();
    if (!ship) return;

    // Aim a unit vector at the player; fall back to straight-down if coincident.
    let dx = ship.position.x - ep.x;
    let dz = ship.position.z - ep.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len; dz /= len;
    if (!isFinite(dx) || !isFinite(dz)) { dx = 0; dz = 1; }

    spawnEnemyBullet(ep.x, ep.z, dx, dz);
    playEnemyShoot();
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

        // Shoot at the player if this enemy is armed.
        _tryFire(e, dt);

        // Cull anything that has left the field on the bottom or far sides.
        const p = e.mesh.position;
        if (p.z > cullZ || p.x < -cullX || p.x > cullX) {
            scene.remove(e.mesh);
            enemies.splice(i, 1);
        }
    }
}
