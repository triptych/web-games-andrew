// A drop to the surface: you are the bot. Walk, look, strike, shoot, gather, dodge hazards, find VESPER's black
// boxes, and come home on the beacon before the battery dies. Pure; G.mission is plain JSON and saves mid-fight.

import { ZONES, ENEMIES, ENEMY_SPECIES, RES } from './data.js';
import { MAP, BEACON, BOT, MISSION_DAY_SEC, REPAIR_DAYS } from '../config.js';
import { makeEnemy } from './zonegen.js';
import { sampleNeed } from './genetics.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
export const fwd = (yaw) => ({ x: Math.sin(yaw), y: -Math.cos(yaw) });

/** The bot's numbers from its generation, upgrades and research. */
export function botStats(G) {
    const g = G.bot.gen, L = G.bot.lv, d = G.research.done;
    return {
        gen: g,
        hpMax: Math.round((50 + 35 * g) * (1 + 0.12 * L.hull) * (d.m1 ? 1.2 : 1)),
        enMax: Math.round((80 + 18 * g) * (1 + 0.1 * L.cell)),
        speed: (3.6 + 0.3 * g) * (1 + 0.05 * L.drive) * (d.m3 ? 1.12 : 1),
        cargo: 14 + 7 * g + 3 * L.hold,
        dmg: (8 + 5 * g) * (1 + 0.12 * L.edge),
        shot: g >= 1 ? (5 + 3.5 * g) * (1 + 0.12 * L.edge) : 0,
        gather: (1 + 0.3 * g) * (1 + 0.14 * L.drill),
        recall: !!d.a6,
    };
}

export function startMission(G, M) {
    const S = botStats(G);
    const zr = ZONES[M.zone].req;
    Object.assign(M, {
        t: 0, phase: 'run', shots: [], slams: [], nextShot: 1,
        S, resist: clamp(0.25 + 0.2 * (S.gen - zr), 0, 0.8),
        p: { x: BEACON.x, y: BEACON.y - 0.5, yaw: 0, hp: S.hpMax, en: S.enMax, cargo: { metal: 0, mineral: 0, flora: 0, fauna: 0 }, carry: 0,
            strikeCd: 0, shotCd: 0, gatherId: 0, extract: 0, recall: 0, hurt: 0, limp: false, swing: 0, fullT: 0 },
        got: { samples: {}, echo: false, kills: 0, units: 0 },
    });
    G.mission = M;
}

const emit = (G, e) => G.events.push(e);

function addCargo(M, kind, n) {
    const room = M.S.cargo - M.p.carry;
    const take = Math.max(0, Math.min(room, n));
    M.p.cargo[kind] += take; M.p.carry += take; M.got.units += take;
    return take;
}
function addSample(G, M, sp) {
    G.samples[sp] = (G.samples[sp] || 0) + 1;
    M.got.samples[sp] = (M.got.samples[sp] || 0) + 1;
    emit(G, { type: 'sample', species: sp, n: G.samples[sp] });
    if (G.samples[sp] === sampleNeed(G, sp)) { emit(G, { type: 'sequenced', species: sp }); G.queue.push('first_sequence'); }
}

function hurtPlayer(G, M, dmg, src) {
    const p = M.p;
    if (M.phase !== 'run' || dmg <= 0) return;
    p.hp -= dmg; p.hurt = 0.35; p.recall = 0;
    emit(G, { type: 'hurt', dmg, src });
}

/** Solid scenery pushes a circle out. Flyers skip this. */
function collide(M, o, r) {
    for (const pr of M.props) {
        if (!pr.r) continue;
        const dx = o.x - pr.x, dy = o.y - pr.y, d = Math.hypot(dx, dy), m = pr.r + r;
        if (d < m && d > 1e-6) { o.x = pr.x + dx / d * m; o.y = pr.y + dy / d * m; }
    }
    const H = MAP.half - 1;
    o.x = clamp(o.x, -H + r, H - r); o.y = clamp(o.y, -H + r, H - r);
}

