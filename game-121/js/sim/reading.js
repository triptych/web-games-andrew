// One reading, as pure functions: the fate behind a client, what the ball shows of it, the hand the deck
// deals, and how a laid spread scores. No state of its own; the caller owns the rng.

import { THEME_IDS, SYMBOLS_OF, COLOURS_OF, CARDS, CARDS_OF, START_KNOWN } from './data/lexicon.js';
import { HAND, BEATS } from '../config.js';

const shuffle = (rng, a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/**
 * spec: { beats?, concern?, syms?, cols?, clouded: n | [idx], known?: bool, bias?: P(boon), near?: n }
 * Returns { beats, visions, omen, concern, hand, placed, near }.
 */
export function makeReading(rng, spec = {}) {
    let beats = spec.beats ? spec.beats.map((b) => ({ ...b })) : null;
    let concern = spec.concern || null;
    if (!beats) {
        const bias = spec.bias ?? 0.5;
        concern = concern || rng.pick(THEME_IDS);
        const others = shuffle(rng, THEME_IDS.filter((t) => t !== concern)).slice(0, BEATS - 1);
        const themes = [others[0], concern, others[1]];                 // the worry is what is happening now
        beats = themes.map((theme) => ({ theme, tone: rng() < bias ? 'boon' : 'bane' }));
    }
    concern = concern || beats[1].theme;

    const visions = beats.map((b, i) => {
        let pool = SYMBOLS_OF[b.theme];
        if (spec.known) pool = pool.filter((s) => START_KNOWN.sym.includes(s));
        const sym = spec.syms?.[i] || rng.pick(pool);
        let cpool = COLOURS_OF[b.tone];
        if (spec.known) cpool = cpool.filter((c) => START_KNOWN.col.includes(c));
        const col = spec.cols?.[i] || rng.pick(cpool);
        return { sym, col, clouded: false };
    });

    // Which visions are clouded.
    let cl = [];
    if (Array.isArray(spec.clouded)) cl = spec.clouded.slice();
    else if (spec.clouded > 0) cl = shuffle(rng, [0, 1, 2]).slice(0, spec.clouded);
    for (const i of cl) visions[i].clouded = true;

    // The omen speaks for the first clouded vision, or else for any beat.
    const omenBeat = cl.length ? Math.min(...cl) : rng.int(0, BEATS - 1);
    const omen = { theme: beats[omenBeat].theme, beat: omenBeat };

    const near = spec.near ?? 1;
    const hand = dealHand(rng, beats, near);
    return { beats, visions, omen, concern, hand, placed: [null, null, null], near };
}

function dealHand(rng, beats, near) {
    const used = new Set();
    const hand = [];
    for (const b of beats) {
        const free = CARDS_OF[b.theme].filter((c) => !used.has(c));
        const c = rng.pick(free);
        used.add(c);
        hand.push({ c, r: b.tone === 'bane' });
    }
    // False leads: the right matter lying the wrong way up.
    const order = shuffle(rng, [0, 1, 2]);
    let made = 0;
    for (const bi of order) {
        if (made >= near) break;
        const free = CARDS_OF[beats[bi].theme].filter((c) => !used.has(c));
        if (!free.length) continue;
        const c = rng.pick(free);
        used.add(c);
        hand.push({ c, r: beats[bi].tone !== 'bane' });
        made++;
    }
    while (hand.length < HAND) {
        const c = rng.int(0, CARDS.length - 1);
        if (used.has(c)) continue;
        used.add(c);
        hand.push({ c, r: rng() < 0.5 });
    }
    return shuffle(rng, hand);
}

/** Does this card answer this beat, and the right way up? 2 = yes, 1 = right matter wrong tone, 0 = no. */
export function cardPoints(beat, card, rev) {
    if (!CARDS[card].themes.includes(beat.theme)) return 0;
    return rev === (beat.tone === 'bane') ? 2 : 1;
}

export const starsFor = (total) => (total >= 5 ? 3 : total >= 3 ? 2 : total >= 1 ? 1 : 0);

/** Score a laid spread: placed[i] is an index into the hand. */
export function scoreReading(reading) {
    const per = reading.beats.map((beat, i) => {
        const h = reading.hand[reading.placed[i]];
        const pts = h ? cardPoints(beat, h.c, h.r) : 0;
        return { pts, card: h ? h.c : -1, rev: h ? h.r : false };
    });
    const total = per.reduce((a, p) => a + p.pts, 0);
    return { per, total, stars: starsFor(total) };
}

/** The meanings the universe will have taught you once the truth is known. */
export function lessons(reading) {
    const out = [];
    reading.visions.forEach((v, i) => {
        out.push({ kind: 'sym', id: v.sym }, { kind: 'col', id: v.col });
    });
    out.push({ kind: 'omen', id: reading.omen.theme });
    return out;
}
