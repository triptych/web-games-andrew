// An auto-player for the whole year. It plays through act() and step() like the UI and the keyboard do, so the
// balance table measures the real game. Pure, like the rest of js/sim.
//
//   botTick(G, B)  -> null after doing station business with act(), or an input { x, y, turn, a, b, c, r } to step with.

import { ZONES, RESEARCH, GENS, UPGRADES, HARVESTERS, ENEMIES, SPECIES, upgradeMax, upgradeCost, harvesterCost, colonyCost, COLONY, canAfford, RES } from './data.js';
import { act, deployCheck, talkChoices } from './game.js';
import { researchState, blueprintFor, vatSlots, labSlots, canWake, canConcord, blendCost } from './station.js';
import { sequenced, blendTraits, pairKey, releaseEffect, edenIndex, isSequenced } from './genetics.js';
import { blockedGrid } from './zonegen.js';
import { MAP, BEACON, BOT, STEP } from '../config.js';

const ORDER = ['m2', 'a1', 'b1', 'b2', 'm1', 'a2', 'a3', 'm4', 'b3', 'b4', 'a4', 'm5', 'm6', 'b6', 'b5', 'a5', 'm3', 'm7', 'a6', 'b7', 'b8', 'a7', 'm8', 'a8', 'b9'];

export function makeBot({ skill = 1, lazy = false } = {}) {
    return { skill, lazy, path: null, goal: null, stuck: 0, lx: 0, ly: 0, detour: 0, tick: 0, hold: 0 };
}

const fwdOf = (yaw) => ({ x: Math.sin(yaw), y: -Math.cos(yaw) });
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const weightedGain = (fx, zi) => (-fx.toxic - fx.hostile - fx.barren) * ZONES[zi].weight;

// ---------------------------------------------------------------- the station
function reserveFor(G) {
    const next = G.bot.gen + 1;
    if (next >= GENS.length) return {};
    const bp = blueprintFor(next);
    const out = {};
    for (const k of RES) out[k] = (G.research.done[bp.id] ? GENS[next].cost[k] || 0 : (bp.cost[k] || 0)) * 0.7;
    return out;
}
const spare = (G, cost, reserve) => RES.every((k) => (G.res[k] || 0) - (cost[k] || 0) >= (reserve[k] || 0));

function bestBlend(G) {
    const seq = sequenced(G);
    const zones = G.zones.map((Z, i) => i).filter((i) => G.zones[i].visited && !(ZONES[i].boss && !G.zones[i].boss));
    let best = null;
    for (let i = 0; i < seq.length; i++) for (let j = i + 1; j < seq.length; j++) {
        for (let r = 0; r <= 1.0001; r += 0.2) {
            const traits = blendTraits(G, seq[i], seq[j], r);
            const s = { traits, key: pairKey(seq[i], seq[j]) };
            for (const zi of zones) {
                // count strains already waiting for the same pairing on this zone
                const pending = [...G.strains, ...G.vats.map((v) => v.strain)].filter((x) => x.key === s.key).length;
                const fx = releaseEffect(G, s, zi);
                const g = weightedGain(fx, zi) * Math.pow(0.6, pending);
                if (!best || g > best.g) best = { a: seq[i], b: seq[j], r: Math.round(r * 10) / 10, g, zi };
            }
        }
    }
    return best;
}

