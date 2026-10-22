// Slot combat. Pure: everything random goes through G.rng.
//
// A turn: SPIN lands every reel at random (free). Then spend Energy to nudge a reel one symbol
// up or down, or respin it. FIRE resolves the payline (one symbol per reel), then every enemy
// carries out the intent it showed, and a new turn starts.

import { SYMBOLS, SYMBOL_ORDER, ENEMIES } from './data.js';
import { PLAYER, MULT, COST, ETCH, FOE } from '../config.js';

const mod = (a, n) => ((a % n) + n) % n;

/** A small copy of everything the HUD shows, attached to each battle event so the view can
 *  replay a resolved turn beat by beat and the HUD never runs ahead of the animation. */
export function snap(G) {
    const B = G.b;
    return {
        hp: G.p.hp, maxHp: G.p.maxHp, block: B ? B.block : 0, energy: B ? B.energy : 0,
        e: B ? B.enemies.map((e) => ({ hp: e.hp, maxHp: e.maxHp, block: e.block, burn: e.burn, str: e.str, move: e.move, alive: e.hp > 0 })) : [],
    };
}

export function emit(G, e) {
    if (G.b) e.s = snap(G);
    G.events.push(e);
}

export function intentOf(e) { return ENEMIES[e.id].moves[e.move]; }
/** One hit of an attack intent, with the enemy's strength. */
export const hitOf = (e, m) => Math.round(m.v * FOE.dmg) + e.str;

/** The symbol each reel shows on the payline. */
export function line(G) {
    const B = G.b;
    return B.reels.map((strip, r) => strip[mod(B.stops[r], strip.length)]);
}

/** One copy's value, before matches multiply it. */
export function copyValue(G, sym) {
    const d = SYMBOLS[sym];
    let v = d.base * (1 + ETCH * (G.p.etch[sym] || 0));
    if ((sym === 'blade' || sym === 'comet') && G.p.perks.sharp) v += G.p.perks.sharp;
    return v;
}

export function multFor(G, n) {
    let m = MULT[Math.min(n, MULT.length - 1)];
    if (n === 2 && G.p.perks.twin) m = 2;
    if (n >= 3 && G.p.perks.jackpot) m += 1;
    return m;
}

/**
 * What a payline does. Wild Stars (and Static, with the Static Filter) join the biggest group;
 * every copy in a group of n is multiplied by MULT[n].
 */
export function evaluate(G, syms) {
    const P = G.p.perks;
    const counts = {};
    let wilds = 0;
    for (const s of syms) {
        if (s === 'wild' || (s === 'static' && P.filter)) wilds++;
        else if (s !== 'static') counts[s] = (counts[s] || 0) + 1;
    }
    let best = null;
    for (const s of SYMBOL_ORDER) if (counts[s] && (!best || counts[s] > counts[best])) best = s;
    if (!best && wilds) best = 'blade';
    const groups = [];
    for (const s of SYMBOL_ORDER) {
        const n = (counts[s] || 0) + (s === best ? wilds : 0);
        if (!n) continue;
        const per = copyValue(G, s);
        const total = s === 'charge'
            ? Math.floor(n * (1 + ETCH * (G.p.etch.charge || 0)))
            : Math.round(per * n * multFor(G, n) * (s === 'blade' || s === 'comet' || s === 'hex' ? (P.supernova ? 1.25 : 1) : 1));
        groups.push({ sym: s, n, total });
    }
    const out = { groups, dmg: 0, aoe: 0, burn: 0, block: 0, heal: 0, energy: 0, leech: 0, top: 0 };
    for (const g of groups) {
        out.top = Math.max(out.top, g.n);
        if (g.sym === 'blade') { out.dmg = g.total; if (P.leech) out.leech = g.n; }
        else if (g.sym === 'comet') out.aoe = g.total;
        else if (g.sym === 'hex') out.burn = g.total;
        else if (g.sym === 'shield') out.block = g.total;
        else if (g.sym === 'mend') out.heal = g.total;
        else if (g.sym === 'charge') out.energy = g.total;
    }
    return out;
}

