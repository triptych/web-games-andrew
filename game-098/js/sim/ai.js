// One brain for both sides. The Chain plays with it a unit at a time; the test bot plays Kestrel's
// side with the same planner (plus a few rules about freeing strays and keeping the tamer safe), so
// the balance numbers the bot finds are against the enemy a player really meets.
//
// planUnit scores every destination × action one move ahead: expected damage from the same forecast
// the player sees, the counter it would eat, what could hit it where it ends up, terrain, claims, and
// how far it gets towards its goal (a distance field that walks round crags and seas).

import { UNITS, SPECIES, TERRAIN, SKILLS } from './data.js';
import { POWER } from '../config.js';
import { idx, dist, ring, unitAt, distField, destinations, inside, canStand, reach } from './map.js';
import {
    reachOf, forecast, skillTargets, canCapture, unchainTargets, unchainChance, blow, battleAct,
    tamerOf, reserve, callCost, makeUnit, moveNow, starsOf,
} from './battle.js';

const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

/** How much a unit matters, in rough "points". */
export function valueOf(u) {
    let v = 12 + u.lv * 1.5 + (u.atk + u.def) * 0.4;
    if (u.boss) v += 40;
    if (u.tamer) v += 70;
    if (u.target) v += 30;
    if (u.kind === 'structure') v = u.key === 'pylon' ? 40 : 10;
    if (u.indirect) v += 8;
    return v;
}

/**
 * Where each opposing unit could strike next turn. Returns a function threat(u, x, y) → the share of
 * u's HP the opposing side could take there (each attacker counted once, capped at 2).
 */
export function threatMap(B, team) {
    const att = B.units.filter((o) => o.hp > 0 && o.team !== team && o.atk > 0 && o.kind !== 'structure');
    const zones = att.map((o) => {
        const tiles = new Set();
        const mv = o.bound ? 0 : Math.max(o.mv, moveNow(B, o));
        const origins = o.indirect ? [[o.x, o.y]] : destinations(B, o, reachForThreat(B, o, mv)).map(([x, y]) => [x, y]);
        if (!o.indirect) origins.push([o.x, o.y]);
        for (const [x, y] of origins) for (const [tx, ty] of ring(B, x, y, o.rng[0], o.rng[1])) tiles.add(ty * B.w + tx);
        return { o, tiles };
    });
    return (u, x, y) => {
        const i = y * B.w + x;
        let sum = 0;
        const ox = u.x, oy = u.y;
        u.x = x; u.y = y;
        for (const z of zones) {
            if (!z.tiles.has(i)) continue;
            if (z.o.stun > 0) continue;
            sum += blow(B, z.o, u) / Math.max(1, u.hp);
        }
        u.x = ox; u.y = oy;
        return Math.min(2, sum);
    };
}

// Threat reach ignores the moving unit's own allies blocking (they will move) but respects enemies.
function reachForThreat(B, o, mv) { return reach(B, o, mv); }

/** The goal tiles a unit walks towards. */
function goalsFor(B, u) {
    const O = B.objective;
    if (u.team === 'p') {
        if (u.tamer && O.type === 'reach') return [O.at];
        if (O.type === 'unchain' && u.tamer) { const t = B.units.find((v) => v.target && v.hp > 0); if (t) return [[t.x, t.y]]; }
        // the tamer stays a step behind the line: aim for the nearest ally rather than the nearest foe
        if (u.tamer) {
            // close in on a stray once it's worn down; otherwise follow the flock
            const ch = B.units.filter((v) => v.hp > 0 && v.team !== u.team && v.chained && v.hp <= v.hpMax * 0.6);
            if (ch.length) return ch.map((v) => [v.x, v.y]);
            const flock = B.units.filter((v) => v.hp > 0 && v.team === u.team && v !== u && v.kind === 'dragon');
            if (flock.length) return flock.map((v) => [v.x, v.y]);
        }
    }
    const foes = B.units.filter((v) => v.hp > 0 && v.team !== u.team && !(v.bound && v.team === 'e' && pylonCount(B) > 0 && u.team === 'p'));
    const props = [];
    if (u.capture >= 1) for (let i = 0; i < B.tiles.length; i++) if (TERRAIN[B.tiles[i]].prop && B.own[i] !== u.team) props.push([i % B.w, (i / B.w) | 0]);
    const g = foes.map((v) => [v.x, v.y]).concat(props);
    if (u.team === 'e' && O.type === 'survive') for (const i of B.homeHq) g.push([i % B.w, (i / B.w) | 0]);
    return g.length ? g : [[u.x, u.y]];
}
const pylonCount = (B) => B.units.filter((v) => v.key === 'pylon' && v.hp > 0).length;

/**
 * The best command for one unit, with its score: { cmd, score }.
 * opts: { caution, threat (from threatMap), field (distance field to goals) }
 */
