// Damage, elements, hitscan, beams, projectiles, explosions, kills, combos, style and drops. Pure.
// Event payloads never use a field called `type` except the event's own (enemy kinds go in `etype`).

import { PLAYER, FURY, COMBO, QUIP_COOLDOWN } from '../config.js';
import { ENEMIES, QUIPS, COMBO_NAMES } from './data.js';
import { rayGrid, rayCylinder, cellAt, isWall, los } from './world.js';
import { genWeapon } from './weapons.js';
import { seedOf } from '../rng.js';

export const ev = (G, type, data = {}) => { G.events.push({ type, ...data }); };

export function quip(G, kind, force = false) {
    if (!force && G.quipT > 0) return;
    const list = QUIPS[kind];
    if (!list) return;
    G.quipT = QUIP_COOLDOWN;
    ev(G, 'quip', { text: G.rng.pick(list), kind });
}

/** Wake an enemy (and say so once). */
export function alert(G, e) {
    if (e.alert || e.dead) return;
    e.alert = true;
    e.think = 0;
    ev(G, 'alert', { id: e.id, etype: e.type });
}

/** Gunfire is loud: everything within r wakes up. */
export function noise(G, x, z, r) {
    for (const e of G.enemies) if (!e.alert && !e.dead && (e.x - x) ** 2 + (e.z - z) ** 2 < r * r) alert(G, e);
}

// ==================================================================== the player gets hurt

export function hurtPlayer(G, dmg, fx, fz, src = 'enemy') {
    const p = G.player;
    if (p.dead || G.phase !== 'play') return;
    dmg *= G.diff.dmg;
    if (G.god || dmg <= 0) return;
    const absorb = Math.min(p.armor, dmg * PLAYER.armorAbsorb);
    p.armor -= absorb;
    p.hp -= dmg - absorb;
    p.hurtT = 0.3;
    G.tally.taken += dmg;
    ev(G, 'hurt', { dmg, x: fx, z: fz, src });
    if (p.hp <= 0) {
        p.hp = 0; p.dead = true;
        G.phase = 'dead';
        G.tally.deaths++;
        ev(G, 'death', {});
    } else if (p.hp < 25 && !p.lowWarned) { p.lowWarned = true; quip(G, 'hurt'); }
    if (p.hp > 50) p.lowWarned = false;
}

// ==================================================================== enemies get hurt

/**
 * opts: { element, src ('p'|'e'|'boom'), dx, dz (knock direction), knock, kick, splash, gun, chainable }
 */
export function damageEnemy(G, e, dmg, opts = {}) {
    if (e.dead || e.invuln) return;
    const def = e.def;
    if (opts.src !== 'e' && G.player.overdrive > 0) dmg *= FURY.damage;
    if (opts.element === 'acid' && def.armored) dmg *= 1.6;
    else if (def.armored && !opts.splash && !opts.kick) dmg *= 0.85;
    if (e.frozen > 0) dmg *= 1.25;
    e.hp -= dmg;
    e.lastHitBy = opts.src;
    G.tally.dealt += dmg;
    if (opts.gun?.vamp && opts.src === 'p') healPlayer(G, dmg * opts.gun.vamp, false);
    ev(G, 'hit', { id: e.id, x: e.x, y: e.y + e.h * 0.6, z: e.z, dmg: Math.round(dmg), element: opts.element || null, kick: !!opts.kick, dot: !!opts.dot });
    if (opts.src === 'p' || opts.src === 'boom') alert(G, e);
    // elements
    const el = opts.element;
    if (el === 'fire') e.burn = 3;
    else if (el === 'acid') e.acidT = 3;
    else if (el === 'cryo') {
        e.cryo = Math.min(4, e.cryo + 1); e.cryoT = 1.5;
        if (e.cryo >= 4 && !e.boss) { e.frozen = 2.5; e.cryo = 0; ev(G, 'freeze', { id: e.id }); }
    } else if (el === 'shock' && opts.chainable !== false) {
        let n = 0;
        const pts = [[e.x, e.y + e.h * 0.6, e.z]];
        for (const o of G.enemies) {
            if (o === e || o.dead || n >= 2) continue;
            if ((o.x - e.x) ** 2 + (o.z - e.z) ** 2 > 36) continue;
            n++;
            pts.push([o.x, o.y + o.h * 0.6, o.z]);
            damageEnemy(G, o, dmg * 0.35, { ...opts, chainable: false, knock: 0 });
        }
        if (n) ev(G, 'arc', { pts });
    }
    // knockback and stagger
    if (opts.knock && !e.boss) {
        const k = opts.knock / Math.max(1, def.radius * 1.4);
        e.vx += (opts.dx || 0) * k; e.vz += (opts.dz || 0) * k;
        if (opts.kick) e.vy = Math.max(e.vy, 3);
    }
    if (!e.boss && e.hp > 0 && G.rng() < def.stagger * Math.min(1, dmg / 25)) { e.pain = 0.25; e.windupT = 0; }
    if (e.frozen > 0 && opts.kick && !e.boss) e.hp = 0;
    if (e.hp <= 0) killEnemy(G, e, opts, -e.hp);
}

