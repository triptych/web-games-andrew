/**
 * player.js — the Kestrel T-3: movement, guns, flares, Overdrive, death.
 *
 * PURE: takes an input snapshot ({ax, ay, focus, fire, flare, od, pointer}) and
 * the world, mutates the player entity. Nothing here knows about three.js, the
 * DOM, or the actual keyboard — which is how dev/balance.mjs can hand it a bot's
 * input instead of a human's.
 */

import { ARENA, PLAYER, FLARE, WEAPONS, MAX_POWER, COLORS } from '../core/config.js';
import { aimAt } from './patterns.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const D2R = Math.PI / 180;

export function makePlayer(run) {
    return {
        x: PLAYER.startX,
        y: PLAYER.startY,
        prevX: PLAYER.startX,
        prevY: PLAYER.startY,
        vx: 0, vy: 0,
        r: PLAYER.shipRadius,
        hitbox: PLAYER.hitbox,
        alive: true,
        focus: false,
        weapon: run?.weapon ?? 'vulcan',
        power: run?.power ?? 1,
        lives: run?.lives ?? PLAYER.startLives,
        flares: run?.flares ?? PLAYER.startFlares,
        maxFlares: PLAYER.maxFlares + (run?.wing?.secondflare ? 1 : 0),
        fireCd: 0,
        invuln: PLAYER.respawnInvuln,
        respawnTimer: 0,
        od: 0,                    // 0..100 meter
        odActive: 0,              // seconds of Overdrive remaining
        graze: 0,
        grazeStreak: 0,
        deathGrace: 0,            // death-bomb window
        pendingDeath: false,
        drone: run?.wing?.bastion ? { x: 0, y: 0, blockCd: 0 } : null,
        patchworkT: 0,
        tilt: 0,
        firing: false,
    };
}

export function weaponSpec(p) {
    const w = WEAPONS[p.weapon] ?? WEAPONS.vulcan;
    const lvl = clamp(p.power, 1, MAX_POWER) - 1;
    return { def: w, muzzles: w.levels[lvl] };
}

export function updatePlayer(p, w, input, dt) {
    p.prevX = p.x; p.prevY = p.y;

    if (p.respawnTimer > 0) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) respawn(p, w);
        return;
    }
    if (!p.alive) return;

    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.deathGrace > 0) {
        p.deathGrace -= dt;
        if (p.deathGrace <= 0 && p.pendingDeath) killPlayer(p, w);
    }

    // --- Overdrive ---
    if (p.odActive > 0) {
        p.odActive = Math.max(0, p.odActive - dt);
        if (p.odActive === 0) w.fx('odEnd', { x: p.x, y: p.y });
    }
    if (input.od && p.od >= 100 && p.odActive <= 0) {
        p.od = 0;
        p.odActive = PLAYER.odDuration;
        w.fx('odStart', { x: p.x, y: p.y });
    }

    // --- Patchwork (Juno): slow shield regeneration expressed as flare trickle ---
    if (w.run?.wing?.patchwork) {
        p.patchworkT += dt;
        if (p.patchworkT >= 25) {
            p.patchworkT = 0;
            if (p.flares < p.maxFlares) {
                p.flares++;
                w.fx('patchwork', { x: p.x, y: p.y });
            }
        }
    }

    // --- Movement ---
    p.focus = !!input.focus;
    let speed = p.focus ? PLAYER.focusSpeed : PLAYER.speed;
    if (p.odActive > 0) speed *= PLAYER.odSpeedMult;

    let dx = 0, dy = 0;
    if (input.pointer?.active) {
        // pointer/touch: fly toward the cursor, arriving rather than snapping
        const tx = clamp(input.pointer.x, ARENA.left + PLAYER.bounds.pad, ARENA.right - PLAYER.bounds.pad);
        const ty = clamp(input.pointer.y, ARENA.bottom + PLAYER.bounds.pad, ARENA.top - PLAYER.bounds.pad);
        const ddx = tx - p.x, ddy = ty - p.y;
        const dist = Math.hypot(ddx, ddy);
        if (dist > 0.01) {
            const step = Math.min(dist, speed * dt);
            dx = (ddx / dist) * step;
            dy = (ddy / dist) * step;
        }
    } else {
        const ax = input.ax ?? 0, ay = input.ay ?? 0;
        const len = Math.hypot(ax, ay) || 1;
        dx = (ax / len) * speed * dt;
        dy = (ay / len) * speed * dt;
    }
    p.x = clamp(p.x + dx, ARENA.left + PLAYER.bounds.pad, ARENA.right - PLAYER.bounds.pad);
    p.y = clamp(p.y + dy, ARENA.bottom + PLAYER.bounds.pad, ARENA.top - PLAYER.bounds.pad);
    p.vx = dt > 0 ? (p.x - p.prevX) / dt : 0;
    p.vy = dt > 0 ? (p.y - p.prevY) / dt : 0;
    p.tilt += (clamp(p.vx / PLAYER.speed, -1, 1) - p.tilt) * Math.min(1, dt * 8);

    // --- Guns ---
    p.fireCd -= dt;
    const wantFire = input.fire || w.autofire;
    p.firing = !!wantFire;
    if (wantFire && p.fireCd <= 0) {
        fireWeapon(p, w);
        const { def } = weaponSpec(p);
        p.fireCd = def.cooldown / (p.odActive > 0 ? PLAYER.odFireMult : 1);
    }

    // --- Bastion drone (Piotr) ---
    if (p.drone) {
        const targetX = p.x + (p.focus ? 0.9 : 1.6);
        const targetY = p.y + 1.1;
        p.drone.x += (targetX - p.drone.x) * Math.min(1, dt * 7);
        p.drone.y += (targetY - p.drone.y) * Math.min(1, dt * 7);
        p.drone.blockCd = Math.max(0, p.drone.blockCd - dt);
    }

    // --- Flare ---
    if (input.flare) fireFlare(p, w);
}