export function planUnit(G, B, u, opts = {}) {
    const caution = opts.caution ?? (u.team === 'e' ? 0.45 : 0.6);
    const threat = opts.threat || threatMap(B, u.team);
    const field = opts.field || distField(B, u, goalsFor(B, u));
    const R = reachOf(B, u);
    const dests = destinations(B, u, R);
    const V = valueOf(u);
    const start = field[idx(B, u.x, u.y)];
    const appW = u.boss && u.team === 'e' ? 0.3 : u.tamer ? 1.2 : 2.2;
    const bestCmds = [];
    const home = u.boss && u.team === 'e' && B.enemyHq.includes(idx(B, u.x, u.y));
    const tamer = tamerOf(B);
    const O = B.objective;

    for (const [x, y, i] of dests) {
        if (u.indirect && (x !== u.x || y !== u.y)) {
            // a siege engine that moves can't fire: score the spot by what it could hit next turn
            let pos = posScore(B, u, x, y, i, field, start, appW, threat, caution, V, home);
            const next = B.units.filter((v) => v.hp > 0 && v.team !== u.team && v.kind !== 'structure' && dist(x, y, v.x, v.y) >= u.rng[0] && dist(x, y, v.x, v.y) <= u.rng[1]);
            pos += next.length ? 6 : 0;
            bestCmds.push({ cmd: { t: 'act', id: u.id, to: [x, y], do: 'wait' }, score: pos });
            continue;
        }
        const pos = posScore(B, u, x, y, i, field, start, appW, threat, caution, V, home);
        // wait
        bestCmds.push({ cmd: { t: 'act', id: u.id, to: [x, y], do: 'wait' }, score: pos });
        // attacks
        if (u.atk > 0) {
            for (const [tx, ty] of ring(B, x, y, u.rng[0], u.rng[1])) {
                const t = unitAt(B, tx, ty);
                if (!t || t.team === u.team) continue;
                const f = forecast(B, u, t, x, y);
                if (f.dmg[1] <= 0) continue;
                const dealt = t.hp - f.hpD;
                const taken = u.hp - f.hpA;
                const kill = f.hpD <= 0;
                const Vt = valueOf(t);
                let s = (dealt / t.hpMax) * Vt + (kill ? Vt * 0.7 : 0) - (taken / u.hpMax) * V * 0.9 - (f.hpA <= 0 ? V : 0);
                // the player's side spares strays it could free (and must never kill an objective)
                if (u.team === 'p' && t.chained) {
                    if (!t.target && (kill || f.hpD < t.hpMax * 0.05)) s -= Vt * 1.5;
                    else if (f.hpD <= t.hpMax * 0.5) s += 20;
                    if (t.target) s += 10;
                }
                if (u.team === 'p' && t.bound && pylonCount(B) > 0) s *= 0.3;
                if (t.key === 'pylon') s += 8;
                if (t.tamer) s += 12;
                bestCmds.push({ cmd: { t: 'act', id: u.id, to: [x, y], do: 'attack', target: [tx, ty] }, score: pos + s * 1.3 });
            }
        }
        // skills
        if (u.skill && u.cd <= 0) {
            for (const [tx, ty] of skillTargets(B, u, x, y)) {
                const s = skillScore(B, u, x, y, tx, ty, threat);
                if (s > 0) bestCmds.push({ cmd: { t: 'act', id: u.id, to: [x, y], do: 'skill', target: [tx, ty] }, score: pos + s });
            }
        }
        // claims
        if (canCapture(B, u, x, y)) {
            const tid = B.tiles[i];
            let s = 14 + (tid === 'hq' ? 60 : tid === 'roost' ? 12 : 0);
            if (B.capBy[i] === u.id) s += 18;
            if (tid === 'hq' && B.capt[i] <= Math.ceil(u.hp / u.hpMax * 10) * u.capture) s += 200;
            if (u.team === 'e' && O.type === 'survive' && tid === 'hq') s += 40;
            bestCmds.push({ cmd: { t: 'act', id: u.id, to: [x, y], do: 'capture' }, score: pos + s });
        }
        // freeing strays
        if (u.tamer) {
            for (const [tx, ty] of unchainTargets(B, u, x, y)) {
                const t = unitAt(B, tx, ty);
                const c = unchainChance(B, t, u);
                bestCmds.push({ cmd: { t: 'act', id: u.id, to: [x, y], do: 'unchain', target: [tx, ty] }, score: pos + c * (t.target ? 400 : 60) + 10 });
            }
        }
    }
    void tamer;
    let best = null;
    for (const c of bestCmds) if (!best || c.score > best.score) best = c;
    return best || { cmd: { t: 'act', id: u.id, to: [u.x, u.y], do: 'wait' }, score: 0 };
}