export function healPlayer(G, n, over = false) {
    const p = G.player;
    const cap = over ? PLAYER.hpOver : PLAYER.hpMax;
    if (p.hp >= cap) return false;
    p.hp = Math.min(cap, p.hp + n);
    return true;
}

function killEnemy(G, e, opts, overkill) {
    e.dead = true;
    e.hp = 0;
    const p = G.player;
    const gib = !e.boss && (overkill > e.maxhp * 0.5 || (opts.splash && overkill > 10) || (opts.kick && e.frozen > 0) || e.def.radius < 0.4 && overkill > 15);
    const shatter = e.frozen > 0;
    ev(G, 'kill', { id: e.id, etype: e.type, x: e.x, y: e.y, z: e.z, h: e.h, gib, shatter, element: opts.element || null, dx: opts.dx || 0, dz: opts.dz || 0, boss: !!e.boss, by: opts.src });
    if (e.pylon) return;
    if (e.ambush) G.ambushLeft--;
    if (!e.summoned) G.tally.kills++;          // brood and summons don't count toward the level's total
    if (opts.src === 'p' || opts.src === 'boom') {
        // fury, combos, style
        const ps = G.player;
        ps.combo.n = ps.combo.t > 0 ? ps.combo.n + 1 : 1;
        ps.combo.t = COMBO.window;
        if (ps.overdrive <= 0) ps.fury = Math.min(FURY.max, ps.fury + FURY.kill + (gib ? FURY.gib : 0) + (ps.combo.n - 1) * FURY.combo);
        if (ps.overdrive > 0) healPlayer(G, FURY.heal, false);
        let mult = 1 + (ps.combo.n - 1) * 0.5 + (gib ? 0.5 : 0) + (opts.kick ? 0.5 : 0) + (!ps.ground ? 0.5 : 0);
        G.tally.style += Math.round(e.def.score * mult);
        if (gib) G.tally.gibs++;
        for (const [n, name] of COMBO_NAMES) if (ps.combo.n === n) { ev(G, 'combo', { n, name }); if (n >= 3) quip(G, 'multi'); }
        if (e.boss) quip(G, 'boss', true);
        else if (opts.kick) quip(G, 'kick');
        else if (gib && G.rng() < 0.35) quip(G, 'gib');
    }
    // drops
    if (e.boss) return;
    const r = G.rng();
    const d = e.def;
    if (r < d.gunDrop) dropPickup(G, 'gun', e.x, e.y, e.z, genWeapon(seedOf(G.seed, G.level, e.id * 31 + 7), { level: G.level, bonus: d.weight >= 3 ? 1 : 0 }));
    else if (r < d.gunDrop + d.bombDrop) dropPickup(G, 'bomb', e.x, e.y, e.z);
    else if (r < d.gunDrop + d.bombDrop + 0.38) {
        // ammo for something you carry (not the bottomless pistol)
        const guns = p.weapons.filter((g) => !g.infinite);
        const gun = guns.length ? guns[Math.floor(G.rng() * guns.length)] : null;
        dropPickup(G, gun ? gun.ammo : 'bullet', e.x, e.y, e.z);
    } else if (r < d.gunDrop + d.bombDrop + 0.48) dropPickup(G, 'cola', e.x, e.y, e.z);
}

