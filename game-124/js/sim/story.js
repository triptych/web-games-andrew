// The story: goals in order, the dialogue engine, Nib's hints, and the ending. Pure.

import { ESSENCE_INFO } from '../config.js';
import { PAGES, ECHOES, NIB, HINTS, EPILOGUE, ENDINGS, WORDS } from './data/text.js';
import { REAGENTS } from './data/reagents.js';
import { emit, phaseName } from './util.js';

/** The context page texts and dialogue lines are written against. */
export function textCtx(G) {
    const L = G.laws;
    // the clue page on the moor names a clashing pair that is not Elowen's own
    const pairs = [];
    for (const e in L.opp) if (e < L.opp[e]) pairs.push([e, L.opp[e]]);
    const key = [...L.elowen].sort().join('|');
    const otherPair = pairs.find((p) => p.join('|') !== key) || pairs[0];
    return { L, name: G.name, word: WORDS, rname: (id) => REAGENTS[id]?.name || id, phase: phaseName, otherPair };
}

// ------------------------------------------------------------------ goals
const F = (G) => G.flags;
export const GOALS = [
    { id: 'shelter', text: 'Find shelter before nightfall.', done: (G) => F(G).hutFound },
    { id: 'fire', text: 'Light the hearth: three pieces of driftwood from the beach.', done: (G) => F(G).hearth },
    { id: 'journal', text: 'Read the journal on the desk.', done: (G) => G.pages.includes('p1') },
    { id: 'sleep', text: 'Sleep through the night.', done: (G) => G.day > 1 || F(G).slept },
    { id: 'lintel', text: 'Study the marks carved above the circle.', done: (G) => F(G).lintel },
    { id: 'distill', text: 'Try one of Elowen\'s instruments.', done: (G) => G.stats.experiments > 0 },
    { id: 'firstspell', text: 'Speak a word that works: write a spell in your book and cast it.', done: (G) => F(G).firstSpell },
    { id: 'nib', text: 'Find who was crying in Whisperwood, to the west.', done: (G) => G.nib.mode === 'follow' || G.nib.mode === 'hut' },
    { id: 'stones', text: 'Wake the three standing stones.', done: (G) => F(G).stoneWood && F(G).stoneFen && F(G).stoneMoor, sub: [
        { text: 'Whisperwood: the stone on the islet in the mere', done: (G) => F(G).stoneWood },
        { text: 'Ember Fen: the stone in the boiling pool', done: (G) => F(G).stoneFen },
        { text: 'The Highmoor: the stone in the storm ring', done: (G) => F(G).stoneMoor },
    ] },
    { id: 'thorns', text: 'Open a way through the cursed thornwall.', done: (G) => F(G).thornGap },
    { id: 'moat', text: 'Cross the black moat.', done: (G) => F(G).crossedMoat },
    { id: 'gate', text: 'Enter the castle.', done: (G) => F(G).inCastle },
    { id: 'door', text: 'Find a way into the keep.', done: (G) => F(G).door },
    { id: 'stair', text: 'Reach the upper hall of the keep.', done: (G) => F(G).gallery },
    { id: 'heart', text: 'Free Elowen.', done: (G) => G.won },
];

export function currentGoal(G) {
    for (const g of GOALS) if (!g.done(G) && !(g.skipIf && g.skipIf(G))) return g;
    return { id: 'done', text: 'Elowen is free.', done: () => true };
}

export function hint(G) {
    const g = currentGoal(G);
    const lines = HINTS[g.id] || HINTS.done;
    const n = G.story.hinted[g.id] || 0;
    G.story.hinted[g.id] = n + 1;
    return lines[Math.min(n, lines.length - 1)];
}

// ------------------------------------------------------------------ dialogue
/** Open a dialogue: 'rescue', 'epilogue', 'page:p1', 'echo:e2', or a one-line 'say'. */
export function openDialog(G, id, extra = {}) {
    G.dialog = { id, i: 0, ...extra };
    emit(G, { type: 'dialog', id });
}

export function dialogLines(G) {
    const d = G.dialog;
    if (!d) return null;
    if (d.id === 'rescue') return NIB.rescue;
    if (d.id === 'epilogue') return EPILOGUE;
    if (d.id === 'say') return [{ who: d.who, text: d.text }];
    if (d.id.startsWith('page:')) { const p = PAGES[d.id.slice(5)]; return [{ who: 'page', title: p.title, text: p.text(textCtx(G)) }]; }
    if (d.id.startsWith('echo:')) return [{ who: 'elowen', echo: true, text: ECHOES[d.id.slice(5)].text(textCtx(G)) }];
    return null;
}

/** The node on screen, with any function text resolved. */
export function dialogNode(G) {
    const lines = dialogLines(G);
    if (!lines) return null;
    const n = lines[G.dialog.i];
    if (!n) return null;
    const ctx = textCtx(G);
    return { ...n, text: typeof n.text === 'function' ? n.text(ctx) : n.text, i: G.dialog.i, of: lines.length };
}

/** Advance (choice = index into the node's choices, or undefined to continue). */
export function advance(G, choice) {
    const lines = dialogLines(G);
    const d = G.dialog;
    if (!lines || !d) return;
    const n = lines[d.i];
    if (n?.choices) {
        const c = n.choices[choice];
        if (!c) return;
        if (c.aff) G.affection += c.aff;
        if (c.end) { finish(G, c.end); return; }
        d.i = c.to;
    } else if (n && n.next != null) d.i = n.next;
    else d.i++;
    if (d.i >= lines.length) closeDialog(G);
    else emit(G, { type: 'dialogStep' });
}

export function closeDialog(G) {
    const d = G.dialog;
    G.dialog = null;
    if (!d) return;
    if (d.id === 'rescue') {
        G.nib.mode = 'follow';
        emit(G, { type: 'nibJoin' });
    }
    if (d.id.startsWith('echo:')) {
        const id = d.id.slice(5);
        if (G.echoes[id] !== 'heard') { G.echoes[id] = 'heard'; G.affection += 1; }
    }
    emit(G, { type: 'dialogClose', id: d.id });
}

function finish(G, end) {
    const high = G.affection >= 4;
    const E = ENDINGS[end][high ? 'high' : 'low'];
    G.ending = { kind: end, high, title: E.title, text: E.text };
    G.dialog = null;
    G.over = true;
    emit(G, { type: 'ending', end, high });
}

export const essenceWord = (e) => ESSENCE_INFO[e]?.word;
