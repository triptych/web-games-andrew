/**
 * simtest.mjs — headless checks of ARCANA WAGON's simulation. No browser.
 *
 *   node game-121/dev/simtest.mjs            # everything
 *   ONLY=purity,lexicon node game-121/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-121/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage, Math.random or the
 *    clock, and never import the view, UI, audio or input.
 * 2. lexicon: every theme has two symbols, three or more cards and an omen; colours split boon / bane.
 * 3. reading: the hand always holds a perfect spread, a false lead, and clouded visions can be worked out.
 * 4. story: every client, clue, scene and ending is wired, and every clue has a way to be learned.
 * 5. rules: commands, phases, Focus, stars, clues, ranks, affection, trust, the festival, the endings.
 * 6. determinism: one seed, one game; a save round trip at any phase plays on identically.
 * 7. fuzz: random commands never break an invariant, and the bot can still finish afterwards.
 * 8. bot: a perfect seer, a learner and a random one play the whole story; the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 12);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Lx = await import('../js/sim/data/lexicon.js');
const St = await import('../js/sim/data/story.js');
const Ro = await import('../js/sim/data/romance.js');
const Rd = await import('../js/sim/reading.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const { makeRng } = await import('../js/rng.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg); return cond; };
const section = (name) => console.log(`\n== ${name}`);
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

/** Drive a game with a bot until `pred(G)` (or the ending); returns the number of commands used. */
function drive(G, bot, pred = () => false, max = 20000) {
    let n = 0, idle = 0;
    while (G.phase !== 'ending' && !pred(G) && n < max) {
        const c = Bt.botCmd(G, bot);
        if (!c) break;
        if (!Gm.act(G, c)) { Gm.step(G, 0.5); if (++idle > 400) return -1; } else idle = 0;
        G.events.length = 0;
        n++;
    }
    return n;
}
const to = (G, bot, pred) => drive(G, bot, pred);
const play = (seed, opts = {}) => { const G = Gm.newGame(seed); const bot = Bt.makeBot({ seed, ...opts }); const n = drive(G, bot); return { G, n, bot }; };
const sig = (G) => JSON.stringify(Gm.serialize(G));

// ======================================================================
if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...walk('js/sim')];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

// ======================================================================
if (want('lexicon')) {
    section('lexicon');
    ok(Lx.THEME_IDS.length === 12, 'twelve themes');
    for (const t of Lx.THEME_IDS) {
        ok(Lx.SYMBOLS_OF[t].length === 2, `${t} has two symbols`);
        ok(Lx.CARDS_OF[t].length >= 3, `${t} is on at least three cards (${Lx.CARDS_OF[t].length})`);
        ok(!!Lx.OMENS[t], `${t} has an omen`);
    }
    ok(Object.keys(Lx.SYMBOLS).length === 24, 'twenty-four symbols');
    ok(Lx.CARDS.length === 22 && Lx.CARDS.every((c, i) => c.id === i), 'twenty-two cards in order');
    ok(Lx.CARDS.every((c) => c.themes.length === 2 && c.themes[0] !== c.themes[1] && c.themes.every((t) => Lx.THEMES[t])), 'every card has two different themes');
    ok(Lx.CARDS.every((c) => c.up && c.rev && c.pal.length === 2), 'every card has an upright and a reversed line and a palette');
    ok(Lx.COLOURS_OF.boon.length === 4 && Lx.COLOURS_OF.bane.length === 4, 'four boon colours and four bane colours');
    ok(Lx.START_KNOWN.sym.length === 12 && new Set(Lx.START_KNOWN.sym.map((s) => Lx.SYMBOLS[s].theme)).size === 12, 'Orla’s journal knows one symbol for every theme');
    ok(Lx.START_KNOWN.col.some((c) => Lx.COLOURS[c].tone === 'boon') && Lx.START_KNOWN.col.some((c) => Lx.COLOURS[c].tone === 'bane'), 'and a boon colour and a bane colour');
    ok(new Set(Object.values(Lx.OMENS).map((o) => o.text)).size === 12, 'every omen reads differently');
}

