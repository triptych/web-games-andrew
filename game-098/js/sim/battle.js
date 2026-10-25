// The battle rules: building a battle from a chapter or a Wild Hunt, units, the damage formula and
// its forecast, attacks with counters, skills, claiming property, unchaining, calling dragons from a
// roost, commander powers, the phase cycle and the objectives. Pure.
//
// Every action resolves at once and pushes events for the view to play: phase, move, attack, skill,
// capture, unchain, death, call, build, power, levelup, heal, income, talk, treasure, win, lose.

import { COMBAT, PROPERTY, POWER, CALL, LEVEL, IDLE, xpNeed } from '../config.js';
import { SPECIES, UNITS, ELEMENTS, CLASS_MULT, CLASSES, TERRAIN, SKILLS, POWERS, COS } from './data.js';
import { CHAPTERS } from './story.js';
import { parseMap, idx, inside, dist, unitAt, terrainAt, tileId, isFlier, reach, destinations, pathTo, ring, canStand, wildMap } from './map.js';
import { statsFor, dragonStats, randomGenes, stageOf, giveXp, makeDragon, makeEgg, randomSpecies, STATS } from './dragons.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const tenths = (u) => Math.max(1, Math.ceil((u.hp / u.hpMax) * 10));
const cheb = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

// ------------------------------------------------------------------ units
/** Build a battle unit. spec: { k, sp?, rid?, team, x, y, lv, chained, boss, guest, name, ... } */
export function makeUnit(G, B, spec) {
    const team = spec.team;
    let key = spec.k, d = null, rec = null;
    if (spec.rid != null) {
        rec = G.meta.dragons.find((r) => r.rid === spec.rid);
        key = rec.sp;
    } else if (spec.k === 'dragon') key = spec.sp;
    d = SPECIES[key] || UNITS[key];
    if (!d) throw new Error('unknown unit ' + key);
    const lv = rec ? rec.lv : spec.lv;
    const genes = rec ? rec.genes : spec.genes || (SPECIES[key] ? randomGenes(G.rng, 2, 11) : null);
    const traits = rec ? rec.traits.slice() : spec.traits || (d.trait ? [d.trait] : []);
    const st = rec ? dragonStats(rec) : statsFor(key, lv, genes, null, traits);
    const isDragon = !!SPECIES[key] || key === 'sera' || key === 'vorthax';
    const u = {
        id: B.nextId++,
        team,
        key,
        sp: SPECIES[key] ? key : (UNITS[key].species || null),
        kind: UNITS[key]?.structure ? 'structure' : isDragon ? 'dragon' : 'human',
        name: rec ? rec.name : spec.name || d.name,
        lv,
        hpMax: st.hp, hp: st.hp, atk: st.atk, def: st.def, spd: st.spd,
        mv: d.mv + (traits.includes('swift') ? 1 : 0),
        rng: d.rng.slice(),
        mt: d.mt,
        cls: d.cls,
        el: d.el,
        skill: d.skill || null,
        cd: 0,
        traits,
        genes,
        indirect: !!d.indirect,
        capture: d.capture ?? (team === 'p' && SPECIES[key] ? 0.5 : 0),
        tamer: !!d.tamer && team === 'p',
        boss: !!spec.boss || !!d.boss,
        chained: !!spec.chained,
        target: !!spec.target,
        bound: !!spec.bound,
        guest: !!spec.guest,
        rid: rec ? rec.rid : null,
        hue: rec ? rec.hue : spec.hue ?? 0,
        gilded: rec ? rec.gilded : !!spec.gilded,
        stage: SPECIES[key] ? stageOf(lv) : 'adult',
        bond: rec ? rec.bond : 0,
        x: spec.x, y: spec.y,
        acted: false,
        stun: 0, ward: 0, wardT: 0, thorns: false, rally: 0, rallyT: 0,
        sturdyUsed: false,
    };
    if (u.key === 'tamer') u.name = 'Kestrel';
    if (u.bound) { u.mv = 0; }
    B.units.push(u);
    return u;
}

export const live = (B) => B.units.filter((u) => u.hp > 0);
export const foes = (B, team) => B.units.filter((u) => u.hp > 0 && u.team !== team);
export const allies = (B, team) => B.units.filter((u) => u.hp > 0 && u.team === team);
export const unitById = (B, id) => B.units.find((u) => u.id === id && u.hp > 0) || null;
export const tamerOf = (B) => B.units.find((u) => u.tamer && u.hp > 0) || null;

/** Move points this phase: powers, hexes and stuns. */
export function moveNow(B, u) {
    // stunned, bound in the Great Chain, or a story dragon collared to its shrine
    if (u.stun > 0 || u.bound || (u.target && u.chained)) return 0;
    let mv = u.mv;
    const pw = B.power[u.team];
    if (pw.on && u.kind === 'dragon') mv += pw.def.mv || 0;
    if (u.team === 'p' && B.hex) mv -= 1;
    return Math.max(1, mv);
}

export function reachOf(B, u) { return reach(B, u, moveNow(B, u)); }

// ------------------------------------------------------------------ building a battle
function baseBattle(id, title, theme, objective) {
    return {
        id, title, theme, objective,
        ch: -1, w: 0, h: 0, tiles: [], own: [], capt: [], capBy: [],
        units: [], nextId: 1, turn: 1, phase: 'p', over: null,
        funds: { p: 0, e: 0 }, power: { p: null, e: null }, co: { p: 'kestrel', e: null },
        talk: [], talked: {}, treasure: {}, build: false, limit: 0, lvl: 1, slots: 4,
        hex: false, fainted: [], deployed: [], recruited: [], found: [],
        stats: { kills: 0, faints: 0, dealt: 0, taken: 0 }, aiT: 0, aiQueue: null, result: null,
    };
}

function setMap(B, m) {
    B.w = m.w; B.h = m.h; B.tiles = m.tiles.slice(); B.own = m.own.slice();
    B.capt = B.tiles.map(() => PROPERTY.capture);
    B.capBy = B.tiles.map(() => -1);
    B.homeHq = []; B.enemyHq = [];
    for (let i = 0; i < B.tiles.length; i++) {
        if (B.tiles[i] !== 'hq') continue;
        if (B.own[i] === 'p') B.homeHq.push(i);
        if (B.own[i] === 'e') B.enemyHq.push(i);
    }
}

