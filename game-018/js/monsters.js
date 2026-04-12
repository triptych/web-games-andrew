/**
 * monsters.js — Monster spawning, AI, and lifecycle.
 *
 * Exports:
 *   initMonsters(scene) → { monsters, update(dt, playerPos), spawnMonster(type, pos) }
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';
import { state }  from './state.js';
import { events } from './events.js';
import {
    MONSTER_DEFS, MONSTER_TYPES, MONSTER_CAP,
    MONSTER_ZONE_MIN, MONSTER_ZONE_MAX,
    SPAWN_INTERVAL, VILLAGE_RADIUS,
} from './config.js';
import { playMonsterHit, playMonsterDie, playPlayerHurt } from './sounds.js';

// Pre-build shared geometries/materials per monster type
const _geos = {};
const _mats = {};
for (const [type, def] of Object.entries(MONSTER_DEFS)) {
    const s = def.scale;
    _geos[type] = {
        body: new THREE.BoxGeometry(0.8 * s, 0.9 * s, 0.8 * s),
        eye:  new THREE.SphereGeometry(0.08 * s, 6, 6),
    };
    _mats[type] = {
        body: new THREE.MeshLambertMaterial({ color: def.color }),
        eye:  new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    };
}

// Build single monster mesh
function _buildMonsterMesh(type) {
    const def   = MONSTER_DEFS[type];
    const s     = def.scale;
    const group = new THREE.Group();

    const body = new THREE.Mesh(_geos[type].body, _mats[type].body.clone());
    body.material.transparent = true;
    body.name = 'body';
    body.position.y = 0.45 * s;
    body.castShadow = true;
    group.add(body);

    // Eyes
    for (const ox of [-0.15 * s, 0.15 * s]) {
        const eye = new THREE.Mesh(_geos[type].eye, _mats[type].eye);
        eye.position.set(ox, 0.6 * s, -0.4 * s);
        group.add(eye);
    }

    // HP bar (sprite quad above head)
    const hpBarGeo  = new THREE.PlaneGeometry(0.8 * s, 0.1 * s);
    const hpBarMat  = new THREE.MeshBasicMaterial({ color: 0x44cc44, side: THREE.DoubleSide });
    const hpBar     = new THREE.Mesh(hpBarGeo, hpBarMat);
    hpBar.position.y = 1.0 * s + 0.15;
    hpBar.name       = 'hpBar';
    group.userData.hpBar = hpBar;
    group.add(hpBar);

    return group;
}

// Monster class
class Monster {
    constructor(scene, type, pos) {
        this.type     = type;
        this.def      = MONSTER_DEFS[type];
        this.hp       = this.def.hp;
        this.maxHp    = this.def.hp;
        this.alive    = true;
        this.scene    = scene;
        this.atkCd    = 0;
        this.flashTimer = 0;
        this.dying = false;
        this.deathTimer = 0;
        this.state    = 'idle';  // 'idle' | 'chase' | 'attack'
        this.aggroRange = 35;
        this.loseRange  = 55;

        this.mesh = _buildMonsterMesh(type);
        this.mesh.position.copy(pos);
        this.mesh.position.y = 0;
        scene.add(this.mesh);
    }

    takeDamage(amount) {
        if (!this.alive) return;
        this.hp = Math.max(0, this.hp - amount);

        // Update HP bar
        const pct = this.hp / this.maxHp;
        const bar  = this.mesh.userData.hpBar;
        if (bar) {
            bar.scale.x = pct;
            bar.position.x = -(1 - pct) * 0.4 * this.def.scale;
            const col = pct > 0.5 ? 0x44cc44 : pct > 0.25 ? 0xffaa00 : 0xee2222;
            bar.material.color.setHex(col);
        }

        playMonsterHit();
        // Flash white
        this.flashTimer = 0.14;
        const bodyMesh = this.mesh.children.find(c => c.name === 'body');
        if (bodyMesh) bodyMesh.material.color.setHex(0xffffff);

        events.emit('message', `Hit ${this.def.label} for ${amount} dmg!`, '#ffcc88');

        if (this.hp <= 0) this._die();
    }

    _die() {
        this.alive = false;
        this.dying = true;
        this.deathTimer = 0.6;
        playMonsterDie();

        // Rewards (immediate — don't delay feedback)
        state.addXp(this.def.xp);
        state.addGold(this.def.gold);
        events.emit('playerGoldChanged', state.gold);

        for (const [res, amt] of Object.entries(this.def.drops)) {
            if (amt > 0) state.addResource(res, amt);
        }

        const dropStr = Object.entries(this.def.drops)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');

        events.emit('message',
            `${this.def.label} slain! +${this.def.xp} XP, +${this.def.gold} gold${dropStr ? ', +' + dropStr : ''}.`,
            '#88ddff'
        );
        events.emit('monsterDied', this.def, this.mesh.position.clone());
    }

    updateDeath(dt) {
        this.deathTimer -= dt;
        const progress = Math.max(0, 1 - this.deathTimer / 0.6);
        const bodyMesh = this.mesh.children.find(c => c.name === 'body');
        if (bodyMesh) {
            bodyMesh.material.opacity = 1 - progress;
            bodyMesh.material.color.setHex(this.def.color);
        }
        this.mesh.scale.setScalar(1 - progress * 0.4);
        if (this.deathTimer <= 0) {
            this.scene.remove(this.mesh);
            this.dying = false;
        }
    }

    update(dt, playerPos) {
        if (!this.alive) return;

        const dist = this.mesh.position.distanceTo(playerPos);

        // State machine
        if (this.state === 'idle') {
            if (dist < this.aggroRange) this.state = 'chase';
        } else if (this.state === 'chase') {
            if (dist > this.loseRange) { this.state = 'idle'; return; }

            // Move toward player (stay out of village)
            const dir = new THREE.Vector3()
                .subVectors(playerPos, this.mesh.position)
                .setY(0)
                .normalize();

            const speed = this.def.speed * dt;
            const nx    = this.mesh.position.x + dir.x * speed;
            const nz    = this.mesh.position.z + dir.z * speed;

            // Don't enter village core (campfire area)
            const distToVillage = Math.sqrt(nx * nx + nz * nz);
            if (distToVillage >= VILLAGE_RADIUS * 0.5) {
                this.mesh.position.x = nx;
                this.mesh.position.z = nz;
                // Face player
                this.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            }

            if (dist < 1.6) this.state = 'attack';
        } else if (this.state === 'attack') {
            if (dist > 2.5) { this.state = 'chase'; return; }

            this.atkCd -= dt;
            if (this.atkCd <= 0) {
                this.atkCd = 1.2 + Math.random() * 0.8;
                const dmg  = this.def.atk + Math.floor(Math.random() * 5);
                state.takeDamage(dmg);
                playPlayerHurt();
                events.emit('message', `${this.def.label} hit you for ${dmg} damage!`, '#ff8888');
            }
        }

        // Billboard HP bar to always face camera
        const bar = this.mesh.userData.hpBar;
        if (bar) bar.lookAt(playerPos.x, playerPos.y + 8, playerPos.z);

        // Restore flash
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                const bodyMesh = this.mesh.children.find(c => c.name === 'body');
                if (bodyMesh) bodyMesh.material.color.setHex(this.def.color);
            }
        }
    }
}

// ---- Init ----
export function initMonsters(scene) {
    const monsters = [];
    let spawnTimer = 0;

    function spawnMonster(type, pos) {
        if (!pos) {
            // Random position in monster zone
            const angle = Math.random() * Math.PI * 2;
            const r     = MONSTER_ZONE_MIN + Math.random() * (MONSTER_ZONE_MAX - MONSTER_ZONE_MIN);
            pos = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        }
        const m = new Monster(scene, type, pos);
        monsters.push(m);
        return m;
    }

    // Initial spawn — a few close to village edge, rest farther out
    const closeTypes = ['slime', 'slime', 'goblin', 'slime'];
    for (let i = 0; i < closeTypes.length; i++) {
        const angle = (i / closeTypes.length) * Math.PI * 2;
        const r     = VILLAGE_RADIUS + 4 + Math.random() * 6;  // just outside village
        const pos   = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        spawnMonster(closeTypes[i], pos);
    }
    // More in the general zone
    for (let i = 0; i < 8; i++) {
        const type = MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)];
        spawnMonster(type);
    }

    function update(dt, playerPos) {
        for (const m of monsters) {
            if (m.dying) { m.updateDeath(dt); continue; }
            if (m.alive) m.update(dt, playerPos);
        }

        const aliveCount = monsters.filter(m => m.alive).length;
        if (aliveCount < MONSTER_CAP) {
            spawnTimer += dt;
            if (spawnTimer >= SPAWN_INTERVAL) {
                spawnTimer = 0;
                const type = MONSTER_TYPES[Math.floor(Math.random() * MONSTER_TYPES.length)];
                spawnMonster(type);
            }
        }
    }

    return { monsters, update, spawnMonster };
}
