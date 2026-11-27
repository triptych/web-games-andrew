// One Shot — the simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the UI, the bot and the tests all drive it through act() and step().
//
// A level is one mothership. Its escort waves are fought as match-3 rounds: every match charges the Lance and
// fires missiles at the escorts, and the escorts shoot back. When a round is over MIRA routes the spare power
// into one stat you pick. After the last round the mothership is exposed for a short final charge, and the Lance
// fires once: speed against its evasion, the elements against its barrier, power against its armor.

import { BOARD, KINDS, ELEMENTS, STATIC, SP, TIMING, CHARGE, SHIP, ROUND, DRONE, MISSILE, DESPERATE,
    BEAM, GRADES, GRADE_ORDER, REWARD, UPGRADES, UPGRADE_MAX, UPGRADE_COST } from '../config.js';
import { makeRng } from '../rng.js';
import { BOSSES } from './data.js';
import * as B from './board.js';

const STATS = ['power', 'speed', 'thermal', 'cryo', 'volt'];
export const ROUTES = STATS;

export function newGame(seed = 1) {
    return {
        v: 1,
        seed,
        rng: makeRng(seed),
        t: 0,
        scrap: 0,
        unlocked: 0,                            // highest level that can be played (all beaten = BOSSES.length)
        best: BOSSES.map(() => '-'),            // best grade per level: '-', F, C, B, A, S
        up: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
        missions: 0,
        kills: 0,
        ended: false,
        m: null,                                // the mission in progress, or null in the hangar
        events: [],
    };
}

// ------------------------------------------------------------------ helpers the UI and the bot share
export const upgrade = (id) => UPGRADES.find((u) => u.id === id);
export const upgradeCost = (G, id) => (G.up[id] >= UPGRADE_MAX ? Infinity : UPGRADE_COST[G.up[id]]);
export const gradeRank = (g) => GRADE_ORDER.indexOf(g);
export const roundTime = (G, boss) => boss.roundTime + G.up.reactor * upgrade('reactor').per;
export const lanceTime = (G) => ROUND.lance + G.up.reactor * upgrade('reactor').per;
export const shieldCap = (G) => CHARGE.shieldCap + 15 * G.up.deflector;
const statUp = { power: 'capacitor', speed: 'coils', thermal: 'thermal', cryo: 'cryo', volt: 'volt' };

function tileGain(G, k) {
    if (k === 5) return CHARGE.shieldTile * (1 + G.up.deflector * upgrade('deflector').per);
    return CHARGE.tile * (1 + G.up[statUp[KINDS[k]]] * upgrade(statUp[KINDS[k]]).per);
}
export function rushMult(m) { return Math.min(CHARGE.rushMax, 1 + CHARGE.rushStep * Math.max(0, m.rush - 1)); }

/** What the Lance would do if it fired now: the stats, each ratio against the mothership, and the weakest. */
export function evaluate(G, m = G.m) {
    const boss = BOSSES[m.level];
    const c = m.charge;
    const f = m.desperate ? DESPERATE : 1;
    const elem = ELEMENTS.reduce((s, e) => s + c[e] * (1 - m.resist[e]), 0);
    const stats = { speed: c.speed * f, barrier: Math.max(0, elem) * f, armor: c.power * f };
    const ratios = {
        speed: stats.speed / boss.req.speed,
        barrier: stats.barrier / boss.req.barrier,
        armor: stats.armor / boss.req.armor,
    };
    const min = Math.min(ratios.speed, ratios.barrier, ratios.armor);
    return { stats, ratios, min };
}

export function gradeFor(min) {
    for (const g of GRADES) if (min >= g.min) return g.g;
    return 'F';
}

