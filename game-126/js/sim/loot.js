// EMBERSPIRE — experience, gold, loot and making gear. Pure.

import { MONSTERS, BIOMES } from './data/biomes.js';
import { HERO, CLASSES } from './data/heroes.js';
import { GEAR, WEAPON_TYPES, ARMOR_TYPES, ACC_TYPES, RARITY, AFFIXES, UNIQUES, GOODS } from './data/items.js';
import { goldScale, xpScale, xpNext, uniqueFx, blessing } from './stats.js';
import { EVOLVE_LV } from '../config.js';

const RANK_MUL = { normal: 1, mini: 6, boss: 18 };

// ---------------------------------------------------------------- gear
/** Make a gear item and add it to G.gear. Returns its uid. */
export function makeGear(G, { type, lvl, rar = 0, u = null }) {
    const rng = G.rng;
    const uid = 'g' + (G.nextUid++);
    const aff = [];
    const n = u ? 0 : RARITY[rar].affixes;
    const pool = AFFIXES.map((a) => a.id);
    for (let i = 0; i < n; i++) {
        const a = rng.pick(pool.filter((p) => !aff.includes(p)));
        aff.push(a);
    }
    G.gear[uid] = { uid, type: u ? UNIQUES[u].type : type, lvl: Math.max(1, lvl | 0), rar: u ? 4 : rar, plus: 0, aff, u, isNew: true };
    return uid;
}

export function rollRarity(rng, bonus = 0) {
    const r = rng() + bonus;
    if (r > 0.985) return 3;
    if (r > 0.9) return 2;
    if (r > 0.6) return 1;
    return 0;
}

/** A gear type someone in the company could use: weapons and armour for the party, sometimes an accessory. */
export function usefulType(G) {
    const rng = G.rng;
    const r = rng();
    const ids = G.party.length ? G.party : Object.keys(G.heroes).filter((id) => G.heroes[id].joined);
    const h = HERO[rng.pick(ids)];
    const base = CLASSES[h.cls];
    if (r < 0.45) return base.weapon;
    if (r < 0.78) return base.armor;
    return rng.pick(ACC_TYPES);
}

// ---------------------------------------------------------------- experience
export function gainXp(G, id, amt) {
    const h = G.heroes[id];
    h.xp += Math.round(amt);
    let ups = 0;
    while (h.xp >= xpNext(h.lv)) {
        h.xp -= xpNext(h.lv);
        h.lv++;
        h.sp++;
        ups++;
        if (h.lv === EVOLVE_LV && CLASSES[h.cls].tier === 1) G.events.push({ type: 'evolve-ready', id });
    }
    if (ups) G.events.push({ type: 'levelup', id, lv: h.lv, ups });
    return ups;
}

// ---------------------------------------------------------------- after a battle
export function battleRewards(G, B) {
    const rng = G.rng;
    const enemies = B.units.filter((u) => u.side === 'e');
    const bl = blessing(G);
    const party = B.units.filter((u) => u.side === 'p');
    let goldPct = bl?.goldPct || 0, dropPct = bl?.dropPct || 0, xpPct = bl?.xpPct || 0;
    for (const u of party) { goldPct += u.fx.goldPct; dropPct += u.fx.dropPct; }
    let xp = 0, gold = 0;
    for (const e of enemies) {
        const m = RANK_MUL[e.rank] * (e.elite ? 2.2 : 1);
        xp += 6 * xpScale(B.floor) * m;
        gold += 3 * goldScale(B.floor) * m;
    }
    xp = Math.round(xp * (1 + xpPct / 100));
    gold = Math.round(gold * (1 + goldPct / 100)) + B.gold;
    const drops = [];
    const add = (kind, id, n = 1) => {
        if (kind === 'gear') drops.push({ kind, uid: id });
        else {
            G.inv[id] = (G.inv[id] || 0) + n;
            const d = drops.find((x) => x.id === id);
            if (d) d.n += n; else drops.push({ kind, id, n });
        }
    };
    const dm = 1 + dropPct / 100;
    // materials
    for (const e of enemies) {
        if (rng.chance(0.3 * dm)) add('mat', 'ore', e.elite ? 2 : 1);
        if (e.elite && rng.chance(0.5 * dm)) add('mat', 'core', 1);
        if (rng.chance(0.07 * dm)) add('good', rng.pick(['potion', 'potion', 'ether', 'antidote', 'firebomb', 'frostbomb']), 1);
    }
    if (B.rank === 'mini') { add('mat', 'shard', 1 + (rng.chance(0.5) ? 1 : 0)); add('mat', 'ore', 2); }
    if (B.rank === 'boss') { add('mat', 'shard', 2 + rng.int(0, 1)); add('mat', 'core', 1); add('mat', 'ore', 4); add('good', 'phoenix', 1); }
    // gear
    const boss = enemies.find((e) => e.rank === 'boss' || e.rank === 'mini');
    const firstKill = boss && (G.stats.killsBy[boss.ref] || 0) <= 1;
    const uniq = boss && Object.entries(UNIQUES).find(([, u]) => u.from === boss.ref);
    if (boss && uniq && (firstKill || rng.chance(0.08 * dm)) && !ownsUnique(G, uniq[0])) {
        add('gear', makeGear(G, { lvl: B.floor, u: uniq[0] }));
    } else if (B.rank === 'boss') {
        add('gear', makeGear(G, { type: usefulType(G), lvl: B.floor, rar: 3 }));
    } else if (B.rank === 'mini') {
        add('gear', makeGear(G, { type: usefulType(G), lvl: B.floor, rar: Math.max(2, rollRarity(rng, 0.1)) }));
    } else {
        const ch = (0.1 + 0.03 * enemies.length + enemies.filter((e) => e.elite).length * 0.15) * dm;
        if (rng.chance(ch)) add('gear', makeGear(G, { type: usefulType(G), lvl: B.floor, rar: rollRarity(rng, enemies.some((e) => e.elite) ? 0.1 : 0) }));
    }
    // experience: everyone who fought gets it in full, the fallen half, and the bench a share
    const gains = {};
    for (const u of party) {
        const amt = u.alive ? xp : xp * 0.5;
        gains[u.ref] = Math.round(amt);
        gainXp(G, u.ref, amt);
        if (!HERO[u.ref].hero) { const h = G.heroes[u.ref]; h.bond = Math.min((h.bondLv + 1) * 100, h.bond + 2); }
    }
    for (const id of Object.keys(G.heroes)) {
        const h = G.heroes[id];
        if (!h.joined || G.party.includes(id)) continue;
        gainXp(G, id, xp * 0.35);
    }
    G.gold += gold;
    if (G.run) { G.run.gold += gold; G.run.xp += xp; G.run.kills += enemies.length; }
    G.counters.goldEarned += gold;
    G.counters.floors++;
    G.stats.floorsCleared++;
    if (boss && boss.rank === 'boss') G.stats.bossKills++;
    return { xp, gold, drops, gains };
}

export function ownsUnique(G, id) {
    return Object.values(G.gear).some((g) => g.u === id);
}

export { RANK_MUL, MONSTERS, BIOMES, GEAR, WEAPON_TYPES, ARMOR_TYPES, GOODS, uniqueFx };
