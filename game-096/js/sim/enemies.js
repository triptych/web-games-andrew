// Baddies, flying things, and the hazards that sit still or spin. Pure.

import { PHYS } from '../config.js';
import { hash3 } from '../rng.js';
import { forSolids } from './world.js';

// r: body radius, h: height. stomp: can be landed on. spin: spin and roll hurt it. armored: shrugs off spin and stomps.
export const DEFS = {
    flea:     { r: 0.5,  h: 0.7,  stomp: true,  spin: true,  speed: 2.3 },
    starfish: { r: 0.7,  h: 0.45, stomp: false, spin: true,  speed: 3.1 },
    jelly:    { r: 0.6,  h: 0.95, stomp: false, spin: true,  speed: 1.2 },
    monkey:   { r: 0.55, h: 1.25, stomp: true,  spin: true,  speed: 0 },
    cannon:   { r: 0.75, h: 1.0,  stomp: false, spin: false, speed: 0, fixed: true },
    gull:     { r: 0.6,  h: 0.7,  stomp: true,  spin: true,  speed: 3.2 },
    knight:   { r: 0.7,  h: 1.35, stomp: false, spin: false, speed: 1.5, armored: true },
};
const SHOT = {
    coconut: { r: 0.36, grav: 15 },
    ball: { r: 0.42, grav: 0 },
    rock: { r: 0.45, grav: 22 },
    fish: { r: 0.4, grav: 20 },
};
const ev = (G, type, o) => { G.events.push(o ? { type, ...o } : { type }); };

// hooks bound by game.js and boss.js (they import this file, so it cannot import them)
let hurtFn = null, bossShotFn = null;
export function bindHooks(h) { if (h.hurt) hurtFn = h.hurt; if (h.bossShot) bossShotFn = h.bossShot; }
export function hurtPlayer(G, x, z) { return hurtFn(G, x, z); }

export function initEnemies(G) {
    G.enemies = G.level.enemies.map((s, i) => {
        const d = DEFS[s.kind];
        if (!d) throw new Error('unknown enemy ' + s.kind);
        return {
            id: i, kind: s.kind, x: s.x, y: s.y, z: s.z, hx: s.x, hy: s.y, hz: s.z,
            tx: s.tx ?? s.x, tz: s.tz ?? s.z, fx: s.fx ?? 0, fz: s.fz ?? -1, u: 0, dir: 1,
            alive: 1, dieT: 0, t: hash3(i, 17) * 6, state: 0, cd: 0.6 + hash3(i, 3) * 1.6, stun: 0,
            face: Math.atan2(-(s.fx ?? 0), -(s.fz ?? -1)), hop: 0, rate: s.rate || 1,
        };
    });
}

export function spawnShot(G, kind, x, y, z, vx, vy, vz, owner, from) {
    const d = SHOT[kind];
    const s = { id: G.shotId++, kind, x, y, z, vx, vy, vz, r: d.r, grav: d.grav, owner, from, t: 0 };
    G.shots.push(s);
    return s;
}

export function killEnemy(G, e, how) {
    if (!e.alive) return;
    e.alive = 0; e.dieT = 0;
    ev(G, 'kill', { kind: e.kind, x: e.x, y: e.y, z: e.z, how, id: e.id });
}

/** Everything standing close to a ground pound's impact. */
export function shockwave(G, x, y, z, r) {
    for (const e of G.enemies) {
        if (!e.alive || e.kind === 'cannon') continue;
        const d = DEFS[e.kind];
        if (Math.hypot(e.x - x, e.z - z) < r + d.r && Math.abs((e.y + d.h / 2) - (y + 0.5)) < 2.2) killEnemy(G, e, 'slam');
    }
    for (const s of G.shots) if (s.owner === 'e' && Math.hypot(s.x - x, s.z - z) < r && Math.abs(s.y - y) < 1.4) s.dead = 1;
}

export function hitEnemiesNear(G, x, y, z, r, how) {
    let n = 0;
    for (const e of G.enemies) {
        if (!e.alive) continue;
        const d = DEFS[e.kind];
        if (d.armored || d.fixed) continue;
        if (Math.hypot(e.x - x, e.z - z) < r + d.r && Math.abs(e.y - y) < 1.8) { killEnemy(G, e, how); n++; }
    }
    return n;
}