export function fireWeapon(p, w) {
    const { def, muzzles } = weaponSpec(p);
    const squeeze = p.focus ? def.focusSqueeze : 1;
    for (const m of muzzles) {
        const ang = Math.PI / 2 + m.ang * D2R * squeeze;
        w.spawnPlayerBullet({
            x: p.x + m.dx * (p.focus ? 0.7 : 1),
            y: p.y + m.dy,
            ang,
            speed: m.speed,
            dmg: m.dmg,
            r: m.r,
            kind: m.kind,
            pierce: m.pierce,
            homing: m.homing,
            color: def.color,
        });
    }
    if (p.drone) {
        // the drone mirrors your fire at half yield
        const m0 = muzzles[0];
        w.spawnPlayerBullet({
            x: p.drone.x, y: p.drone.y + 0.4,
            ang: Math.PI / 2, speed: m0.speed, dmg: Math.max(2, Math.round(m0.dmg * 0.5)),
            r: 0.2, kind: 'dart', pierce: 0, homing: 0, color: COLORS.playerAlt,
        });
    }
    w.fx('shot', { x: p.x, y: p.y + 0.6, weapon: p.weapon, od: p.odActive > 0 });
}

export function fireFlare(p, w) {
    if (p.flares <= 0 || p.flareCd > 0) return false;
    p.flares--;
    p.flareCd = 0.6;
    if (w.stats) w.stats.flaresUsed++;
    p.invuln = Math.max(p.invuln, PLAYER.flareInvuln);
    p.pendingDeath = false;          // the death-bomb: you are saved
    p.deathGrace = 0;

    const cleared = w.clearEnemyBullets({ x: p.x, y: p.y, radius: FLARE.radius, score: true });
    w.damageArea(p.x, p.y, FLARE.radius, FLARE.damage, 'flare');
    if (w.run?.wing?.secondflare) {
        w.spawnField({ x: p.x, y: p.y, r: FLARE.fieldRadius, dps: FLARE.fieldDps, life: FLARE.fieldDuration });
    }
    w.fx('flare', { x: p.x, y: p.y, cleared, field: !!w.run?.wing?.secondflare });
    return true;
}