/** The enemy a strike or shot goes to: inside the arc, nearest first (aim assist, so touch play works). */
function pickTarget(M, range, arc) {
    const p = M.p;
    let best = null, bs = Infinity;
    for (const e of M.enemies) {
        if (!e.alive) continue;
        const R = ENEMIES[e.type].r;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d - R > range) continue;
        const a = Math.abs(angDiff(Math.atan2(dx, -dy), p.yaw));
        if (a > arc && d > R + 0.6) continue;
        const s = d + a * 2;
        if (s < bs) { bs = s; best = e; }
    }
    return best;
}

function damageEnemy(G, M, e, dmg, how) {
    const E = ENEMIES[e.type];
    e.hp -= dmg; e.hurt = 0.22; e.provoked = true;
    if (e.st === 'idle') e.st = 'chase';
    if (!E.boss) {
        const dx = e.x - M.p.x, dy = e.y - M.p.y, d = Math.hypot(dx, dy) || 1;
        e.x += dx / d * (how === 'strike' ? 0.5 : 0.25); e.y += dy / d * (how === 'strike' ? 0.5 : 0.25);
    }
    emit(G, { type: 'hit', id: e.id, dmg: Math.round(dmg), x: e.x, y: e.y, how });
    if (e.hp <= 0) killEnemy(G, M, e);
}

function killEnemy(G, M, e) {
    const E = ENEMIES[e.type];
    e.alive = false; e.hp = 0;
    M.got.kills++;
    G.stats.kills++;
    const first = !G.kills[e.type];
    G.kills[e.type] = (G.kills[e.type] || 0) + 1;
    const units = G.rng.int(E.fauna[0], E.fauna[1]);
    const took = addCargo(M, 'fauna', units);
    const sp = ENEMY_SPECIES[e.type];
    if (sp && (first || G.rng() < 0.55)) addSample(G, M, sp);
    emit(G, { type: 'kill', id: e.id, kind: e.type, x: e.x, y: e.y, units: took });
    if (E.boss) {
        G.zones[M.zone].boss = true;
        M.shots.length = 0; M.slams.length = 0;
        for (const o of M.enemies) if (o.alive) { o.passive = true; o.provoked = false; o.st = 'idle'; }
        M.phase = 'choice';
        emit(G, { type: 'bossDown' });
        G.queue.push('boss_down');
    }
}

function fireShot(G, M, from, x, y, dx, dy, speed, dmg, life, kind) {
    const d = Math.hypot(dx, dy) || 1;
    M.shots.push({ id: M.nextShot++, from, kind, x, y, vx: dx / d * speed, vy: dy / d * speed, dmg, life });
}

