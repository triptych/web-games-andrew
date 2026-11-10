// The numbers: stat gains, effects, conditions, checks and the ending evaluation. Pure.

import { SOFTCAP, MIN_GAIN, STAT_MAX, AFF_SOFT, PARTNER_MIN } from '../config.js';
import { FRIENDS } from './data/cast.js';
import { ENDINGS } from './data/endings.js';

export const STAT_KEYS = ['str', 'vit', 'int', 'grc', 'cha', 'mor', 'fth', 'art', 'cmb', 'mag', 'elo', 'com', 'cun', 'drc', 'fame', 'fav', 'sts', 'bond'];
export const STAT_NAMES = {
    str: 'Strength', vit: 'Vitality', int: 'Intellect', grc: 'Grace', cha: 'Charm', mor: 'Morality', fth: 'Faith', art: 'Artistry',
    cmb: 'Combat', mag: 'Magic', elo: 'Eloquence', com: 'Commerce', cun: 'Cunning', drc: 'Draconity', fame: 'Renown',
    fav: 'Royal Favor', sts: 'Stress', bond: 'Bond', gold: 'Gold',
};
// Stats that are not trained like skills: they move by exactly the amount given, with no softcap.
const LINEAR = new Set(['sts', 'bond', 'fav', 'fame', 'mor', 'drc']);
const SOFT_TOP = new Set(['fav', 'fame', 'mor', 'drc', 'fth']);

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 100) / 100;

/** A trained gain shrinks as the stat grows. Losses are taken in full. */
export function gainFor(v, base) {
    if (base <= 0) return base;
    return base * Math.max(MIN_GAIN, 1 - v / SOFTCAP);
}

/** Change one stat (or gold, or affection) and return the real change. */
export function bump(G, key, amount, { trained = false } = {}) {
    if (key === 'gold') { const before = G.gold; G.gold = Math.max(0, Math.round(G.gold + amount)); return G.gold - before; }
    if (key.startsWith('aff.')) return bumpAff(G, key.slice(4), amount);
    if (!(key in G.stats)) throw new Error('unknown stat ' + key);
    const v = G.stats[key];
    let d = trained && !LINEAR.has(key) ? gainFor(v, amount) : amount;
    // reputation, morality and draconity climb freely to the middle and slowly past it
    if (SOFT_TOP.has(key) && d > 0 && v > 50) d *= Math.max(0.25, 1 - (v - 50) / 60);
    G.stats[key] = r1(clamp(v + d, 0, STAT_MAX));
    return r1(G.stats[key] - v);
}

export function bumpAff(G, id, amount) {
    if (!(id in G.aff)) throw new Error('unknown friend ' + id);
    const v = G.aff[id];
    const d = amount > 0 ? amount * Math.max(0.15, 1 - v / AFF_SOFT) : amount;
    G.aff[id] = r1(clamp(v + d, 0, 100));
    return r1(G.aff[id] - v);
}

/**
 * Apply an effect string: 'str+2 mor-1 aff.isolde+5 gold+100 flag:x !flag:y partner:isolde'. Story effects are
 * applied as given (not softcapped), so a scene always does what it says. Returns { key: change }.
 */
export function applyFx(G, fx) {
    const out = {};
    for (const tok of fx.trim().split(/\s+/)) {
        if (!tok) continue;
        if (tok.startsWith('flag:')) { G.flags[tok.slice(5)] = true; continue; }
        if (tok.startsWith('!flag:')) { delete G.flags[tok.slice(6)]; continue; }
        if (tok.startsWith('partner:')) {
            const id = tok.slice(8);
            if (!G.partner) { G.partner = id; G.events.push({ type: 'betrothed', id }); }
            continue;
        }
        const m = tok.match(/^([a-z.]+)([+-])([\d.]+)$/);
        if (!m) throw new Error('bad fx token ' + tok);
        const d = (m[2] === '-' ? -1 : 1) * +m[3];
        const got = m[1].startsWith('aff.') ? bumpAff(G, m[1].slice(4), d) : bump(G, m[1], d);
        out[m[1]] = (out[m[1]] || 0) + got;
    }
    if (Object.keys(out).length) G.events.push({ type: 'fx', fx: out });
    return out;
}

/** The value a condition term refers to. */
function val(G, key) {
    if (key === 'gold') return G.gold;
    if (key === 'age') return G.age;
    if (key === 'month') return G.month;
    if (key.startsWith('aff.')) return G.aff[key.slice(4)] ?? 0;
    if (key.startsWith('count.')) return G.count[key.slice(6)] ?? 0;
    if (key in G.stats) return G.stats[key];
    throw new Error('unknown condition key ' + key);
}

