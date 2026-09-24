/**
 * collide.js — every collision in the game, in one place.
 *
 * Circle-vs-circle throughout, against *simulation* radii — never against
 * anything the renderer decides. The player's collision radius is the 0.17u
 * cockpit dot (PLAYER.hitbox), not the ship model, which is the whole reason
 * bullet hell is survivable.
 *
 * Order matters: player bullets resolve before enemy bullets so a shot that
 * kills an emitter this tick still lets its already-fired bullets live (no
 * retroactive erasing), and grazes resolve before hits so a bullet that kills
 * you still pays out its graze.
 */

import { PLAYER, WEAPON_IDS, BOOST } from '../core/config.js';
import { damageEnemy, rescuePod, losePod } from './world.js';
import { damageBoss, damageBossPart } from './bosses.js';
import { hitPlayer, grazeBullet, addPower, addFlare, switchWeapon,
         addShield, addInvuln, addSpeed, addRockets } from './player.js';

const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
const hits = (ax, ay, ar, bx, by, br) => dist2(ax, ay, bx, by) <= (ar + br) ** 2;

export function resolveCollisions(w, dt) {
    playerBulletsVsEnemies(w);
    playerBulletsVsBoss(w);
    enemyBulletsVsPods(w);
    enemyBulletsVsPlayer(w, dt);
    beamsVsPlayer(w);
    hazardsVsPlayer(w);
    bodiesVsPlayer(w, dt);
    playerVsPods(w);
    playerVsPickups(w);
}

// ------------------------------------------------------- player fire → enemies

function playerBulletsVsEnemies(w) {
    for (const b of w.pBullets) {
        if (!b.alive) continue;
        for (const e of w.enemies) {
            if (!e.alive) continue;
            if (b.hits && b.hits.has(e.id)) continue;
            if (!hits(b.x, b.y, b.r, e.x, e.y, e.r)) continue;

            // Shieldbearer: a frontal shield eats anything arriving from below,
            // so it has to be flanked or out-angled.
            if (e.shieldHp > 0 && e.def.shieldArc) {
                const toBullet = Math.atan2(b.y - e.y, b.x - e.x);
                const facing = -Math.PI / 2;                    // shield points down-screen
                let d = Math.abs(((toBullet - facing + Math.PI) % (Math.PI * 2)) - Math.PI);
                if (d <= (e.def.shieldArc * Math.PI / 180) / 2) {
                    e.shieldHp -= b.dmg;
                    w.fx('shieldHit', { x: b.x, y: b.y });
                    if (e.shieldHp <= 0) w.fx('shieldBroken', { x: e.x, y: e.y });
                    consume(b, e);
                    if (!b.alive) break;
                    continue;
                }
            }

            w.fx('hit', { x: b.x, y: b.y, dmg: b.dmg });
            damageEnemy(w, e, b.dmg);
            if (b.rocket) detonate(w, b, e);
            consume(b, e);
            if (!b.alive) break;
        }
    }
}

/**
 * A rocket does its listed damage to what it hit, then a smaller blast to
 * everything nearby. The direct target is already damaged, so exclude it from
 * the splash rather than double-dipping.
 */
function detonate(w, b, hitEntity) {
    b.alive = false;
    b.pierce = 0;
    const R = BOOST.rocket;
    const r2 = R.blastRadius ** 2;
    for (const e of w.enemies) {
        if (!e.alive || e === hitEntity) continue;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > r2) continue;
        damageEnemy(w, e, R.blastDamage, 'rocket');
    }
    if (w.boss?.alive && w.boss !== hitEntity && !w.boss.hidden
        && (w.boss.x - b.x) ** 2 + (w.boss.y - b.y) ** 2 <= r2) {
        damageBoss(w.boss, w, R.blastDamage);
    }
    w.fx('rocketBlast', { x: b.x, y: b.y });
}

function consume(b, e) {
    if (b.pierce > 0) {
        b.pierce--;
        b.hits ??= new Set();
        b.hits.add(e.id);
    } else {
        b.alive = false;
    }
}

function playerBulletsVsBoss(w) {
    const boss = w.boss;
    if (!boss || !boss.alive || boss.hidden) return;
    for (const b of w.pBullets) {
        if (!b.alive) continue;

        // Turrets and other destructible parts soak hits before the hull does.
        let hitPart = false;
        for (const part of boss.parts) {
            if (!part.alive) continue;
            if (!hits(b.x, b.y, b.r, boss.x + part.dx, boss.y + part.dy, part.r)) continue;
            damageBossPart(boss, w, part, b.dmg);
            w.fx('hit', { x: b.x, y: b.y, dmg: b.dmg, part: part.id });
            hitPart = true;
            // A rocket that hit a TURRET still splashes the hull — the hull was
            // not the thing already damaged, so it is not double-dipping.
            if (b.rocket) detonate(w, b, null);
            else if (b.pierce > 0) { b.pierce--; } else { b.alive = false; }
            break;
        }
        if (hitPart || !b.alive) continue;

        if (!hits(b.x, b.y, b.r, boss.x, boss.y, boss.r)) continue;
        if (boss.state !== 'fight' || boss.invuln) {
            w.fx('deflect', { x: b.x, y: b.y });
            b.alive = false;
            continue;
        }
        w.fx('hit', { x: b.x, y: b.y, dmg: b.dmg, boss: true });
        damageBoss(boss, w, b.dmg);
        if (b.rocket) { detonate(w, b, boss); continue; }
        if (b.pierce > 0) b.pierce--; else b.alive = false;
    }
}

