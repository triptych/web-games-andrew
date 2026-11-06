// Research: the hut's instruments, and the notebook that remembers what you have seen.
//
// The notebook (G.notes) holds only what an experiment or a cast has actually shown. Nothing in
// it is copied from the laws without an observation behind it, and the bot that proves every
// seed can be finished plays from the notebook alone.

import { ESSENCES, FORMS, ESSENCE_INFO } from '../config.js';
import { REAGENTS } from './data/reagents.js';
import { emit, itemName, phaseName, clockText } from './util.js';

export function newNotes() {
    return {
        reagents: {},          // id → { essence, potency, wax }
        glyphs: {},            // essence glyph id → { essence, not: [] }
        shapes: {},            // shape glyph id → { form, not: [] }
        order: null,           // 'shape-first' | 'essence-first'
        opp: [],               // [e1, e2] essence pairs seen to clash
        apart: [],             // [e1, e2] essence pairs seen not to clash (two notes, or discord)
        oppG: [],              // [g1, g2] glyph pairs that unwove together
        apartG: [],            // [g1, g2] glyph pairs that ground (discord)
        oppR: [],              // [r1, r2] reagent pairs that clashed on the bells
        apartR: [],
        sameR: [],
        links: [],             // [reagent, glyph]: the reagent fed the glyph
        nofeed: [],            // [reagent, glyph]: it starved
        wax: {},               // essence → phase
        colors: {},            // essence → colour seen in the alembic
        pencil: {},            // glyph id → { mark key → '?' | 'x' }, the player's own guesses
        log: [],               // { day, clock, text }
    };
}

const pairKey = (a, b) => (a < b ? a + '|' + b : b + '|' + a);
const hasPair = (list, a, b) => list.some(([x, y]) => pairKey(x, y) === pairKey(a, b));
const addPair = (list, a, b) => { if (!hasPair(list, a, b)) list.push(a < b ? [a, b] : [b, a]); };
const addLink = (list, r, g) => { if (!list.some(([a, b]) => a === r && b === g)) list.push([r, g]); };
const addNot = (arr, v) => { if (!arr.includes(v)) arr.push(v); };

export function noteLog(G, text) {
    G.notes.log.push({ day: G.day, clock: clockText(G.tod), text });
    if (G.notes.log.length > 200) G.notes.log.shift();
}

export function rnote(G, id) { return (G.notes.reagents[id] ||= { essence: null, potency: null, wax: null }); }
export function gnote(G, gid) {
    const g = G.laws.glyphs.find((x) => x.id === gid);
    if (g.kind === 'shape') return (G.notes.shapes[gid] ||= { form: null, not: [] });
    return (G.notes.glyphs[gid] ||= { essence: null, not: [] });
}

/** Spread what is known: links carry essences between reagents and glyphs, pairs become essence pairs. */
export function deduce(G) {
    const N = G.notes;
    for (let pass = 0; pass < 3; pass++) {
        for (const [r, g] of N.links) {
            const rn = rnote(G, r), gn = gnote(G, g);
            if (rn.essence && !gn.essence) gn.essence = rn.essence;
            if (gn.essence && !rn.essence) rn.essence = gn.essence;
        }
        for (const [r, g] of N.nofeed) {
            const rn = rnote(G, r), gn = gnote(G, g);
            if (rn.essence && !gn.essence) addNot(gn.not, rn.essence);
        }
        const eOfG = (g) => N.glyphs[g]?.essence;
        const eOfR = (r) => N.reagents[r]?.essence;
        for (const [a, b] of N.oppG) if (eOfG(a) && eOfG(b)) addPair(N.opp, eOfG(a), eOfG(b));
        for (const [a, b] of N.apartG) if (eOfG(a) && eOfG(b)) addPair(N.apart, eOfG(a), eOfG(b));
        for (const [a, b] of N.oppR) if (eOfR(a) && eOfR(b)) addPair(N.opp, eOfR(a), eOfR(b));
        for (const [a, b] of N.apartR) if (eOfR(a) && eOfR(b)) addPair(N.apart, eOfR(a), eOfR(b));
        for (const [a, b] of N.sameR) {
            if (eOfR(a) && !eOfR(b)) rnote(G, b).essence = eOfR(a);
            if (eOfR(b) && !eOfR(a)) rnote(G, a).essence = eOfR(b);
        }
        for (const id in N.reagents) {
            const rn = N.reagents[id];
            if (rn.essence && rn.wax) N.wax[rn.essence] = rn.wax;
        }
    }
}

// ------------------------------------------------------------------ instruments
const ALEMBIC_SAYS = {
    kindle: 'catches alight: a small flame dances on the glass',
    rime: 'feathers the glass with frost',
    lumen: 'glows from inside, bright enough to throw shadows',
    bloom: 'leaves a pale green shoot uncurling in the condensate',
    gale: 'spins into a tiny whirlwind that rattles the lid',
    still: 'stops in mid-air, perfectly motionless, and stays',
};

