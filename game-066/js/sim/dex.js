// Builds the 250 species from the evolution lines in data/species.js.
// Base stats come from the parts: every part (and type) tilts a stat spread, which is then scaled
// to the stat total for the line's tier and stage. Learnsets come from the bot's types and the
// technique tags its parts carry. Everything is deterministic.

import { LINES } from './data/species.js';
import { PARTS, TYPE_WEIGHT } from './data/parts.js';
import { MOVES, SIGNATURE } from './data/moves.js';
import { TYPES } from './data/types.js';
import { hashStr } from '../rng.js';
import { STATS } from '../config.js';

const TOTALS = {
    3: { e: [285, 395, 495], m: [300, 415, 510], l: [315, 430, 525], S: [310, 405, 530], P: [300, 420, 600] },
    2: { e: [295, 445], m: [320, 470], l: [340, 495] },
    1: { e: [380], m: [450], l: [490], T: [670], X: [700] },
};
const CATCH = {
    e: [190, 90, 45], m: [150, 75, 40], l: [100, 60, 35], S: [45, 45, 45], P: [45, 45, 25], T: [3], X: [3],
};
const SINGLE_CATCH = { e: 120, m: 90, l: 60 };

export const SPECIES = [null];            // 1-based: SPECIES[1] … SPECIES[250]
export const BY_NAME = {};

function parseParts(str, base) {
    const p = { ...base };
    for (const tok of str.trim().split(/\s+/)) {
        if (!tok) continue;
        const [slot, key] = tok.split(':');
        p[slot] = key;
    }
    return p;
}

/** Stat spread from parts and types, scaled to a total. */
function baseStats(parts, types, total, seed) {
    // Parts and types tilt an even spread; the 0.6 keeps a bot with five Torque parts strong, not absurd.
    const w = [6, 6, 6, 6, 6, 6];
    for (const [slot, key] of Object.entries(parts)) {
        const P = PARTS[slot] && PARTS[slot][key];
        if (!P) continue;
        for (let i = 0; i < 6; i++) w[i] += P.w[i] * 0.6;
    }
    for (const t of types) for (let i = 0; i < 6; i++) w[i] += TYPE_WEIGHT[t][i] * 0.6;
    // A small, fixed personality per species so two bots with the same parts still differ.
    for (let i = 0; i < 6; i++) w[i] += ((seed >>> (i * 4)) & 7) / 7 - 0.5;
    for (let i = 0; i < 6; i++) w[i] = Math.max(1.2, w[i]);
    const sum = w.reduce((a, b) => a + b, 0);
    const out = w.map((x) => Math.max(18, Math.min(175, Math.round((total * x) / sum))));
    // Nudge to the exact total.
    let diff = total - out.reduce((a, b) => a + b, 0);
    for (let k = 0; diff !== 0 && k < 200; k++) {
        const i = k % 6;
        if (diff > 0 && out[i] < 175) { out[i]++; diff--; }
        else if (diff < 0 && out[i] > 18) { out[i]--; diff++; }
    }
    const o = {};
    STATS.forEach((s, i) => { o[s] = out[i]; });
    return o;
}

function tagsOf(parts) {
    const tags = new Set();
    for (const [slot, key] of Object.entries(parts)) {
        const P = PARTS[slot] && PARTS[slot][key];
        if (P) for (const t of P.tags) tags.add(t);
    }
    return tags;
}

// ------------------------------------------------------------------ learnsets
const ATTACKS = Object.values(MOVES).filter((m) => m.cat !== 'U' && !SIGNATURE.has(m.id));
const UTILS = Object.values(MOVES).filter((m) => m.cat === 'U' && !SIGNATURE.has(m.id));
const tierOf = (m) => (m.pow <= 50 ? 1 : m.pow <= 75 ? 2 : m.pow <= 100 ? 3 : 4);