function stationBusiness(G, B) {
    act(G, { t: 'collect' });
    if (canWake(G) && !B.lazy) { act(G, { t: 'wake' }); return; }
    // release what's ready where it does the most
    for (const s of [...G.strains]) {
        let bz = -1, bg = 1.5;
        G.zones.forEach((Z, zi) => {
            if (!Z.visited || (ZONES[zi].boss && !Z.boss)) return;
            const g = weightedGain(releaseEffect(G, s, zi), zi);
            if (g > bg) { bg = g; bz = zi; }
        });
        if (bz >= 0) act(G, { t: 'release', id: s.id, zone: bz });
    }
    if (B.lazy) return;
    // research
    const reserve0 = reserveFor(G);
    const bpNext = G.bot.gen + 1 < GENS.length ? blueprintFor(G.bot.gen + 1).id : null;
    for (const id of ORDER) {
        if (G.research.active.length >= labSlots(G)) break;
        const R = RESEARCH.find((r) => r.id === id);
        if (researchState(G, id) === 'ready' && (id === bpNext || spare(G, R.cost, reserve0))) act(G, { t: 'research', id });
    }
    // a new body
    act(G, { t: 'fabricate' });
    const reserve = reserveFor(G);
    // splice: keep every vat working
    for (let n = 0; n < 3 && G.vats.length < vatSlots(G); n++) {
        const b = bestBlend(G);
        if (!b || b.g < 3) break;
        if (!spare(G, blendCost(b.a, b.b, b.r), {})) break;
        if (!act(G, { t: 'blend', a: b.a, b: b.b, r: b.r }).ok) break;
    }
    // harvesters: cheapest first, if it leaves the reserve intact
    for (let n = 0; n < 6; n++) {
        let best = null;
        G.zones.forEach((Z, zi) => {
            if (!Z.visited || (ZONES[zi].boss && !Z.boss)) return;
            for (const h of HARVESTERS) {
                if (Z.harv[h.id] >= 5) continue;
                const c = harvesterCost(zi, Z.harv[h.id]);
                const sc = c.metal + c.mineral - zi * 6;
                if (!best || sc < best.sc) best = { zi, kind: h.id, c, sc };
            }
        });
        if (!best || !G.research.done.a1 || !spare(G, best.c, reserve)) break;
        act(G, { t: 'harvester', zone: best.zi, kind: best.kind });
    }
    // colonies
    G.zones.forEach((Z, zi) => {
        if (G.research.done.a5 && Z.visited && Z.colony < COLONY.length && Z.hostile <= COLONY[Z.colony].host && spare(G, colonyCost(zi, Z.colony), reserve)) act(G, { t: 'colony', zone: zi });
    });
    // upgrades
    for (let n = 0; n < 8; n++) {
        let best = null;
        for (const u of UPGRADES) {
            if (G.bot.lv[u.id] >= upgradeMax(G.bot.gen)) continue;
            const c = upgradeCost(u.id, G.bot.lv[u.id]);
            const sc = Object.values(c).reduce((a, b) => a + b, 0);
            if (!best || sc < best.sc) best = { id: u.id, c, sc };
        }
        if (!best || !spare(G, best.c, reserve)) break;
        act(G, { t: 'upgrade', id: best.id });
    }
}

/** What the next purchases still lack, as weights over the four resources. */
export function needs(G) {
    const target = { metal: 15, mineral: 10, flora: 8, fauna: 8 };
    const add = (c, k = 1) => { for (const r in c) target[r] += c[r] * k; };
    const next = G.bot.gen + 1;
    if (next < GENS.length) { const bp = blueprintFor(next); if (!G.research.done[bp.id]) add(bp.cost); add(GENS[next].cost); }
    let n = 0;
    for (const id of ORDER) { if (n >= 2) break; const st = researchState(G, id); if (st === 'poor' || st === 'ready') { add(RESEARCH.find((r) => r.id === id).cost, 0.8); n++; } }
    add({ flora: 8, fauna: 8, mineral: 4 });
    const def = {}; let tot = 0;
    for (const k of RES) { def[k] = Math.max(0, target[k] - G.res[k]) / target[k]; tot += def[k]; }
    for (const k of RES) def[k] = tot ? def[k] / tot : 0.25;
    return def;
}

function pickZone(G) {
    const gen = G.bot.gen;
    const ok = ZONES.map((z, i) => i).filter((i) => !deployCheck(G, i));
    if (!ok.length) return -1;
    if (gen >= 5 && !G.zones[5].boss) return 5;
    const top = Math.max(...ok.filter((i) => i < 5));
    // a zone with genomes or a black box still to find comes first, newest first
    for (let i = top; i >= 0; i--) {
        if (!ok.includes(i)) continue;
        const missing = SPECIES.some((s) => s.zone === i && !isSequenced(G, s.id));
        const echo = ZONES[i].echo >= 0 && !G.echoes.includes(ZONES[i].echo);
        if (missing || echo) return i;
    }
    return G.zones[5].boss && ok.includes(5) && G.stats.missions % 3 === 0 ? 5 : top;
}