/** One fixed step on the planet. inp = { x strafe, y forward, turn (radians), a strike, b gather/use, c shoot, r recall }. */
export function missionStep(G, inp, dt) {
    const M = G.mission;
    if (!M || M.phase !== 'run') return;
    const p = M.p, S = M.S, def = ZONES[M.zone];
    M.t += dt;
    p.yaw += inp.turn || 0;
    p.strikeCd -= dt; p.shotCd -= dt; p.hurt = Math.max(0, p.hurt - dt); p.swing = Math.max(0, p.swing - dt); p.fullT -= dt;

    // battery: when it dies the bot limps and its hull starts to fail
    p.en -= dt;
    if (p.en <= 0 && !p.limp) { p.limp = true; p.en = 0; emit(G, { type: 'limp' }); }
    if (p.limp) p.hp -= 1.5 * dt;

    // hazards
    let slow = 1;
    for (const h of M.hazards) {
        if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 > h.r * h.r) continue;
        const res = 1 - M.resist;
        if (h.kind === 'spore') p.hp -= 3 * res * dt;
        else if (h.kind === 'acid') { p.hp -= 4 * res * dt; slow = Math.min(slow, 0.6); }
        else if (h.kind === 'thorn') { p.hp -= 5 * res * dt; slow = Math.min(slow, 0.7); }
        else if (h.kind === 'vent' && ventHot(h, M.t)) p.hp -= 16 * res * dt;
        if (!p.inHaz) emit(G, { type: 'hazard', kind: h.kind });
        p.inHaz = 0.5;
    }
    if (p.inHaz) p.inHaz = Math.max(0, p.inHaz - dt);

    // movement
    const mx = clamp(inp.x || 0, -1, 1), my = clamp(inp.y || 0, -1, 1);
    const len = Math.hypot(mx, my), k = len > 1 ? 1 / len : 1;
    const f = fwd(p.yaw);
    const spd = S.speed * slow * (p.limp ? 0.45 : 1) * (p.swing > 0 ? 0.6 : 1);
    p.x += (f.x * my - f.y * mx) * k * spd * dt;
    p.y += (f.y * my + f.x * mx) * k * spd * dt;
    collide(M, p, BOT.radius);

    // strike
    if (inp.a && p.strikeCd <= 0) {
        p.strikeCd = 0.5; p.swing = 0.22;
        const e = pickTarget(M, BOT.reach, BOT.strikeArc);
        emit(G, { type: 'swing', hit: !!e });
        if (e) damageEnemy(G, M, e, S.dmg, 'strike');
    }
    // shoot (from Mk II)
    if (inp.c && S.shot > 0 && p.shotCd <= 0 && !p.limp && p.en > 2) {
        p.shotCd = 0.42; p.en -= 1.5;
        const e = pickTarget(M, 15, 0.45);
        const dx = e ? e.x - p.x : f.x, dy = e ? e.y - p.y : f.y;
        fireShot(G, M, 'p', p.x + f.x * 0.6, p.y + f.y * 0.6, dx, dy, BOT.shotSpeed, S.shot, BOT.shotLife, 'bolt');
        emit(G, { type: 'shoot' });
    }

    // gather, or lift off from the beacon
    let target = null;
    if (inp.b) {
        let bd = Infinity;
        for (const n of M.nodes) {
            if (n.amount <= 0) continue;
            const dx = n.x - p.x, dy = n.y - p.y, d = Math.hypot(dx, dy);
            if (d > BOT.gatherReach + 0.3) continue;
            const facing = (dx * f.x + dy * f.y) / (d || 1);
            if (facing < 0.2 && d > 1.3) continue;
            if (d < bd) { bd = d; target = n; }
        }
    }
    if (target) {
        if (p.gatherId !== target.id) { p.gatherId = target.id; target.prog = 0; }
        target.prog += S.gather * dt;
        if (target.prog >= 1.1) {
            target.prog = 0;
            const want = target.per;
            const took = addCargo(M, target.kind, want);
            if (target.species && !target.sampled) { target.sampled = true; addSample(G, M, target.species); }
            if (took > 0 || target.species) {
                target.amount--;
                emit(G, { type: 'gather', id: target.id, kind: target.kind, units: took, x: target.x, y: target.y, left: target.amount });
            }
            if (took < want && p.fullT <= 0) { p.fullT = 1.5; emit(G, { type: 'full' }); }
        }
    } else {
        p.gatherId = 0;
        if (inp.b && Math.hypot(p.x - BEACON.x, p.y - BEACON.y) < BEACON.r) {
            p.extract += dt;
            if (p.extract >= BEACON.hold) return endMission(G, 'done');
        } else p.extract = 0;
    }
    // emergency recall
    if (inp.r && S.recall) {
        p.recall += dt;
        if (p.recall >= BOT.recallHold) return endMission(G, 'recalled');
    } else p.recall = 0;

    // VESPER's black box
    if (M.echo && !M.got.echo && Math.hypot(p.x - M.echo.x, p.y - M.echo.y) < M.echo.r) {
        M.got.echo = true;
        const idx = def.echo;
        if (!G.echoes.includes(idx)) G.echoes.push(idx);
        emit(G, { type: 'echo', idx });
        G.queue.push('echo' + idx);
    }

    stepEnemies(G, M, dt);
    stepShots(G, M, dt);

    if (p.hp <= 0) { p.hp = 0; return endMission(G, 'dead'); }
}

export const ventHot = (h, t) => ((t + h.phase) % h.period) < 1.3;
export const ventWarn = (h, t) => { const u = (t + h.phase) % h.period; return u > h.period - 1.0; };

