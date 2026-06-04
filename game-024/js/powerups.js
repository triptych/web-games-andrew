/**
 * powerups.js — Collectible drops (Phase 4).
 *
 * Some kills drop a glowing pickup that drifts down-field toward the player.
 * Collecting one grants a temporary or instant boon:
 *
 *   SPREAD — triple-shot for SPREAD_DURATION seconds (handled in player.js).
 *   SHIELD — temporary invulnerability for SHIELD_DURATION sec (collisions.js).
 *   LIFE   — +1 life, instantly.
 *
 * Each pickup is a small spinning octahedron in the boon's color with a faint
 * point light so it reads as "good loot" against the red enemies. Pickups share
 * one geometry; materials are per-type (cached) so the color is right. Collection
 * is a cheap circle test against the player, run in updatePowerups().
 *
 * Public API:
 *   initPowerups()             — wire up. Call once.
 *   spawnPowerup(x, z, [type]) — drop a pickup (random type if omitted).
 *   maybeDrop(x, z)            — drop with POWERUP_DROP_CHANCE probability.
 *   dropBossLoot(x, z)         — guaranteed cluster from a boss kill.
 *   updatePowerups(dt)         — drift, spin, collect, cull. Call each frame.
 *   resetPowerups()            — clear all pickups on (re)start.
 */

import * as THREE from 'three';

import { scene }  from './scene.js';
import { state }  from './state.js';
import { events } from './events.js';
import { getPlayer } from './player.js';
import { playPickup } from './sounds.js';
import {
    POWERUP_TYPES,
    POWERUP_DROP_CHANCE,
    POWERUP_BOSS_DROPS,
    POWERUP_SPEED,
    POWERUP_RADIUS,
    PLAYER_RADIUS,
    FIELD_HALF_W,
    FIELD_HALF_H,
} from './config.js';

let _geo = null;
const _mats = new Map();   // type.key -> material (cached, shared)

// Live pickups: { mesh, type }.
const pickups = [];

const _typeList = Object.values(POWERUP_TYPES);

function _ensureResources() {
    if (_geo) return;
    _geo = new THREE.OctahedronGeometry(POWERUP_RADIUS, 0);
    for (const t of _typeList) {
        _mats.set(t.key, new THREE.MeshStandardMaterial({
            color: t.color,
            emissive: t.color,
            emissiveIntensity: 1.5,
            metalness: 0.2,
            roughness: 0.3,
        }));
    }
}

export function initPowerups() { _ensureResources(); }

export function resetPowerups() {
    for (const p of pickups) {
        if (p.light) p.mesh.remove(p.light);
        scene.remove(p.mesh);
    }
    pickups.length = 0;
}

export function spawnPowerup(x, z, type) {
    _ensureResources();
    const t = type || _typeList[Math.floor(Math.random() * _typeList.length)];

    const mesh = new THREE.Mesh(_geo, _mats.get(t.key));
    mesh.position.set(x, 0.4, z);
    // A small co-moving light so the pickup glows and reads as collectible.
    const light = new THREE.PointLight(t.color, 4, 5, 2);
    light.position.set(0, 1, 0);
    mesh.add(light);
    scene.add(mesh);

    pickups.push({ mesh, type: t, light });
}

// Drop a random pickup with the configured per-kill chance.
export function maybeDrop(x, z) {
    if (Math.random() < POWERUP_DROP_CHANCE) spawnPowerup(x, z);
}

// A boss death showers a guaranteed handful of pickups around the kill site.
export function dropBossLoot(x, z) {
    for (let i = 0; i < POWERUP_BOSS_DROPS; i++) {
        const a = (i / POWERUP_BOSS_DROPS) * Math.PI * 2;
        spawnPowerup(x + Math.cos(a) * 1.5, z + Math.sin(a) * 1.5);
    }
}

function _collect(p) {
    playPickup();
    switch (p.type.key) {
        case POWERUP_TYPES.SPREAD.key:
            events.emit('powerup', { kind: 'spread' });
            break;
        case POWERUP_TYPES.SHIELD.key:
            events.emit('powerup', { kind: 'shield' });
            break;
        case POWERUP_TYPES.LIFE.key:
            state.lives += 1;
            events.emit('powerup', { kind: 'life' });
            break;
    }
}

export function updatePowerups(dt) {
    const ship = getPlayer();
    const cullZ = FIELD_HALF_H + POWERUP_RADIUS * 2;
    const reach = PLAYER_RADIUS + POWERUP_RADIUS;

    for (let i = pickups.length - 1; i >= 0; i--) {
        const p  = pickups[i];
        const mp = p.mesh.position;

        // Drift down toward the player rows and spin for visual life.
        mp.z += POWERUP_SPEED * dt;
        p.mesh.rotation.y += dt * 2.5;
        p.mesh.rotation.x += dt * 1.5;

        // Collected?
        if (ship) {
            const dx = mp.x - ship.position.x;
            const dz = mp.z - ship.position.z;
            if (dx * dx + dz * dz <= reach * reach) {
                _collect(p);
                if (p.light) p.mesh.remove(p.light);
                scene.remove(p.mesh);
                pickups.splice(i, 1);
                continue;
            }
        }

        // Missed — fell off the bottom edge.
        if (mp.z > cullZ) {
            if (p.light) p.mesh.remove(p.light);
            scene.remove(p.mesh);
            pickups.splice(i, 1);
        }
    }
}