export function startBattle(G, ids, boss = false) {
    const enemies = ids.map((eid) => {
        const d = ENEMIES[eid];
        // later fights in a sector are a little tougher
        const hp = Math.round(d.hp * FOE.hp * (1 + FOE.perStop * G.stop));
        return { id: eid, hp, maxHp: hp, block: 0, burn: 0, str: 0, move: d.boss ? 0 : G.rng.int(0, d.moves.length - 1) };
    });
    G.b = {
        enemies, boss,
        reels: G.p.reels.map((s) => s.slice()),
        stops: G.p.reels.map(() => 0),
        spun: false, energy: 0, next: 0, free: false, block: 0, target: 0, turn: 0,
    };
    G.phase = 'battle';
    G.b.stops = G.b.reels.map((s) => G.rng.int(0, s.length - 1));
    beginTurn(G, true);
    if (G.p.perks.plating) G.b.block += 6 * G.p.perks.plating;
    emit(G, { type: 'battle', boss, ids, reels: G.b.reels.map((r) => r.slice()), stops: G.b.stops.slice() });
}

function beginTurn(G, first = false) {
    const B = G.b, P = G.p.perks;
    B.turn++;
    if (!first) B.block = P.aegis ? Math.floor(B.block / 2) : 0;
    B.energy = PLAYER.energy + (P.capacitor || 0) + (P.supernova ? 1 : 0) + B.next;
    B.next = 0;
    B.spun = false;
    B.free = !!P.spark;
    fixTarget(G);
    if (!first) emit(G, { type: 'turn' });
}

function fixTarget(G) {
    const B = G.b;
    if (B.enemies[B.target]?.hp > 0) return;
    const i = B.enemies.findIndex((e) => e.hp > 0);
    B.target = Math.max(0, i);
}

function pay(G, cost) {
    const B = G.b;
    if (B.free) { B.free = false; return true; }
    if (B.energy < cost) return false;
    B.energy -= cost;
    return true;
}

/** Can this battle action be taken now? */
export function canBattle(G, a) {
    const B = G.b;
    if (!B || G.phase !== 'battle') return false;
    if (a.t === 'spin') return !B.spun;
    if (a.t === 'fire') return B.spun;
    if (a.t === 'target') return B.enemies[a.i]?.hp > 0;
    if (a.t === 'nudge' || a.t === 'respin') {
        return B.spun && a.reel >= 0 && a.reel < B.reels.length && (B.free || B.energy >= COST[a.t]);
    }
    return false;
}

export function battleAct(G, a) {
    if (!canBattle(G, a)) return false;
    const B = G.b;
    if (a.t === 'spin') {
        B.stops = B.reels.map((s) => G.rng.int(0, s.length - 1));
        B.spun = true;
        emit(G, { type: 'spin', stops: B.stops.slice() });
    } else if (a.t === 'nudge') {
        pay(G, COST.nudge);
        const n = B.reels[a.reel].length;
        B.stops[a.reel] = mod(B.stops[a.reel] + (a.dir < 0 ? -1 : 1), n);
        emit(G, { type: 'nudge', reel: a.reel, dir: a.dir < 0 ? -1 : 1, stop: B.stops[a.reel] });
    } else if (a.t === 'respin') {
        pay(G, COST.respin);
        B.stops[a.reel] = G.rng.int(0, B.reels[a.reel].length - 1);
        emit(G, { type: 'respin', reel: a.reel, stop: B.stops[a.reel] });
    } else if (a.t === 'target') {
        B.target = a.i;
        emit(G, { type: 'target', i: a.i });
    } else if (a.t === 'fire') {
        fire(G);
    }
    return true;
}

function hurtEnemy(G, i, amount, kind) {
    const e = G.b.enemies[i];
    if (e.hp <= 0 || amount <= 0) return 0;
    let dmg = amount;
    if (kind !== 'burn') {
        const soak = Math.min(e.block, dmg);
        e.block -= soak;
        dmg -= soak;
    }
    e.hp = Math.max(0, e.hp - dmg);
    G.stats.dmg += dmg;
    emit(G, { type: 'hit', i, dmg, soaked: amount - dmg, kind });
    if (e.hp <= 0) emit(G, { type: 'edie', i });
    return dmg;
}

