// Auto-battles. resolveBattle works on copies and never touches G, so the same code plays a real fight,
// a fight that happened while you were away, and the odds shown before you challenge a Warden.

import { FAMILIES, REGIONS, monsterBase, WARDEN_MULT } from './data.js';
import { memberStats, maxHp, cartLevel } from './party.js';
import { makeRng, hash3 } from '../rng.js';
import { clamp } from './core.js';

export function makeFoe(fam, level, { elite = false, warden = null } = {}) {
    const F = warden ? null : FAMILIES[fam];
    const b = monsterBase(level);
    let hp = b.hp * (F ? F.hp : 1), atk = b.atk * (F ? F.atk : 1), def = b.def * (F ? F.def : 1);
    if (elite) { hp *= 1.7; atk *= 1.3; def *= 1.15; }
    if (warden) { hp *= WARDEN_MULT.hp[warden.region]; atk *= WARDEN_MULT.atk; def *= WARDEN_MULT.def; }
    return {
        fam: warden ? warden.id : fam,
        name: warden ? warden.name : (elite ? 'Elite ' : '') + F.name,
        shape: warden ? warden.shape : F.shape,
        col: warden ? warden.col : F.col,
        level, elite, warden: !!warden,
        hp: Math.round(hp), atk, def, spd: warden ? 11 : F.spd, acts: warden ? WARDEN_MULT.acts[warden.region] : 1,
    };
}

/** A road encounter in a region, at about a level. */
export function rollFoes(G, rng, region, level, partySize) {
    const R = REGIONS[region];
    const fams = R.monsters.map((id) => ({ id, weight: FAMILIES[id].rare || 1 }));
    const n = clamp(1 + Math.floor(partySize * 0.6) + (rng.chance(0.4) ? 1 : 0), 1, 6);
    const foes = [];
    const main = rng.weighted(fams).id;
    for (let i = 0; i < n; i++) {
        const fam = i === 0 || rng.chance(0.6) ? main : rng.weighted(fams).id;
        const L = Math.max(1, level + rng.int(-1, 1));
        foes.push(makeFoe(fam, L, { elite: i === 0 && rng.chance(0.06) }));
    }
    return foes;
}

/** The Warden and two of its creatures. night: a rematch on the Night Roads, one tier darker. */
export function wardenFoes(G, region, night = false) {
    const R = REGIONS[region];
    const L = R.warden.level + 10 * (G.tier + (night ? 1 : 0));
    return [
        makeFoe(null, L, { warden: { ...R.warden, region } }),
        makeFoe(R.monsters[0], L - 3),
        makeFoe(R.monsters[1], L - 3),
    ];
}

/**
 * Fight it out. Returns { won, fled, rounds, hits, hp: [after, per member], potions: used, alive }.
 * hits is a short script for the view: { a: 'p'|'f', ai, d: 'p'|'f', di, dmg, crit, heal, aoe, potion }.
 */