function stepEnemies(G, M, dt) {
    const p = M.p;
    for (const e of M.enemies) {
        if (!e.alive) continue;
        const E = ENEMIES[e.type];
        e.hurt = Math.max(0, e.hurt - dt); e.cd -= dt;
        if (E.boss) { stepBoss(G, M, e, dt); continue; }
        const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1e-6;
        const angry = !e.passive || e.provoked;
        let tx = 0, ty = 0, spd = 0;
        if (e.st === 'idle') {
            e.t -= dt;
            if (e.t <= 0) { e.t = G.rng.range(2, 4.5); e.wx = e.hx + G.rng.range(-4, 4); e.wy = e.hy + G.rng.range(-4, 4); }
            tx = e.wx - e.x; ty = e.wy - e.y; spd = Math.hypot(tx, ty) > 0.3 ? E.spd * 0.35 : 0;
            if (angry && d < e.sight) {
                e.st = 'chase';
                emit(G, { type: 'alert', id: e.id });
                if (E.pack) for (const o of M.enemies) if (o.alive && o.type === e.type && o.st === 'idle' && Math.hypot(o.x - e.x, o.y - e.y) < 11) { o.st = 'chase'; o.provoked = true; }
            }
        } else {
            if (d > e.sight * 2.4 && !e.provoked) { e.st = 'idle'; continue; }
            if (E.ranged && d < E.ranged) {
                // keep their distance and spit
                const want = E.ranged * 0.65;
                if (d < want - 1) { tx = -dx; ty = -dy; spd = E.spd * 0.7; }
                else { tx = -dy; ty = dx; spd = E.spd * 0.35; }
                if (e.cd <= 0) {
                    e.cd = E.cd;
                    fireShot(G, M, 'e', e.x, e.y, dx, dy, 9, e.dmg * 0.8, 1.4, e.type === 'ashwing' ? 'ember' : 'spore');
                    emit(G, { type: 'spit', id: e.id });
                }
            } else if (e.wind > 0) {
                e.wind -= dt;
                if (e.wind <= 0) {
                    e.cd = E.cd;
                    if (d <= E.reach + BOT.radius + 0.5) {
                        hurtPlayer(G, M, e.dmg, e.type);
                        if (E.drain) M.p.en = Math.max(0, M.p.en - E.drain);
                    }
                    emit(G, { type: 'bite', id: e.id });
                }
            } else {
                tx = dx; ty = dy; spd = d > E.reach * 0.8 + BOT.radius ? E.spd : 0;
                if (d <= E.reach + BOT.radius && e.cd <= 0) { e.wind = 0.38; emit(G, { type: 'windup', id: e.id }); }
            }
        }
        if (spd > 0) {
            const l = Math.hypot(tx, ty) || 1;
            let vx = tx / l, vy = ty / l;
            if (E.flyer) { const w = Math.sin(M.t * 3 + e.id) * 0.6; vx += -vy * w; vy += vx * w; }
            e.x += vx * spd * dt; e.y += vy * spd * dt;
            e.face = Math.atan2(vx, -vy);
        }
        if (!E.flyer) collide(M, e, E.r);
        else { const H = MAP.half - 1; e.x = clamp(e.x, -H, H); e.y = clamp(e.y, -H, H); }
    }
}

