// A battle: the board, the party, the enemy and every rule that moves between them. Pure.
//
// Everything resolves at once inside a command: a swap clears, cascades, refills, lets newly
// arrived heroes bind the stones around them, then the enemy takes its turn. Each step pushes an
// event to G.events, which the view plays back as animation.

import { PARTY, CALLS, TOKEN, FOE } from '../config.js';
import { rnd, rint, rpick, rshuffle } from '../rng.js';
import { HERO, ENEMIES, STAGES, REGIONS, OATHS, NC, NS, elemMult, RARITY } from './data.js';
import { W, Hh, idx, xy, isStone, findClears, findMoves, movable, adjacent, neighbours4, areaCells } from './board.js';

const N = W * Hh;
export const snap = (t) => (t ? { ...t } : null);

// ------------------------------------------------------------------ heroes
export function heroStats(G, id) {
    const h = HERO[id], e = G.roster[id] || { lv: 1, rank: 0 };
    const k = (1 + 0.08 * (e.lv - 1)) * (1 + 0.12 * e.rank);
    return { hp: Math.round(RARITY[h.r].hp * k), atk: Math.round(RARITY[h.r].atk * k * 10) / 10 };
}

/** Bind a hero: a new hero joins the roster, a duplicate raises its rank. */
export function recruit(G, id) {
    const e = G.roster[id];
    if (!e) {
        G.roster[id] = { lv: 1, xp: 0, rank: 0, at: G.stats.recruits };
        if (G.party.length < PARTY.size) G.party.push(id);
    } else e.rank = Math.min(5, e.rank + 1);
    G.stats.recruits++;
    G.events.push({ type: 'recruit', hero: id, isNew: !e, rank: G.roster[id].rank });
}

// ------------------------------------------------------------------ tokens
function weighted(G, table) {
    let r = rnd(G), last = 'hue';
    for (const k in table) { last = k; r -= table[k]; if (r < 0) return k; }
    return last;
}
function newStone(G, B) {
    return { id: G.nid++, c: rint(G, 0, NC - 1), s: rint(G, 0, NS - 1), o: weighted(G, REGIONS[B.region].stones) };
}
function heroToken(G, id) {
    const h = HERO[id];
    const t = { id: G.nid++, c: h.c, s: h.s, o: h.oath, h: id };
    if (h.oath === 'vigil') t.wake = h.wake;
    return t;
}
const heroesOnBoard = (B) => B.g.reduce((n, t) => n + (t?.h ? 1 : 0), 0);

// ------------------------------------------------------------------ setup
export function startBattle(G, stage) {
    const st = STAGES[stage];
    const B = G.B = {
        stage, region: st.region, wave: 0, waves: st.waves.slice(),
        enemy: null, g: [], party: G.party.map((id) => ({ id, charge: 0 })),
        hp: 0, maxHp: 0, shield: 0, power: new Array(NC).fill(0),
        turn: 0, callIn: CALLS.firstIn, wanderIn: rint(G, 5, 9), pending: [], placed: [],
        guest: st.guest && !G.roster[st.guest] ? st.guest : null,
        recruited: [], dmg: 0, over: null, combos: 0, best: 0,
    };
    B.maxHp = PARTY.baseHp;
    for (const p of B.party) {
        const s = heroStats(G, p.id);
        B.maxHp += s.hp;
        B.power[HERO[p.id].c] += s.atk;
    }
    B.hp = B.maxHp;
    // a board with no matches waiting and at least one move
    for (let tries = 0; tries < 200; tries++) {
        B.g = [];
        for (let i = 0; i < N; i++) {
            let t = newStone(G, B);
            B.g.push(t);
            for (let k = 0; k < 20 && findClears(B.g, 1).clear.length; k++) { t = newStone(G, B); B.g[i] = t; }
        }
        if (!findClears(B.g, 1).clear.length && findMoves(B.g, 1).length) break;
    }
    G.events.push({ type: 'battle', stage, board: B.g.map(snap) });
    spawnEnemy(G);
    // the first hero waiting in the calling arrives with the board
    if (G.calls.length) placeHero(G, G.calls.shift(), 'call');
    settle(G, 2);
    ensureMoves(G);
    return B;
}

