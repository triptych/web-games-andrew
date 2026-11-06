// The laws of magic on Hum, made from the seed. Pure: the same seed always makes the same laws,
// and nothing here is ever saved (deserialize rebuilds it from G.seed).
//
// What the seed decides, so that a past life on the island teaches only the method:
//   - the shape and the name of every glyph (nine: six essences, three forms)
//   - which glyph means which essence, and which form
//   - the word order (the form glyph first, or last)
//   - which essences are opposed (three pairs) and so unmake each other when spoken together
//   - the hour each essence waxes in (it is a little stronger then)
//   - the colour each essence glows
//   - which essence every reagent carries, and how strongly
//   - the two words Elowen spoke together on the night of her accident

import { makeRng, hashStr, shuffle } from '../rng.js';
import { ESSENCES, FORMS, PHASES, ESSENCE_HUES } from '../config.js';
import { REAGENTS, REAGENT_IDS } from './data/reagents.js';

const SYL = ['va', 'el', 'or', 'in', 'sa', 'ru', 'ka', 'mi', 'thi', 'lo', 'ne', 'zor', 'ae', 'ith', 'um', 'sel',
    'vin', 'ora', 'tal', 'qui', 'dra', 'fen', 'mor', 'lys', 'ash', 'ky', 'nu', 'hal', 'ves', 'ri', 'en', 'bel', 'yr', 'oth', 'sha', 'cor'];

function makeName(rng, used) {
    for (let tries = 0; tries < 300; tries++) {
        const a = rng.pick(SYL), b = rng.pick(SYL);
        if (a === b) continue;
        const s = a + b;
        if (s.length < 4 || s.length > 7 || used.has(s) || /(.)\1\1/.test(s)) continue;
        used.add(s);
        return s[0].toUpperCase() + s.slice(1);
    }
    return 'Ur' + used.size;
}

// Anchors on a 3×3 grid in [-1, 1]². A glyph is three or four strokes between them.
const A = [];
for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) A.push([i, j]);

function makeStrokes(rng) {
    const strokes = [];
    const n = rng() < 0.5 ? 3 : 4;
    // the spine: a line through or near the middle, so every glyph has a body
    const spines = [[1, 7], [3, 5], [0, 8], [2, 6], [1, 4], [4, 7], [3, 4], [0, 4]];
    const sp = rng.pick(spines);
    strokes.push(['line', sp[0], sp[1]]);
    while (strokes.length < n) {
        const r = rng();
        if (r < 0.38) {
            const a = rng.int(0, 8); let b = rng.int(0, 8);
            if (a === b) continue;
            const da = A[a], db = A[b];
            if (Math.abs(da[0] - db[0]) > 1 && Math.abs(da[1] - db[1]) > 1 && rng() < 0.5) continue;
            strokes.push(['line', a, b]);
        } else if (r < 0.72) {
            // an arc about an anchor: radius 0.5 or 1, starting quadrant, 90/180/270 degrees
            strokes.push(['arc', rng.pick([4, 4, 1, 3, 5, 7]), rng() < 0.6 ? 0.55 : 1, rng.int(0, 3), rng.pick([1, 2, 2, 3])]);
        } else if (r < 0.88) {
            strokes.push(['dot', rng.int(0, 8)]);
        } else {
            strokes.push(['ring', rng.pick([0, 2, 6, 8, 1, 7, 4]), 0.28]);
        }
    }
    return strokes;
}

const sig = (strokes) => strokes.map((s) => s.join(':')).sort().join('|');

export function genLaws(seed) {
    const rng = makeRng(hashStr('hum-laws-' + seed));
    const usedNames = new Set();
    const usedSigs = new Set();

    // nine glyphs, their ids shuffled so an id says nothing about meaning
    const meanings = [...ESSENCES.map((e) => ({ kind: 'essence', essence: e })), ...FORMS.map((f) => ({ kind: 'shape', form: f }))];
    const order = shuffle(meanings, rng);
    const glyphs = order.map((m, i) => {
        let strokes;
        for (let t = 0; t < 50; t++) { strokes = makeStrokes(rng); if (!usedSigs.has(sig(strokes))) break; }
        usedSigs.add(sig(strokes));
        return { id: 'g' + i, name: makeName(rng, usedNames), strokes, ...m };
    });
    const glyphOf = {};
    for (const g of glyphs) glyphOf[g.essence || g.form] = g.id;

    // opposition: a perfect matching of the six essences
    const sh = shuffle(ESSENCES, rng);
    const opp = {};
    for (let i = 0; i < 6; i += 2) { opp[sh[i]] = sh[i + 1]; opp[sh[i + 1]] = sh[i]; }

    // waxing hours: every phase gets at least one essence
    const wax = {};
    const we = shuffle(ESSENCES, rng);
    we.forEach((e, i) => { wax[e] = i < PHASES.length ? PHASES[i].id : rng.pick(PHASES).id; });

    const hues = shuffle(ESSENCE_HUES, rng);
    const color = {};
    ESSENCES.forEach((e, i) => { color[e] = hues[i]; });

    // reagents. The shore always offers the three words carved over the hut's circle, so the
    // first spell can be made without leaving the beach; each region carries its own new word.
    const reagents = {};
    const byRegion = (r) => REAGENT_IDS.filter((id) => REAGENTS[id].region === r);
    const assign = (ids, must) => {
        const ess = shuffle(must, rng);
        while (ess.length < ids.length) ess.push(rng.pick(ESSENCES));
        shuffle(ids, rng).forEach((id, i) => { reagents[id] = { essence: ess[i], potency: 1 }; });
    };
    assign(byRegion('shore'), ['kindle', 'lumen', 'rime']);
    assign(byRegion('wood'), ['bloom']);
    assign(byRegion('fen'), ['gale']);
    assign(byRegion('moor'), ['still']);
    // two strong reagents, never on the shore
    for (const id of shuffle(REAGENT_IDS.filter((id) => REAGENTS[id].region !== 'shore'), rng).slice(0, 2)) reagents[id].potency = 2;

    // the lintel above the circle: the three shore words and the three forms
    const lintel = shuffle(['kindle', 'lumen', 'rime', 'bolt', 'ward', 'seal'].map((m) => glyphOf[m]), rng);

    // Elowen's accident: one of the opposed pairs
    const pairs = [];
    for (const e of ESSENCES) if (e < opp[e]) pairs.push([e, opp[e]]);
    const elowen = shuffle(rng.pick(pairs), rng);

    // the island's hum, a low note for the audio
    const hum = 55 * Math.pow(2, rng.int(0, 11) / 12);

    return {
        seed, glyphs, glyphOf, order: rng() < 0.5 ? 'shape-first' : 'essence-first',
        opp, wax, color, reagents, lintel, elowen, hum,
        // where each region's new word is carved
        regionGlyph: { wood: glyphOf.bloom, fen: glyphOf.gale, moor: glyphOf.still },
        stoneEssence: { wood: 'bloom', fen: 'gale', moor: 'still' },
    };
}

export const glyphById = (L, id) => L.glyphs.find((g) => g.id === id);
