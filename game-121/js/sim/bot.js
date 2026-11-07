// An auto-player. It plays through the same commands the UI sends, so the tests, the balance table and the
// title screen's attract mode all exercise the real rules. Pure, like the rest of js/sim.
//
// mode 'perfect' knows the whole lexicon (what a mastered seer would do); 'learner' only uses what the Codex
// has taught it and reasons about clouded visions the way the journal says to (omen, then the client's worry,
// then Focus); 'random' lays any three cards.

import { SYMBOLS, COLOURS, CARDS } from './data/lexicon.js';

export function makeBot({ mode = 'perfect', romance = 'none', seed = 1, studyEvery = 0 } = {}) {
    let a = (seed * 2654435761) >>> 0;
    const rnd = () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < 4; i++) rnd();                       // a weak first number picks the same choice for every seed
    return { mode, romance, rnd, studyEvery, evenings: 0 };
}

/** What the bot believes each beat is: { theme|null, tone|null }. */
export function guess(G, bot) {
    const R = G.reading;
    const out = R.beats.map((b, i) => {
        if (bot.mode === 'perfect') return { theme: b.theme, tone: b.tone };
        const v = R.visions[i];
        const theme = !v.clouded && G.know.sym[v.sym] ? SYMBOLS[v.sym].theme : null;
        const tone = G.know.col[v.col] ? COLOURS[v.col].tone : null;
        return { theme, tone };
    });
    if (bot.mode === 'learner') {
        // The omen speaks for the first clouded vision if it is understood; the client's worry for the other.
        const unknown = out.map((g, i) => (g.theme ? -1 : i)).filter((i) => i >= 0 && R.visions[i].clouded);
        if (unknown.length && G.know.omen[R.omen.theme] && unknown.includes(R.omen.beat)) {
            out[R.omen.beat].theme = R.omen.theme;
            unknown.splice(unknown.indexOf(R.omen.beat), 1);
        }
        if (unknown.length && !out.some((g) => g.theme === R.concern)) out[unknown[0]].theme = R.concern;
    }
    return out;
}

function bestSpread(G, bot) {
    const R = G.reading;
    const g = guess(G, bot);
    let best = null, bestScore = -1;
    const n = R.hand.length;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) {
        if (a === b || b === c || a === c) continue;
        const pick = [a, b, c];
        let sc = 0;
        for (let i = 0; i < 3; i++) {
            const h = R.hand[pick[i]], gi = g[i];
            if (bot.mode === 'random') { sc += bot.rnd() * 0.1; continue; }
            if (!gi.theme) { sc += 0.3 + bot.rnd() * 0.01; continue; }               // a coin-flip beat
            const themeOk = CARDS[h.c].themes.includes(gi.theme);
            if (!themeOk) continue;
            const toneOk = gi.tone ? h.r === (gi.tone === 'bane') : bot.rnd() < 0.5;
            sc += toneOk ? 2 : 1;
        }
        sc += bot.rnd() * 0.001;
        if (sc > bestScore) { bestScore = sc; best = pick; }
    }
    return best;
}

/** How many visions the bot cannot place without Focus (learner only). */
function unresolved(G, bot) {
    if (bot.mode !== 'learner') return [];
    const R = G.reading, g = guess(G, bot);
    return R.visions.map((v, i) => (v.clouded && !g[i].theme ? i : -1)).filter((i) => i >= 0);
}

function pickChoice(d, bot, key) {
    if (bot.mode === 'random') return Math.floor(bot.rnd() * d.choices.length);
    let bi = 0, bv = -9;
    d.choices.forEach((c, i) => { const v = (c[key] ?? 0) + bot.rnd() * 0.01; if (v > bv) { bv = v; bi = i; } });
    return bi;
}

/** The next command, or null when the game is over. */
export function botCmd(G, bot) {
    if (G.phase === 'ending') return null;
    const d = G.dlg;
    if (d) {
        if (d.i < d.lines.length - 1 || !d.choices) return { t: 'next' };
        const key = d.ctx?.kind === 'prince' ? 'tr' : 'a';
        return { t: 'choose', i: pickChoice(d, bot, key) };
    }
    switch (G.phase) {
        case 'dayintro': case 'arrive': case 'flip': case 'leave': return { t: 'next' };
        case 'ready': return { t: 'gaze' };
        case 'ball': {
            if (!G.ball.done) return { t: 'next' };
            for (const i of unresolved(G, bot)) if (G.focus > 0) return { t: 'focus', i };
            return { t: 'draw' };
        }
        case 'deal': {
            const R = G.reading;
            if (!R.placed.includes(null)) return { t: 'lay' };
            if (bot.mode === 'learner') for (const i of unresolved(G, bot)) if (G.focus > 0) return { t: 'focus', i };
            const pick = bestSpread(G, bot);
            // lay the chosen card in each place, taking back whatever is in the way
            for (let s = 0; s < 3; s++) {
                if (R.placed[s] === pick[s]) continue;
                if (R.placed[s] !== null) return { t: 'unplace', s };
                const other = R.placed.indexOf(pick[s]);
                if (other >= 0) return { t: 'unplace', s: other };
                return { t: 'place', h: pick[s], s };
            }
            return { t: 'lay' };
        }
        case 'style':
            return { t: 'say', style: bot.mode === 'perfect' ? G.reading.likes : bot.mode === 'learner' ? G.reading.likes : 'truth' };
        case 'dusk': {
            bot.evenings++;
            const opts = G.evening.map((o) => o.id);
            if (bot.mode === 'random') return { t: 'evening', id: opts[Math.floor(bot.rnd() * opts.length)] };
            const want = bot.romance;
            if (bot.studyEvery && bot.evenings % bot.studyEvery === 0) return { t: 'evening', id: 'study' };
            if (want !== 'none' && opts.includes(want) && G.stage[want] < 5) return { t: 'evening', id: want };
            return { t: 'evening', id: 'study' };
        }
        case 'festival': {
            const opts = G.evening.map((o) => o.id);
            if (bot.romance !== 'none' && opts.includes(bot.romance)) return { t: 'evening', id: bot.romance };
            return { t: 'evening', id: 'alone' };
        }
        default: return null;
    }
}