function powerFor(G, team, coKey) {
    if (!coKey) return { meter: 0, on: false, def: null, name: '' };
    if (coKey === 'kestrel') {
        const lv = clamp(G.meta.song || 1, 1, 3);
        const def = POWERS.wyrmsong[lv - 1];
        return { meter: 0, on: false, def, name: def.name };
    }
    const def = POWERS[COS[coKey].power];
    return { meter: 0, on: false, def, name: def.name };
}

/** Deploy the player's side: Kestrel, the chosen dragons, any guests. */
function deployPlayer(G, B, tamerAt, deploy, rids, guests = []) {
    // Kestrel grows with the flock: never more than a level behind the party's average
    const lv = rids.map((r) => G.meta.dragons.find((d) => d.rid === r)?.lv || 1);
    const avg = lv.length ? Math.round(lv.reduce((a, b) => a + b, 0) / lv.length) : 1;
    if (G.meta.tamer.lv < avg - 1) { G.meta.tamer.lv = Math.min(LEVEL.max, avg - 1); G.meta.tamer.xp = 0; }
    makeUnit(G, B, { k: 'tamer', team: 'p', x: tamerAt[0], y: tamerAt[1], lv: G.meta.tamer.lv });
    const spots = deploy.slice();
    for (const rid of rids.slice(0, Math.min(B.slots, spots.length))) {
        const at = spots.shift();
        makeUnit(G, B, { rid, team: 'p', x: at[0], y: at[1] });
        B.deployed.push(rid);
    }
    for (const g of guests) {
        makeUnit(G, B, { k: g.k, sp: g.sp, team: 'p', x: g.x, y: g.y, lv: g.lv || Math.max(B.lvl, G.meta.tamer.lv) + 1, guest: true, name: g.name });
    }
}

export function buildChapter(G, ci, rids) {
    const C = CHAPTERS[ci];
    const B = baseBattle(C.id, C.title, C.theme, C.objective);
    B.ch = ci;
    B.lvl = C.lvl; B.slots = C.slots; B.build = !!C.build; B.limit = C.limit || 0;
    setMap(B, parseMap(C.map));
    B.funds = { p: C.funds.p, e: C.funds.e };
    B.co = { p: 'kestrel', e: C.co };
    B.power = { p: powerFor(G, 'p', 'kestrel'), e: powerFor(G, 'e', C.co) };
    B.talk = (C.talk || []).map((t, i) => ({ ...t, key: 't' + i }));
    deployPlayer(G, B, C.tamer, C.deploy, rids, C.guests || []);
    for (const e of C.enemies) {
        makeUnit(G, B, { ...e, team: 'e', lv: Math.max(1, C.lvl + (e.dl || 0)) });
    }
    for (const t of C.treasure || []) B.treasure[idx(B, t[0], t[1])] = t[2];
    return B;
}

/** A Wild Hunt: a generated map, chained strays to free, Chain poachers, maybe a lost egg. */
export function buildWild(G, rids, lvl) {
    const rng = G.rng;
    const theme = rng.pick(['meadow', 'hills', 'coast', 'forest', 'swamp', 'frost', 'volcano']);
    let m = null, seed = rng.int(1, 1e9);
    for (let i = 0; i < 40 && !m; i++) m = wildMap(seed + i * 977, theme);
    if (!m) m = wildMap(1, 'meadow');
    const B = baseBattle('wild', 'Wild Hunt', theme, { type: 'rout', text: 'Rout the poachers. Free any chained strays you can.' });
    B.ch = -1; B.lvl = lvl; B.slots = 6; B.build = false;
    setMap(B, m);
    B.funds = { p: 300, e: 0 };
    B.power = { p: powerFor(G, 'p', 'kestrel'), e: powerFor(G, 'e', null) };
    deployPlayer(G, B, m.tamer, m.deploy, rids, []);
    // shuffle spawn points, then fill them
    const spots = m.spawns.slice();
    for (let i = spots.length - 1; i > 0; i--) { const j = rng.int(0, i); [spots[i], spots[j]] = [spots[j], spots[i]]; }
    const n = clamp(4 + Math.floor(lvl / 6), 4, 8);
    const pool = lvl < 5 ? ['chainknight', 'chainhound'] : lvl < 10 ? ['chainknight', 'chainhound', 'lancer', 'ballista'] : ['chainknight', 'chainhound', 'lancer', 'ballista', 'hexer'];
    const strays = rng() < 0.5 ? 2 : 1;
    for (let i = 0; i < n + strays && spots.length; i++) {
        const [x, y] = spots.shift();
        if (i < strays) {
            const sp = randomSpecies(rng, 1, lvl >= 12 ? 4 : 3);
            // a stray has to be able to stand where it was found
            const probe = { mt: SPECIES[sp].mt, traits: [SPECIES[sp].trait] };
            if (!canStand(B, probe, x, y)) { i--; continue; }
            makeUnit(G, B, { k: 'dragon', sp, team: 'e', x, y, lv: Math.max(1, lvl + rng.int(-2, 0)), chained: true });
        } else {
            const k = rng.pick(pool);
            const probe = { mt: UNITS[k].mt, traits: [] };
            if (!canStand(B, probe, x, y)) { i--; continue; }
            makeUnit(G, B, { k, team: 'e', x, y, lv: Math.max(1, lvl + rng.int(-1, 1)) });
        }
    }
    // a lost egg in the ruins or shrine, half the time
    if (rng() < 0.6) {
        for (let i = 0; i < B.tiles.length; i++) if (B.tiles[i] === 'ruins' || B.tiles[i] === 'crystal') { B.treasure[i] = randomSpecies(rng, 1, lvl >= 10 ? 4 : 3); break; }
    }
    return B;
}

// ------------------------------------------------------------------ damage
export function elemMult(a, d) {
    if (a === d) return 1;
    if ((a === 'lumen' && d === 'umbra') || (a === 'umbra' && d === 'lumen')) return COMBAT.edge;
    if (ELEMENTS[a]?.beats === d) return COMBAT.edge;
    if (ELEMENTS[d]?.beats === a) return COMBAT.dull;
    return 1;
}
const classMult = (a, d) => CLASS_MULT[a]?.[d] ?? 1;
const onWater = (B, u) => ['sea', 'shoal', 'swamp'].includes(tileId(B, u.x, u.y));