/** Run an instrument. Returns { ok, text } and emits an 'experiment' event for the view. */
export function experiment(G, inst, a, b) {
    const L = G.laws;
    const have = (id) => (G.bag[id] || 0) > 0;
    if (!G.flags.hutKnown) return { ok: false, text: 'You have no idea how this works yet.' };
    if (inst === 'alembic') {
        if (!REAGENTS[a] || !have(a)) return { ok: false, text: 'Put a reagent in the alembic first.' };
        G.bag[a]--; if (!G.bag[a]) delete G.bag[a];
        const t = L.reagents[a];
        const rn = rnote(G, a);
        rn.essence = t.essence; rn.potency = t.potency;
        G.notes.colors[t.essence] = L.color[t.essence];
        const plume = t.potency >= 2 ? 'a thick, heavy plume' : 'a thin wisp';
        const text = `${itemName(a)} boils down to ${plume} of vapour that ${ALEMBIC_SAYS[t.essence]}. (It carries ${ESSENCE_INFO[t.essence].name}${t.potency >= 2 ? ', strongly' : ''}.)`;
        noteLog(G, text);
        deduce(G);
        G.stats.experiments++;
        emit(G, { type: 'experiment', inst, a, essence: t.essence, color: L.color[t.essence], potency: t.potency, text });
        return { ok: true, text };
    }
    if (inst === 'bells') {
        if (!REAGENTS[a] || !REAGENTS[b] || !have(a) || !have(b) || a === b) return { ok: false, text: 'Hang two different reagents on the bells.' };
        const ea = L.reagents[a].essence, eb = L.reagents[b].essence;
        let rel, text;
        if (ea === eb) { rel = 'same'; text = `The bells ring the same note, ${itemName(a)} and ${itemName(b)}, and hum together a long while.`; addPair(G.notes.sameR, a, b); }
        else if (L.opp[ea] === eb) { rel = 'clash'; text = `The bells CLASH. ${itemName(a)} and ${itemName(b)} grind against each other and fall horribly silent.`; addPair(G.notes.oppR, a, b); }
        else { rel = 'two'; text = `Two different notes, ${itemName(a)} and ${itemName(b)}, ringing side by side without much interest in each other.`; addPair(G.notes.apartR, a, b); }
        noteLog(G, text);
        deduce(G);
        G.stats.experiments++;
        emit(G, { type: 'experiment', inst, a, b, rel, text });
        return { ok: true, text, rel };
    }
    if (inst === 'orrery') {
        if (!REAGENTS[a] || !have(a)) return { ok: false, text: 'Set a reagent in the orrery\'s cup first.' };
        const e = L.reagents[a].essence;
        const ph = L.wax[e];
        rnote(G, a).wax = ph;
        const text = `With ${itemName(a)} in its cup, the orrery's sun arm swings round to ${phaseName(ph).toUpperCase()} and holds there, trembling.`;
        noteLog(G, text);
        deduce(G);
        G.stats.experiments++;
        emit(G, { type: 'experiment', inst, a, phase: ph, text });
        return { ok: true, text, phase: ph };
    }
    return { ok: false, text: '?' };
}

// ------------------------------------------------------------------ what a cast teaches
/**
 * Record what a cast showed. spell = { glyphs, feed }, res from magic.evaluate.
 * Every branch writes only what the outcome made plain.
 */
export function recordCast(G, spell, res) {
    const N = G.notes;
    const L = G.laws;
    const kind = (g) => L.glyphs.find((x) => x.id === g).kind;
    const shapes = spell.glyphs.filter((g) => kind(g) === 'shape');
    const words = spell.glyphs.map((g, i) => ({ g, r: spell.feed[i] })).filter((w) => kind(w.g) === 'essence');
    if (res.fail === 'tangle' && shapes.length === 1 && spell.glyphs.length >= 2) {
        const first = kind(spell.glyphs[0]) === 'shape';
        const last = kind(spell.glyphs[spell.glyphs.length - 1]) === 'shape';
        if (first !== last) N.order = first ? 'essence-first' : 'shape-first';
    }
    if (!res.fail || res.fail === 'starve' || res.fail === 'discord') {
        // the order was right if we got this far
        if (shapes.length === 1) N.order = kind(spell.glyphs[0]) === 'shape' ? 'shape-first' : 'essence-first';
    }
    if (res.fail === 'starve') {
        // res.starved: index into words that starved; earlier words were fed correctly
        words.forEach((w, i) => {
            if (!w.r) return;
            if (i === res.starved) addLink(N.nofeed, w.r, w.g);
            else if (i < res.starved) addLink(N.links, w.r, w.g);
        });
    }
    if (res.fail === 'discord') {
        for (const w of words) addLink(N.links, w.r, w.g);
        if (words.length === 2) addPair(N.apartG, words[0].g, words[1].g);
    }
    if (!res.fail) {
        for (const w of words) addLink(N.links, w.r, w.g);
        // the form is plain to see; so is the essence, unless the words unwove
        if (shapes.length === 1) { const sn = gnote(G, shapes[0]); sn.form = res.form; }
        if (res.essence !== 'unweave') for (const w of words) gnote(G, w.g).essence = res.essence;
        else if (words.length === 2) addPair(N.oppG, words[0].g, words[1].g);
        if (res.essence !== 'unweave') G.notes.colors[res.essence] = L.color[res.essence];
    }
    // a strap of links among reagents: [r, g] and [r', g] means r and r' carry the same thing
    deduce(G);
}