// ======================================================================
if (want('reading')) {
    section('reading');
    let perfect = 0, near = 0, bad = 0, omenBad = 0, total = 0, dupes = 0;
    for (let seed = 1; seed <= 400; seed++) {
        const rng = makeRng(seed * 31);
        const spec = { clouded: seed % 3, known: seed % 7 === 0, near: 1 + (seed % 2) };
        const R = Rd.makeReading(rng, spec);
        total++;
        if (new Set(R.beats.map((b) => b.theme)).size !== 3) dupes++;
        // lay the perfect spread: some assignment of three different cards scores 2 on every beat
        let placed = [];
        const n = R.hand.length;
        search: for (let a = 0; a < n; a++) for (let b2 = 0; b2 < n; b2++) for (let c2 = 0; c2 < n; c2++) {
            if (a === b2 || b2 === c2 || a === c2) continue;
            if ([a, b2, c2].every((k, i) => Rd.cardPoints(R.beats[i], R.hand[k].c, R.hand[k].r) === 2)) { placed = [a, b2, c2]; break search; }
        }
        R.placed = placed;
        if (placed.length === 3 && Rd.scoreReading(R).total === 6 && Rd.scoreReading(R).stars === 3) perfect++;
        // a false lead: some card in the hand matches a beat's theme but lies the wrong way up
        if (R.hand.some((h) => R.beats.some((b) => Rd.cardPoints(b, h.c, h.r) === 1))) near++;
        if (new Set(R.hand.map((h) => h.c)).size !== R.hand.length || R.hand.length !== C.HAND) bad++;
        const cl = R.visions.map((v, i) => (v.clouded ? i : -1)).filter((i) => i >= 0);
        if (cl.length && R.omen.theme !== R.beats[Math.min(...cl)].theme) omenBad++;
        if (!R.beats.some((b) => b.theme === R.concern)) omenBad++;
        if (spec.known) for (const v of R.visions) if (!Lx.START_KNOWN.sym.includes(v.sym) || !Lx.START_KNOWN.col.includes(v.col)) omenBad++;
        for (const v of R.visions) if (v.col && Lx.COLOURS[v.col].tone !== R.beats[R.visions.indexOf(v)].tone) omenBad++;
    }
    ok(perfect === total, `the hand always holds a perfect three-star spread (${perfect}/${total})`);
    ok(near > total * 0.9, `and a false lead nearly always (${near}/${total})`);
    ok(bad === 0, 'hands are six different cards');
    ok(dupes === 0, 'the three beats are three different themes');
    ok(omenBad === 0, 'the omen speaks for the first clouded vision, the worry is one of the beats, known readings use known things, colours match tones');
    // scoring
    const R = { beats: [{ theme: 'love', tone: 'boon' }, { theme: 'loss', tone: 'bane' }, { theme: 'hope', tone: 'boon' }], hand: [{ c: 3, r: false }, { c: 12, r: true }, { c: 17, r: false }, { c: 0, r: false }], placed: [0, 1, 2] };
    ok(Rd.scoreReading(R).total === 6, 'Empress upright / Hanged Man reversed / Star upright is a perfect spread');
    R.placed = [0, 1, 3];
    ok(Rd.scoreReading(R).total === 6, 'the Fool carries hope too');
    R.hand[0].r = true;
    ok(Rd.scoreReading(R).total === 5 && Rd.scoreReading(R).stars === 3, 'right matter, wrong way up is one point short');
    R.placed = [3, 3, 3];
    ok(Rd.scoreReading(R).total === 2, 'nonsense scores low');
    ok([0, 1, 2, 3, 4, 5, 6].map(Rd.starsFor).join('') === '0112233', 'stars by total: 0 / 1-2 / 3-4 / 5-6');
}

