// Bosses: multi-phase set-pieces. A boss owns a phase machine (data.js BOSSES), an attack state `b.act`
// and a set of telegraphed effects the walker can read and dodge: ground marks (delayed blasts), ground
// waves (jump them), sweeping beams (jump or take cover), shield pylons (destroy them), exposed cores.
// Pure: it only reads and writes G.

import { BOSSES } from './data.js';
import { addEnemy, moveBody, shoot, lob, ev, yawOf, angDiff, clamp, boom, lvOf, dropLoot, nid, enemyDef, hurtPlayer } from './core.js';

const SUMMONS = {
    gatekeeper: ['trooper', 'trooper', 'rocketeer'], strider: ['trooper', 'trooper', 'wasp'], leviathan: ['wasp', 'wasp', 'wasp'],
    titan: ['stalker', 'trooper', 'trooper'], warlord: ['stalker', 'wasp', 'wasp', 'trooper'],
};
const dm = (G, v) => v * lvOf(G).dmgScale;

export function bossOf(G) { for (const e of G.enemies) if (e.b && e.hp > 0) return e; return null; }
const addsAlive = (G, id) => G.enemies.reduce((n, q) => n + (q.hp > 0 && !q.b && q.type !== 'pylon' && q.camp < 0 ? 1 : 0), 0) + 0 * id;

function bmuz(e, up = 0.7, out = 0.9) {
    return { x: e.x + Math.sin(e.yaw) * e.r * out, y: e.y + e.h * up, z: e.z - Math.cos(e.yaw) * e.r * out };
}
function aimDir(G, from, lead = 0.5, speed = 30, scatter = 0) {
    const p = G.player, d0 = Math.hypot(p.x - from.x, p.z - from.z), tt = d0 / speed * lead;
    let dx = p.x + p.vx * tt - from.x + scatter * (G.rng() - 0.5) * d0, dz = p.z + p.vz * tt - from.z + scatter * (G.rng() - 0.5) * d0;
    const dy = p.y + G.st.eye * 0.5 - from.y;
    const l = Math.hypot(dx, dy, dz) || 1;
    return { dx: dx / l, dy: dy / l, dz: dz / l };
}
function bolt(G, e, o) {
    const m = o.m || bmuz(e);
    const a = o.dir || aimDir(G, m, o.lead ?? 0.5, o.speed || 30, o.scatter || 0);
    shoot(G, { team: 'e', kind: o.kind || 'bolt', x: m.x, y: m.y, z: m.z, dx: a.dx, dy: a.dy, dz: a.dz, speed: o.speed || 30, dmg: dm(G, o.dmg || 6), splash: o.splash || 0,
        life: o.life ?? 3, r: o.r ?? 0.4, grav: o.grav || 0, tgt: o.tgt || 0, turn: o.turn || 0, col: o.col || 0, fire: o.fire || 0 });
}
function rot(a, ang) { const c = Math.cos(ang), s = Math.sin(ang); return { dx: a.dx * c - a.dz * s, dy: a.dy, dz: a.dx * s + a.dz * c }; }

function mark(G, o) {
    G.marks.push({ id: nid(G), kind: o.kind || 'shell', x: o.x, z: o.z, r: o.r || 4, t: o.t, tmax: o.t, dmg: dm(G, o.dmg || 25), from: o.from || null, owner: o.owner || 0, type: o.type || '', col: o.col || 0 });
}
function wave(G, e, o) {
    G.waves.push({ id: nid(G), kind: o.kind || 'shock', x: e.x, z: e.z, r: 1.5, speed: o.speed || 16, max: o.max || 32, dmg: dm(G, o.dmg || 22), w: 2.4, hit: false });
}
function arenaOf(G) { return G.world.arena || { x: G.world.cx(-G.world.L + 48), z: -G.world.L + 48, r: 32 }; }

