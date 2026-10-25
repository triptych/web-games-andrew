// Dragons as the roost knows them: genes, stats from level, eggs, hatching, breeding, feeding.
// Pure; everything random takes the game's rng.

import { SPECIES, UNITS, TRAITS, MUTATIONS, BREED_RECIPES, DRAGON_NAMES } from './data.js';
import { LEVEL, HATCH, xpNeed } from '../config.js';

export const STATS = ['hp', 'atk', 'def', 'spd'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Gene letter grades for the UI: 0–15. */
export function geneGrade(g) { return g >= 15 ? 'S' : g >= 12 ? 'A' : g >= 9 ? 'B' : g >= 6 ? 'C' : g >= 3 ? 'D' : 'E'; }

export function stageOf(lv) {
    if (lv >= LEVEL.elder) return 'elder';
    if (lv >= LEVEL.adult) return 'adult';
    if (lv >= LEVEL.juvenile) return 'juvenile';
    return 'hatchling';
}
export const STAGE_NAMES = { hatchling: 'Hatchling', juvenile: 'Juvenile', adult: 'Adult', elder: 'Elder' };
export const STAGE_SCALE = { hatchling: 0.62, juvenile: 0.8, adult: 1, elder: 1.12 };

/** The table a unit's numbers come from: a species or a human. */
export function defOf(key) { return SPECIES[key] || UNITS[key]; }

/** Stats at a level. genes 0–15 scale base and growth by 0.85–1.15; train adds flat points. */
export function statsFor(key, lv, genes = null, train = null, traits = []) {
    const d = defOf(key);
    const out = {};
    for (const s of STATS) {
        const g = genes ? genes[s] : 7.5;
        const k = 0.85 + g * 0.02;
        out[s] = Math.floor((d.base[s] + d.grow[s] * (lv - 1)) * k + (train ? train[s] * (s === 'hp' ? 2 : 1) : 0));
    }
    if (traits.includes('hardy')) out.hp = Math.floor(out.hp * 1.12);
    out.hp = Math.max(1, out.hp);
    return out;
}

export function randomGenes(rng, lo = 2, hi = 13) {
    const g = {};
    for (const s of STATS) g[s] = rng.int(lo, hi);
    return g;
}

export function pickName(G) {
    const used = new Set(G.meta.dragons.map((d) => d.name));
    for (let i = 0; i < DRAGON_NAMES.length; i++) {
        const n = DRAGON_NAMES[(G.rng.int(0, DRAGON_NAMES.length - 1) + i) % DRAGON_NAMES.length];
        if (!used.has(n)) return n;
    }
    return DRAGON_NAMES[G.meta.nextRid % DRAGON_NAMES.length] + ' ' + G.meta.nextRid;
}

/** A dragon record for the stable. */
export function makeDragon(G, sp, { lv = 1, genes = null, traits = null, hue = null, gilded = null, gen = 1, parents = null, name = null, bond = 0 } = {}) {
    const S = SPECIES[sp];
    const d = {
        rid: G.meta.nextRid++,
        sp,
        name: name || pickName(G),
        lv,
        xp: 0,
        genes: genes || randomGenes(G.rng),
        train: { hp: 0, atk: 0, def: 0, spd: 0 },
        traits: traits || [S.trait],
        hue: hue ?? Math.round((G.rng() * 0.16 - 0.08) * 1000) / 1000,
        gilded: gilded ?? G.rng() < 1 / 64,
        gen,
        parents,
        bond,
        breedCd: 0,
        battles: 0,
        wins: 0,
    };
    if (!d.traits.includes(S.trait)) d.traits.unshift(S.trait);
    return d;
}

export function dragonStats(d) { return statsFor(d.sp, d.lv, d.genes, d.train, d.traits); }

/** XP to grant; returns the levels gained (each { lv, gains }). */
export function giveXp(d, xp) {
    const ups = [];
    if (d.lv >= LEVEL.max) return ups;
    d.xp += Math.max(0, Math.round(xp));
    while (d.xp >= xpNeed(d.lv) && d.lv < LEVEL.max) {
        const before = dragonStats(d);
        d.xp -= xpNeed(d.lv);
        d.lv++;
        const after = dragonStats(d);
        const gains = {};
        for (const s of STATS) gains[s] = after[s] - before[s];
        ups.push({ lv: d.lv, gains });
    }
    if (d.lv >= LEVEL.max) d.xp = 0;
    return ups;
}

// ------------------------------------------------------------------ eggs
export function eggNeed(sp) { return HATCH[SPECIES[sp].rarity] || HATCH[2]; }

export function makeEgg(G, sp, extra = {}) {
    const e = {
        eid: G.meta.nextEid++,
        sp,
        genes: extra.genes || randomGenes(G.rng),
        traits: extra.traits || [SPECIES[sp].trait],
        hue: extra.hue ?? Math.round((G.rng() * 0.16 - 0.08) * 1000) / 1000,
        gilded: extra.gilded ?? G.rng() < 1 / 64,
        gen: extra.gen || 1,
        parents: extra.parents || null,
        need: eggNeed(sp),
        prog: 0,
        from: extra.from || 'found',
    };
    G.meta.eggs.push(e);
    return e;
}

/** A random species for a market or wild egg: rarity within [lo, hi], weighted to the low end. */
export function randomSpecies(rng, lo = 1, hi = 2, allowHybrid = false) {
    const pool = Object.keys(SPECIES).filter((k) => {
        const s = SPECIES[k];
        return s.rarity >= lo && s.rarity <= hi && (allowHybrid || !s.hybrid);
    });
    const w = pool.map((k) => 1 / SPECIES[k].rarity ** 1.3);
    let r = rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
}

// ------------------------------------------------------------------ breeding
export function canBreed(d) { return d.lv >= LEVEL.adult && d.breedCd <= 0; }

/** What two parents may produce: [{ sp, p }] summing to 1. */
export function breedOdds(a, b) {
    const ea = SPECIES[a.sp].el, eb = SPECIES[b.sp].el;
    const out = new Map();
    const add = (sp, p) => out.set(sp, (out.get(sp) || 0) + p);
    const rec = BREED_RECIPES.find((r) => (r.els[0] === ea && r.els[1] === eb) || (r.els[0] === eb && r.els[1] === ea));
    let left = 1;
    if (rec) { add(rec.sp, rec.chance); left -= rec.chance; }
    // a parent of a hybrid species passes it on like any other
    add(a.sp, left / 2);
    add(b.sp, left / 2);
    return [...out].map(([sp, p]) => ({ sp, p }));
}

/** Lay an egg from two parents. Genes are the parents' average with a nudge; traits are inherited. */
export function breedEgg(G, a, b) {
    const rng = G.rng;
    const odds = breedOdds(a, b);
    let r = rng(), sp = odds[odds.length - 1].sp;
    for (const o of odds) { r -= o.p; if (r <= 0) { sp = o.sp; break; } }
    const genes = {};
    for (const s of STATS) {
        // the better parent's gene counts for a little more, and each generation leans upward
        const hi = Math.max(a.genes[s], b.genes[s]), lo = Math.min(a.genes[s], b.genes[s]);
        const base = hi * 0.6 + lo * 0.4;
        genes[s] = clamp(Math.round(base + rng.range(-1.5, 2.5)), 0, 15);
    }
    const traits = [SPECIES[sp].trait];
    const pool = [...new Set([...a.traits, ...b.traits])].filter((t) => t !== SPECIES[sp].trait && TRAITS[t]);
    for (const t of pool) if (traits.length < 2 && rng() < 0.5) traits.push(t);
    if (traits.length < 2 && rng() < 0.12) {
        const m = rng.pick(MUTATIONS.filter((t) => !traits.includes(t)));
        if (m) traits.push(m);
    }
    const hue = clamp(Math.round(((a.hue + b.hue) / 2 + rng.range(-0.04, 0.04)) * 1000) / 1000, -0.15, 0.15);
    const gilded = (a.gilded || b.gilded) ? rng() < 0.25 : rng() < 1 / 64;
    const gen = Math.max(a.gen, b.gen) + 1;
    a.breedCd = b.breedCd = 1;      // set to real seconds by the caller
    return makeEgg(G, sp, { genes, traits, hue, gilded, gen, parents: [a.name, b.name], from: 'bred' });
}

/** The highest stat total a species can reach at a level, for "how good is this one" bars. */
export function potential(d) {
    return STATS.reduce((a, s) => a + d.genes[s], 0) / 60;
}