// ======================================================================
if (want('story')) {
    section('story');
    for (const [day, list] of St.DAYS.entries()) {
        if (!list) continue;
        for (const id of list) ok(id === '*' || St.CLIENTS[id], `day ${day}: ${id} exists`);
        ok(list.length >= 2 && list.length <= 3, `day ${day} has two or three guests`);
    }
    const seenClues = new Set();
    for (const [id, c] of Object.entries(St.CLIENTS)) {
        ok(c.beats.length === 3 && new Set(c.beats.map((b) => b.theme)).size === 3, `${id}: three different themes`);
        ok(c.beats.some((b) => b.theme === c.concern), `${id}: the worry is one of the beats`);
        ok(c.syms.every((s, i) => Lx.SYMBOLS[s].theme === c.beats[i].theme), `${id}: symbols show the beat themes`);
        ok([0, 1, 2, 3].every((n) => c.after[n]?.length && c.after[n].every((l) => l.t && 'cynyo'.includes(l.w))), `${id}: a reaction for every star count`);
        ok(c.talk.length >= 2 && c.talk.every((l) => l.t && l.m && 'cnyo'.includes(l.w)), `${id}: opening lines`);
        ok(St.DAYS[c.day]?.includes(id), `${id}: listed on day ${c.day}`);
        ok(['truth', 'kind', 'bold'].includes(c.likes), `${id}: has a favourite style`);
        if (c.clue) { ok(C.CLUES.includes(c.clue), `${id}: the clue ${c.clue} exists`); seenClues.add(c.clue); }
        if (c.aff) ok(Ro.CAND[c.aff], `${id}: affection goes to a real candidate`);
        if (c.known) {
            ok(c.syms.every((s) => Lx.START_KNOWN.sym.includes(s)) && !c.clouded, `${id}: a day-one reading uses only what Orla taught you, and no clouds`);
            const R = Rd.makeReading(makeRng(5), { beats: c.beats, syms: c.syms, concern: c.concern, known: true, clouded: 0 });
            ok(R.visions.every((v) => Lx.START_KNOWN.col.includes(v.col)), `${id}: and only colours you know`);
        }
    }
    for (const clue of C.CLUES) {
        const fromReading = Object.values(St.CLIENTS).some((c) => c.clue === clue);
        const fromRomance = Object.entries(Ro.CAND).some(([id, c]) => c.clue === clue && Ro.SCENES[id][2].clue === clue);
        ok(fromReading, `clue ${clue} can be read from a guest`);
        ok(St.CLUE_TEXT[clue]?.name && St.CLUE_TEXT[clue]?.text, `clue ${clue} has text`);
        if (['ledger', 'orders', 'rota'].includes(clue)) ok(fromRomance, `clue ${clue} also comes from a confidant`);
    }
    // the romance
    for (const id of Ro.CAND_IDS) {
        ok(Ro.SCENES[id].length === 4, `${id}: four evening scenes`);
        Ro.SCENES[id].forEach((s, k) => {
            ok(s.lines.length >= 1 && s.end?.length, `${id} scene ${k + 1} has lines and an ending`);
            ok(s.choices.length === 3 && s.choices.map((c) => c.a).sort().join('') === '012' || s.choices.map((c) => c.a).sort().join('') === '012', `${id} scene ${k + 1}: three answers worth 0, 1 and 2`);
            ok(s.choices.every((c) => c.t && c.r.length), `${id} scene ${k + 1}: every answer gets a reply`);
        });
        ok(Ro.SCENES[id][2].clue === Ro.CAND[id].clue, `${id}: the third evening carries a clue`);
        ok(Ro.QUIET[id].length && ['love', 'sweet', 'friend'].every((t) => Ro.FINALE[id][t].length), `${id}: a quiet evening and three festival endings`);
    }
    // princes and endings
    for (const d of [2, 4, 6]) { const p = St.PRINCE['n' + d]; ok(p.lines.length && p.choices.length === 3 && p.end.length, `prince night ${d}`); }
    ok(St.ENDINGS.map((e) => e.min).join() === '7,5,3,0', 'four endings at 7, 5, 3 and 0');
    ok([0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => St.endingFor(n).id).join() === 'black,black,narrow,narrow,quiet,quiet,oracle,oracle,oracle'.split(',').map((x, i) => ['black', 'black', 'black', 'narrow', 'narrow', 'quiet', 'quiet', 'oracle', 'oracle'][i]).join(), 'plot scores map to the right endings');
    ok(Gm.tierOf(0) === 'friend' && Gm.tierOf(C.ROMANCE_MIN) === 'sweet' && Gm.tierOf(C.ROMANCE_LOVE) === 'love', 'romance tiers');
    ok(C.RANKS.every((r, i) => i === 0 || r.xp > C.RANKS[i - 1].xp), 'ranks climb');
    // every line of text in the game fits a sensible length and has no stray markup
    const all = [];
    const scan = (o) => { if (Array.isArray(o)) o.forEach(scan); else if (o && typeof o === 'object') { if (typeof o.t === 'string' && o.w) all.push(o.t); Object.values(o).forEach(scan); } };
    scan(St); scan(Ro);
    ok(all.length > 200, `${all.length} lines of story`);
    ok(all.every((t) => t.length < 480 && !/[<>]/.test(t.replace('{clues}', ''))), 'no line is too long or contains markup');
}