// ------------------------------------------------------------------ phases
function enterPhase(G, e, i) {
    const def = BOSSES[e.type], b = e.b, ph = def.phases[i];
    b.ph = i; b.trans = i === 0 ? 0 : 2.6; b.act = null; b.cd = 1.6; b.under = false;
    const en = ph.enter;
    if (i > 0) {
        ev(G, { type: 'bossPhase', id: e.id, ph: i, name: def.name });
        ev(G, { type: 'boom', x: e.x, y: e.y + e.h * 0.5, z: e.z, r: e.r * 2.4, size: 4, kind: 'phase' });
        ev(G, { type: 'wave', x: e.x, z: e.z, kind: 'phase' });
    }
    if (!en) return;
    if (en.say) ev(G, { type: 'radio', id: en.say });
    const A = arenaOf(G);
    if (en.summon) en.summon.forEach((t, k) => {
        const a = (k / en.summon.length) * 6.28 + 0.6, rr = e.r + 7 + (k % 2) * 4;
        mark(G, { kind: 'drop', type: t, x: e.x + Math.cos(a) * rr, z: e.z + Math.sin(a) * rr, r: 3, t: 1.6 + k * 0.25, dmg: 12, owner: e.id });
    });
    if (en.pylons) {
        b.shield = true;
        for (let k = 0; k < en.pylons; k++) {
            const a = (k / en.pylons) * 6.28 + 0.5, rr = 17;
            addEnemy(G, 'pylon', A.x + Math.cos(a) * rr, A.z + Math.sin(a) * rr, { awake: true, owner: e.id });
        }
    }
    if (en.lava) for (let k = 0; k < en.lava; k++) {
        const a = (k / en.lava) * 6.28 + 1.1 + G.rng() * 0.3, rr = 11 + G.rng() * 12;
        G.fires.push({ id: nid(G), x: A.x + Math.cos(a) * rr, z: A.z + Math.sin(a) * rr, r: 4.5 + G.rng() * 2.5, t: 1e9, dps: 20 * lvOf(G).dmgScale * 0.6, lava: true, grow: 0 });
    }
}

// ------------------------------------------------------------------ attacks
function startAtk(G, e, name) {
    const b = e.b, ph = BOSSES[e.type].phases[b.ph];
    const a = { k: name, t: 0, dur: 2, n: 0, acc: 0, f: 0 };
    switch (name) {
        case 'fan': a.dur = 1.5; break;
        case 'burst': a.dur = 1.8 + b.ph * 0.25; break;
        case 'shells': a.dur = 2.8; break;
        case 'charge': a.dur = 2.6; a.wind = 0.9; a.go = 1.0; a.speed = 24; a.melee = false; break;
        case 'lance': a.dur = 1.6; a.wind = 0.6; a.go = 0.28; a.speed = 52; a.melee = true; break;
        case 'stomp': a.dur = 2.0; break;
        case 'beam': a.dur = 3.7; a.dir = G.rng() < 0.5 ? 1 : -1; a.ang = e.yaw; a.range = 55; break;
        case 'missiles': a.dur = 2.9; break;
        case 'summon': a.dur = 1.8; break;
        case 'burrow': a.dur = 12; a.s = 0; a.chain = ph.chain || 1; break;
        case 'shards': a.dur = 1.4; break;
        case 'spit': a.dur = 1.5; break;
        case 'blizzard': a.dur = 1.4; break;
        case 'flamering': a.dur = 2.6; break;
        case 'fireballs': a.dur = 2.6; break;
        case 'orbital': a.dur = 4.4; break;
        default: a.dur = 1;
    }
    b.act = a;
    ev(G, { type: 'tele', id: e.id, k: name });
}

function pickAttack(G, e, dist) {
    const b = e.b, ph = BOSSES[e.type].phases[b.ph];
    const opts = [];
    let tot = 0;
    for (const [k, wgt] of ph.atk) {
        if (k === 'summon' && addsAlive(G, e.id) >= 5) continue;
        if (k === 'stomp' && dist > 30) continue;
        if (k === 'charge' && dist < 7) continue;
        if (k === 'blizzard' && G.storm > 0) continue;
        if (k === b.last && wgt < 3) continue;
        opts.push([k, wgt]); tot += wgt;
    }
    if (!opts.length) return 'fan';
    let r = G.rng() * tot;
    for (const [k, wgt] of opts) { r -= wgt; if (r <= 0) return k; }
    return opts[0][0];
}

