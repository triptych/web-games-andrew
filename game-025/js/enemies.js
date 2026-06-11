/**
 * enemies.js — Enemy avatars, chase AI, and contact damage.
 *
 * Nests (nests.js) ask this module to spawn enemies; combat (combat.js) asks it
 * to damage them. Enemies chase the player each frame (greedy axis-step with the
 * same circle-vs-wall collision the player uses, so they slide along walls and
 * don't tunnel) and deal contact damage on a per-enemy cooldown.
 *
 * GPU memory: geometry + per-type materials are created ONCE and shared across
 * all instances (see THREE.JS GOTCHA #4 in main.js). Only the per-enemy Mesh is
 * created/destroyed; meshes share the cached geometry/material so disposing a
 * dead enemy just removes it from the scene — no per-instance dispose needed.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { collidesCircle } from './maze.js';
import { getPlayerPos } from './player.js';
import { state } from './state.js';
import { ENEMY_DEFS } from './config.js';
import { playEnemyDeath, playPlayerHurt } from './sounds.js';
import { spawnPopup, spawnBurst } from './effects.js';

const RADIUS         = 0.9;    // enemy collision radius
const CONTACT_DIST   = 1.9;    // center distance at which an enemy hits the player
const CONTACT_COOLDOWN = 0.8;  // seconds between contact hits from one enemy
const Y              = 0.7;    // resting height (slightly shorter than the player)

const HIT_FLASH  = 0.12;       // seconds an enemy stays lit white after a hit
const ATK_ANIM   = 0.3;        // seconds an enemy's lunge/bite animation lasts

// --- Shared geometry + per-type materials (created once, reused) ---
const _geo = new THREE.BoxGeometry(1.2, 1.4, 1.2);
const _mats = {};   // type -> MeshLambertMaterial
function _matFor(type) {
    if (!_mats[type]) {
        _mats[type] = new THREE.MeshLambertMaterial({ color: ENEMY_DEFS[type].color });
    }
    return _mats[type];
}

// One shared bright material for the hit flash. Enemies share materials per type,
// so we can't tint the type material (every enemy of that type would flash).
// Instead we swap the mesh's material to this for the flash, then swap back.
const _hitMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

// Active enemies. Each: { mesh, type, def, hp, contactTimer }
let _enemies = [];

/** Reset enemy state for a fresh level (removes all meshes from the scene). */
export function initEnemies() {
    for (const e of _enemies) scene.remove(e.mesh);
    _enemies = [];
}

/** How many enemies are currently alive (used by nest caps / level-clear). */
export function enemyCount() { return _enemies.length; }

/** Read-only-ish access for combat damage resolution. */
export function getEnemies() { return _enemies; }

/**
 * Spawn one enemy of `type` at world (x, z). Returns the enemy record.
 * Called by nests.js.
 */
export function spawnEnemy(type, x, z) {
    if (!ENEMY_DEFS[type]) type = 'grunt';   // unknown type → safe default
    const def = ENEMY_DEFS[type];
    const mesh = new THREE.Mesh(_geo, _matFor(type));
    mesh.position.set(x, Y, z);
    scene.add(mesh);

    const enemy = { mesh, type, def, hp: def.hp, contactTimer: 0, flash: 0, attack: 0 };
    _enemies.push(enemy);
    return enemy;
}

/**
 * Apply `dmg` to an enemy. On death: removes it, awards score, plays SFX.
 * Returns true if the enemy died. Called by combat.js.
 */
export function damageEnemy(enemy, dmg) {
    enemy.hp -= dmg;
    const { x, z } = enemy.mesh.position;
    if (enemy.hp > 0) {
        // Survived — flash white briefly. Swap to the shared hit material now;
        // updateEnemies swaps it back to the type material when the timer runs out.
        enemy.flash = HIT_FLASH;
        enemy.mesh.material = _hitMat;
        spawnPopup(x, z, String(Math.round(dmg)), '#ffd0d0');
        return false;
    }
    _killEnemy(enemy);
    return true;
}

function _killEnemy(enemy) {
    const i = _enemies.indexOf(enemy);
    if (i === -1) return;
    _enemies.splice(i, 1);
    const { x, z } = enemy.mesh.position;
    scene.remove(enemy.mesh);   // shared geo/mat — do NOT dispose
    state.addScore(enemy.def.score);
    spawnBurst(x, z, enemy.def.color, 10);
    spawnPopup(x, z, `+${enemy.def.score}`, '#ffe070');
    playEnemyDeath();
}

/** Per-frame: chase the player, slide along walls, deal contact damage. */
export function updateEnemies(dt) {
    if (!_enemies.length) return;

    const p = getPlayerPos();

    for (const e of _enemies) {
        // Decay the hit flash — restore the enemy's type material when it ends.
        if (e.flash > 0) {
            e.flash -= dt;
            if (e.flash <= 0) e.mesh.material = _matFor(e.type);
        }

        // Attack lunge — a squash-stretch "bite" toward the player. Scale only,
        // so collision/chase (which read position) are unaffected.
        if (e.attack > 0) {
            e.attack -= dt;
            const k = Math.max(0, e.attack / ATK_ANIM);   // 1 → 0
            const s = Math.sin(Math.PI * k);              // 0 → 1 → 0
            e.mesh.scale.set(1 - 0.25 * s, 1 - 0.35 * s, 1 + 0.6 * s);  // lunge along facing (+Z)
        } else if (e.mesh.scale.z !== 1) {
            e.mesh.scale.set(1, 1, 1);
        }

        const ex = e.mesh.position.x;
        const ez = e.mesh.position.z;

        let dx = p.x - ex;
        let dz = p.z - ez;
        const dist = Math.hypot(dx, dz);

        // --- Contact damage (independent of whether we can move closer) ---
        e.contactTimer -= dt;
        if (dist < CONTACT_DIST && e.contactTimer <= 0) {
            e.contactTimer = CONTACT_COOLDOWN;
            e.attack = ATK_ANIM;          // trigger the bite animation
            state.damage(e.def.damage);
            playPlayerHurt();
        }

        if (dist < 0.0001) continue;   // exactly on top of the player — don't normalize 0
        dx /= dist; dz /= dist;

        // --- Chase: axis-separated step so enemies slide along walls. ---
        const step = e.def.speed * dt;
        const nx = ex + dx * step;
        if (!collidesCircle(nx, ez, RADIUS)) e.mesh.position.x = nx;

        const nz = ez + dz * step;
        if (!collidesCircle(e.mesh.position.x, nz, RADIUS)) e.mesh.position.z = nz;

        e.mesh.rotation.y = Math.atan2(dx, dz);
    }
}