function spawnEnemy(G) {
    const B = G.B, def = ENEMIES[B.waves[B.wave]];
    const lvl = 1 + 0.06 * (G.cleared[B.stage] ? Math.min(G.cleared[B.stage], 5) : 0);  // replays get a little tougher
    B.enemy = { id: def.id, c: def.c, hp: Math.round(def.hp * lvl * FOE.hp), maxHp: Math.round(def.hp * lvl * FOE.hp), atk: def.atk * lvl * FOE.atk, cd: def.cd, cdMax: def.cd, pi: 0, rage: 0 };
    G.events.push({ type: 'enemy', enemy: { ...B.enemy }, wave: B.wave, waves: B.waves.length });
}

/** Put a hero straight onto the board (battle start), on a stone in the middle rows. */
function placeHero(G, id, src) {
    const B = G.B;
    const cells = [];
    for (let i = 0; i < N; i++) { const [, y] = xy(i); if (y >= 1 && y <= Hh - 2 && isStone(B.g[i])) cells.push(i); }
    if (!cells.length) return;
    const i = rpick(G, cells);
    const old = B.g[i];
    const t = heroToken(G, id);
    B.g[i] = t;
    B.placed.push({ id, src, tid: t.id });
    G.events.push({ type: 'place', i, old: old.id, tok: snap(t) });
    arrive(G, i);
}

// ------------------------------------------------------------------ effects
function stonesIn(B, cells, pred = () => true) { return cells.filter((k) => isStone(B.g[k]) && pred(B.g[k])); }

/** Apply one board effect. Returns the changed tokens (snapshots, after). */
function boardFx(G, kind, area, n, origin, who) {
    const B = G.B, cells = areaCells(area, origin);
    const ch = new Map();
    const touch = (k) => ch.set(k, B.g[k]);
    const h = who ? HERO[who] : null;
    const pickN = (list, m) => rshuffle(G, list).slice(0, m);
    if (kind === 'paint') {
        for (const k of pickN(stonesIn(B, cells, (t) => t.c !== h.c && t.o !== 'wild'), n)) { B.g[k].c = h.c; touch(k); }
    } else if (kind === 'mould') {
        for (const k of pickN(stonesIn(B, cells, (t) => t.s !== h.s && t.o !== 'wild'), n)) { B.g[k].s = h.s; touch(k); }
    } else if (kind === 'bind') {
        const o = OATHS[h.oath].stone ? h.oath : 'hue';
        for (const k of stonesIn(B, cells, (t) => t.o !== o && t.o !== 'wild')) { B.g[k].o = o; touch(k); }
    } else if (kind === 'unbind') {
        for (const k of stonesIn(B, cells, (t) => t.o !== 'hue')) { B.g[k].o = 'hue'; touch(k); }
    } else if (kind === 'wild') {
        for (const k of pickN(stonesIn(B, cells, (t) => t.o !== 'wild'), n)) { B.g[k].o = 'wild'; touch(k); }
    } else if (kind === 'scatter') {
        const ks = stonesIn(B, cells);
        const attrs = rshuffle(G, ks.map((k) => [B.g[k].c, B.g[k].s, B.g[k].o]));
        ks.forEach((k, j) => { const t = B.g[k]; [t.c, t.s, t.o] = attrs[j]; touch(k); });
    } else if (kind === 'shatter' || kind === 'cleanse') {
        for (const k of cells) {
            const t = B.g[k];
            if (!t) continue;
            if (t.rb) { Object.assign(t, newStone(G, B), { id: t.id, rb: false }); touch(k); }
            if (t.fz) { t.fz = false; touch(k); }
            if (kind === 'cleanse' && isStone(t) && t.o !== 'hue' && t.o !== 'wild') { t.o = 'hue'; touch(k); }
        }
    } else if (kind === 'petrify') {
        for (const k of pickN(stonesIn(B, cells), n)) { Object.assign(B.g[k], { rb: true, fz: false }); touch(k); }
    } else if (kind === 'freeze') {
        for (const k of pickN(cells.filter((q) => B.g[q] && !B.g[q].rb && !B.g[q].fz), n)) { B.g[k].fz = true; touch(k); }
    } else if (kind === 'hex') {
        for (const k of pickN(stonesIn(B, cells, (t) => t.o === 'hue' || t.o === 'form'), n)) { B.g[k].o = 'twin'; touch(k); }
    } else if (kind === 'blight') {
        const c = B.enemy.c;
        for (const k of pickN(stonesIn(B, cells, (t) => t.c !== c && t.o !== 'wild'), n)) { B.g[k].c = c; touch(k); }
    } else if (kind === 'oathbind') {
        const o = REGIONS[B.region].bindOath;
        for (const k of pickN(stonesIn(B, cells, (t) => t.o !== o && t.o !== 'wild'), n)) { B.g[k].o = o; touch(k); }
    } else if (kind === 'scramble') {
        const ks = stonesIn(B, cells);
        const attrs = rshuffle(G, ks.map((k) => [B.g[k].c, B.g[k].s, B.g[k].o]));
        ks.forEach((k, j) => { const t = B.g[k]; [t.c, t.s, t.o] = attrs[j]; touch(k); });
    }
    return [...ch.entries()].map(([k, t]) => ({ i: k, tok: snap(t) }));
}