/** 'cmb>=40 & aff.isolde>=55 & flag:x & !flag:y & partner & partner=isolde' */
export function evalCond(G, cond) {
    return cond.split('&').every((raw) => {
        const t = raw.trim();
        if (!t) return true;
        if (t === 'partner') return !!G.partner;
        if (t === '!partner') return !G.partner;
        if (t.startsWith('partner=')) return G.partner === t.slice(8);
        if (t.startsWith('flag:')) return !!G.flags[t.slice(5)];
        if (t.startsWith('!flag:')) return !G.flags[t.slice(6)];
        const m = t.match(/^([a-z.]+)\s*(>=|<=|>|<|==)\s*(-?[\d.]+)$/);
        if (!m) throw new Error('bad condition ' + t);
        const v = val(G, m[1]), n = +m[3];
        return m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : m[2] === '<' ? v < n : v === n;
    });
}

// ------------------------------------------------------------------ checks
/** Weighted power of a stat mix, e.g. { cmb: 0.6, str: 0.4 }. */
export function power(G, mix) {
    let p = 0;
    for (const k in mix) p += val(G, k) * mix[k];
    return p;
}

/** Chance a quest succeeds: the average margin over its requirements. */
export function questChance(G, q) {
    const ks = Object.keys(q.check);
    const margin = ks.reduce((a, k) => a + (val(G, k) - q.check[k]), 0) / ks.length;
    return clamp(0.55 + margin / 28, 0.05, 0.97);
}

/** Chance an expedition encounter goes well for an approach. */
export function encounterChance(G, mix, diff) {
    return clamp(0.5 + (power(G, mix) - diff) / 36, 0.06, 0.95);
}

// ------------------------------------------------------------------ endings
/** How well the prince meets an ending: null if not eligible, else the total margin over its minimums. */
export function endingScore(G, E) {
    if (E.bad || E.id === 'quiet') return null;
    if (E.partner && !(G.partner && G.aff[G.partner] >= PARTNER_MIN)) return null;
    if (E.flag && !G.flags[E.flag]) return null;
    if (E.anyFlag && !E.anyFlag.some((f) => G.flags[f])) return null;
    let score = 0;
    for (const k in E.req || {}) {
        const v = val(G, k), need = E.req[k];
        if (v < need) return null;
        score += k === 'gold' ? Math.min(30, (v - need) / 100) : v - need;
    }
    for (const k in E.max || {}) if (val(G, k) > E.max[k]) return null;
    for (const k in E.min || {}) if (val(G, k) < E.min[k]) return null;
    for (const k in E.count || {}) if ((G.count[k] || 0) < E.count[k]) return null;
    // a bonus per requirement met, so broad, demanding endings beat narrow ones when both qualify
    return score / Object.keys(E.req).length + Object.keys(E.req).length * 4 + (E.partner ? 12 : 0) + (E.flag || E.anyFlag ? 8 : 0);
}

/** Which bad ending, if any, the prince is headed for. */
export function badEnding(G) {
    const s = G.stats;
    if (s.bond <= 15 && s.sts >= 60) return 'runaway';
    if ((s.fav <= 14 && s.drc >= 55 && s.mor <= 45) || (G.flags.duke_won && s.fav <= 22 && s.mor < 50)) return 'exile';
    return null;
}

export function chooseEnding(G) {
    const bad = badEnding(G);
    if (bad) return bad;
    let best = 'quiet', bestScore = -Infinity;
    for (const E of ENDINGS) {
        const sc = endingScore(G, E);
        if (sc != null && sc > bestScore) { best = E.id; bestScore = sc; }
    }
    return best;
}

/**
 * How close the prince is to each career ending, 0..1 (the share of the requirement total he has reached).
 * Drives "Ask about the future" and the bot's sense of progress.
 */
export function endingProgress(G, E) {
    if (E.bad || E.id === 'quiet') return 0;
    let have = 0, need = 0;
    for (const k in E.req || {}) {
        const n = E.req[k], v = val(G, k);
        const w = k === 'gold' ? 1 / 40 : 1;
        have += Math.min(v, n) * w; need += n * w;
    }
    for (const k in E.count || {}) { have += Math.min(G.count[k] || 0, E.count[k]) * 3; need += E.count[k] * 3; }
    if (E.flag && !G.flags[E.flag]) need += 20;
    if (E.anyFlag && !E.anyFlag.some((f) => G.flags[f])) need += 10;
    for (const k in E.max || {}) if (val(G, k) > E.max[k]) have -= (val(G, k) - E.max[k]);
    for (const k in E.min || {}) if (val(G, k) < E.min[k]) have -= (E.min[k] - val(G, k));
    return need ? Math.max(0, have / need) : 0;
}

export function nearestEnding(G) {
    const bad = badEnding(G);
    if (bad) return bad;
    let best = 'quiet', bp = 0.45;
    for (const E of ENDINGS) {
        const p = endingProgress(G, E);
        if (p > bp) { bp = p; best = E.id; }
    }
    return best;
}

/** The friend with the most affection (the prince's closest friend). */
export function bestFriend(G) {
    return FRIENDS.filter((f) => G.flags['met_' + f]).sort((a, b) => G.aff[b] - G.aff[a])[0] || null;
}