/** Defence stars a unit gets where it stands. Fliers and structures get none. */
export function starsOf(B, u, x = u.x, y = u.y) {
    if (isFlier(u) || u.kind === 'structure') return 0;
    let s = TERRAIN[tileId(B, x, y)].def;
    if (u.traits.includes('mountainlord') && ['hills', 'mount'].includes(tileId(B, x, y))) s += 1;
    return s;
}

function pylonsLeft(B) { return B.units.filter((u) => u.key === 'pylon' && u.hp > 0).length; }

/**
 * The damage of one blow, before luck and crits. a strikes d; `at` is where the attacker stands
 * (it matters for the Loyal bonus). Returns a number ≥ 1 (or 0 against what the class can't hurt).
 */
export function blow(B, a, d, { power = 1, counter = false, ax = a.x, ay = a.y } = {}) {
    if (a.atk <= 0) return 0;
    const cm = classMult(a.cls, d.cls);
    if (cm === 0) return 0;
    let mult = elemMult(a.el, d.el) * cm * power;
    if (a.traits.includes('skybreaker') && isFlier(d)) mult *= 1.35;
    if (a.traits.includes('brave') && a.hp >= a.hpMax) mult *= 1.15;
    if (counter && a.traits.includes('vigilant')) mult *= 1.2;
    if (a.traits.includes('loyal') && a.team === 'p') {
        const t = tamerOf(B);
        if (t && t !== a && dist(t.x, t.y, ax, ay) === 1) mult *= 1.1;
    }
    if (a.rally > 0) mult *= 1 + a.rally;
    const pa = B.power[a.team];
    if (pa.on && pa.def.atk) mult *= 1 + pa.def.atk;
    // defender side
    let cut = 1;
    if (d.traits.includes('thickhide')) cut *= 0.88;
    if (d.traits.includes('aquatic') && onWater(B, d)) cut *= 0.75;
    if (d.traits.includes('lavaborn') && a.el === 'ember') cut *= 0.75;
    if (d.ward > 0) cut *= 1 - d.ward;
    const pd = B.power[d.team];
    if (pd.on && pd.def.guard) cut *= 1 - pd.def.guard;
    if ((d.key === 'nyxara' || d.key === 'vorthax') && d.team === 'e') cut *= 1 - 0.2 * pylonsLeft(B);
    const hpF = 0.5 + 0.5 * (a.hp / a.hpMax);
    const stars = starsOf(B, d);
    const raw = (a.atk * mult - d.def * COMBAT.defWeight) * hpF * (1 - stars * COMBAT.starCut) * cut;
    return Math.max(COMBAT.minDmg, raw);
}

export function critChance(B, a) {
    let c = COMBAT.critBase;
    if (a.traits.includes('keen')) c += 0.08;
    if (a.traits.includes('nightstalker')) c += 0.12;
    c += (a.bond || 0) * 0.01;
    return c;
}

/** Can d strike back at a standing at (ax, ay)? */
export function canCounter(B, a, d, ax = a.x, ay = a.y) {
    if (d.hp <= 0 || d.indirect || d.stun > 0 || d.atk <= 0 || d.kind === 'structure') return false;
    const r = dist(ax, ay, d.x, d.y);
    return r >= d.rng[0] && r <= d.rng[1];
}

/** Who strikes, in order: [['a'|'d'], ...]. */
function strikeOrder(B, a, d, ax, ay) {
    const counter = canCounter(B, a, d, ax, ay);
    const order = counter && d.traits.includes('firststrike') ? ['d', 'a'] : counter ? ['a', 'd'] : ['a'];
    if (a.spd >= d.spd + COMBAT.flurrySpd) order.push('a');
    else if (counter && d.spd >= a.spd + COMBAT.flurrySpd) order.push('d');
    return order;
}

/**
 * The forecast for the UI and the AI: damage ranges for each strike in order, with HP carried
 * through. Deterministic (no rolls).
 */
export function forecast(B, a, d, ax = a.x, ay = a.y) {
    const sa = { hp: a.hp }, sd = { hp: d.hp };
    const ox = a.x, oy = a.y;
    a.x = ax; a.y = ay;
    const out = { strikes: [], counter: canCounter(B, a, d, ax, ay), hpA: a.hp, hpD: d.hp };
    try {
        for (const who of strikeOrder(B, a, d, ax, ay)) {
            const s = who === 'a' ? a : d, t = who === 'a' ? d : a;
            const ss = who === 'a' ? sa : sd, ts = who === 'a' ? sd : sa;
            if (ss.hp <= 0 || ts.hp <= 0) continue;
            const hp0 = s.hp; s.hp = ss.hp;
            const b = blow(B, s, t, { counter: who === 'd', ax, ay });
            s.hp = hp0;
            const lo = Math.floor(b), hi = Math.floor(b * (1 + COMBAT.luck));
            const avg = (lo + hi) / 2;
            out.strikes.push({ by: who, lo, hi });
            ts.hp = Math.max(hpFloor(t), ts.hp - avg);
        }
    } finally { a.x = ox; a.y = oy; }
    out.hpA = sa.hp; out.hpD = sd.hp;
    const sum = (w, k) => out.strikes.filter((s) => s.by === w).reduce((acc, s) => acc + s[k], 0);
    out.dmg = [sum('a', 'lo'), sum('a', 'hi')];
    out.cdmg = [sum('d', 'lo'), sum('d', 'hi')];
    out.crit = critChance(B, a);
    return out;
}

// ------------------------------------------------------------------ hurting and dying
function snap(u) {
    return { id: u.id, key: u.key, sp: u.sp, team: u.team, name: u.name, lv: u.lv, hp: u.hp, hpMax: u.hpMax, el: u.el, cls: u.cls, hue: u.hue, gilded: u.gilded, stage: u.stage, chained: u.chained, kind: u.kind, x: u.x, y: u.y };
}

/** HP a unit can't be knocked below: a bound wyrm and a story dragon you came to free keep 1. */
export const hpFloor = (u) => (u.bound || (u.target && u.chained) ? 1 : 0);

/** Take damage; Sturdy and protected units keep 1 HP. Returns the damage actually dealt. */
function hurt(B, u, dmg) {
    dmg = Math.max(0, Math.round(dmg));
    if (dmg >= u.hp && u.traits.includes('sturdy') && !u.sturdyUsed && u.hp > 1) { u.sturdyUsed = true; dmg = u.hp - 1; }
    if (hpFloor(u) && dmg >= u.hp) dmg = Math.max(0, u.hp - 1);
    u.hp = Math.max(0, u.hp - dmg);
    return dmg;
}