/** Called by collision when something touches the 0.17u hitbox. */
export function hitPlayer(p, w) {
    if (p.invuln > 0 || !p.alive || p.respawnTimer > 0) return false;
    if (p.pendingDeath) return false;
    // Open the death-bomb window rather than killing outright: a flare pressed
    // within 0.2s still saves the run. Genre courtesy, and it is in the GDD.
    p.pendingDeath = true;
    p.deathGrace = PLAYER.deathBombWindow;
    w.fx('playerGrazeDeath', { x: p.x, y: p.y });
    return true;
}

export function killPlayer(p, w) {
    p.pendingDeath = false;
    p.alive = false;
    p.lives--;
    p.respawnTimer = PLAYER.respawnDelay;
    p.odActive = 0;
    p.od = 0;
    p.grazeStreak = 0;
    // Dying costs a power level and scatters two power items — a chance to
    // recover, not a spiral.
    p.power = Math.max(1, p.power - 1);
    w.clearEnemyBullets({ x: p.x, y: p.y, radius: 7, score: false });
    w.fx('playerDeath', { x: p.x, y: p.y, livesLeft: p.lives });
    w.onPlayerDeath(p);
    for (let i = 0; i < 2; i++) {
        w.spawnPickup(p.x + (i - 0.5) * 2.4, Math.min(p.y + 4, ARENA.top - 2), 'power');
    }
}

function respawn(p, w) {
    p.alive = true;
    p.x = PLAYER.startX;
    p.y = PLAYER.startY;
    p.invuln = PLAYER.respawnInvuln;
    p.fireCd = 0;
    p.flares = Math.max(p.flares, PLAYER.startFlares);
    w.fx('playerRespawn', { x: p.x, y: p.y });
}

/** Graze: near-miss scoring, and the only way to fill Overdrive. */
export function grazeBullet(p, w, bullet) {
    bullet.grazed = true;
    p.graze++;
    p.grazeStreak++;
    const mult = w.run?.wing?.overcharge ? 1.6 : 1;
    p.od = Math.min(100, p.od + PLAYER.grazeOD * mult);
    w.addScore(PLAYER.grazeScore);
    w.fx('graze', { x: bullet.x, y: bullet.y });
    if (p.od >= 100 && !p.odAnnounced) {
        p.odAnnounced = true;
        w.fx('odReady', {});
    }
    if (p.od < 100) p.odAnnounced = false;
}

export function addPower(p, w, n = 1) {
    if (p.power >= MAX_POWER) {
        w.addScore(1000);
        return false;
    }
    p.power = clamp(p.power + n, 1, MAX_POWER);
    w.fx('powerUp', { x: p.x, y: p.y, power: p.power });
    return true;
}

export function switchWeapon(p, w, id) {
    if (!WEAPONS[id]) return false;
    if (p.weapon === id) { addPower(p, w, 1); return true; }
    p.weapon = id;
    p.power = clamp(p.power === MAX_POWER ? MAX_POWER - 1 : p.power, 1, MAX_POWER);
    w.fx('weaponSwap', { x: p.x, y: p.y, weapon: id });
    return true;
}

export function addFlare(p, w, n = 1) {
    if (p.flares >= p.maxFlares) { w.addScore(800); return false; }
    p.flares = clamp(p.flares + n, 0, p.maxFlares);
    return true;
}

/** Aim helper used by seeker bullets. */
export function nearestEnemyTo(w, x, y) {
    let best = null, bestD = Infinity;
    for (const e of w.enemies) {
        if (!e.alive) continue;
        const d = (e.x - x) ** 2 + (e.y - y) ** 2;
        if (d < bestD) { bestD = d; best = e; }
    }
    if (w.boss && w.boss.alive && w.boss.state === 'fight') {
        const d = (w.boss.x - x) ** 2 + (w.boss.y - y) ** 2;
        if (d < bestD) { bestD = d; best = w.boss; }
    }
    return best;
}

export { aimAt };