export function dropPickup(G, kind, x, y, z, gun = null) {
    const L = G.L;
    let cell = cellAt(L, x, z);
    if (cell < 0 || isWall(G, cell)) return;
    const pk = { id: G.nextId++, kind, x, y: L.floor[cell], z, cell, dropped: true };
    if (gun) pk.gun = gun;
    G.pickups.push(pk);
    ev(G, 'drop', { id: pk.id, kind });
}

// ==================================================================== hitscan and beams

/** Nearest enemy/barrel along a ray, closer than maxT. */
export function rayActors(G, ox, oy, oz, dx, dy, dz, maxT, skip = null) {
    let best = null, bt = maxT;
    for (const e of G.enemies) {
        if (e.dead || e === skip) continue;
        const t = rayCylinder(ox, oy, oz, dx, dy, dz, e.x, e.y, e.z, e.def.radius, e.h);
        if (t >= 0 && t < bt) { bt = t; best = e; }
    }
    let barrel = null;
    for (const b of G.barrels) {
        if (b.dead) continue;
        const t = rayCylinder(ox, oy, oz, dx, dy, dz, b.x, b.y, b.z, 0.45, 1.2);
        if (t >= 0 && t < bt) { bt = t; best = null; barrel = b; }
    }
    return { enemy: best, barrel, t: bt };
}

export function hitscan(G, ox, oy, oz, dx, dy, dz, gun, dmg) {
    const range = gun.range;
    const wall = rayGrid(G, ox, oy, oz, dx, dy, dz, range);
    const maxT = wall ? wall.t : range;
    const hit = rayActors(G, ox, oy, oz, dx, dy, dz, maxT);
    const t = hit.enemy || hit.barrel ? hit.t : maxT;
    const x1 = ox + dx * t, y1 = oy + dy * t, z1 = oz + dz * t;
    let what = 'none';
    if (hit.enemy) {
        what = 'enemy';
        damageEnemy(G, hit.enemy, dmg, { element: gun.element, src: 'p', dx, dz, knock: dmg * 0.18, gun });
    } else if (hit.barrel) {
        what = 'barrel';
        damageBarrel(G, hit.barrel, dmg);
    } else if (wall) what = 'wall';
    ev(G, 'tracer', { x0: ox, y0: oy, z0: oz, x1, y1, z1, hit: what, nx: wall?.nx || 0, ny: wall?.ny || 0, nz: wall?.nz || 0, element: gun.element, arch: gun.arch });
    if (gun.splash && what !== 'none') explode(G, x1 - dx * 0.2, y1 - dy * 0.2, z1 - dz * 0.2, gun.splash, dmg * gun.splashFrac, 'p', gun.element, false, gun);
}

/** Tesla beam: the first thing in range, then arcs to `chain` more. */
export function beam(G, ox, oy, oz, dx, dy, dz, gun, dmg) {
    const wall = rayGrid(G, ox, oy, oz, dx, dy, dz, gun.range);
    const maxT = wall ? wall.t : gun.range;
    // generous: anything within 0.6 m of the beam line counts
    let target = null, bt = maxT;
    for (const e of G.enemies) {
        if (e.dead) continue;
        const ex = e.x - ox, ey = e.y + e.h * 0.5 - oy, ez = e.z - oz;
        const t = ex * dx + ey * dy + ez * dz;
        if (t < 0 || t > bt) continue;
        const px = ex - dx * t, py = ey - dy * t, pz = ez - dz * t;
        const rr = e.def.radius + 0.6;
        if (px * px + pz * pz < rr * rr && Math.abs(py) < e.h * 0.5 + 0.6) { bt = t; target = e; }
    }
    const pts = [[ox, oy, oz]];
    if (!target) {
        const t = maxT;
        pts.push([ox + dx * t, oy + dy * t, oz + dz * t]);
        const hit = rayActors(G, ox, oy, oz, dx, dy, dz, maxT);
        if (hit.barrel) damageBarrel(G, hit.barrel, dmg);
        ev(G, 'beam', { pts, element: gun.element, end: wall ? 'wall' : 'none' });
        return;
    }
    let cur = target;
    const hitSet = new Set();
    for (let k = 0; k <= gun.chain && cur; k++) {
        hitSet.add(cur);
        pts.push([cur.x, cur.y + cur.h * 0.6, cur.z]);
        const from = cur;
        damageEnemy(G, cur, dmg * (k === 0 ? 1 : 0.6), { element: gun.element || 'shock', src: 'p', dx, dz, knock: 0.5, gun, chainable: false });
        let next = null, nd = 64;
        for (const o of G.enemies) {
            if (o.dead || hitSet.has(o)) continue;
            const d = (o.x - from.x) ** 2 + (o.z - from.z) ** 2;
            if (d < nd && los(G, from.x, from.y + 1, from.z, o.x, o.y + 1, o.z)) { nd = d; next = o; }
        }
        cur = next;
    }
    ev(G, 'beam', { pts, element: gun.element, end: 'enemy' });
}