// ------------------------------------------------------------------ the mission
function newMission(G, level) {
    const boss = BOSSES[level];
    return {
        level,
        phase: 'brief',                     // brief | round | clear | lance | beam | result
        t: 0,                               // time in this phase
        round: 0,
        rounds: boss.waves.length,
        clock: 0,
        charge: { power: 0, speed: 0, thermal: 0, cryo: 0, volt: 0 },
        shield: 0,
        hull: SHIP.hull,
        maxHull: SHIP.hull,
        board: B.newBoard(G.rng),
        drones: [],
        missiles: [],
        nid: 1,
        spawned: 0,
        killed: 0,                          // this round
        kills: 0,                           // this mission
        spawnT: 0,
        rush: 0,
        rushT: 0,
        maxRush: 0,
        maxDepth: 0,
        timeouts: 0,
        spare: 0,
        resist: { ...boss.resist },
        shiftIdx: 0,
        shiftT: boss.shift ? boss.shift.every : 0,
        jamT: boss.jam ? boss.jam.first : 0,
        lowHull: false,
        fireQueued: false,
        desperate: false,
        firedWith: 0,                       // the final-window clock when the Lance fired
        shot: null,
        stage: 0,
        result: null,
    };
}

function startRound(G) {
    const m = G.m, boss = BOSSES[m.level];
    m.phase = 'round';
    m.t = 0;
    m.clock = roundTime(G, boss);
    m.spawned = 0;
    m.killed = 0;
    m.spawnT = 0.8;
    m.drones = [];
    m.missiles = [];
    m.board.pending = null;
    G.events.push({ type: 'round', round: m.round, of: m.rounds, wave: boss.waves[m.round].name });
}

function endRound(G, cleared) {
    const m = G.m, wave = BOSSES[m.level].waves[m.round];
    if (!cleared) {
        // the escorts still flying make one last pass
        m.timeouts++;
        for (const d of m.drones) hit(G, wave.dmg, d.id);
        if (m.phase !== 'round') return;    // the last pass brought the ship down
    }
    m.spare = cleared ? m.clock : 0;
    m.drones = [];
    m.missiles = [];
    m.phase = 'clear';
    m.t = 0;
    G.events.push({ type: 'roundEnd', round: m.round, cleared, spare: m.spare, killed: m.killed, of: wave.count });
}

/** The charge MIRA routes when you pick a stat after a round. */
export const routeAmount = (m) => Math.round(ROUND.routeBase + m.spare * ROUND.routePerSec);

/** The stat that most needs the spare power: the bot's pick and the UI's suggestion. */
export function suggestRoute(G) {
    const m = G.m, boss = BOSSES[m.level], { ratios } = evaluate(G);
    const elemBest = ELEMENTS.reduce((a, e) => (m.resist[e] < m.resist[a] ? e : a), ELEMENTS[0]);
    const opts = [['speed', ratios.speed], ['power', ratios.armor], [elemBest, ratios.barrier]];
    // weigh by how much one routing moves each ratio
    const per = { speed: 1 / boss.req.speed, power: 1 / boss.req.armor, [elemBest]: (1 - m.resist[elemBest]) / boss.req.barrier };
    opts.sort((a, b) => a[1] - b[1] || per[b[0]] - per[a[0]]);
    return opts[0][0];
}

function doFire(G) {
    const m = G.m;
    m.fireQueued = false;
    m.firedWith = m.phase === 'lance' ? m.clock : 0;
    m.phase = 'beam';
    m.t = 0;
    m.stage = 0;
    m.drones = [];
    m.missiles = [];
    m.board.pending = null;
    const ev = evaluate(G);
    m.shot = { ...ev, resist: { ...m.resist }, desperate: m.desperate, destroyed: ev.min >= 1 };
    G.events.push({ type: 'fire', desperate: m.desperate, ratios: ev.ratios, min: ev.min });
}

