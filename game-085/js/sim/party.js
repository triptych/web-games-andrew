// Travellers, their carts, their gear, and how they grow. Pure.

import { CLASSES, FIRST, LAST, SLOTS, GEAR_BASE, GEAR_MATERIAL, GEAR_SUFFIX, UPGRADES } from './data.js';
import { RARITY, PARTY, PACK, xpForLevel, caravanXpFor } from '../config.js';
import { emit, log } from './core.js';

// ------------------------------------------------------------------ members
export function makeMember(G, cls, level, rng, name = null) {
    const m = {
        id: G.nextId++,
        name: name || `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
        cls,
        level: Math.max(1, level),
        xp: 0,
        hp: 0,
        down: false,
        gear: { weapon: null, armor: null, charm: null },
        cart: 1,
        timer: 0,
    };
    m.hp = maxHp(m);
    return m;
}

export function gearBonus(m) {
    const b = { hp: 0, atk: 0, def: 0, spd: 0 };
    for (const s of SLOTS) {
        const it = m.gear[s];
        if (!it) continue;
        for (const k in it.stats) b[k] += it.stats[k];
    }
    return b;
}

export function baseStats(m) {
    const c = CLASSES[m.cls], l = m.level - 1;
    return { hp: c.hp[0] + c.hp[1] * l, atk: c.atk[0] + c.atk[1] * l, def: c.def[0] + c.def[1] * l, spd: c.spd };
}

export function memberStats(m) {
    const b = baseStats(m), g = gearBonus(m);
    return {
        hp: Math.round(b.hp + g.hp),
        atk: Math.round((b.atk + g.atk) * 10) / 10,
        def: Math.round((b.def + g.def) * 10) / 10,
        spd: Math.round((b.spd + g.spd) * 10) / 10,
    };
}
export const maxHp = (m) => memberStats(m).hp;

export function partySlots(level) {
    let n = 1;
    for (const [lv, s] of PARTY.slots) if (level >= lv) n = s;
    return n;
}

/** The best cart of a class in the party (0 if nobody of that class rides with you). */
export function cartLevel(G, cls) {
    let best = 0;
    for (const m of G.party) if (m.cls === cls && m.cart > best) best = m.cart;
    return best;
}

export const partyLevel = (G) => G.party.reduce((a, m) => a + m.level, 0) / G.party.length;

/** Health of the party as a fraction, counting everyone. */
export function partyHealth(G) {
    let hp = 0, max = 0;
    for (const m of G.party) { hp += m.hp; max += maxHp(m); }
    return max ? hp / max : 0;
}

export function partyPower(G) {
    let p = 0;
    for (const m of G.party) {
        const s = memberStats(m);
        p += s.atk * 2 + s.def * 1.5 + s.hp / 5;
    }
    return Math.round(p);
}

// ------------------------------------------------------------------ experience
export function xpMult(G) {
    let k = 1 + 0.04 * G.up.banner;
    const cook = cartLevel(G, 'cook');
    if (cook && G.rations > 0) k *= 1 + (4 + cook) / 100;
    const bard = cartLevel(G, 'bard');
    if (bard) k *= 1 + (3 + bard) / 100;
    if (G.buffs.shrine && G.buffs.shrine.kind === 'xp' && G.buffs.shrine.until > G.t) k *= 1.25;
    return k;
}

export function goldMult(G) {
    let k = 1 + 0.04 * G.up.banner;
    const bard = cartLevel(G, 'bard');
    if (bard) k *= 1 + (3 + bard) / 100;
    return k * (1 + 0.5 * G.tier);
}

export function addXp(G, m, xp) {
    m.xp += xp;
    let ups = 0;
    while (m.xp >= xpForLevel(m.level)) {
        m.xp -= xpForLevel(m.level);
        const before = maxHp(m);
        m.level++;
        ups++;
        m.hp = Math.min(maxHp(m), m.hp + (maxHp(m) - before));
    }
    if (ups) emit(G, { type: 'memberLevel', id: m.id, level: m.level });
    return ups;
}

export function addCaravanXp(G, xp) {
    G.xp += xp;
    while (G.xp >= caravanXpFor(G.level)) {
        G.xp -= caravanXpFor(G.level);
        const slots = partySlots(G.level);
        G.level++;
        G.stats.levelUps++;
        const more = partySlots(G.level) > slots;
        log(G, 'level', `The caravan reached level ${G.level}.${more ? ' There is room for another traveller!' : ''}`, true);
        emit(G, { type: 'levelup', level: G.level, slot: more });
    }
}

// ------------------------------------------------------------------ gear
export function rarityRoll(rng, luck = 0, minRarity = 0) {
    // luck shifts weight from common towards the rarer tiers
    const pool = RARITY.map((r, i) => ({ i, weight: i < minRarity ? 0 : r.weight * (i === 0 ? Math.max(0.15, 1 - luck) : 1 + luck * i) }));
    return rng.weighted(pool).i;
}

export function makeItem(G, rng, ilvl, { slot = null, luck = 0, minRarity = 0 } = {}) {
    slot = slot || rng.pick(SLOTS);
    const rarity = rarityRoll(rng, luck, minRarity);
    const mult = RARITY[rarity].mult;
    const L = Math.max(1, ilvl);
    const stats = {};
    const r1 = (v) => Math.max(1, Math.round(v));
    if (slot === 'weapon') stats.atk = r1(2 + 1.4 * L * mult);
    else if (slot === 'armor') { stats.def = r1(1 + 0.7 * L * mult); stats.hp = r1(3.5 * L * mult); }
    else {
        const k = rng.pick(['hp', 'atk', 'def', 'spd']);
        stats[k] = k === 'hp' ? r1(5 * L * mult) : k === 'atk' ? r1(0.8 * L * mult + 1) : k === 'def' ? r1(0.6 * L * mult + 1) : r1(0.12 * L * mult + 1);
    }
    if (rarity >= 2 && rng.chance(0.5)) {
        const k = rng.pick(['hp', 'atk', 'def', 'spd'].filter((s) => !(s in stats)));
        stats[k] = k === 'hp' ? r1(2 * L * mult) : k === 'spd' ? r1(0.06 * L * mult + 1) : r1(0.35 * L * mult + 1);
    }
    let material = GEAR_MATERIAL[0][1];
    for (const [lv, n] of GEAR_MATERIAL) if (L >= lv) material = n;
    const base = rng.pick(GEAR_BASE[slot]);
    const name = slot === 'charm'
        ? `${['Plain', 'Fine', 'Rune', 'Star', 'Sun'][rarity]} ${material} ${base}`
        : `${material} ${base}`;
    return {
        id: G.nextId++,
        slot,
        rarity,
        ilvl: L,
        name: rarity >= 2 ? `${name} ${rng.pick(GEAR_SUFFIX)}` : name,
        stats,
        value: Math.round(L * 4 * mult * (1 + 0.5 * rarity)),
    };
}

export function itemScore(it) {
    if (!it) return 0;
    const s = it.stats;
    return (s.atk || 0) * 1 + (s.def || 0) * 1.2 + (s.hp || 0) * 0.25 + (s.spd || 0) * 1.5;
}

/** Who gains most from wearing it, and how much. */
export function bestWearer(G, it) {
    let best = null, gain = 0;
    for (const m of G.party) {
        const g = itemScore(it) - itemScore(m.gear[it.slot]);
        if (g > gain) { gain = g; best = m; }
    }
    return { m: best, gain };
}

export function equip(G, itemId, memberId) {
    const i = G.pack.findIndex((x) => x.id === itemId);
    const m = G.party.find((x) => x.id === memberId);
    if (i < 0 || !m) return false;
    const it = G.pack[i];
    G.pack.splice(i, 1);
    const old = m.gear[it.slot];
    const frac = m.hp / maxHp(m);
    m.gear[it.slot] = it;
    if (old) G.pack.push(old);
    m.hp = Math.max(m.down ? 0 : 1, Math.round(maxHp(m) * frac));
    return true;
}

export function unequip(G, memberId, slot) {
    const m = G.party.find((x) => x.id === memberId);
    if (!m || !m.gear[slot]) return false;
    G.pack.push(m.gear[slot]);
    m.gear[slot] = null;
    m.hp = Math.min(m.hp, maxHp(m));
    return true;
}

export function sellItem(G, itemId) {
    const i = G.pack.findIndex((x) => x.id === itemId);
    if (i < 0) return 0;
    const v = G.pack[i].value;
    G.pack.splice(i, 1);
    G.gold += v;
    G.stats.goldEarned += v;
    return v;
}

/** A new piece of gear arrives: wear it if it's better, sell it if it's junk, keep it otherwise. */
export function gainItem(G, it, source) {
    G.pack.push(it);
    G.stats.items++;
    if (it.rarity >= 3) {
        log(G, 'loot', `${source}: ${RARITY[it.rarity].name} ${it.name}!`, true);
        emit(G, { type: 'rareLoot', rarity: it.rarity, name: it.name });
    }
    if (G.orders.autoEquip) {
        const { m, gain } = bestWearer(G, it);
        if (m && gain > 0.01) equip(G, it.id, m.id);
    }
    if (G.orders.autoSell) sellJunk(G);
    while (G.pack.length > PACK.gear) {
        let worst = null;
        for (const x of G.pack) if (!worst || itemScore(x) < itemScore(worst)) worst = x;
        sellItem(G, worst.id);
    }
}

/** Sell every piece in the pack that nobody would wear, up to Fine. */
export function sellJunk(G) {
    let total = 0;
    for (const it of [...G.pack]) {
        if (it.rarity > 1) continue;
        if (bestWearer(G, it).gain > 0.01) continue;
        total += sellItem(G, it.id);
    }
    return total;
}

/** Wear the best of everything in the pack. */
export function equipBest(G) {
    let changed = true, guard = 0;
    while (changed && guard++ < 50) {
        changed = false;
        let best = null;
        for (const it of G.pack) {
            const w = bestWearer(G, it);
            if (w.m && w.gain > 0.01 && (!best || w.gain > best.gain)) best = { it, ...w };
        }
        if (best) { equip(G, best.it.id, best.m.id); changed = true; }
    }
}

export function upgradeCost(G, key) {
    const u = UPGRADES[key];
    return G.up[key] >= u.max ? null : u.cost(G.up[key]);
}