// ==================================================================== barrels and explosions

export function damageBarrel(G, b, dmg) {
    if (b.dead) return;
    b.hp -= dmg;
    if (b.hp <= 0) {
        b.dead = true;
        explode(G, b.x, b.y + 0.6, b.z, 5, 90, 'boom', 'fire', true);
    }
}

/** Splash damage with line of sight; the player takes 40% of their own splash and gets knocked. */
export function explode(G, x, y, z, radius, dmg, src, element = null, big = false, gun = null) {
    ev(G, 'explode', { x, y, z, r: radius, element, big: big || radius >= 4 });
    for (const e of G.enemies) {
        if (e.dead) continue;
        if (src === 'e') continue;                 // enemy rockets don't hurt enemies
        const cy = e.y + e.h * 0.5;
        const d = Math.hypot(e.x - x, cy - y, e.z - z) - e.def.radius;
        if (d > radius) continue;
        if (!los(G, x, y, z, e.x, cy, e.z)) continue;
        const f = 1 - Math.max(0, d) / radius;
        const len = Math.hypot(e.x - x, e.z - z) || 1;
        damageEnemy(G, e, dmg * (0.35 + 0.65 * f), { element, src: src === 'e' ? 'e' : (src === 'boom' ? 'boom' : 'p'), dx: (e.x - x) / len, dz: (e.z - z) / len, knock: 8 * f, splash: true, gun });
    }
    for (const b of G.barrels) {
        if (b.dead) continue;
        const d = Math.hypot(b.x - x, b.y + 0.6 - y, b.z - z);
        if (d < radius) { b.fuse = b.fuse ?? 0.15 + G.rng() * 0.15; b.hp = Math.min(b.hp, 1); b.lit = true; }
    }
    const p = G.player;
    const py = p.y + 1;
    const d = Math.hypot(p.x - x, py - y, p.z - z) - PLAYER.radius;
    if (d < radius && los(G, x, y, z, p.x, py, p.z)) {
        const f = 1 - Math.max(0, d) / radius;
        const len = Math.hypot(p.x - x, py - y, p.z - z) || 1;
        // rocket jumps: the knock is real, the self-damage is small
        const k = 11 * f;
        p.vx += (p.x - x) / len * k; p.vz += (p.z - z) / len * k;
        p.vy += Math.max(0, (py - y) / len) * k * 1.2 + (src === 'p' ? 2 : 0) * f;
        p.ground = false;
        const self = src === 'p' ? 0.25 : src === 'boom' ? 0.6 : 1;
        // hurtPlayer scales by difficulty; your own blasts shouldn't, so undo it for them
        hurtPlayer(G, dmg * (0.35 + 0.65 * f) * self / (src === 'e' ? 1 : G.diff.dmg), x, z, src);
    }
}

// ==================================================================== projectiles

/**
 * spawn: { x, y, z, vx, vy, vz, owner ('p'|'e'), dmg, kind, element, splash, splashFrac, bounce, homing, life, r, grav, fuse }
 */