// ---------------------------------------------------------------- behaviours
function patrol(e, d, dt) {
    const dx = e.tx - e.hx, dz = e.tz - e.hz, len = Math.hypot(dx, dz);
    if (len < 0.1) return;
    e.u += (e.dir * d.speed * e.rate * dt) / len;
    if (e.u > 1) { e.u = 1; e.dir = -1; } else if (e.u < 0) { e.u = 0; e.dir = 1; }
    e.x = e.hx + dx * e.u; e.z = e.hz + dz * e.u;
    e.face = Math.atan2(-(dx * e.dir), -(dz * e.dir));
}

export function stepEnemies(G, dt) {
    const p = G.p;
    for (const e of G.enemies) {
        if (!e.alive) { e.dieT += dt; continue; }
        const d = DEFS[e.kind];
        e.t += dt;
        const dist = Math.hypot(p.x - e.x, p.z - e.z);
        switch (e.kind) {
            case 'flea':
                patrol(e, d, dt);
                e.hop = Math.abs(Math.sin(e.t * 5.2)) * 0.55;
                break;
            case 'starfish':
                patrol(e, d, dt); e.spin = (e.spin || 0) + dt * 6;
                break;
            case 'knight':
                if (e.stun > 0) e.stun -= dt; else patrol(e, d, dt);
                break;
            case 'jelly':
                patrol(e, d, dt);
                e.y = e.hy + Math.sin(e.t * 1.9) * 1.0;
                break;
            case 'monkey': {
                e.face = Math.atan2(-(p.x - e.x), -(p.z - e.z));
                if (e.state === 0) {
                    e.cd -= dt;
                    if (e.cd <= 0 && dist < 15 && dist > 3 && p.dead <= 0) { e.state = 1; e.wind = 0.6; ev(G, 'windup', { x: e.x, y: e.y + 1.3, z: e.z, kind: 'monkey' }); }
                } else {
                    e.wind -= dt;
                    if (e.wind <= 0) {
                        const T = Math.min(1.5, Math.max(0.55, dist / 8.5));
                        const tx = p.x + p.vx * T * 0.5, tz = p.z + p.vz * T * 0.5, ty = p.y + 0.7;
                        const sx = e.x, sy = e.y + 1.4, sz = e.z;
                        spawnShot(G, 'coconut', sx, sy, sz, (tx - sx) / T, (ty - sy) / T + 0.5 * SHOT.coconut.grav * T, (tz - sz) / T, 'e', e.id);
                        ev(G, 'throw', { x: sx, y: sy, z: sz, kind: 'coconut' });
                        e.state = 0; e.cd = 2.3 + hash3(e.id, Math.floor(G.t)) * 0.9;
                    }
                }
                break;
            }
            case 'cannon': {
                if (e.state === 0) {
                    e.cd -= dt;
                    if (e.cd <= 0 && dist < 34) { e.state = 1; e.wind = 0.55; ev(G, 'windup', { x: e.x, y: e.y + 0.9, z: e.z, kind: 'cannon' }); }
                } else {
                    e.wind -= dt;
                    if (e.wind <= 0) {
                        spawnShot(G, 'ball', e.x + e.fx * 1.0, e.y + 0.85, e.z + e.fz * 1.0, e.fx * 9.5, 0, e.fz * 9.5, 'e', e.id);
                        ev(G, 'throw', { x: e.x, y: e.y + 0.9, z: e.z, kind: 'ball' });
                        e.state = 0; e.cd = 3.1 * e.rate;
                    }
                }
                break;
            }
            case 'gull': {
                if (e.state === 0) {                       // patrol high
                    patrol(e, d, dt);
                    e.y = e.hy + 3.2 + Math.sin(e.t * 2.4) * 0.3;
                    e.cd -= dt;
                    if (e.cd <= 0 && dist < 8 && p.dead <= 0) { e.state = 1; e.wind = 0.6; e.aimx = p.x; e.aimy = p.y + 0.5; e.aimz = p.z; ev(G, 'windup', { x: e.x, y: e.y, z: e.z, kind: 'gull' }); }
                } else if (e.state === 1) {                // warn, hover
                    e.wind -= dt; e.face = Math.atan2(-(e.aimx - e.x), -(e.aimz - e.z));
                    if (e.wind <= 0) { e.state = 2; e.dive = 0; }
                } else if (e.state === 2) {                // dive
                    const dx = e.aimx - e.x, dy = e.aimy - e.y, dz = e.aimz - e.z, l = Math.hypot(dx, dy, dz);
                    e.dive += dt;
                    if (l < 0.6 || e.dive > 1.0) { e.state = 3; e.rise = 0; }
                    else { const s = Math.min(l, 13 * dt); e.x += (dx / l) * s; e.y += (dy / l) * s; e.z += (dz / l) * s; }
                } else {                                   // flap back up
                    e.rise += dt;
                    const ty = e.hy + 3.2, ux = e.hx + (e.tx - e.hx) * e.u, uz = e.hz + (e.tz - e.hz) * e.u;
                    const k = 1 - Math.exp(-3 * dt);
                    e.x += (ux - e.x) * k; e.z += (uz - e.z) * k; e.y += (ty - e.y) * k;
                    if (e.rise > 1.3) { e.state = 0; e.cd = 2.6; }
                }
                break;
            }
        }
    }
    stepShots(G, dt);
}