function finish(G) {
    const m = G.m, boss = BOSSES[m.level], shot = m.shot;
    const grade = shot.destroyed ? gradeFor(shot.min) : 'F';
    const medals = [];
    if (shot.destroyed) {
        if (m.hull >= m.maxHull && !m.desperate) medals.push('flawless');
        if (m.firedWith >= 6) medals.push('quickdraw');
        if (!m.timeouts && !m.desperate) medals.push('ace');
    }
    const prev = G.best[m.level];
    const improved = gradeRank(grade) > gradeRank(prev === '-' ? 'F' : prev) || prev === '-';
    let scrap;
    if (shot.destroyed) {
        const mult = GRADES.find((g) => g.g === grade).mult;
        scrap = (boss.reward * mult + m.kills * REWARD.perDrone) * (1 + 0.1 * medals.length);
        if (!improved) scrap *= REWARD.replay;
    } else {
        scrap = boss.reward * REWARD.consolation * Math.min(1, shot.min) + m.kills * 2;
    }
    scrap = Math.round(scrap);
    G.scrap += scrap;
    G.missions++;
    G.kills += m.kills;
    if (gradeRank(grade) > gradeRank(prev) || prev === '-') G.best[m.level] = grade;
    const firstClear = shot.destroyed && m.level === G.unlocked;
    if (shot.destroyed) G.unlocked = Math.max(G.unlocked, m.level + 1);
    const ending = shot.destroyed && m.level === BOSSES.length - 1 && !G.ended;
    if (ending) G.ended = true;
    m.result = { grade, medals, scrap, destroyed: shot.destroyed, min: shot.min, ratios: shot.ratios, improved, firstClear, ending };
    m.phase = 'result';
    m.t = 0;
    G.events.push({ type: 'result', ...m.result, level: m.level });
}

// ------------------------------------------------------------------ hits, drones, missiles
function hit(G, dmg, from) {
    const m = G.m;
    const absorbed = Math.min(m.shield, dmg);
    m.shield -= absorbed;
    const rest = dmg - absorbed;
    let leak = 0, stat = null;
    if (rest > 0) {
        m.hull = Math.max(0, m.hull - rest);
        stat = STATS.reduce((a, s) => (m.charge[s] > m.charge[a] ? s : a), STATS[0]);
        leak = Math.min(m.charge[stat], rest * DRONE.leak);
        m.charge[stat] -= leak;
    }
    G.events.push({ type: 'hit', from, dmg, absorbed, rest, leak, stat, hull: m.hull });
    if (!m.lowHull && m.hull > 0 && m.hull <= m.maxHull * 0.3) { m.lowHull = true; G.events.push({ type: 'lowHull' }); }
    if (m.hull <= 0 && (m.phase === 'round' || m.phase === 'lance')) {
        m.desperate = true;
        G.events.push({ type: 'downed' });
        doFire(G);
    }
}

function stepDrones(G, dt) {
    const m = G.m, wave = BOSSES[m.level].waves[m.round];
    if (m.spawned < wave.count && m.drones.length < wave.max) {
        m.spawnT -= dt;
        if (m.spawnT <= 0) {
            const d = { id: m.nid++, lane: G.rng.range(-1, 1), alt: G.rng.range(0, 1), a: 0, hp: wave.hp, maxHp: wave.hp, st: 'in', t: DRONE.approach };
            m.drones.push(d);
            m.spawned++;
            m.spawnT = ROUND.gap;
            G.events.push({ type: 'droneIn', id: d.id });
        }
    }
    for (const d of [...m.drones]) {
        d.t -= dt;
        if (d.st === 'in') {
            d.a = Math.min(1, 1 - d.t / DRONE.approach);
            if (d.t <= 0) { d.st = 'hold'; d.t = G.rng.range(0.3, 1.4); }
        } else if (d.st === 'hold' && d.t <= 0) {
            d.st = 'aim'; d.t = DRONE.aim;
            G.events.push({ type: 'aim', id: d.id });
        } else if (d.st === 'aim' && d.t <= 0) {
            d.st = 'hold'; d.t = DRONE.refire;
            G.events.push({ type: 'shot', id: d.id });
            hit(G, wave.dmg, d.id);
            if (m.phase !== 'round') return;
        }
    }
}