function runAct(G, e, dt) {
    const b = e.b, a = b.act, p = G.player, ph = BOSSES[e.type].phases[b.ph];
    a.t += dt;
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz) || 1;
    const face = (rate = 3) => { e.yaw += clamp(angDiff(e.yaw, yawOf(dx, dz)), -rate * dt, rate * dt); };
    const done = () => { b.act = null; b.cd = ph.cd[0] + G.rng() * (ph.cd[1] - ph.cd[0]); b.last = a.k; };
    switch (a.k) {
        case 'fan': {
            face(4);
            const N = Math.min(13, 7 + b.ph * 2);
            const volley = () => {
                const base = aimDir(G, bmuz(e), 0.2, 30);
                for (let i = 0; i < N; i++) bolt(G, e, { dir: rot(base, (i - (N - 1) / 2) * 0.1), speed: 28, dmg: 7, r: 0.45, col: 0xff8844 });
                ev(G, { type: 'shot', team: 'e', kind: e.type, heavy: true, x: e.x, y: e.y + e.h * 0.7, z: e.z, id: e.id });
            };
            if (a.f < 1 && a.t >= 0.7) { a.f = 1; volley(); }
            if (b.ph >= 1 && a.f < 2 && a.t >= 1.05) { a.f = 2; volley(); }
            break;
        }
        case 'burst': {
            face(2.2);
            if (a.t > 0.3) {
                a.acc += dt;
                while (a.acc >= 0.1) { a.acc -= 0.1; bolt(G, e, { speed: 40, dmg: 4.5, scatter: 0.07, r: 0.35, col: 0xffaa33 }); }
            }
            break;
        }
        case 'shells': case 'spit': {
            face(3);
            const t0 = a.k === 'shells' ? 0.5 : 0.4;
            if (a.f < 1 && a.t >= t0) {
                a.f = 1;
                const n = a.k === 'shells' ? 3 + b.ph : 3;
                for (let i = 0; i < n; i++) {
                    const sc = i === 0 ? 0 : 7;
                    const tx = p.x + p.vx * 0.9 + (G.rng() - 0.5) * sc * 2, tz = p.z + p.vz * 0.9 + (G.rng() - 0.5) * sc * 2;
                    mark(G, { kind: 'shell', x: tx, z: tz, r: a.k === 'shells' ? 4.4 : 3.3, t: 1.25 + i * 0.3, dmg: a.k === 'shells' ? 28 : 18, from: { x: e.x, y: e.y + e.h * 0.9, z: e.z }, owner: e.id });
                }
                ev(G, { type: 'shot', team: 'e', kind: e.type, heavy: true, x: e.x, y: e.y + e.h * 0.9, z: e.z, id: e.id });
            }
            break;
        }
        case 'charge': case 'lance': {
            if (a.t < a.wind) { face(5); a.dx = dx / dist; a.dz = dz / dist; a.len = Math.min(dist + 6, a.k === 'lance' ? 16 : 60); }
            else if (a.t < a.wind + a.go) {
                e.vx = a.dx * a.speed; e.vz = a.dz * a.speed; e.yaw = yawOf(a.dx, a.dz);
                moveBody(G, e, dt, e.r * 0.8, 9, 99, false, true);
                if (!a.hit && dist < e.r + G.st.rad * 0.8 && p.y - G.world.h(p.x, p.z) < 2.5) {
                    a.hit = 1; hurtPlayer(G, dm(G, a.k === 'lance' ? 34 : 30), e.x, e.z); p.vx += a.dx * 9; p.vz += a.dz * 9;
                    ev(G, { type: 'smash', x: p.x, z: p.z });
                }
            } else {
                e.vx = e.vz = 0;
                if (!a.end) {
                    a.end = 1;
                    if (a.melee && dist < e.r + 6.5 && p.y - G.world.h(p.x, p.z) < 2.5) { hurtPlayer(G, dm(G, 30), e.x, e.z); p.vx += dx / dist * 12; p.vz += dz / dist * 12; }
                    wave(G, e, { speed: 14, max: 14, dmg: 14 });
                    ev(G, { type: 'stomp', x: e.x, z: e.z, r: 8 });
                }
                if (a.t > a.wind + a.go + 0.6) done();
            }
            break;
        }
        case 'stomp': {
            face(2);
            const hit = () => { wave(G, e, { speed: 17, max: 36, dmg: 24 }); ev(G, { type: 'stomp', x: e.x, z: e.z, r: 10 }); boom(G, e.x, e.y, e.z, e.r + 2.5, dm(G, 16), 'e', { quiet: true, size: 1 }); };
            if (a.f < 1 && a.t >= 0.8) { a.f = 1; hit(); }
            if (b.ph >= 1 && a.f < 2 && a.t >= 1.35) { a.f = 2; hit(); }
            break;
        }
        case 'beam': {
            const t0 = 0.9, sweep = 2.4;
            if (a.t < t0) { face(3); a.ang = yawOf(dx, dz) - 0.9 * a.dir; a.mid = yawOf(dx, dz); e.yaw = a.ang; }
            else if (a.t < t0 + sweep) {
                const u = (a.t - t0) / sweep;
                a.ang = a.mid + (-0.9 + 1.8 * u) * a.dir;
                e.yaw = a.ang;
                a.on = 1;
                const m = bmuz(e, 0.72, 0.9);
                const bearing = yawOf(p.x - m.x, p.z - m.z), pd = Math.hypot(p.x - m.x, p.z - m.z);
                const low = p.y - G.world.h(p.x, p.z) < 1.5;
                if (low && pd < a.range && Math.abs(angDiff(a.ang, bearing)) < 0.06 + G.st.rad / Math.max(6, pd) && !beamBlocked(G, m, p)) {
                    a.hurt = (a.hurt || 0) + dt * dm(G, 42);
                    if (a.hurt >= 4) { hurtPlayer(G, a.hurt, m.x, m.z); a.hurt = 0; }
                }
            } else { a.on = 0; if (a.t >= a.dur) done(); }
            break;
        }
        case 'missiles': {
            face(3);
            const n = Math.min(12, 6 + b.ph * 2);
            if (a.t >= 0.6) {
                a.acc += dt;
                while (a.acc >= 0.12 && a.n < n) {
                    a.acc -= 0.12; a.n++;
                    const ang = (a.n % 2 ? 1 : -1) * (0.3 + 0.1 * (a.n % 4));
                    const d0 = aimDir(G, bmuz(e, 0.85), 0, 20);
                    bolt(G, e, { kind: 'emissile', m: bmuz(e, 0.9, 0.3), dir: rot({ dx: d0.dx, dy: 0.65, dz: d0.dz }, ang), speed: 22, dmg: 12, splash: 2.8, life: 5, r: 0.4, turn: 1.7, tgt: -1 });
                }
            }
            break;
        }
        case 'summon': {
            face(2);
            if (a.f < 1 && a.t >= 0.8) {
                a.f = 1;
                const list = SUMMONS[e.type];
                const k = Math.min(list.length, 2 + b.ph);
                for (let i = 0; i < k; i++) {
                    const ang = G.rng() * 6.28, rr = e.r + 6 + G.rng() * 6;
                    mark(G, { kind: 'drop', type: list[i % list.length], x: e.x + Math.cos(ang) * rr, z: e.z + Math.sin(ang) * rr, r: 3, t: 1.4 + i * 0.2, dmg: 10, owner: e.id });
                }
            }
            break;
        }
        case 'burrow': {
            const sp = ph.spd * 3;
            if (a.s === 0) {                                     // dive
                if (a.t >= 0.8) { a.s = 1; a.t = 0; b.under = true; ev(G, { type: 'dive', x: e.x, z: e.z, id: e.id }); }
            } else if (a.s === 1) {                              // travel underground toward the walker
                const tx = p.x + p.vx * 0.4, tz = p.z + p.vz * 0.4, d = Math.hypot(tx - e.x, tz - e.z) || 1;
                e.vx = (tx - e.x) / d * sp; e.vz = (tz - e.z) / d * sp;
                e.yaw = yawOf(e.vx, e.vz);
                moveBody(G, e, dt, 1, 9, 99, false, true);
                a.acc += dt;
                if (a.acc > 0.4) { a.acc = 0; ev(G, { type: 'tremor', x: e.x, z: e.z }); }
                if ((a.chain < (ph.chain || 1) ? a.t >= 0.5 : a.t >= 1.5) || d < 3) {
                    a.s = 2; a.t = 0;
                    mark(G, { kind: 'erupt', x: p.x + p.vx * 0.5, z: p.z + p.vz * 0.5, r: 6.5, t: 0.95, dmg: 36, owner: e.id });
                    e.x = p.x + p.vx * 0.5; e.z = p.z + p.vz * 0.5;
                    e.vx = e.vz = 0;
                }
            } else if (a.s === 2) {                              // marker on the ground; the erupt mark surfaces us
                if (!b.under) {
                    a.chain--;
                    if (a.chain > 0) { a.s = 1; a.t = 0; a.acc = 0; b.under = true; b.stun = 0; }
                    else { b.stun = 1.8; done(); }
                }
            }
            break;
        }
        case 'shards': {
            face(4);
            if (a.f < 1 && a.t >= 0.5) {
                a.f = 1;
                const N = b.ph === 0 ? 9 : b.ph === 1 ? 13 : 20;
                const base = aimDir(G, bmuz(e, 0.6), 0.3, 26);
                for (let i = 0; i < N; i++) {
                    const ang = b.ph === 2 ? (i / N) * 6.28 : (i - (N - 1) / 2) * 0.09;
                    bolt(G, e, { kind: 'shard', m: bmuz(e, 0.55, 0.6), dir: b.ph === 2 ? rot({ dx: base.dx, dy: 0, dz: base.dz }, ang) : rot(base, ang), speed: 26, dmg: 8, r: 0.4, life: 2.6 });
                }
            }
            break;
        }
        case 'blizzard': {
            if (a.f < 1 && a.t >= 0.5) { a.f = 1; G.storm = 7; ev(G, { type: 'storm', on: 1 }); }
            break;
        }
        case 'flamering': {
            face(2);
            const T = [0.8, 1.3, 1.8];
            T.forEach((t, i) => { if (a.f <= i && a.t >= t) { a.f = i + 1; wave(G, e, { kind: 'fire', speed: 13, max: 32, dmg: 18 }); ev(G, { type: 'stomp', x: e.x, z: e.z, r: 8, fire: 1 }); } });
            if (a.f === 3 && !a.pat) {
                a.pat = 1;
                for (let i = 0; i < 6; i++) { const ang = (i / 6) * 6.28, rr = e.r + 6; G.fires.push({ id: nid(G), x: e.x + Math.cos(ang) * rr, z: e.z + Math.sin(ang) * rr, r: 2.6, t: 6, dps: dm(G, 8) * 0.8, lava: false, grow: 0 }); }
            }
            break;
        }
        case 'fireballs': {
            face(3);
            const n = 4 + b.ph;
            if (a.t >= 0.5) {
                a.acc += dt;
                while (a.acc >= 0.3 && a.n < n) {
                    a.acc -= 0.3; a.n++;
                    const m = bmuz(e, 0.9, 0.5);
                    const tx = p.x + p.vx * 0.9 + (G.rng() - 0.5) * 12, tz = p.z + p.vz * 0.9 + (G.rng() - 0.5) * 12;
                    const l = lob(m.x, m.y, m.z, tx, G.world.h(tx, tz) + 0.5, tz, 20, 14);
                    bolt(G, e, { kind: 'fireball', m, dir: l, speed: l.speed, dmg: 22, splash: 3.6, life: l.T + 1.5, r: 0.7, grav: 14, fire: 1 });
                }
            }
            break;
        }
        case 'orbital': {
            face(1.5);
            if (a.t >= 0.5) {
                a.acc += dt;
                while (a.acc >= 0.26) {
                    a.acc -= 0.26; a.n++;
                    const direct = a.n % 4 === 1;
                    const tx = p.x + (direct ? p.vx * 0.9 : (G.rng() - 0.5) * 16), tz = p.z + (direct ? p.vz * 0.9 : (G.rng() - 0.5) * 16);
                    mark(G, { kind: 'orbital', x: tx, z: tz, r: 3.4, t: 1.0, dmg: 24, owner: e.id });
                }
            }
            break;
        }
        default: done();
    }
    if (b.act === a && a.t >= a.dur && a.k !== 'burrow') done();
}