export function spawnProj(G, o) {
    const pr = { id: G.nextId++, r: 0.15, life: 6, bounce: 0, homing: 0, splash: 0, splashFrac: 1, grav: 0, element: null, ...o };
    G.proj.push(pr);
    return pr;
}

export function stepProjectiles(G, dt, eScale) {
    const p = G.player;
    for (let k = G.proj.length - 1; k >= 0; k--) {
        const pr = G.proj[k];
        const h = pr.owner === 'e' ? dt * eScale : dt;
        pr.life -= h;
        if (pr.fuse !== undefined) {
            pr.fuse -= h;
            if (pr.fuse <= 0) { detonate(G, pr); G.proj.splice(k, 1); continue; }
        }
        if (pr.life <= 0) { if (pr.splash) detonate(G, pr); G.proj.splice(k, 1); continue; }
        // homing
        if (pr.homing) {
            let tx = null, ty = 0, tz = 0;
            if (pr.owner === 'e') { tx = p.x; ty = p.y + 1.1; tz = p.z; }
            else {
                let bd = 900;
                const sp = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
                for (const e of G.enemies) {
                    if (e.dead) continue;
                    const ex = e.x - pr.x, ey = e.y + e.h * 0.5 - pr.y, ez = e.z - pr.z;
                    const d2 = ex * ex + ey * ey + ez * ez;
                    if (d2 > bd) continue;
                    if ((ex * pr.vx + ey * pr.vy + ez * pr.vz) / sp < Math.sqrt(d2) * 0.5) continue;   // ahead only
                    bd = d2; tx = e.x; ty = e.y + e.h * 0.5; tz = e.z;
                }
            }
            if (tx !== null) {
                const sp = Math.hypot(pr.vx, pr.vy, pr.vz);
                const dx = tx - pr.x, dy = ty - pr.y, dz = tz - pr.z, l = Math.hypot(dx, dy, dz) || 1;
                const turn = Math.min(1, pr.homing * h);
                pr.vx += (dx / l * sp - pr.vx) * turn; pr.vy += (dy / l * sp - pr.vy) * turn; pr.vz += (dz / l * sp - pr.vz) * turn;
                const s2 = Math.hypot(pr.vx, pr.vy, pr.vz) || 1;
                pr.vx *= sp / s2; pr.vy *= sp / s2; pr.vz *= sp / s2;
            }
        }
        pr.vy -= pr.grav * h;
        const mx = pr.vx * h, my = pr.vy * h, mz = pr.vz * h;
        // world
        const w = rayGrid(G, pr.x, pr.y, pr.z, mx, my, mz, 1);
        let tEnd = w ? w.t : 1;
        // actors
        let hitE = null, hitP = false;
        if (pr.owner === 'p') {
            const ra = rayActors(G, pr.x, pr.y, pr.z, mx, my, mz, tEnd, null);
            // a fat projectile: also catch near misses at the end point
            if (ra.enemy || ra.barrel) { tEnd = ra.t; hitE = ra.enemy || ra.barrel; }
            else {
                const ex = pr.x + mx * tEnd, ey = pr.y + my * tEnd, ez = pr.z + mz * tEnd;
                for (const e of G.enemies) {
                    if (e.dead) continue;
                    const rr = e.def.radius + pr.r;
                    if ((e.x - ex) ** 2 + (e.z - ez) ** 2 < rr * rr && ey > e.y - pr.r && ey < e.y + e.h + pr.r) { hitE = e; break; }
                }
            }
        } else if (pr.kind !== 'bomb') {
            const t = rayCylinder(pr.x, pr.y, pr.z, mx, my, mz, p.x, p.y, p.z, PLAYER.radius + pr.r, PLAYER.height);
            if (t >= 0 && t <= tEnd) { tEnd = t; hitP = true; }
        }
        if (pr.kind === 'bomb') {
            for (const e of G.enemies) {
                if (e.dead) continue;
                if ((e.x - pr.x) ** 2 + (e.z - pr.z) ** 2 < (e.def.radius + 0.4) ** 2 && pr.y < e.y + e.h && pr.y > e.y - 0.3) { pr.fuse = Math.min(pr.fuse, 0.05); break; }
            }
        }
        pr.x += mx * tEnd; pr.y += my * tEnd; pr.z += mz * tEnd;
        if (hitP) {
            if (pr.splash) detonate(G, pr);
            else hurtPlayer(G, pr.dmg, pr.x - pr.vx, pr.z - pr.vz);
            ev(G, 'impact', { x: pr.x, y: pr.y, z: pr.z, nx: 0, ny: 0, nz: 0, kind: pr.kind, element: pr.element, on: 'player' });
            G.proj.splice(k, 1);
            continue;
        }
        if (hitE) {
            if (hitE.def) {
                const len = Math.hypot(pr.vx, pr.vz) || 1;
                if (!pr.splash || pr.splashFrac < 1) damageEnemy(G, hitE, pr.dmg, { element: pr.element, src: 'p', dx: pr.vx / len, dz: pr.vz / len, knock: pr.dmg * 0.12, gun: pr.gun });
            } else damageBarrel(G, hitE, pr.dmg);
            if (pr.splash) detonate(G, pr);
            ev(G, 'impact', { x: pr.x, y: pr.y, z: pr.z, nx: 0, ny: 0, nz: 0, kind: pr.kind, element: pr.element, on: 'enemy' });
            if (pr.kind === 'disc' && pr.bounce > 0 && hitE.def && !hitE.dead) {
                // saw discs carve through: keep going
                pr.bounce--;
                continue;
            }
            G.proj.splice(k, 1);
            continue;
        }
        if (w) {
            if (pr.bounce > 0 || pr.kind === 'bomb') {
                // reflect off the surface we hit, nudged back out
                pr.x -= mx * 0.02; pr.y -= my * 0.02; pr.z -= mz * 0.02;
                const damp = pr.kind === 'bomb' ? 0.45 : 1;
                if (w.nx) pr.vx = -pr.vx * damp;
                if (w.nz) pr.vz = -pr.vz * damp;
                if (w.ny) { pr.vy = -pr.vy * damp; if (pr.kind === 'bomb') { pr.vx *= 0.7; pr.vz *= 0.7; } }
                if (pr.kind !== 'bomb') pr.bounce--;
                ev(G, 'impact', { x: pr.x, y: pr.y, z: pr.z, nx: w.nx, ny: w.ny, nz: w.nz, kind: pr.kind, element: pr.element, on: 'bounce' });
                continue;
            }
            if (pr.splash) detonate(G, pr);
            ev(G, 'impact', { x: pr.x, y: pr.y, z: pr.z, nx: w.nx, ny: w.ny, nz: w.nz, kind: pr.kind, element: pr.element, on: 'wall' });
            G.proj.splice(k, 1);
        }
    }
}