function charge(B, team, amount) {
    const p = B.power[team];
    if (!p.def || p.on) return;
    p.meter = Math.min(POWER.max, p.meter + amount);
}

function onDamage(B, att, def, dmg) {
    if (dmg <= 0) return;
    const f = dmg / def.hpMax;
    charge(B, att.team, f * POWER.dealt);
    charge(B, def.team, f * POWER.taken);
    if (att.team === 'p') B.stats.dealt += dmg; else B.stats.taken += dmg;
    if (def.boss && def.hp > 0 && def.hp < def.hpMax / 2) trigger(B, 'boss');
}

/** XP for the player's side. Roster dragons and Kestrel level up; guests do not. */
function award(G, B, u, target, frac, kill) {
    if (u.team !== 'p' || u.hp <= 0) return;
    const lvT = target.lv;
    let xp = (8 + 32 * Math.min(1, frac) + (kill ? 30 + (target.boss ? 40 : 0) : 0)) * clamp(1 + (lvT - u.lv) * 0.12, 0.25, 2.5);
    if (target.kind === 'structure') xp *= 0.6;
    if (u.rid != null) {
        const rec = G.meta.dragons.find((r) => r.rid === u.rid);
        if (!rec) return;
        const ups = giveXp(rec, xp * (rec.traits.includes('loyal') ? 1.1 : 1));
        if (ups.length) refreshUnit(B, u, rec, ups);
    } else if (u.tamer) {
        const T = G.meta.tamer;
        T.xp += Math.round(xp * 0.8);
        while (T.xp >= xpNeed(T.lv) && T.lv < LEVEL.max) {
            T.xp -= xpNeed(T.lv); T.lv++;
            const st = statsFor('tamer', T.lv);
            const gain = st.hp - u.hpMax;
            u.hpMax = st.hp; u.hp = Math.min(u.hpMax, u.hp + Math.max(0, gain));
            u.atk = st.atk; u.def = st.def; u.spd = st.spd; u.lv = T.lv;
            B.events.push({ type: 'levelup', id: u.id, name: u.name, lv: T.lv, gains: { hp: gain } });
        }
    }
}

function refreshUnit(B, u, rec, ups) {
    const st = dragonStats(rec);
    const gain = st.hp - u.hpMax;
    u.hpMax = st.hp; u.hp = Math.min(u.hpMax, u.hp + Math.max(0, gain));
    u.atk = st.atk; u.def = st.def; u.spd = st.spd; u.lv = rec.lv;
    const stage = stageOf(rec.lv);
    const grew = stage !== u.stage;
    u.stage = stage;
    for (const up of ups) B.events.push({ type: 'levelup', id: u.id, rid: u.rid, name: u.name, lv: up.lv, gains: up.gains, stage: grew ? stage : null });
}

function kill(G, B, u, by) {
    u.hp = 0;
    const i = idx(B, u.x, u.y);
    if (B.capBy[i] === u.id) { B.capBy[i] = -1; B.capt[i] = PROPERTY.capture; }
    const faint = u.team === 'p' && u.rid != null;
    if (faint) { B.fainted.push(u.rid); B.stats.faints++; }
    if (u.team === 'e') B.stats.kills++;
    B.events.push({ type: 'death', id: u.id, team: u.team, faint, key: u.key, name: u.name });
    if (u.key === 'pylon') {
        trigger(B, 'pylon');
        if (pylonsLeft(B) === 0) freeVorthax(G, B);
    }
}

function freeVorthax(G, B) {
    const v = B.units.find((u) => u.key === 'vorthax' && u.hp > 0);
    if (!v) return;
    v.team = 'p'; v.bound = false; v.guest = true; v.chained = false; v.acted = true;
    v.mv = 4; v.hp = v.hpMax;
    B.events.push({ type: 'unchain', id: B.units.find((u) => u.tamer)?.id ?? v.id, tid: v.id, ok: true, chance: 1, name: v.name, story: true });
    trigger(B, 'freed');
}

function trigger(B, on) {
    for (const t of B.talk) {
        if (t.on === on && !B.talked[t.key]) {
            B.talked[t.key] = true;
            B.events.push({ type: 'talk', lines: t.lines });
        }
    }
}

// ------------------------------------------------------------------ actions
function moveUnit(B, u, to, R) {
    if (u.x === to[0] && u.y === to[1]) return;
    const from = idx(B, u.x, u.y);
    if (B.capBy[from] === u.id) { B.capBy[from] = -1; B.capt[from] = PROPERTY.capture; }
    const path = pathTo(B, R, to[0], to[1]);
    u.x = to[0]; u.y = to[1];
    u.moved = true;
    B.events.push({ type: 'move', id: u.id, path });
}

/** Attack d with a; a is already where it attacks from. */
export function doAttack(G, B, a, d) {
    const ax = a.x, ay = a.y;
    const order = strikeOrder(B, a, d, ax, ay);
    const before = { a: snap(a), d: snap(d) };
    const strikes = [];
    for (const who of order) {
        const s = who === 'a' ? a : d, t = who === 'a' ? d : a;
        if (s.hp <= 0 || t.hp <= 0) continue;
        let dmg = blow(B, s, t, { counter: who === 'd' });
        dmg *= 1 + G.rng() * COMBAT.luck;
        const crit = G.rng() < critChance(B, s);
        if (crit) dmg *= COMBAT.critMult;
        const dealt = hurt(B, t, dmg);
        onDamage(B, s, t, dealt);
        let thorn = 0;
        if (dist(s.x, s.y, t.x, t.y) === 1 && (t.traits.includes('thorns') || t.thorns) && s.hp > 0) {
            thorn = hurt(B, s, Math.max(1, dealt * 0.2));
        }
        strikes.push({ by: who, dmg: dealt, crit, thorn, hpA: a.hp, hpD: d.hp });
        award(G, B, s, t, dealt / t.hpMax, t.hp <= 0);
    }
    const killed = d.hp <= 0 ? 'd' : a.hp <= 0 ? 'a' : null;
    B.events.push({
        type: 'attack', aid: a.id, did: d.id, a: before.a, d: before.d, from: [ax, ay], at: [d.x, d.y],
        tA: tileId(B, ax, ay), tD: tileId(B, d.x, d.y), strikes, kill: killed,
    });
    if (d.hp <= 0) kill(G, B, d, a);
    if (a.hp <= 0) kill(G, B, a, d);
}

