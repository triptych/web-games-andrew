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
    MONSTER_DEFS, COMMON_MONSTER_TYPES, MONSTER_CAP,
    MONSTER_ZONE_MIN, MONSTER_ZONE_MAX,
    SPAWN_INTERVAL, BOSS_SPAWN_INTERVAL, VILLAGE_RADIUS,
} from './config.js';
import { playMonsterHit, playMonsterDie, playPlayerHurt } from './sounds.js';

// Reusable quaternion for billboard calculations (avoids per-frame allocation)
const _invParentQ = new THREE.Quaternion();

// ---- Monster attack arc (swish) ----
function _buildMonsterArcMesh() {
    const segments  = 12;
    const range     = 2.2;
    const halfAngle = Math.PI * 0.4;  // ~72° wide swipe arc
    const vertices  = [];
    const indices   = [];

    vertices.push(0, 0.05, 0);  // centre

    for (let i = 0; i <= segments; i++) {
        const t   = i / segments;
        const ang = -halfAngle + t * halfAngle * 2;
        vertices.push(Math.sin(ang) * range, 0.05, Math.cos(ang) * range);
    }
    for (let i = 0; i < segments; i++) indices.push(0, i + 1, i + 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);

    const mat = new THREE.MeshBasicMaterial({
        color: 0xff4400,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 1;
    return mesh;
}

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

// Build single monster mesh — skeleton and dragon get special meshes
function _buildMonsterMesh(type) {
    if (type === 'skeleton') return _buildSkeletonMesh();
    if (type === 'dragon')   return _buildDragonMesh();

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

    _addHpBar(group, s);
    return group;
}

function _addHpBar(group, s) {
    const hpBarGeo = new THREE.PlaneGeometry(0.8 * s, 0.1 * s);
    const hpBarMat = new THREE.MeshBasicMaterial({ color: 0x44cc44, side: THREE.DoubleSide });
    const hpBar    = new THREE.Mesh(hpBarGeo, hpBarMat);
    hpBar.position.y = 1.0 * s + 0.15;
    hpBar.name = 'hpBar';
    group.userData.hpBar = hpBar;
    group.add(hpBar);
}

function _buildSkeletonMesh() {
    const def   = MONSTER_DEFS.skeleton;
    const s     = def.scale;
    const group = new THREE.Group();
    const boneMat = new THREE.MeshLambertMaterial({ color: def.color, transparent: true });

    // Ribcage body (thin, taller box)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.7 * s, 0.25 * s), boneMat.clone());
    torso.position.y = 0.55 * s;
    torso.name = 'body';
    torso.castShadow = true;
    group.add(torso);

    // Pelvis
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.5 * s, 0.18 * s, 0.22 * s), boneMat.clone());
    pelvis.position.y = 0.18 * s;
    pelvis.name = 'body';
    group.add(pelvis);

    // Skull
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.38 * s, 0.38 * s, 0.35 * s), boneMat.clone());
    skull.position.y = 1.05 * s;
    group.add(skull);

    // Glowing eye sockets
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    for (const ox of [-0.1 * s, 0.1 * s]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 5, 5), eyeMat);
        eye.position.set(ox, 1.08 * s, -0.18 * s);
        group.add(eye);
    }

    // Arm bones (two thin boxes on sides)
    for (const ox of [-0.38 * s, 0.38 * s]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.55 * s, 0.1 * s), boneMat.clone());
        arm.position.set(ox, 0.5 * s, 0);
        group.add(arm);
    }

    _addHpBar(group, s);
    return group;
}