function beamBlocked(G, m, p) {
    const w = G.world, steps = 8;
    for (let i = 1; i < steps; i++) {
        const x = m.x + (p.x - m.x) * i / steps, z = m.z + (p.z - m.z) * i / steps;
        for (const bk of w.near(x, z)) if (bk.h > 3 && Math.hypot(bk.x - x, bk.z - z) < bk.r) return true;
    }
    return false;
}

// ------------------------------------------------------------------ marks (delayed blasts) shared with the game loop
export function detonateMark(G, m) {
    const w = G.world, y = w.h(m.x, m.z);
    switch (m.kind) {
        case 'drop': {
            ev(G, { type: 'drop', x: m.x, z: m.z, utype: m.type });
            boom(G, m.x, y, m.z, 4, m.dmg, 'e', { size: 2, kind: 'drop' });
            addEnemy(G, m.type, m.x, m.z, { awake: true });
            break;
        }
        case 'erupt': {
            boom(G, m.x, y, m.z, m.r, m.dmg, 'e', { size: 3, kind: 'erupt', crater: true });
            const e = G.enemies.find((q) => q.id === m.owner);
            if (e && e.b) {
                e.b.under = false; e.x = m.x; e.z = m.z; e.y = y;
                ev(G, { type: 'erupt', x: m.x, z: m.z, id: e.id });
                for (let i = 0; i < 10; i++) bolt(G, e, { kind: 'shard', m: { x: m.x, y: y + 1, z: m.z }, dir: { dx: Math.cos(i * 0.628), dy: 0.1, dz: Math.sin(i * 0.628) }, speed: 22, dmg: 8, r: 0.4, life: 2 });
            }
            break;
        }
        default:
            boom(G, m.x, y, m.z, m.r, m.dmg, 'e', { size: m.r > 4 ? 3 : 2, kind: m.kind, crater: true });
    }
}