function pickAttack(type, tier, tags, used, h) {
    let pool = ATTACKS.filter((m) => m.type === type && tierOf(m) === tier && !used.has(m.id));
    if (!pool.length) pool = ATTACKS.filter((m) => m.type === type && Math.abs(tierOf(m) - tier) <= 1 && !used.has(m.id));
    if (!pool.length) return null;
    // Prefer techniques that fit the bot's parts.
    const fit = pool.filter((m) => m.tags.some((t) => tags.has(t)));
    const p = fit.length ? fit : pool;
    return p[h % p.length];
}

function buildLearnset(sp, h) {
    const used = new Set();
    const out = [];
    const add = (lv, m) => { if (m && !used.has(m.id)) { used.add(m.id); out.push([lv, m.id]); } };
    const [t1, t2] = sp.types;
    const tags = sp.tags;
    const j = (n) => n + ((h >>> (n % 13)) % 3) - 1;      // ±1 jitter per slot, same across a line

    // Level 1: a basic hit from the chassis or drive, plus a stat trick.
    const basic = tags.has('claw') ? 'rake' : tags.has('peck') ? 'peck' : tags.has('punch') ? 'piston-jab' : tags.has('skate') ? 'ice-skate' : 'ram';
    add(1, MOVES[basic]);
    add(1, MOVES[(h & 1) ? 'rattle' : 'clatter']);

    // Primary type ladder.
    add(t1 === 'scrap' ? 6 : 4, pickAttack(t1, 1, tags, used, h));
    add(j(12), pickAttack(t1, 2, tags, used, h >>> 3));
    add(j(27), pickAttack(t1, 3, tags, used, h >>> 5));
    add(j(45), pickAttack(t1, 4, tags, used, h >>> 7));
    // A second technique of the primary type in the middle.
    add(j(36), pickAttack(t1, 3, tags, used, h >>> 9));
    // Secondary type ladder.
    if (t2) {
        add(j(9), pickAttack(t2, 1, tags, used, h >>> 2));
        add(j(21), pickAttack(t2, 2, tags, used, h >>> 4));
        add(j(40), pickAttack(t2, 3, tags, used, h >>> 6));
    }
    // Part-tag techniques (the body's own moves): its types and Scrap, plus at most one off-type
    // coverage hit that fits a specific part (a claw that crackles, a drill made of ice).
    const own = new Set([...sp.types, 'scrap']);
    const fits = (m) => m.tags.some((t) => t !== 'ram' && tags.has(t));
    const tagMoves = ATTACKS.filter((m) => fits(m) && own.has(m.type) && !used.has(m.id));
    const cover = ATTACKS.filter((m) => fits(m) && !own.has(m.type) && tierOf(m) >= 2 && tierOf(m) <= 3 && !used.has(m.id));
    if (cover.length) add(j(23), cover[(h >>> 8) % cover.length]);
    tagMoves.sort((a, b) => a.pow - b.pow || a.id.localeCompare(b.id));
    const tagLv = [7, 17, 31, 50];
    let k = 0;
    for (const tier of [1, 2, 3, 4]) {
        const c = tagMoves.filter((m) => tierOf(m) === tier && !used.has(m.id));
        if (!c.length) continue;
        add(j(tagLv[k++]), c[(h >>> (tier * 3)) % c.length]);
    }
    // Utility techniques: one of each type plus one that fits the parts.
    for (const [i, t] of [t1, t2].filter(Boolean).entries()) {
        const u = UTILS.filter((m) => m.type === t && !used.has(m.id));
        if (u.length) add(j(i ? 24 : 15), u[(h >>> (i * 5 + 1)) % u.length]);
    }
    const tu = UTILS.filter((m) => m.tags.some((t) => tags.has(t)) && !used.has(m.id));
    if (tu.length) add(j(33), tu[(h >>> 11) % tu.length]);
    out.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
    return out.map(([lv, id]) => [Math.max(1, lv), id]);
}