function _buildDragonMesh() {
    const def   = MONSTER_DEFS.dragon;
    const s     = def.scale;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: def.color, transparent: true });
    const scaleMat = new THREE.MeshLambertMaterial({ color: 0x881100 });
    const eyeMat  = new THREE.MeshBasicMaterial({ color: 0xffee00 });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0 * s, 0.8 * s, 1.6 * s), bodyMat.clone());
    body.position.y = 0.7 * s;
    body.name = 'body';
    body.castShadow = true;
    group.add(body);

    // Neck + head
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.6 * s, 0.4 * s), bodyMat.clone());
    neck.position.set(0, 1.3 * s, -0.65 * s);
    neck.rotation.x = -0.4;
    group.add(neck);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.45 * s, 0.7 * s), bodyMat.clone());
    head.position.set(0, 1.7 * s, -1.1 * s);
    group.add(head);

    // Snout
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.22 * s, 0.4 * s), scaleMat.clone());
    snout.position.set(0, 1.6 * s, -1.5 * s);
    group.add(snout);

    // Eyes
    for (const ox of [-0.18 * s, 0.18 * s]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 6, 6), eyeMat);
        eye.position.set(ox, 1.82 * s, -1.15 * s);
        group.add(eye);
    }

    // Wings (flat planes angled out)
    const wingGeo = new THREE.BoxGeometry(1.5 * s, 0.06 * s, 0.9 * s);
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x992200, transparent: true, opacity: 0.85 });
    for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(wingGeo, wingMat.clone());
        wing.position.set(sx * 1.1 * s, 1.0 * s, 0.1 * s);
        wing.rotation.z = sx * 0.45;
        wing.userData.isWing = true;
        group.add(wing);
    }

    // Tail
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.25 * s, 0.25 * s, 1.0 * s), bodyMat.clone());
    tail.position.set(0, 0.6 * s, 1.1 * s);
    tail.rotation.x = 0.25;
    group.add(tail);

    _addHpBar(group, s);
    group.userData.wingTimer = 0;
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
        this.arcMesh  = null;   // attack swish arc
        this.arcTimer = 0;

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
        if (this.arcMesh) { this.scene.remove(this.arcMesh); this.arcMesh = null; }
        this.arcTimer = 0;

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
            this.def.isBoss ? '#ffcc00' : '#88ddff'
        );
        events.emit('monsterDied', this.def, this.mesh.position.clone());
        events.emit('monsterKilled', this.type);  // quest tracking
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

    update(dt, playerPos, camera) {
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
                // Face player — add PI so the mesh's -Z face points toward them
                this.mesh.rotation.y = Math.atan2(dir.x, dir.z) + Math.PI;
            }

            if (dist < 1.6) this.state = 'attack';
        } else if (this.state === 'attack') {
            if (dist > 2.5) { this.state = 'chase'; return; }

            // Always face player while attacking
            const dir2 = new THREE.Vector3()
                .subVectors(playerPos, this.mesh.position)
                .setY(0)
                .normalize();
            this.mesh.rotation.y = Math.atan2(dir2.x, dir2.z) + Math.PI;

            this.atkCd -= dt;
            if (this.atkCd <= 0) {
                this.atkCd = 1.2 + Math.random() * 0.8;
                const dmg  = this.def.atk + Math.floor(Math.random() * 5);
                state.takeDamage(dmg);
                playPlayerHurt();
                events.emit('message', `${this.def.label} hit you for ${dmg} damage!`, '#ff8888');

                // Spawn attack swish arc
                if (this.arcMesh) { this.scene.remove(this.arcMesh); this.arcMesh = null; }
                this.arcMesh = _buildMonsterArcMesh();
                this.arcMesh.position.set(
                    this.mesh.position.x,
                    this.mesh.position.y + 0.05,
                    this.mesh.position.z
                );
                // Arc points toward player (mesh faces -Z, so we use the raw atan2 without +PI)
                this.arcMesh.rotation.y = Math.atan2(dir2.x, dir2.z);
                this.scene.add(this.arcMesh);
                this.arcTimer = 0.22;
            }
        }

        // Dragon wing flap animation
        if (this.type === 'dragon') {
            this.mesh.userData.wingTimer = (this.mesh.userData.wingTimer || 0) + dt * 3;
            for (const child of this.mesh.children) {
                if (child.userData.isWing) {
                    const side = child.position.x > 0 ? 1 : -1;
                    child.rotation.z = side * (0.45 + Math.sin(this.mesh.userData.wingTimer) * 0.3);
                }
            }
        }

        // Billboard HP bar to always face camera (world-space quaternion copy)
        const bar = this.mesh.userData.hpBar;
        if (bar && camera) {
            // Undo the parent group's world rotation so the bar faces the camera in world space
            this.mesh.getWorldQuaternion(_invParentQ).invert();
            bar.quaternion.multiplyQuaternions(_invParentQ, camera.quaternion);
        }

        // Restore flash
        if (this.flashTimer > 0) {
            this.flashTimer -= dt;
            if (this.flashTimer <= 0) {
                const bodyMesh = this.mesh.children.find(c => c.name === 'body');
                if (bodyMesh) bodyMesh.material.color.setHex(this.def.color);
            }
        }

        // Fade out attack arc
        if (this.arcTimer > 0) {
            this.arcTimer -= dt;
            if (this.arcMesh) {
                this.arcMesh.material.opacity = Math.max(0, 0.55 * (this.arcTimer / 0.22));
                if (this.arcTimer <= 0) {
                    this.scene.remove(this.arcMesh);
                    this.arcMesh = null;
                }
            }
        }
    }
}

