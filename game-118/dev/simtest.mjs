/**
 * simtest.mjs — headless checks of The Kids Table's simulation. No browser.
 *
 *   node game-118/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-118/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-118/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. rules: spawning, charges and recharge, moving, swapping, pair merges, the max tier, compost,
 *    serving orders, table upgrades, refills, baskets, board lock.
 * 3. content: guests only ask for chains that are unlocked; hints never point at locked cells; every
 *    goal of the Dinner Plan can be reached; chapters pay out; the dinner ends in a win.
 * 4. determinism: the same seed and commands give the same game; a save round trip plays on identically;
 *    an unknown save version is rejected; time away recharges generators.
 * 5. bot: a skilled bot and a sloppy one play whole games on SEEDS seeds with per-tick invariants and
 *    finish the Dinner Plan; the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 6);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');
const { CHAINS, CHAIN_KEYS, GUEST_LIST } = await import('../js/sim/data/items.js');
const { CHAPTERS, goalLabel } = await import('../js/sim/data/chapters.js');
const { idx } = Gm;

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const evs = (G, type) => G.events.filter((e) => e.type === type);
const clear = (G) => { G.events.length = 0; };
const wipe = (G) => { G.cells.fill(null); };

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js',
        ...fs.readdirSync(path.join(ROOT, 'js/sim')).filter((f) => f.endsWith('.js')).map((f) => 'js/sim/' + f),
        ...fs.readdirSync(path.join(ROOT, 'js/sim/data')).map((f) => 'js/sim/data/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(\.\.\/)?(view|ui|audio|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    ok(G.cells.filter((c) => c && c.k === 'gen').length === 2, 'a new game starts with two generators');
    ok(G.cells.filter((c) => c && c.k === 'item').length === 4, 'and four items: a pair of seeds, a pair of crayons');
    ok(Gm.findMerge(G) !== null, 'the first move is a merge');
    ok(G.guests.every(Boolean) && G.guests.length === C.GUESTS.slots, 'three guests are waiting');
    ok(Gm.openCells(G).length === 20, 'the Kids Table is 4 x 5 cells');
    ok(new Set(G.cells.filter(Boolean).map((c) => c.id)).size === 6, 'every item has its own id');

    // spawning
    G = Gm.newGame(2); clear(G);
    const patch = idx(1, 5);
    let r = Gm.act(G, { t: 'tap', cell: patch });
    ok(r.ok && G.cells[patch].ch === C.GEN.max - 1, 'tapping a generator spends one charge');
    const sp = evs(G, 'spawn')[0];
    ok(sp && G.cells[sp.cell] && G.cells[sp.cell].c === 'pumpkin' && G.cells[sp.cell].t <= 2, 'and spawns a pumpkin seed or sprout');
    ok(Gm.isOpen(G, sp.cell) && Math.abs(Gm.colOf(sp.cell) - 1) + Math.abs(Gm.rowOf(sp.cell) - 5) <= 2, 'in a free cell next to it');
    G.cells[patch].ch = 0; clear(G);
    r = Gm.act(G, { t: 'tap', cell: patch });
    ok(!r.ok && r.reason === 'empty' && evs(G, 'denied').length === 1, 'an empty generator says so');
    G.cells[patch].ch = 3;
    G.cells[patch].tm = 0;
    for (let i = 0; i < Math.ceil(C.GEN.regen / C.STEP) + 1; i++) Gm.step(G, C.STEP);
    ok(G.cells[patch].ch === 4, `a generator earns a charge back every ${C.GEN.regen} s`);
    for (let i = 0; i < 4000; i++) Gm.step(G, C.STEP);
    ok(G.cells[patch].ch === C.GEN.max, 'and stops at the maximum');

    // a full board
    G = Gm.newGame(3);
    for (const i of Gm.freeCells(G)) Gm.debugPlace(G, i, 'turkey', 1 + (i % 5));
    clear(G);
    const fullOk = Gm.freeCells(G).length === 0;
    r = Gm.act(G, { t: 'tap', cell: patch });
    ok(fullOk && !r.ok && r.reason === 'full', 'a generator will not spawn onto a full board');

    // moving and merging
    G = Gm.newGame(4); wipe(G); clear(G);
    Gm.debugPlace(G, idx(2, 2), 'pumpkin', 1);
    Gm.debugPlace(G, idx(3, 2), 'pumpkin', 1);
    const coins0 = G.coins;
    r = Gm.act(G, { t: 'move', from: idx(2, 2), to: idx(3, 2) });
    const m = evs(G, 'merge')[0];
    ok(r.ok && !G.cells[idx(2, 2)] && G.cells[idx(3, 2)].t === 2 && G.cells[idx(3, 2)].c === 'pumpkin', 'two seeds merge into a sprout where they were dropped');
    ok(m && m.t === 2 && m.ids.length === 2 && G.stats.merges === 1, 'and the merge event names both items');
    ok(G.stats.maxTier.pumpkin === 2, 'the best tier made is remembered');
    Gm.debugPlace(G, idx(1, 2), 'pumpkin', 2);
    Gm.act(G, { t: 'move', from: idx(1, 2), to: idx(3, 2) });
    ok(G.cells[idx(3, 2)].t === 3 && G.coins === coins0 + C.ECON.mergeCoins[2] + C.ECON.mergeCoins[3], 'a pair of sprouts makes a mini pumpkin, and merges pay a little coin');

    Gm.debugPlace(G, idx(1, 3), 'pumpkin', 1);
    Gm.debugPlace(G, idx(2, 3), 'turkey', 1);
    clear(G);
    Gm.act(G, { t: 'move', from: idx(1, 3), to: idx(2, 3) });
    ok(G.cells[idx(1, 3)].c === 'turkey' && G.cells[idx(2, 3)].c === 'pumpkin' && evs(G, 'swap').length === 1, 'different chains swap places instead of merging');
    Gm.debugPlace(G, idx(1, 4), 'pumpkin', 2);
    Gm.debugPlace(G, idx(2, 4), 'pumpkin', 3);
    Gm.act(G, { t: 'move', from: idx(1, 4), to: idx(2, 4) });
    ok(G.cells[idx(1, 4)].t === 3 && G.cells[idx(2, 4)].t === 2, 'different tiers swap too');
    Gm.debugPlace(G, idx(1, 1), 'craft', C.MAX_TIER);
    Gm.debugPlace(G, idx(2, 1), 'craft', C.MAX_TIER);
    clear(G);
    Gm.act(G, { t: 'move', from: idx(1, 1), to: idx(2, 1) });
    ok(evs(G, 'merge').length === 0 && G.cells[idx(1, 1)].t === C.MAX_TIER, 'the top tier cannot merge any further');
    Gm.act(G, { t: 'move', from: idx(1, 1), to: idx(1, 0) });
    ok(G.cells[idx(1, 1)] && !G.cells[idx(1, 0)], 'a locked cell is not a place to put things');
    const gcell = idx(1, 5);
    G.cells[gcell] = null;
    Gm.debugPlace(G, gcell, 'pumpkin', 'gen');
    Gm.debugPlace(G, idx(2, 5), 'pumpkin', 1);
    Gm.act(G, { t: 'move', from: gcell, to: idx(2, 5) });
    ok(G.cells[idx(2, 5)].k === 'gen' && G.cells[gcell].k === 'item', 'generators can be moved and swapped (Generator Zoning)');
    ok(!Gm.canMerge(G.cells[idx(2, 5)], G.cells[gcell]), 'a generator never merges');

    // compost
    G = Gm.newGame(5); clear(G);
    Gm.debugPlace(G, idx(2, 2), 'grain', 4);
    const before = G.coins;
    Gm.act(G, { t: 'compost', cell: idx(2, 2) });
    ok(!G.cells[idx(2, 2)] && G.coins === before + C.ECON.compostCoins(4) && G.stats.composted === 1, 'the compost bin clears a cell and pays a little');
    r = Gm.act(G, { t: 'compost', cell: idx(1, 5) });
    ok(!r.ok && G.cells[idx(1, 5)], 'but never a generator');

    // serving
    G = Gm.newGame(6); clear(G); wipe(G);
    const q = G.guests[0];
    for (const w of q.wants) for (let n = 0; n < w.n; n++) Gm.debugPlace(G, Gm.freeCells(G)[0], w.c, w.t);
    ok(Gm.readyGuests(G).includes(q.id), 'an order with its items on the board is ready');
    const s0 = G.coins, st0 = G.stars;
    r = Gm.act(G, { t: 'serve', q: q.id });
    ok(r.ok && G.coins === s0 + q.coins && G.stars === st0 + q.stars && G.stats.served === 1, 'serving pays coins and stars');
    ok(G.cells.every((c) => !c) && G.guests[0] === null, 'and takes exactly the items asked for');
    for (let i = 0; i < Math.ceil(C.GUESTS.arrive / C.STEP) + 1; i++) Gm.step(G, C.STEP);
    ok(G.guests[0] && G.guests[0].id !== q.id, 'a new guest takes the seat a moment later');
    r = Gm.act(G, { t: 'serve', q: G.guests[1].id });
    ok(!r.ok && r.reason === 'missing', 'serving without the items is refused');
    // preferred item: drag a specific one onto a guest
    G = Gm.newGame(7); wipe(G);
    const g1 = G.guests[0], w1 = g1.wants[0];
    const a = Gm.debugPlace(G, idx(1, 1), w1.c, w1.t), b = Gm.debugPlace(G, idx(4, 4), w1.c, w1.t);
    for (let k = 1; k < w1.n; k++) Gm.debugPlace(G, Gm.freeCells(G)[0], w1.c, w1.t);
    if (g1.wants.length === 1) {
        Gm.act(G, { t: 'serve', q: g1.id, prefer: idx(4, 4) });
        ok(!G.cells[idx(4, 4)] && (w1.n > 1 || !!G.cells[idx(1, 1)]), 'a dragged item is the one that gets served');
    } else ok(true, 'skipped (two-part order)');
    void a; void b;

    // table upgrades
    G = Gm.newGame(8); clear(G);
    r = Gm.act(G, { t: 'upgrade' });
    ok(!r.ok && r.reason === 'stars', 'a new table costs stars');
    for (let lv = 1; lv < C.TABLES.length; lv++) {
        G.stars = C.TABLES[lv].cost;
        const open0 = Gm.openCells(G).length;
        r = Gm.act(G, { t: 'upgrade' });
        ok(r.ok && G.table === lv && Gm.openCells(G).length > open0 && G.stars === 0, `${C.TABLES[lv].name} opens more cells and spends ${C.TABLES[lv].cost} stars`);
        const gift = C.TABLES[lv].gift;
        if (gift) ok(G.cells.some((c) => c && c.k === 'gen' && c.c === gift && Gm.isOpen(G, G.cells.indexOf(c))), `and brings the ${CHAINS[gift].name}`);
    }
    r = Gm.act(G, { t: 'upgrade' });
    ok(!r.ok && r.reason === 'max', 'the head of the table is the last one');

    // refill and baskets
    G = Gm.newGame(9); clear(G);
    G.coins = 500;
    for (const c of G.cells) if (c && c.k === 'gen') c.ch = 0;
    const rc = Gm.refillCost(G);
    r = Gm.act(G, { t: 'refill' });
    ok(r.ok && G.coins === 500 - rc && G.cells.filter((c) => c && c.k === 'gen').every((c) => c.ch === C.GEN.max), 'a refill tops up every generator for coins by the missing charge');
    r = Gm.act(G, { t: 'refill' });
    ok(!r.ok && r.reason === 'full', 'and refuses when nothing is missing');
    G.coins = 0;
    r = Gm.act(G, { t: 'basket' });
    ok(!r.ok && r.reason === 'coins', 'a basket needs coins');
    G.coins = 100;
    r = Gm.act(G, { t: 'basket' });
    const bk = evs(G, 'basket')[0];
    ok(r.ok && bk && G.cells[bk.cell] && G.cells[bk.cell].t >= 2 && G.coins === 100 - C.ECON.basket, 'a mystery basket gives a tier 2 or 3 item');
    ok(Gm.unlockedChains(G).includes(bk.c), 'of a chain you have');

    // board lock
    G = Gm.newGame(10); wipe(G); clear(G);
    let k = 0;
    for (const i of Gm.openCells(G)) Gm.debugPlace(G, i, CHAIN_KEYS[k % 2], 1 + (k++ % 5));
    // make sure it really is locked: no pair, no free cell
    const seen = new Set();
    for (const i of Gm.openCells(G)) {
        const it = G.cells[i], key = it.c + it.t;
        if (seen.has(key)) Gm.debugPlace(G, i, 'grain', 6);
        seen.add(key);
    }
    Gm.step(G, C.STEP);
    ok(Gm.boardLocked(G) && evs(G, 'locked').length === 1, 'a full board with no pair raises a locked event');
    clear(G);
    Gm.act(G, { t: 'compost', cell: Gm.openCells(G)[0] });
    ok(!Gm.boardLocked(G), 'and the compost bin is always the way out');
}

if (want('content')) {
    section('content');
    // guests only ever ask for chains that have a generator you can reach
    for (let lv = 0; lv < C.TABLES.length; lv++) {
        let bad = 0, n = 0, tiersSeen = new Set(), hi = 0;
        const G = Gm.newGame(100 + lv);
        G.table = lv;
        for (let i = 0; i < 400; i++) {
            G.guests.fill(null);
            for (let s = 0; s < C.GUESTS.slots; s++) G.slotT[s] = 0;
            Gm.step(G, C.STEP);
            clear(G);
            for (const q of G.guests) {
                n++;
                for (const w of q.wants) {
                    if (!Gm.chainUnlocked(G, w.c) || w.t < 2 || w.t > C.MAX_TIER) bad++;
                    tiersSeen.add(w.t); hi = Math.max(hi, w.t);
                }
                if (!GUEST_LIST.some((g) => g.id === q.guest) || q.coins <= 0 || !q.say) bad++;
            }
        }
        ok(bad === 0, `table ${lv}: ${n} guests all ask for unlocked chains and sensible tiers (tiers ${[...tiersSeen].sort().join('')})`);
        ok(hi <= (lv === 0 ? 4 : lv === 1 ? 5 : 6), `table ${lv}: no order is out of reach (top tier ${hi})`);
    }
    // three guests never ask for the very same thing at once, when there is a choice
    const G = Gm.newGame(5);
    let dup = 0;
    for (let i = 0; i < 200; i++) {
        G.guests.fill(null); G.slotT.fill(0); Gm.step(G, C.STEP); clear(G);
        const keys = G.guests.flatMap((q) => q.wants.map((w) => w.c + w.t));
        if (new Set(keys).size < keys.length) dup++;
    }
    ok(dup < 60, `three guests rarely ask for the same thing (${dup}/200)`);

    // hints
    const H = Gm.newGame(11);
    const pair = Gm.findMerge(H);
    ok(pair && pair.every((i) => Gm.isOpen(H, i) && H.cells[i]) && Gm.canMerge(H.cells[pair[0]], H.cells[pair[1]]), 'the merge hint points at two real, open, matching items');

    // every goal of the plan can be met, and every chain it names exists
    for (const ch of CHAPTERS) for (const g of ch.goals) {
        const fine = g.type !== 'make' || (CHAINS[g.c] && g.t >= 1 && g.t <= C.MAX_TIER);
        ok(fine && goalLabel(g).length > 3, `goal "${goalLabel(g)}" is well formed`);
    }
    // goals never need something that is still locked: the table level that brings a chain comes first
    CHAPTERS.forEach((ch, ci) => {
        let level = 0;
        CHAPTERS.slice(0, ci + 1).forEach((c2) => c2.goals.forEach((g) => { if (g.type === 'table') level = Math.max(level, g.n); }));
        // a chain goal in a chapter needs that chain to be unlocked by the end of the chapter's own table goals
        for (const g of ch.goals) if (g.type === 'make') {
            const need = CHAINS[g.c].unlock;
            const reachable = level >= need || ch.goals.some((x) => x.type === 'table' && x.n >= need) || ci > 0 && CHAPTERS.slice(0, ci).some((c2) => c2.goals.some((x) => x.type === 'table' && x.n >= need));
            ok(reachable, `chapter ${ci + 1} "${goalLabel(g)}" needs table ${need}, which the plan reaches first`);
        }
    });

    // courses pay out, and the dinner ends in a win
    const W = Gm.newGame(12); clear(W);
    let coins = W.coins, stars = W.stars, rewardC = 0, rewardS = 0;
    for (let ci = 0; ci < CHAPTERS.length; ci++) {
        for (const g of CHAPTERS[ci].goals) {
            if (g.type === 'make') W.stats.maxTier[g.c] = Math.max(W.stats.maxTier[g.c] || 0, g.t);
            if (g.type === 'serve') W.stats.served = Math.max(W.stats.served, g.n);
            if (g.type === 'merge') W.stats.merges = Math.max(W.stats.merges, g.n);
            if (g.type === 'table') W.table = Math.max(W.table, g.n);
        }
        rewardC += CHAPTERS[ci].reward.coins; rewardS += CHAPTERS[ci].reward.stars;
    }
    Gm.act(W, { t: 'move', from: idx(2, 3), to: idx(3, 3) });   // any command evaluates the goals
    ok(W.won && W.chapter === CHAPTERS.length && evs(W, 'chapter').length === CHAPTERS.length && evs(W, 'win').length === 1, 'meeting every goal plays all five courses and wins');
    ok(W.coins >= coins + rewardC && W.stars >= stars + rewardS, 'each course pays its coins and stars');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed) => { const G = Gm.newGame(seed); const b = Bt.makeBot({ seed }); for (let i = 0; i < 1200; i++) { Gm.step(G, C.STEP); const c = Bt.botAct(G, b, C.STEP); if (c) Gm.act(G, c); G.events.length = 0; } return G; };
    const a = play(42), b = play(42);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and commands, same game');
    ok(JSON.stringify(Gm.serialize(a)) !== JSON.stringify(Gm.serialize(play(43))), 'a different seed plays a different game');

    const G = Gm.newGame(7), bot = Bt.makeBot({ seed: 7 });
    const tick = (g, b2) => { Gm.step(g, C.STEP); const c = Bt.botAct(g, b2, C.STEP); if (c) Gm.act(g, c); g.events.length = 0; };
    for (let i = 0; i < 600; i++) tick(G, bot);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    const b1 = Bt.makeBot({ seed: 9 }), b2 = Bt.makeBot({ seed: 9 });
    for (let i = 0; i < 600; i++) { tick(G, b1); tick(copy, b2); }
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ v: 1, cells: [] }); } catch { threw = true; }
    ok(threw, 'and so is a save with a broken board');

    const O = Gm.newGame(3);
    for (const c of O.cells) if (c && c.k === 'gen') c.ch = 0;
    Gm.offline(O, 3600);
    ok(O.cells.filter((c) => c && c.k === 'gen').every((c) => c.ch === C.GEN.max), 'an hour away recharges every generator');
    const O2 = Gm.newGame(3);
    for (const c of O2.cells) if (c && c.k === 'gen') c.ch = 0;
    Gm.offline(O2, C.GEN.regen * 2 + 1);
    ok(O2.cells.filter((c) => c && c.k === 'gen').every((c) => c.ch === 2), 'and a short while earns a few charges');
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const cap = 120 * 60;
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of [1, 0.6]) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill, seed: s });
            let bad = null, t = 0, locked = 0, wonAt = null;
            while (t < cap && !bad) {
                Gm.step(G, C.STEP); t += C.STEP;
                const cmd = Bt.botAct(G, bot, C.STEP);
                if (cmd) {
                    const r = Gm.act(G, cmd);
                    if (!r.ok && !['empty', 'full', 'coins'].includes(r.reason)) bad = `bot command refused: ${JSON.stringify(cmd)} ${r.reason}`;
                }
                for (const e of G.events) { if (e.type === 'locked') locked++; if (e.type === 'win' && wonAt === null) wonAt = t; }
                G.events.length = 0;
                bad = bad || invariant(G);
                if (G.won) break;
            }
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            ok(G.won, `seed ${s} skill ${skill}: finishes the Dinner Plan (${Math.round(t / 60)} min)`);
            rows.push({ seed: s, skill, min: t / 60, served: G.stats.served, merges: G.stats.merges, spawned: G.stats.spawned, refills: G.stats.refills, composted: G.stats.composted, locked });
        }
    }
    const avg = (k, f) => rows.filter((r) => r.skill === k).reduce((a, r) => a + r[f], 0) / SEEDS;
    ok(avg(1, 'min') < avg(0.6, 'min'), `a better bot finishes sooner (${avg(1, 'min').toFixed(1)} vs ${avg(0.6, 'min').toFixed(1)} min)`);
    ok(avg(0.6, 'min') >= 8 && avg(1, 'min') >= 5, 'and neither skips the game (a dinner takes at least five minutes of charging)');
    ok(rows.every((r) => r.min < 60), 'every run finishes inside an hour');
    ok(rows.filter((r) => r.skill === 1).every((r) => r.locked === 0), 'the skilled bot never board-locks');
    for (const sk of [1, 0.6]) console.log(`  skill ${sk}: ${avg(sk, 'min').toFixed(1)} min · served ${avg(sk, 'served').toFixed(0)} · merges ${avg(sk, 'merges').toFixed(0)} · spawned ${avg(sk, 'spawned').toFixed(0)} · refills ${avg(sk, 'refills').toFixed(1)} · composted ${avg(sk, 'composted').toFixed(1)}`);
}

function invariant(G) {
    const ids = new Set();
    for (let i = 0; i < G.cells.length; i++) {
        const it = G.cells[i];
        if (!it) continue;
        if (!Gm.isOpen(G, i)) return `item in locked cell ${i}`;
        if (ids.has(it.id)) return `duplicate id ${it.id}`;
        ids.add(it.id);
        if (!CHAINS[it.c]) return `unknown chain ${it.c}`;
        if (it.k === 'item' && !(it.t >= 1 && it.t <= C.MAX_TIER)) return `bad tier ${it.t}`;
        if (it.k === 'gen' && !(it.ch >= 0 && it.ch <= C.GEN.max)) return `bad charges ${it.ch}`;
    }
    if (!Number.isFinite(G.coins) || G.coins < 0 || G.stars < 0) return `bad purse ${G.coins} ${G.stars}`;
    if (G.guests.some((q) => q && q.wants.some((w) => !Gm.chainUnlocked(G, w.c)))) return 'a guest wants a locked chain';
    return null;
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);