/** Party-wide or enemy effects (no cells). */
function metaFx(G, kind, n) {
    const B = G.B;
    if (kind === 'charge') for (const p of B.party) p.charge = Math.min(HERO[p.id].skill.cost, p.charge + n);
    else if (kind === 'delay') { B.enemy.cd += n; G.events.push({ type: 'delay', n, cd: B.enemy.cd }); }
}

function arrive(G, i) {
    const B = G.B, t = B.g[i], h = HERO[t.h];
    G.events.push({ type: 'arrive', i, id: t.id, hero: t.h });
    for (const [kind, area, n] of h.arrive.fx) {
        if (area === 'party' || area === 'enemy') { metaFx(G, kind, n); G.events.push({ type: 'change', cause: 'arrive', who: t.h, kind, at: i, changes: [] }); continue; }
        const changes = boardFx(G, kind, area, n, i, t.h);
        G.events.push({ type: 'change', cause: 'arrive', who: t.h, kind, at: i, changes });
    }
}

// ------------------------------------------------------------------ damage
const comboMult = (combo) => 1 + TOKEN.comboStep * (combo - 1);

function hurt(G, dmg) {
    const B = G.B;
    if (!B.enemy || B.enemy.hp <= 0) return 0;
    dmg = Math.max(1, Math.round(dmg));
    B.enemy.hp = Math.max(0, B.enemy.hp - dmg);
    B.dmg += dmg;
    return dmg;
}

function charge(B, c, n) {
    for (const p of B.party) {
        if (c < 0 || HERO[p.id].c === c) p.charge = Math.min(HERO[p.id].skill.cost, p.charge + n);
    }
}