/** Targets of a skill from a position: list of [x, y]. */
export function skillTargets(B, u, x = u.x, y = u.y) {
    const S = SKILLS[u.skill];
    if (!S || u.cd > 0) return [];
    const out = [];
    const tiles = ring(B, x, y, S.range[0], S.range[1]);
    for (const [tx, ty] of tiles) {
        const o = unitAt(B, tx, ty);
        const self = tx === x && ty === y;
        const ally = self ? u : o && o.team === u.team ? o : null;
        const foe = o && o.team !== u.team && !self ? o : null;
        switch (S.kind) {
            case 'bolt': case 'stun': case 'drain': case 'push': case 'chain':
                if (foe && !(S.kind === 'stun' && foe.kind === 'structure')) out.push([tx, ty]);
                break;
            case 'blast': {
                const hit = B.units.some((v) => v.hp > 0 && v.team !== u.team && cheb(v.x, v.y, tx, ty) <= S.area && !(v.x === x && v.y === y));
                if (hit) out.push([tx, ty]);
                break;
            }
            case 'heal': {
                const want = (v) => v.hp > 0 && v.team === u.team && v.hp < v.hpMax && v.kind !== 'structure';
                if (S.area) { if (B.units.some((v) => want(v) && cheb(v.x, v.y, tx, ty) <= S.area) || (self && u.hp < u.hpMax)) out.push([tx, ty]); }
                else if ((ally && want(ally)) || (self && u.hp < u.hpMax)) out.push([tx, ty]);
                break;
            }
            case 'ward':
                if (ally && ally.kind !== 'structure' && ally.ward <= 0) out.push([tx, ty]);
                break;
            case 'refresh':
                if (ally && !self && ally.acted && ally.stun <= 0 && !ally.bound) out.push([tx, ty]);
                break;
            case 'rally':
                if (self) out.push([tx, ty]);
                break;
            case 'nova':
                if (self && B.units.some((v) => v.hp > 0 && v !== u && dist(v.x, v.y, x, y) === 1 && (v.team !== u.team || v.hp < v.hpMax))) out.push([tx, ty]);
                break;
        }
    }
    return out;
}

function doSkill(G, B, u, tx, ty) {
    const S = SKILLS[u.skill];
    const fx = [];
    const dmgTo = (t, power) => {
        let dmg = blow(B, u, t, { power }) * (1 + G.rng() * COMBAT.luck);
        const crit = G.rng() < critChance(B, u) * 0.5;
        if (crit) dmg *= COMBAT.critMult;
        const dealt = hurt(B, t, dmg);
        onDamage(B, u, t, dealt);
        award(G, B, u, t, dealt / t.hpMax, t.hp <= 0);
        return { dealt, crit };
    };
    const heal = (t, frac) => {
        const amt = Math.min(t.hpMax - t.hp, Math.max(1, Math.round(t.hpMax * frac)));
        t.hp += amt;
        if (u.team === 'p' && amt > 0 && t !== u) award(G, B, u, t, amt / t.hpMax * 0.5, false);
        return amt;
    };
    const target = unitAt(B, tx, ty);
    switch (S.kind) {
        case 'bolt': case 'stun': case 'drain': {
            const { dealt, crit } = dmgTo(target, S.power);
            const f = { id: target.id, dmg: dealt, crit, hp: target.hp, hpMax: target.hpMax };
            if (S.kind === 'stun' && target.hp > 0) { target.stun = 1; f.stun = true; }
            if (S.kind === 'drain') { const h = heal(u, dealt / u.hpMax); fx.push({ id: u.id, heal: h, hp: u.hp, hpMax: u.hpMax }); }
            fx.unshift(f);
            break;
        }
        case 'push': {
            const { dealt, crit } = dmgTo(target, S.power);
            const f = { id: target.id, dmg: dealt, crit, hp: target.hp, hpMax: target.hpMax };
            if (target.hp > 0 && target.kind !== 'structure' && !target.bound) {
                const dx = Math.sign(tx - u.x), dy = Math.sign(ty - u.y);
                let px = target.x, py = target.y, bumped = false;
                for (let s = 0; s < 2; s++) {
                    const nx = px + dx, ny = py + dy;
                    if (!inside(B, nx, ny) || !canStand(B, target, nx, ny) || unitAt(B, nx, ny)) { bumped = true; break; }
                    px = nx; py = ny;
                }
                if (px !== target.x || py !== target.y) {
                    const i0 = idx(B, target.x, target.y);
                    if (B.capBy[i0] === target.id) { B.capBy[i0] = -1; B.capt[i0] = PROPERTY.capture; }
                    target.x = px; target.y = py; f.moved = [px, py];
                }
                if (bumped) { const extra = hurt(B, target, Math.max(1, dealt * 0.35)); f.dmg += extra; f.hp = target.hp; f.bump = true; }
            }
            fx.push(f);
            break;
        }
        case 'chain': {
            const hitList = [target];
            let cur = target;
            for (let j = 0; j < S.jumps; j++) {
                const next = B.units.filter((v) => v.hp > 0 && v.team !== u.team && !hitList.includes(v) && dist(v.x, v.y, cur.x, cur.y) <= 2)
                    .sort((a, b) => dist(a.x, a.y, cur.x, cur.y) - dist(b.x, b.y, cur.x, cur.y) || a.id - b.id)[0];
                if (!next) break;
                hitList.push(next); cur = next;
            }
            hitList.forEach((t, k) => { const { dealt, crit } = dmgTo(t, S.power * (k ? 0.75 : 1)); fx.push({ id: t.id, dmg: dealt, crit, hp: t.hp, hpMax: t.hpMax }); });
            break;
        }
        case 'blast': {
            const hits = B.units.filter((v) => v.hp > 0 && v.team !== u.team && cheb(v.x, v.y, tx, ty) <= S.area);
            for (const t of hits) { const { dealt, crit } = dmgTo(t, S.power); fx.push({ id: t.id, dmg: dealt, crit, hp: t.hp, hpMax: t.hpMax }); }
            break;
        }
        case 'heal': {
            const list = S.area ? B.units.filter((v) => v.hp > 0 && v.team === u.team && v.kind !== 'structure' && cheb(v.x, v.y, tx, ty) <= S.area) : [target || u];
            for (const t of list) { const h = heal(t, S.amount); if (h) fx.push({ id: t.id, heal: h, hp: t.hp, hpMax: t.hpMax }); }
            break;
        }
        case 'ward': {
            const t = target || u;
            t.ward = S.amount; t.wardT = S.turns; t.thorns = !!S.thorns;
            fx.push({ id: t.id, ward: S.amount });
            break;
        }
        case 'refresh': {
            target.acted = false;
            fx.push({ id: target.id, refresh: true });
            break;
        }
        case 'rally': {
            for (const t of B.units.filter((v) => v.hp > 0 && v.team === u.team && dist(v.x, v.y, u.x, u.y) <= 1 && v.kind !== 'structure')) {
                t.rally = S.amount; t.rallyT = S.turns + 1;
                fx.push({ id: t.id, rally: S.amount });
            }
            break;
        }
        case 'nova': {
            for (const t of B.units.filter((v) => v.hp > 0 && v !== u && dist(v.x, v.y, u.x, u.y) === 1)) {
                if (t.team === u.team) { const h = heal(t, S.amount); if (h) fx.push({ id: t.id, heal: h, hp: t.hp, hpMax: t.hpMax }); }
                else { const { dealt, crit } = dmgTo(t, S.power); fx.push({ id: t.id, dmg: dealt, crit, hp: t.hp, hpMax: t.hpMax }); }
            }
            break;
        }
    }
    u.cd = S.cd;
    B.events.push({ type: 'skill', id: u.id, skill: u.skill, name: S.name, kind: S.kind, el: u.el, from: [u.x, u.y], at: [tx, ty], fx });
    for (const f of fx) {
        const t = B.units.find((v) => v.id === f.id);
        if (t && t.hp <= 0 && !t._dead) { t._dead = true; kill(G, B, t, u); }
    }
    for (const v of B.units) delete v._dead;
}

