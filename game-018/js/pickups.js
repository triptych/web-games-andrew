/**
 * pickups.js — Resource pickups and harvestable resource nodes.
 *
 * Floating orbs: auto-collect on walk-over.
 * Resource nodes: fixed world positions, harvested by walking near + pressing E,
 *   then respawn after RESOURCE_NODE_RESPAWN seconds.
 *
 * Exports:
 *   initPickups(scene) → { pickups, nodes, update(dt), spawnPickup(type, pos) }
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    ITEMS_ON_MAP_CAP, MONSTER_ZONE_MIN, MONSTER_ZONE_MAX,
    VILLAGE_RADIUS, RESOURCE_NODE_RESPAWN,
} from './config.js';
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

// Shared orb geo / mats
const _orbGeo = new THREE.SphereGeometry(0.25, 8, 8);
const _orbMats = {};
for (const [type, col] of Object.entries(RESOURCE_COLORS)) {
    _orbMats[type] = new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.3 });
}

// ---- Floating Pickup orb ----
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
            events.emit('resourceGathered', this.type, this.amount);  // quest tracking
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

// ---- Resource Node (harvestable, respawns) ----
// Node types and their visual appearance
const NODE_DEFS = {
    wood:  { color: 0x5a3a1a, emissive: 0x2a1a08, label: 'Tree',    yield: [3, 6], geoFn: () => new THREE.CylinderGeometry(0.3, 0.4, 1.6, 6) },
    stone: { color: 0x888888, emissive: 0x333333, label: 'Rock',    yield: [2, 5], geoFn: () => new THREE.DodecahedronGeometry(0.6, 0) },
    iron:  { color: 0x6666aa, emissive: 0x222244, label: 'Ore Vein',yield: [1, 3], geoFn: () => new THREE.OctahedronGeometry(0.5, 0) },
    herbs: { color: 0x33aa33, emissive: 0x115511, label: 'Herb Patch',yield:[2,4], geoFn: () => new THREE.SphereGeometry(0.35, 7, 5) },
};

const NODE_COLLECT_RANGE = 2.2;

class ResourceNode {
    constructor(scene, type, pos) {
        this.scene    = scene;
        this.type     = type;
        this.pos      = pos.clone();
        this.ready    = true;
        this.respawnTimer = 0;
        this._buildMesh();
    }

    _buildMesh() {
        const def = NODE_DEFS[this.type];
        const geo = def.geoFn();
        const mat = new THREE.MeshLambertMaterial({
            color: def.color,
            emissive: def.emissive,
            emissiveIntensity: 0.4,
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.position.copy(this.pos);
        this.mesh.position.y = this.type === 'wood' ? 0.8 : 0.4;
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        // Random rotation for visual variety
        this.mesh.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(this.mesh);

        // Readiness indicator: small glow ring on ground
        const ringGeo = new THREE.RingGeometry(0.5, 0.65, 16);
        const ringMat = new THREE.MeshBasicMaterial({
            color: RESOURCE_COLORS[this.type],
            transparent: true, opacity: 0.5,
            side: THREE.DoubleSide,
        });
        this.ring = new THREE.Mesh(ringGeo, ringMat);
        this.ring.rotation.x = -Math.PI / 2;
        this.ring.position.copy(this.pos);
        this.ring.position.y = 0.05;
        this.scene.add(this.ring);
    }

    harvest() {
        if (!this.ready) return;
        this.ready = false;
        this.respawnTimer = RESOURCE_NODE_RESPAWN;

        const def = NODE_DEFS[this.type];
        const [min, max] = def.yield;
        const amount = min + Math.floor(Math.random() * (max - min + 1));

        state.addResource(this.type, amount);
        playPickup();
        events.emit('message', `Harvested ${amount} ${RESOURCE_LABELS[this.type]} from ${def.label}.`, '#aaeebb');
        events.emit('resourceGathered', this.type, amount);

        // Grey out mesh
        this.mesh.material.color.setHex(0x444444);
        this.mesh.material.emissiveIntensity = 0;
        this.ring.visible = false;
    }

    update(dt) {
        if (!this.ready) {
            this.respawnTimer -= dt;
            if (this.respawnTimer <= 0) {
                this.ready = true;
                const def = NODE_DEFS[this.type];
                this.mesh.material.color.setHex(def.color);
                this.mesh.material.emissiveIntensity = 0.4;
                this.ring.visible = true;
                events.emit('message', `A ${def.label} is ready to harvest nearby.`, '#88bb88');
            }
        }
    }
}

// Fixed node positions spread around the world
function _generateNodePositions() {
    const positions = [];
    const types = ['wood','wood','wood','stone','stone','iron','iron','herbs','herbs','herbs',
                   'wood','stone','iron','herbs','wood','stone'];
    const count = types.length;
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
        // Nodes in mid zone — close enough to be worthwhile, but require leaving village
        const r = VILLAGE_RADIUS + 8 + Math.random() * (MONSTER_ZONE_MAX * 0.6);
        positions.push({
            type: types[i],
            pos: new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r),
        });
    }
    return positions;
}

// ---- Init ----
export function initPickups(scene) {
    const pickups = [];
    const nodes   = [];

    function spawnPickup(type, pos, amount = 1) {
        const p = new Pickup(scene, type, pos, amount);
        pickups.push(p);
        return p;
    }

    // Scatter initial pickups — more than before, weighted toward useful resources
    const types = ['wood','wood','wood','stone','stone','stone','iron','iron','herbs','herbs','herbs','gold'];
    for (let i = 0; i < 28; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r     = MONSTER_ZONE_MIN + Math.random() * (MONSTER_ZONE_MAX - MONSTER_ZONE_MIN);
        const pos   = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        const type  = types[Math.floor(Math.random() * types.length)];
        spawnPickup(type, pos, 1 + Math.floor(Math.random() * 4));
    }

    // Spawn fixed resource nodes
    for (const { type, pos } of _generateNodePositions()) {
        nodes.push(new ResourceNode(scene, type, pos));
    }

    let spawnTimer = 0;

    function checkNodeHarvest(playerPos) {
        let any = false;
        for (const node of nodes) {
            if (!node.ready) continue;
            if (playerPos.distanceTo(node.pos) <= NODE_COLLECT_RANGE) {
                node.harvest();
                any = true;
            }
        }
        return any;
    }

    function update(dt, playerPos) {
        for (const p of pickups) p.update(dt);
        for (const n of nodes)   n.update(dt);

        // Auto-collect nearby orb pickups
        if (playerPos) {
            for (const p of pickups) {
                if (!p.active) continue;
                if (playerPos.distanceTo(p.mesh.position) < 1.2) p.collect();
            }
        }

        // Gradually replenish orbs
        const activeCount = pickups.filter(p => p.active).length;
        if (activeCount < ITEMS_ON_MAP_CAP) {
            spawnTimer += dt;
            if (spawnTimer >= 5) {   // respawn every 5s (was 8s)
                spawnTimer = 0;
                // Spawn 2 at a time when low
                const batch = activeCount < ITEMS_ON_MAP_CAP * 0.5 ? 3 : 1;
                for (let b = 0; b < batch; b++) {
                    const angle = Math.random() * Math.PI * 2;
                    const r     = MONSTER_ZONE_MIN + Math.random() * (MONSTER_ZONE_MAX - MONSTER_ZONE_MIN);
                    const pos   = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
                    const type  = types[Math.floor(Math.random() * types.length)];
                    spawnPickup(type, pos, 1 + Math.floor(Math.random() * 3));
                }
            }
        }
    }

    return { pickups, nodes, update, spawnPickup, checkNodeHarvest };
}