// ------------------------------------------------------------------ resolution
/** One clearing step. Returns false when nothing cleared. */
function clearStep(G, combo) {
    const B = G.B, g = B.g;
    const { clear } = findClears(g, combo);
    if (!clear.length) return false;
    const gone = new Map();   // index → kind
    for (const i of clear) gone.set(i, g[i].o === 'ring' ? 'ring' : 'match');
    const hit = new Set(clear);
    const wakes = [], unfrozen = [];
    for (let i = 0; i < N; i++) {
        const t = g[i];
        if (!t || gone.has(i)) continue;
        const near = neighbours4(i).some((j) => hit.has(j));
        if (!near) continue;
        if (t.rb) gone.set(i, 'rubble');
        else if (t.o === 'vigil') {
            t.wake--;
            if (t.wake <= 0) gone.set(i, 'woke'); else wakes.push({ id: t.id, wake: t.wake });
        }
        if (t.fz && !gone.has(i)) { t.fz = false; unfrozen.push(t.id); }
    }
    const e = B.enemy;
    let dmg = 0;
    const cells = [], recruits = [];
    const maxPow = Math.max(...B.power);
    for (const [i, kind] of gone) {
        const t = g[i];
        cells.push({ i, id: t.id, kind, h: t.h || null, c: t.c, o: t.o });
        if (kind === 'rubble') continue;
        if (t.h) {
            const h = HERO[t.h];
            dmg += TOKEN.recruitDmg * h.r * comboMult(combo) * elemMult(h.c, e.c);
            charge(B, h.c, 3);
            recruits.push(t.h);
        } else if (t.o === 'wild') {
            dmg += (TOKEN.base + maxPow) * comboMult(combo);
            charge(B, -1, 1);
        } else {
            dmg += (TOKEN.base + B.power[t.c]) * comboMult(combo) * elemMult(t.c, e.c);
            charge(B, t.c, 1);
        }
    }
    for (const i of gone.keys()) g[i] = null;
    const dealt = hurt(G, dmg);
    B.combos++;
    B.best = Math.max(B.best, combo);
    G.stats.cleared += cells.length;
    G.events.push({ type: 'clear', combo, cells, wakes, unfrozen, dmg: dealt, ehp: e.hp });
    B.placed = B.placed.filter((p) => !cells.some((c) => c.id === p.tid));
    for (const id of recruits) {
        B.recruited.push(id);
        recruit(G, id);
    }
    return true;
}

/** Drop everything down, then fill the gaps from the far edge. Heroes waiting arrive here. */
function fall(G) {
    const B = G.B, g = B.g;
    const moves = [], spawns = [], arrivals = [];
    for (let x = 0; x < W; x++) {
        let wy = Hh - 1;
        for (let y = Hh - 1; y >= 0; y--) {
            const t = g[idx(x, y)];
            if (!t) continue;
            if (wy !== y) { g[idx(x, wy)] = t; g[idx(x, y)] = null; moves.push({ id: t.id, i: idx(x, wy) }); }
            wy--;
        }
        const n = wy + 1;
        for (let y = wy; y >= 0; y--) {
            let t;
            if (B.pending.length && heroesOnBoard(B) < CALLS.maxOnBoard) {
                const p = B.pending.shift();
                t = heroToken(G, p.id);
                B.placed.push({ id: p.id, src: p.src, tid: t.id });
                arrivals.push(idx(x, y));
            } else t = newStone(G, B);
            g[idx(x, y)] = t;
            spawns.push({ i: idx(x, y), from: y - n, tok: snap(t) });
        }
    }
    if (moves.length || spawns.length) G.events.push({ type: 'fall', moves, spawns });
    for (const i of arrivals) arrive(G, i);
}

/** Clear, fall and arrive until the board is still. */
function settle(G, combo) {
    let n = 0;
    while (clearStep(G, combo) && n++ < 60) {
        fall(G);
        combo++;
    }
}

function ensureMoves(G) {
    const B = G.B;
    if (findMoves(B.g, 1).length) return;
    // shuffle the stones (heroes keep their places) until there is a move and nothing waiting
    const ks = [];
    for (let i = 0; i < N; i++) if (isStone(B.g[i])) ks.push(i);
    for (let tries = 0; tries < 80; tries++) {
        const attrs = rshuffle(G, ks.map((k) => [B.g[k].c, B.g[k].s, B.g[k].o]));
        ks.forEach((k, j) => { [B.g[k].c, B.g[k].s, B.g[k].o] = attrs[j]; });
        if (tries > 40) for (const k of ks) Object.assign(B.g[k], { c: rint(G, 0, NC - 1), s: rint(G, 0, NS - 1), o: 'hue' });
        if (!findClears(B.g, 1).clear.length && findMoves(B.g, 1).length) break;
    }
    G.events.push({ type: 'shuffle', changes: ks.map((k) => ({ i: k, tok: snap(B.g[k]) })) });
}

