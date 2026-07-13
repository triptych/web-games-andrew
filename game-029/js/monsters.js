/**
 * monsters.js — spawns monsters along road chunks, simple approach AI,
 * contact damage against the player, and death -> coin/loot roll.
 *
 * Monster tier is chosen from MONSTER_TIERS by the chunk's start distance,
 * so difficulty is purely a function of how far the player has walked.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { state } from './state.js';
import { events } from './events.js';
import { playSwordHit, playMonsterDeath, playPlayerHurt } from './sounds.js';
import { generateItem, getSaleValue } from './loot.js';
import {
    MONSTER_TIERS, MONSTER_SPAWN_CHANCE_PER_CHUNK, MONSTER_MAX_PER_CHUNK,
    MONSTER_CONTACT_RANGE, MONSTER_ATTACK_COOLDOWN, ROAD_WIDTH, RARITY,
} from './config.js';
import { getPlayerX, trySwordHit } from './player.js';

let _monsters = [];

export function initMonsters() {
    _monsters.forEach(_disposeMonster);
    _monsters = [];
}

export function teardownMonsters() {
    _monsters.forEach(_disposeMonster);
    _monsters = [];
}

/**
 * Called by path.js's chunk lifecycle (via main.js) whenever a new road
 * chunk is generated — rolls whether/how many monsters spawn in it.
 */
export function trySpawnInChunk(chunk) {
    if (chunk.type !== 'road' || chunk.monsterSpawned) return;
    chunk.monsterSpawned = true;
    if (Math.random() > MONSTER_SPAWN_CHANCE_PER_CHUNK) return;

    const count = 1 + Math.floor(Math.random() * MONSTER_MAX_PER_CHUNK);
    for (let i = 0; i < count; i++) {
        const z = chunk.z0 + Math.random() * (chunk.z1 - chunk.z0);
        const x = (Math.random() - 0.5) * (ROAD_WIDTH - 1.5);
        _spawnMonster(x, z, chunk.z0);
    }
}

function _tierForDistance(distance) {
    let tier = MONSTER_TIERS[0];
    for (const t of MONSTER_TIERS) {
        if (distance >= t.minDistance) tier = t;
    }
    return tier;
}

function _spawnMonster(x, z, distance) {
    const tier = _tierForDistance(distance);
    const mesh = new THREE.Mesh(
        new THREE.ConeGeometry(0.6, 1.6, 6),
        new THREE.MeshStandardMaterial({ color: RARITY.uncommon.color }),
    );
    mesh.position.set(x, 0.8, z);
    scene.add(mesh);

    _monsters.push({
        mesh,
        x, z,
        tier,
        hp: tier.hp,
        maxHp: tier.hp,
        attackCooldown: 0,
        dead: false,
    });
}

export function updateMonsters(dt, playerDistance) {
    const playerX = getPlayerX();

    for (const m of _monsters) {
        if (m.dead) continue;

        // Simple AI: drift toward the player's lane once they're close ahead.
        const dz = m.z - playerDistance;
        if (dz < 15 && dz > -2) {
            m.x += Math.sign(playerX - m.x) * Math.min(0.6 * dt, Math.abs(playerX - m.x));
            m.mesh.position.x = m.x;
        }

        // Sword hit check.
        if (trySwordHit(m, m.x, m.z)) {
            _damageMonster(m, _currentWeaponDamage());
        }

        // Contact damage against the player.
        if (m.attackCooldown > 0) m.attackCooldown -= dt;
        const distToPlayer = Math.hypot(m.x - playerX, m.z - playerDistance);
        if (distToPlayer <= MONSTER_CONTACT_RANGE && m.attackCooldown <= 0) {
            m.attackCooldown = MONSTER_ATTACK_COOLDOWN;
            playPlayerHurt();
            state.takeDamage(m.tier.damage);
        }
    }

    // Sweep dead monsters out.
    _monsters = _monsters.filter((m) => {
        if (m.dead) { _disposeMonster(m); return false; }
        return true;
    });
}

function _currentWeaponDamage() {
    const weapon = state.equipped.weapon;
    return weapon ? weapon.damage : 3; // bare-handed baseline
}

function _damageMonster(m, dmg) {
    if (m.dead) return;
    m.hp -= dmg;
    playSwordHit();
    if (m.hp <= 0) {
        m.dead = true;
        playMonsterDeath();
        _onMonsterKilled(m);
    }
}

function _onMonsterKilled(m) {
    const [minCoin, maxCoin] = m.tier.coinDrop;
    const coins = minCoin + Math.floor(Math.random() * (maxCoin - minCoin + 1));
    state.addCoins(coins);

    // ~25% chance of an equipment drop on top of the coin reward.
    if (Math.random() < 0.25) {
        const item = generateItem(m.tier);
        const saleValue = getSaleValue(item);
        events.emit('lootFound', item, saleValue);
    }
}

function _disposeMonster(m) {
    scene.remove(m.mesh);
    m.mesh.geometry.dispose();
    m.mesh.material.dispose();
}