// ------------------------------------------------------------------ build
let num = 0;
LINES.forEach((line, li) => {
    const n = line.names.length;
    const h = hashStr(line.names[0]);
    let parts = {};
    let types = line.types[0];
    const ids = [];
    for (let s = 0; s < n; s++) {
        num++;
        const prevParts = parts;
        parts = parseParts(line.parts[s] || '', parts);
        types = line.types[s] || types;
        const total = TOTALS[n][line.tier] ? TOTALS[n][line.tier][s] : TOTALS[n].m[s];
        const added = Object.entries(parts).filter(([k, v]) => k !== 'e' && prevParts[k] !== v).map(([k, v]) => [k, v]);
        const sp = {
            id: num, name: line.names[s], line: li, stage: s + 1, stages: n, tier: line.tier,
            types: [...types], parts: { ...parts }, added, pal: line.pal, entry: line.entries[s] || line.entries[line.entries.length - 1],
            traits: n === 1 ? [...line.traits] : line.traits.slice(0, s + 1),
            total, anyCard: !!line.anyCard, sig: line.sig || null,
        };
        sp.base = baseStats(parts, types, total, hashStr(sp.name));
        sp.tags = tagsOf(parts);
        sp.catchRate = n === 1 ? (CATCH[line.tier] ? CATCH[line.tier][0] : SINGLE_CATCH[line.tier]) : (CATCH[line.tier] || CATCH.m)[s];
        sp.xpYield = Math.round(total * (0.18 + 0.08 * (n === 1 ? 2 : s + 1)));
        sp.learnset = buildLearnset(sp, h);
        if (sp.sig) sp.learnset.push([50, sp.sig]);
        SPECIES[num] = sp;
        BY_NAME[sp.name.toLowerCase()] = sp;
        ids.push(num);
    }
    // Evolution links.
    for (let s = 0; s < n - 1; s++) {
        const tok = line.evo[s];
        const from = SPECIES[ids[s]], to = SPECIES[ids[s + 1]];
        let method;
        if (/^\d+$/.test(tok)) method = { k: 'level', lv: +tok };
        else if (tok === 'sync') method = { k: 'sync' };
        else if (tok && tok.startsWith('kit:')) method = { k: 'kit', item: tok.slice(4) };
        else throw new Error(`${from.name}: bad evolution token ${tok}`);
        from.evolves = { to: to.id, ...method };
        to.from = from.id;
    }
});

export const SPECIES_TOTAL = num;

/** Every species in the same line, in order. */
export function lineOf(id) {
    const li = SPECIES[id].line;
    return SPECIES.filter((s) => s && s.line === li);
}

/** Moves a species learns between two levels (exclusive, inclusive]. */
export function movesLearned(id, fromLv, toLv) {
    return SPECIES[id].learnset.filter(([lv]) => lv > fromLv && lv <= toLv).map(([, m]) => m);
}

/** The four most recent level-up techniques at a level (for wild and trainer bots). */
export function defaultMoves(id, lv) {
    const ls = SPECIES[id].learnset.filter(([l]) => l <= lv).map(([, m]) => m);
    const uniq = [...new Set(ls)];
    // Keep the newest four but prefer attacks: wild bots with four stat tricks are dull.
    const atk = uniq.filter((m) => MOVES[m].cat !== 'U');
    const util = uniq.filter((m) => MOVES[m].cat === 'U');
    const picked = [...atk.slice(-3), ...util.slice(-1)];
    if (picked.length < 4) for (const m of [...uniq].reverse()) if (!picked.includes(m) && picked.length < 4) picked.push(m);
    return picked.slice(0, 4);
}

/** Can this species run a program card for this technique? */
export function canLearnCard(id, moveId) {
    const sp = SPECIES[id], m = MOVES[moveId];
    if (!sp || !m) return false;
    if (sp.anyCard) return true;
    if (sp.types.includes(m.type)) return true;
    if (m.tags.some((t) => sp.tags.has(t))) return true;
    if (['bulwark', 'patch-up', 'cold-restart', 'rev-up', 'focus-lens', 'full-throttle'].includes(moveId)) return true;
    return false;
}

export { TYPES };