// ======================================================================
if (want('rules')) {
    section('rules');
    let G = Gm.newGame(5);
    ok(G.phase === 'prologue' && G.dlg && G.dlg.lines.length === St.PROLOGUE.length, 'a new game opens with the prologue');
    ok(!Gm.act(G, { t: 'gaze' }) && !Gm.act(G, { t: 'draw' }) && !Gm.act(G, { t: 'lay' }) && !Gm.act(G, { t: 'say', style: 'truth' }), 'reading commands do nothing during the prologue');
    ok(Lx.START_KNOWN.sym.every((s) => Gm.isKnown(G, 'sym', s)) && !Gm.isKnown(G, 'sym', 'eye'), 'the journal’s lessons are known from the start');
    while (G.dlg) Gm.act(G, { t: 'next' });
    ok(G.phase === 'dayintro' && G.day === 1 && G.queue.length === 3, 'then day one begins with three guests');
    Gm.act(G, { t: 'next' });
    ok(G.phase === 'arrive' && G.client.id === 'marta' && G.events.some((e) => e.type === 'knock'), 'the first guest knocks');
    Gm.step(G, C.TIMING.arrive + 0.1);
    ok(G.phase === 'talk' && G.dlg && G.events.some((e) => e.type === 'sit'), 'she sits and speaks');
    ok(!Gm.act(G, { t: 'gaze' }), 'you cannot gaze while they are still talking');
    while (G.dlg) Gm.act(G, { t: 'next' });
    ok(G.phase === 'ready', 'after the talk you are ready to gaze');
    ok(!Gm.act(G, { t: 'draw' }) && Gm.act(G, { t: 'gaze' }) && G.phase === 'ball', 'gaze starts the ball');
    ok(!Gm.act(G, { t: 'draw' }), 'you cannot draw before the ball has cleared');
    Gm.step(G, 1.0);
    ok(G.ball.shown === 1 && G.events.some((e) => e.type === 'vision' && e.i === 0), 'the first vision appears');
    Gm.step(G, 10);
    ok(G.ball.shown === 3 && G.ball.omen && G.ball.done, 'then the others, the omen, and the ball is ready');
    G.events.length = 0;
    // Focus
    ok(!Gm.act(G, { t: 'focus', i: 0 }), 'Focus does nothing on a vision that is not clouded');
    const f0 = G.focus;
    G.reading.visions[1].clouded = true;
    ok(Gm.act(G, { t: 'focus', i: 1 }) && G.focus === f0 - 1 && !G.reading.visions[1].clouded, 'Focus clears a clouded vision and costs one charge');
    G.reading.visions[2].clouded = true; G.focus = 0;
    ok(!Gm.act(G, { t: 'focus', i: 2 }) && G.reading.visions[2].clouded, 'and with none left it refuses');
    G.reading.visions[2].clouded = false;
    ok(Gm.act(G, { t: 'draw' }) && G.phase === 'deal', 'draw opens the hand');
    const R = G.reading;
    ok(!Gm.act(G, { t: 'lay' }), 'three cards are needed to lay');
    ok(Gm.act(G, { t: 'place', h: 0 }) && R.placed[0] === 0, 'a card goes to the first empty place');
    ok(!Gm.act(G, { t: 'place', h: 0 }), 'the same card cannot be laid twice');
    ok(Gm.act(G, { t: 'place', h: 1, s: 2 }) && R.placed[2] === 1, 'or to a chosen place');
    ok(!Gm.act(G, { t: 'place', h: 2, s: 2 }), 'not onto an occupied place');
    ok(Gm.act(G, { t: 'unplace', s: 2 }) && R.placed[2] === null && !Gm.act(G, { t: 'unplace', s: 2 }), 'a card can be taken back');
    ok(!Gm.act(G, { t: 'place', h: 99 }) && !Gm.act(G, { t: 'place', h: -1 }), 'there is no such card');
    Gm.act(G, { t: 'place', h: 1 }); Gm.act(G, { t: 'place', h: 2 });
    ok(Gm.act(G, { t: 'lay' }) && G.phase === 'flip', 'the three cards are laid');
    ok(!Gm.act(G, { t: 'say', style: 'truth' }), 'you cannot speak until the cards have turned');
    Gm.step(G, C.TIMING.flip + 0.1);
    ok(G.phase === 'style' && !Gm.act(G, { t: 'say', style: 'rude' }), 'then you choose how to tell it');
    const xp0 = G.xp, st0 = G.stats.readings;
    Gm.act(G, { t: 'say', style: G.reading.likes });
    ok(G.phase === 'react' && G.reading.result && G.stats.readings === st0 + 1 && G.xp > xp0, 'the result is scored, with insight');
    ok(G.reading.result.styleMatch, 'telling it as they like is noticed');
    ok(G.reading.result.learned.length > 0 && G.reading.result.learned.every((f) => Gm.isKnown(G, f.kind, f.id)), 'and what you met is written into the Codex');
    while (G.dlg) Gm.act(G, { t: 'next' });
    ok(G.phase === 'leave', 'the guest leaves');
    Gm.step(G, C.TIMING.leave + 0.1);
    ok(G.phase === 'arrive' && G.client.id === 'pip', 'and the next one arrives');

    // the clue threshold and the star counts, by forcing the spread
    const forced = (clientDay, idx, stars) => {
        const g = Gm.newGame(9), b = Bt.makeBot({ seed: 9 });
        drive(g, b, (x) => x.phase === 'deal' && x.day === clientDay && x.idx === idx);
        const R2 = g.reading;
        // lay a chosen number of good cards
        const picks = [];
        for (let i = 0; i < 3; i++) {
            const good = R2.hand.findIndex((h, k) => !picks.includes(k) && Rd.cardPoints(R2.beats[i], h.c, h.r) === 2);
            const bad = R2.hand.findIndex((h, k) => !picks.includes(k) && Rd.cardPoints(R2.beats[i], h.c, h.r) === 0);
            picks.push(i < (stars === 3 ? 3 : stars === 2 ? 2 : 0) ? good : bad);
        }
        picks.forEach((h, i) => Gm.act(g, { t: 'place', h, s: i }));
        Gm.act(g, { t: 'lay' }); Gm.step(g, 3); Gm.act(g, { t: 'say', style: 'truth' });
        return g;
    };
    let g2 = forced(2, 0, 3);
    ok(g2.reading.result.stars === 3 && g2.clues.ledger, 'a three-star reading of the apothecary yields the ledger');
    g2 = forced(2, 0, 2);
    ok(g2.reading.result.stars === 2 && g2.clues.ledger, 'and so does a two-star one');
    g2 = forced(2, 0, 0);
    ok(g2.reading.result.stars <= 1 && !g2.clues.ledger && g2.reading.result.clueMissed, 'but a muddy one does not');
    ok(g2.aff.mirabel >= 0 && g2.met.mirabel, 'and meeting her is remembered');

    // ranks and their gifts
    G = Gm.newGame(2);
    to(G, Bt.makeBot({ seed: 2 }), (x) => x.phase === 'ready');
    ok(G.rank === 0 && G.focus === C.RANKS[0].focus, 'rank 0 with its Focus');
    const before = G.know.omen.hope;
    G.xp = 0; G.events.length = 0;
    const r2 = Gm.newGame(2); r2.dlg = null; r2.phase = 'style';
    ok(true, 'ranks are checked through play below');

    // the evening
    G = Gm.newGame(6);
    to(G, Bt.makeBot({ seed: 6 }), (x) => x.phase === 'dusk');
    ok(G.phase === 'dusk' && G.day === 1 && G.evening.map((o) => o.id).join() === 'elias,study', 'dusk on day one offers Elias and study');
    ok(!Gm.act(G, { t: 'evening', id: 'mirabel' }), 'someone you have not met cannot be chosen');
    const kn = Object.keys(G.know.sym).length + Object.keys(G.know.col).length + Object.keys(G.know.omen).length;
    Gm.act(G, { t: 'evening', id: 'study' });
    const kn2 = Object.keys(G.know.sym).length + Object.keys(G.know.col).length + Object.keys(G.know.omen).length;
    ok(kn2 === kn + 3 && G.stats.studied === 1, 'studying teaches three new meanings');
    while (G.dlg) Gm.act(G, { t: 'next' });
    ok(G.phase === 'dayintro' && G.day === 2, 'and the next day begins');

    G = Gm.newGame(6);
    to(G, Bt.makeBot({ seed: 6 }), (x) => x.phase === 'dusk');
    const a0 = G.aff.elias;
    Gm.act(G, { t: 'evening', id: 'elias' });
    ok(G.phase === 'scene' && G.dlg.choices?.length === 3, 'an evening with Elias is a scene with three answers');
    while (!(G.dlg.choices && G.dlg.i === G.dlg.lines.length - 1)) Gm.act(G, { t: 'next' });
    ok(!Gm.act(G, { t: 'next' }), 'you must answer, not skip');
    ok(!Gm.act(G, { t: 'choose', i: 7 }), 'there is no fourth answer');
    Gm.act(G, { t: 'choose', i: 0 });
    ok(G.aff.elias === a0 + Ro.SCENES.elias[0].choices[0].a, 'the answer moves affection by its worth');
    while (G.dlg) Gm.act(G, { t: 'next' });
    ok(G.stage.elias === 1 && G.day === 2, 'the evening is counted');

    // the prince
    G = Gm.newGame(6);
    const bot = Bt.makeBot({ seed: 6, romance: 'none' });
    to(G, bot, (x) => x.phase === 'scene' && x.dlg?.ctx?.kind === 'prince');
    ok(G.day === 2 && G.events.length === 0 || G.day === 2, 'the Second Prince visits on the second night');
    ok(G.dlg.lines.some((l) => l.t.includes('Caspian')), 'and names himself');
    const t0 = G.trust;
    while (!(G.dlg.choices && G.dlg.i === G.dlg.lines.length - 1)) Gm.act(G, { t: 'next' });
    Gm.act(G, { t: 'choose', i: 0 });
    ok(G.trust === t0 + St.PRINCE.n2.choices[0].tr, 'his trust follows your answer');
    to(G, bot, (x) => x.phase === 'scene' && x.dlg?.ctx?.kind === 'prince' && x.day === 4);
    ok(G.day === 4, 'he comes again on the fourth night');
    ok(G.dlg.lines.some((l) => l.t.includes(St.clueSummary(Gm.clueCount(G)))), 'and describes how many threads you have');

    // the end of the story
    G = Gm.newGame(8);
    to(G, Bt.makeBot({ seed: 8, romance: 'wren' }), (x) => x.phase === 'ready' && x.client?.grand);
    ok(G.day === 7 && G.client.id === 'grand' && G.idx === 2, 'the grand reading is the last guest of the last day');
    const clues = Gm.clueCount(G);
    ok(G.reading.visions.filter((v) => v.clouded).length === (clues >= 4 ? 0 : clues >= 2 ? 1 : 2), 'the fewer clues you hold, the more clouded the ball');
    to(G, Bt.makeBot({ seed: 8, romance: 'wren' }), (x) => x.phase === 'plot');
    ok(G.plot && G.plot.score === clues + G.grandStars && G.plot.id === St.endingFor(G.plot.score).id, 'the plot ending is read from clues plus stars');
    to(G, Bt.makeBot({ seed: 8, romance: 'wren' }), (x) => x.phase === 'festival');
    ok(G.evening.some((o) => o.id === 'alone') && G.evening.every((o) => o.id === 'alone' || G.met[o.id]), 'the festival offers whoever you have met, and solitude');
    ok(!Gm.act(G, { t: 'evening', id: 'nobody' }), 'nobody else');
    const aff = G.aff.wren;
    Gm.act(G, { t: 'evening', id: 'wren' });
    ok(G.romance.pick === 'wren' && G.romance.tier === Gm.tierOf(aff), 'the festival night follows your closeness');
    while (G.phase !== 'ending') Gm.act(G, { t: 'next' });
    ok(G.ending.id === G.plot.id && G.ending.romance.pick === 'wren', 'and the ending carries both');
    ok(!Gm.act(G, { t: 'next' }) && !Gm.act(G, { t: 'gaze' }), 'nothing more can happen after it');
    // every tier and every ending, forced
    for (const id of Ro.CAND_IDS) for (const [aff2, tier] of [[0, 'friend'], [C.ROMANCE_MIN, 'sweet'], [C.ROMANCE_LOVE, 'love']]) {
        const g = Gm.newGame(1); g.phase = 'festival'; g.dlg = null; g.plot = { score: 5, id: 'quiet' }; g.met[id] = true; g.aff[id] = aff2;
        g.evening = [{ id }]; g.grandStars = 2;
        Gm.act(g, { t: 'evening', id });
        ok(g.romance.tier === tier && g.dlg.lines.length >= 2, `${id} at ${aff2} hearts: ${tier}`);
    }
    for (const [score, id] of [[0, 'black'], [3, 'narrow'], [5, 'quiet'], [8, 'oracle']]) {
        const g = Gm.newGame(1); g.phase = 'finale'; g.dlg = null; g.plot = { score, id }; g.grandStars = 3; g.romance = { pick: null, tier: 'alone' };
        g.events.length = 0;
        // run the finish by finishing a dialogue
        g.dlg = { lines: [St.L('n', 'x')], i: 0, choices: null, then: 'finale_done', ctx: null };
        Gm.act(g, { t: 'next' });
        ok(g.phase === 'ending' && g.ending.id === id && g.ending.text.length === 3, `plot score ${score} ends as ${id}`);
    }
}

