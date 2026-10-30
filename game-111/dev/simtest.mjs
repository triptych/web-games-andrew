/**
 * simtest.mjs — headless checks of NEON ARCANA's simulation. No browser.
 *
 *   node game-111/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-111/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-111/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. pieces: every shape is connected, starts at the origin and rotates back to itself in four turns.
 * 3. rules: placing, overlap and edges, row and column clears, crosses, scoring and resonance,
 *    sigils, blight cracking and breaking, the deal and its mercy, every power, being stuck,
 *    game over, rekindling an arcanum (powers, sparks, the next omens) and the ending.
 * 4. determinism: the same seed and commands give the same game; a save round trip mid-game
 *    plays on identically; an unknown save version is rejected.
 * 5. bot: whole readings and whole campaigns on SEEDS seeds at three skills with per-move
 *    invariants, and the balance table.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 8);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const Pc = await import('../js/sim/pieces.js');
const Ar = await import('../js/sim/arcana.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const N = C.N;
const idx = (x, y) => y * N + x;
const glyph = (id, color = 1) => ({ id, cells: Pc.SHAPES[id].cells.map((c) => [...c]), color, uid: 999 });
/** A fresh quest game on an empty board with no omens and a chosen hand. */
function blank({ arc = 0, hand = ['dot', 'dot', 'dot'], restored = [] } = {}) {
    const G = Gm.newGame(1, { arc, restored });
    G.cells.fill(0); G.hp.fill(0); G.sigils.fill(0);
    G.hand = hand.map((h) => (h ? glyph(h) : null));
    G.events.length = 0;
    G.stuck = false;
    return G;
}
const fillRow = (G, y, except = []) => { for (let x = 0; x < N; x++) if (!except.includes(x)) G.cells[idx(x, y)] = 2; };
const fillCol = (G, x, except = []) => { for (let y = 0; y < N; y++) if (!except.includes(y)) G.cells[idx(x, y)] = 3; };
const ev = (G, type) => G.events.filter((e) => e.type === type);

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('pieces')) {
    section('pieces');
    for (const s of Object.values(Pc.SHAPES)) {
        const xs = s.cells.map((c) => c[0]), ys = s.cells.map((c) => c[1]);
        ok(Math.min(...xs) === 0 && Math.min(...ys) === 0, `${s.id} starts at the origin`);
        // connected (diagonal glyphs are connected through corners, on purpose)
        const diag = s.id.startsWith('diag');
        const seen = new Set([0]);
        const q = [s.cells[0]];
        while (q.length) {
            const [x, y] = q.pop();
            s.cells.forEach((c, i) => {
                const d = Math.abs(c[0] - x) + Math.abs(c[1] - y);
                if (!seen.has(i) && (d === 1 || (diag && Math.abs(c[0] - x) === 1 && Math.abs(c[1] - y) === 1))) { seen.add(i); q.push(c); }
            });
        }
        ok(seen.size === s.cells.length, `${s.id} is connected`);
        let r = s.cells;
        for (let k = 0; k < 4; k++) r = Pc.rotateCells(r);
        const key = (cells) => cells.map((c) => c.join(',')).sort().join(';');
        ok(key(r) === key(s.cells), `${s.id} comes back after four turns`);
    }
    ok(Pc.poolFor(0).every((s) => s.cells.length <= 4), 'The Fool deals nothing bigger than four cells');
    ok(Pc.poolFor(7).some((s) => s.id === 'block'), 'the 3×3 block arrives with The Chariot');
    ok(Ar.ARCANA.length === 22 && Ar.ARCANA.every((a, i) => a.n === i), 'there are 22 Major Arcana in order');
    for (const p of Ar.POWER_ORDER) ok(Ar.ARCANA[Ar.POWERS[p].from].power === p, `${p} is granted by ${Ar.ARCANA[Ar.POWERS[p].from].name}`);
}