function launchMissiles(G, n, from) {
    const m = G.m;
    const dmg = MISSILE.dmg * (1 + G.up.missiles * upgrade('missiles').per);
    for (let k = 0; k < n; k++) {
        // the most dangerous escort that the missiles already flying won't finish
        const pend = (d) => m.missiles.reduce((s, x) => s + (x.target === d.id ? x.dmg : 0), 0);
        const live = m.drones.filter((d) => d.hp - pend(d) > 0);
        if (!live.length) break;
        live.sort((a, b) => (b.st === 'aim') - (a.st === 'aim') || b.a - a.a || a.id - b.id);
        const t = live[0];
        const ms = { id: m.nid++, target: t.id, t: MISSILE.flight, dmg, from };
        m.missiles.push(ms);
        G.events.push({ type: 'missile', id: ms.id, target: t.id, from });
    }
}

function stepMissiles(G, dt) {
    const m = G.m;
    for (let i = m.missiles.length - 1; i >= 0; i--) {
        const ms = m.missiles[i];
        ms.t -= dt;
        if (ms.t > 0) continue;
        m.missiles.splice(i, 1);
        const d = m.drones.find((x) => x.id === ms.target);
        if (!d) continue;
        d.hp -= ms.dmg;
        G.events.push({ type: 'boom', id: d.id, dead: d.hp <= 0 });
        if (d.hp <= 0) {
            m.drones = m.drones.filter((x) => x !== d);
            m.killed++;
            m.kills++;
            G.events.push({ type: 'droneDown', id: d.id });
        }
    }
}

// ------------------------------------------------------------------ the board
function doSwap(G, a, b) {
    const m = G.m, bd = m.board;
    if (!B.adjacent(a, b)) return false;
    const ta = bd.cells[a], tb = bd.cells[b];
    if (!ta || !tb || ta.k === STATIC || tb.k === STATIC) { G.events.push({ type: 'swapBad', a, b }); return false; }
    bd.cells[a] = tb; bd.cells[b] = ta;
    bd.swap = { a, b };
    bd.phase = 'swap';
    bd.t = TIMING.swap;
    G.events.push({ type: 'swap', a, b, ida: ta.id, idb: tb.id });
    return true;
}

function onClear(G, res) {
    const m = G.m, bd = m.board;
    const mult = (1 + CHARGE.comboStep * bd.depth) * rushMult(m);
    const gain = { power: 0, speed: 0, thermal: 0, cryo: 0, volt: 0, shield: 0 };
    for (const t of res.cleared) {
        if (t.k === STATIC) continue;
        gain[KINDS[t.k]] += tileGain(G, t.k) * mult;
    }
    for (const s of STATS) m.charge[s] += gain[s];
    m.shield = Math.min(shieldCap(G), m.shield + gain.shield);
    m.maxDepth = Math.max(m.maxDepth, bd.depth);
    m.maxRush = Math.max(m.maxRush, m.rush);
    G.events.push({ type: 'clear', tiles: res.cleared, created: res.created, blasts: res.blasts, depth: bd.depth, rush: m.rush, mult, gain });
    if (m.phase === 'round') {
        const n = Math.max(1, Math.floor(res.cleared.length / 3)) + res.blasts.length;
        launchMissiles(G, n, res.cleared[Math.floor(res.cleared.length / 2)].i);
    }
    bd.phase = 'clear';
    bd.t = TIMING.clear;
}

function settle(G) {
    const m = G.m, bd = m.board;
    bd.phase = 'idle';
    bd.depth = 0;
    bd.swap = null;
    m.rushT = TIMING.rushWindow;
    if (!B.hasMove(bd.cells)) {
        B.shuffle(bd, G.rng);
        G.events.push({ type: 'shuffle', cells: bd.cells.map((t) => ({ ...t })) });
    }
}

