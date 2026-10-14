// An auto-player. It plays through the same input the player uses, so the tests, the balance table
// and the title-screen attract mode all exercise the real rules. Pure, like the rest of js/sim.
//
// skill 1: fast turning, good aim, uses everything. skill 0.6: slower, sloppier, a bit reckless.

import { PLAYER, STEP_UP, FURY, STEP } from '../config.js';
import { makeRng } from '../rng.js';
import { cellAt, cellX, cellZ, los } from './world.js';
import { NO_INPUT, canTake, freeSlot } from './player.js';

const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, rng: makeRng(seed), field: null, goal: -1, fieldT: 0, stuckT: 0, lx: 0, lz: 0, unstick: 0, ux: 0, uz: 0, strafe: 1, strafeT: 0, target: -1, scanT: 0, swapT: 0, bombT: 3, jitter: 0, done: new Set() };
}

/** Bot BFS: walls block; doors pass if we hold the key and they aren't locked. */
function botField(G, goal) {
    const L = G.L, p = G.player;
    const d = new Int16Array(L.N).fill(-1);
    if (goal < 0) return d;
    const pass = (i) => {
        if (L.solid[i]) return false;
        const dr = L.door[i];
        if (dr >= 0 && (G.doorLock[dr] || !(p.keys & (1 << L.doors[dr].key))) && G.doorOpen[dr] < 0.9) return false;
        return L.ceil[i] - L.floor[i] >= 2;
    };
    const q = new Int32Array(L.N);
    let h = 0, t = 0;
    q[t++] = goal; d[goal] = 0;
    while (h < t) {
        const i = q[h++], x = i % L.W, y = (i / L.W) | 0;
        for (const [ox, oy] of DIR8) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
            const j = ny * L.W + nx;
            if (d[j] >= 0 || !pass(j)) continue;
            // corners: both orthogonal cells must be walkable and dry, the same rule nextCell() follows
            if (ox && oy && (!pass(y * L.W + nx) || !pass(ny * L.W + x) || L.liquid[y * L.W + nx] || L.liquid[ny * L.W + x])) continue;
            if (L.floor[i] - L.floor[j] > STEP_UP + 1e-4) continue;
            if (ox && oy && (L.floor[y * L.W + nx] - L.floor[j] > STEP_UP || L.floor[ny * L.W + x] - L.floor[j] > STEP_UP)) continue;
            if (L.liquid[i] && !L.liquid[j] && L.floor[j] > L.floor[i]) continue;   // j → i: don't route down into pits
            d[j] = d[i] + 1;
            q[t++] = j;
        }
    }
    return d;
}

