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
import { getEnemies, removeEnemy } from './enemies.js';
import { getPlayer } from './player.js';
import { spawnExplosion } from './explosions.js';
import {
    BULLET_RADIUS,
    PLAYER_RADIUS,
    COLORS,
} from './config.js';

// True while the player is briefly invulnerable after a hit, so a cluster of
// enemies doesn't drain every life in one frame.
let _invuln = 0;
const INVULN_TIME = 1.2; // seconds

export function resetCollisions() { _invuln = 0; }

function _hit(ax, az, ar, bx, bz, br) {
    const dx = ax - bx;
    const dz = az - bz;
    const r  = ar + br;
    return (dx * dx + dz * dz) <= (r * r);
}

export function updateCollisions(dt) {
    if (_invuln > 0) _invuln -= dt;

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
                    spawnExplosion(ep.x, ep.z, COLORS.gold);
                    playExplosion();
                    state.addScore(e.value * state.wave);
                    removeEnemy(e);
                }
                break; // this enemy is done being tested against bullets this frame
            }
        }
    }

    // --- Enemies vs player ---
    const ship = getPlayer();
    if (!ship || _invuln > 0) return;

    const sp = ship.position;
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
        const e  = enemies[ei];
        const ep = e.mesh.position;

        if (_hit(ep.x, ep.z, e.radius, sp.x, sp.z, PLAYER_RADIUS)) {
            spawnExplosion(ep.x, ep.z, COLORS.danger);
            playExplosion();
            removeEnemy(e);

            playPlayerHit();
            state.loseLife();
            events.emit('playerHit');
            _invuln = INVULN_TIME;
            break; // only one hit per frame
        }
    }
}