// ------------------------------------------------------------------ the enemy
function enemyTurn(G) {
    const B = G.B, e = B.enemy, def = ENEMIES[e.id];
    const step = def.pattern[e.pi % def.pattern.length];
    e.pi++;
    e.cd = e.cdMax;
    const [kind, arg] = step.split(':');
    const ev = { type: 'enemyTurn', kind, enemy: e.id };
    if (kind === 'strike') {
        let dmg = Math.round(e.atk * Math.pow(1.25, e.rage));
        const blocked = Math.min(B.shield, dmg);
        B.shield -= blocked;
        dmg -= blocked;
        B.hp = Math.max(0, B.hp - dmg);
        Object.assign(ev, { dmg, blocked, hp: B.hp });
        G.events.push(ev);
    } else if (kind === 'heal') {
        const n = Math.round(e.maxHp * +arg);
        e.hp = Math.min(e.maxHp, e.hp + n);
        Object.assign(ev, { n, ehp: e.hp });
        G.events.push(ev);
    } else if (kind === 'drain') {
        for (const p of B.party) p.charge = Math.floor(p.charge / 2);
        G.events.push(ev);
    } else if (kind === 'enrage') {
        e.rage++;
        G.events.push(ev);
    } else {
        G.events.push(ev);
        const fx = kind === 'bind' ? 'oathbind' : kind;
        const changes = boardFx(G, fx, 'all', +arg || 0, -1, null);
        G.events.push({ type: 'change', cause: 'enemy', who: e.id, kind: fx, at: -1, changes });
        settle(G, 2);
    }
}

// ------------------------------------------------------------------ turns
function afterAction(G, turn) {
    const B = G.B;
    if (B.enemy.hp <= 0) { nextWave(G); if (B.over) return; }
    else if (turn) {
        B.turn++;
        tickCalls(G);
        B.enemy.cd--;
        if (B.enemy.cd <= 0) {
            enemyTurn(G);
            if (B.hp <= 0) { endBattle(G, 'loss'); return; }
            if (B.enemy.hp <= 0) { nextWave(G); if (B.over) return; }
        }
    }
    ensureMoves(G);
}

function tickCalls(G) {
    const B = G.B;
    if (B.guest && B.turn === 1) { B.pending.push({ id: B.guest, src: 'guest' }); B.guest = null; }
    if (B.pending.length) return;
    if (--B.callIn <= 0 && G.calls.length && heroesOnBoard(B) < CALLS.maxOnBoard) {
        B.pending.push({ id: G.calls.shift(), src: 'call' });
        B.callIn = CALLS.every;
    }
    if (--B.wanderIn === 0 && heroesOnBoard(B) < CALLS.maxOnBoard) {
        const reg = B.region;
        const pool = Object.values(HERO).filter((h) => (h.r === 3 || (h.r === 4 && rnd(G) < 0.15)) && (h.c === REGIONS[reg].c || rnd(G) < 0.35));
        if (pool.length) B.pending.push({ id: rpick(G, pool).id, src: 'wander' });
    }
}

function nextWave(G) {
    const B = G.B;
    G.events.push({ type: 'defeat', enemy: B.enemy.id, wave: B.wave });
    B.wave++;
    if (B.wave >= B.waves.length) { endBattle(G, 'win'); return; }
    spawnEnemy(G);
}

/** The battle is over: heroes called but not bound go back to the calling. */
function endBattle(G, result) {
    const B = G.B;
    B.over = result;
    const back = [];
    for (const p of B.placed) {
        if (p.src === 'call' && B.g.some((t) => t?.h === p.id && t.id === p.tid)) back.push(p.id);
    }
    for (const p of B.pending) if (p.src === 'call') back.push(p.id);
    G.calls.unshift(...back);
    G.events.push({ type: result, stage: B.stage });
}