const alive = (G) => G.b.enemies.filter((e) => e.hp > 0);

function fire(G) {
    const B = G.b, p = G.p;
    const syms = line(G);
    const r = evaluate(G, syms);
    if (r.top >= 3) G.stats.jackpots++;
    G.stats.best = Math.max(G.stats.best, r.dmg + r.aoe * alive(G).length);
    emit(G, { type: 'fire', line: syms, groups: r.groups, top: r.top });
    if (r.block) { B.block += r.block; emit(G, { type: 'pblock', amount: r.block }); }
    if (r.heal + r.leech) {
        const amount = Math.min(p.maxHp - p.hp, r.heal + r.leech);
        p.hp += amount;
        emit(G, { type: 'pheal', amount });
    }
    if (r.energy) { B.next += r.energy; emit(G, { type: 'charge', amount: r.energy }); }
    fixTarget(G);
    if (r.dmg) hurtEnemy(G, B.target, r.dmg, 'blade');
    if (r.aoe) B.enemies.forEach((e, i) => { if (e.hp > 0) hurtEnemy(G, i, r.aoe, 'comet'); });
    fixTarget(G);
    if (r.burn && B.enemies[B.target].hp > 0) {
        B.enemies[B.target].burn += r.burn;
        emit(G, { type: 'burn', i: B.target, amount: r.burn });
    }
    if (!alive(G).length) return;
    enemyTurn(G);
    if (p.hp <= 0) return;
    if (!alive(G).length) return;
    beginTurn(G);
}

function hurtPlayer(G, i, amount) {
    const B = G.b, p = G.p;
    const soak = Math.min(B.block, amount);
    B.block -= soak;
    const dmg = amount - soak;
    p.hp = Math.max(0, p.hp - dmg);
    G.stats.taken += dmg;
    emit(G, { type: 'phit', i, dmg, soaked: soak });
}

function enemyTurn(G) {
    const B = G.b;
    emit(G, { type: 'eturn' });
    for (let i = 0; i < B.enemies.length && G.p.hp > 0; i++) {
        const e = B.enemies[i];
        if (e.hp <= 0) continue;
        e.block = 0;
        if (e.burn > 0) {
            hurtEnemy(G, i, e.burn, 'burn');
            e.burn--;
            if (e.hp <= 0) continue;
        }
        const m = intentOf(e);
        emit(G, { type: 'eact', i, k: m.k });
        if (m.k === 'atk') {
            for (let h = 0; h < (m.n || 1) && G.p.hp > 0; h++) hurtPlayer(G, i, hitOf(e, m));
            if (m.b) e.block += m.b;
        } else if (m.k === 'block') {
            e.block += m.v;
        } else if (m.k === 'buff') {
            e.str += m.v;
        } else if (m.k === 'heal') {
            let j = i, worst = 2;
            B.enemies.forEach((o, k) => { if (o.hp > 0 && o.hp / o.maxHp < worst) { worst = o.hp / o.maxHp; j = k; } });
            const o = B.enemies[j];
            const amount = Math.min(m.v, o.maxHp - o.hp);
            o.hp += amount;
            emit(G, { type: 'eheal', i, j, amount });
        } else if (m.k === 'jam') {
            for (let n = 0; n < m.n; n++) {
                const reel = G.rng.int(0, B.reels.length - 1);
                const at = G.rng.int(0, B.reels[reel].length);
                B.reels[reel].splice(at, 0, 'static');
                if (at <= B.stops[reel]) B.stops[reel]++;
                emit(G, { type: 'jam', i, reel, at, strip: B.reels[reel].slice() });
            }
        }
        e.move = (e.move + 1) % ENEMIES[e.id].moves.length;
    }
}

/** Damage the enemies' shown intents would do to you this turn, before your Block. */
export function incoming(G) {
    let sum = 0;
    for (const e of G.b.enemies) {
        if (e.hp <= 0) continue;
        const m = intentOf(e);
        if (m.k === 'atk') sum += hitOf(e, m) * (m.n || 1);
    }
    return sum;
}

export const battleWon = (G) => G.b && !alive(G).length;