// ------------------------------------------------------------------ the boss step
export function updateBoss(G, e, dt) {
    const def = BOSSES[e.type], b = e.b, p = G.player, w = G.world;
    e.flash = Math.max(0, e.flash - dt);
    e.t += dt;
    const A = arenaOf(G);
    const gy = w.h(e.x, e.z);
    e.y += (gy - e.y) * Math.min(1, 10 * dt);
    if (e.type === 'leviathan') followSegs(e, b, dt);

    if (b.dying > 0) {
        b.dying -= dt; b.dieT = (b.dieT || 0) - dt;
        if (b.dieT <= 0) {
            b.dieT = 0.13;
            const a = G.rng() * 6.28, rr = G.rng() * e.r;
            ev(G, { type: 'boom', x: e.x + Math.cos(a) * rr, y: e.y + G.rng() * e.h, z: e.z + Math.sin(a) * rr, r: 4, size: G.rng() < 0.3 ? 3 : 2, kind: 'dying' });
        }
        if (b.dying <= 0) {
            e.hp = 0; e.dead = 1;
            ev(G, { type: 'boom', x: e.x, y: e.y + e.h * 0.5, z: e.z, r: e.r * 3, size: 5, big: true, kind: 'bossfinal' });
            dropLoot(G, e.x, e.z, def.scrap, { big: true, heavy: true });
            G.kills++; G.stat.kills++; G.score += def.scrap * 12;
            G.bossDone = true;
            ev(G, { type: 'gateOpen' });
            ev(G, { type: 'radio', id: 'bossdown' });
        }
        return;
    }
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz) || 1;
    if (!e.awake) {
        if (Math.hypot(p.x - A.x, p.z - A.z) < A.r + 32 || dist < 75) {
            e.awake = true; G.bossActive = true;
            ev(G, { type: 'bossStart', id: e.id, name: def.name, title: def.title });
            ev(G, { type: 'radio', id: `${lvLevelId(G)}.boss` });
            enterPhase(G, e, 0);
        } else return;
    }
    const frac = e.hp / e.maxhp;
    let tp = 0;
    def.phases.forEach((ph, i) => { if (frac <= ph.at) tp = i; });
    if (tp > b.ph) enterPhase(G, e, tp);

    let pl = 0;
    for (const q of G.enemies) if (q.type === 'pylon' && q.hp > 0 && q.owner === e.id) pl++;
    b.pylons = pl;
    if (b.shield && pl === 0) { b.shield = false; b.stun = 3; ev(G, { type: 'shieldDown', id: e.id }); }

    b.trans = Math.max(0, b.trans - dt);
    if (b.trans > 0) { e.yaw += clamp(angDiff(e.yaw, yawOf(dx, dz)), -1.5 * dt, 1.5 * dt); return; }
    if (b.stun > 0) { b.stun -= dt; b.act = null; return; }
    const ph = def.phases[b.ph];
    if (G.storm > 0) { G.stormT = (G.stormT || 0) - dt; }

    if (b.act) { runAct(G, e, dt); }
    if (!b.act || b.act.k === 'beam') {
        // reposition: hold a comfortable range, circling
        if (!b.act) e.yaw += clamp(angDiff(e.yaw, yawOf(dx, dz)), -2.4 * dt, 2.4 * dt);
        if (!b.act) {
            const pr = e.r + 15 + b.ph * 1.5;
            const sx = -dz / dist, sz = dx / dist;
            let gx = 0, gz = 0;
            if (dist > pr + 5) { gx = dx / dist; gz = dz / dist; } else if (dist < pr - 5) { gx = -dx / dist; gz = -dz / dist; }
            gx += sx * 0.5 * (e.dir || 1); gz += sz * 0.5 * (e.dir || 1);
            if (e.t % 5 < dt) e.dir = -(e.dir || 1);
            const l = Math.hypot(gx, gz) || 1, s = ph.spd;
            e.vx += clamp(gx / l * s - e.vx, -14 * dt, 14 * dt); e.vz += clamp(gz / l * s - e.vz, -14 * dt, 14 * dt);
            moveBody(G, e, dt, e.r * 0.8, 9, 99, false, true);
            // stay near the arena
            const ad = Math.hypot(e.x - A.x, e.z - A.z);
            if (ad > A.r + 6) { e.x = A.x + (e.x - A.x) / ad * (A.r + 6); e.z = A.z + (e.z - A.z) / ad * (A.r + 6); }
        }
        if (!b.act) {
            b.cd -= dt;
            if (b.cd <= 0) startAtk(G, e, pickAttack(G, e, dist));
        }
    }
}

function lvLevelId(G) { return ['ruin', 'fen', 'rift', 'ice', 'cinder', 'hive'][G.level]; }

function followSegs(e, b, dt) {
    const N = 9, sp = 3.3;
    if (!b.segs.length) for (let i = 0; i < N; i++) b.segs.push({ x: e.x, z: e.z + (i + 1) * sp * 0.2 });
    let px = e.x, pz = e.z;
    for (const s of b.segs) {
        const dx = s.x - px, dz = s.z - pz, d = Math.hypot(dx, dz) || 1;
        if (d > sp) { s.x = px + dx / d * sp; s.z = pz + dz / d * sp; }
        px = s.x; pz = s.z;
    }
    void dt;
}
void enemyDef;

export { startAtk as startAttack };