// ------------------------------------------------------ enemy fire → the world

function enemyBulletsVsPods(w) {
    if (w.pods.length === 0) return;
    for (const b of w.eBullets) {
        if (!b.alive) continue;
        for (const pod of w.pods) {
            if (!pod.alive) continue;
            if (!hits(b.x, b.y, b.r, pod.x, pod.y, pod.r)) continue;
            b.alive = false;
            pod.hp--;
            pod.hitFlash = 1;
            w.fx('podHit', { x: pod.x, y: pod.y, hp: pod.hp });
            if (pod.hp <= 0) losePod(w, pod, 'destroyed');
            break;
        }
    }
}

function enemyBulletsVsPlayer(w, dt) {
    const p = w.player;
    if (!p.alive || p.respawnTimer > 0) return;
    const grazeR = PLAYER.grazeRadius;

    for (const b of w.eBullets) {
        if (!b.alive) continue;
        const d2 = dist2(b.x, b.y, p.x, p.y);

        // Bastion's drone eats one bullet every six seconds.
        if (p.drone && p.drone.blockCd <= 0 && hits(b.x, b.y, b.r, p.drone.x, p.drone.y, 0.5)) {
            b.alive = false;
            p.drone.blockCd = 6;
            w.fx('droneBlock', { x: b.x, y: b.y });
            continue;
        }

        if (!b.grazed && d2 <= (grazeR + b.r) ** 2) grazeBullet(p, w, b);

        if (d2 <= (p.hitbox + b.r) ** 2) {
            if (p.invuln > 0) continue;
            b.alive = false;
            hitPlayer(p, w);
            return;
        }
    }
}

function beamsVsPlayer(w) {
    const p = w.player;
    if (!p.alive || p.invuln > 0 || p.respawnTimer > 0) return;
    for (const bm of w.beams) {
        if (!bm.alive || bm.t < bm.warn) continue;        // warning phase is harmless
        // distance from the player to the beam's ray
        const dx = Math.cos(bm.ang), dy = Math.sin(bm.ang);
        const rx = p.x - bm.x, ry = p.y - bm.y;
        const along = rx * dx + ry * dy;
        if (along < 0 || along > bm.length) continue;
        const perp = Math.abs(-rx * dy + ry * dx);
        if (perp <= bm.width / 2 + p.hitbox) {
            hitPlayer(p, w);
            return;
        }
    }
}

function hazardsVsPlayer(w) {
    const p = w.player;
    if (!p.alive || p.invuln > 0 || p.respawnTimer > 0) return;
    for (const h of w.hazards) {
        if (!h.alive) continue;
        if (hits(h.x, h.y, h.r, p.x, p.y, p.hitbox)) { hitPlayer(p, w); return; }
    }
}

function bodiesVsPlayer(w, dt) {
    const p = w.player;
    if (!p.alive || p.respawnTimer > 0) return;
    for (const e of w.enemies) {
        if (!e.alive) continue;
        if (!hits(e.x, e.y, e.r, p.x, p.y, p.hitbox)) continue;
        // ramming an enemy hurts it too — the trainer has no guns worth the name
        damageEnemy(w, e, 30 * dt, 'ram');
        if (p.invuln <= 0) { hitPlayer(p, w); return; }
    }
    const boss = w.boss;
    if (boss && boss.alive && !boss.hidden && boss.state === 'fight' && p.invuln <= 0
        && hits(boss.x, boss.y, boss.r * 0.82, p.x, p.y, p.hitbox)) {
        hitPlayer(p, w);
    }
}

// -------------------------------------------------------------- the rescue loop

function playerVsPods(w) {
    const p = w.player;
    if (!p.alive) return;
    const hookR = PLAYER.hookRadius;
    for (const pod of w.pods) {
        if (!pod.alive) continue;
        if (hits(p.x, p.y, hookR, pod.x, pod.y, pod.r)) rescuePod(w, pod);
    }
}

function playerVsPickups(w) {
    const p = w.player;
    if (!p.alive) return;
    for (const it of w.pickups) {
        if (!it.alive) continue;
        if (!hits(p.x, p.y, p.r, it.x, it.y, it.r)) continue;
        it.alive = false;
        applyPickup(w, p, it);
    }
}

function applyPickup(w, p, it) {
    switch (it.type) {
        case 'power':
            addPower(p, w, 1);
            w.addScore(200);
            break;
        case 'flare':
            addFlare(p, w, 1);
            w.fx('flarePickup', { x: it.x, y: it.y });
            break;
        case 'life':
            p.lives = Math.min(PLAYER.maxLives, p.lives + 1);
            w.fx('lifePickup', { x: it.x, y: it.y });
            break;
        case 'gem':
            w.addScore(250);
            w.fx('gemPickup', { x: it.x, y: it.y });
            break;
        case 'weapon': {
            const id = it.weapon ?? WEAPON_IDS[w.rng.int(0, WEAPON_IDS.length - 1)];
            switchWeapon(p, w, id);
            w.addScore(300);
            break;
        }
        case 'shield':
            addShield(p, w, 1);
            w.addScore(250);
            break;
        case 'invuln':
            addInvuln(p, w);
            w.addScore(250);
            break;
        case 'speed':
            addSpeed(p, w);
            w.addScore(250);
            break;
        case 'rocket':
            addRockets(p, w);
            w.addScore(250);
            break;
        default:
            w.addScore(100);
    }
}