// ---------------------------------------------------------------- the planet
function flowField(M, tx, ty) {
    const { g, n } = blockedGrid(M, BOT.radius + 0.15);
    const hz = new Uint8Array(n * n);
    for (const h of M.hazards) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const x = -MAP.half + i + 0.5, y = -MAP.half + j + 0.5;
        if ((x - h.x) ** 2 + (y - h.y) ** 2 < (h.r + 0.6) ** 2) hz[j * n + i] = 1;
    }
    const dist = new Int32Array(n * n).fill(-1);
    const ci = (v) => Math.max(0, Math.min(n - 1, Math.floor(v + MAP.half)));
    const start = ci(ty) * n + ci(tx);
    // two-pass: avoid hazards if we can; a BFS over a deque where hazard cells cost 6
    const q = [[start, 0]]; dist[start] = 0;
    let head = 0;
    const buckets = new Map([[0, [start]]]);
    let cur = 0, maxd = 0;
    while (cur <= maxd) {
        const list = buckets.get(cur);
        if (list) for (let k = 0; k < list.length; k++) {
            const c = list[k];
            if (dist[c] !== cur) continue;
            const i = c % n, j = (c / n) | 0;
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const a = i + di, b = j + dj;
                if (a < 0 || b < 0 || a >= n || b >= n) continue;
                const kk = b * n + a;
                if (g[kk] && kk !== start) continue;
                const nd = cur + (hz[kk] ? 6 : 1);
                if (dist[kk] >= 0 && dist[kk] <= nd) continue;
                dist[kk] = nd; maxd = Math.max(maxd, nd);
                if (!buckets.has(nd)) buckets.set(nd, []);
                buckets.get(nd).push(kk);
            }
        }
        buckets.delete(cur);
        cur++;
    }
    void q; void head;
    return { dist, n, tx, ty };
}
function steer(F, x, y) {
    const { dist, n } = F;
    const ci = (v) => Math.max(0, Math.min(n - 1, Math.floor(v + MAP.half)));
    const i = ci(x), j = ci(y);
    let best = null, bd = dist[j * n + i] >= 0 ? dist[j * n + i] : 1e9;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a >= n || b >= n) continue;
        const d = dist[b * n + a];
        if (d >= 0 && d < bd) { bd = d; best = [a, b]; }
    }
    if (!best || bd <= 1) return { x: F.tx - x, y: F.ty - y };
    return { x: -MAP.half + best[0] + 0.5 - x, y: -MAP.half + best[1] + 0.5 - y };
}