if (want('rules')) {
    section('rules');
    // a new game
    let G = Gm.newGame(5);
    ok(G.hand.length === 3 && G.hand.every((h) => h), 'a new game deals three glyphs');
    ok(G.cells.every((c) => !c) && G.sigils.every((s) => !s), 'The Fool starts on a clean lattice');
    ok(G.goal === C.goalFor(0) && G.sparks === C.SPARKS.start, 'goal and sparks start right');

    // placing
    G = blank({ hand: ['quad', 'tri-h', 'dot'] });
    ok(Gm.act(G, { t: 'place', i: 0, x: 0, y: 0 }), 'a glyph places on empty cells');
    ok(G.cells[idx(0, 0)] && G.cells[idx(1, 1)] && !G.cells[idx(2, 0)], 'and fills exactly its cells');
    ok(G.hand[0] === null && G.score === 4, 'it leaves the hand and scores a light per cell');
    ok(!Gm.act(G, { t: 'place', i: 1, x: 1, y: 1 }), 'a glyph cannot overlap');
    ok(!Gm.act(G, { t: 'place', i: 1, x: 6, y: 0 }), 'a glyph cannot hang off the edge');
    ok(!Gm.act(G, { t: 'place', i: 0, x: 4, y: 4 }), 'a used slot cannot be placed again');
    ok(ev(G, 'invalid').length === 3 && G.hand[1], 'illegal moves change nothing and say so');

    // a row clear
    G = blank({ hand: ['duo-h', 'dot', 'dot'] });
    fillRow(G, 3, [6, 7]);
    G.cells[idx(0, 7)] = 1;   // so the lattice is not emptied
    Gm.act(G, { t: 'place', i: 0, x: 6, y: 3 });
    ok(G.cells.slice(24, 32).every((c) => !c), 'a full row clears');
    let e = ev(G, 'clear')[0];
    ok(e && e.rows.length === 1 && e.cols.length === 0 && e.points === 100, 'one line scores 100');
    ok(G.resonance === 1, 'a clear raises resonance');

    // a cross scores more and doesn't double count the shared cell
    G = blank({ hand: ['dot', 'dot', 'dot'] });
    fillRow(G, 2, [5]); fillCol(G, 5, [2]);
    Gm.act(G, { t: 'place', i: 0, x: 5, y: 2 });
    e = ev(G, 'clear')[0];
    ok(e && e.rows.length === 1 && e.cols.length === 1 && e.cleared.length === 15, 'a row and a column clear together (15 cells)');
    ok(e.points === 100 * 2 + 50 * 2 + C.SCORE.clearAll, 'two lines score 300, plus the bonus for emptying the lattice');
    ok(G.cells.every((c) => !c) && e.empty && G.score === 1 + e.points, 'an empty lattice is reported');

    // resonance multiplies, misses fade it
    G = blank({ hand: ['dot', 'dot', 'dot'] });
    G.resonance = 2;
    fillRow(G, 0, [0]);
    G.cells[idx(7, 7)] = 1;   // so the lattice is not emptied
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 0 });
    ok(ev(G, 'clear')[0].points === Math.round(100 * (1 + 2 * C.SCORE.resonanceStep)), 'resonance multiplies a clear');
    ok(G.resonance === 3, 'and climbs');
    Gm.act(G, { t: 'place', i: 1, x: 4, y: 4 });
    ok(G.resonance === 2 && G.misses === 1, 'a move without a clear fades it by one');

    // sigils
    G = blank({ hand: ['dot', 'dot', 'dot'] });
    G.sigils[idx(3, 1)] = 1;
    G.cells[idx(7, 7)] = 1;
    fillRow(G, 1, [0]);
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 1 });
    e = ev(G, 'clear')[0];
    ok(e.sigils.length === 1 && !G.sigils[idx(3, 1)] && e.points === 100 + C.SCORE.sigil, 'a clear through a sigil consumes it for bonus light');

    // blight
    G = blank({ hand: ['dot', 'dot', 'dot'] });
    G.cells[idx(7, 7)] = 1;
    fillRow(G, 4, [0]);
    G.cells[idx(4, 4)] = Gm.BLIGHT; G.hp[idx(4, 4)] = 2;
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 4 });
    ok(G.cells[idx(4, 4)] === Gm.BLIGHT && G.hp[idx(4, 4)] === 1, 'blight counts as filled and cracks instead of clearing');
    ok(ev(G, 'clear')[0].cracked.length === 1, 'and says it cracked');
    fillRow(G, 4, [0, 4]);
    Gm.act(G, { t: 'place', i: 1, x: 0, y: 4 });
    ok(!G.cells[idx(4, 4)] && ev(G, 'clear')[1].broken.length === 1, 'a second clear breaks it');

    // omens arrive with the arcana
    G = Gm.newGame(3, { arc: 4, restored: [0, 1, 2, 3] });
    ok(G.sigils.reduce((a, s) => a + s, 0) === Ar.omensFor(4).sigils, 'arriving at an arcanum seeds its sigils');
    ok(G.cells.filter((c) => c === Gm.BLIGHT).length === Ar.omensFor(4).blight, 'and plants its blight');
    let lineBlight = false;
    for (let s = 1; s < 200 && !lineBlight; s++) {
        const H = Gm.newGame(s, { arc: 21 });
        for (let r = 0; r < N; r++) { let n = 0, m = 0; for (let c = 0; c < N; c++) { if (H.cells[idx(c, r)]) n++; if (H.cells[idx(r, c)]) m++; } if (n === N || m === N) lineBlight = true; }
    }
    ok(!lineBlight, 'blight never completes a line by itself (200 seeds at The World)');
    ok(G.owned.includes('transmute') && !G.owned.includes('lantern'), 'powers come from arcana already rekindled');

    // the deal and its mercy
    G = blank({ hand: ['dot', null, null] });
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 0 });
    ok(G.hand.every((h) => h) && ev(G, 'deal').length === 1, 'an empty hand is redealt');
    let fitAll = 0;
    for (let s = 1; s <= 300; s++) {
        const H = blank();
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x * 3 + y * 5 + s) % 4 === 0 || y < 3) H.cells[idx(x, y)] = 1;
        H.hand = [glyph('dot'), null, null];
        H.rng.setState(s * 7919);
        Gm.act(H, { t: 'place', i: 0, x: Gm.placements(H, [[0, 0]])[0][0], y: Gm.placements(H, [[0, 0]])[0][1] });
        if (!H.over && H.hand.every((h) => !h || Gm.fitsAnywhere(H, h.cells))) fitAll++;
    }
    ok(fitAll > 240, `mercy finds a hand that fits a crowded lattice nearly always (${fitAll}/300)`);

    // powers
    G = blank({ restored: [1], hand: ['line4-h', 'quad', 'dot'] });
    ok(G.owned.includes('transmute'), 'The Magician grants Transmute');
    const before = G.hand.map((h) => h.uid);
    ok(Gm.act(G, { t: 'power', p: 'transmute' }) && G.sparks === C.SPARKS.start - 1, 'Transmute costs a spark');
    ok(G.hand.every((h, i) => h && h.uid !== before[i]), 'and redeals the whole hand');
    ok(!Gm.act(G, { t: 'power', p: 'strike', x: 1, y: 1 }), 'an unowned power does nothing');
    G.sparks = 0;
    ok(!Gm.act(G, { t: 'power', p: 'transmute' }), 'a power without sparks does nothing');

    G = blank({ restored: [10], hand: ['line4-h', 'dot', 'dot'] });
    Gm.act(G, { t: 'power', p: 'turn', i: 0 });
    ok(Pc.sizeOf(G.hand[0].cells).h === 4, 'Turn rotates a glyph');

    G = blank({ restored: [9], hand: ['dot', 'dot', 'dot'] });
    fillRow(G, 6, [2]); G.cells[0] = 1;
    ok(Gm.act(G, { t: 'power', p: 'lantern', x: 2, y: 6 }) && ev(G, 'clear').length === 1, 'the Lantern places a single light that can clear a line');
    ok(G.hand.every((h) => h), 'without using a glyph from the hand');

    G = blank({ restored: [16], hand: ['dot', 'dot', 'dot'] });
    fillRow(G, 3, [0]); fillRow(G, 4, [0]);
    G.cells[idx(4, 4)] = Gm.BLIGHT; G.hp[idx(4, 4)] = 3;
    G.sparks = 2;
    ok(Gm.act(G, { t: 'power', p: 'strike', x: 4, y: 4 }), 'Tower Strike fires');
    let struck = 0;
    for (let y = 3; y <= 5; y++) for (let x = 3; x <= 5; x++) if (G.cells[idx(x, y)]) struck++;
    ok(struck === 0 && G.sparks === 0, 'and empties its 3×3, blight and all, for two sparks');

    G = blank({ restored: [17], hand: ['dot', 'dot', 'dot'] });
    G.cells[3] = G.cells[20] = Gm.BLIGHT; G.hp[3] = G.hp[20] = 2;
    ok(Gm.act(G, { t: 'power', p: 'starfall' }) && !G.cells.includes(Gm.BLIGHT), 'Starfall washes away every blight');

    // stuck and over
    G = blank({ hand: ['block', null, null] });
    for (let i = 0; i < N * N; i++) if ((i % N + Math.floor(i / N)) % 2 === 0) G.cells[i] = 1;
    G.hand = [glyph('block'), glyph('block'), null];
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 0 });
    // (invalid) — now check stuck evaluation through a real move
    G = blank({ restored: [1], hand: ['dot', 'block', null] });
    for (let i = 0; i < N * N; i++) if ((i % N + Math.floor(i / N)) % 2 === 0) G.cells[i] = 1;
    G.cells[idx(7, 7)] = 0;
    Gm.act(G, { t: 'place', i: 0, x: 7, y: 7 });
    ok(!G.over && G.stuck && ev(G, 'stuck').length === 1, 'no glyph fits but a power could: stuck, not over');
    G.sparks = 0;
    G.events.length = 0;
    G = blank({ hand: ['dot', 'block', null] });
    for (let i = 0; i < N * N; i++) if ((i % N + Math.floor(i / N)) % 2 === 0) G.cells[i] = 1;
    G.cells[idx(7, 7)] = 0;
    Gm.act(G, { t: 'place', i: 0, x: 7, y: 7 });
    ok(G.over && ev(G, 'over').length === 1, 'no glyph fits and no power: the reading ends');
    ok(!Gm.act(G, { t: 'place', i: 1, x: 0, y: 0 }), 'nothing acts once it is over');
    G = blank({ restored: [1], hand: ['dot', 'dot', 'dot'] });
    ok(Gm.concede(G) && G.over, 'a reading can be conceded');

    // rekindling
    G = blank({ hand: ['dot', 'dot', 'dot'] });
    G.light = G.goal - 1;
    const sparks = G.sparks;
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 0 });
    e = ev(G, 'restore')[0];
    ok(e && e.arc === 0 && G.arc === 1 && G.restored[0] === 0, 'enough light rekindles The Fool and moves on to The Magician');
    ok(G.light === 0 && G.goal === C.goalFor(1) && G.sparks === sparks + 1, 'the overflow carries, the goal rises, a spark is earned');
    ok(G.sigils.some((s) => s) && ev(G, 'arrive').some((a) => a.arc === 1), 'the next arcanum\'s omens arrive');
    G.light = G.goal - 1;
    Gm.act(G, { t: 'place', i: 1, x: 2, y: 2 });
    ok(G.owned.includes('transmute') && ev(G, 'restore').some((r) => r.power === 'transmute'), 'rekindling The Magician grants Transmute at once');

    G = blank({ arc: 21, restored: [...Array(21).keys()], hand: ['dot', 'dot', 'dot'] });
    G.light = G.goal - 1;
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 0 });
    ok(G.won && ev(G, 'ending').length === 1 && G.restored.includes(21), 'rekindling The World ends the Restoration');
    G.light = G.goal;
    Gm.act(G, { t: 'place', i: 1, x: 2, y: 0 });
    ok(!G.over && ev(G, 'ascend').length === 1 && G.restored.length === 1, 'the reading plays on in the afterglow');

    // embers: light gathered in a failed reading carries into the next
    G = Gm.newGame(4, { arc: 6, restored: [0, 1, 2, 3, 4, 5], embers: 700 });
    ok(G.light === 700, 'a new reading starts with the embers of the last');
    G = Gm.newGame(4, { arc: 6, embers: 1e9 });
    ok(G.light === G.goal - 1, 'embers never rekindle a card by themselves');
    G = Gm.newGame(4, { mode: 'endless', embers: 700 });
    ok(G.light === 0, 'a free reading has no embers');

    // endless
    G = Gm.newGame(9, { mode: 'endless' });
    G.light = G.goal;
    G.hand[0] = glyph('dot');
    Gm.act(G, { t: 'place', i: 0, x: Gm.placements(G, [[0, 0]])[0][0], y: Gm.placements(G, [[0, 0]])[0][1] });
    ok(G.arc === 1 && G.restored.length === 0 && ev(G, 'ascend').length === 1, 'a free reading climbs the omens without rekindling anything');

    // creep
    G = blank({ arc: 13, hand: ['dot', 'dot', 'dot'] });
    G.misses = C.CREEP_EVERY - 1;
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 0 });
    ok(ev(G, 'creep').length === 1 && G.cells.includes(Gm.BLIGHT), 'from Death on, the Void creeps after moves without a clear');
    G = blank({ arc: 12, hand: ['dot', 'dot', 'dot'] });
    G.misses = C.CREEP_EVERY - 1;
    Gm.act(G, { t: 'place', i: 0, x: 0, y: 0 });
    ok(ev(G, 'creep').length === 0, 'but not before');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, moves) => {
        const G = Gm.newGame(seed, { arc: 3, restored: [0, 1, 2] });
        const b = Bt.makeBot({ skill: 0.8, seed });
        for (let k = 0; k < moves && !G.over; k++) Gm.act(G, Bt.botCommand(G, b));
        return G;
    };
    const a = play(42, 120), b = play(42, 120);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');

    const G = play(7, 40);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 3 }), b2 = Bt.makeBot({ seed: 3 });
    for (let k = 0; k < 80; k++) { if (!G.over) Gm.act(G, Bt.botCommand(G, b1)); if (!copy.over) Gm.act(copy, Bt.botCommand(copy, b2)); }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ v: 1, cells: [1, 2] }); } catch { threw = true; }
    ok(threw, 'a corrupt save is rejected');
}

