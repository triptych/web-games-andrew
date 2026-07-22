/**
 * monsters.js — spawns monsters along road chunks, active chase AI,
 * contact damage against the player, and death -> coin/loot roll.
 *
 * Monster tier is chosen from MONSTER_TIERS by the chunk's start distance,
 * so difficulty is purely a function of how far the player has walked.
 *
 * Combat lock: main.js calls findEncounterAhead()/isEncounterClear() every
 * frame to decide whether to freeze forward auto-walk into a combat arena
 * (see player.js's setCombatLock/clearCombatLock). Once locked, monsters
 * actively chase the player's exact (x, z) instead of just drifting toward
 * their lane.
 */

import * as THREE from 'three';
import { scene } from './scene.js';
import { state } from './state.js';
import { events } from './events.js';
import { playSwordHit, playMonsterDeath, playPlayerHurt } from './sounds.js';
import { generateItem, getSaleValue } from './loot.js';
import { spawnHitParticles, triggerShake } from './fx.js';
import {
    MONSTER_TIERS, MONSTER_SPAWN_CHANCE_PER_CHUNK, MONSTER_MAX_PER_CHUNK,
    MONSTER_CONTACT_RANGE, MONSTER_ATTACK_COOLDOWN, ROAD_WIDTH,
    MONSTER_CHASE_SPEED, FIRST_ENCOUNTER_DISTANCE, MONSTER_ARCHETYPES,
} from './config.js';
import { getPlayerX, getPlayerZ, trySwordHit } from './player.js';

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

    // Guarantee the very first road chunk always spawns an encounter, close
    // to the start, so the player is never left walking for several chunks
    // before their first fight regardless of the spawn-chance roll.
    const isFirstRoadChunk = chunk.index === 0;
    if (!isFirstRoadChunk && Math.random() > MONSTER_SPAWN_CHANCE_PER_CHUNK) return;

    // All monsters in an encounter cluster tightly around one point in the
    // chunk (rather than scattering independently across the full chunk
    // length) so every member stays reachable within the combat arena's
    // fixed radius once the player locks into the fight.
    const count = 1 + Math.floor(Math.random() * MONSTER_MAX_PER_CHUNK);
    const clusterZ = isFirstRoadChunk
        ? chunk.z0 + FIRST_ENCOUNTER_DISTANCE
        : chunk.z0 + 4 + Math.random() * (chunk.z1 - chunk.z0 - 8);
    for (let i = 0; i < count; i++) {
        const z = clusterZ + (Math.random() - 0.5) * 4;
        const x = (Math.random() - 0.5) * (ROAD_WIDTH - 1.5);
        _spawnMonster(x, z, chunk.z0, chunk.index);
    }
}

function _tierForDistance(distance) {
    let tier = MONSTER_TIERS[0];
    for (const t of MONSTER_TIERS) {
        if (distance >= t.minDistance) tier = t;
    }
    return tier;
}

const _totalArchetypeWeight = MONSTER_ARCHETYPES.reduce((sum, a) => sum + a.weight, 0);
function _rollArchetype() {
    let roll = Math.random() * _totalArchetypeWeight;
    for (const a of MONSTER_ARCHETYPES) {
        roll -= a.weight;
        if (roll <= 0) return a;
    }
    return MONSTER_ARCHETYPES[MONSTER_ARCHETYPES.length - 1];
}

const _monsterGeoCache = {
    cone: new THREE.ConeGeometry(0.6, 1.6, 6),
    box: new THREE.BoxGeometry(0.9, 1.4, 0.9),
};

function _spawnMonster(x, z, distance, chunkIndex) {
    const tier = _tierForDistance(distance);
    const archetype = _rollArchetype();
    const mesh = new THREE.Mesh(
        _monsterGeoCache[archetype.geo] ?? _monsterGeoCache.cone,
        new THREE.MeshStandardMaterial({ color: archetype.color }),
    );
    mesh.scale.setScalar(archetype.scale);
    mesh.position.set(x, 0.8 * archetype.scale, z);
    scene.add(mesh);

    const hp = Math.round(tier.hp * archetype.hpMult);
    _monsters.push({
        mesh,
        x, z,
        spawnZ: z,       // original spawn position — used to find/trigger the encounter,
        chunkIndex,      // stable even as the monster chases the player around the arena
        tier,
        archetype,
        hp,
        maxHp: hp,
        attackCooldown: 0,
        dead: false,
    });
}