function missionInput(G, B) {
    const M = G.mission, p = M.p, S = M.S;
    const inp = { x: 0, y: 0, turn: 0, a: false, b: false, c: false, r: false };
    B.tick++;
    const dBeacon = Math.hypot(p.x - BEACON.x, p.y - BEACON.y);
    const home = p.carry >= S.cargo || p.en < dBeacon / (S.speed * 0.7) + 10 || p.hp < S.hpMax * 0.3 || p.limp;
    // threats
    let threat = null, td = Infinity;
    for (const e of M.enemies) {
        if (!e.alive) continue;
        const angry = (!e.passive || e.provoked) && e.st === 'chase';
        const d = Math.hypot(e.x - p.x, e.y - p.y) - ENEMIES[e.type].r;
        if (angry && d < (ENEMIES[e.type].boss ? 30 : 7) && d < td) { td = d; threat = e; }
    }
    // dodge a slam circle we stand in
    for (const s of M.slams) if (Math.hypot(p.x - s.x, p.y - s.y) < s.r + 0.6) {
        const dx = p.x - s.x || 0.1, dy = p.y - s.y || 0.1;
        return faceAndGo(B, p, Math.atan2(dx, -dy), 1, inp);
    }
    let goal;
    if (home && !(threat && td < 2.2 && p.hp > S.hpMax * 0.2)) {
        if (S.recall && dBeacon > 14 && !threat) { inp.r = true; return inp; }
        goal = { x: BEACON.x, y: BEACON.y, near: 0.8, use: dBeacon < BEACON.r - 0.4, kind: 'home' };
    } else if (threat) {
        const want = Math.atan2(threat.x - p.x, -(threat.y - p.y));
        const boss = ENEMIES[threat.type].boss;
        const reachD = BOT.reach + ENEMIES[threat.type].r - 0.3;
        if (td + ENEMIES[threat.type].r > reachD || boss) {
            goal = { x: threat.x, y: threat.y, near: reachD, kind: 'fight' };
        }
        // strike and shoot when roughly facing it
        if (Math.abs(angDiff(want, p.yaw)) < 0.6) {
            if (td < BOT.reach + 0.2 && G.rng() < 0.4 + 0.6 * B.skill) inp.a = true;
            if (S.shot && td < 14 && G.rng() < 0.3 + 0.7 * B.skill) inp.c = true;
        }
        if (!goal || td < reachD) {
            inp.turn = clampTurn(angDiff(want, p.yaw));
            // circle-strafe a little
            inp.x = Math.sin(M.t * 1.3) * 0.6 * B.skill;
            if (boss && td < 3) inp.y = -0.6;
            return inp;
        }
    } else if (M.echo && !M.got.echo) {
        goal = { x: M.echo.x, y: M.echo.y, near: 0.6, kind: 'echo' };
    } else {
        if (!B.need || B.tick % 600 === 1) B.need = needs(G);
        const W = B.need;
        let best = null, bd = Infinity;
        for (const n of M.nodes) {
            if (n.amount <= 0) continue;
            const d = Math.hypot(n.x - p.x, n.y - p.y) - 22 * W[n.kind] + (n.species && !n.sampled && !isSequenced(G, n.species) ? -10 : 0);
            if (d < bd) { bd = d; best = n; }
        }
        // hunt when the lab needs animals or a genome is still missing
        let prey = null, pd = Infinity;
        for (const e of M.enemies) {
            if (!e.alive || ENEMIES[e.type].boss) continue;
            const sp = e.type, unseq = !isSequenced(G, sp);
            const d = Math.hypot(e.x - p.x, e.y - p.y) - 22 * W.fauna - (unseq ? 12 : 0);
            if (d < pd) { pd = d; prey = e; }
        }
        if (prey && pd < bd && S.cargo - p.carry >= 2) {
            const want = Math.atan2(prey.x - p.x, -(prey.y - p.y));
            const dd = Math.hypot(prey.x - p.x, prey.y - p.y) - ENEMIES[prey.type].r;
            if (dd < BOT.reach - 0.1) { inp.turn = clampTurn(angDiff(want, p.yaw)); if (Math.abs(angDiff(want, p.yaw)) < 0.5) inp.a = true; return inp; }
            if (S.shot && dd < 10 && Math.abs(angDiff(want, p.yaw)) < 0.3) inp.c = true;
            goal = { x: prey.x, y: prey.y, near: BOT.reach - 0.4, kind: 'prey' + prey.id };
        } else if (best) goal = { x: best.x, y: best.y, near: 1.25, use: Math.hypot(best.x - p.x, best.y - p.y) < 1.6, kind: 'node' };
        else goal = { x: BEACON.x, y: BEACON.y, near: 0.8, use: dBeacon < BEACON.r - 0.4, kind: 'home' };
    }
    const key = goal.kind + Math.round(goal.x / 2) + ',' + Math.round(goal.y / 2);
    if (!B.path || B.goal !== key || B.tick % 240 === 0) { B.path = flowField(M, goal.x, goal.y); B.goal = key; }
    const dg = Math.hypot(goal.x - p.x, goal.y - p.y);
    if (goal.use) {
        inp.turn = clampTurn(angDiff(Math.atan2(goal.x - p.x, -(goal.y - p.y)), p.yaw));
        inp.b = true;
        if (dg > goal.near) inp.y = 0.5;
        return inp;
    }
    const dir = dg < 2 ? { x: goal.x - p.x, y: goal.y - p.y } : steer(B.path, p.x, p.y);
    // unstick: if we haven't moved in a while, sidestep
    if (B.tick % 60 === 0) { const mv = Math.hypot(p.x - B.lx, p.y - B.ly); B.stuck = mv < 0.25 ? B.stuck + 1 : 0; B.lx = p.x; B.ly = p.y; }
    if (B.stuck > 2) { B.detour = 60; B.stuck = 0; }
    if (B.detour > 0) { B.detour--; inp.x = 1; inp.y = 0.4; inp.turn = 0.01; return inp; }
    return faceAndGo(B, p, Math.atan2(dir.x, -dir.y), dg > goal.near ? 1 : 0, inp);
}
const clampTurn = (d) => Math.max(-7 * STEP, Math.min(7 * STEP, d));
function faceAndGo(B, p, want, go, inp) {
    const d = angDiff(want, p.yaw);
    inp.turn = clampTurn(d);
    inp.y = go * (Math.abs(d) < 0.7 ? 1 : 0.25) * (0.7 + 0.3 * B.skill);
    return inp;
}

// ---------------------------------------------------------------- the whole loop
/** Advance the game by one bot decision. Returns the input for a step when on the planet, else null. */
export function botTick(G, B) {
    if (G.over) return null;
    if (G.talk) {
        const ch = talkChoices(G);
        if (ch) act(G, { t: 'choose', id: ch.find((c) => c.id === 'concord' && c.ok) ? 'concord' : 'purge' });
        else act(G, { t: 'next' });
        return null;
    }
    if (G.report) { act(G, { t: 'report' }); return null; }
    if (G.mode === 'mission') return missionInput(G, B);
    stationBusiness(G, B);
    if (G.over || G.talk) return null;
    if (G.bot.busy > 0) { act(G, { t: 'wait', days: G.bot.busy + 0.01 }); return null; }
    const z = pickZone(G);
    if (z >= 0) act(G, { t: 'deploy', zone: z });
    else act(G, { t: 'wait', days: 1 });
    return null;
}

void canConcord; void edenIndex; void canAfford; void RESEARCH;