// ---------------------------------------------------------------- shots
function stepShots(G, dt) {
    const p = G.p, shots = G.shots;
    for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        s.t += dt;
        s.vy -= s.grav * dt;
        s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
        let gone = s.dead || s.t > 7 || s.y < G.level.killY;
        if (!gone) {
            // terrain
            gone = forSolids(G, s.x - s.r, s.x + s.r, s.z - s.r, s.z + s.r, (b) => s.x + s.r > b.x0 && s.x - s.r < b.x1 && s.z + s.r > b.z0 && s.z - s.r < b.z1 && s.y + s.r > b.y0 && s.y - s.r < b.y1);
            if (gone) ev(G, 'smash', { x: s.x, y: s.y, z: s.z, kind: s.kind });
        }
        if (!gone && s.owner === 'e' && p.dead <= 0 && !p.launch) {
            const dx = s.x - p.x, dz = s.z - p.z;
            if (dx * dx + dz * dz < (s.r + PHYS.radius) ** 2 && s.y > p.y - 0.2 && s.y < p.y + PHYS.height + 0.2) {
                const l = Math.hypot(dx, dz) || 1;
                const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
                if (p.brace && (dx / l) * fx + (dz / l) * fz > 0.25) {
                    if (s.kind === 'coconut' || s.kind === 'rock' || s.kind === 'fish') reflect(G, s);
                    else { gone = true; ev(G, 'clank', { x: s.x, y: s.y, z: s.z }); }
                    ev(G, 'block', { x: s.x, y: s.y, z: s.z, kind: s.kind });
                } else {
                    gone = true;
                    ev(G, 'splat', { x: s.x, y: s.y, z: s.z, kind: s.kind });
                    hurtPlayer(G, s.x - s.vx * 0.2, s.z - s.vz * 0.2);
                }
            }
        } else if (!gone && s.owner === 'p') {
            for (const e of G.enemies) {
                if (!e.alive) continue;
                const d = DEFS[e.kind];
                if (Math.hypot(e.x - s.x, e.z - s.z) < d.r + s.r + 0.2 && s.y > e.y - 0.4 && s.y < e.y + d.h + 0.4) {
                    if (d.fixed) continue;
                    killEnemy(G, e, 'reflect'); gone = true; ev(G, 'smash', { x: s.x, y: s.y, z: s.z, kind: s.kind });
                    break;
                }
            }
            if (!gone && G.boss && bossShotFn && bossShotFn(G, s)) gone = true;
        }
        if (gone) shots.splice(i, 1);
    }
}

function reflect(G, s) {
    s.owner = 'p'; s.t = 0; s.grav = 0;
    let tx = s.x - s.vx, ty = s.y, tz = s.z - s.vz;
    const e = typeof s.from === 'number' ? G.enemies[s.from] : null;
    if (e && e.alive) { tx = e.x; ty = e.y + 0.8; tz = e.z; }
    else if (G.boss && G.boss.alive) { tx = G.boss.x; ty = G.boss.y + (G.boss.aim ?? 1.4); tz = G.boss.z; }
    const dx = tx - s.x, dy = ty - s.y, dz = tz - s.z, l = Math.hypot(dx, dy, dz) || 1;
    s.vx = (dx / l) * 15; s.vy = (dy / l) * 15; s.vz = (dz / l) * 15;
}

