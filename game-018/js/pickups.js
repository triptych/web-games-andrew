/**
 * pickups.js — Resource pickups scattered in the world.
 * These are floating orbs that the player walks into to collect.
 *
 * Exports:
 *   initPickups(scene) → { pickups, update(dt), spawnPickup(type, pos) }
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { state }  from './state.js';
import { events } from './events.js';
import { ITEMS_ON_MAP_CAP, MONSTER_ZONE_MIN, MONSTER_ZONE_MAX } from './config.js';
import { playPickup, playGoldPickup } from './sounds.js';

const RESOURCE_COLORS = {
    wood:  0x8b5a2b,
    stone: 0x999999,
    iron:  0x8888cc,
    herbs: 0x55cc55,
    gold:  0xc8a844,
};

const RESOURCE_LABELS = {
    wood: 'Wood', stone: 'Stone', iron: 'Iron', herbs: 'Herbs', gold: 'Gold',
};

// Shared geo / mats
const _orbGeo = new THREE.SphereGeometry(0.25, 8, 8);
const _orbMats = {};
for (const [type, col] of Object.entries(RESOURCE_COLORS)) {
    _orbMats[type] = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.3 });
}

class Pickup {
    constructor(scene, type, pos, amount = 1) {
        this.scene  = scene;
        this.type   = type;
        this.amount = amount;
        this.active = true;
        this._bobOffset = Math.random() * Math.PI * 2;

        this.mesh = new THREE.Mesh(_orbGeo, _orbMats[type].clone());
        this.mesh.position.copy(pos);
        this.mesh.position.y = 0.6;
        this.mesh.castShadow = true;
        scene.add(this.mesh);
    }

    collect() {
        if (!this.active) return;
        this.active = false;
        this.scene.remove(this.mesh);

        if (this.type === 'gold') {
            state.addGold(this.amount);
            playGoldPickup();
            events.emit('message', `Picked up ${this.amount} gold!`, '#c8a844');
        } else {
            state.addResource(this.type, this.amount);
            playPickup();
            events.emit('message', `Picked up ${this.amount} ${RESOURCE_LABELS[this.type]}.`, '#88cc88');
        }
        events.emit('itemPickedUp', this.type, this.amount);
    }

    update(dt) {
        if (!this.active) return;
        this._bobOffset += dt * 2;
        this.mesh.position.y = 0.5 + Math.sin(this._bobOffset) * 0.15;
        this.mesh.rotation.y += dt * 1.5;
    }
}

export function initPickups(scene) {
    const pickups = [];

    function spawnPickup(type, pos, amount = 1) {
        const p = new Pickup(scene, type, pos, amount);
        pickups.push(p);
        return p;
    }

    // Scatter initial pickups in the world
    const types = ['wood', 'wood', 'stone', 'stone', 'iron', 'herbs', 'herbs', 'gold'];
    for (let i = 0; i < 16; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r     = MONSTER_ZONE_MIN + Math.random() * (MONSTER_ZONE_MAX - MONSTER_ZONE_MIN);
        const pos   = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        const type  = types[Math.floor(Math.random() * types.length)];
        spawnPickup(type, pos, 1 + Math.floor(Math.random() * 3));
    }

    let spawnTimer = 0;

    function update(dt) {
        for (const p of pickups) p.update(dt);

        // Gradually replenish
        const activeCount = pickups.filter(p => p.active).length;
        if (activeCount < ITEMS_ON_MAP_CAP) {
            spawnTimer += dt;
            if (spawnTimer >= 8) {
                spawnTimer = 0;
                const angle = Math.random() * Math.PI * 2;
                const r     = MONSTER_ZONE_MIN + Math.random() * (MONSTER_ZONE_MAX - MONSTER_ZONE_MIN);
                const pos   = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
                const type  = types[Math.floor(Math.random() * types.length)];
                spawnPickup(type, pos, 1 + Math.floor(Math.random() * 2));
            }
        }
    }

    return { pickups, update, spawnPickup };
}