// ---- Init ----
export function initMonsters(scene) {
    const monsters = [];
    let spawnTimer = 0;
    let bossTimer  = 0;
    let bossAlive  = false;

    function spawnMonster(type, pos) {
        const def = MONSTER_DEFS[type];
        if (!pos) {
            const minR  = Math.max(MONSTER_ZONE_MIN, def.minZone ?? 0);
            const maxR  = MONSTER_ZONE_MAX;
            const angle = Math.random() * Math.PI * 2;
            const r     = minR + Math.random() * (maxR - minR);
            pos = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        }
        const m = new Monster(scene, type, pos);
        monsters.push(m);
        if (type === 'dragon') bossAlive = true;
        return m;
    }

    // Track boss death
    events.on('monsterKilled', (type) => {
        if (type === 'dragon') bossAlive = false;
    });

    // Initial spawn — a few close to village edge, rest farther out
    const closeTypes = ['slime', 'slime', 'goblin', 'slime', 'wolf'];
    for (let i = 0; i < closeTypes.length; i++) {
        const angle = (i / closeTypes.length) * Math.PI * 2;
        const r     = VILLAGE_RADIUS + 4 + Math.random() * 6;
        const pos   = new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r);
        spawnMonster(closeTypes[i], pos);
    }
    // More in the general zone (no bosses on initial spawn)
    for (let i = 0; i < 10; i++) {
        const type = COMMON_MONSTER_TYPES[Math.floor(Math.random() * COMMON_MONSTER_TYPES.length)];
        spawnMonster(type);
    }

    function update(dt, playerPos, camera) {
        for (const m of monsters) {
            if (m.dying) { m.updateDeath(dt); continue; }
            if (m.alive) m.update(dt, playerPos, camera);
        }

        const aliveCount = monsters.filter(m => m.alive).length;
        if (aliveCount < MONSTER_CAP) {
            spawnTimer += dt;
            if (spawnTimer >= SPAWN_INTERVAL) {
                spawnTimer = 0;
                const type = COMMON_MONSTER_TYPES[Math.floor(Math.random() * COMMON_MONSTER_TYPES.length)];
                spawnMonster(type);
            }
        }

        // Boss dragon spawns periodically if not alive
        if (!bossAlive) {
            bossTimer += dt;
            if (bossTimer >= BOSS_SPAWN_INTERVAL) {
                bossTimer = 0;
                spawnMonster('dragon');
                events.emit('message', 'A Dragon has been spotted in the distance!', '#ff4400');
            }
        }
    }

    return { monsters, update, spawnMonster };
}