function angleTo(p, x, y, z) {
    const dx = x - p.x, dz = z - p.z, dy = y - (p.y + PLAYER.eye);
    return { yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), dist: Math.hypot(dx, dy, dz) };
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function botInput(G, bot) {
    const inp = { ...NO_INPUT };
    if (G.phase !== 'play') return inp;
    const p = G.player, L = G.L, r = bot.rng;
    const dt = STEP;

    // ------------------------------------------------------------ pick a target
    bot.scanT -= dt;
    let tgt = G.enemies.find((e) => e.id === bot.target && !e.dead);
    if (bot.scanT <= 0) {
        bot.scanT = 0.12 + (1 - bot.skill) * 0.25;
        let best = null, bs = Infinity;
        const boss = G.enemies.find((e) => e.boss && !e.pylon && !e.dead);
        for (const e of G.enemies) {
            if (e.dead) continue;
            const d = Math.hypot(e.x - p.x, e.z - p.z);
            if (d > 48) continue;
            if (!los(G, p.x, p.y + PLAYER.eye, p.z, e.x, e.y + e.h * 0.6, e.z)) continue;
            let s = d;
            if (boss && boss.invuln && e.pylon) s -= 30;
            if (boss && boss.invuln && e === boss) s += 1000;
            if (e.boss && !e.pylon && !e.invuln) s -= 8;
            if (e.def.attack?.kind === 'leap' || e.def.attack?.kind === 'charge') s -= 6;   // the close threats first
            if (s < bs) { bs = s; best = e; }
        }
        tgt = best;
        bot.target = best ? best.id : -1;
    }

    // ------------------------------------------------------------ weapon choice
    const near = tgt ? Math.hypot(tgt.x - p.x, tgt.z - p.z) : 99;
    let bestSlot = p.cur, bestV = -1;
    p.weapons.forEach((g, k) => {
        const ammo = g.clip + (p.ammo[g.ammo] || 0);
        if (ammo < g.ammoPer) return;
        let v = g.dps;
        if ((g.splash >= 3 && g.splashFrac >= 1) && near < 6) v *= 0.1;           // don't rocket your own feet
        if (g.kind === 'beam' && near > g.range) v *= 0.2;
        if (g.arch === 'shotgun' && near > 20) v *= 0.5;
        if (k === p.cur) v *= 1.15;                                                 // don't dither
        if (v > bestV) { bestV = v; bestSlot = k; }
    });
    if (bestSlot !== p.cur && p.switchT <= 0) inp.slot = bestSlot;
    const gun = p.weapons[bestSlot];

    // ------------------------------------------------------------ aim and fire
    let wantYaw = null, wantPitch = 0;
    if (tgt) {
        let tx = tgt.x, ty = tgt.y + tgt.h * 0.55, tz = tgt.z;
        if (gun && gun.kind === 'proj' && gun.speed) {
            const t = Math.hypot(tx - p.x, tz - p.z) / gun.speed;
            tx += tgt.vx * t * 0.8; tz += tgt.vz * t * 0.8;
        }
        const a = angleTo(p, tx, ty, tz);
        bot.jitter += (r() - 0.5) * 0.05 * (1.4 - bot.skill);
        bot.jitter *= 0.97;
        wantYaw = a.yaw + bot.jitter;
        wantPitch = a.pitch + bot.jitter * 0.4;
        const dy = wrap(wantYaw - p.yaw), dp = wantPitch - p.pitch;
        const tol = Math.max(0.03, Math.atan2(tgt.def.radius * 1.1, a.dist));
        if (Math.abs(dy) < tol * 1.5 && Math.abs(dp) < tol * 2 + 0.05) inp.fire = true;
        if (near < 2.3 && p.kickT <= 0 && !tgt.boss) inp.kick = true;
    }
    const turn = (5 + 9 * bot.skill) * dt;
    if (wantYaw === null) {
        // look where we're going
        if (bot.ux || bot.uz) { wantYaw = Math.atan2(bot.ux, -bot.uz); wantPitch = 0; }
        else wantYaw = p.yaw;
    }
    const dyaw = wrap(wantYaw - p.yaw);
    inp.dyaw = Math.max(-turn, Math.min(turn, dyaw));
    inp.dpitch = Math.max(-turn, Math.min(turn, wantPitch - p.pitch));

    // ------------------------------------------------------------ objective path
    const goal = G.objective?.cell ?? -1;
    bot.fieldT -= dt;
    if (goal !== bot.goal || bot.fieldT <= 0 || !bot.field) {
        bot.goal = goal; bot.fieldT = 1.5;
        bot.field = botField(G, goal);
    }
    let mx = 0, mz = 0;
    const c = cellAt(L, p.x, p.z);
    // detour for health when hurt, and for anything good within a few metres
    let detour = null;
    if (p.hp < 55 || near > 30 || !tgt) {
        let bd = p.hp < 55 ? 15 : 7;
        for (const pk of G.pickups) {
            if (pk.kind === 'key' || bot.done.has(pk.id)) continue;
            const better = pk.kind === 'gun' && pk.gun.dps > Math.min(...p.weapons.filter((g) => !g.infinite).map((g) => g.dps)) * 1.2;
            if (!canTake(G, pk) && !better) continue;
            if (Math.abs(pk.y - p.y) > 0.8) continue;
            const d = Math.hypot(pk.x - p.x, pk.z - p.z);
            if (d < bd && (p.hp < 55 ? ['cola', 'burger', 'vest'].includes(pk.kind) : true) && los(G, p.x, p.y + 1, p.z, pk.x, pk.y + 0.5, pk.z)) { bd = d; detour = pk; }
        }
    }
    if (detour) { mx = detour.x - p.x; mz = detour.z - p.z; }
    else if (G.objective?.kind === 'boss' || G.objective?.kind === 'ambush') {
        // in the arena: circle the target at a sensible range
        if (tgt) {
            const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz) || 1;
            const want = tgt.boss ? 11 : 7;
            const radial = d > want + 2 ? 1 : d < want - 2 ? -1 : 0;
            mx = dx / d * radial - dz / d * bot.strafe * 0.8;
            mz = dz / d * radial + dx / d * bot.strafe * 0.8;
        } else if (c >= 0 && bot.field[c] > 0) {
            const nx = nextCell(G, bot.field, c);
            if (nx >= 0) { mx = cellX(L, nx) - p.x; mz = cellZ(L, nx) - p.z; }
        }
    } else if (c >= 0 && bot.field[c] > 0) {
        const nx = nextCell(G, bot.field, c);
        if (nx >= 0) {
            // aim two cells ahead when it's a straight line, for smoother paths
            const n2 = nextCell(G, bot.field, nx);
            const tx = n2 >= 0 && clearWalk(G, bot.field, p.x, p.z, cellX(L, n2), cellZ(L, n2)) ? n2 : nx;
            mx = cellX(L, tx) - p.x; mz = cellZ(L, tx) - p.z;
        }
    } else if (c >= 0 && bot.field[c] === 0) {
        mx = cellX(L, c) - p.x; mz = cellZ(L, c) - p.z;
    } else if (c >= 0 && bot.field[c] < 0) {
        // off the map of the field (in a pit, on a crate): head for the nearest cell that's on it
        let best = -1, bd = 1e9;
        const x = c % L.W, y = (c / L.W) | 0;
        for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
            const j = (y + oy) * L.W + (x + ox);
            if (j < 0 || j >= L.N || bot.field[j] < 0) continue;
            const dd = ox * ox + oy * oy;
            if (dd < bd) { bd = dd; best = j; }
        }
        if (best >= 0) { mx = cellX(L, best) - p.x; mz = cellZ(L, best) - p.z; bot.unstick = Math.max(bot.unstick, 0.3); }
    }
    // dodge sideways while shooting
    bot.strafeT -= dt;
    if (bot.strafeT <= 0) { bot.strafeT = 0.6 + r() * 1.2; bot.strafe = r() < 0.5 ? -1 : 1; }
    if (tgt && !detour && G.objective?.kind !== 'boss' && near < 25) {
        const dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz) || 1;
        const l0 = Math.hypot(mx, mz) || 1;
        mx = mx / l0 - dz / d * bot.strafe * 0.6;
        mz = mz / l0 + dx / d * bot.strafe * 0.6;
        // melee monsters: back away while shooting
        if (near < 6 && tgt.def.attack && ['leap', 'charge'].includes(tgt.def.attack.kind)) { mx -= dx / d; mz -= dz / d; }
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 1e-3) { mx /= ml; mz /= ml; }
    bot.ux = mx; bot.uz = mz;

    // ------------------------------------------------------------ stuck?
    bot.stuckT += dt;
    if (bot.stuckT > 1.2) {
        const moved = Math.hypot(p.x - bot.lx, p.z - bot.lz);
        if (moved < 0.8 && ml > 1e-3) { bot.unstick = 0.8; bot.uAng = r() * Math.PI * 2; bot.fieldT = 0; }
        bot.stuckT = 0; bot.lx = p.x; bot.lz = p.z;
    }
    if (bot.unstick > 0) {
        bot.unstick -= dt;
        inp.jump = true;
        if (bot.uAng !== undefined && bot.unstick > 0.4) { mx = mx * 0.5 + Math.sin(bot.uAng) * 0.5; mz = mz * 0.5 - Math.cos(bot.uAng) * 0.5; }
    }

    // local move from the world direction
    const s = Math.sin(p.yaw), co = Math.cos(p.yaw);
    inp.mx = mx * co + mz * s;
    inp.my = mx * s - mz * co;

    // ------------------------------------------------------------ hazards: shockwaves and the beam
    for (const w of G.waves) {
        const d = Math.hypot(p.x - w.x, p.z - w.z);
        if (d - w.r > 0 && d - w.r < 2.2 && p.ground) inp.jump = true;
    }
    const boss = G.enemies.find((e) => e.boss === 'rourke' && !e.dead);
    if (boss?.beamOn) {
        const pa = Math.atan2(p.x - boss.cx, p.z - boss.cz);
        const da = wrap(pa - boss.beamA) * (boss.beamDir || 1);
        if (da > -0.05 && da < 0.6 && bot.skill > 0.5) inp.jump = true;
    }

    // ------------------------------------------------------------ the rest
    if (p.fury >= FURY.max && p.overdrive <= 0) {
        const n = G.enemies.filter((e) => !e.dead && e.alert && Math.hypot(e.x - p.x, e.z - p.z) < 25).length;
        if (n >= 3 || G.objective?.kind === 'boss') inp.over = true;
    }
    bot.bombT -= dt;
    if (bot.bombT <= 0 && p.bombs > 0 && tgt && near > 7 && near < 20) {
        const cluster = G.enemies.filter((e) => !e.dead && Math.hypot(e.x - tgt.x, e.z - tgt.z) < 4).length;
        if (cluster >= 3 || tgt.boss) { inp.bomb = true; bot.bombT = 3; }
    }
    // swap for a better gun on the floor
    bot.swapT -= dt;
    if (p.nearGun >= 0 && !freeSlot(p) && bot.swapT <= 0 && !tgt) {
        const pk = G.pickups.find((q) => q.id === p.nearGun);
        let worst = -1;
        p.weapons.forEach((g, k) => { if (!g.infinite && (worst < 0 || g.dps < p.weapons[worst].dps)) worst = k; });
        if (pk && !bot.done.has(pk.id) && pk.gun.dps > p.weapons[worst].dps * 1.2) {
            if (p.cur !== worst) inp.slot = worst;
            else if (p.switchT <= 0) { inp.use = true; bot.swapT = 1; bot.done.add(pk.id); }
        }
    }
    if (gun && gun.clip === 0 && !tgt) inp.reload = true;
    return inp;
}

/** A straight walk that stays on the field and out of liquid (line of sight passes over pits). */
function clearWalk(G, field, x0, z0, x1, z1) {
    const L = G.L;
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5);
    for (let k = 1; k <= n; k++) {
        const t = k / n;
        for (const o of [-0.45, 0.45]) {
            const dx = z1 - z0, dz = x0 - x1, l = Math.hypot(dx, dz) || 1;
            const c = cellAt(L, x0 + (x1 - x0) * t + dx / l * o, z0 + (z1 - z0) * t + dz / l * o);
            if (c < 0 || field[c] < 0 || L.liquid[c] || L.crate[c]) return false;
        }
    }
    return true;
}

function nextCell(G, field, i) {
    const L = G.L;
    const x = i % L.W, y = (i / L.W) | 0;
    let best = -1, bd = field[i];
    for (const [ox, oy] of DIR8) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
        const j = ny * L.W + nx;
        if (field[j] < 0 || field[j] >= bd) continue;
        if (ox && oy && (field[y * L.W + nx] < 0 || field[ny * L.W + x] < 0)) continue;
        bd = field[j]; best = j;
    }
    return best;
}