/** Can this unit claim the tile it stands on? */
export function canCapture(B, u, x = u.x, y = u.y) {
    const i = idx(B, x, y);
    return TERRAIN[B.tiles[i]].prop && B.own[i] !== u.team && u.capture > 0 && u.kind !== 'structure';
}

function doCapture(G, B, u) {
    const i = idx(B, u.x, u.y);
    if (B.capBy[i] !== u.id) { B.capt[i] = PROPERTY.capture; B.capBy[i] = u.id; }
    const amt = Math.max(1, Math.ceil(tenths(u) * u.capture));
    B.capt[i] -= amt;
    const done = B.capt[i] <= 0;
    const prev = B.own[i];
    if (done) { B.own[i] = u.team; B.capt[i] = PROPERTY.capture; B.capBy[i] = -1; }
    B.events.push({ type: 'capture', id: u.id, at: [u.x, u.y], left: done ? 0 : B.capt[i], done, team: u.team, prev, prop: B.tiles[i] });
    if (done && u.team === 'p') award(G, B, u, { lv: u.lv, hpMax: 1, boss: false, kind: 'prop' }, 0.4, false);
}

/** The chance Kestrel frees a chained dragon. */
export function unchainChance(B, t, tamer) {
    if (!t.chained || t.hp <= 0) return 0;
    const r = t.hp / t.hpMax;
    if (r > 0.5) return 0;
    if (r <= 0.25) return 1;
    return clamp(0.95 - r * 1.4 + (tamer ? tamer.lv * 0.006 : 0), 0.2, 0.95);
}

export function unchainTargets(B, u, x = u.x, y = u.y) {
    if (!u.tamer) return [];
    return B.units.filter((t) => t.hp > 0 && t.team !== u.team && t.chained && dist(t.x, t.y, x, y) === 1 && unchainChance(B, t, u) > 0).map((t) => [t.x, t.y]);
}

function doUnchain(G, B, u, t) {
    const chance = unchainChance(B, t, u);
    const ok = chance >= 1 || G.rng() < chance;
    const ev = { type: 'unchain', id: u.id, tid: t.id, ok, chance, name: t.name };
    if (ok) {
        const rec = makeDragon(G, t.sp, { lv: t.lv, genes: t.genes, traits: t.traits.slice(), hue: t.hue, gilded: t.gilded, name: t.name !== SPECIES[t.sp].name ? t.name : null, bond: 1 });
        G.meta.dragons.push(rec);
        const i = idx(B, t.x, t.y);
        if (B.capBy[i] === t.id) { B.capBy[i] = -1; B.capt[i] = PROPERTY.capture; }
        t.team = 'p'; t.chained = false; t.acted = true; t.rid = rec.rid; t.name = rec.name; t.capture = 0.5; t.stun = 0;
        t.bond = rec.bond;
        B.recruited.push(rec.rid);
        B.deployed.push(rec.rid);
        ev.rid = rec.rid; ev.name = rec.name;
        award(G, B, u, t, 0.6, false);
    }
    B.events.push(ev);
}

/** The cost to call a stabled dragon to a roost. */
export function callCost(G, rid) {
    const d = G.meta.dragons.find((r) => r.rid === rid);
    return d ? CALL.base + CALL.perLevel * d.lv : Infinity;
}

/** Dragons that may still be called this battle. */
export function reserve(G, B) {
    return G.meta.dragons.filter((d) => !B.deployed.includes(d.rid) && !B.fainted.includes(d.rid));
}