if (want('bot')) {
    section('bot');
    const invariants = (G) => {
        if (G.cells.length !== N * N) return 'board size changed';
        for (let i = 0; i < N * N; i++) {
            const c = G.cells[i];
            if (!(c >= 0 && c <= 8)) return `bad cell ${c}`;
            if ((c === Gm.BLIGHT) !== (G.hp[i] > 0)) return 'blight without hit points';
        }
        for (let r = 0; r < N; r++) {
            let row = true, col = true;
            for (let k = 0; k < N; k++) { if (!G.cells[idx(k, r)] || G.cells[idx(k, r)] === Gm.BLIGHT) row = false; if (!G.cells[idx(r, k)] || G.cells[idx(r, k)] === Gm.BLIGHT) col = false; }
            if (row || col) return 'a full line of glyphs was left standing';
        }
        if (!Number.isFinite(G.score) || G.light < 0 || G.light >= G.goal) return 'light out of range';
        if (G.sparks < 0 || G.sparks > C.SPARKS.max) return 'sparks out of range';
        return null;
    };
    const rows = [];
    for (const skill of [1, 0.7, 0.4]) {
        let readings = 0, total = 0, scores = 0, campaigns = 0, first = 0;
        for (let s = 1; s <= SEEDS; s++) {
            let restored = [], runs = 0, bad = null, embers = 0;
            while (restored.length < 22 && runs < 80 && !bad) {
                const G = Gm.newGame(s * 7919 + runs, { arc: restored.length, restored, embers });
                const bot = Bt.makeBot({ skill, seed: s * 31 + runs });
                let m = 0;
                while (!G.over && !G.won && m < 4000) {
                    const cmd = Bt.botCommand(G, bot);
                    if (!cmd) { Gm.concede(G); break; }
                    if (!Gm.act(G, cmd)) { bad = `bot made an illegal move ${JSON.stringify(cmd)}`; break; }
                    G.events.length = 0;
                    bad = invariants(G);
                    if (bad) break;
                    m++;
                }
                if (runs === 0) first += G.restored.length;
                restored = restored.concat(G.restored);
                embers = G.light;
                runs++;
                readings++;
                scores += G.score;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            if (restored.length === 22) campaigns++;
            total += runs;
        }
        rows.push({ skill, readings: (total / SEEDS).toFixed(1), first: (first / SEEDS).toFixed(1), score: Math.round(scores / readings), done: `${campaigns}/${SEEDS}` });
    }
    console.log('  skill  readings to finish  arcana in first reading  mean reading score  finished');
    for (const r of rows) console.log(`  ${String(r.skill).padEnd(6)} ${r.readings.padStart(18)}  ${r.first.padStart(23)}  ${String(r.score).padStart(18)}  ${r.done}`);
    ok(+rows[0].first > +rows[2].first, 'a better bot rekindles more in its first reading');
    ok(rows.every((r) => r.done === `${SEEDS}/${SEEDS}`), 'every bot finishes the Restoration in the end');
    ok(+rows[0].first >= 4, `a perfect bot rekindles at least four arcana in its first reading (${rows[0].first})`);
    ok(+rows[0].readings >= 1.5, `but rarely the whole deck in one (${rows[0].readings} readings)`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
