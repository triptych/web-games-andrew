/**
 * collisions.js — Circle-vs-circle collision resolution for the shmup.
 *
 * Top-down means everything lives on the XZ plane, so collisions are cheap
 * distance-squared checks between circles. Two interactions:
 *
 *   bullet → enemy : enemy loses HP; at 0 it dies (explosion + score), the
 *                    bullet is consumed.
 *   enemy  → player: player loses a life, the enemy is destroyed, and a
 *                    `playerHit` event fires (ui/main drive the screen flash).
 *
 * This module owns no entities — it reads the live bullet and enemy lists and
 * calls the owning modules' removal helpers. Call updateCollisions(dt) each
 * playing frame, after movement has been applied.
 *
 * Public API:
 *   updateCollisions(dt) — run all collision checks for this frame.
 */

import { scene }  from './scene.js';
import { state }  from './state.js';
import { events } from './events.js';
import { playExplosion, playPlayerHit } from './sounds.js';
import { getBullets } from './bullets.js';
import { getEnemyBullets } from './enemyBullets.js';
import { getEnemies, removeEnemy } from './enemies.js';
import { getPlayer } from './player.js';
import { spawnExplosion } from './explosions.js';
import { spawnScorePopup } from './popups.js';
import { maybeDrop, dropBossLoot } from './powerups.js';
import {
    BULLET_RADIUS,
    ENEMY_BULLET_RADIUS,
    PLAYER_RADIUS,
    SHIELD_DURATION,
    COLORS,
} from './config.js';

// True while the player is briefly invulnerable after a hit, so a cluster of
// enemies doesn't drain every life in one frame.
let _invuln = 0;
const INVULN_TIME = 1.2; // seconds

// Separate, longer invulnerability granted by the SHIELD power-up. Tracked apart
// from _invuln so a hit's brief i-frames never cut a shield short, and so the
// HUD can show the shield independently.
let _shield = 0;

export function resetCollisions() { _invuln = 0; _shield = 0; }

// The shield power-up: a window of full invulnerability.
events.on('powerup', (p) => { if (p.kind === 'shield') _shield = SHIELD_DURATION; });

// Exposed so the HUD can flag the buff.
export function shieldRemaining() { return _shield; }

function _hit(ax, az, ar, bx, bz, br) {
    const dx = ax - bx;
    const dz = az - bz;
    const r  = ar + br;
    return (dx * dx + dz * dz) <= (r * r);
}

export function updateCollisions(dt) {
    if (_invuln > 0) _invuln -= dt;
    if (_shield > 0) _shield -= dt;

    const bullets = getBullets();
    const enemies = getEnemies();

    // --- Bullets vs enemies ---
    // Iterate enemies outer, bullets inner; both backward so removals are safe.
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e = enemies[ei];
        const ep = e.mesh.position;

        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            const bp = b.mesh.position;

            if (_hit(ep.x, ep.z, e.radius, bp.x, bp.z, BULLET_RADIUS)) {
                // Consume the bullet.
                scene.remove(b.mesh);
                bullets.splice(bi, 1);

                e.hp -= 1;
                if (e.hp <= 0) {
                    const points = e.value * state.wave;
                    if (e.isBoss) {
                        // A boss goes out with a cluster of bursts for impact.
                        spawnExplosion(ep.x, ep.z, COLORS.magenta);
                        spawnExplosion(ep.x + 1, ep.z - 1, COLORS.gold);
                        spawnExplosion(ep.x - 1, ep.z + 1, COLORS.gold);
                        dropBossLoot(ep.x, ep.z);   // guaranteed loot shower
                    } else {
                        // Tint the burst to the enemy's own color so types read.
                        spawnExplosion(ep.x, ep.z, e.type ? e.type.color : COLORS.gold);
                        maybeDrop(ep.x, ep.z);      // chance of a pickup
                    }
                    spawnScorePopup(ep.x, ep.z, points);
                    playExplosion();
                    state.addScore(points);
                    removeEnemy(e);
                }
                break; // this enemy is done being tested against bullets this frame
            }
        }
    }

    // --- Things vs player (only when not currently invulnerable) ---
    // While shielded the player still clears enemy bodies on contact (below),
    // but takes no damage — handled in _damagePlayer via the _shield guard.
    const ship = getPlayer();
    if (!ship || _invuln > 0 || _shield > 0) return;

    const sp = ship.position;

    // Enemy bodies ramming the player. A normal enemy is destroyed on contact;
    // a mini-boss shrugs it off (only its HP from bullets kills it).
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e  = enemies[ei];
        const ep = e.mesh.position;

        if (_hit(ep.x, ep.z, e.radius, sp.x, sp.z, PLAYER_RADIUS)) {
            if (!e.isBoss) {
                spawnExplosion(ep.x, ep.z, COLORS.danger);
                playExplosion();
                removeEnemy(e);
            }
            _damagePlayer();
            return; // one hit per frame; player is now invulnerable
        }
    }

    // Enemy bullets striking the player.
    const eShots = getEnemyBullets();
    for (let si = eShots.length - 1; si >= 0; si--) {
        const s  = eShots[si];
        const spp = s.mesh.position;
        if (_hit(spp.x, spp.z, ENEMY_BULLET_RADIUS, sp.x, sp.z, PLAYER_RADIUS)) {
            scene.remove(s.mesh);
            eShots.splice(si, 1);
            _damagePlayer();
            return;
        }
    }
}

// Apply one point of player damage: hit feedback, life loss, invulnerability.
function _damagePlayer() {
    playPlayerHit();
    state.loseLife();
    events.emit('playerHit');
    _invuln = INVULN_TIME;
}