function stepBoss(G, M, e, dt) {
    const p = M.p, E = ENEMIES[e.type];
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d > 26 && !e.provoked) return;
    if (!e.provoked) { e.provoked = true; e.st = 'chase'; emit(G, { type: 'bossWake' }); }
    const frac = e.hp / e.hpMax;
    const T = e.timers;
    T.ring -= dt; T.slam -= dt; T.spawn -= dt;
    if (T.ring <= 0) {
        T.ring = frac < 0.5 ? 3 : 4.2;
        const n = frac < 0.3 ? 14 : 10, off = M.t * 0.7;
        for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2; fireShot(G, M, 'e', e.x, e.y, Math.sin(a), -Math.cos(a), 7, 13, 3.6, 'thorn'); }
        emit(G, { type: 'ring' });
    }
    if (T.slam <= 0) {
        T.slam = frac < 0.5 ? 4.5 : 6;
        M.slams.push({ x: p.x, y: p.y, r: 3, t: 1.2, dmg: 34 });
        emit(G, { type: 'slamWarn', x: p.x, y: p.y });
    }
    if (T.spawn <= 0 && frac < 0.65) {
        T.spawn = 10;
        const alive = M.enemies.filter((o) => o.alive && o.type === 'rootling').length;
        for (let i = 0; i < 2 && alive + i < 6; i++) {
            const o = makeEnemy(Math.max(...M.enemies.map((q) => q.id)) + 1, 'rootling', e.x + (i ? 4 : -4), e.y + 3, false, 100);
            o.st = 'chase'; o.provoked = true;
            M.enemies.push(o);
        }
        emit(G, { type: 'spawn' });
    }
    // a sweep at anything that gets close
    if (e.wind > 0) {
        e.wind -= dt;
        if (e.wind <= 0) { e.cd = E.cd; if (d <= E.reach + BOT.radius) hurtPlayer(G, M, e.dmg, 'sweep'); emit(G, { type: 'sweep' }); }
    } else if (d <= E.reach + BOT.radius && e.cd <= 0) { e.wind = 0.7; emit(G, { type: 'windup', id: e.id }); }
}

function stepShots(G, M, dt) {
    const p = M.p;
    for (let i = M.shots.length - 1; i >= 0; i--) {
        const s = M.shots[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        let gone = s.life <= 0 || Math.abs(s.x) > MAP.half || Math.abs(s.y) > MAP.half;
        if (!gone && s.from === 'p') {
            for (const e of M.enemies) {
                if (!e.alive) continue;
                const R = ENEMIES[e.type].r + 0.2;
                if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < R * R) { damageEnemy(G, M, e, s.dmg, 'shot'); gone = true; break; }
            }
        } else if (!gone && (p.x - s.x) ** 2 + (p.y - s.y) ** 2 < (BOT.radius + 0.15) ** 2) {
            hurtPlayer(G, M, s.dmg, s.kind); gone = true;
        }
        if (!gone && s.from === 'e' && s.kind !== 'thorn') {
            for (const pr of M.props) if (pr.r && (pr.x - s.x) ** 2 + (pr.y - s.y) ** 2 < pr.r * pr.r) { gone = true; break; }
        }
        if (gone) M.shots.splice(i, 1);
        if (M.phase !== 'run') return;
    }
    for (let i = M.slams.length - 1; i >= 0; i--) {
        const s = M.slams[i];
        s.t -= dt;
        if (s.t <= 0) {
            if ((p.x - s.x) ** 2 + (p.y - s.y) ** 2 < s.r * s.r) hurtPlayer(G, M, s.dmg, 'slam');
            emit(G, { type: 'slam', x: s.x, y: s.y });
            M.slams.splice(i, 1);
        }
    }
}

/** Bring the bot home (or don't), unload, and hand the station a report. */
export function endMission(G, how) {
    const M = G.mission;
    if (!M) return;
    const keep = how === 'dead' ? (G.research.done.m5 ? 0.7 : 0.35) : 1;
    const brought = {};
    for (const k of RES) { brought[k] = Math.floor(M.p.cargo[k] * keep); G.res[k] += brought[k]; }
    const Z = G.zones[M.zone];
    Z.visited = true;
    G.stats.missions++;
    if (how === 'dead') { G.stats.deaths++; G.bot.busy = Math.max(G.bot.busy, REPAIR_DAYS); }
    const days = M.t / MISSION_DAY_SEC;
    G.report = { zone: M.zone, how, brought, samples: M.got.samples, kills: M.got.kills, echo: M.got.echo, days: Math.round(days * 10) / 10, lost: how === 'dead' };
    G.mission = null;
    G.mode = 'station';
    emit(G, { type: 'missionEnd', how, zone: M.zone });
    if (how === 'dead') G.queue.push('first_death');
    else G.queue.push('back_first');
}