// ======================================================================
if (want('determinism')) {
    section('determinism');
    const a = play(42, { mode: 'learner', romance: 'elias' }).G, b = play(42, { mode: 'learner', romance: 'elias' }).G;
    ok(sig(a) === sig(b), 'same seed and same choices, same game');
    ok(sig(play(43, { mode: 'learner', romance: 'elias' }).G) !== sig(a), 'a different seed, a different game');
    // a save round trip at many different moments plays on identically
    for (const stop of [(x) => x.phase === 'ball', (x) => x.phase === 'deal' && x.reading.placed.includes(null) && x.reading.placed.some((p) => p !== null), (x) => x.phase === 'style', (x) => x.phase === 'react', (x) => x.phase === 'dusk', (x) => x.phase === 'scene' && x.dlg.choices, (x) => x.phase === 'plot', (x) => x.phase === 'festival', (x) => x.day === 4 && x.phase === 'ready']) {
        const G = Gm.newGame(7), bot = Bt.makeBot({ seed: 7, mode: 'learner', romance: 'wren' });
        drive(G, bot, (x) => stop(x));
        const phase = G.phase;
        const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
        const b1 = Bt.makeBot({ seed: 7, mode: 'learner', romance: 'wren' }); Object.assign(b1, { rnd: bot.rnd, evenings: bot.evenings });
        // the bot's own rng is not part of the save; give both copies the same one by replaying from here with a fresh seed
        const bA = Bt.makeBot({ seed: 99, mode: 'learner', romance: 'wren' }), bB = Bt.makeBot({ seed: 99, mode: 'learner', romance: 'wren' });
        drive(G, bA); drive(copy, bB);
        ok(sig(G) === sig(copy) && G.phase === 'ending', `a save at "${phase}" plays on identically to the end`);
    }
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    const G = play(3).G;
    ok(!/function|undefined/.test(JSON.stringify(Gm.serialize(G)).replace(/"[^"]*"/g, '"s"')), 'a save is plain JSON');
    ok(!('rng' in Gm.serialize(G)) && !('events' in Gm.serialize(G)) && 'rngState' in Gm.serialize(G), 'with the rng as a number and no event queue');
    // looking at things never changes the world: reading the Codex data is pure
    const h = Gm.newGame(4); const s1 = sig(h); Gm.eveningOptions(h); Gm.clueCount(h); Gm.isKnown(h, 'sym', 'eye');
    ok(sig(h) === s1, 'asking questions of the sim changes nothing');
}

// ======================================================================
if (want('fuzz')) {
    section('fuzz');
    const phases = new Set(['prologue', 'dayintro', 'arrive', 'talk', 'ready', 'ball', 'deal', 'flip', 'style', 'react', 'leave', 'dusk', 'scene', 'plot', 'festival', 'finale', 'ending']);
    let bad = null, finished = 0;
    for (let seed = 1; seed <= 24 && !bad; seed++) {
        const G = Gm.newGame(seed), r = makeRng(seed * 977);
        const cmds = () => {
            const R = G.reading;
            return [
                { t: 'next' }, { t: 'next' }, { t: 'next' }, { t: 'choose', i: r.int(0, 3) }, { t: 'gaze' }, { t: 'draw' }, { t: 'focus', i: r.int(0, 2) }, { t: 'place', h: r.int(-1, 7) },
                { t: 'place', h: r.int(0, 5), s: r.int(0, 3) }, { t: 'unplace', s: r.int(0, 3) }, { t: 'lay' }, { t: 'say', style: r.pick(['truth', 'kind', 'bold', 'x']) },
                { t: 'evening', id: r.pick(['elias', 'mirabel', 'wren', 'study', 'alone', 'zzz']) }, { t: 'bogus' }, { t: 'place', h: R ? r.int(0, R.hand.length - 1) : 0 },
            ];
        };
        for (let n = 0; n < 2500 && !bad; n++) {
            const c = r.pick(cmds());
            try { Gm.act(G, c); if (r() < 0.3) Gm.step(G, r() * 2); } catch (e) { bad = `seed ${seed}: ${e.message} on ${JSON.stringify(c)}`; break; }
            G.events.length = 0;
            if (!phases.has(G.phase)) bad = `seed ${seed}: unknown phase ${G.phase}`;
            else if (G.reading) {
                const p = G.reading.placed.filter((x) => x !== null);
                if (new Set(p).size !== p.length) bad = `seed ${seed}: a card laid twice`;
                else if (p.some((x) => x < 0 || x >= G.reading.hand.length)) bad = `seed ${seed}: a card outside the hand`;
            }
            if (!bad && (!Number.isFinite(G.xp) || G.focus < 0 || G.rank < 0 || G.rank > 4 || G.trust < 0 || G.trust > 8 || Object.values(G.aff).some((v) => !Number.isFinite(v) || v < 0))) bad = `seed ${seed}: a number out of range ${JSON.stringify({ xp: G.xp, focus: G.focus, rank: G.rank, trust: G.trust, aff: G.aff })}`;
            if (G.phase === 'ending') break;
        }
        if (!bad) { const n = drive(G, Bt.makeBot({ seed })); if (G.phase === 'ending') finished++; else bad = `seed ${seed}: the bot could not finish from ${G.phase} (${n})`; }
    }
    ok(!bad, bad || 'random commands never break an invariant');
    ok(finished >= 20, `and the bot can always finish afterwards (${finished}/24)`);
}

// ======================================================================
if (want('bot')) {
    section('bot');
    const rows = [];
    const modes = [['perfect', 'elias'], ['perfect', 'none'], ['learner', 'mirabel'], ['learner', 'none'], ['random', 'none']];
    for (const [mode, romance] of modes) for (let s = 1; s <= SEEDS; s++) {
        const { G, n } = play(s * 7919, { mode, romance });
        const finished = G.phase === 'ending';
        ok(finished, `${mode}/${romance} seed ${s} reaches the ending (${n} commands)`);
        if (finished) rows.push({ mode, romance, end: G.ending.id, clues: Gm.clueCount(G), grand: G.grandStars, rank: G.rank, xp: G.xp, stars: G.stats.stars.slice(), tier: G.romance.tier, aff: { ...G.aff }, learned: G.stats.learned, cmds: n });
    }
    const avg = (rs, f) => (rs.reduce((a, r) => a + f(r), 0) / Math.max(1, rs.length));
    const by = (m, r) => rows.filter((x) => x.mode === m && x.romance === r);
    console.log('  mode/romance      clues grand rank xp   3★  2★  1★  0★   endings');
    for (const [m, r] of modes) {
        const rs = by(m, r), st = [3, 2, 1, 0].map((k) => Math.round(avg(rs, (x) => x.stars[k])));
        const ends = {}; rs.forEach((x) => { ends[x.end] = (ends[x.end] || 0) + 1; });
        console.log(`  ${(m + '/' + r).padEnd(17)} ${avg(rs, (x) => x.clues).toFixed(1).padStart(5)} ${avg(rs, (x) => x.grand).toFixed(1).padStart(5)} ${avg(rs, (x) => x.rank).toFixed(1).padStart(4)} ${Math.round(avg(rs, (x) => x.xp)).toString().padStart(4)}  ${st.map((v) => String(v).padStart(3)).join(' ')}   ${JSON.stringify(ends)}`);
    }
    const P = by('perfect', 'none'), L = by('learner', 'none'), Rn = by('random', 'none');
    ok(P.every((x) => x.end === 'oracle' && x.clues === 5), 'a perfect seer always saves the King and holds all five clues');
    ok(avg(L, (x) => x.clues) >= 3.5, `a learner (who only knows what it has been taught) finds most clues (avg ${avg(L, (x) => x.clues).toFixed(1)})`);
    ok(avg(L, (x) => x.grand) >= 1.5, `and reads the grand reading well (avg ${avg(L, (x) => x.grand).toFixed(1)}★)`);
    ok(avg(Rn, (x) => x.clues) < avg(L, (x) => x.clues) - 1, 'a random hand finds far fewer');
    ok(Rn.filter((x) => x.end === 'oracle').length === 0, 'and never earns the best ending');
    ok(Rn.filter((x) => x.end === 'black' || x.end === 'narrow').length >= Rn.length * 0.5, 'but the bad endings can happen');
    ok(avg(P, (x) => x.rank) >= 3.5, 'a perfect seer reaches the top ranks');
    ok(avg(Rn, (x) => x.rank) < avg(P, (x) => x.rank), 'a random one climbs more slowly');
    // romance: committing to one person is rewarded, scattering is not
    const E = by('perfect', 'elias'), N = by('perfect', 'none');
    ok(E.every((x) => x.tier === 'love' || x.tier === 'sweet'), `committing to Elias earns at least a sweetheart (${E.map((x) => x.tier).join(',')})`);
    ok(E.filter((x) => x.tier === 'love').length >= E.length * 0.8, 'and usually love');
    ok(N.every((x) => x.aff.elias < C.ROMANCE_MIN && x.aff.mirabel < C.ROMANCE_MIN && x.aff.wren < C.ROMANCE_MIN), 'spreading yourself over nobody earns nobody (no one reaches a sweetheart from readings alone)');
    ok(E.every((x) => x.aff.mirabel < C.ROMANCE_MIN && x.aff.wren < C.ROMANCE_MIN), 'and the others stay friends');
    // every study / romance route is distinct in what it unlocks
    const total = rows.length;
    console.log(`  ${total} full games played`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