function posScore(B, u, x, y, i, field, start, appW, threat, caution, V, home) {
    let s = 0;
    const d = field[i];
    if (Number.isFinite(d) && Number.isFinite(start)) s += (start - d) * appW;
    else if (Number.isFinite(d)) s += 2;
    s += starsOf(B, u, x, y) * 1.2;
    const th = threat(u, x, y);
    let c = caution;
    if (u.tamer) {
        c *= 3;
        // bodyguards: a dragon beside the tamer is a dragon between it and harm
        s += B.units.filter((v) => v.hp > 0 && v.team === u.team && v !== u && v.kind === 'dragon' && dist(v.x, v.y, x, y) === 1).length * 3;
    }
    s -= th * V * c * (th >= 1 ? 1.6 : 1);
    const tid = B.tiles[i];
    if (u.hp < u.hpMax * 0.6 && TERRAIN[tid].prop && B.own[i] === u.team) s += 10;
    if (u.hp < u.hpMax * 0.6 && TERRAIN[tid].heal) s += 8;
    if (home && !(x === u.x && y === u.y)) s -= 15;
    if (B.treasure[i] && u.team === 'p') s += 25;
    // the player's tamer should keep a dragon between itself and harm, but not hide forever
    if (u.tamer && B.objective.type === 'reach' && Number.isFinite(d)) s -= d * 0.6;
    // roosts are for calling: don't park on your own
    if (u.team === 'p' && TERRAIN[tid].deploy && B.own[i] === 'p' && !u.tamer) s -= 3;
    return s;
}

function skillScore(B, u, x, y, tx, ty, threat) {
    const S = SKILLS[u.skill];
    const ox = u.x, oy = u.y;
    u.x = x; u.y = y;
    let s = 0;
    try {
        const foeHit = (t, power) => {
            const b = blow(B, u, t, { power }) * 1.04;
            const dealt = Math.min(t.hp, b);
            let v = (dealt / t.hpMax) * valueOf(t) + (dealt >= t.hp ? valueOf(t) * 0.7 : 0);
            if (u.team === 'p' && t.chained && !t.target) v = dealt >= t.hp ? -valueOf(t) : v * 0.5;
            if (u.team === 'p' && t.bound && pylonCount(B) > 0) v *= 0.3;
            return v;
        };
        const t = unitAt(B, tx, ty);
        switch (S.kind) {
            case 'bolt': s = foeHit(t, S.power) + 2; break;
            case 'drain': s = foeHit(t, S.power) + Math.min(u.hpMax - u.hp, blow(B, u, t, { power: S.power })) / u.hpMax * valueOf(u) * 0.5 + 4; break;
            case 'stun': s = foeHit(t, S.power) + (t.acted && B.phase === t.team ? 0 : valueOf(t) * 0.35); break;
            case 'push': s = foeHit(t, S.power) * 1.05 + 1; break;
            case 'chain': {
                s = foeHit(t, S.power);
                let cur = t, hit = [t];
                for (let j = 0; j < S.jumps; j++) {
                    const n = B.units.filter((v) => v.hp > 0 && v.team !== u.team && !hit.includes(v) && dist(v.x, v.y, cur.x, cur.y) <= 2)[0];
                    if (!n) break;
                    s += foeHit(n, S.power * 0.75); hit.push(n); cur = n;
                }
                break;
            }
            case 'blast': {
                const hits = B.units.filter((v) => v.hp > 0 && v.team !== u.team && cheb(v.x, v.y, tx, ty) <= S.area);
                for (const h of hits) s += foeHit(h, S.power);
                s += hits.length > 1 ? 6 : -4;
                break;
            }
            case 'heal': {
                const list = S.area ? B.units.filter((v) => v.hp > 0 && v.team === u.team && cheb(v.x, v.y, tx, ty) <= S.area) : [t || u];
                for (const a of list) s += Math.min(a.hpMax - a.hp, a.hpMax * S.amount) / a.hpMax * valueOf(a) * 0.8;
                s -= 3;
                break;
            }
            case 'ward': {
                const a = t || u;
                const th = threat(a, a.x, a.y);
                s = th > 0.2 ? th * valueOf(a) * S.amount * 0.9 : -1;
                break;
            }
            case 'refresh': s = t && t.acted && !t.tamer ? valueOf(t) * 0.45 : -1; break;
            case 'rally': {
                const n = B.units.filter((v) => v.hp > 0 && v.team === u.team && dist(v.x, v.y, x, y) <= 1 && !v.acted && v !== u).length;
                s = n * 5 - 2;
                break;
            }
            case 'nova': {
                for (const v of B.units.filter((v) => v.hp > 0 && v !== u && dist(v.x, v.y, x, y) === 1)) {
                    if (v.team === u.team) s += Math.min(v.hpMax - v.hp, v.hpMax * S.amount) / v.hpMax * valueOf(v) * 0.8;
                    else s += foeHit(v, S.power);
                }
                break;
            }
        }
    } finally { u.x = ox; u.y = oy; }
    return s;
}