/** Validate and run one player or AI command inside a battle. Returns { ok, err }. */
export function battleAct(G, cmd) {
    const B = G.battle;
    if (!B || B.over) return { ok: false, err: 'no battle' };
    const team = B.phase;
    if (cmd.t === 'end') {
        if (team !== 'p' && !cmd.ai) return { ok: false, err: 'not your turn' };
        endPhase(G, B);
        return { ok: true };
    }
    if (cmd.t === 'power') {
        const tm = cmd.team || 'p';
        if (tm !== team) return { ok: false, err: 'not your turn' };
        const p = B.power[tm];
        if (!p.def || p.on || p.meter < POWER.max) return { ok: false, err: 'not ready' };
        usePower(B, tm);
        return { ok: true };
    }
    if (cmd.t === 'call') {
        if (team !== 'p') return { ok: false, err: 'not your turn' };
        const [x, y] = cmd.at;
        if (!inside(B, x, y)) return { ok: false, err: 'off the map' };
        const i = idx(B, x, y);
        if (!TERRAIN[B.tiles[i]].deploy || B.own[i] !== 'p') return { ok: false, err: 'not your roost' };
        if (unitAt(B, x, y)) return { ok: false, err: 'occupied' };
        if (!reserve(G, B).some((d) => d.rid === cmd.rid)) return { ok: false, err: 'not available' };
        const rec = G.meta.dragons.find((d) => d.rid === cmd.rid);
        if (!canStand(B, { mt: SPECIES[rec.sp].mt, traits: rec.traits }, x, y)) return { ok: false, err: 'cannot stand there' };
        const cost = callCost(G, cmd.rid);
        if (B.funds.p < cost) return { ok: false, err: 'not enough gold' };
        B.funds.p -= cost;
        const u = makeUnit(G, B, { rid: cmd.rid, team: 'p', x, y });
        u.acted = true;
        B.deployed.push(cmd.rid);
        B.events.push({ type: 'call', id: u.id, at: [x, y], cost, unit: snap(u) });
        return { ok: true };
    }
    if (cmd.t !== 'act') return { ok: false, err: 'unknown command' };

    const u = unitById(B, cmd.id);
    if (!u || u.team !== team) return { ok: false, err: 'not your unit' };
    if (u.acted) return { ok: false, err: 'already acted' };
    const to = cmd.to || [u.x, u.y];
    const R = reachOf(B, u);
    const r = R.get(idx(B, to[0], to[1]));
    if (!r || (r.occ && !(to[0] === u.x && to[1] === u.y))) return { ok: false, err: 'cannot move there' };
    const moving = to[0] !== u.x || to[1] !== u.y;
    const what = cmd.do || 'wait';
    // check the action from the destination before moving
    let target = null;
    if (what === 'attack') {
        if (!cmd.target) return { ok: false, err: 'no target' };
        target = unitAt(B, cmd.target[0], cmd.target[1]);
        if (!target || target.team === u.team) return { ok: false, err: 'no enemy there' };
        if (u.indirect && moving) return { ok: false, err: 'siege cannot move and fire' };
        const d = dist(to[0], to[1], target.x, target.y);
        if (d < u.rng[0] || d > u.rng[1] || u.atk <= 0) return { ok: false, err: 'out of range' };
        if (blowPreview(B, u, target, to) <= 0) return { ok: false, err: 'cannot hurt that' };
    } else if (what === 'skill') {
        if (!cmd.target) return { ok: false, err: 'no target' };
        if (!skillTargets(B, u, to[0], to[1]).some((t) => t[0] === cmd.target[0] && t[1] === cmd.target[1])) return { ok: false, err: 'bad skill target' };
    } else if (what === 'capture') {
        if (!canCapture(B, u, to[0], to[1])) return { ok: false, err: 'nothing to claim' };
    } else if (what === 'unchain') {
        if (!cmd.target || !unchainTargets(B, u, to[0], to[1]).some((t) => t[0] === cmd.target[0] && t[1] === cmd.target[1])) return { ok: false, err: 'cannot unchain that' };
    } else if (what !== 'wait') return { ok: false, err: 'unknown action' };

    moveUnit(B, u, to, R);
    // a lost egg in the ruins
    const ti = idx(B, u.x, u.y);
    if (B.treasure[ti] && u.team === 'p') {
        const sp = B.treasure[ti];
        delete B.treasure[ti];
        makeEgg(G, sp, { from: 'found' });
        B.found.push(sp);
        B.events.push({ type: 'treasure', id: u.id, at: [u.x, u.y], sp });
    }
    if (what === 'attack') doAttack(G, B, u, target);
    else if (what === 'skill') doSkill(G, B, u, cmd.target[0], cmd.target[1]);
    else if (what === 'capture') doCapture(G, B, u);
    else if (what === 'unchain') doUnchain(G, B, u, unitAt(B, cmd.target[0], cmd.target[1]));
    if (u.hp > 0) u.acted = true;
    checkEnd(G, B);
    return { ok: true };
}

function blowPreview(B, u, t, at) {
    const ox = u.x, oy = u.y;
    u.x = at[0]; u.y = at[1];
    const b = blow(B, u, t);
    u.x = ox; u.y = oy;
    return b;
}

// ------------------------------------------------------------------ powers
function usePower(B, team) {
    const p = B.power[team];
    p.on = true; p.meter = 0;
    const D = p.def;
    const fx = [];
    if (D.heal) {
        for (const u of allies(B, team)) {
            if (u.kind !== 'dragon' && team === 'p') continue;
            if (u.kind === 'structure') continue;
            const amt = Math.min(u.hpMax - u.hp, Math.round(u.hpMax * D.heal));
            if (amt > 0) { u.hp += amt; fx.push({ id: u.id, heal: amt, hp: u.hp }); }
        }
    }
    if (D.cleanse) for (const u of allies(B, team)) u.stun = 0;
    if (D.hex) {
        for (const u of foes(B, team)) {
            if (u.kind === 'structure') continue;
            const amt = Math.min(u.hp - 1, Math.round(u.hpMax * D.hex));
            if (amt > 0) { u.hp -= amt; fx.push({ id: u.id, dmg: amt, hp: u.hp }); }
        }
        B.hex = true;
    }
    B.events.push({ type: 'power', team, name: D.name, desc: D.desc, co: B.co[team], fx });
}