// ---------------------------------------------------------------- touching the player
export function touchEnemies(G, dt) {
    const p = G.p;
    if (p.dead > 0 || p.launch) return;
    const R = PHYS.radius;
    const spinReach = PHYS.spinReach * G.perks.spin;
    for (const e of G.enemies) {
        if (!e.alive) continue;
        const d = DEFS[e.kind];
        const dx = e.x - p.x, dz = e.z - p.z, dist = Math.hypot(dx, dz);
        const eTop = e.y + d.h, pTop = p.y + PHYS.height;
        const overlapY = p.y < eTop && pTop > e.y;

        // attacks
        if (p.spinT > 0 && dist < spinReach + d.r && e.y - p.y < 1.4 && p.y - eTop < 1.2) {
            if (d.spin) { killEnemy(G, e, 'spin'); continue; }
            if (d.armored && !e.clink) { e.clink = 0.3; ev(G, 'clink', { x: e.x, y: e.y + 0.8, z: e.z }); }
        }
        if (p.rollT > 0 && dist < 1.2 + d.r && overlapY) {
            if (d.spin) { killEnemy(G, e, 'roll'); continue; }
            if (d.armored) { p.rollT = 0; p.rollCool = PHYS.rollCool; p.vx = -p.rdx * 4; p.vz = -p.rdz * 4; ev(G, 'clink', { x: e.x, y: e.y + 0.8, z: e.z }); continue; }
        }
        if (e.clink > 0) e.clink -= dt;

        if (dist < d.r + R && overlapY) {
            const above = p.vy < -0.5 && p.y > e.y + d.h * 0.5;
            if (above && p.slam === 2) { killEnemy(G, e, 'slam'); p.vy = 0; continue; }
            if (above && d.stomp) {
                killEnemy(G, e, 'stomp');
                p.vy = 0; // a bounce, set by the caller's rule below
                p.vy = (G.lastJumpHeld ? PHYS.bounceHold : PHYS.bounceV) * G.perks.bounce; p.grounded = false; p.jumping = false; p.glide = false;
                continue;
            }
            if (above && d.armored) {
                p.vy = PHYS.bounceV * 0.9; p.jumping = false; ev(G, 'clink', { x: e.x, y: e.y + d.h, z: e.z });
                continue;
            }
            if (e.kind === 'cannon') {
                // a cannon is a solid thing: nudge the player out rather than hurt
                const l = dist || 1; p.x -= (dx / l) * (d.r + R - dist); p.z -= (dz / l) * (d.r + R - dist);
                continue;
            }
            if (p.brace && e.kind !== 'jelly') {
                const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
                if ((dx / (dist || 1)) * fx + (dz / (dist || 1)) * fz > 0.25) { e.x += (dx / (dist || 1)) * 0.1; ev(G, 'clink', { x: e.x, y: e.y + 0.8, z: e.z }); continue; }
            }
            hurtPlayer(G, e.x, e.z);
        }
    }
    // hazards
    for (const h of G.level.hazards) {
        if (h.kind === 'urchin') {
            const dist = Math.hypot(h.x - p.x, h.z - p.z);
            if (dist < 0.62 + R && p.y < h.y + 0.75 && p.y + PHYS.height > h.y) hurtPlayer(G, h.x, h.z);
        } else if (h.kind === 'spinner') {
            const ang = (h.phase || 0) + G.t * (h.speed || 1.6);
            const L = h.len || 4;
            if (p.y < h.y + 1.0 && p.y + PHYS.height > h.y - 0.1) {
                for (let k = 0; k < (h.arms || 2); k++) {
                    const a = ang + (k * Math.PI * 2) / (h.arms || 2);
                    const ex = Math.cos(a) * L, ez = Math.sin(a) * L;
                    const px = p.x - h.x, pz = p.z - h.z;
                    const t = Math.max(0, Math.min(1, (px * ex + pz * ez) / (L * L)));
                    const cx = ex * t - px, cz = ez * t - pz;
                    if (cx * cx + cz * cz < (0.38 + R) ** 2) { hurtPlayer(G, h.x + ex * t, h.z + ez * t); break; }
                }
            }
        }
    }
}