/** Order a side's units for a phase: those that can strike first, siege before melee. */
function actingOrder(B, team) {
    const list = B.units.filter((u) => u.hp > 0 && u.team === team && !u.acted && u.kind !== 'structure');
    const enemies = B.units.filter((v) => v.hp > 0 && v.team !== team);
    const near = (u) => Math.min(...enemies.map((v) => dist(u.x, u.y, v.x, v.y)), 99);
    return list.sort((a, b) => (b.indirect - a.indirect) || (a.tamer - b.tamer) || (near(a) - near(b)) || (a.id - b.id));
}

/** The Chain musters soldiers at its keeps when it has the coin. */
export function enemyBuild(G, B) {
    if (!B.build) return;
    const count = B.units.filter((u) => u.hp > 0 && u.team === 'e').length;
    if (count >= 18) return;
    const foesFly = B.units.filter((u) => u.hp > 0 && u.team === 'p' && u.mt === 'fly').length;
    const foesAll = Math.max(1, B.units.filter((u) => u.hp > 0 && u.team === 'p').length);
    for (let i = 0; i < B.tiles.length; i++) {
        if (B.tiles[i] !== 'roost' || B.own[i] !== 'e') continue;
        const x = i % B.w, y = (i / B.w) | 0;
        if (unitAt(B, x, y)) continue;
        // pick a counter to what the keeper fields
        let k;
        const r = G.rng();
        if (foesFly / foesAll > 0.45 && r < 0.45) k = 'ballista';
        else if (r < 0.3) k = 'lancer';
        else if (r < 0.45 && B.lvl >= 9) k = 'hexer';
        else if (r < 0.6) k = 'chainhound';
        else k = 'chainknight';
        if (B.funds.e < UNITS[k].cost) k = 'chainknight';
        if (B.funds.e < UNITS[k].cost) continue;
        B.funds.e -= UNITS[k].cost;
        const u = makeUnit(G, B, { k, team: 'e', x, y, lv: Math.max(1, B.lvl - 1) });
        u.acted = true;
        B.events.push({ type: 'build', id: u.id, at: [x, y], unit: { id: u.id, key: u.key, team: 'e', name: u.name } });
    }
}

/**
 * The next command for the side whose phase it is, without taking it. The Chain musters at its keeps
 * here (a side effect, once per phase), so call it only when that side is about to act.
 */
export function nextCommand(G, B, team, opts = {}) {
    if (B.over || B.phase !== team) return null;
    if (!B.aiQueue) {
        B.aiQueue = { started: true };
        if (team === 'e') enemyBuild(G, B);
    }
    const p = B.power[team];
    if (p.def && !p.on && p.meter >= POWER.max) return { t: 'power', team };
    if (team === 'p' && opts.call !== false) {
        const c = planCall(G, B);
        if (c) return c;
    }
    const order = actingOrder(B, team);
    if (!order.length) return { t: 'end', ai: true };
    const threat = threatMap(B, team);
    return planUnit(G, B, order[0], { threat, caution: opts.caution }).cmd;
}

/** Take one action for a side. Returns the command, or null if it isn't that side's phase. */
export function stepSide(G, B, team, opts = {}) {
    const cmd = nextCommand(G, B, team, opts);
    if (!cmd) return null;
    const r = battleAct(G, cmd);
    if (!r.ok && cmd.t === 'act') {
        // never stall: a refused plan becomes a wait
        const w = battleAct(G, { t: 'act', id: cmd.id, do: 'wait' });
        if (!w.ok) { const u = B.units.find((v) => v.id === cmd.id); if (u) u.acted = true; }
    } else if (!r.ok) battleAct(G, { t: 'end', ai: true });
    return cmd;
}

/** The bot calls its best stabled dragon to an empty roost when it can afford one. */
export function planCall(G, B) {
    if (B.phase !== 'p') return null;
    const res = reserve(G, B).sort((a, b) => b.lv - a.lv);
    if (!res.length) return null;
    const mine = B.units.filter((u) => u.hp > 0 && u.team === 'p').length;
    if (mine >= 10) return null;
    for (let i = 0; i < B.tiles.length; i++) {
        if (B.tiles[i] !== 'roost' || B.own[i] !== 'p') continue;
        const x = i % B.w, y = (i / B.w) | 0;
        if (unitAt(B, x, y)) continue;
        for (const d of res) {
            if (!canStand(B, { mt: SPECIES[d.sp].mt, traits: d.traits }, x, y)) continue;
            if (callCost(G, d.rid) <= B.funds.p && d.lv >= Math.max(1, B.lvl - 6)) return { t: 'call', at: [x, y], rid: d.rid };
        }
    }
    return null;
}

void inside;