export function updateMonsters(dt, inCombat) {
    const playerX = getPlayerX();
    const playerZ = getPlayerZ();

    for (const m of _monsters) {
        if (m.dead) continue;

        if (inCombat) {
            // Actively chase the player's exact position once combat locks.
            // Chase speed is scaled per archetype (skirmishers dart in fast,
            // brutes lumber) rather than a single shared speed.
            const dx = playerX - m.x;
            const dz = playerZ - m.z;
            const dist = Math.hypot(dx, dz);
            const chaseSpeed = MONSTER_CHASE_SPEED * m.archetype.chaseSpeedMult;
            if (dist > MONSTER_CONTACT_RANGE * 0.6) {
                m.x += (dx / dist) * chaseSpeed * dt;
                m.z += (dz / dist) * chaseSpeed * dt;
                m.mesh.position.set(m.x, m.mesh.position.y, m.z);
            }
        }

        // Sword hit check.
        if (trySwordHit(m, m.x, m.z)) {
            _damageMonster(m, _rolledWeaponDamage());
        }

        // Contact damage against the player.
        if (m.attackCooldown > 0) m.attackCooldown -= dt;
        const distToPlayer = Math.hypot(m.x - playerX, m.z - playerZ);
        if (distToPlayer <= MONSTER_CONTACT_RANGE && m.attackCooldown <= 0) {
            m.attackCooldown = MONSTER_ATTACK_COOLDOWN;
            playPlayerHurt();
            state.takeDamage(Math.round(m.tier.damage * m.archetype.damageMult));
            spawnHitParticles(playerX, 1.2, playerZ, 0xff5050);
            triggerShake(0.25, 0.2);
        }
    }

    // Sweep dead monsters out.
    _monsters = _monsters.filter((m) => {
        if (m.dead) { _disposeMonster(m); return false; }
        return true;
    });
}

/**
 * Returns the chunkIndex of the nearest not-yet-cleared encounter whose
 * spawn point is within `range` ahead of `playerDistance`, or null. Uses
 * spawnZ (fixed at spawn time) rather than the monster's current position,
 * so a chased monster drifting away from the trigger point can't cause the
 * lock to falsely re-trigger or fail to trigger.
 */
export function findEncounterAhead(playerDistance, range) {
    let best = null;
    for (const m of _monsters) {
        if (m.dead) continue;
        const dz = m.spawnZ - playerDistance;
        if (dz >= -1 && dz <= range) {
            if (best === null || m.spawnZ < best.spawnZ) best = m;
        }
    }
    return best ? best.chunkIndex : null;
}

/** True once every monster spawned in the given chunk is dead. */
export function isEncounterClear(chunkIndex) {
    return !_monsters.some((m) => m.chunkIndex === chunkIndex && !m.dead);
}

const BARE_HANDED_DAMAGE = 3;
const CRIT_MULTIPLIER = 2;

/** Rolls the weapon's crit chance and returns damage for a single swing hit. */
function _rolledWeaponDamage() {
    const weapon = state.equipped.weapon;
    const damage = weapon ? weapon.damage : BARE_HANDED_DAMAGE;
    const critChance = weapon ? weapon.critChance : 0;
    return Math.random() < critChance ? damage * CRIT_MULTIPLIER : damage;
}

function _damageMonster(m, dmg) {
    if (m.dead) return;
    m.hp -= dmg;
    playSwordHit();
    spawnHitParticles(m.x, m.mesh.position.y, m.z, m.archetype.color);
    triggerShake(0.12, 0.1);
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
    // Geometry comes from _monsterGeoCache and is shared across every
    // monster of that archetype — never dispose it here, only the
    // per-monster material (each monster gets its own material instance).
    m.mesh.material.dispose();
}