// ------------------------------------------------------------------ commands
export function swap(G, i, j) {
    const B = G.B;
    if (!B || B.over) return { ok: false, why: 'no battle' };
    if (i < 0 || j < 0 || i >= N || j >= N || !adjacent(i, j)) return { ok: false, why: 'not adjacent' };
    if (!movable(B.g[i]) || !movable(B.g[j])) return { ok: false, why: B.g[i]?.fz || B.g[j]?.fz ? 'frozen' : 'stuck' };
    const g = B.g;
    [g[i], g[j]] = [g[j], g[i]];
    if (!findClears(g, 1).clear.length) {
        [g[i], g[j]] = [g[j], g[i]];
        G.events.push({ type: 'swap', i, j, ok: false, a: g[i].id, b: g[j].id });
        return { ok: false, why: 'no match' };
    }
    G.events.push({ type: 'swap', i, j, ok: true, a: g[j].id, b: g[i].id });
    G.stats.moves++;
    settle(G, 1);
    afterAction(G, true);
    return { ok: true };
}

export function useSkill(G, k) {
    const B = G.B;
    if (!B || B.over) return { ok: false, why: 'no battle' };
    const p = B.party[k];
    if (!p) return { ok: false, why: 'no hero' };
    const h = HERO[p.id];
    if (p.charge < h.skill.cost) return { ok: false, why: 'not charged' };
    p.charge = 0;
    G.stats.skills++;
    G.events.push({ type: 'skill', k, hero: p.id, name: h.skill.name });
    const atk = heroStats(G, p.id).atk;
    for (const [kind, v] of h.skill.fx) {
        if (kind === 'strike') {
            const dmg = hurt(G, v * (12 + 3 * atk) * elemMult(h.c, B.enemy.c));
            G.events.push({ type: 'strike', hero: p.id, dmg, ehp: B.enemy.hp });
        } else if (kind === 'mend') {
            const n = Math.round(B.maxHp * v);
            B.hp = Math.min(B.maxHp, B.hp + n);
            G.events.push({ type: 'heal', n, hp: B.hp });
        } else if (kind === 'ward') {
            B.shield += Math.round(B.maxHp * v);
            G.events.push({ type: 'shield', shield: B.shield });
        } else if (kind === 'delay') metaFx(G, 'delay', v);
        else if (kind === 'quake') {
            for (let r = 0; r < v; r++) quake(G, h.c);
        } else {
            const changes = boardFx(G, kind === 'cleanse' ? 'cleanse' : kind, 'all', v, -1, p.id);
            G.events.push({ type: 'change', cause: 'skill', who: p.id, kind, at: -1, changes });
        }
    }
    settle(G, 2);
    afterAction(G, false);
    return { ok: true };
}

/** Shatter the row holding the most stones of colour c: every stone in it clears. */
function quake(G, c) {
    const B = G.B;
    let best = 0, by = 0;
    for (let y = 0; y < Hh; y++) {
        let n = 0;
        for (let x = 0; x < W; x++) if (B.g[idx(x, y)]?.c === c && isStone(B.g[idx(x, y)])) n++;
        if (n > best) { best = n; by = y; }
    }
    const cells = [];
    let dmg = 0;
    for (let x = 0; x < W; x++) {
        const i = idx(x, by), t = B.g[i];
        if (!t || t.h) continue;
        cells.push({ i, id: t.id, kind: t.rb ? 'rubble' : 'match', h: null, c: t.c, o: t.o });
        if (!t.rb) {
            dmg += (TOKEN.base + B.power[t.c]) * elemMult(t.c, B.enemy.c);
            charge(B, t.c, 1);
        }
        B.g[i] = null;
    }
    const dealt = hurt(G, dmg);
    G.events.push({ type: 'clear', combo: 1, cells, wakes: [], unfrozen: [], dmg: dealt, ehp: B.enemy.hp, quake: by });
    fall(G);
}

export function flee(G) {
    if (!G.B || G.B.over) return { ok: false };
    endBattle(G, 'loss');
    G.B.fled = true;
    return { ok: true };
}
