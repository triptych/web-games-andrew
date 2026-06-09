/**
 * nests.js — Monster nests (spawners).
 *
 * On level load, a nest is placed at every 'N' cell in the maze. Each nest
 * periodically spawns an enemy (up to NEST_MAX_ALIVE of *its own* alive at once)
 * until it is destroyed. Destroying a nest stops its spawns, awards bonus score,
 * and emits `nestDestroyed`. The enemy mix shifts toward nastier types on deeper
 * levels (more ghosts/demons), per the progression notes in the plan.
 *
 * combat.js asks this module to damage nests; enemies.js does the actual spawn.
 *
 * GPU memory: a single shared geometry + material across all nests (THREE.JS
 * GOTCHA #4). Per-nest meshes are removed (not disposed) on destroy/teardown.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { findCells } from './maze.js';
import { spawnEnemy } from './enemies.js';
import { state } from './state.js';
import { events } from './events.js';
import {
    NEST_HP, NEST_SPAWN_EVERY, NEST_MAX_ALIVE, NEST_SCORE, COLORS,
} from './config.js';
import { playNestDestroy } from './sounds.js';

const Y = 0.9;   // nest sits low on the floor

// --- Shared geometry; per-nest material clones ---
// Geometry is shared across all nests (THREE.JS GOTCHA #4). The material is
// cloned per nest because hit-flash mutates each nest's emissive independently —
// a shared material would flash every nest at once. Clones are disposed on
// destroy/teardown.
const _geo = new THREE.BoxGeometry(2.4, 1.8, 2.4);
const _baseMat = new THREE.MeshLambertMaterial({ color: COLORS.nest, emissive: 0x2a0808 });

// Active nests. Each: { id, mesh, hp, spawnTimer, alive:Set<enemy> }
let _nests = [];
let _nextId = 0;

/**
 * Build a nest at every 'N' cell for the current level.
 * Difficulty (spawn rate, enemy mix) scales with state.level.
 */
export function initNests() {
    // Tear down any previous level's nests.
    for (const n of _nests) { scene.remove(n.mesh); n.mesh.material.dispose(); }
    _nests = [];

    const level = state.level;
    const interval = Math.max(0.9, NEST_SPAWN_EVERY - (level - 1) * 0.3);

    for (const cell of findCells('N')) {
        const mesh = new THREE.Mesh(_geo, _baseMat.clone());
        mesh.position.set(cell.x, Y, cell.z);
        scene.add(mesh);

        _nests.push({
            id: _nextId++,
            mesh,
            hp: NEST_HP,
            interval,
            // Stagger first spawns so nests don't all fire on the same frame.
            spawnTimer: 0.5 + Math.random() * interval,
            alive: new Set(),
        });
    }
}

/** Number of nests still standing (used for level-clear checks). */
export function nestCount() { return _nests.length; }

/** Read access for combat hit-testing. */
export function getNests() { return _nests; }

/**
 * Pick an enemy type for the given level. Early levels are mostly grunts;
 * deeper levels mix in faster ghosts and tanky demons.
 */
function _pickType(level) {
    const r = Math.random();
    if (level <= 1)      return r < 0.85 ? 'grunt' : 'ghost';
    if (level === 2)     return r < 0.6  ? 'grunt' : (r < 0.85 ? 'ghost' : 'demon');
    if (level === 3)     return r < 0.45 ? 'grunt' : (r < 0.75 ? 'ghost' : 'demon');
    return r < 0.3 ? 'grunt' : (r < 0.65 ? 'ghost' : 'demon');   // level 4+
}

/**
 * Apply `dmg` to a nest. On death: removes it, awards bonus score, emits
 * `nestDestroyed`, plays SFX. Returns true if the nest died. Called by combat.js.
 */
export function damageNest(nest, dmg) {
    nest.hp -= dmg;
    if (nest.hp > 0) {
        // Brief hit flash — flicker the emissive up; eased back next frames.
        nest.mesh.material.emissive.setHex(0x802020);
        nest.flash = 0.12;
        return false;
    }
    _destroyNest(nest);
    return true;
}

function _destroyNest(nest) {
    const i = _nests.indexOf(nest);
    if (i === -1) return;
    _nests.splice(i, 1);
    scene.remove(nest.mesh);
    nest.mesh.material.dispose();   // per-nest clone — dispose it (geometry is shared)
    state.addScore(NEST_SCORE);
    events.emit('nestDestroyed', nest.id);
    playNestDestroy();
}

/** Per-frame: tick each nest's spawn timer and emit enemies under its cap. */
export function updateNests(dt) {
    if (!_nests.length) return;

    const level = state.level;

    for (const nest of _nests) {
        // Decay any hit-flash back to the resting emissive.
        if (nest.flash > 0) {
            nest.flash -= dt;
            if (nest.flash <= 0) nest.mesh.material.emissive.setHex(0x2a0808);
        }

        // Drop dead enemies from this nest's alive set (mesh removed from scene
        // by enemies.js on death). We detect death by the mesh leaving its parent.
        for (const e of nest.alive) {
            if (!e.mesh.parent) nest.alive.delete(e);
        }

        if (nest.alive.size >= NEST_MAX_ALIVE) continue;

        nest.spawnTimer -= dt;
        if (nest.spawnTimer > 0) continue;
        nest.spawnTimer = nest.interval;

        const type = _pickType(level);
        const np = nest.mesh.position;
        const enemy = spawnEnemy(type, np.x, np.z);
        nest.alive.add(enemy);
    }
}