// ------------------------------------------------------------------ phases
export function startPhase(G, B, team) {
    B.phase = team;
    if (team === 'p') {
        // a full round has passed
        if (B.started) B.turn++;
        B.started = true;
    }
    const p = B.power[team];
    p.on = false;
    if (team === 'p' && B.hex && B.hexArmed) { B.hex = false; B.hexArmed = false; }
    if (team === 'p' && B.hex) B.hexArmed = true;
    // income and healing
    let income = 0;
    for (let i = 0; i < B.tiles.length; i++) if (B.own[i] === team && TERRAIN[B.tiles[i]].prop) income += 100;
    B.funds[team] += income;
    const heals = [];
    for (const u of allies(B, team)) {
        u.acted = false; u.moved = false;
        if (u.cd > 0) u.cd--;
        if (u.wardT > 0 && --u.wardT === 0) { u.ward = 0; u.thorns = false; }
        if (u.rallyT > 0 && --u.rallyT === 0) u.rally = 0;
        if (u.stun > 0) { u.acted = true; u.stun--; }
        if (u.kind === 'structure') { u.acted = true; continue; }
        if (u.hp >= u.hpMax) continue;
        const i = idx(B, u.x, u.y), tid = B.tiles[i];
        let frac = 0;
        if (TERRAIN[tid].prop && B.own[i] === team) frac += PROPERTY.heal;
        if (TERRAIN[tid].heal) frac += TERRAIN[tid].heal;
        if (u.traits.includes('regrowth')) frac += 0.1;
        if (tid === 'lava' && u.traits.includes('lavaborn')) frac += 0.2;
        if (frac > 0) {
            const amt = Math.min(u.hpMax - u.hp, Math.round(u.hpMax * frac));
            if (amt > 0) { u.hp += amt; heals.push({ id: u.id, amt, hp: u.hp, hpMax: u.hpMax }); }
        }
    }
    B.events.push({ type: 'phase', team, turn: B.turn });
    if (income) B.events.push({ type: 'income', team, amount: income });
    if (heals.length) B.events.push({ type: 'heal', list: heals });
    if (team === 'p') {
        for (const t of B.talk) if (t.turn === B.turn && !B.talked[t.key]) { B.talked[t.key] = true; B.events.push({ type: 'talk', lines: t.lines }); }
        if (B.objective.type === 'survive' && B.turn > B.objective.turns) return finish(G, B, true, 'held');
        if (B.limit && B.turn > B.limit) return finish(G, B, false, 'time');
        if (B.turn > 60) return finish(G, B, false, 'time');
    }
    B.aiT = 0.6;
    B.aiQueue = null;
}

export function endPhase(G, B) {
    if (B.over) return;
    // anything left unmoved simply waits
    startPhase(G, B, B.phase === 'p' ? 'e' : 'p');
}

// ------------------------------------------------------------------ the end of a battle
export function checkEnd(G, B) {
    if (B.over) return;
    const T = tamerOf(B);
    if (!T) return finish(G, B, false, 'tamer');
    // a stronghold that started as yours and is now the Chain's ends it
    for (const i of B.homeHq) if (B.own[i] === 'e') return finish(G, B, false, 'hq');
    // with every dragon down and none left to call, Kestrel has to fall back
    const flock = B.units.some((u) => u.hp > 0 && u.team === 'p' && !u.tamer);
    if (!flock && !reserve(G, B).some((d) => B.funds.p >= callCost(G, d.rid)) && B.phase === 'p') return finish(G, B, false, 'flock');
    const O = B.objective;
    const enemies = B.units.filter((u) => u.hp > 0 && u.team === 'e' && u.kind !== 'structure' && !u.bound);
    if (O.type === 'unchain') {
        const t = B.units.find((u) => u.target);
        if (t && t.team === 'p') return finish(G, B, true, 'freed');
        if (!t || t.hp <= 0) return finish(G, B, false, 'target');
    }
    if (O.type === 'boss') {
        const boss = B.units.find((u) => u.boss && u.team === 'e');
        if (!boss || boss.hp <= 0) return finish(G, B, true, 'boss');
    }
    if (O.type === 'hq') {
        for (let i = 0; i < B.tiles.length; i++) if (B.tiles[i] === 'hq' && B.own[i] === 'p' && B.enemyHq.includes(i)) return finish(G, B, true, 'hq');
    }
    if (O.type === 'reach') {
        if (T.x === O.at[0] && T.y === O.at[1]) return finish(G, B, true, 'reach');
    }
    // chained strays are prisoners, not soldiers: with their captors gone they break loose and flee
    if (O.type !== 'survive' && O.type !== 'reach' && O.type !== 'unchain' && !enemies.some((u) => !u.chained)) return finish(G, B, true, 'rout');
}

/** Rank from turns, faints and recruits. */
export function rankOf(B) {
    const par = Math.round((B.w + B.h) * 0.55);
    let score = 100 - Math.max(0, B.turn - par) * 4 - B.stats.faints * 10 + B.recruited.length * 4;
    score = clamp(score, 0, 100);
    return score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
}
const RANK_BONUS = { S: 0.5, A: 0.25, B: 0.1, C: 0 };

/** Settle the battle: rewards are applied here, once, so a reload after a win keeps them. */
export function finish(G, B, win, reason) {
    if (B.over) return;
    B.over = { win, reason };
    const M = G.meta;
    const res = { win, reason, gold: 0, eggs: [], rank: null, unlock: [], song: 0, recruited: B.recruited.slice(), found: B.found.slice(), first: false };
    // everyone who fought grows a little closer to Kestrel
    for (const rid of B.deployed) {
        const d = M.dragons.find((r) => r.rid === rid);
        if (!d) continue;
        d.battles++;
        if (win) { d.wins++; d.bond = Math.min(10, d.bond + (d.traits.includes('loyal') ? 2 : 1)); }
    }
    if (win) {
        const rank = rankOf(B);
        res.rank = rank;
        let gold;
        if (B.ch >= 0) {
            const C = CHAPTERS[B.ch];
            const first = !M.cleared[C.id];
            res.first = first;
            gold = first ? C.reward.gold : Math.round(C.reward.gold * 0.3);
            if (first) {
                for (const sp of C.reward.eggs || []) { makeEgg(G, sp, { from: 'story' }); res.eggs.push(sp); }
                for (const u of C.reward.unlock || []) { M.flags[u] = true; res.unlock.push(u); }
                if (C.reward.song) { M.song = Math.max(M.song, C.reward.song); res.song = C.reward.song; }
            }
            M.cleared[C.id] = true;
            if (!M.ranks[C.id] || 'SABC'.indexOf(rank) < 'SABC'.indexOf(M.ranks[C.id])) M.ranks[C.id] = rank;
            M.ch = Math.max(M.ch, B.ch + 1);
        } else {
            gold = 150 + 30 * B.lvl;
            M.hunts++;
            if (G.rng() < 0.35) { const sp = randomSpecies(G.rng, 1, B.lvl >= 10 ? 4 : 3); makeEgg(G, sp, { from: 'hunt' }); res.eggs.push(sp); }
        }
        gold = Math.round(gold * (1 + RANK_BONUS[rank])) + Math.round(B.funds.p * 0.1);
        res.gold = gold;
        M.gold += gold;
        // a victory warms every egg in the incubators
        for (const eid of M.incub) { const e = M.eggs.find((x) => x.eid === eid); if (e) e.prog = Math.min(e.need, e.prog + IDLE.winWarm); }
    }
    B.result = res;
    B.events.push({ type: win ? 'win' : 'lose', reason, result: res });
}