function detonate(G, pr) {
    if (pr.kind === 'bomb') explode(G, pr.x, pr.y + 0.3, pr.z, pr.splash, pr.dmg, 'p', null, true);
    else explode(G, pr.x, pr.y, pr.z, pr.splash, pr.dmg * pr.splashFrac, pr.owner === 'e' ? 'e' : 'p', pr.element, pr.splash >= 4, pr.gun);
}

/** Damage-over-time and status timers on every enemy. Runs in enemy time. */
export function stepStatus(G, e, dt) {
    if (e.burn > 0) { e.burn -= dt; e.dotT = (e.dotT || 0) + dt; }
    if (e.acidT > 0) { e.acidT -= dt; e.dotT = (e.dotT || 0) + dt; }
    if (e.dotT >= 0.5) {
        const lvl = 1 + 0.12 * G.level;
        const dmg = ((e.burn > 0 ? 8 : 0) + (e.acidT > 0 ? 5 : 0)) * 0.5 * lvl;
        e.dotT = 0;
        if (dmg > 0) damageEnemy(G, e, dmg, { src: 'p', element: null, knock: 0, dot: true });
    }
    if (e.cryoT > 0) { e.cryoT -= dt; if (e.cryoT <= 0 && e.cryo > 0) { e.cryo--; e.cryoT = 1.5; } }
    if (e.frozen > 0) e.frozen -= dt;
}