function stepBoard(G, dt) {
    const m = G.m, bd = m.board;
    if (bd.phase === 'idle') {
        if (m.rushT > 0) { m.rushT -= dt; if (m.rushT <= 0) m.rush = 0; }
        if (bd.pending && !m.fireQueued) { const p = bd.pending; bd.pending = null; doSwap(G, p.a, p.b); }
        return;
    }
    bd.t -= dt;
    if (bd.t > 0) return;
    if (bd.phase === 'swap') {
        const res = B.clearRuns(bd, [bd.swap.a, bd.swap.b]);
        if (!res) {
            const { a, b } = bd.swap;
            [bd.cells[a], bd.cells[b]] = [bd.cells[b], bd.cells[a]];
            bd.phase = 'unswap';
            bd.t = TIMING.swap;
            G.events.push({ type: 'swapFail', a, b });
        } else {
            m.rush = m.rushT > 0 ? m.rush + 1 : 1;
            m.rushT = 0;
            bd.depth = 0;
            onClear(G, res);
        }
    } else if (bd.phase === 'unswap') {
        bd.phase = 'idle';
        bd.swap = null;
    } else if (bd.phase === 'clear') {
        const g = B.gravity(bd, G.rng);
        G.events.push({ type: 'fall', ...g });
        bd.phase = 'fall';
        bd.t = TIMING.fall;
    } else if (bd.phase === 'fall') {
        const res = B.clearRuns(bd, []);
        if (res) { bd.depth++; onClear(G, res); } else settle(G);
    }
}

function stepJam(G, dt) {
    const m = G.m, jam = BOSSES[m.level].jam;
    if (!jam) return;
    m.jamT -= dt;
    if (m.jamT > 0 || m.board.phase !== 'idle') return;
    m.jamT = jam.every;
    const cells = m.board.cells;
    if (B.countStatic(cells) >= jam.max) return;
    const free = cells.map((t, i) => (t && t.k !== STATIC && !t.sp ? i : -1)).filter((i) => i >= 0);
    const i = free[Math.floor(G.rng() * free.length)];
    cells[i].k = STATIC;
    G.events.push({ type: 'jam', i, id: cells[i].id });
    if (!B.hasMove(cells)) { B.shuffle(m.board, G.rng); G.events.push({ type: 'shuffle', cells: cells.map((t) => ({ ...t })) }); }
}

function stepShift(G, dt) {
    const m = G.m, sh = BOSSES[m.level].shift;
    if (!sh) return;
    m.shiftT -= dt;
    if (m.shiftT > 0) return;
    m.shiftT = sh.every;
    m.shiftIdx = (m.shiftIdx + 1) % ELEMENTS.length;
    ELEMENTS.forEach((e, j) => { m.resist[e] = sh.set[(j + m.shiftIdx) % sh.set.length]; });
    G.events.push({ type: 'shift', resist: { ...m.resist } });
}

/** The barrier's tuning after the next shift (for the HUD's "next" readout). */
export function nextResist(G) {
    const m = G.m, sh = BOSSES[m.level].shift;
    if (!sh) return null;
    const n = (m.shiftIdx + 1) % ELEMENTS.length;
    return Object.fromEntries(ELEMENTS.map((e, j) => [e, sh.set[(j + n) % sh.set.length]]));
}