export function resolveBattle(G, foes, rng) {
    const bard = cartLevel(G, 'bard') > 0;
    const guard = cartLevel(G, 'guard');
    const hungry = G.rations <= 0;
    const might = G.buffs.shrine && G.buffs.shrine.kind === 'might' && G.buffs.shrine.until > G.t;
    const atkK = (bard ? 1.1 : 1) * (hungry ? 0.85 : 1) * (might ? 1.15 : 1) * (1 + 0.15 * G.tier);
    const defK = guard ? 1 + (5 + 2 * guard) / 100 : 1;
    const potionHeal = (30 + 4 * cartLevel(G, 'alchemist')) / 100;
    let potions = G.potions;

    const units = [];
    G.party.forEach((m, i) => {
        if (m.down || m.hp <= 0) return;
        const s = memberStats(m);
        units.push({ side: 'p', i, cls: m.cls, hp: m.hp, max: maxHp(m), atk: s.atk * atkK, def: s.def * defK, spd: s.spd, turns: 0, level: m.level });
    });
    foes.forEach((f, i) => units.push({ side: 'f', i, hp: f.hp, max: f.hp, atk: f.atk, def: f.def, spd: f.spd, turns: 0, warden: f.warden, acts: f.acts || 1, level: f.level }));
    const order = [...units].sort((a, b) => b.spd - a.spd || (a.side === 'p' ? -1 : 1) || a.i - b.i);
    const alive = (side) => units.filter((u) => u.side === side && u.hp > 0);
    const hits = [];
    const dmgOf = (a, d, k = 1) => {
        const crit = a.cls === 'scout' && rng.chance(0.2);
        // being out-levelled hurts: 4% per level of difference, either way
        const lv = clamp(1 + 0.04 * (a.level - d.level), 0.4, 1.6);
        const raw = (a.atk * a.atk) / (a.atk + d.def) * rng.range(0.85, 1.15) * k * lv * (crit ? 1.8 : 1);
        return { dmg: Math.max(1, Math.round(raw)), crit };
    };
    const note = (h) => { if (hits.length < 40) hits.push(h); };

    let rounds = 0;
    while (rounds < 30 && alive('p').length && alive('f').length) {
        rounds++;
        for (const u of order) {
            if (u.hp <= 0) continue;
            const foesOf = alive(u.side === 'p' ? 'f' : 'p');
            if (!foesOf.length) break;
            u.turns++;
            if (u.side === 'p') {
                if (u.hp < u.max * 0.35 && potions > 0) {
                    potions--;
                    const h = Math.round(u.max * potionHeal);
                    u.hp = Math.min(u.max, u.hp + h);
                    note({ a: 'p', ai: u.i, d: 'p', di: u.i, heal: h, potion: true });
                    continue;
                }
                if (u.cls === 'healer') {
                    const hurt = alive('p').filter((x) => x.hp < x.max * 0.7).sort((x, y) => x.hp / x.max - y.hp / y.max)[0];
                    if (hurt) {
                        const h = Math.round(hurt.max * 0.2 + u.level * 2);
                        hurt.hp = Math.min(hurt.max, hurt.hp + h);
                        note({ a: 'p', ai: u.i, d: 'p', di: hurt.i, heal: h });
                        continue;
                    }
                }
                if (u.cls === 'alchemist' && u.turns % 3 === 0) {
                    for (const t of foesOf) {
                        const { dmg } = dmgOf(u, t, 0.6);
                        t.hp -= dmg;
                        note({ a: 'p', ai: u.i, d: 'f', di: t.i, dmg, aoe: true });
                    }
                    continue;
                }
                // focus the weakest foe
                const t = foesOf.reduce((a, b) => (b.hp < a.hp ? b : a));
                const { dmg, crit } = dmgOf(u, t);
                t.hp -= dmg;
                note({ a: 'p', ai: u.i, d: 'f', di: t.i, dmg, crit });
            } else {
                for (let k = 0; k < u.acts; k++) {
                    const targets = alive('p');
                    if (!targets.length) break;
                    const g = targets.filter((x) => x.cls === 'guard');
                    const t = g.length && rng.chance(0.5) ? g[0] : rng.pick(targets);
                    const { dmg } = dmgOf(u, t);
                    t.hp -= dmg;
                    note({ a: 'f', ai: u.i, d: 'p', di: t.i, dmg });
                }
            }
        }
    }
    const won = alive('f').length === 0;
    const lost = alive('p').length === 0;
    const hp = G.party.map((m, i) => {
        const u = units.find((x) => x.side === 'p' && x.i === i);
        return u ? Math.max(0, Math.round(u.hp)) : m.hp;
    });
    return { won, lost, fled: !won && !lost, rounds, hits, hp, potions: G.potions - potions };
}

/** The chance of winning, from simulated fights on their own random streams (G is not touched). */
export function predictOdds(G, foes, trials = 20) {
    let wins = 0;
    for (let k = 0; k < trials; k++) {
        const rng = makeRng(Math.floor(hash3(G.t, k, G.seed) * 4294967296));
        if (resolveBattle(G, foes.map((f) => ({ ...f })), rng).won) wins++;
    }
    return wins / trials;
}