// ------------------------------------------------------------------ commands
/** Apply one command. Returns true if it did something. */
export function act(G, cmd) {
    const m = G.m;
    switch (cmd.t) {
        case 'start': {
            const lv = cmd.level | 0;
            if (m || lv < 0 || lv >= BOSSES.length || lv > G.unlocked) return false;
            G.m = newMission(G, lv);
            G.events.push({ type: 'brief', level: lv });
            return true;
        }
        case 'launch':
            if (!m || m.phase !== 'brief') return false;
            m.round = 0;
            startRound(G);
            return true;
        case 'swap': {
            if (!m || (m.phase !== 'round' && m.phase !== 'lance') || m.fireQueued) return false;
            if (!B.adjacent(cmd.a, cmd.b)) return false;
            // a swap made while the board is still settling is kept and played the moment it settles
            if (m.board.phase !== 'idle') { m.board.pending = { a: cmd.a, b: cmd.b }; return true; }
            return doSwap(G, cmd.a, cmd.b);
        }
        case 'fire':
            if (!m || m.phase !== 'lance' || m.fireQueued) return false;
            m.fireQueued = true;
            m.board.pending = null;
            return true;
        case 'route': {
            if (!m || m.phase !== 'clear') return false;
            const stat = STATS.includes(cmd.stat) ? cmd.stat : suggestRoute(G);
            const amount = routeAmount(m);
            m.charge[stat] += amount;
            G.events.push({ type: 'route', stat, amount });
            m.round++;
            if (m.round < m.rounds) startRound(G);
            else {
                m.phase = 'lance';
                m.t = 0;
                m.clock = lanceTime(G);
                m.drones = [];
                G.events.push({ type: 'exposed' });
            }
            return true;
        }
        case 'skip':
            if (!m || m.phase !== 'beam') return false;
            stepBeam(G, BEAM.end + 1);
            return true;
        case 'done':
            if (!m || m.phase !== 'result') return false;
            G.m = null;
            G.events.push({ type: 'hangar' });
            return true;
        case 'retry': {
            if (!m || m.phase !== 'result') return false;
            const lv = m.level;
            G.m = null;
            return act(G, { t: 'start', level: lv });
        }
        case 'abort':
            if (!m || m.phase === 'beam' || m.phase === 'result') return false;
            G.m = null;
            G.events.push({ type: 'hangar', aborted: true });
            return true;
        case 'buy': {
            if (m) return false;
            const u = upgrade(cmd.id);
            if (!u) return false;
            const cost = upgradeCost(G, u.id);
            if (G.scrap < cost) return false;
            G.scrap -= cost;
            G.up[u.id]++;
            G.events.push({ type: 'buy', id: u.id, level: G.up[u.id] });
            return true;
        }
    }
    return false;
}

function stepBeam(G, dt) {
    const m = G.m;
    m.t += dt;
    const keys = ['speed', 'barrier', 'armor'];
    while (m.stage < 3 && m.t >= BEAM.stages[m.stage]) {
        const k = keys[m.stage];
        G.events.push({ type: 'stage', stage: m.stage, key: k, ratio: m.shot.ratios[k] });
        m.stage++;
    }
    if (m.stage === 3 && m.t >= BEAM.verdict) {
        m.stage = 4;
        G.events.push({ type: m.shot.destroyed ? 'destroyed' : 'survived' });
    }
    if (m.t >= BEAM.end) finish(G);
}

/** Advance one fixed step. */
export function step(G, dt) {
    G.t += dt;
    const m = G.m;
    if (!m) return;
    m.t += m.phase === 'beam' ? 0 : dt;
    if (m.phase === 'round') {
        m.clock = Math.max(0, m.clock - dt);
        stepBoard(G, dt);
        if (m.phase !== 'round') return;
        stepMissiles(G, dt);
        stepDrones(G, dt);
        if (m.phase !== 'round') return;
        stepJam(G, dt);
        stepShift(G, dt);
        const wave = BOSSES[m.level].waves[m.round];
        const idle = m.board.phase === 'idle';
        if (idle && m.killed >= wave.count) endRound(G, true);
        else if (idle && m.clock <= 0) endRound(G, false);
    } else if (m.phase === 'lance') {
        m.clock = Math.max(0, m.clock - dt);
        stepBoard(G, dt);
        stepShift(G, dt);
        if (m.clock <= 0) m.fireQueued = true;
        if (m.fireQueued && m.board.phase === 'idle') doFire(G);
    } else if (m.phase === 'beam') {
        stepBeam(G, dt);
    }
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    return G;
}

export { BOARD, SP, STATIC };
